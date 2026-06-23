CREATE POLICY "Autenticados leem fotos de produtos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Autenticados enviam fotos de produtos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Autenticados atualizam fotos de produtos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

CREATE POLICY "Autenticados apagam fotos de produtos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');