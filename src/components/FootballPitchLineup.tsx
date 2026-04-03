import { useMemo } from 'react';

interface Player {
  id: string;
  match_id: string;
  team_id: string;
  player_name: string;
  player_role: string | null;
  is_captain: boolean;
  is_vice_captain: boolean;
  batting_order: number | null;
  player_image?: string | null;
  is_bench?: boolean;
}

interface Substitution {
  id: string;
  match_id: string;
  team_id: string;
  player_out: string;
  player_in: string;
  minute: string;
}

interface GoalEvent {
  player: string;
  minute: string;
  type?: string;
  assist?: string;
}

interface Team {
  id: string;
  name: string;
  short_name?: string;
  logo_url?: string | null;
}

interface FootballPitchLineupProps {
  teamA: Team;
  teamB: Team;
  teamAPlayers: Player[];
  teamBPlayers: Player[];
  teamASubs: Substitution[];
  teamBSubs: Substitution[];
  goalsTeamA: GoalEvent[];
  goalsTeamB: GoalEvent[];
}

/**
 * Parse a position string (short code OR full name) into:
 *   row      – 0=GK, 1=DEF, 2=DM, 3=MID, 4=AM/Wing, 5=FW
 *   sideOrder – 0=far-left … 100=far-right (determines horizontal order)
 *
 * Handles: G, GK, LB, RB, CB, CD, CD-L, CD-R, DM, CDM,
 *          CM, LM, RM, AM, AM-L, AM-R, CAM, LW, RW,
 *          F, ST, CF, SS  AND  full English names like
 *          "Goalkeeper", "Right Back", "Attacking Midfielder", etc.
 */
const parsePosition = (role: string | null): { row: number; sideOrder: number } => {
  const raw = (role ?? '').trim();
  if (!raw) return { row: 3, sideOrder: 50 };

  // Split on dashes / spaces, uppercase, drop empty fragments
  const parts = raw.toUpperCase().split(/[-\s]+/).filter(Boolean);
  const base = parts[0];
  const suffix = parts[1] ?? '';            // e.g. "L", "R", "BACK", "WINGER" …
  const suffix2 = parts[2] ?? '';

  let row = 3;       // default: central midfield
  let sideOrder = 50; // default: centre

  switch (base) {
    /* ── Goalkeeper ── */
    case 'G':
    case 'GK':
    case 'GOALKEEPER':
      row = 0; sideOrder = 50; break;

    /* ── Full-backs ── */
    case 'LB':
    case 'LWB':
      row = 1; sideOrder = 5; break;
    case 'RB':
    case 'RWB':
      row = 1; sideOrder = 95; break;

    /* ── Centre-backs / Defenders ── */
    case 'CB':
    case 'CD':
    case 'SW':        // sweeper
      row = 1;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;

    /* ── "Left …" positions ── */
    case 'LEFT':
      if (suffix === 'BACK')                        { row = 1; sideOrder = 5; }
      else if (suffix === 'MIDFIELDER')              { row = 3; sideOrder = 5; }
      else if (suffix === 'WINGER' || suffix === 'WING') { row = 4; sideOrder = 5; }
      else if (suffix === 'BACK' && suffix2 === 'BACK') { row = 1; sideOrder = 5; }
      else { row = 3; sideOrder = 5; }
      break;

    /* ── "Right …" positions ── */
    case 'RIGHT':
      if (suffix === 'BACK')                        { row = 1; sideOrder = 95; }
      else if (suffix === 'MIDFIELDER')              { row = 3; sideOrder = 95; }
      else if (suffix === 'WINGER' || suffix === 'WING') { row = 4; sideOrder = 95; }
      else { row = 3; sideOrder = 95; }
      break;

    /* ── "Center/Centre …" positions ── */
    case 'CENTER':
    case 'CENTRE':
      if (suffix === 'BACK')                        { row = 1; sideOrder = 50; }
      else if (suffix === 'MIDFIELDER' || suffix === 'MID') { row = 3; sideOrder = 50; }
      else if (suffix === 'FORWARD')                { row = 5; sideOrder = 50; }
      else { row = 1; sideOrder = 50; } // assume CB if unqualified
      break;

    /* ── Defensive midfielders ── */
    case 'DM':
    case 'CDM':
    case 'DMF':
      row = 2;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;

    case 'DEFENSIVE':
      row = 2; sideOrder = 50; break;

    /* ── Central / box-to-box midfielders ── */
    case 'CM':
    case 'CMF':
      row = 3;
      sideOrder = suffix === 'L' ? 30 : suffix === 'R' ? 70 : 50;
      break;

    case 'LM':
      row = 3; sideOrder = 5; break;
    case 'RM':
      row = 3; sideOrder = 95; break;

    case 'CENTRAL':
    case 'MIDFIELDER':
      row = 3; sideOrder = 50; break;

    /* ── Attacking midfielders / Wingers ── */
    case 'AM':
    case 'CAM':
    case 'AMF':
      row = 4;
      sideOrder = suffix === 'L' ? 5 : suffix === 'R' ? 95 : 50;
      break;

    case 'LW':
      row = 4; sideOrder = 5; break;
    case 'RW':
      row = 4; sideOrder = 95; break;

    case 'ATTACKING':
      row = 4;
      sideOrder = suffix === 'L' || suffix === 'LEFT' ? 5
        : suffix === 'R' || suffix === 'RIGHT' ? 95
        : 50;
      break;

    case 'WINGER':
    case 'WING':
      row = 4;
      sideOrder = suffix === 'L' || suffix === 'LEFT' ? 5
        : suffix === 'R' || suffix === 'RIGHT' ? 95
        : 50;
      break;

    /* ── Forwards / Strikers ── */
    case 'F':
    case 'ST':
    case 'CF':
    case 'SS':
    case 'STRIKER':
    case 'FORWARD':
      row = 5;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;

    /* ── Fallback: scan the whole original string for keywords ── */
    default: {
      const up = raw.toUpperCase();
      if (up.includes('GOAL') || up.includes('KEEPER')) {
        row = 0; sideOrder = 50;
      } else if (up.includes('BACK') || up.includes('DEFENDER') || up.includes(' CB') || up.includes(' CD')) {
        row = 1;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('DEFENSIVE') || up.includes('HOLDING')) {
        row = 2; sideOrder = 50;
      } else if (up.includes('ATTACK')) {
        row = 4;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('WING')) {
        row = 4;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('MID')) {
        row = 3;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('STRIKER') || up.includes('FORWARD')) {
        row = 5; sideOrder = 50;
      }
      break;
    }
  }

  return { row, sideOrder };
};

