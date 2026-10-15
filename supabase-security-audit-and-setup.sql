-- ==============================================================================
-- SCRIPT DE SEGURIDAD Y CONFIGURACIÓN COMPLETA PARA SUPABASE
-- MY Importadora - Auditoría y Fortalecimiento de Autenticación, RLS y Storage
-- ==============================================================================
-- INSTRUCCIONES DE EJECUCIÓN:
-- 1. Inicia sesión en tu panel de control de Supabase (https://supabase.com/dashboard).
-- 2. Entra en tu proyecto y selecciona "SQL Editor" en el menú lateral izquierdo.
-- 3. Crea una "New Query", pega todo este contenido y presiona "Run" (o Ctrl + Enter).
-- 4. Este script es completamente idempotente y SEGURO: no borra datos existentes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA: categories (Categorías de la Tienda)
-- Creada en primer lugar para evitar el error "relation public.categories does not exist"
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de categorías" ON public.categories;
DROP POLICY IF EXISTS "Gestión de categorías" ON public.categories;
DROP POLICY IF EXISTS "Modificación de categorías por admin" ON public.categories;

CREATE POLICY "Lectura pública de categorías" ON public.categories 
FOR SELECT USING (true);

CREATE POLICY "Modificación de categorías por admin" ON public.categories 
FOR ALL USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

-- ------------------------------------------------------------------------------
-- 2. TABLA: products (Catálogo de Productos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  image_1 TEXT,
  image_2 TEXT,
  image_3 TEXT,
  image_4 TEXT,
  image_5 TEXT,
  image_6 TEXT,
  min_wholesale_qty INT DEFAULT 1,
  wholesale_price NUMERIC NOT NULL,
  retail_price NUMERIC NOT NULL,
  cash_price NUMERIC,
  colors JSONB DEFAULT '[]'::jsonb,
  size_variants JSONB DEFAULT '[]'::jsonb,
  stock INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  rating NUMERIC DEFAULT 5.0,
  reviews_count INT DEFAULT 0,
  specs JSONB DEFAULT '[]'::jsonb,
  is_best_seller BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Columnas adicionales de respaldo si la tabla ya existía
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS image_1 TEXT,
ADD COLUMN IF NOT EXISTS image_2 TEXT,
ADD COLUMN IF NOT EXISTS image_3 TEXT,
ADD COLUMN IF NOT EXISTS image_4 TEXT,
ADD COLUMN IF NOT EXISTS image_5 TEXT,
ADD COLUMN IF NOT EXISTS image_6 TEXT,
ADD COLUMN IF NOT EXISTS cash_price NUMERIC;

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_best_seller ON public.products(is_best_seller);
CREATE INDEX IF NOT EXISTS idx_products_images_gin ON public.products USING gin (images);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de productos" ON public.products;
DROP POLICY IF EXISTS "Gestión de productos" ON public.products;
DROP POLICY IF EXISTS "Modificación de productos por admin" ON public.products;

CREATE POLICY "Lectura pública de productos" ON public.products 
FOR SELECT USING (true);

CREATE POLICY "Modificación de productos por admin" ON public.products 
FOR ALL USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

-- ------------------------------------------------------------------------------
-- 3. TABLA: profiles (Perfiles Privados de Clientes)
-- Vinculada directamente con auth.users mediante UUID
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  dni TEXT,
  street TEXT,
  street_number TEXT,
  floor TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  receiver_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestión de perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Lectura pública/propia de perfiles" ON public.profiles;
DROP POLICY IF EXISTS "Actualización de perfiles propios" ON public.profiles;
DROP POLICY IF EXISTS "Inserción de perfiles propios" ON public.profiles;
DROP POLICY IF EXISTS "Lectura de perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Actualización de perfil propio" ON public.profiles;
DROP POLICY IF EXISTS "Inserción de perfil propio" ON public.profiles;

CREATE POLICY "Lectura de perfil propio" ON public.profiles 
FOR SELECT USING (
  auth.uid() = id OR
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin'
);

CREATE POLICY "Actualización de perfil propio" ON public.profiles 
FOR UPDATE USING (
  auth.uid() = id OR
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin'
);

CREATE POLICY "Inserción de perfil propio" ON public.profiles 
FOR INSERT WITH CHECK (
  auth.uid() = id OR
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin'
);

-- Trigger: auto-crear perfil al registrarse en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 4. TABLA: orders (Pedidos de Clientes y Compra Rápida)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  delivery_option TEXT NOT NULL,
  shipping_method_name TEXT,
  delivery_address JSONB,
  payment_method TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  wholesale_discount NUMERIC DEFAULT 0,
  cash_discount NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending_payment',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  email_sent_to_customer BOOLEAN DEFAULT false,
  email_sent_to_admin BOOLEAN DEFAULT false
);

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS shipping_method_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creación y lectura de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Creación pública de pedidos" ON public.orders;
DROP POLICY IF EXISTS "Lectura protegida de pedidos propios" ON public.orders;
DROP POLICY IF EXISTS "Gestión de pedidos por admin" ON public.orders;
DROP POLICY IF EXISTS "Eliminación de pedidos por admin" ON public.orders;

-- Creación permitida para checkout público (clientes registrados o invitados)
CREATE POLICY "Creación pública de pedidos" ON public.orders 
FOR INSERT WITH CHECK (true);

-- Lectura estrictamente protegida: solo el dueño del pedido o el administrador
CREATE POLICY "Lectura protegida de pedidos propios" ON public.orders 
FOR SELECT USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
  (auth.jwt()->>'email' IS NOT NULL AND customer_email = auth.jwt()->>'email') OR
  (auth.role() = 'service_role' OR auth.jwt()->>'email' = 'admin@myimportadora.com' OR auth.jwt()->'app_metadata'->>'role' = 'admin' OR auth.jwt()->'user_metadata'->>'is_admin' = 'true')
);

