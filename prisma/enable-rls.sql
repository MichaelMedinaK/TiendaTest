-- Seguridad a nivel de fila (RLS) para Supabase / PostgreSQL.
--
-- Que hace: activa RLS en TODAS las tablas del esquema public SIN politicas, con lo que los roles de la API
-- publica de Supabase (anon y authenticated) no pueden leer ni escribir ninguna fila, aunque alguien tenga
-- la URL y la anon key del proyecto. Ademas les quita los permisos sobre las tablas (doble barrera).
--
-- La aplicacion NO se ve afectada: se conecta con el usuario `postgres` (DATABASE_URL), que es el duenio de
-- las tablas y no queda sometido a RLS. No uses las credenciales anon/authenticated en DATABASE_URL.
--
-- Como ejecutarlo:
--   * Supabase: Dashboard > SQL Editor > pegar este archivo > Run.
--   * Desde el proyecto:  npm run db:rls
-- Se puede ejecutar varias veces (es idempotente). Ejecutalo despues de cada "db push" que cree tablas;
-- si el evento automatico del final se pudo crear, las tablas nuevas ya nacen con RLS activado.

-- 1) RLS en todas las tablas existentes del esquema public.
DO $$
DECLARE
  tabla record;
BEGIN
  FOR tabla IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', tabla.schemaname, tabla.tablename);
  END LOOP;
END $$;

-- 2) Quitar permisos a los roles de la API publica (solo existen en Supabase; en otros PostgreSQL se omite).
DO $$
DECLARE
  rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', rol);
    END IF;
  END LOOP;
END $$;

-- 3) Las tablas que se creen en el futuro nacen con RLS activado.
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  comando record;
BEGIN
  FOR comando IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO') AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', comando.object_identity);
  END LOOP;
END;
$$;

DO $$
BEGIN
  DROP EVENT TRIGGER IF EXISTS rls_auto_enable_on_create_table;
  CREATE EVENT TRIGGER rls_auto_enable_on_create_table
    ON ddl_command_end
    WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    EXECUTE FUNCTION public.rls_auto_enable();
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'No se pudo crear el evento automatico (permisos). Ejecuta este script despues de cada db push.';
END $$;

-- Funcion interna: no debe poder invocarse desde la API publica.
DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo ajustar los permisos de rls_auto_enable().';
END $$;
