
-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  document TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO anon, authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "public insert customers" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "public update customers" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete customers" ON public.customers FOR DELETE USING (true);
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Status enum for sale lifecycle
CREATE TYPE public.movement_status AS ENUM ('proposta', 'entregue', 'pago');

-- Add sale fields to movements
ALTER TABLE public.movements
  ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN status public.movement_status,
  ADD COLUMN unit_price NUMERIC NOT NULL DEFAULT 0;

-- Defaults for outgoing movements (proposta + snapshot unit price)
CREATE OR REPLACE FUNCTION public.set_movement_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type = 'out' THEN
    IF NEW.status IS NULL THEN
      NEW.status := 'proposta';
    END IF;
    IF NEW.unit_price = 0 THEN
      SELECT price INTO NEW.unit_price FROM public.products WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER movements_set_defaults BEFORE INSERT ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.set_movement_defaults();

-- Status can only advance: proposta -> entregue -> pago (no going back)
CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type = 'out' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pago' THEN
      RAISE EXCEPTION 'Venda paga não pode mudar de status';
    END IF;
    IF OLD.status = 'entregue' AND NEW.status = 'proposta' THEN
      RAISE EXCEPTION 'Não é possível voltar de entregue para proposta';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER movements_validate_status BEFORE UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_status_transition();

-- Cash entries (registered when sale becomes 'pago')
CREATE TABLE public.cash_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES public.movements(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cash_entries_movement_id_unique ON public.cash_entries(movement_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO anon, authenticated;
GRANT ALL ON public.cash_entries TO service_role;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read cash_entries" ON public.cash_entries FOR SELECT USING (true);
CREATE POLICY "public insert cash_entries" ON public.cash_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "public update cash_entries" ON public.cash_entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete cash_entries" ON public.cash_entries FOR DELETE USING (true);

-- Auto sync cash entry when status becomes 'pago'
CREATE OR REPLACE FUNCTION public.sync_cash_on_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type = 'out' AND NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    INSERT INTO public.cash_entries (movement_id, amount, description)
    VALUES (NEW.id, NEW.unit_price * NEW.quantity, 'Venda finalizada')
    ON CONFLICT (movement_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER movements_sync_cash AFTER UPDATE ON public.movements
  FOR EACH ROW EXECUTE FUNCTION public.sync_cash_on_status();
