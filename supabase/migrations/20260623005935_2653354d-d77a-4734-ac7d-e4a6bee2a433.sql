
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "public insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "public update products" ON public.products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete products" ON public.products FOR DELETE USING (true);

CREATE TYPE public.movement_type AS ENUM ('in', 'out');

CREATE TABLE public.movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type public.movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO anon, authenticated;
GRANT ALL ON public.movements TO service_role;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read movements" ON public.movements FOR SELECT USING (true);
CREATE POLICY "public insert movements" ON public.movements FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete movements" ON public.movements FOR DELETE USING (true);

CREATE INDEX idx_movements_product ON public.movements(product_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'in' THEN
    UPDATE public.products SET quantity = quantity + NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  ELSE
    UPDATE public.products SET quantity = quantity - NEW.quantity, updated_at = now() WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_movement
AFTER INSERT ON public.movements
FOR EACH ROW EXECUTE FUNCTION public.apply_movement();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
