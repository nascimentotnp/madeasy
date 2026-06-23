
-- 1. Add 'devolvida' to enum
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'devolvida';

-- 2. Update sales CHECK constraint
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
  CHECK (status = ANY (ARRAY['proposta','entregue','pago','devolvida']));

-- 3. Allow transitions to 'devolvida' from 'entregue' or 'pago' only
CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type = 'out' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'devolvida' THEN
      RAISE EXCEPTION 'Venda devolvida não pode mudar de status';
    END IF;
    IF NEW.status = 'devolvida' AND OLD.status NOT IN ('entregue','pago') THEN
      RAISE EXCEPTION 'Só é possível devolver vendas entregues ou pagas';
    END IF;
    IF OLD.status = 'pago' AND NEW.status <> 'devolvida' THEN
      RAISE EXCEPTION 'Venda paga não pode mudar de status';
    END IF;
    IF OLD.status = 'entregue' AND NEW.status = 'proposta' THEN
      RAISE EXCEPTION 'Não é possível voltar de entregue para proposta';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 4. Sales-level trigger: on transition to 'devolvida' → revert stock & cash
CREATE OR REPLACE FUNCTION public.apply_sale_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  item RECORD;
  open_session UUID;
  was_paid BOOLEAN;
BEGIN
  IF NEW.status = 'devolvida' AND OLD.status IS DISTINCT FROM 'devolvida' THEN
    was_paid := (OLD.status = 'pago');

    -- Revert stock: create 'in' movements for each sale item
    FOR item IN SELECT * FROM public.sale_items WHERE sale_id = NEW.id LOOP
      INSERT INTO public.movements(product_id, type, quantity, unit_price, note)
      VALUES (item.product_id, 'in', item.quantity, item.unit_price,
              'Devolução da venda ' || NEW.id::text);
    END LOOP;

    -- If paid, refund the cash
    IF was_paid THEN
      SELECT id INTO open_session FROM public.cash_sessions WHERE closed_at IS NULL LIMIT 1;
      INSERT INTO public.cash_entries (amount, description, entry_type, cash_session_id)
      VALUES (-NEW.total, 'Devolução da venda ' || NEW.id::text, 'devolucao', open_session);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_sale_return ON public.sales;
CREATE TRIGGER trg_apply_sale_return
  AFTER UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_sale_return();
