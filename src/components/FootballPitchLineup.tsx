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

/* ─── Normalize: lowercase, strip accents/diacritics, remove punctuation ─── */
const normalize = (s: string) =>
  s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

/* ─── Robust name match (handles accents, short names, partial matches) ─── */
const nameMatch = (a: string, b: string): boolean => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Token match (min 3 chars per token)
  const ta = na.split(/\s+/).filter(t => t.length >= 3);
  const tb = nb.split(/\s+/).filter(t => t.length >= 3);
  if (ta.some(t => tb.some(u => t === u || t.includes(u) || u.includes(t)))) return true;
  // Last-name match
  const lastA = na.split(/\s+/).pop() ?? '';
  const lastB = nb.split(/\s+/).pop() ?? '';
  if (lastA.length >= 3 && lastB.length >= 3 &&
      (lastA === lastB || lastA.includes(lastB) || lastB.includes(lastA))) return true;
  return false;
};

/* ─── Parse any football position string → { row, sideOrder } ─────────────
 *  row:       0=GK  1=DEF  2=DM  3=MID  4=AM/Wing  5=FW
 *  sideOrder: 0=far-left … 100=far-right
 *  Covers codes from Opta, StatsBomb, WhoScored, SofaScore, FBref,
 *  Transfermarkt, FIFA, eFootball/PES, Football Manager, API-Football,
 *  Sportmonks, and major European leagues.
 * ──────────────────────────────────────────────────────────────────────── */
