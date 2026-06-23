-- Onda 2: Vendas com múltiplos itens

-- 1) sales (cabeçalho)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN ('proposta','entregue','pago')),
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem vendas" ON public.sales FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados criam vendas" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados atualizam vendas" ON public.sales FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados removem vendas" ON public.sales FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) sale_items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_id_idx ON public.sale_items(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem itens" ON public.sale_items FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados criam itens" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados atualizam itens" ON public.sale_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Autenticados removem itens" ON public.sale_items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- 3) movements ganha sale_id
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movements_sale_id_idx ON public.movements(sale_id);

-- 4) Trigger: ao criar sale_item, gerar movement de saída
CREATE OR REPLACE FUNCTION public.create_movement_for_sale_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sale_record RECORD;
  mov_id UUID;
  available_qty INTEGER;
BEGIN
  SELECT * INTO sale_record FROM public.sales WHERE id = NEW.sale_id;
  IF sale_record IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  SELECT quantity INTO available_qty FROM public.products WHERE id = NEW.product_id;
  IF available_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto (disponível: %)', available_qty;
  END IF;

  NEW.subtotal := NEW.quantity * NEW.unit_price;

  INSERT INTO public.movements (product_id, type, quantity, unit_price, status, customer_id, sale_id, note)
  VALUES (
    NEW.product_id,
    'out',
    NEW.quantity,
    NEW.unit_price,
    sale_record.status::sale_status,
    sale_record.customer_id,
    NEW.sale_id,
    'Item de venda'
  )
  RETURNING id INTO mov_id;

  NEW.movement_id := mov_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_movement_for_sale_item ON public.sale_items;
CREATE TRIGGER trg_create_movement_for_sale_item
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.create_movement_for_sale_item();

-- 5) Trigger: ao apagar sale_item, apagar movement (devolve estoque via revert_on_movement_delete já existente)
CREATE OR REPLACE FUNCTION public.delete_movement_for_sale_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.movement_id IS NOT NULL THEN
    DELETE FROM public.movements WHERE id = OLD.movement_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_movement_for_sale_item ON public.sale_items;
CREATE TRIGGER trg_delete_movement_for_sale_item
  AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.delete_movement_for_sale_item();

-- 6) Atualizar total da venda automaticamente
CREATE OR REPLACE FUNCTION public.recalculate_sale_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_sale UUID;
BEGIN
  target_sale := COALESCE(NEW.sale_id, OLD.sale_id);
  UPDATE public.sales
    SET total = COALESCE((SELECT SUM(subtotal) FROM public.sale_items WHERE sale_id = target_sale), 0) - COALESCE(discount, 0),
        updated_at = now()
  WHERE id = target_sale;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_sale_total ON public.sale_items;
CREATE TRIGGER trg_recalc_sale_total
  AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_sale_total();

-- 7) Quando o status da venda muda, propagar para movements
-- Precisamos do tipo sale_status (já existe? não, movements.status é TEXT). Vamos criar para o cast acima.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status') THEN
    CREATE TYPE public.sale_status AS ENUM ('proposta','entregue','pago');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cascade_sale_status_to_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.movements SET status = NEW.status::sale_status WHERE sale_id = NEW.id;
    IF NEW.status = 'pago' AND OLD.status <> 'pago' THEN
      NEW.paid_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_sale_status ON public.sales;
CREATE TRIGGER trg_cascade_sale_status
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.cascade_sale_status_to_movements();

-- 8) Quando desconto muda, recalcular total
CREATE OR REPLACE FUNCTION public.apply_discount_to_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.discount IS DISTINCT FROM OLD.discount THEN
    NEW.total := COALESCE((SELECT SUM(subtotal) FROM public.sale_items WHERE sale_id = NEW.id), 0) - COALESCE(NEW.discount, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_discount ON public.sales;
CREATE TRIGGER trg_apply_discount
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_discount_to_total();