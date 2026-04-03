import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, CircleDot } from 'lucide-react';
import { Team, GoalEvent } from '@/hooks/useSportsData';

interface Player {
  id: string;
  match_id: string;
  team_id: string;
  player_name: string;
  player_role: string | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  batting_order: number | null;
  is_bench?: boolean;
  player_image?: string | null;
  change_status?: string | null;
}

interface Substitution {
  id: string;
  match_id: string;
  team_id: string;
  player_out: string;
  player_in: string;
  minute: string;
}

interface FootballPitchLineupProps {
  teamA: Team;
  teamB: Team;
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  teamASubs?: Substitution[];
  teamBSubs?: Substitution[];
  goalsTeamA?: GoalEvent[];
  goalsTeamB?: GoalEvent[];
}

type BaseLine = 'gk' | 'def' | 'pivot' | 'wide' | 'band' | 'front';
type DisplayLine = 'gk' | 'def' | 'pivot' | 'band' | 'front';

const normalizeRole = (role: string | null) => (role || '').toLowerCase().replace(/[^a-z]/g, '');

const matchesRole = (value: string, token: string) => {
  if (!value) return false;
  return token.length <= 3 ? value === token : value.includes(token);
};

const isAnyRole = (value: string, tokens: string[]) => tokens.some((token) => matchesRole(value, token));

const classifyBaseLine = (role: string | null): BaseLine => {
  const value = normalizeRole(role);

  if (isAnyRole(value, ['g', 'gk', 'goalkeeper', 'goal'])) return 'gk';
  if (isAnyRole(value, ['lb', 'rb', 'cb', 'cd', 'lwb', 'rwb', 'leftback', 'rightback', 'centerback', 'centreback', 'defender'])) return 'def';
  if (isAnyRole(value, ['dm', 'cdm', 'cm', 'defensivemidfielder', 'centralmidfielder'])) return 'pivot';
  if (isAnyRole(value, ['lm', 'rm', 'leftmidfielder', 'rightmidfielder', 'lw', 'rw', 'leftwinger', 'rightwinger', 'winger'])) return 'wide';
  if (isAnyRole(value, ['am', 'cam', 'attackingmidfielder'])) return 'band';
  if (isAnyRole(value, ['f', 'fw', 'cf', 'st', 'ss', 'forward', 'striker', 'centerforward', 'centreforward'])) return 'front';

  return 'pivot';
};

const getShortPos = (role: string | null) => {
  if (!role) return '';
  const normalized = role.replace(/-$/, '').trim().toUpperCase();
  return normalized.length > 3 ? normalized.slice(0, 3) : normalized;
};

const getLineOrder = (role: string | null, line: DisplayLine) => {
  const value = normalizeRole(role);

  if (line === 'def') {
    if (isAnyRole(value, ['lb', 'lwb', 'leftback'])) return 0;
    if (isAnyRole(value, ['cb', 'cd', 'centerback', 'centreback'])) return 1;
    if (isAnyRole(value, ['rb', 'rwb', 'rightback'])) return 3;
    return 2;
  }

  if (line === 'pivot') {
    if (isAnyRole(value, ['lm', 'leftmidfielder'])) return 0;
    if (isAnyRole(value, ['dm', 'cdm', 'defensivemidfielder'])) return 1;
    if (isAnyRole(value, ['cm', 'centralmidfielder'])) return 2;
    if (isAnyRole(value, ['rm', 'rightmidfielder'])) return 3;
    return 2;
  }

  if (line === 'band') {
    if (isAnyRole(value, ['lw', 'leftwinger'])) return 0;
    if (isAnyRole(value, ['am', 'cam', 'attackingmidfielder'])) return 1;
    if (isAnyRole(value, ['rw', 'rightwinger'])) return 2;
    return 1;
  }

  if (line === 'front') {
    if (isAnyRole(value, ['lw', 'leftwinger'])) return 0;
    if (isAnyRole(value, ['ss'])) return 1;
    if (isAnyRole(value, ['f', 'fw', 'cf', 'st', 'forward', 'striker', 'centerforward', 'centreforward'])) return 2;
    if (isAnyRole(value, ['rw', 'rightwinger'])) return 3;
    return 2;
  }

  return 0;
};

const sortLinePlayers = (players: Player[], line: DisplayLine) =>
  [...players].sort((a, b) => {
    const orderDiff = getLineOrder(a.player_role, line) - getLineOrder(b.player_role, line);
    if (orderDiff !== 0) return orderDiff;
    return (a.batting_order ?? 99) - (b.batting_order ?? 99);
  });

