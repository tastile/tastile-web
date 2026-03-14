-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Tiles table (cloud authority)
CREATE TABLE IF NOT EXISTS public.tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_tile_id TEXT NOT NULL,
    
    -- Core data
    title TEXT NOT NULL,
    next_action TEXT,
    done_definition TEXT,
    
    -- Condition vectors (JSON for flexibility)
    temporal_conditions JSONB DEFAULT '{}',
    objective_conditions JSONB DEFAULT '{}',
    interruption_conditions JSONB DEFAULT '{}',
    automation_conditions JSONB DEFAULT '{}',
    annotation_conditions JSONB DEFAULT '{}',
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Local sync tracking
    local_created_at TIMESTAMPTZ,
    local_updated_at TIMESTAMPTZ,
    
    UNIQUE(user_id, local_tile_id)
);

-- Enable RLS on tiles
ALTER TABLE public.tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own tiles" 
    ON public.tiles 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Events table (for sync)
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Event data
    event_id TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    caused_by_command_id TEXT,
    sequence_number BIGINT NOT NULL,
    
    -- Sync tracking
    synced_at TIMESTAMPTZ,
    device_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own events" 
    ON public.events 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tiles_user ON public.tiles(user_id);
CREATE INDEX IF NOT EXISTS idx_tiles_user_local_id ON public.tiles(user_id, local_tile_id);
CREATE INDEX IF NOT EXISTS idx_tiles_updated ON public.tiles(user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_events_user_sequence ON public.events(user_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_events_user_aggregate ON public.events(user_id, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_user_occurred ON public.events(user_id, occurred_at);

-- Settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    settings_json JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own settings" 
    ON public.user_settings 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_tiles_updated_at ON public.tiles;
CREATE TRIGGER update_tiles_updated_at 
    BEFORE UPDATE ON public.tiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
