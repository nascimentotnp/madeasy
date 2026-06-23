
CREATE OR REPLACE FUNCTION public.apply_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
