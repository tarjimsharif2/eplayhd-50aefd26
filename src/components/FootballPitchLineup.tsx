import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ArrowRightLeft, User } from 'lucide-react';
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

// Map positions to formation rows (0=GK, 1=DEF, 2=MID, 3=ATK)
const getPositionRow = (role: string | null): number => {
  const pos = (role || '').toLowerCase();
  if (pos.includes('goal') || pos === 'gk') return 0;
  if (pos.includes('back') || pos.includes('defender') || pos === 'cb' || pos === 'rb' || pos === 'lb' || pos === 'rwb' || pos === 'lwb') return 1;
  if (pos.includes('mid') || pos === 'dm' || pos === 'cm' || pos === 'am' || pos === 'cdm' || pos === 'cam') return 2;
  if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker') || pos === 'st' || pos === 'cf' || pos === 'rw' || pos === 'lw' || pos === 'ss') return 3;
  return 2; // default to midfield
};

const getShortPosition = (role: string | null): string => {
  const pos = (role || '').toLowerCase();
  if (pos.includes('goalkeeper') || pos === 'gk') return 'GK';
  if (pos.includes('right back')) return 'RB';
  if (pos.includes('left back')) return 'LB';
  if (pos.includes('center back')) return 'CB';
  if (pos.includes('defensive mid')) return 'DM';
  if (pos.includes('central mid')) return 'CM';
  if (pos.includes('attacking mid')) return 'AM';
  if (pos.includes('right wing')) return 'RW';
  if (pos.includes('left wing')) return 'LW';
  if (pos.includes('striker')) return 'ST';
  if (pos.includes('forward')) return 'FW';
  if (role) return role.slice(0, 3).toUpperCase();
  return '';
};

const PlayerAvatar = ({ player }: { player: Player }) => {
  const showImage = player.player_image && !player.player_image.includes('icon512') && !player.player_image.includes('placeholder');
  
  return (
    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/30 bg-black/30 shadow-md">
      {showImage ? (
        <img 
          src={player.player_image!} 
          alt={player.player_name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            const fallback = (e.target as HTMLImageElement).nextElementSibling;
            if (fallback) (fallback as HTMLElement).style.display = 'flex';
          }}
        />
      ) : null}
      <div 
        className="w-full h-full flex items-center justify-center bg-black/40"
        style={{ display: showImage ? 'none' : 'flex' }}
      >
        {player.batting_order ? (
          <span className="text-xs font-bold text-white">{player.batting_order}</span>
        ) : (
          <User className="w-4 h-4 text-white/70" />
        )}
      </div>
    </div>
  );
};

const PitchPlayer = ({ player, index }: { player: Player; index: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.04 }}
    className="flex flex-col items-center gap-0.5 w-[72px]"
  >
    <div className="relative">
      <PlayerAvatar player={player} />
      {player.is_captain && (
        <span className="absolute -top-1 -right-1 text-[8px] bg-amber-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold shadow">C</span>
      )}
      {player.change_status === 'out' && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[7px] bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center">↓</span>
      )}
    </div>
    {getShortPosition(player.player_role) && (
      <span className="text-[8px] font-semibold text-white/80 bg-black/30 rounded px-1">{getShortPosition(player.player_role)}</span>
    )}
    <span className="text-[10px] font-medium text-white text-center leading-tight truncate w-full drop-shadow-md">
      {player.batting_order ? `${player.batting_order}. ` : ''}{player.player_name.split(' ').pop()}
    </span>
  </motion.div>
);

const TeamPitchHalf = ({ players, team, isReversed }: { players: Player[]; team: Team; isReversed?: boolean }) => {
  const startingXI = players.filter(p => !p.is_bench);
  
  // Group players by formation row
  const rows: Player[][] = [[], [], [], []]; // GK, DEF, MID, ATK
  startingXI.forEach(p => {
    const row = getPositionRow(p.player_role);
    rows[row].push(p);
  });

  // If no positions assigned, auto-distribute (1-4-4-2 or similar)
  if (rows.every(r => r.length === 0) && startingXI.length > 0) {
    startingXI.forEach((p, i) => {
      if (i === 0) rows[0].push(p);
      else if (i <= 4) rows[1].push(p);
      else if (i <= 8) rows[2].push(p);
      else rows[3].push(p);
    });
  }

  // Order: for normal (teamA), GK at bottom → ATK at top. For reversed (teamB), ATK at bottom → GK at top.
  const orderedRows = isReversed ? rows : [...rows].reverse();

  return (
    <div className="relative">
      {/* Team indicator */}
      <div className="flex items-center gap-2 justify-center py-2">
        {team.logo_url && (
          <img src={team.logo_url} alt={team.short_name} className="w-5 h-5 object-contain" />
        )}
        <span className="text-xs font-bold text-white drop-shadow">{team.short_name || team.name}</span>
      </div>
      
      {/* Formation rows on pitch */}
      <div className="flex flex-col items-center gap-3 py-2">
        {orderedRows.map((row, rowIdx) => (
          row.length > 0 && (
            <div key={rowIdx} className="flex items-center justify-center gap-1 flex-wrap">
              {row.map((player, pIdx) => (
                <PitchPlayer key={player.id} player={player} index={rowIdx * 4 + pIdx} />
              ))}
            </div>
          )
        ))}
      </div>
    </div>
  );
};

