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

// Map roles to formation rows: 0=GK, 1=DEF, 2=MID, 3=ATK
const getPositionRow = (role: string | null): number => {
  const pos = (role || '').toLowerCase();
  if (pos.includes('goal') || pos === 'gk' || pos === 'g') return 0;
  if (pos.includes('back') || pos.includes('defender') || pos === 'cb' || pos === 'rb' || pos === 'lb' || pos === 'rwb' || pos === 'lwb' || pos === 'cd' || pos === 'cd-') return 1;
  if (pos.includes('mid') || pos === 'dm' || pos === 'cm' || pos === 'am' || pos === 'cdm' || pos === 'cam' || pos === 'cm-' || pos === 'am-' || pos === 'rm' || pos === 'lm') return 2;
  if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker') || pos === 'st' || pos === 'cf' || pos === 'cf-' || pos === 'rw' || pos === 'lw' || pos === 'ss' || pos === 'f') return 3;
  return 2;
};

const getShortPos = (role: string | null): string => {
  if (!role) return '';
  const r = role.replace(/-$/, '').trim().toUpperCase();
  return r.length > 3 ? r.slice(0, 3) : r;
};

// Detect formation string like "4-2-3-1" from player positions
const detectFormation = (players: Player[]): string => {
  const starting = players.filter(p => !p.is_bench);
  const rows = [0, 0, 0, 0]; // GK, DEF, MID, ATK
  starting.forEach(p => {
    rows[getPositionRow(p.player_role)]++;
  });
  // Skip GK count, show DEF-MID-ATK
  if (rows[1] + rows[2] + rows[3] === 0) return '';
  return `${rows[1]}-${rows[2]}-${rows[3]}`;
};

// Check if a player scored goals
const getPlayerGoals = (playerName: string, goals: GoalEvent[]): GoalEvent[] => {
  const name = playerName.toLowerCase();
  return goals.filter(g => {
    const gName = g.player.toLowerCase();
    // Match by last name or full name
    return gName === name || 
           name.includes(gName) || 
           gName.includes(name) ||
           name.split(' ').pop() === gName.split(' ').pop();
  });
};

// Check if player was substituted
const getSubInfo = (playerName: string, subs: Substitution[]): { type: 'in' | 'out'; minute: string } | null => {
  const name = playerName.toLowerCase();
  for (const sub of subs) {
    if (sub.player_out.toLowerCase().includes(name) || name.includes(sub.player_out.toLowerCase())) {
      return { type: 'out', minute: sub.minute };
    }
    if (sub.player_in.toLowerCase().includes(name) || name.includes(sub.player_in.toLowerCase())) {
      return { type: 'in', minute: sub.minute };
    }
  }
  return null;
};

// Jersey SVG component
const JerseyIcon = ({ number, color = '#2d6a4f', textColor = '#fff', size = 36 }: { number?: number | null; color?: string; textColor?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Jersey shape */}
    <path 
      d="M8 8L4 14V18L8 16V34H32V16L36 18V14L32 8H26C26 11.3137 23.3137 14 20 14C16.6863 14 14 11.3137 14 8H8Z" 
      fill={color} 
      stroke="rgba(255,255,255,0.3)" 
      strokeWidth="0.8"
    />
    {/* Collar */}
    <path d="M14 8C14 8 16 10 20 10C24 10 26 8 26 8" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" fill="none" />
    {number != null && (
      <text x="20" y="26" textAnchor="middle" fill={textColor} fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif">
        {number}
      </text>
    )}
  </svg>
);

// GK Jersey (different color)
const GKJerseyIcon = ({ number, size = 36 }: { number?: number | null; size?: number }) => (
  <JerseyIcon number={number} color="#d4a017" textColor="#1a1a1a" size={size} />
);

