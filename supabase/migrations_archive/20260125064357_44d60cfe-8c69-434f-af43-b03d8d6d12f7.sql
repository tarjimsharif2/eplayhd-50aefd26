-- Add display_order column to sports table
ALTER TABLE public.sports ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Update existing sports with sequential order
UPDATE public.sports SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM public.sports
) as subquery
WHERE public.sports.id = subquery.id;