-- Free plan tile cap: 100 cloud-saved tiles
-- Also provide quota RPC used by desktop/core pre-check.

-- Remove legacy pro-only event gate so the tile-based quota is authoritative.
DROP TRIGGER IF EXISTS enforce_event_limit ON public.events;
DROP FUNCTION IF EXISTS check_event_limit();

-- Keep legacy tiles-table trigger aligned with current limit policy.
CREATE OR REPLACE FUNCTION check_tile_limit()
RETURNS TRIGGER AS $$
DECLARE
  tile_count INTEGER;
  user_plan TEXT;
  max_tiles INTEGER;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;

  IF user_plan = 'pro' THEN
    max_tiles := 10000;
  ELSE
    max_tiles := 100;
  END IF;

  SELECT COUNT(*) INTO tile_count
    FROM public.tiles
    WHERE user_id = NEW.user_id AND deleted_at IS NULL;

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
  created_tiles BIGINT;
  aggregate_already_created BOOLEAN;
BEGIN
  IF NEW.event_type <> 'tile_created' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(plan, 'free')
    INTO user_plan
    FROM public.profiles
    WHERE id = NEW.user_id;

  IF user_plan = 'pro' THEN
    RETURN NEW;
  END IF;

  max_tiles := 100;

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

  SELECT COUNT(DISTINCT e.aggregate_id)
    INTO created_tiles
    FROM public.events e
   WHERE e.user_id = NEW.user_id
     AND e.event_type = 'tile_created';

  IF created_tiles >= max_tiles THEN
    RAISE EXCEPTION 'Tile limit reached (% of %)', created_tiles, max_tiles;
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
  user_plan TEXT;
  max_tiles INTEGER;
  tile_count BIGINT;
BEGIN
  SELECT COALESCE(plan, 'free')
    INTO user_plan
    FROM public.profiles
    WHERE id = uid;

  IF user_plan = 'pro' THEN
    max_tiles := 10000;
  ELSE
    max_tiles := 100;
  END IF;

  SELECT COUNT(DISTINCT e.aggregate_id)
    INTO tile_count
    FROM public.events e
   WHERE e.user_id = uid
     AND e.event_type = 'tile_created';

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
