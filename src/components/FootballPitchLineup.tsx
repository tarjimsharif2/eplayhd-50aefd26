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
  jersey_color?: string | null;
  jersey_stripe_color?: string | null;
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

/* ─── Parse position into row & sideOrder ─── */
const parsePosition = (role: string | null): { row: number; sideOrder: number } => {
  const raw = (role ?? '').trim();
  if (!raw) return { row: 3, sideOrder: 50 };

  const parts = raw.toUpperCase().split(/[-\s]+/).filter(Boolean);
  const base = parts[0];
  const suffix = parts[1] ?? '';
  const suffix2 = parts[2] ?? '';

  let row = 3;
  let sideOrder = 50;

  switch (base) {
    case 'G': case 'GK': case 'GOALKEEPER':
      row = 0; sideOrder = 50; break;
    case 'LB': case 'LWB':
      row = 1; sideOrder = 5; break;
    case 'RB': case 'RWB':
      row = 1; sideOrder = 95; break;
    case 'CB': case 'CD': case 'SW':
      row = 1;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;
    case 'LEFT':
      if (suffix === 'BACK') { row = 1; sideOrder = 5; }
      else if (suffix === 'MIDFIELDER') { row = 3; sideOrder = 5; }
      else if (suffix === 'WINGER' || suffix === 'WING') { row = 4; sideOrder = 5; }
      else { row = 3; sideOrder = 5; }
      break;
    case 'RIGHT':
      if (suffix === 'BACK') { row = 1; sideOrder = 95; }
      else if (suffix === 'MIDFIELDER') { row = 3; sideOrder = 95; }
      else if (suffix === 'WINGER' || suffix === 'WING') { row = 4; sideOrder = 95; }
      else { row = 3; sideOrder = 95; }
      break;
    case 'CENTER': case 'CENTRE':
      if (suffix === 'BACK') { row = 1; sideOrder = 50; }
      else if (suffix === 'MIDFIELDER' || suffix === 'MID') { row = 3; sideOrder = 50; }
      else if (suffix === 'FORWARD') { row = 5; sideOrder = 50; }
      else { row = 1; sideOrder = 50; }
      break;
    case 'DM': case 'CDM': case 'DMF':
      row = 2;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;
    case 'DEFENSIVE':
      row = 2; sideOrder = 50; break;
    case 'CM': case 'CMF':
      row = 3;
      sideOrder = suffix === 'L' ? 30 : suffix === 'R' ? 70 : 50;
      break;
    case 'LM':
      row = 3; sideOrder = 5; break;
    case 'RM':
      row = 3; sideOrder = 95; break;
    case 'CENTRAL': case 'MIDFIELDER':
      row = 3; sideOrder = 50; break;
    case 'AM': case 'CAM': case 'AMF':
      row = 4;
      sideOrder = suffix === 'L' ? 5 : suffix === 'R' ? 95 : 50;
      break;
    case 'LW':
      row = 4; sideOrder = 5; break;
    case 'RW':
      row = 4; sideOrder = 95; break;
    case 'ATTACKING':
      row = 4;
      sideOrder = suffix === 'L' || suffix === 'LEFT' ? 5 : suffix === 'R' || suffix === 'RIGHT' ? 95 : 50;
      break;
    case 'WINGER': case 'WING':
      row = 4;
      sideOrder = suffix === 'L' || suffix === 'LEFT' ? 5 : suffix === 'R' || suffix === 'RIGHT' ? 95 : 50;
      break;
    case 'F': case 'ST': case 'CF': case 'SS': case 'STRIKER': case 'FORWARD':
      row = 5;
      sideOrder = suffix === 'L' ? 25 : suffix === 'R' ? 75 : 50;
      break;
    default: {
      const up = raw.toUpperCase();
      if (up.includes('GOAL') || up.includes('KEEPER')) { row = 0; sideOrder = 50; }
      else if (up.includes('BACK') || up.includes('DEFENDER')) {
        row = 1;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('DEFENSIVE') || up.includes('HOLDING')) { row = 2; sideOrder = 50; }
      else if (up.includes('ATTACK')) {
        row = 4;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('WING')) {
        row = 4;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('MID')) {
        row = 3;
        sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50;
      } else if (up.includes('STRIKER') || up.includes('FORWARD')) { row = 5; sideOrder = 50; }
      break;
    }
  }

  return { row, sideOrder };
};

