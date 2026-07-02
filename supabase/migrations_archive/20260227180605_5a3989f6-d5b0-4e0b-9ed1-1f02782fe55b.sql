-- Set match_result for completed matches based on scores
UPDATE matches
SET match_result = CASE
  WHEN COALESCE(NULLIF(regexp_replace(score_a, '[^0-9].*', ''), ''), '0')::int > 
       COALESCE(NULLIF(regexp_replace(score_b, '[^0-9].*', ''), ''), '0')::int 
    THEN 'team_a_won'
  WHEN COALESCE(NULLIF(regexp_replace(score_b, '[^0-9].*', ''), ''), '0')::int > 
       COALESCE(NULLIF(regexp_replace(score_a, '[^0-9].*', ''), ''), '0')::int 
    THEN 'team_b_won'
  WHEN COALESCE(NULLIF(regexp_replace(score_a, '[^0-9].*', ''), ''), '0')::int = 
       COALESCE(NULLIF(regexp_replace(score_b, '[^0-9].*', ''), ''), '0')::int 
    THEN 'tied'
  ELSE NULL
END
WHERE status = 'completed' 
  AND match_result IS NULL 
  AND score_a IS NOT NULL 
  AND score_b IS NOT NULL;