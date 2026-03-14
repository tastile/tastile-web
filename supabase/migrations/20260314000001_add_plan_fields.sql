-- Add plan and Stripe fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ;

-- Tile count enforcement for free users (cloud limit: 50)
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
    max_tiles := 50;
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

DROP TRIGGER IF EXISTS enforce_tile_limit ON public.tiles;
CREATE TRIGGER enforce_tile_limit
  BEFORE INSERT ON public.tiles
  FOR EACH ROW
  EXECUTE FUNCTION check_tile_limit();

-- Event count enforcement for pro users (limit: 100,000)
CREATE OR REPLACE FUNCTION check_event_limit()
RETURNS TRIGGER AS $$
DECLARE
  event_count INTEGER;
  user_plan TEXT;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;

  -- Free users don't sync events
  IF user_plan != 'pro' THEN
    RAISE EXCEPTION 'Event sync requires Pro plan';
  END IF;

  SELECT COUNT(*) INTO event_count
    FROM public.events
    WHERE user_id = NEW.user_id;

  IF event_count >= 100000 THEN
    RAISE EXCEPTION 'Event limit reached (100,000)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_event_limit ON public.events;
CREATE TRIGGER enforce_event_limit
  BEFORE INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION check_event_limit();
