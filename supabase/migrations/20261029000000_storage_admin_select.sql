-- El admin tiene que poder VER los objetos del bucket para poder borrarlos: sin una política de lectura,
-- Storage no encuentra el archivo y el borrado termina «bien» sin borrar nada (quedan fotos huérfanas).
-- La lectura pública de las fotos no depende de esto: el bucket es público.
create policy product_images_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