const PitchPlayer = ({ player, index, goals, subs, isGK }: { 
  player: Player; index: number; goals: GoalEvent[]; subs: Substitution[]; isGK?: boolean 
}) => {
  const playerGoals = getPlayerGoals(player.player_name, goals);
  const subInfo = getSubInfo(player.player_name, subs);
  const shortName = player.player_name.split(' ').pop() || player.player_name;
  const displayName = player.batting_order ? `${player.batting_order}. ${shortName}` : shortName;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 200 }}
      className="flex flex-col items-center gap-0.5 relative"
      style={{ width: '68px' }}
    >
      {/* Sub indicator on top */}
      {subInfo && (
        <div className={`absolute -top-3.5 -right-1 z-20 flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[7px] font-bold shadow-md ${
          subInfo.type === 'out' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {subInfo.type === 'out' ? '↓' : '↑'}{subInfo.minute}
        </div>
      )}

      {/* Jersey */}
      <div className="relative">
        {isGK ? (
          <GKJerseyIcon number={player.batting_order} />
        ) : (
          <JerseyIcon number={player.batting_order} />
        )}
        
        {/* Captain badge */}
        {player.is_captain && (
          <span className="absolute -bottom-0.5 -left-1 z-10 text-[7px] bg-amber-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-extrabold shadow-md border border-amber-300">C</span>
        )}
      </div>

      {/* Goal icons */}
      {playerGoals.length > 0 && (
        <div className="flex items-center gap-0.5 -mt-0.5">
          {playerGoals.map((g, i) => (
            <div key={i} className="flex items-center gap-0.5">
              <CircleDot className="w-2.5 h-2.5 text-white" />
              <span className="text-[7px] text-white/80 font-medium">{g.minute}</span>
            </div>
          ))}
        </div>
      )}

      {/* Position badge */}
      {getShortPos(player.player_role) && (
        <span className="text-[7px] font-bold text-white/70 tracking-wider">{getShortPos(player.player_role)}</span>
      )}

      {/* Player name */}
      <span className="text-[9px] font-semibold text-white text-center leading-tight truncate w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {displayName}
      </span>
    </motion.div>
  );
};

const TeamPitchHalf = ({ 
  players, team, goals, subs, isReversed 
}: { 
  players: Player[]; team: Team; goals: GoalEvent[]; subs: Substitution[]; isReversed?: boolean 
}) => {
  const startingXI = players.filter(p => !p.is_bench);
  const formation = detectFormation(players);
  
  // Group by row
  const rows: Player[][] = [[], [], [], []];
  startingXI.forEach(p => {
    rows[getPositionRow(p.player_role)].push(p);
  });

  // Auto-distribute if no positions
  if (rows.every(r => r.length === 0) && startingXI.length > 0) {
    startingXI.forEach((p, i) => {
      if (i === 0) rows[0].push(p);
      else if (i <= 4) rows[1].push(p);
      else if (i <= 8) rows[2].push(p);
      else rows[3].push(p);
    });
  }

  // Normal: GK at bottom (row index 0 last), ATK at top
  // Reversed (teamB bottom half): GK at top, ATK at bottom
  const orderedRows = isReversed ? [...rows].reverse() : rows;

  return (
    <div className="relative">
      {/* Team header */}
      <div className="flex items-center gap-2 justify-center py-1.5">
        {team.logo_url && (
          <img src={team.logo_url} alt={team.short_name} className="w-5 h-5 object-contain drop-shadow-md" />
        )}
        <span className="text-xs font-bold text-white drop-shadow-md tracking-wide">{team.short_name || team.name}</span>
        {formation && (
          <span className="text-[10px] font-medium text-white/50 ml-1">{formation}</span>
        )}
      </div>
      
      {/* Formation rows */}
      <div className="flex flex-col items-center gap-4 py-2">
        {orderedRows.map((row, rowIdx) => {
          if (row.length === 0) return null;
          // Determine actual row type for jersey color
          const actualRowIdx = isReversed ? (3 - rowIdx) : rowIdx;
          const isGKRow = actualRowIdx === 0;
          
          return (
            <div key={rowIdx} className="flex items-start justify-center gap-2 w-full px-2" style={{ justifyContent: 'space-evenly' }}>
              {row.map((player, pIdx) => (
                <PitchPlayer 
                  key={player.id} 
                  player={player} 
                  index={rowIdx * 4 + pIdx} 
                  goals={goals} 
                  subs={subs}
                  isGK={isGKRow}
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
  teamA, teamB, teamAPlayers, teamBPlayers, 
  teamASubs = [], teamBSubs = [], 
  goalsTeamA = [], goalsTeamB = [] 
}: FootballPitchLineupProps) => {
  const teamAStarting = teamAPlayers.filter(p => !p.is_bench);
  const teamBStarting = teamBPlayers.filter(p => !p.is_bench);
  const teamABench = teamAPlayers.filter(p => p.is_bench);
  const teamBBench = teamBPlayers.filter(p => p.is_bench);

  if (teamAStarting.length === 0 && teamBStarting.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Pitch */}
      <div className="relative rounded-xl overflow-hidden shadow-xl" style={{ 
        background: 'linear-gradient(180deg, #1b5e30 0%, #228b3a 8%, #1b5e30 16%, #228b3a 24%, #1b5e30 32%, #228b3a 40%, #1b5e30 48%, #228b3a 56%, #1b5e30 64%, #228b3a 72%, #1b5e30 80%, #228b3a 88%, #1b5e30 96%, #228b3a 100%)' 
      }}>
        {/* Pitch markings */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Outer border */}
          <div className="absolute inset-2 border border-white/20 rounded" />
          {/* Center line */}
          <div className="absolute top-1/2 left-2 right-2 h-px bg-white/20" />
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/15" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/25" />
          {/* Top penalty area */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-40 h-14 border-b border-l border-r border-white/15" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-7 border-b border-l border-r border-white/12" />
          {/* Top penalty arc */}
          <div className="absolute top-[60px] left-1/2 -translate-x-1/2 w-16 h-8 border-b border-white/10 rounded-b-full" />
          {/* Bottom penalty area */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-40 h-14 border-t border-l border-r border-white/15" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-7 border-t border-l border-r border-white/12" />
          {/* Bottom penalty arc */}
          <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 w-16 h-8 border-t border-white/10 rounded-t-full" />
          {/* Corner arcs */}
          <div className="absolute top-2 left-2 w-4 h-4 border-r border-b border-white/10 rounded-br-full" />
          <div className="absolute top-2 right-2 w-4 h-4 border-l border-b border-white/10 rounded-bl-full" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-r border-t border-white/10 rounded-tr-full" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-l border-t border-white/10 rounded-tl-full" />
        </div>

        <div className="relative z-10 px-1 py-2">
          {/* Team A (top half) - GK at top, ATK towards center */}
          {teamAStarting.length > 0 && (
            <TeamPitchHalf players={teamAPlayers} team={teamA} goals={goalsTeamA} subs={teamASubs} isReversed={true} />
          )}
          
          {/* VS divider */}
          {teamAStarting.length > 0 && teamBStarting.length > 0 && (
            <div className="flex items-center justify-center py-0.5">
              <span className="text-[9px] font-bold text-white/30 bg-white/8 rounded-full px-2.5 py-0.5 backdrop-blur-sm">VS</span>
            </div>
          )}
          
          {/* Team B (bottom half) - ATK towards center, GK at bottom */}
          {teamBStarting.length > 0 && (
            <TeamPitchHalf players={teamBPlayers} team={teamB} goals={goalsTeamB} subs={teamBSubs} isReversed={false} />
          )}
        </div>
      </div>

      {/* Bench & Substitutions */}
      {[
        { team: teamA, bench: teamABench, subs: teamASubs },
        { team: teamB, bench: teamBBench, subs: teamBSubs },
      ].map(({ team, bench, subs }) => {
        if (bench.length === 0 && subs.length === 0) return null;
        return (
          <div key={team.id} className="bg-muted/30 rounded-lg p-3 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              {team.logo_url && <img src={team.logo_url} alt="" className="w-4 h-4 object-contain" />}
              <span className="text-xs font-bold">{team.short_name || team.name}</span>
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-medium">Bench</Badge>
            </div>
            
            {/* Bench players */}
            {bench.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {bench.map(p => (
                  <div key={p.id} className="flex items-center gap-1 bg-muted/50 rounded-md px-1.5 py-1">
                    <JerseyIcon number={p.batting_order} color="#4a4a4a" size={20} />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-medium text-foreground leading-tight">{p.player_name}</span>
                      {p.player_role && (
                        <span className="text-[7px] text-muted-foreground">{getShortPos(p.player_role)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Substitutions */}
            {subs.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-border/20">
                <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">Substitutions</span>
                {subs.map(sub => (
                  <div key={sub.id} className="flex items-center gap-1.5 text-[10px]">
                    <Badge className="text-[8px] bg-primary/20 text-primary border-primary/30 px-1.5 py-0 font-bold">{sub.minute}</Badge>
                    <span className="text-red-400 font-medium">↓ {sub.player_out}</span>
                    <ArrowRightLeft className="w-2.5 h-2.5 text-muted-foreground/50" />
                    <span className="text-green-400 font-medium">↑ {sub.player_in}</span>
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