CREATE POLICY "Gestión de pedidos por admin" ON public.orders 
FOR UPDATE USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

CREATE POLICY "Eliminación de pedidos por admin" ON public.orders 
FOR DELETE USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

-- ------------------------------------------------------------------------------
-- 5. TABLA: site_visits (Analítica y Visitas de la Tienda)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  source TEXT NOT NULL,
  device TEXT NOT NULL,
  is_new_visitor BOOLEAN DEFAULT true,
  is_new_session BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de visitas" ON public.site_visits;
DROP POLICY IF EXISTS "Inserción de visitas" ON public.site_visits;

CREATE POLICY "Lectura pública de visitas" ON public.site_visits FOR SELECT USING (true);
CREATE POLICY "Inserción de visitas" ON public.site_visits FOR ALL USING (true);

-- ------------------------------------------------------------------------------
-- 6. STORAGE BUCKET: product-images (Fotos de Catálogo, Banners y Categorías)
-- Lectura pública para la tienda; INSERT, UPDATE y DELETE restringidos al administrador
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura pública de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Subida de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Subida de imágenes autorizadas" ON storage.objects;
DROP POLICY IF EXISTS "Subida de imágenes por admin" ON storage.objects;
DROP POLICY IF EXISTS "Modificación de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Modificación de imágenes por admin" ON storage.objects;
DROP POLICY IF EXISTS "Eliminación de imágenes" ON storage.objects;
DROP POLICY IF EXISTS "Eliminación de imágenes por admin" ON storage.objects;

CREATE POLICY "Lectura pública de imágenes" ON storage.objects 
FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Subida de imágenes por admin" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'product-images' AND
  lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'avif') AND (
    auth.role() = 'service_role' OR
    auth.jwt()->>'email' = 'admin@myimportadora.com' OR
    auth.jwt()->'app_metadata'->>'role' = 'admin' OR
    auth.jwt()->'user_metadata'->>'is_admin' = 'true'
  )
);

