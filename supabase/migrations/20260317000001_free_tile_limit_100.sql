-- Free plan tile cap: 100 cloud-saved tiles
-- Also provide quota RPC used by desktop/core pre-check.

-- Remove legacy pro-only event gate so the tile-based quota is authoritative.
DROP TRIGGER IF EXISTS enforce_event_limit ON public.events;
DROP FUNCTION IF EXISTS check_event_limit();

CREATE OR REPLACE FUNCTION current_active_tile_count(uid UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
    FROM public.tiles
   WHERE user_id = uid
     AND deleted_at IS NULL
$$;

-- Keep legacy tiles-table trigger aligned with current limit policy.
CREATE OR REPLACE FUNCTION check_tile_limit()
RETURNS TRIGGER AS $$
DECLARE
  tile_count BIGINT;
  user_plan TEXT;
  max_tiles INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;

  IF user_plan = 'pro' THEN
    max_tiles := 10000;
  ELSE
    max_tiles := 100;
  END IF;

  SELECT current_active_tile_count(NEW.user_id) INTO tile_count;

  IF tile_count >= max_tiles THEN
    RAISE EXCEPTION 'Tile limit reached (% of %)', tile_count, max_tiles;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enforce free limit against cloud-authoritative events stream.
-- A tile is counted by unique aggregate_id having at least one tile_created event.
CREATE OR REPLACE FUNCTION check_event_tile_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_plan TEXT;
  max_tiles INTEGER;
  active_tiles BIGINT;
  aggregate_already_created BOOLEAN;
BEGIN
  IF NEW.event_type <> 'tile_created' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT COALESCE(plan, 'free')
    INTO user_plan
    FROM public.profiles
    WHERE id = NEW.user_id;

  IF user_plan = 'pro' THEN
    max_tiles := 10000;
  ELSE
    max_tiles := 100;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.events e
     WHERE e.user_id = NEW.user_id
       AND e.event_type = 'tile_created'
       AND e.aggregate_id = NEW.aggregate_id
  ) INTO aggregate_already_created;

  IF aggregate_already_created THEN
    RETURN NEW;
  END IF;

  SELECT current_active_tile_count(NEW.user_id)
    INTO active_tiles;

  IF active_tiles >= max_tiles THEN
    RAISE EXCEPTION 'Tile limit reached (% of %)', active_tiles, max_tiles;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_event_tile_limit ON public.events;
CREATE TRIGGER enforce_event_tile_limit
  BEFORE INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION check_event_tile_limit();

-- Quota RPC used by daemon/desktop pre-check.
CREATE OR REPLACE FUNCTION public.get_tile_quota(uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_uid UUID;
  user_plan TEXT;
  max_tiles INTEGER;
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

  SELECT COALESCE(plan, 'free')
    INTO user_plan
    FROM public.profiles
    WHERE id = uid;

  IF user_plan = 'pro' THEN
    max_tiles := 10000;
  ELSE
    max_tiles := 100;
  END IF;

  SELECT current_active_tile_count(uid)
    INTO tile_count;

  RETURN jsonb_build_object(
    'plan', user_plan,
    'tile_count', tile_count,
    'max_tiles', max_tiles,
    'remaining_tiles', GREATEST(max_tiles - tile_count, 0),
    'limit_reached', tile_count >= max_tiles
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tile_quota(UUID) TO authenticated;
