
-- Payment methods
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pm" ON public.payment_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin manage pm" ON public.payment_methods FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.payment_methods (name, fee_percent) VALUES
  ('Dinheiro', 0), ('PIX', 0), ('Débito', 1.5), ('Crédito', 3.5), ('Boleto', 0);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  recurring TEXT CHECK (recurring IN ('mensal','semanal','anual')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin manage exp" ON public.expenses FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_exp_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_expenses_status ON public.expenses(status, due_date);

-- Cash sessions (fechamento de caixa)
CREATE TABLE public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2),
  expected_balance NUMERIC(12,2),
  difference NUMERIC(12,2),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin manage cs" ON public.cash_sessions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'financeiro'));
CREATE TRIGGER trg_cs_updated BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Garantir apenas uma sessão aberta
CREATE UNIQUE INDEX one_open_cash_session ON public.cash_sessions ((1)) WHERE closed_at IS NULL;

-- Sales: payment method + due date + session
ALTER TABLE public.sales
  ADD COLUMN payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN due_date DATE,
  ADD COLUMN cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

-- Cash entries: linkar sessão e despesa, permitir entradas sem movement (despesas)
ALTER TABLE public.cash_entries
  ADD COLUMN cash_session_id UUID REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  ADD COLUMN expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'venda' CHECK (entry_type IN ('venda','despesa','aporte','sangria','ajuste'));

ALTER TABLE public.cash_entries ALTER COLUMN movement_id DROP NOT NULL;

-- Trigger: ao marcar despesa como paga, criar cash_entry negativo na sessão aberta
CREATE OR REPLACE FUNCTION public.sync_expense_to_cash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_session UUID;
BEGIN
  IF NEW.status = 'pago' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pago') THEN
    IF NEW.paid_at IS NULL THEN NEW.paid_at := now(); END IF;
    SELECT id INTO open_session FROM public.cash_sessions WHERE closed_at IS NULL LIMIT 1;
    INSERT INTO public.cash_entries (expense_id, amount, description, entry_type, cash_session_id)
    VALUES (NEW.id, -NEW.amount, COALESCE('Despesa: ' || NEW.description, 'Despesa'), 'despesa', open_session);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_expense_to_cash
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_expense_to_cash();

-- Atualizar sync_cash_on_status: anexar à sessão aberta
CREATE OR REPLACE FUNCTION public.sync_cash_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  open_session UUID;
BEGIN
  IF NEW.type = 'out' AND NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    SELECT id INTO open_session FROM public.cash_sessions WHERE closed_at IS NULL LIMIT 1;
    INSERT INTO public.cash_entries (movement_id, amount, description, entry_type, cash_session_id)
    VALUES (NEW.id, NEW.unit_price * NEW.quantity, 'Venda finalizada', 'venda', open_session)
    ON CONFLICT (movement_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