/* ─── Group starters by row, sorted left-to-right ─── */
const groupPlayersByRow = (players: Player[]) => {
  const groups: Record<number, { player: Player; sideOrder: number }[]> = {};

  players.forEach(p => {
    if (p.is_bench) return;
    const { row, sideOrder } = parsePosition(p.player_role);
    if (!groups[row]) groups[row] = [];
    groups[row].push({ player: p, sideOrder });
  });

  // Sort each row left → right
  Object.values(groups).forEach(g => g.sort((a, b) => a.sideOrder - b.sideOrder));
  return groups;
};

/* ─── Build "4-2-3-1" formation string ─── */
const getFormation = (players: Player[]) => {
  const groups = groupPlayersByRow(players);
  return [1, 2, 3, 4, 5]
    .map(r => (groups[r] ?? []).length)
    .filter(n => n > 0)
    .join('-');
};

/* ─── Fuzzy name match (last-name based) ─── */
const nameParts = (n: string) => n.toLowerCase().split(/\s+/);
const nameMatch = (a: string, b: string) => {
  const ap = nameParts(a);
  const bp = nameParts(b);
  return ap.some(pa => bp.some(pb => pa.length > 2 && pb.includes(pa)));
};

/* ─── PlayerChip ─── */
interface PlayerChipProps {
  player: Player;
  goals: GoalEvent[];
  subs: Substitution[];
  teamColor: string;
}

const PlayerChip = ({ player, goals, subs, teamColor }: PlayerChipProps) => {
  const scored = goals.filter(g => nameMatch(g.player, player.player_name));
  const subOut = subs.find(s => nameMatch(s.player_out, player.player_name));
  const lastName = player.player_name.split(' ').slice(-1)[0] ?? player.player_name;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 52, maxWidth: 64 }}>
      <div className="relative">
        {/* Jersey circle */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shadow-md border-2 border-white/50"
          style={{ backgroundColor: teamColor }}
        >
          {player.batting_order ?? ''}
        </div>

        {/* Goal ⚽ badge */}
        {scored.length > 0 && (
          <span className="absolute -top-2 -right-2 text-sm leading-none" title="Goal scorer">
            ⚽
          </span>
        )}

        {/* Sub out arrow */}
        {subOut && (
          <span
            className="absolute -bottom-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold shadow"
            title={`Subbed off ${subOut.minute}`}
          >
            {subOut.minute}′
          </span>
        )}

        {/* Captain */}
        {player.is_captain && (
          <span className="absolute -top-1.5 -left-1.5 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black shadow">
            C
          </span>
        )}

        {/* Vice captain */}
        {player.is_vice_captain && !player.is_captain && (
          <span className="absolute -top-1.5 -left-1.5 bg-gray-300 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black shadow">
            V
          </span>
        )}
      </div>

      {/* Last name */}
      <span
        className="text-[9px] text-white font-semibold text-center leading-tight drop-shadow-sm truncate"
        style={{ maxWidth: 60 }}
      >
        {lastName}
      </span>

      {/* Position label */}
      {player.player_role && (
        <span className="text-[7px] text-white/60 text-center leading-none">
          {player.player_role}
        </span>
      )}
    </div>
  );
};

/* ─── One horizontal formation row ─── */
interface PitchRowProps {
  row: { player: Player; sideOrder: number }[];
  goals: GoalEvent[];
  subs: Substitution[];
  teamColor: string;
}

