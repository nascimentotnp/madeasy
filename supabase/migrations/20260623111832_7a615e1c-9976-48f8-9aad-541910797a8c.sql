
-- customers: restrict to authenticated users only
DROP POLICY IF EXISTS "public read customers" ON public.customers;
DROP POLICY IF EXISTS "public insert customers" ON public.customers;
DROP POLICY IF EXISTS "public update customers" ON public.customers;
DROP POLICY IF EXISTS "public delete customers" ON public.customers;

REVOKE ALL ON public.customers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;

CREATE POLICY "auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update customers" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete customers" ON public.customers FOR DELETE TO authenticated USING (true);

-- cash_entries: restrict to authenticated users only
DROP POLICY IF EXISTS "public read cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "public insert cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "public update cash_entries" ON public.cash_entries;
DROP POLICY IF EXISTS "public delete cash_entries" ON public.cash_entries;

REVOKE ALL ON public.cash_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_entries TO authenticated;

CREATE POLICY "auth read cash_entries" ON public.cash_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cash_entries" ON public.cash_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cash_entries" ON public.cash_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cash_entries" ON public.cash_entries FOR DELETE TO authenticated USING (true);

-- products & movements: keep public read but remove permissive write (intentionally public per memory)
DROP POLICY IF EXISTS "public insert products" ON public.products;
DROP POLICY IF EXISTS "public update products" ON public.products;
DROP POLICY IF EXISTS "public delete products" ON public.products;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
CREATE POLICY "auth insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete products" ON public.products FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "public insert movements" ON public.movements;
DROP POLICY IF EXISTS "public update movements" ON public.movements;
DROP POLICY IF EXISTS "public delete movements" ON public.movements;
REVOKE INSERT, UPDATE, DELETE ON public.movements FROM anon;
GRANT INSERT, UPDATE, DELETE ON public.movements TO authenticated;
CREATE POLICY "auth insert movements" ON public.movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update movements" ON public.movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete movements" ON public.movements FOR DELETE TO authenticated USING (true);