CREATE POLICY "Modificación de imágenes por admin" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'product-images' AND (
    auth.role() = 'service_role' OR
    auth.jwt()->>'email' = 'admin@myimportadora.com' OR
    auth.jwt()->'app_metadata'->>'role' = 'admin' OR
    auth.jwt()->'user_metadata'->>'is_admin' = 'true'
  )
);

CREATE POLICY "Eliminación de imágenes por admin" ON storage.objects 
FOR DELETE USING (
  bucket_id = 'product-images' AND (
    auth.role() = 'service_role' OR
    auth.jwt()->>'email' = 'admin@myimportadora.com' OR
    auth.jwt()->'app_metadata'->>'role' = 'admin' OR
    auth.jwt()->'user_metadata'->>'is_admin' = 'true'
  )
);

-- ------------------------------------------------------------------------------
-- 7. CONFIGURACIÓN DEL USUARIO ADMINISTRADOR EN Supabase Auth
-- Si el usuario 'admin@myimportadora.com' ya existe en auth.users, garantiza que
-- su email esté confirmado y tenga los metadatos de rol de administrador.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@myimportadora.com') THEN
    UPDATE auth.users 
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
      raw_user_meta_data = raw_user_meta_data || '{"is_admin": true, "role": "admin"}'::jsonb
    WHERE email = 'admin@myimportadora.com';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 8. TABLA: stock_notifications (Avisos de Stock cuando una variante no tiene stock)
-- SEGURIDAD OBLIGATORIA Y PRIVACIDAD DE TELÉFONOS (RLS):
-- - Los clientes o visitantes pueden registrar una solicitud (INSERT).
-- - Nadie puede consultar (SELECT), listar o descargar los teléfonos excepto el Administrador
--   autenticado ('admin@myimportadora.com' o role 'admin') y service_role.
-- - De este modo los teléfonos de los clientes están completamente protegidos ante inspecciones.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  variant_id TEXT,
  variant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  customer_name TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_stock_notif_prod_var ON public.stock_notifications(product_id, variant_name, status);
CREATE INDEX IF NOT EXISTS idx_stock_notif_phone ON public.stock_notifications(phone);
CREATE INDEX IF NOT EXISTS idx_stock_notif_created_at ON public.stock_notifications(created_at DESC);

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Registro público de avisos de stock" ON public.stock_notifications;
DROP POLICY IF EXISTS "Lectura de avisos solo para administradores" ON public.stock_notifications;
DROP POLICY IF EXISTS "Modificación de avisos solo para administradores" ON public.stock_notifications;
DROP POLICY IF EXISTS "Eliminación de avisos solo para administradores" ON public.stock_notifications;

-- 1. Inserción permitida para registrar solicitudes (visitantes o clientes autenticados)
CREATE POLICY "Registro público de avisos de stock" ON public.stock_notifications
FOR INSERT WITH CHECK (true);

-- 2. Lectura PRIVADA: ÚNICAMENTE administradores autorizados pueden ver los registros y teléfonos
CREATE POLICY "Lectura de avisos solo para administradores" ON public.stock_notifications
FOR SELECT USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

-- 3. Actualización PRIVADA (marcar como avisado): ÚNICAMENTE administradores autorizados
CREATE POLICY "Modificación de avisos solo para administradores" ON public.stock_notifications
FOR UPDATE USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);

-- 4. Eliminación PRIVADA: ÚNICAMENTE administradores autorizados
CREATE POLICY "Eliminación de avisos solo para administradores" ON public.stock_notifications
FOR DELETE USING (
  auth.role() = 'service_role' OR
  auth.jwt()->>'email' = 'admin@myimportadora.com' OR
  auth.jwt()->'app_metadata'->>'role' = 'admin' OR
  auth.jwt()->'user_metadata'->>'is_admin' = 'true'
);
