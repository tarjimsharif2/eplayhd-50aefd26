import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, User } from 'lucide-react';
import { Team } from '@/hooks/useSportsData';

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
}

const getPositionRow = (role: string | null): number => {
  const pos = (role || '').toLowerCase().trim();
  if (pos === 'gk' || pos.includes('goalkeeper') || pos.includes('goal keeper') || pos.includes('keeper')) return 0;
  if (pos === 'cb' || pos === 'rb' || pos === 'lb' || pos === 'rwb' || pos === 'lwb' || pos.includes('back') || pos.includes('defender') || pos.includes('defence') || pos.includes('defense')) return 1;
  if (pos === 'dm' || pos === 'cm' || pos === 'am' || pos === 'cdm' || pos === 'cam' || pos === 'lm' || pos === 'rm' || pos.includes('midfield') || pos.includes('midfielder')) return 2;
  if (pos === 'st' || pos === 'cf' || pos === 'rw' || pos === 'lw' || pos === 'ss' || pos.includes('forward') || pos.includes('striker') || pos.includes('winger') || pos.includes('wing') || pos.includes('attacker') || pos.includes('attack')) return 3;
  return 2;
};

const getShortPos = (role: string | null): string => {
  if (!role) return '';
  const pos = role.toLowerCase().trim();
  if (pos === 'gk' || pos.includes('goalkeeper')) return 'GK';
  if (pos === 'rb' || pos.includes('right back')) return 'RB';
  if (pos === 'lb' || pos.includes('left back')) return 'LB';
  if (pos === 'cb' || pos.includes('center back') || pos.includes('centre back')) return 'CB';
  if (pos === 'rwb' || pos.includes('right wing back')) return 'RWB';
  if (pos === 'lwb' || pos.includes('left wing back')) return 'LWB';
  if (pos === 'cdm' || pos === 'dm' || pos.includes('defensive mid')) return 'CDM';
  if (pos === 'cm' || pos.includes('central mid')) return 'CM';
  if (pos === 'cam' || pos === 'am' || pos.includes('attacking mid')) return 'CAM';
  if (pos === 'lm' || pos.includes('left mid')) return 'LM';
  if (pos === 'rm' || pos.includes('right mid')) return 'RM';
  if (pos === 'rw' || pos.includes('right wing')) return 'RW';
  if (pos === 'lw' || pos.includes('left wing')) return 'LW';
  if (pos === 'st' || pos.includes('striker')) return 'ST';
  if (pos === 'cf' || pos.includes('forward')) return 'CF';
  if (pos === 'ss') return 'SS';
  return role.slice(0, 3).toUpperCase();
};

// Build effective XI by applying substitutions
const buildEffectiveXI = (startingXI: Player[], subs: Substitution[], allPlayers: Player[]): Player[] => {
  const effective = [...startingXI];
  subs.forEach(sub => {
    const outIdx = effective.findIndex(p => 
      p.player_name.toLowerCase().includes(sub.player_out.toLowerCase()) || 
      sub.player_out.toLowerCase().includes(p.player_name.toLowerCase())
    );
    if (outIdx !== -1) {
      const outPlayer = effective[outIdx];
      // Find sub-in player from bench
      const inPlayer = allPlayers.find(p => 
        p.is_bench && (
          p.player_name.toLowerCase().includes(sub.player_in.toLowerCase()) || 
          sub.player_in.toLowerCase().includes(p.player_name.toLowerCase())
        )
      );
      effective[outIdx] = {
        ...(inPlayer || outPlayer),
        player_name: sub.player_in,
        player_role: inPlayer?.player_role || outPlayer.player_role,
        is_bench: false,
        change_status: 'subbed_in',
        // Keep position from original player if sub doesn't have one
        batting_order: inPlayer?.batting_order || outPlayer.batting_order,
      };
    }
  });
  return effective;
};

const JerseyIcon = ({ number, color, isGK }: { number?: number | null; color: string; isGK?: boolean }) => (
  <div className={`relative w-10 h-10 flex items-center justify-center`}>
    <svg viewBox="0 0 40 40" className="w-full h-full">
      {/* Jersey shape */}
      <path
        d="M12 6 L8 8 L4 14 L8 16 L10 12 L10 34 L30 34 L30 12 L32 16 L36 14 L32 8 L28 6 Z"
        fill={isGK ? '#e6a817' : color}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.8"
      />
    </svg>
    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-md pt-1">
      {number || ''}
    </span>
  </div>
);