const resolveDisplayLines = (players: Player[]) => {
  const starters = players.filter((player) => !player.is_bench);

  const buckets: Record<BaseLine, Player[]> = {
    gk: [],
    def: [],
    pivot: [],
    wide: [],
    band: [],
    front: [],
  };

  starters.forEach((player) => {
    buckets[classifyBaseLine(player.player_role)].push(player);
  });

  if (buckets.front.length >= 2) {
    buckets.pivot.push(...buckets.wide);
  } else if (buckets.front.length === 1 && buckets.band.length === 0) {
    buckets.front.push(...buckets.wide);
  } else {
    buckets.band.push(...buckets.wide);
  }

  const displayLines: Record<DisplayLine, Player[]> = {
    gk: sortLinePlayers(buckets.gk, 'gk'),
    def: sortLinePlayers(buckets.def, 'def'),
    pivot: sortLinePlayers(buckets.pivot, 'pivot'),
    band: sortLinePlayers(buckets.band, 'band'),
    front: sortLinePlayers(buckets.front, 'front'),
  };

  if (displayLines.gk.length === 0 && starters.length > 0) {
    const fallbackGoalkeeper = [...starters].sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99))[0];
    displayLines.gk = [fallbackGoalkeeper];
    displayLines.pivot = displayLines.pivot.filter((player) => player.id !== fallbackGoalkeeper.id);
    displayLines.def = displayLines.def.filter((player) => player.id !== fallbackGoalkeeper.id);
    displayLines.band = displayLines.band.filter((player) => player.id !== fallbackGoalkeeper.id);
    displayLines.front = displayLines.front.filter((player) => player.id !== fallbackGoalkeeper.id);
  }

  return displayLines;
};

const detectFormation = (players: Player[]) => {
  const lines = resolveDisplayLines(players);
  return [lines.def.length, lines.pivot.length, lines.band.length, lines.front.length]
    .filter((count) => count > 0)
    .join('-');
};

const getPlayerGoals = (playerName: string, goals: GoalEvent[]) => {
  const player = playerName.toLowerCase();
  const lastName = player.split(' ').pop();

  return goals.filter((goal) => {
    const goalPlayer = goal.player.toLowerCase();
    const goalLastName = goalPlayer.split(' ').pop();
    return goalPlayer === player || goalLastName === lastName || player.includes(goalPlayer) || goalPlayer.includes(player);
  });
};

const getSubInfo = (playerName: string, substitutions: Substitution[]) => {
  const player = playerName.toLowerCase();

  for (const sub of substitutions) {
    const outName = sub.player_out.toLowerCase();
    const inName = sub.player_in.toLowerCase();

    if (outName === player || player.includes(outName) || outName.includes(player)) {
      return { type: 'out' as const, minute: sub.minute };
    }

    if (inName === player || player.includes(inName) || inName.includes(player)) {
      return { type: 'in' as const, minute: sub.minute };
    }
  }

  return null;
};

const JerseyIcon = ({ number, isGoalkeeper = false, size = 42 }: { number?: number | null; isGoalkeeper?: boolean; size?: number }) => {
  const fill = isGoalkeeper ? 'hsl(43 96% 56%)' : 'hsl(0 0% 100% / 0.13)';
  const stroke = isGoalkeeper ? 'hsl(43 100% 78% / 0.95)' : 'hsl(0 0% 100% / 0.34)';
  const text = isGoalkeeper ? 'hsl(0 0% 10%)' : 'hsl(0 0% 100%)';

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 9L5 15V20L9 18V37H35V18L39 20V15L35 9H28C28 12.3137 25.3137 15 22 15C18.6863 15 16 12.3137 16 9H9Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.15"
      />
      <path d="M16 9C16 9 18.2 11.5 22 11.5C25.8 11.5 28 9 28 9" stroke={stroke} strokeWidth="1" />
      {number != null && (
        <text x="22" y="28" textAnchor="middle" fill={text} fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif">
          {number}
        </text>
      )}
    </svg>
  );
};

