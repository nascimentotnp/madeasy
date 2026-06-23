
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS size  text;

CREATE UNIQUE INDEX IF NOT EXISTS products_name_model_size_key
  ON public.products (
    lower(btrim(name)),
    lower(btrim(coalesce(model, ''))),
    lower(btrim(coalesce(size,  '')))
  );
