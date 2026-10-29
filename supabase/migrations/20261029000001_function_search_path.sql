-- Fija el search_path de las funciones del esquema (aviso de seguridad «function_search_path_mutable» de Supabase):
-- con uno variable, quien pueda crear objetos en otro esquema podría hacer que la función use los suyos.
-- is_admin ya califica todo (auth.jwt()) y set_updated_at solo usa funciones de pg_catalog, que siempre se buscan primero.
alter function public.is_admin() set search_path = '';
alter function public.set_updated_at() set search_path = '';
