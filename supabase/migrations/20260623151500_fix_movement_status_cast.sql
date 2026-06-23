-- Add 'devolvida' to public.movement_status enum
ALTER TYPE public.movement_status ADD VALUE IF NOT EXISTS 'devolvida';

-- Redefine public.create_movement_for_sale_item to use movement_status instead of sale_status
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
    sale_record.status::public.movement_status,
    sale_record.customer_id,
    NEW.sale_id,
    'Item de venda'
  )
  RETURNING id INTO mov_id;

  NEW.movement_id := mov_id;
  RETURN NEW;
END;
$$;

-- Redefine public.cascade_sale_status_to_movements to use movement_status instead of sale_status
CREATE OR REPLACE FUNCTION public.cascade_sale_status_to_movements()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE public.movements SET status = NEW.status::public.movement_status WHERE sale_id = NEW.id;
    IF NEW.status = 'pago' AND OLD.status <> 'pago' THEN
      NEW.paid_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
