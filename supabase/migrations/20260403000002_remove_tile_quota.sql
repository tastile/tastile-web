BEGIN;

DROP TRIGGER IF EXISTS enforce_tile_limit ON public.tiles;
DROP FUNCTION IF EXISTS check_tile_limit();
DROP FUNCTION IF EXISTS current_active_tile_count(UUID);

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
  IF uid IS DISTINCT FROM caller_uid THEN
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
