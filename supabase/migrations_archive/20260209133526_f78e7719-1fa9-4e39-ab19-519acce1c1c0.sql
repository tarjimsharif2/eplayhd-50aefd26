CREATE OR REPLACE FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update NRR if we have the overs data to calculate it
  UPDATE tournament_points_table SET
    net_run_rate = CASE 
      WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
        ROUND(((COALESCE(runs_scored, 0)::numeric / overs_faced) - (COALESCE(runs_conceded, 0)::numeric / overs_bowled))::numeric, 3)
      ELSE 
        net_run_rate
    END
  WHERE tournament_id = p_tournament_id;
  
  -- Recalculate positions WITHIN each group separately
  WITH ranked_teams AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(group_name, '__no_group__')
        ORDER BY 
          COALESCE(points, 0) DESC,
          COALESCE(net_run_rate, 0) DESC,
          COALESCE(won, 0) DESC
      ) as new_position
    FROM tournament_points_table
    WHERE tournament_id = p_tournament_id
  )
  UPDATE tournament_points_table t
  SET position = r.new_position
  FROM ranked_teams r
  WHERE t.id = r.id;
END;
$$;