const parsePosition = (role: string | null): { row: number; sideOrder: number } => {
  const raw = (role ?? '').trim();
  if (!raw) return { row: 3, sideOrder: 50 };

  const clean = raw.toUpperCase().replace(/[-./\\]/g, ' ').trim();
  const parts  = clean.split(/\s+/).filter(Boolean);
  const p0 = parts[0] ?? '';
  const p1 = parts[1] ?? '';

  let row = 3;
  let sideOrder = 50;

  const side = (token: string, def = 50) =>
    token === 'L' || token === 'LEFT'  ? 15
    : token === 'R' || token === 'RIGHT' ? 85
    : def;

  switch (p0) {
    /* ══ GOALKEEPER ══ */
    case 'G': case 'GK': case 'POR': case 'GL': case 'PT': case 'TW':
    case 'GOALKEEPER': case 'PORTERO': case 'GOLEIRO': case 'GARDIEN':
    case 'TORWART': case 'PORTIERE': case 'KEEPER': case 'PORTERO':
      row = 0; sideOrder = 50; break;

    /* ══ FULLBACKS ══ */
    case 'LB': case 'LWB':
      row = 1; sideOrder = 5; break;
    case 'RB': case 'RWB':
      row = 1; sideOrder = 95; break;

    /* ══ CENTRE-BACKS ══ */
    case 'CB': case 'CD': case 'DC': case 'BK':
    case 'SW': case 'LIB': case 'LIBERO': case 'STOPPER':
    case 'CENTREBACK': case 'CENTERBACK':
      row = 1; sideOrder = side(p1, 50); break;

    /* ══ WING-BACKS (ambiguous - treat as fullback row) ══ */
    case 'WB':
      row = 1; sideOrder = side(p1, 50); break;

    /* ══ DEFENSIVE MIDFIELDERS ══ */
    case 'DM': case 'CDM': case 'DMF': case 'MDC':
    case 'VOL': case 'ANCHOR': case 'PIVOT': case 'HOLDING':
    case 'DESTROYER': case 'REGISTA': case 'SEGUNDO':
      row = 2; sideOrder = side(p1, 50); break;

    /* ══ CENTRAL MIDFIELDERS ══ */
    case 'CM': case 'CMF': case 'MC': case 'MF': case 'MED':
    case 'MEZZALA': case 'MEZZ': case 'BOX': case 'BTB':
      row = 3; sideOrder = side(p1, 50); break;
    case 'LM': case 'ML':
      row = 3; sideOrder = 10; break;
    case 'RM': case 'MR':
      row = 3; sideOrder = 90; break;

    /* ══ ATTACKING MIDFIELDERS / NO.10 ══ */
    case 'AM': case 'CAM': case 'AMF': case 'MAC': case 'OMA':
    case 'TQ': case 'TREQUARTISTA': case 'ENGANCHE':
    case 'MEDIAPUNTA': case 'FANTASISTA': case 'PLAYMAKER':
      row = 4; sideOrder = side(p1, 50); break;

    /* ══ WINGERS ══ */
    case 'LW': case 'OL': case 'WL': case 'AML': case 'LA':
      row = 4; sideOrder = 5; break;
    case 'RW': case 'OR': case 'WR': case 'AMR': case 'RA':
      row = 4; sideOrder = 95; break;

    /* Inside forwards / inverted wingers */
    case 'IL': case 'IF':
      row = 4; sideOrder = side(p1, 15); break;
    case 'IR':
      row = 4; sideOrder = 85; break;
    case 'IW':
      row = 4; sideOrder = side(p1, 50); break;

    /* ══ FORWARDS / STRIKERS ══ */
    case 'ST': case 'CF': case 'CTR': case 'ATT':
    case 'F': case 'FW': case 'FC':
    case 'STRIKER': case 'FORWARD': case 'POACHER':
    case 'CENTREFORWARD': case 'CENTERFORWARD':
    case 'TARGETMAN': case 'FALSE9':
      row = 5; sideOrder = side(p1, 50); break;

    case 'LF': case 'FL':
      row = 5; sideOrder = 15; break;
    case 'RF': case 'FR':
      row = 5; sideOrder = 85; break;

    /* Second striker / shadow striker */
    case 'SS': case 'S9': case 'CF2': case 'SHADOW':
      row = 4; sideOrder = 50; break;

    /* ══ MULTI-WORD POSITIONS ══ */
    case 'LEFT':
      if (p1 === 'BACK' || p1 === 'FULLBACK' || p1 === 'FULL' || p1 === 'FB')
                              { row = 1; sideOrder = 5; }
      else if (p1 === 'WING' || p1 === 'WINGER')
                              { row = 4; sideOrder = 5; }
      else if (p1 === 'FORWARD')
                              { row = 5; sideOrder = 15; }
      else if (p1 === 'MIDFIELDER' || p1 === 'MID' || p1 === 'MIDFIELD')
                              { row = 3; sideOrder = 10; }
      else                    { row = 3; sideOrder = 10; }
      break;

    case 'RIGHT':
      if (p1 === 'BACK' || p1 === 'FULLBACK' || p1 === 'FULL' || p1 === 'FB')
                              { row = 1; sideOrder = 95; }
      else if (p1 === 'WING' || p1 === 'WINGER')
                              { row = 4; sideOrder = 95; }
      else if (p1 === 'FORWARD')
                              { row = 5; sideOrder = 85; }
      else if (p1 === 'MIDFIELDER' || p1 === 'MID' || p1 === 'MIDFIELD')
                              { row = 3; sideOrder = 90; }
      else                    { row = 3; sideOrder = 90; }
      break;

    case 'CENTER': case 'CENTRE': case 'CENTRAL':
      if (p1 === 'BACK' || p1 === 'DEFENDER' || p1 === 'CB')
                              { row = 1; sideOrder = 50; }
      else if (p1 === 'MIDFIELDER' || p1 === 'MID' || p1 === 'MIDFIELD')
                              { row = 3; sideOrder = 50; }
      else if (p1 === 'FORWARD' || p1 === 'STRIKER')
                              { row = 5; sideOrder = 50; }
      else                    { row = 1; sideOrder = 50; }
      break;

    case 'DEFENSIVE':
      if (p1 === 'MIDFIELDER' || p1 === 'MID' || p1 === 'MIDFIELD' || p1 === '')
                              { row = 2; sideOrder = 50; }
      else                    { row = 1; sideOrder = 50; }
      break;

    case 'ATTACKING':
      row = 4; sideOrder = side(p1, 50); break;

    case 'WINGER': case 'WING':
      row = 4; sideOrder = side(p1, 50); break;

    case 'MIDFIELDER': case 'MID': case 'MIDFIELD':
      row = 3; sideOrder = side(p1, 50); break;

    case 'DEFENDER': case 'DEF': case 'DEFENCE': case 'DEFENSE':
      row = 1; sideOrder = side(p1, 50); break;

    /* ══ FALLBACK: keyword scan on full string ══ */
    default: {
      const up = clean;
      if (up.includes('GOAL') || up.includes('KEEPER') || up.includes(' GK'))
        { row = 0; sideOrder = 50; }
      else if (up.includes('SWEEP') || up.includes('LIBERO'))
        { row = 1; sideOrder = 50; }
      else if (up.includes('BACK') || up.includes('DEFENDER') || up.includes('FULLBACK'))
        { row = 1; sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50; }
      else if (up.includes('DEFENSIVE') || up.includes('HOLDING') || up.includes('ANCHOR') || up.includes('PIVOT'))
        { row = 2; sideOrder = 50; }
      else if (up.includes('FORWARD') || up.includes('STRIKER') || up.includes('ATTACKER'))
        { row = 5; sideOrder = up.includes('LEFT') ? 15 : up.includes('RIGHT') ? 85 : 50; }
      else if (up.includes('ATTACK') && up.includes('MID'))
        { row = 4; sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50; }
      else if (up.includes('ATTACK'))
        { row = 4; sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50; }
      else if (up.includes('WING'))
        { row = 4; sideOrder = up.includes('LEFT') ? 5 : up.includes('RIGHT') ? 95 : 50; }
      else if (up.includes('MID'))
        { row = 3; sideOrder = up.includes('LEFT') ? 10 : up.includes('RIGHT') ? 90 : 50; }
      break;
    }
  }

  return { row, sideOrder };
};

