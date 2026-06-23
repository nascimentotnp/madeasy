
ALTER TABLE public.customers DROP COLUMN IF EXISTS document;

ALTER TABLE public.customers
  ADD COLUMN country TEXT NOT NULL DEFAULT 'BR',
  ADD COLUMN cep TEXT,
  ADD COLUMN street TEXT,
  ADD COLUMN number TEXT,
  ADD COLUMN complement TEXT,
  ADD COLUMN neighborhood TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT;

CREATE UNIQUE INDEX customers_cep_name_phone_unique
  ON public.customers (cep, name, phone);
