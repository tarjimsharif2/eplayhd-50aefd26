-- Add cricket API settings to site_settings
ALTER TABLE site_settings 
ADD COLUMN IF NOT EXISTS cricket_api_key TEXT,
ADD COLUMN IF NOT EXISTS cricket_api_enabled BOOLEAN DEFAULT true;

-- Add per-match API score toggle
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS api_score_enabled BOOLEAN DEFAULT true;