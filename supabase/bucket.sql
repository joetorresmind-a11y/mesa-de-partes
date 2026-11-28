-- Ejecutar en SQL Editor del proyecto Supabase.
-- Depósito privado; el navegador NO recibe permisos sobre storage.objects.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mesa-partes-adjuntos','mesa-partes-adjuntos',false,10485760,
 array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,
 allowed_mime_types=excluded.allowed_mime_types;
-- No crear políticas públicas SELECT/INSERT/UPDATE/DELETE para este depósito.
-- En proyectos existentes, revisar que no existan políticas generales que den acceso.
