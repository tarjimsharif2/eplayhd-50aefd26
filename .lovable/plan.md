# Plan: Football data, lineup badge & streaming backup

## 1. Football goals & substitutions sync (ESPN summary)
**File:** `supabase/functions/auto-sync-football/index.ts`

ESPN `/soccer/all/summary` response includes:
- `plays[]` array with `type.text` (e.g. "Goal", "Penalty - Scored", "Own Goal", "Substitution") and `participants[]` (athlete refs), `clock.displayValue`, `team.id`
- `rosters[].subs[]` and roster entries with `subbedInFor` / `subbedOutFor` data

Update Pass-1 logic to:
- Parse `plays[]` for goals → populate `matches.goals_team_a` / `goals_team_b` (JSONB array of `{player, minute, type, assist}`); skip if `auto_goal_sync_enabled = false` or manual override exists.
- Parse `plays[]` for substitutions → populate new table `match_substitutions` (or append to existing JSONB columns `substitutions_team_a/b` if already present). Will check existing schema first.
- Map ESPN athlete IDs to roster names already fetched in the same call.

## 2. "Lineup Announced" badge on MatchCard
**Files:** `src/components/MatchCard.tsx`, new query.

Logic:
- Query `match_playing_xi` count for the match (or use a single boolean column `lineup_announced` on matches set by sync function when roster size ≥ 11 per team).
- Show small English pill "Lineup Announced" on the card when:
  - `lineup_announced = true` AND
  - `match_start_time` is null OR `now() < match_start_time + 15 min`
- After 15 min into the match, badge disappears automatically (computed client-side).

**Migration:** add `matches.lineup_announced BOOLEAN DEFAULT false`. `auto-sync-football` sets it true when both teams have ≥11 starters synced.

## 3. Streaming backup JSON
**Files:** migration on `streaming_json_sources`, `StreamingJsonSourcesManager.tsx`, `sync-streaming-from-json/index.ts`.

Add columns:
- `backup_of_source_id UUID NULL` — if set, this source is a backup for another source
- `sync_interval_minutes INTEGER DEFAULT 2` — per-source interval
- `last_sync_attempted_at TIMESTAMPTZ` — used to honor per-source interval

UI changes in `StreamingJsonSourcesManager`:
- Dropdown "Backup of" → pick a primary source (or "None — primary")
- Number input "Sync every (minutes)" per source

Sync function changes:
- Process primary sources first, then backups.
- For each backup source: only insert a server for a match if (a) the primary it backs up failed to add any server for this match AND (b) `now() >= match_start_time - 10 min` (i.e. ≥10 minutes before kick-off without primary data).
- Once a backup server is inserted for a match, mark `streaming_servers.backup_locked = true` so subsequent primary data **does not delete** the backup entry. Backup stays active until manually removed.
- Honor per-source `sync_interval_minutes` — skip if `last_sync_attempted_at` is too recent.

Migration also adds `streaming_servers.backup_locked BOOLEAN DEFAULT false`.

## 4. Technical summary
- 1 migration: `matches.lineup_announced`, `streaming_json_sources.backup_of_source_id`, `streaming_json_sources.sync_interval_minutes`, `streaming_json_sources.last_sync_attempted_at`, `streaming_servers.backup_locked`.
- Edit `auto-sync-football/index.ts`: extract goals & subs from ESPN plays; set `lineup_announced`.
- Edit `sync-streaming-from-json/index.ts`: per-source interval gating; two-pass primary→backup with 10-min pre-match rule; respect `backup_locked` in cleanup.
- Edit `StreamingJsonSourcesManager.tsx`: backup-of dropdown, sync-interval input.
- Edit `MatchCard.tsx`: "Lineup Announced" badge with 15-min auto-hide.

Confirm to proceed.