const PitchPlayer = ({ player, index, jerseyColor, isGK }: { player: Player; index: number; jerseyColor: string; isGK?: boolean }) => {
  const isSubbedIn = player.change_status === 'subbed_in';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, type: 'spring', stiffness: 200 }}
      className="flex flex-col items-center gap-0 w-[60px] sm:w-[68px]"
    >
      <div className="relative">
        <JerseyIcon number={player.batting_order} color={jerseyColor} isGK={isGK} />
        {player.is_captain && (
          <span className="absolute -top-0.5 -right-0.5 text-[7px] bg-yellow-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-black shadow-md">C</span>
        )}
        {isSubbedIn && (
          <span className="absolute -bottom-0.5 -left-0.5 text-[7px] bg-green-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-md">↑</span>
        )}
      </div>
      <span className="text-[9px] font-semibold text-white text-center leading-tight truncate w-full drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mt-0.5">
        {player.player_name.split(' ').pop()}
      </span>
    </motion.div>
  );
};

const TeamHalf = ({ players, subs, allPlayers, team, isBottom, jerseyColor }: { 
  players: Player[]; subs: Substitution[]; allPlayers: Player[]; team: Team; isBottom?: boolean; jerseyColor: string 
}) => {
  const startingXI = players.filter(p => !p.is_bench);
  const effectiveXI = buildEffectiveXI(startingXI, subs, allPlayers);

  const rows: Player[][] = [[], [], [], []]; // GK, DEF, MID, ATK
  effectiveXI.forEach(p => {
    const row = getPositionRow(p.player_role);
    rows[row].push(p);
  });

  // Auto-distribute if no positions
  if (rows.every(r => r.length === 0) && effectiveXI.length > 0) {
    effectiveXI.forEach((p, i) => {
      if (i === 0) rows[0].push(p);
      else if (i <= 4) rows[1].push(p);
      else if (i <= 8) rows[2].push(p);
      else rows[3].push(p);
    });
  }

  // Detect formation string
  const formation = [rows[1].length, rows[2].length, rows[3].length].filter(n => n > 0).join('-');

  // For bottom team: GK at bottom (row order: ATK, MID, DEF, GK)
  // For top team: GK at top (row order: GK, DEF, MID, ATK)
  const orderedRows = isBottom ? [rows[3], rows[2], rows[1], rows[0]] : rows;

  return (
    <div className="relative flex flex-col">
      {/* Team badge + formation */}
      <div className={`flex items-center gap-2 justify-center py-1.5 ${isBottom ? 'order-last' : ''}`}>
        {team.logo_url && (
          <img src={team.logo_url} alt={team.short_name} className="w-5 h-5 object-contain drop-shadow-md" />
        )}
        <span className="text-[11px] font-bold text-white/90 drop-shadow-md uppercase tracking-wide">{team.short_name || team.name}</span>
        {formation && (
          <span className="text-[10px] font-medium text-white/60 bg-black/30 rounded px-1.5 py-0.5">{formation}</span>
        )}
      </div>

      {/* Formation rows */}
      <div className="flex flex-col items-center gap-4 py-2">
        {orderedRows.map((row, rowIdx) => (
          row.length > 0 && (
            <div key={rowIdx} className="flex items-start justify-center gap-0.5 sm:gap-1">
              {row.map((player, pIdx) => (
                <PitchPlayer
                  key={player.id}
                  player={player}
                  index={rowIdx * 4 + pIdx}
                  jerseyColor={jerseyColor}
                  isGK={getPositionRow(player.player_role) === 0}
                />
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

// Bench player row
const BenchPlayerRow = ({ player, sub, team }: { player: Player; sub?: Substitution; team: Team }) => {
  const wasSubbedIn = sub != null;
  
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors">
      <div className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
        {player.batting_order ? (
          <span className="text-[9px] font-bold text-foreground/70">{player.batting_order}</span>
        ) : (
          <User className="w-3 h-3 text-muted-foreground/50" />
        )}
      </div>
      <span className="text-[11px] font-medium flex-1 truncate">{player.player_name}</span>
      {player.player_role && (
        <span className="text-[9px] text-muted-foreground bg-muted/40 rounded px-1 py-0.5">{getShortPos(player.player_role)}</span>
      )}
      {wasSubbedIn && (
        <Badge className="text-[8px] px-1 py-0 bg-green-500/15 text-green-500 border-green-500/30">
          ↑ {sub!.minute}
        </Badge>
      )}
    </div>
  );
};

const FootballPitchLineup = ({ teamA, teamB, teamAPlayers, teamBPlayers, teamASubs = [], teamBSubs = [] }: FootballPitchLineupProps) => {
  const teamAStarting = teamAPlayers.filter(p => !p.is_bench);
  const teamBStarting = teamBPlayers.filter(p => !p.is_bench);
  const teamABench = teamAPlayers.filter(p => p.is_bench);
  const teamBBench = teamBPlayers.filter(p => p.is_bench);

  if (teamAStarting.length === 0 && teamBStarting.length === 0) return null;

  // Get subbed-out players from starting XI
  const getSubbedOutPlayers = (subs: Substitution[]) => {
    return subs.map(sub => ({
      name: sub.player_out,
      minute: sub.minute,
      replacedBy: sub.player_in,
    }));
  };

  const teamASubbedOut = getSubbedOutPlayers(teamASubs);
  const teamBSubbedOut = getSubbedOutPlayers(teamBSubs);

  return (
    <div className="space-y-3">
      {/* Football Pitch */}
      <div className="relative rounded-xl overflow-hidden shadow-xl" style={{
        background: `
          repeating-linear-gradient(
            180deg,
            #2d8a4e 0px, #2d8a4e 40px,
            #34995a 40px, #34995a 80px
          )
        `
      }}>
        {/* Pitch markings */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Outer border */}
          <div className="absolute inset-2 sm:inset-3 border border-white/25 rounded" />
          {/* Center line */}
          <div className="absolute top-1/2 left-2 right-2 sm:left-3 sm:right-3 h-[1px] bg-white/25" />
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/20" />
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30" />
          {/* Top penalty area */}
          <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 w-40 h-14 border-b border-l border-r border-white/20" />
          <div className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 w-20 h-6 border-b border-l border-r border-white/15" />
          {/* Top penalty arc */}
          <div className="absolute top-[60px] sm:top-[64px] left-1/2 -translate-x-1/2 w-16 h-8 border-b border-white/15 rounded-b-full" />
          {/* Bottom penalty area */}
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 w-40 h-14 border-t border-l border-r border-white/20" />
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 w-20 h-6 border-t border-l border-r border-white/15" />
          {/* Bottom penalty arc */}
          <div className="absolute bottom-[60px] sm:bottom-[64px] left-1/2 -translate-x-1/2 w-16 h-8 border-t border-white/15 rounded-t-full" />
          {/* Corner arcs */}
          <div className="absolute top-2 left-2 sm:top-3 sm:left-3 w-4 h-4 border-r border-b border-white/15 rounded-br-full" />
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-4 h-4 border-l border-b border-white/15 rounded-bl-full" />
          <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 w-4 h-4 border-r border-t border-white/15 rounded-tr-full" />
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 w-4 h-4 border-l border-t border-white/15 rounded-tl-full" />
        </div>

        <div className="relative z-10 px-1 py-2">
          {/* Team A - top half, GK at top */}
          {teamAStarting.length > 0 && (
            <TeamHalf
              players={teamAPlayers}
              subs={teamASubs}
              allPlayers={teamAPlayers}
              team={teamA}
              isBottom={false}
              jerseyColor="#c62828"
            />
          )}

          {/* Center divider */}
          {teamAStarting.length > 0 && teamBStarting.length > 0 && (
            <div className="flex items-center justify-center py-0.5">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white/50">VS</span>
              </div>
            </div>
          )}

          {/* Team B - bottom half, GK at bottom */}
          {teamBStarting.length > 0 && (
            <TeamHalf
              players={teamBPlayers}
              subs={teamBSubs}
              allPlayers={teamBPlayers}
              team={teamB}
              isBottom={true}
              jerseyColor="#1565c0"
            />
          )}
        </div>
      </div>

      {/* Substitutions Timeline */}
      {(teamASubs.length > 0 || teamBSubs.length > 0) && (
        <div className="bg-card/50 rounded-lg border border-border/30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/20 bg-muted/20">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Substitutions</span>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {[...teamASubs.map(s => ({ ...s, team: teamA })), ...teamBSubs.map(s => ({ ...s, team: teamB }))]
              .sort((a, b) => parseInt(a.minute) - parseInt(b.minute))
              .map((sub, idx) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/15"
                >
                  <Badge className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-primary/25 font-mono shrink-0">{sub.minute}'</Badge>
                  {sub.team.logo_url && (
                    <img src={sub.team.logo_url} alt="" className="w-4 h-4 object-contain shrink-0" />
                  )}
                  <div className="flex items-center gap-1 text-[11px] min-w-0 overflow-hidden">
                    <span className="text-green-500 font-medium truncate">↑ {sub.player_in}</span>
                    <span className="text-muted-foreground/50 shrink-0">|</span>
                    <span className="text-red-400 truncate">↓ {sub.player_out}</span>
                  </div>
                </motion.div>
              ))}
          </div>
        </div>
      )}

      {/* Bench / Squad */}
      {(teamABench.length > 0 || teamBBench.length > 0 || teamASubbedOut.length > 0 || teamBSubbedOut.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Team A Bench */}
          {(teamABench.length > 0 || teamASubbedOut.length > 0) && (
            <div className="bg-card/50 rounded-lg border border-border/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/20 bg-muted/20 flex items-center gap-2">
                {teamA.logo_url && <img src={teamA.logo_url} alt="" className="w-4 h-4 object-contain" />}
                <span className="text-xs font-semibold">{teamA.short_name}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">Bench</Badge>
              </div>
              <div className="p-1.5 space-y-0.5">
                {/* Subbed out players */}
                {teamASubbedOut.map((p, i) => (
                  <div key={`out-${i}`} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-red-500/5">
                    <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] text-red-400">↓</span>
                    </div>
                    <span className="text-[11px] font-medium flex-1 truncate text-red-400/80">{p.name}</span>
                    <Badge className="text-[8px] px-1 py-0 bg-red-500/15 text-red-400 border-red-500/30">{p.minute}'</Badge>
                  </div>
                ))}
                {/* Bench players */}
                {teamABench.map(p => {
                  const sub = teamASubs.find(s => 
                    s.player_in.toLowerCase().includes(p.player_name.toLowerCase()) ||
                    p.player_name.toLowerCase().includes(s.player_in.toLowerCase())
                  );
                  return <BenchPlayerRow key={p.id} player={p} sub={sub} team={teamA} />;
                })}
              </div>
            </div>
          )}

          {/* Team B Bench */}
          {(teamBBench.length > 0 || teamBSubbedOut.length > 0) && (
            <div className="bg-card/50 rounded-lg border border-border/30 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/20 bg-muted/20 flex items-center gap-2">
                {teamB.logo_url && <img src={teamB.logo_url} alt="" className="w-4 h-4 object-contain" />}
                <span className="text-xs font-semibold">{teamB.short_name}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">Bench</Badge>
              </div>
              <div className="p-1.5 space-y-0.5">
                {teamBSubbedOut.map((p, i) => (
                  <div key={`out-${i}`} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-red-500/5">
                    <div className="w-5 h-5 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] text-red-400">↓</span>
                    </div>
                    <span className="text-[11px] font-medium flex-1 truncate text-red-400/80">{p.name}</span>
                    <Badge className="text-[8px] px-1 py-0 bg-red-500/15 text-red-400 border-red-500/30">{p.minute}'</Badge>
                  </div>
                ))}
                {teamBBench.map(p => {
                  const sub = teamBSubs.find(s => 
                    s.player_in.toLowerCase().includes(p.player_name.toLowerCase()) ||
                    p.player_name.toLowerCase().includes(s.player_in.toLowerCase())
                  );
                  return <BenchPlayerRow key={p.id} player={p} sub={sub} team={teamB} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FootballPitchLineup;