/* ─── Fuzzy name match ─── */
const nameParts = (n: string) => n.toLowerCase().split(/\s+/);
const nameMatch = (a: string, b: string) => {
  const ap = nameParts(a);
  const bp = nameParts(b);
  return ap.some(pa => bp.some(pb => pa.length > 2 && pb.includes(pa)));
};

/* ─── Build current pitch players after substitutions ─── */
const buildCurrentPitch = (
  allPlayers: Player[],
  subs: Substitution[]
): Player[] => {
  // Start with XI starters
  let pitchPlayers = allPlayers.filter(p => !p.is_bench);

  subs.forEach(sub => {
    // Remove subbed-out player
    pitchPlayers = pitchPlayers.filter(p => !nameMatch(p.player_name, sub.player_out));

    // Find the incoming player from bench
    const incoming = allPlayers.find(p => p.is_bench && nameMatch(p.player_name, sub.player_in));
    if (incoming) {
      // Inherit the position of the player who went off (if incoming has no role)
      const outPlayer = allPlayers.find(p => nameMatch(p.player_name, sub.player_out));
      const effectiveRole = incoming.player_role ?? outPlayer?.player_role ?? null;
      pitchPlayers.push({
        ...incoming,
        is_bench: false,
        player_role: effectiveRole,
      });
    }
  });

  return pitchPlayers;
};

/* ─── Group players by pitch row ─── */
const groupPlayersByRow = (players: Player[]) => {
  const groups: Record<number, { player: Player; sideOrder: number }[]> = {};
  players.forEach(p => {
    const { row, sideOrder } = parsePosition(p.player_role);
    if (!groups[row]) groups[row] = [];
    groups[row].push({ player: p, sideOrder });
  });
  Object.values(groups).forEach(g => g.sort((a, b) => a.sideOrder - b.sideOrder));
  return groups;
};

/* ─── Formation string ─── */
const getFormation = (players: Player[]) => {
  const groups = groupPlayersByRow(players);
  return [1, 2, 3, 4, 5]
    .map(r => (groups[r] ?? []).length)
    .filter(n => n > 0)
    .join('-');
};

/* ─── Jersey SVG ─── */
interface JerseyProps {
  primaryColor: string;
  secondaryColor: string;
  number: number | null;
  isSub?: boolean;
}

