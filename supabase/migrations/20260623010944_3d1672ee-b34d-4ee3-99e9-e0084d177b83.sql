
-- Allow updates
GRANT UPDATE ON public.movements TO anon, authenticated;
CREATE POLICY "public update movements" ON public.movements
  FOR UPDATE USING (true) WITH CHECK (true);

-- Recompute stock on movement update
CREATE OR REPLACE FUNCTION public.adjust_on_movement_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_delta INTEGER;
  new_delta INTEGER;
BEGIN
  IF NEW.product_id <> OLD.product_id THEN
    RAISE EXCEPTION 'Não é permitido trocar o produto de uma movimentação';
  END IF;

  old_delta := CASE WHEN OLD.type = 'in' THEN OLD.quantity ELSE -OLD.quantity END;
  new_delta := CASE WHEN NEW.type = 'in' THEN NEW.quantity ELSE -NEW.quantity END;

  UPDATE public.products
    SET quantity = quantity - old_delta + new_delta,
        updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_adjust_on_movement_update
AFTER UPDATE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.adjust_on_movement_update();

-- Revert stock on movement delete
CREATE OR REPLACE FUNCTION public.revert_on_movement_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.type = 'in' THEN
    UPDATE public.products SET quantity = quantity - OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  ELSE
    UPDATE public.products SET quantity = quantity + OLD.quantity, updated_at = now()
    WHERE id = OLD.product_id;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_revert_on_movement_delete
AFTER DELETE ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.revert_on_movement_delete();