const PitchPlayer = ({
  player,
  index,
  goals,
  substitutions,
  isGoalkeeper = false,
}: {
  player: Player;
  index: number;
  goals: GoalEvent[];
  substitutions: Substitution[];
  isGoalkeeper?: boolean;
}) => {
  const playerGoals = getPlayerGoals(player.player_name, goals);
  const subInfo = getSubInfo(player.player_name, substitutions);
  const shortName = player.player_name.split(' ').pop() || player.player_name;
  const displayName = player.batting_order ? `${player.batting_order}. ${shortName}` : shortName;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="relative flex w-full max-w-[72px] flex-col items-center gap-0.5"
      style={{ color: 'hsl(0 0% 100%)' }}
    >
      {subInfo && (
        <div
          className="absolute -top-2 right-0 z-20 rounded-full px-1.5 py-0.5 text-[8px] font-bold shadow-md"
          style={{
            backgroundColor: subInfo.type === 'out' ? 'hsl(var(--destructive))' : 'hsl(142 68% 45%)',
            color: subInfo.type === 'out' ? 'hsl(var(--destructive-foreground))' : 'hsl(0 0% 100%)',
          }}
        >
          {subInfo.type === 'out' ? '↓' : '↑'}{subInfo.minute}
        </div>
      )}

      <div className="relative flex items-center justify-center">
        <JerseyIcon number={player.batting_order} isGoalkeeper={isGoalkeeper} />
        {player.is_captain && (
          <span
            className="absolute -bottom-0.5 -left-1 flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-extrabold shadow-md"
            style={{ backgroundColor: 'hsl(43 96% 56%)', color: 'hsl(0 0% 12%)' }}
          >
            C
          </span>
        )}
      </div>

      {playerGoals.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1 -mt-0.5 min-h-[12px]">
          {playerGoals.map((goal, goalIndex) => (
            <span key={`${player.id}-${goal.minute}-${goalIndex}`} className="flex items-center gap-0.5 text-[8px] font-semibold" style={{ color: 'hsl(0 0% 100% / 0.92)' }}>
              <CircleDot className="h-2.5 w-2.5" />
              {goal.minute}
            </span>
          ))}
        </div>
      )}

      <span className="text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: 'hsl(0 0% 100% / 0.72)' }}>
        {getShortPos(player.player_role)}
      </span>
      <span className="w-full truncate text-center text-[10px] font-semibold leading-tight" style={{ color: 'hsl(0 0% 100%)', textShadow: '0 1px 2px hsl(0 0% 0% / 0.6)' }}>
        {displayName}
      </span>
    </motion.div>
  );
};

