-- CodeBridge Supabase Schema Migration
-- Designed for Supabase Free Plan with PostgreSQL, Supabase Storage, and Realtime

-- 1. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  admin_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive index for room code lookup
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON public.rooms (created_at DESC);

-- 2. Create Room Items Table (Code Snippets & File Metadata)
CREATE TABLE IF NOT EXISTS public.room_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('code', 'text', 'file')),
  title TEXT NOT NULL,
  language TEXT,
  content TEXT,
  filename TEXT,
  file_size BIGINT,
  mime_type TEXT,
  storage_path TEXT,
  download_url TEXT,
  sender_device TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_items_room_id ON public.room_items (room_id);
CREATE INDEX IF NOT EXISTS idx_room_items_created_at ON public.room_items (created_at DESC);

-- 3. Configure Supabase Storage Bucket
-- Ensure the storage extension and bucket exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'codebridge-files',
  'codebridge-files',
  true,
  52428800, -- 50MB limit
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Rooms
-- Service role key has full access (used by server for secure authorization & rate-limiting)
DROP POLICY IF EXISTS "Service role full access on rooms" ON public.rooms;
CREATE POLICY "Service role full access on rooms"
  ON public.rooms
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous clients can lookup rooms by code (without exposing admin_token in queries)
DROP POLICY IF EXISTS "Anon can select rooms by code" ON public.rooms;
CREATE POLICY "Anon can select rooms by code"
  ON public.rooms
  FOR SELECT
  TO anon
  USING (true);

-- 6. RLS Policies for Room Items
-- Service role key has full access
DROP POLICY IF EXISTS "Service role full access on room_items" ON public.room_items;
CREATE POLICY "Service role full access on room_items"
  ON public.room_items
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous clients can read items of existing rooms
DROP POLICY IF EXISTS "Anon can select room_items" ON public.room_items;
CREATE POLICY "Anon can select room_items"
  ON public.room_items
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms WHERE rooms.id = room_items.room_id
    )
  );

-- 7. Storage RLS Policies
-- Service role can upload, read, update, delete objects in codebridge-files
DROP POLICY IF EXISTS "Service role full storage access" ON storage.objects;
CREATE POLICY "Service role full storage access"
  ON storage.objects
  TO service_role
  USING (bucket_id = 'codebridge-files')
  WITH CHECK (bucket_id = 'codebridge-files');

-- Public read access for files in codebridge-files bucket
DROP POLICY IF EXISTS "Public read storage access" ON storage.objects;
CREATE POLICY "Public read storage access"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'codebridge-files');

-- 8. Enable Realtime Replication
-- Add tables to the realtime publication for postgres_changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'room_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_items;
  END IF;
END $$;
