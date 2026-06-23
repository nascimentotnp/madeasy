
-- Helper function (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 1) SUPPLIERS
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Enum status
DO $$ BEGIN
  CREATE TYPE public.purchase_status AS ENUM ('draft','received','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) PURCHASE_ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  status public.purchase_status NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT (now()::date),
  received_at timestamptz,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "po_insert" ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "po_update" ON public.purchase_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "po_delete" ON public.purchase_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) PURCHASE_ITEMS
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL CHECK (unit_cost >= 0),
  subtotal numeric(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_purchase_items_po ON public.purchase_items(purchase_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pi_select" ON public.purchase_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "pi_insert" ON public.purchase_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "pi_update" ON public.purchase_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "pi_delete" ON public.purchase_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'estoquista'));

-- 5) Recalcula total quando itens mudam
CREATE OR REPLACE FUNCTION public.recalc_purchase_order_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE po_id uuid;
BEGIN
  po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  UPDATE public.purchase_orders
    SET total = COALESCE((SELECT SUM(subtotal) FROM public.purchase_items WHERE purchase_order_id = po_id), 0)
    WHERE id = po_id;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_pi_recalc_total
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_purchase_order_total();

-- 6) Ao marcar 'received': cria movimentos e ajusta estoque/custo médio
CREATE OR REPLACE FUNCTION public.apply_purchase_received()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item RECORD; old_qty integer; old_cost numeric; new_cost numeric;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    FOR item IN SELECT * FROM public.purchase_items WHERE purchase_order_id = NEW.id LOOP
      SELECT quantity, COALESCE(cost_price,0) INTO old_qty, old_cost FROM public.products WHERE id = item.product_id FOR UPDATE;
      IF (old_qty + item.quantity) > 0 THEN
        new_cost := ((old_qty * old_cost) + (item.quantity * item.unit_cost)) / (old_qty + item.quantity);
      ELSE
        new_cost := item.unit_cost;
      END IF;
      UPDATE public.products
        SET quantity = quantity + item.quantity,
            cost_price = new_cost,
            updated_at = now()
        WHERE id = item.product_id;
      INSERT INTO public.movements(product_id, type, quantity, unit_price, note)
        VALUES (item.product_id, 'in', item.quantity, item.unit_cost,
                'Compra recebida (pedido ' || NEW.id::text || ')');
    END LOOP;
    NEW.received_at := COALESCE(NEW.received_at, now());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_po_apply_received
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_received();
