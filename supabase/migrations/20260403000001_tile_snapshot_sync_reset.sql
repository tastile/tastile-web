BEGIN;

DROP TRIGGER IF EXISTS enforce_event_tile_limit ON public.events;
DROP TRIGGER IF EXISTS enforce_event_limit ON public.events;
DROP TRIGGER IF EXISTS enforce_tile_limit ON public.tiles;

DROP FUNCTION IF EXISTS check_event_tile_limit();
DROP FUNCTION IF EXISTS check_event_limit();
DROP FUNCTION IF EXISTS check_tile_limit();
DROP FUNCTION IF EXISTS current_active_tile_count(UUID);
DROP FUNCTION IF EXISTS public.get_tile_quota(UUID);

DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.user_links CASCADE;
DROP TABLE IF EXISTS public.tiles CASCADE;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS integration_settings;

CREATE TABLE public.tiles (
    tile_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    semantic_role TEXT NOT NULL DEFAULT 'work',
    tile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    device_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

ALTER TABLE public.tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tile snapshots"
    ON public.tiles
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tiles_user_updated
    ON public.tiles(user_id, updated_at DESC);

CREATE INDEX idx_tiles_user_open
    ON public.tiles(user_id, closed_at)
    WHERE closed_at IS NULL;

CREATE INDEX idx_tiles_user_role
    ON public.tiles(user_id, semantic_role);

DROP TRIGGER IF EXISTS update_tiles_updated_at ON public.tiles;
CREATE TRIGGER update_tiles_updated_at
    BEFORE UPDATE ON public.tiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE public.user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

ALTER TABLE public.user_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own integration links"
    ON public.user_links
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_links_user_provider
    ON public.user_links(user_id, provider);

DROP TRIGGER IF EXISTS update_user_links_updated_at ON public.user_links;
CREATE TRIGGER update_user_links_updated_at
    BEFORE UPDATE ON public.user_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_tile_quota(uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_uid UUID;
  tile_count BIGINT;
BEGIN
  PERFORM set_config('search_path', 'public, pg_temp', true);

  caller_uid := auth.uid();
  IF caller_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF uid <> caller_uid THEN
    RAISE EXCEPTION 'Cannot access another user''s quota';
  END IF;

  SELECT COUNT(*)
    INTO tile_count
    FROM public.tiles
   WHERE user_id = uid;

  RETURN jsonb_build_object(
    'plan', 'snapshot',
    'tile_count', tile_count,
    'max_tiles', 0,
    'remaining_tiles', 0,
    'limit_reached', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tile_quota(UUID) TO authenticated;

COMMIT;
