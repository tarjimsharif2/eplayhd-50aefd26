-- Create cricket_series table (like football_leagues)
CREATE TABLE public.cricket_series (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id text NOT NULL UNIQUE,
    series_name text NOT NULL,
    start_date date,
    end_date date,
    match_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cricket_series ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Cricket series viewable by everyone"
ON public.cricket_series FOR SELECT
USING (true);

CREATE POLICY "Admins can manage cricket series"
ON public.cricket_series FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage cricket series"
ON public.cricket_series FOR ALL
USING (true)
WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_cricket_series_series_id ON public.cricket_series(series_id);
CREATE INDEX idx_cricket_series_is_active ON public.cricket_series(is_active);