const JerseySVG = ({ primaryColor, secondaryColor, number, isSub = false }: JerseyProps) => (
  <svg
    viewBox="0 0 52 56"
    width="36"
    height="39"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: isSub ? 'drop-shadow(0 0 4px rgba(74,222,128,0.8))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
  >
    {/* Left sleeve */}
    <path
      d="M0,12 L6,8 L16,16 L14,26 L4,24 Z"
      fill={primaryColor}
      stroke={secondaryColor}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Right sleeve */}
    <path
      d="M52,12 L46,8 L36,16 L38,26 L48,24 Z"
      fill={primaryColor}
      stroke={secondaryColor}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Body */}
    <path
      d="M16,4 C18,1 22,0 26,0 C30,0 34,1 36,4 L46,8 L36,16 L36,54 L16,54 L16,16 L6,8 Z"
      fill={primaryColor}
      stroke={secondaryColor}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    {/* Collar */}
    <path
      d="M19,3 Q26,8 33,3"
      fill="none"
      stroke={secondaryColor}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* Sleeve stripe */}
    <line x1="5" y1="17" x2="14" y2="22" stroke={secondaryColor} strokeWidth="1" opacity="0.6" />
    <line x1="47" y1="17" x2="38" y2="22" stroke={secondaryColor} strokeWidth="1" opacity="0.6" />
    {/* Number */}
    {number !== null && (
      <text
        x="26"
        y="38"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={secondaryColor}
        fontSize="15"
        fontWeight="900"
        fontFamily="'Arial Black', Arial, sans-serif"
        letterSpacing="-1"
      >
        {number}
      </text>
    )}
    {/* Sub indicator glow ring */}
    {isSub && (
      <path
        d="M16,4 C18,1 22,0 26,0 C30,0 34,1 36,4 L46,8 L36,16 L36,54 L16,54 L16,16 L6,8 Z"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        opacity="0.7"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

/* ─── PlayerChip ─── */
interface PlayerChipProps {
  player: Player;
  goals: GoalEvent[];
  subs: Substitution[];
  primaryColor: string;
  secondaryColor: string;
  isSub?: boolean;
}

const PlayerChip = ({ player, goals, subs, primaryColor, secondaryColor, isSub = false }: PlayerChipProps) => {
  const scored = goals.filter(g => nameMatch(g.player, player.player_name));
  const subIn = subs.find(s => nameMatch(s.player_in, player.player_name));
  const lastName = player.player_name.split(' ').pop() ?? player.player_name;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 48, maxWidth: 62 }}>
      <div className="relative">
        <JerseySVG
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          number={player.batting_order}
          isSub={isSub}
        />

        {/* Goal badge */}
        {scored.length > 0 && (
          <span
            className="absolute -top-2 -right-1 text-sm leading-none z-10"
            title="Goal scorer"
          >
            ⚽{scored.length > 1 ? `×${scored.length}` : ''}
          </span>
        )}

        {/* Sub-in minute badge */}
        {subIn && (
          <span
            className="absolute -bottom-1 -right-1.5 bg-green-500 text-white rounded-full px-1 flex items-center justify-center text-[7px] font-bold shadow z-10 leading-tight"
            style={{ minWidth: 18, height: 14 }}
            title={`Subbed on ${subIn.minute}'`}
          >
            ↑{subIn.minute}′
          </span>
        )}

        {/* Captain badge */}
        {player.is_captain && (
          <span className="absolute -top-1 -left-1 bg-yellow-400 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black shadow z-10">
            C
          </span>
        )}

        {/* Vice-captain badge */}
        {player.is_vice_captain && !player.is_captain && (
          <span className="absolute -top-1 -left-1 bg-gray-200 text-black rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black shadow z-10">
            V
          </span>
        )}
      </div>

      {/* Player last name */}
      <span
        className="text-[9px] font-bold text-center leading-tight drop-shadow truncate"
        style={{ maxWidth: 58, color: isSub ? '#4ade80' : 'white' }}
      >
        {lastName}
      </span>

      {/* Position label */}
      {player.player_role && (
        <span className="text-[7px] text-white/50 text-center leading-none truncate" style={{ maxWidth: 58 }}>
          {player.player_role}
        </span>
      )}
    </div>
  );
};

/* ─── Pitch row ─── */
interface PitchRowProps {
  row: { player: Player; sideOrder: number }[];
  goals: GoalEvent[];
  subs: Substitution[];
  primaryColor: string;
  secondaryColor: string;
  subbedOnNames: string[];
}

