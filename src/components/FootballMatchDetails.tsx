import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Goal, ArrowRightLeft, Shirt, User } from 'lucide-react';
import FootballPitchLineup from '@/components/FootballPitchLineup';
import { motion } from 'framer-motion';
import { Team, GoalEvent } from '@/hooks/useSportsData';
import FootballTimer from '@/components/FootballTimer';

const PlayerAvatar = ({ player }: { player: Player }) => {
  const [imgError, setImgError] = useState(false);
  
  const showImage = player.player_image && !imgError;
  
  return (
    <div className="relative w-8 h-8 rounded-full flex-shrink-0 overflow-hidden border border-border/30 bg-muted/40">
      {showImage ? (
        <img 
          src={player.player_image!} 
          alt={player.player_name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : null}
      {!showImage && (
        <div className="w-full h-full flex items-center justify-center bg-muted/40">
          {player.batting_order ? (
            <span className="text-[10px] font-bold text-foreground/70">{player.batting_order}</span>
          ) : (
            <User className="w-4 h-4 text-muted-foreground/50" />
          )}
        </div>
      )}
    </div>
  );
};

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
}

interface Substitution {
  id: string;
  match_id: string;
  team_id: string;
  player_out: string;
  player_in: string;
  minute: string;
}

interface PlayerInfo {
  name: string;
  position: string;
  jerseyNumber?: string;
  isCaptain?: boolean;
}

interface SubstitutionEvent {
  playerOut: string;
  playerIn: string;
  minute: string;
}

interface FootballMatchDetailsProps {
  matchId: string;
  teamA: Team;
  teamB: Team;
  goalsTeamA: GoalEvent[];
  goalsTeamB: GoalEvent[];
  scoreA?: string | null;
  scoreB?: string | null;
  matchMinute?: number | null;
  matchStatus?: string;
}

// Hook for fetching playing XI
const usePlayingXI = (matchId: string) => {
  return useQuery({
    queryKey: ['playing_xi', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_playing_xi')
        .select('*')
        .eq('match_id', matchId)
        .order('batting_order', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data as Player[];
    },
    enabled: !!matchId,
  });
};

// Hook for fetching substitutions
const useSubstitutions = (matchId: string) => {
  return useQuery({
    queryKey: ['substitutions', matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_substitutions')
        .select('*')
        .eq('match_id', matchId)
        .order('minute', { ascending: true });
      
      if (error) throw error;
      return data as Substitution[];
    },
    enabled: !!matchId,
  });
};

// Position color mapping
const getPositionColor = (position: string | null): string => {
  const pos = (position || '').toLowerCase();
  if (pos.includes('goal')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (pos.includes('back') || pos.includes('defender')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  if (pos.includes('mid')) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (pos.includes('wing') || pos.includes('forward') || pos.includes('striker')) return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-muted/50 text-muted-foreground border-border/50';
};

const FootballMatchDetails = ({ matchId, teamA, teamB, goalsTeamA, goalsTeamB, scoreA, scoreB, matchMinute, matchStatus }: FootballMatchDetailsProps) => {
  const { data: players, isLoading: playersLoading } = usePlayingXI(matchId);
  const { data: substitutions, isLoading: subsLoading } = useSubstitutions(matchId);

  // Local seconds counter for football timer
  const [footballSeconds, setFootballSeconds] = useState(0);
  const prevMinuteRef = useRef(matchMinute);

  useEffect(() => {
    if (matchStatus !== 'live' || matchMinute == null) return;

    if (prevMinuteRef.current !== matchMinute) {
      setFootballSeconds(0);
      prevMinuteRef.current = matchMinute;
    }

    const interval = setInterval(() => {
      setFootballSeconds(prev => (prev >= 59 ? 59 : prev + 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [matchStatus, matchMinute]);

  const teamAPlayers = players?.filter(p => p.team_id === teamA.id) || [];
  const teamBPlayers = players?.filter(p => p.team_id === teamB.id) || [];
  const teamASubs = substitutions?.filter(s => s.team_id === teamA.id) || [];
  const teamBSubs = substitutions?.filter(s => s.team_id === teamB.id) || [];

  // Hide component if no data
  const hasData = teamAPlayers.length > 0 || teamBPlayers.length > 0 || goalsTeamA.length > 0 || goalsTeamB.length > 0 || teamASubs.length > 0 || teamBSubs.length > 0;
  
  if (!hasData) {
    return null;
  }

  const renderGoalBadge = (goal: GoalEvent) => {
    if (goal.type === 'penalty') {
      return <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">P</Badge>;
    }
    if (goal.type === 'own_goal') {
      return <Badge className="text-[9px] px-1.5 py-0 bg-red-500/20 text-red-400 border-red-500/30">OG</Badge>;
    }
    return null;
  };

  const renderGoalsList = (goals: GoalEvent[], teamName: string, teamLogo?: string | null) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
        {teamLogo ? (
          <img src={teamLogo} alt={teamName} className="w-5 h-5 object-contain" />
        ) : (
          <Goal className="w-4 h-4 text-green-500" />
        )}
        <span className="text-sm font-medium">{teamName}</span>
        <Badge variant="secondary" className="text-[10px]">{goals.length}</Badge>
      </div>
      {goals.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No goals</p>
      ) : (
        <div className="space-y-1.5">
          {goals.map((goal, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2"
            >
              <Goal className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span className="text-sm font-medium">{goal.player}</span>
              <span className="text-sm text-primary font-medium">{goal.minute}</span>
              {renderGoalBadge(goal)}
              {goal.assist && (
                <span className="text-xs text-muted-foreground ml-1">(Assist: {goal.assist})</span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // Compact player row for lineup (no subs here)
  const renderCompactPlayersList = (teamPlayers: Player[], teamName: string, teamLogo?: string | null) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
        {teamLogo ? (
          <img src={teamLogo} alt={teamName} className="w-5 h-5 object-contain" />
        ) : (
          <Users className="w-4 h-4 text-primary" />
        )}
        <span className="text-sm font-medium">{teamName}</span>
        <Badge variant="secondary" className="text-[10px]">{teamPlayers.length}</Badge>
      </div>
      
      {teamPlayers.length > 0 ? (
        <div className="space-y-1">
          {teamPlayers.map((player, index) => (
            <motion.div 
              key={player.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Player Image */}
                <PlayerAvatar player={player} />
                <span className="text-xs font-medium truncate">{player.player_name}</span>
                {player.is_captain && (
                  <Badge className="text-[8px] px-1 py-0 bg-amber-500/20 text-amber-400 border-amber-500/30">C</Badge>
                )}
              </div>
              {player.player_role && (
                <Badge 
                  variant="outline" 
                  className={`text-[9px] px-1.5 py-0.5 font-medium shrink-0 ${getPositionColor(player.player_role)}`}
                >
                  {player.player_role}
                </Badge>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-3 text-center">Lineup not available</p>
      )}
    </div>
  );
  
  // Compact substitution row
  const renderCompactSubsList = (subs: Substitution[], teamName: string, teamLogo?: string | null) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b border-border/30">
        {teamLogo ? (
          <img src={teamLogo} alt={teamName} className="w-5 h-5 object-contain" />
        ) : (
          <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{teamName}</span>
        <Badge variant="secondary" className="text-[10px]">{subs.length}</Badge>
      </div>
      
      {subs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No substitutions</p>
      ) : (
        <div className="space-y-1">
          {subs.map((sub, index) => (
            <motion.div 
              key={sub.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className="flex items-center gap-1.5 bg-muted/30 rounded-md px-2.5 py-1.5 text-xs"
            >
              <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30 shrink-0">{sub.minute}</Badge>
              <span className="text-red-400 truncate">↓ {sub.player_out}</span>
              <ArrowRightLeft className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="text-green-400 truncate">↑ {sub.player_in}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-6"
    >
      <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur shadow-lg">
        <CardHeader className="pb-3 bg-gradient-to-r from-green-500/10 via-transparent to-green-500/5">
          <CardTitle className="flex items-center justify-between gap-3 text-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Shirt className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <span>Match Details</span>
                <p className="text-xs font-normal text-muted-foreground mt-0.5">
                  Lineups, goals & substitutions
                </p>
              </div>
            </div>
            
            {/* Compact Score Display */}
            {(scoreA || scoreB) && (
              <div className="flex items-center gap-2">
            {matchStatus === 'live' && matchMinute != null && (
              <FootballTimer minute={matchMinute} seconds={footballSeconds} />
            )}
                {matchStatus === 'completed' && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">FT</Badge>
                )}
                <div className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-lg">
                  <img src={teamA.logo_url || ''} alt={teamA.short_name} className="w-5 h-5 object-contain" />
                  <span className="text-lg font-bold text-primary">{scoreA || '0'}</span>
                  <span className="text-muted-foreground text-sm">-</span>
                  <span className="text-lg font-bold text-primary">{scoreB || '0'}</span>
                  <img src={teamB.logo_url || ''} alt={teamB.short_name} className="w-5 h-5 object-contain" />
                </div>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs defaultValue="lineups" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="lineups" className="gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5" />
                Lineups
              </TabsTrigger>
              <TabsTrigger value="goals" className="gap-1.5 text-xs">
                <Goal className="w-3.5 h-3.5" />
                Goals
              </TabsTrigger>
              <TabsTrigger value="subs" className="gap-1.5 text-xs">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Subs
              </TabsTrigger>
            </TabsList>

            {/* Lineups Tab */}
            <TabsContent value="lineups">
              <div className="grid md:grid-cols-2 gap-4">
                {renderCompactPlayersList(teamAPlayers, teamA.name, teamA.logo_url)}
                {renderCompactPlayersList(teamBPlayers, teamB.name, teamB.logo_url)}
              </div>
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals">
              <div className="grid md:grid-cols-2 gap-4">
                {renderGoalsList(goalsTeamA, teamA.name, teamA.logo_url)}
                {renderGoalsList(goalsTeamB, teamB.name, teamB.logo_url)}
              </div>
            </TabsContent>

            {/* Substitutions Tab */}
            <TabsContent value="subs">
              <div className="grid md:grid-cols-2 gap-4">
                {renderCompactSubsList(teamASubs, teamA.name, teamA.logo_url)}
                {renderCompactSubsList(teamBSubs, teamB.name, teamB.logo_url)}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default FootballMatchDetails;