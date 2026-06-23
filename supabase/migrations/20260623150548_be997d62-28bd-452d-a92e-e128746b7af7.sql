
-- 1. Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID,
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table_created ON public.audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON public.audit_log(table_name, record_id);

-- 2. Grants + RLS (admin-only reads)
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE
  v_user UUID;
  v_email TEXT;
  v_rec_id TEXT;
  v_old JSONB;
  v_new JSONB;
  v_changed TEXT[];
  k TEXT;
BEGIN
  v_user := auth.uid();
  IF v_user IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_rec_id := COALESCE((v_old->>'id'), '');
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, user_id, user_email)
    VALUES (TG_TABLE_NAME, v_rec_id, 'DELETE', v_old, v_user, v_email);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_rec_id := COALESCE((v_new->>'id'), '');
    INSERT INTO public.audit_log(table_name, record_id, action, new_data, user_id, user_email)
    VALUES (TG_TABLE_NAME, v_rec_id, 'INSERT', v_new, v_user, v_email);
    RETURN NEW;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_rec_id := COALESCE((v_new->>'id'), '');
    v_changed := ARRAY[]::TEXT[];
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k IN ('updated_at') THEN CONTINUE; END IF;
      IF (v_old->k) IS DISTINCT FROM (v_new->k) THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    IF array_length(v_changed, 1) IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.audit_log(table_name, record_id, action, old_data, new_data, changed_fields, user_id, user_email)
    VALUES (TG_TABLE_NAME, v_rec_id, 'UPDATE', v_old, v_new, v_changed, v_user, v_email);
    RETURN NEW;
  END IF;
END; $$;

-- 4. Attach triggers to relevant tables
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'products','sales','sale_items','customers','movements','expenses',
    'purchase_orders','purchase_items','suppliers','user_roles','inventory_adjustments'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit()', t, t);
  END LOOP;
END $$;
