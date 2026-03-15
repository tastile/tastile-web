-- Add lifecycle column for tracking tile state in cloud
ALTER TABLE public.tiles
  ADD COLUMN IF NOT EXISTS lifecycle TEXT NOT NULL DEFAULT 'Ready';

CREATE INDEX IF NOT EXISTS idx_tiles_lifecycle ON public.tiles(user_id, lifecycle);