/* ─── Starting XI only ─── */
const buildCurrentPitch = (allPlayers: Player[]): Player[] =>
  allPlayers.filter(p => !p.is_bench);

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
}

const JerseySVG = ({ primaryColor, secondaryColor, number }: JerseyProps) => (
  <svg
    viewBox="0 0 52 56"
    width="36"
    height="39"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
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
  </svg>
);

/* ─── PlayerChip ─── */
interface PlayerChipProps {
  player: Player;
  goals: GoalEvent[];
  subs: Substitution[];
  primaryColor: string;
  secondaryColor: string;
}

const PlayerChip = ({ player, goals, subs, primaryColor, secondaryColor }: PlayerChipProps) => {
  const scored = goals.filter(g => nameMatch(g.player, player.player_name));
  const subOut = subs.find(s => nameMatch(s.player_out, player.player_name));
  const lastName = player.player_name.split(' ').pop() ?? player.player_name;

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: 48, maxWidth: 62 }}>
      <div className="relative">
        <JerseySVG
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          number={player.batting_order}
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

        {/* Sub-out badge */}
        {subOut && (
          <span
            className="absolute -bottom-1 -right-1.5 bg-red-600 text-white rounded-full px-1 flex items-center justify-center text-[7px] font-bold shadow z-10 leading-tight"
            style={{ minWidth: 18, height: 14 }}
            title={`Subbed off ${subOut.minute}'`}
          >
            ⬇{subOut.minute}′
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
        style={{ maxWidth: 58, color: 'white' }}
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
}

const PitchRow = ({ row, goals, subs, primaryColor, secondaryColor }: PitchRowProps) => (
  <div className="flex justify-around items-center w-full py-1 px-2">
    {row.map(({ player }) => (
      <PlayerChip
        key={player.id}
        player={player}
        goals={goals}
        subs={subs}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
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
  const pitchA = useMemo(() => buildCurrentPitch(teamAPlayers), [teamAPlayers]);
  const pitchB = useMemo(() => buildCurrentPitch(teamBPlayers), [teamBPlayers]);

  const groupsA = useMemo(() => groupPlayersByRow(pitchA), [pitchA]);
  const groupsB = useMemo(() => groupPlayersByRow(pitchB), [pitchB]);

  const formationA = useMemo(() => getFormation(pitchA), [pitchA]);
  const formationB = useMemo(() => getFormation(pitchB), [pitchB]);

  const rowsA = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsA[r] ?? []).length > 0);
  const rowsB = ([0, 1, 2, 3, 4, 5] as const).filter(r => (groupsB[r] ?? []).length > 0);




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