const FootballPitchLineup = ({ teamA, teamB, teamAPlayers, teamBPlayers, teamASubs = [], teamBSubs = [] }: FootballPitchLineupProps) => {
  const teamAStarting = teamAPlayers.filter(p => !p.is_bench);
  const teamBStarting = teamBPlayers.filter(p => !p.is_bench);
  const teamABench = teamAPlayers.filter(p => p.is_bench);
  const teamBBench = teamBPlayers.filter(p => p.is_bench);

  if (teamAStarting.length === 0 && teamBStarting.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Pitch Formation */}
      <div className="relative rounded-xl overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a5c2e 0%, #1e6b35 25%, #1a5c2e 50%, #1e6b35 75%, #1a5c2e 100%)' }}>
        {/* Pitch markings */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Center line */}
          <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-white/20" />
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/15" />
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20" />
          {/* Top penalty area */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-12 border-b border-l border-r border-white/15 rounded-b-sm" />
          {/* Bottom penalty area */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-12 border-t border-l border-r border-white/15 rounded-t-sm" />
          {/* Pitch border */}
          <div className="absolute inset-3 border border-white/15 rounded-sm" />
        </div>

        <div className="relative z-10 px-2 py-3">
          {/* Team A (attacking upwards - ATK at top) */}
          {teamAStarting.length > 0 && (
            <TeamPitchHalf players={teamAPlayers} team={teamA} isReversed={true} />
          )}
          
          {/* Divider with VS */}
          {teamAStarting.length > 0 && teamBStarting.length > 0 && (
            <div className="flex items-center justify-center py-1">
              <span className="text-[10px] font-bold text-white/40 bg-white/10 rounded-full px-2 py-0.5">VS</span>
            </div>
          )}
          
          {/* Team B (attacking downwards - ATK at bottom) */}
          {teamBStarting.length > 0 && (
            <TeamPitchHalf players={teamBPlayers} team={teamB} isReversed={false} />
          )}
        </div>
      </div>

      {/* Substitutes & Bench */}
      {(teamABench.length > 0 || teamBBench.length > 0 || teamASubs.length > 0 || teamBSubs.length > 0) && (
        <div className="space-y-3">
          {/* Team A Bench/Subs */}
          {(teamABench.length > 0 || teamASubs.length > 0) && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {teamA.logo_url && <img src={teamA.logo_url} alt="" className="w-4 h-4 object-contain" />}
                <span className="text-xs font-semibold">{teamA.short_name || teamA.name}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0">Bench</Badge>
              </div>
              
              {/* Bench players */}
              {teamABench.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {teamABench.map(p => (
                    <span key={p.id} className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground">
                      {p.batting_order ? `${p.batting_order}. ` : ''}{p.player_name}
                      {p.player_role ? ` (${getShortPosition(p.player_role)})` : ''}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Substitutions */}
              {teamASubs.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/20">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase">Substitutions</span>
                  {teamASubs.map(sub => (
                    <div key={sub.id} className="flex items-center gap-1.5 text-[10px]">
                      <Badge className="text-[8px] bg-primary/20 text-primary border-primary/30 px-1 py-0">{sub.minute}</Badge>
                      <span className="text-red-400">↓ {sub.player_out}</span>
                      <ArrowRightLeft className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-green-400">↑ {sub.player_in}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team B Bench/Subs */}
          {(teamBBench.length > 0 || teamBSubs.length > 0) && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {teamB.logo_url && <img src={teamB.logo_url} alt="" className="w-4 h-4 object-contain" />}
                <span className="text-xs font-semibold">{teamB.short_name || teamB.name}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0">Bench</Badge>
              </div>
              
              {teamBBench.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {teamBBench.map(p => (
                    <span key={p.id} className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground">
                      {p.batting_order ? `${p.batting_order}. ` : ''}{p.player_name}
                      {p.player_role ? ` (${getShortPosition(p.player_role)})` : ''}
                    </span>
                  ))}
                </div>
              )}
              
              {teamBSubs.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/20">
                  <span className="text-[9px] font-medium text-muted-foreground uppercase">Substitutions</span>
                  {teamBSubs.map(sub => (
                    <div key={sub.id} className="flex items-center gap-1.5 text-[10px]">
                      <Badge className="text-[8px] bg-primary/20 text-primary border-primary/30 px-1 py-0">{sub.minute}</Badge>
                      <span className="text-red-400">↓ {sub.player_out}</span>
                      <ArrowRightLeft className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-green-400">↑ {sub.player_in}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FootballPitchLineup;
