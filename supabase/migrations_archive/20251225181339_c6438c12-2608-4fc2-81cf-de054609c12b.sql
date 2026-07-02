-- Add SEO fields to tournaments table
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS seo_title TEXT,
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS seo_keywords TEXT;