const PitchRow = ({ row, goals, subs, teamColor }: PitchRowProps) => (
  <div className="flex justify-around items-center w-full py-1 px-2">
    {row.map(({ player }) => (
      <PlayerChip key={player.id} player={player} goals={goals} subs={subs} teamColor={teamColor} />
    ))}
  </div>
);

/* ─── Main component ─── */
const FootballPitchLineup = ({
  teamA, teamB,
  teamAPlayers, teamBPlayers,
  teamASubs, teamBSubs,
  goalsTeamA, goalsTeamB,
}: FootballPitchLineupProps) => {

  const groupsA = useMemo(() => groupPlayersByRow(teamAPlayers), [teamAPlayers]);
  const groupsB = useMemo(() => groupPlayersByRow(teamBPlayers), [teamBPlayers]);

  const formationA = useMemo(() => getFormation(teamAPlayers), [teamAPlayers]);
  const formationB = useMemo(() => getFormation(teamBPlayers), [teamBPlayers]);

  // Rows that actually have players (sorted: 0 → 5)
  const rowsA = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsA[r] ?? []).length > 0);
  const rowsB = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsB[r] ?? []).length > 0);

  // Team colours – keep generic; can be extended
  const colorA = '#1d4ed8'; // home blue
  const colorB = '#b91c1c'; // away red

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden select-none"
      style={{
        minHeight: 500,
        background: 'linear-gradient(180deg, #14532d 0%, #166534 30%, #15803d 50%, #166534 70%, #14532d 100%)',
      }}
    >
      {/* ── Pitch line markings ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
      >
        {/* Outer lines */}
        <rect x="3" y="2" width="94" height="196" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />
        {/* Halfway line */}
        <line x1="3" y1="100" x2="97" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />
        {/* Centre circle */}
        <circle cx="50" cy="100" r="13" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
        <circle cx="50" cy="100" r="1.2" fill="rgba(255,255,255,0.3)" />
        {/* Top penalty area */}
        <rect x="20" y="2" width="60" height="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.45" />
        <rect x="35" y="2" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
        <circle cx="50" cy="16" r="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
        <circle cx="50" cy="9"  r="1"  fill="rgba(255,255,255,0.2)" />
        {/* Top goal */}
        <rect x="40" y="0" width="20" height="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Bottom penalty area */}
        <rect x="20" y="176" width="60" height="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.45" />
        <rect x="35" y="188" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
        <circle cx="50" cy="184" r="8" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
        <circle cx="50" cy="191" r="1"  fill="rgba(255,255,255,0.2)" />
        {/* Bottom goal */}
        <rect x="40" y="197" width="20" height="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      </svg>

      {/* ════════════════════════════════════
          TEAM B – top half
          Order: GK (row 0) at very top → FW (row 5) toward centre
          ════════════════════════════════════ */}
      <div className="relative z-10 pt-2 pb-0" style={{ minHeight: '47%' }}>
        {/* Team B header */}
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          {teamB.logo_url && (
            <img src={teamB.logo_url} alt={teamB.short_name ?? teamB.name} className="w-5 h-5 object-contain" />
          )}
          <span className="text-white text-[11px] font-bold tracking-wide drop-shadow">
            {teamB.short_name ?? teamB.name}
          </span>
          {formationB && (
            <span className="text-white/50 text-[10px]">{formationB}</span>
          )}
        </div>

        {/* Rows: row 0 first (GK top), then upward rows toward centre */}
        <div className="flex flex-col gap-0.5">
          {rowsB.map(r => (
            <PitchRow
              key={r}
              row={groupsB[r]!}
              goals={goalsTeamB}
              subs={teamBSubs}
              teamColor={colorB}
            />
          ))}
        </div>
      </div>

      {/* ── Halfway line label ── */}
      <div className="relative z-10 flex items-center justify-center my-0.5">
        <div className="absolute w-full h-px bg-white/20" />
      </div>

      {/* ════════════════════════════════════
          TEAM A – bottom half
          Order: FW (row 5) toward centre → GK (row 0) at very bottom
          (reverse of rowsA so high-row numbers appear near centre)
          ════════════════════════════════════ */}
      <div className="relative z-10 pt-0 pb-2" style={{ minHeight: '47%' }}>
        <div className="flex flex-col gap-0.5">
          {[...rowsA].reverse().map(r => (
            <PitchRow
              key={r}
              row={groupsA[r]!}
              goals={goalsTeamA}
              subs={teamASubs}
              teamColor={colorA}
            />
          ))}
        </div>

        {/* Team A footer */}
        <div className="flex items-center justify-center gap-1.5 mt-1.5">
          {teamA.logo_url && (
            <img src={teamA.logo_url} alt={teamA.short_name ?? teamA.name} className="w-5 h-5 object-contain" />
          )}
          <span className="text-white text-[11px] font-bold tracking-wide drop-shadow">
            {teamA.short_name ?? teamA.name}
          </span>
          {formationA && (
            <span className="text-white/50 text-[10px]">{formationA}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FootballPitchLineup;