const TeamPitchHalf = ({
  players,
  team,
  goals,
  substitutions,
  isTopTeam,
}: {
  players: Player[];
  team: Team;
  goals: GoalEvent[];
  substitutions: Substitution[];
  isTopTeam: boolean;
}) => {
  const lines = resolveDisplayLines(players);
  const formation = detectFormation(players);

  const orderedRows: Array<{ key: DisplayLine; players: Player[] }> = isTopTeam
    ? [
        { key: 'gk', players: lines.gk },
        { key: 'def', players: lines.def },
        { key: 'pivot', players: lines.pivot },
        { key: 'band', players: lines.band },
        { key: 'front', players: lines.front },
      ]
    : [
        { key: 'front', players: lines.front },
        { key: 'band', players: lines.band },
        { key: 'pivot', players: lines.pivot },
        { key: 'def', players: lines.def },
        { key: 'gk', players: lines.gk },
      ];

  return (
    <div className="relative px-1 py-2">
      <div className="mb-2 flex items-center justify-center gap-2" style={{ color: 'hsl(0 0% 100%)' }}>
        {team.logo_url && <img src={team.logo_url} alt={team.short_name} className="h-5 w-5 object-contain" />}
        <span className="text-sm font-bold tracking-wide">{team.short_name || team.name}</span>
        {formation && <span className="text-xs font-semibold" style={{ color: 'hsl(0 0% 100% / 0.58)' }}>{formation}</span>}
      </div>

      <div className="flex flex-col gap-3">
        {orderedRows.map((row, rowIndex) => {
          if (row.players.length === 0) return null;

          return (
            <div
              key={`${team.id}-${row.key}-${rowIndex}`}
              className="grid w-full justify-items-center gap-x-1.5 gap-y-2"
              style={{ gridTemplateColumns: `repeat(${row.players.length}, minmax(0, 1fr))` }}
            >
              {row.players.map((player, playerIndex) => (
                <PitchPlayer
                  key={player.id}
                  player={player}
                  index={rowIndex * 4 + playerIndex}
                  goals={goals}
                  substitutions={substitutions}
                  isGoalkeeper={row.key === 'gk'}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FootballPitchLineup = ({
  teamA,
  teamB,
  teamAPlayers,
  teamBPlayers,
  teamASubs = [],
  teamBSubs = [],
  goalsTeamA = [],
  goalsTeamB = [],
}: FootballPitchLineupProps) => {
  const teamAStarting = teamAPlayers.filter((player) => !player.is_bench);
  const teamBStarting = teamBPlayers.filter((player) => !player.is_bench);
  const teamABench = teamAPlayers.filter((player) => player.is_bench);
  const teamBBench = teamBPlayers.filter((player) => player.is_bench);

  if (teamAStarting.length === 0 && teamBStarting.length === 0) return null;

  return (
    <div className="space-y-3">
      <div
        className="relative overflow-hidden rounded-2xl shadow-xl"
        style={{
          background:
            'linear-gradient(180deg, hsl(136 58% 27%) 0%, hsl(136 57% 31%) 12%, hsl(136 60% 28%) 24%, hsl(136 58% 32%) 36%, hsl(136 58% 27%) 48%, hsl(136 57% 31%) 60%, hsl(136 60% 28%) 72%, hsl(136 58% 32%) 84%, hsl(136 58% 27%) 100%)',
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-2 rounded-xl border" style={{ borderColor: 'hsl(0 0% 100% / 0.18)' }} />
          <div className="absolute left-2 right-2 top-1/2 h-px" style={{ backgroundColor: 'hsl(0 0% 100% / 0.18)' }} />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: 'hsl(0 0% 100% / 0.14)' }} />
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: 'hsl(0 0% 100% / 0.22)' }} />

          <div className="absolute left-1/2 top-2 h-16 w-44 -translate-x-1/2 border-b border-l border-r" style={{ borderColor: 'hsl(0 0% 100% / 0.16)' }} />
          <div className="absolute left-1/2 top-2 h-8 w-20 -translate-x-1/2 border-b border-l border-r" style={{ borderColor: 'hsl(0 0% 100% / 0.12)' }} />
          <div className="absolute left-1/2 top-[66px] h-8 w-16 -translate-x-1/2 rounded-b-full border-b" style={{ borderColor: 'hsl(0 0% 100% / 0.1)' }} />

          <div className="absolute bottom-2 left-1/2 h-16 w-44 -translate-x-1/2 border-l border-r border-t" style={{ borderColor: 'hsl(0 0% 100% / 0.16)' }} />
          <div className="absolute bottom-2 left-1/2 h-8 w-20 -translate-x-1/2 border-l border-r border-t" style={{ borderColor: 'hsl(0 0% 100% / 0.12)' }} />
          <div className="absolute bottom-[66px] left-1/2 h-8 w-16 -translate-x-1/2 rounded-t-full border-t" style={{ borderColor: 'hsl(0 0% 100% / 0.1)' }} />
        </div>

        <div className="relative z-10 px-1 py-2">
          {teamAStarting.length > 0 && (
            <TeamPitchHalf
              players={teamAPlayers}
              team={teamA}
              goals={goalsTeamA}
              substitutions={teamASubs}
              isTopTeam={true}
            />
          )}

          {teamAStarting.length > 0 && teamBStarting.length > 0 && (
            <div className="flex items-center justify-center py-1">
              <span
                className="rounded-full px-3 py-0.5 text-[10px] font-bold"
                style={{ backgroundColor: 'hsl(0 0% 100% / 0.08)', color: 'hsl(0 0% 100% / 0.34)' }}
              >
                VS
              </span>
            </div>
          )}

          {teamBStarting.length > 0 && (
            <TeamPitchHalf
              players={teamBPlayers}
              team={teamB}
              goals={goalsTeamB}
              substitutions={teamBSubs}
              isTopTeam={false}
            />
          )}
        </div>
      </div>

      {[
        { team: teamA, bench: teamABench, substitutions: teamASubs },
        { team: teamB, bench: teamBBench, substitutions: teamBSubs },
      ].map(({ team, bench, substitutions }) => {
        if (bench.length === 0 && substitutions.length === 0) return null;

        return (
          <div key={team.id} className="rounded-lg border border-border/20 bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              {team.logo_url && <img src={team.logo_url} alt="" className="h-4 w-4 object-contain" />}
              <span className="text-xs font-bold">{team.short_name || team.name}</span>
              <Badge variant="outline" className="px-1.5 py-0 text-[8px] font-medium">Bench</Badge>
            </div>

            {bench.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {bench.map((player) => (
                  <div key={player.id} className="flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-1">
                    <JerseyIcon number={player.batting_order} size={20} />
                    <div className="min-w-0">
                      <div className="max-w-[120px] truncate text-[9px] font-medium leading-tight">{player.player_name}</div>
                      {player.player_role && <div className="text-[7px] text-muted-foreground">{getShortPos(player.player_role)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {substitutions.length > 0 && (
              <div className="space-y-1 border-t border-border/20 pt-1.5">
                <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Substitutions</span>
                {substitutions.map((substitution) => (
                  <div key={substitution.id} className="flex items-center gap-1.5 text-[10px]">
                    <Badge className="border-primary/30 bg-primary/20 px-1.5 py-0 text-[8px] font-bold text-primary">{substitution.minute}</Badge>
                    <span style={{ color: 'hsl(var(--destructive))' }}>↓ {substitution.player_out}</span>
                    <ArrowRightLeft className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <span style={{ color: 'hsl(142 68% 40%)' }}>↑ {substitution.player_in}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FootballPitchLineup;
