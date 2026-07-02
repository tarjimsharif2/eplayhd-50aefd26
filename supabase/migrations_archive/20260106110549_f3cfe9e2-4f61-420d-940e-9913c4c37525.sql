-- Remove duplicate/old cron jobs
SELECT cron.unschedule('update-match-status-job');
SELECT cron.unschedule('auto-sync-live-scores');