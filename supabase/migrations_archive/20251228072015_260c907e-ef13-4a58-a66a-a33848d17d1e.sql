CREATE OR REPLACE FUNCTION public.recalculate_tournament_positions(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only update NRR if we have the overs data to calculate it
  -- Otherwise preserve the existing net_run_rate value
  UPDATE tournament_points_table SET
    net_run_rate = CASE 
      WHEN COALESCE(overs_faced, 0) > 0 AND COALESCE(overs_bowled, 0) > 0 THEN
        ROUND(((COALESCE(runs_scored, 0)::numeric / overs_faced) - (COALESCE(runs_conceded, 0)::numeric / overs_bowled))::numeric, 3)
      ELSE 
        -- Preserve existing NRR if overs data is not available
        net_run_rate
    END
  WHERE tournament_id = p_tournament_id;
  
  WITH ranked_teams AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
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
$function$;