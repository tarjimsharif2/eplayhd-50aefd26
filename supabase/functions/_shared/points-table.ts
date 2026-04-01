export interface DbTeam {
  id: string;
  name: string;
  short_name: string;
}

interface CustomTournamentTeam {
  name?: string | null;
}

export const normalizeTeamName = (name: string): string => {
  return (name || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

export const teamsMatchStrict = (
  dbTeam: { name: string; short_name: string },
  apiTeamName: string,
  apiTeamFullName?: string,
): boolean => {
  const dbShort = (dbTeam.short_name || '').toLowerCase().trim();
  const dbName = normalizeTeamName(dbTeam.name);
  const apiShort = (apiTeamName || '').toLowerCase().trim();
  const apiName = normalizeTeamName(apiTeamFullName || '');

  if (!dbShort || !apiShort) return false;
  if (dbShort === apiShort) return true;
  if (apiName && dbName && dbName === apiName) return true;

  if (apiName.includes(dbShort) && dbShort.length >= 2 && apiShort.length === dbShort.length) {
    return true;
  }

  return false;
};

export const parseNetRunRate = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/[−–—]/g, '-')
    .replace(/[^0-9+-.]/g, '')
    .trim();

  if (!cleaned || ['+', '-', '.', '+.', '-.'].includes(cleaned)) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveCustomTeamIds = (teams: DbTeam[], customParticipatingTeams: unknown): { ids: Set<string>; unresolved: string[] } => {
  const ids = new Set<string>();
  const unresolved: string[] = [];

  if (!Array.isArray(customParticipatingTeams)) {
    return { ids, unresolved };
  }

  for (const teamEntry of customParticipatingTeams as CustomTournamentTeam[]) {
    const teamName = (teamEntry?.name || '').trim();

    if (!teamName) continue;

    const normalizedCustomName = normalizeTeamName(teamName);
    const match = teams.find((team) => {
      const normalizedDbName = normalizeTeamName(team.name);
      const normalizedDbShort = normalizeTeamName(team.short_name);

      return (
        normalizedDbName === normalizedCustomName ||
        normalizedDbShort === normalizedCustomName ||
        teamsMatchStrict(team, teamName, teamName)
      );
    });

    if (match) {
      ids.add(match.id);
    } else {
      unresolved.push(teamName);
    }
  }

  return { ids, unresolved };
};

export const resolveTournamentTeamScope = ({
  teams,
  customParticipatingTeams,
  matchTeamIds,
}: {
  teams: DbTeam[];
  customParticipatingTeams: unknown;
  matchTeamIds: string[];
}): {
  allowedTeamIds: Set<string>;
  scopeSource: 'custom_participating_teams' | 'matches' | 'none';
  unresolvedCustomTeams: string[];
} => {
  const { ids: customTeamIds, unresolved } = resolveCustomTeamIds(teams, customParticipatingTeams);

  if (customTeamIds.size > 0) {
    return {
      allowedTeamIds: customTeamIds,
      scopeSource: 'custom_participating_teams',
      unresolvedCustomTeams: unresolved,
    };
  }

  const allowedTeamIds = new Set(matchTeamIds.filter(Boolean));

  return {
    allowedTeamIds,
    scopeSource: allowedTeamIds.size > 0 ? 'matches' : 'none',
    unresolvedCustomTeams: unresolved,
  };
};