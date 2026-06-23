-- Onda 1: Estoque avançado

-- 1) Colunas novas em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Índice único parcial: barcode único quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique
  ON public.products (barcode)
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

-- 2) Tabela de ajustes de inventário
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  previous_quantity INTEGER NOT NULL,
  counted_quantity INTEGER NOT NULL CHECK (counted_quantity >= 0),
  difference INTEGER NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_adjustments TO authenticated;
GRANT ALL ON public.inventory_adjustments TO service_role;

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem ajustes"
  ON public.inventory_adjustments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados criam ajustes"
  ON public.inventory_adjustments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados atualizam ajustes"
  ON public.inventory_adjustments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados removem ajustes"
  ON public.inventory_adjustments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 3) Trigger: criar movimento automaticamente quando insere ajuste
CREATE OR REPLACE FUNCTION public.apply_inventory_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_qty INTEGER;
  mov_id UUID;
BEGIN
  SELECT quantity INTO current_qty FROM public.products WHERE id = NEW.product_id FOR UPDATE;
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  NEW.previous_quantity := current_qty;
  NEW.difference := NEW.counted_quantity - current_qty;

  IF NEW.difference <> 0 THEN
    INSERT INTO public.movements (product_id, type, quantity, note, unit_price, status)
    VALUES (
      NEW.product_id,
      CASE WHEN NEW.difference > 0 THEN 'in' ELSE 'out' END,
      ABS(NEW.difference),
      COALESCE('Ajuste de inventário: ' || NEW.reason, 'Ajuste de inventário'),
      0,
      NULL
    )
    RETURNING id INTO mov_id;
    NEW.movement_id := mov_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_inventory_adjustment ON public.inventory_adjustments;
CREATE TRIGGER trg_apply_inventory_adjustment
  BEFORE INSERT ON public.inventory_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_adjustment();