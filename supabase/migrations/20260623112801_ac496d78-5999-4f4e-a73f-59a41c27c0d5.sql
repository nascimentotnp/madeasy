
-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'financeiro', 'estoquista');

-- 2. Tabela profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Função has_role (security definer p/ evitar recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 5. Políticas profiles
CREATE POLICY "users read own profile or admin reads all" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "admin insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Políticas user_roles
CREATE POLICY "users read own roles or admin reads all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Trigger: cria profile ao criar usuário no auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Atualizar políticas existentes para escopar por papel

-- customers: leitura/escrita p/ qualquer logado; só admin deleta
DROP POLICY IF EXISTS "auth delete customers" ON public.customers;
CREATE POLICY "admin delete customers" ON public.customers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- products: admin/estoquista escreve; todos leem (continua); só admin deleta
DROP POLICY IF EXISTS "auth insert products" ON public.products;
DROP POLICY IF EXISTS "auth update products" ON public.products;
DROP POLICY IF EXISTS "auth delete products" ON public.products;
CREATE POLICY "stock writers insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "stock writers update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'estoquista'));
CREATE POLICY "admin delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- movements: admin/vendedor/estoquista insere; estes + financeiro atualizam; só admin deleta
DROP POLICY IF EXISTS "auth insert movements" ON public.movements;
DROP POLICY IF EXISTS "auth update movements" ON public.movements;
DROP POLICY IF EXISTS "auth delete movements" ON public.movements;
CREATE POLICY "ops insert movements" ON public.movements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'vendedor')
    OR public.has_role(auth.uid(),'estoquista')
  );
CREATE POLICY "ops update movements" ON public.movements
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'vendedor')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_role(auth.uid(),'estoquista')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'vendedor')
    OR public.has_role(auth.uid(),'financeiro')
    OR public.has_role(auth.uid(),'estoquista')
  );
CREATE POLICY "admin delete movements" ON public.movements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- cash_entries: apenas admin e financeiro
DROP POLICY IF EXISTS "auth read cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "auth insert cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "auth update cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "auth delete cash_entries" ON public.cash_entries;
CREATE POLICY "fin read cash" ON public.cash_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "fin insert cash" ON public.cash_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "fin update cash" ON public.cash_entries
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "admin delete cash" ON public.cash_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- 9. sync_cash_on_status passa a rodar com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.sync_cash_on_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'out' AND NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    INSERT INTO public.cash_entries (movement_id, amount, description)
    VALUES (NEW.id, NEW.unit_price * NEW.quantity, 'Venda finalizada')
    ON CONFLICT (movement_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