const PitchRow = ({ row, goals, subs, primaryColor, secondaryColor, subbedOnNames }: PitchRowProps) => (
  <div className="flex justify-around items-center w-full py-1 px-2">
    {row.map(({ player }) => (
      <PlayerChip
        key={player.id}
        player={player}
        goals={goals}
        subs={subs}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        isSub={subbedOnNames.some(n => nameMatch(n, player.player_name))}
      />
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

  // Team jersey colors — use provided or sensible defaults
  const colorA = {
    primary: teamA.jersey_color ?? '#1e3a8a',       // deep blue
    secondary: teamA.jersey_stripe_color ?? '#ffffff',
  };
  const colorB = {
    primary: teamB.jersey_color ?? '#991b1b',        // deep red
    secondary: teamB.jersey_stripe_color ?? '#fde68a', // gold trim
  };

  // Build current pitch (starters ± subs)
  const pitchA = useMemo(() => buildCurrentPitch(teamAPlayers, teamASubs), [teamAPlayers, teamASubs]);
  const pitchB = useMemo(() => buildCurrentPitch(teamBPlayers, teamBSubs), [teamBPlayers, teamBSubs]);

  const groupsA = useMemo(() => groupPlayersByRow(pitchA), [pitchA]);
  const groupsB = useMemo(() => groupPlayersByRow(pitchB), [pitchB]);

  const formationA = useMemo(() => getFormation(pitchA), [pitchA]);
  const formationB = useMemo(() => getFormation(pitchB), [pitchB]);

  const rowsA = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsA[r] ?? []).length > 0);
  const rowsB = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsB[r] ?? []).length > 0);

  const subbedOnA = teamASubs.map(s => s.player_in);
  const subbedOnB = teamBSubs.map(s => s.player_in);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{
        minHeight: 520,
        background: `
          repeating-linear-gradient(
            180deg,
            rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 28px,
            transparent 28px, transparent 56px
          ),
          linear-gradient(180deg, #14532d 0%, #166534 25%, #16a34a 50%, #166534 75%, #14532d 100%)
        `,
      }}
    >
      {/* Pitch markings SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
      >
        <rect x="3" y="2" width="94" height="196" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        <line x1="3" y1="100" x2="97" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" />
        <circle cx="50" cy="100" r="13" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <circle cx="50" cy="100" r="1.2" fill="rgba(255,255,255,0.35)" />
        {/* Top penalty */}
        <rect x="20" y="2" width="60" height="22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.45" />
        <rect x="35" y="2" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="0.4" />
        <circle cx="50" cy="9" r="1" fill="rgba(255,255,255,0.25)" />
        <rect x="40" y="0" width="20" height="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        {/* Bottom penalty */}
        <rect x="20" y="176" width="60" height="22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.45" />
        <rect x="35" y="188" width="30" height="10" fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth="0.4" />
        <circle cx="50" cy="191" r="1" fill="rgba(255,255,255,0.25)" />
        <rect x="40" y="197" width="20" height="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      </svg>

      {/* ── TEAM B – top half (GK at top → FW toward centre) ── */}
      <div className="relative z-10 pt-2 pb-0" style={{ minHeight: '47%' }}>
        {/* Team B header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {teamB.logo_url && (
            <img src={teamB.logo_url} alt={teamB.short_name ?? teamB.name} className="w-6 h-6 object-contain drop-shadow" />
          )}
          <span
            className="text-white text-[11px] font-black tracking-widest uppercase drop-shadow"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
          >
            {teamB.short_name ?? teamB.name}
          </span>
          {formationB && (
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: colorB.primary, color: colorB.secondary, opacity: 0.9 }}
            >
              {formationB}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {rowsB.map(r => (
            <PitchRow
              key={r}
              row={groupsB[r]!}
              goals={goalsTeamB}
              subs={teamBSubs}
              primaryColor={colorB.primary}
              secondaryColor={colorB.secondary}
              subbedOnNames={subbedOnB}
            />
          ))}
        </div>
      </div>

      {/* Halfway divider */}
      <div className="relative z-10 flex items-center justify-center my-0.5">
        <div className="absolute w-full h-px bg-white/20" />
      </div>

      {/* ── TEAM A – bottom half (FW toward centre → GK at bottom) ── */}
      <div className="relative z-10 pt-0 pb-2" style={{ minHeight: '47%' }}>
        <div className="flex flex-col gap-0.5">
          {[...rowsA].reverse().map(r => (
            <PitchRow
              key={r}
              row={groupsA[r]!}
              goals={goalsTeamA}
              subs={teamASubs}
              primaryColor={colorA.primary}
              secondaryColor={colorA.secondary}
              subbedOnNames={subbedOnA}
            />
          ))}
        </div>

        {/* Team A footer */}
        <div className="flex items-center justify-center gap-2 mt-2">
          {teamA.logo_url && (
            <img src={teamA.logo_url} alt={teamA.short_name ?? teamA.name} className="w-6 h-6 object-contain drop-shadow" />
          )}
          <span
            className="text-white text-[11px] font-black tracking-widest uppercase drop-shadow"
            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
          >
            {teamA.short_name ?? teamA.name}
          </span>
          {formationA && (
            <span
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
              style={{ background: colorA.primary, color: colorA.secondary, opacity: 0.9 }}
            >
              {formationA}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FootballPitchLineup;
