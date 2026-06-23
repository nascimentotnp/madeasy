-- Disable the movement trigger temporarily to prevent double counting of stock during backfill
ALTER TABLE public.movements DISABLE TRIGGER trg_apply_movement;

-- Insert correction movements for products where quantity doesn't match the sum of movements
INSERT INTO public.movements (product_id, type, quantity, note)
SELECT 
  p.id, 
  (CASE WHEN (p.quantity - COALESCE(SUM(CASE WHEN m.type = 'in' THEN m.quantity ELSE -m.quantity END), 0)) > 0 THEN 'in' ELSE 'out' END)::public.movement_type,
  ABS(p.quantity - COALESCE(SUM(CASE WHEN m.type = 'in' THEN m.quantity ELSE -m.quantity END), 0)),
  'Estoque inicial retroativo'
FROM public.products p
LEFT JOIN public.movements m ON m.product_id = p.id
GROUP BY p.id, p.quantity
HAVING p.quantity <> COALESCE(SUM(CASE WHEN m.type = 'in' THEN m.quantity ELSE -m.quantity END), 0);

-- Re-enable the movement trigger
ALTER TABLE public.movements ENABLE TRIGGER trg_apply_movement;
