import { useParams } from 'react-router-dom';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VideoPlayer from '@/components/VideoPlayer';
import SEOHead from '@/components/SEOHead';
import AdSlot from '@/components/AdSlot';
import MultiAdSlot from '@/components/MultiAdSlot';
import PlayingXI from '@/components/PlayingXI';
import PointsTable from '@/components/PointsTable';
import ManualScoreCard from '@/components/ManualScoreCard';
import ApiCricketLiveScore from '@/components/ApiCricketLiveScore';
import SponsorNotice from '@/components/SponsorNotice';
import FootballMatchDetails from '@/components/FootballMatchDetails';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useStreamingServers, StreamingServer } from '@/hooks/useStreamingServers';
import { useMarkServerNotWorking, useMarkServerWorking } from '@/hooks/useStreamServerStatus';
import { usePreconnectServers } from '@/hooks/usePreconnectServers';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useRealtimeMatch } from '@/hooks/useRealtimeMatch';
import { supabase } from '@/integrations/supabase/client';
import { Match, GoalEvent } from '@/hooks/useSportsData';
import { MapPin, Clock, Calendar, Tv, Loader2, Radio, Trophy, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const MatchPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeServer, setActiveServer] = useState<StreamingServer | null>(null);
  const [localTime, setLocalTime] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('');
  const [hasPointsTable, setHasPointsTable] = useState(false);
  
  const { data: siteSettings } = useSiteSettings();
  const { data: publicSettings } = usePublicSiteSettings();
  const { data: servers, isLoading: serversLoading } = useStreamingServers(match?.id || '');
  // Warm up DNS/TLS for every server so switching is instant.
  usePreconnectServers((servers || []).map((s) => s.server_url));
  const markNotWorking = useMarkServerNotWorking();
  const markWorking = useMarkServerWorking();
  
  // Get match page ad positions
  const matchAdPositions = useMemo(() => {
    const positions = (publicSettings as any)?.match_page_ad_positions;
    return {
      before_player: positions?.before_player !== false,
      after_player: positions?.after_player !== false,
      sidebar: positions?.sidebar !== false,
      below_info: positions?.below_info !== false,
      after_servers: positions?.after_servers !== false,
      after_score: positions?.after_score !== false,
      before_scoreboard: positions?.before_scoreboard !== false,
      after_scoreboard: positions?.after_scoreboard !== false,
      before_playingxi: positions?.before_playingxi !== false,
      after_playingxi: positions?.after_playingxi !== false,
    };
  }, [publicSettings]);

  // Hide manual scoreboard by default; admins must opt-in per match
  const manualScoreboardOff = match
    ? (((match as any).score_source ?? 'manual') === 'manual') && !(match as any).manual_scoreboard_enabled
    : false;
  const displayScoreA = manualScoreboardOff ? null : match?.score_a;
  const displayScoreB = manualScoreboardOff ? null : match?.score_b;

  // Real-time updates for match and innings
  const { realtimeMatch } = useRealtimeMatch(match?.id);

  // Scroll to top when match page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
    setTimezone(tzAbbr);
  }, []);

  useEffect(() => {
    const fetchMatch = async () => {
      if (!slug) return;
      
      // First try to find by slug
      let { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          tournament:tournaments(*),
          team_a:teams!matches_team_a_id_fkey(*),
          team_b:teams!matches_team_b_id_fkey(*),
          sport:sports(*)
        `)
        .eq('slug', slug)
        .single();
      
      // If not found by slug, try by id (UUID)
      if (error || !data) {
        const { data: dataById, error: errorById } = await supabase
          .from('matches')
          .select(`
            *,
            tournament:tournaments(*),
            team_a:teams!matches_team_a_id_fkey(*),
            team_b:teams!matches_team_b_id_fkey(*),
            sport:sports(*)
          `)
          .eq('id', slug)
          .single();
        
        if (errorById || !dataById) {
          console.error('Error fetching match:', error || errorById);
          setLoading(false);
          return;
        }
        
        data = dataById;
      }
      
      setMatch(data as unknown as Match);
      setLoading(false);
    };

    fetchMatch();
  }, [slug]);

  // Check if points table exists for this tournament
  useEffect(() => {
    const checkPointsTable = async () => {
      if (!match?.tournament?.id) {
        setHasPointsTable(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('tournament_points_table')
        .select('id')
        .eq('tournament_id', match.tournament.id)
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setHasPointsTable(true);
      } else {
        setHasPointsTable(false);
      }
    };
    
    checkPointsTable();
  }, [match?.tournament?.id]);

  // Apply real-time updates to match state
  useEffect(() => {
    if (realtimeMatch && match) {
      setMatch(prev => prev ? { ...prev, ...realtimeMatch } as Match : prev);
    }
  }, [realtimeMatch]);

  useEffect(() => {
    if (match?.match_start_time) {
      const matchDate = new Date(match.match_start_time);
      setLocalTime(matchDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }));
    } else if (match?.match_time) {
      setLocalTime(match.match_time);
    }
  }, [match]);

  useEffect(() => {
    if (servers && servers.length > 0 && !activeServer) {
      setActiveServer(servers[0]);
    }
  }, [servers, activeServer]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-3xl text-gradient mb-4">Match Not Found</h1>
            <p className="text-muted-foreground">The match you're looking for doesn't exist.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const teamA = match.team_a;
  const teamB = match.team_b;
  const tournament = match.tournament;
  const sport = match.sport;
  
  // Check if it's a football match
  const sportName = sport?.name?.toLowerCase() || tournament?.sport?.toLowerCase() || '';
  const isFootball = sportName.includes('football') || sportName.includes('soccer');
  
  // Parse goals from JSON
  const parseGoals = (goals: unknown): GoalEvent[] => {
    if (Array.isArray(goals)) return goals as GoalEvent[];
    return [];
  };
  
  const goalsTeamA = parseGoals(match.goals_team_a);
  const goalsTeamB = parseGoals(match.goals_team_b);

  // SEO data
  const seoTitle = match.seo_title || `${teamA?.name} vs ${teamB?.name} Live Stream - ${siteSettings?.site_name || 'Live Sports'}`;
  const seoDescription = match.seo_description || `Watch ${teamA?.name} vs ${teamB?.name} live stream online. ${tournament?.name || ''} match on ${match.match_date}.`;
  const seoKeywords = (match as any).seo_keywords || `${teamA?.name}, ${teamB?.name}, live stream, ${sport?.name || 'sports'}, ${tournament?.name || ''}`;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'live': return 'live';
      case 'completed': return 'completed';
      default: return 'upcoming';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live': return 'Live Now';
      case 'completed': return 'Completed';
      default: return 'Upcoming';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead 
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        type="article"
      />
      <Header />
      
      {/* Header Ad */}
      <AdSlot position="header" className="container mx-auto px-4 py-2" />
      
      <main className="flex-1 py-6">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Sponsor Notice - Before Stream */}
          <SponsorNotice position="before_stream" matchId={match.id} />

          {/* Video Player Section - FIRST */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#120a1a]/60 backdrop-blur-xl ring-1 ring-inset ring-white/10 shadow-2xl">
              <CardContent className="p-0">
                {activeServer ? (
                  <VideoPlayer 
                    key={`${activeServer.id}-${activeServer.server_type}`}
                    url={activeServer.server_url} 
                    type={activeServer.server_type}
                    headers={{
                      referer: activeServer.referer_value,
                      origin: activeServer.origin_value,
                      cookie: activeServer.cookie_value,
                      userAgent: activeServer.user_agent,
                    }}
                    onStreamError={() => {
                      // Mark this server as not working - moves to end of list
                      markNotWorking.mutate(activeServer.id);
                    }}
                    onStreamSuccess={() => {
                      // Mark this server as working - restores original position
                      markWorking.mutate(activeServer.id);
                    }}
                  />
                ) : serversLoading ? (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Loader2 className="w-12 h-12 mx-auto mb-3 animate-spin opacity-70" />
                      <p>Loading streaming servers...</p>
                    </div>
                  </div>
                ) : (publicSettings as any)?.default_iframe_url ? (
                  <VideoPlayer
                    key="default-iframe"
                    url={(publicSettings as any).default_iframe_url}
                    type="iframe"
                  />
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No streaming servers available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sponsor Notice - Before Servers */}
          <SponsorNotice position="before_servers" matchId={match.id} />

          {/* Server Selection */}
          {servers && servers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between px-1 mb-3">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Select Feed</h3>
                <span className="text-[9px] text-primary font-bold tracking-tighter uppercase">{servers.length} Streams Available</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {servers.map((server) => {
                  const isActive = activeServer?.id === server.id;
                  return (
                    <button
                      key={server.id}
                      onClick={() => setActiveServer(server)}
                      className={cn(
                        "relative h-12 rounded-xl px-2 flex flex-col items-center justify-center text-[10px] font-bold uppercase tracking-tight transition-all active:scale-[0.97]",
                        isActive
                          ? "bg-primary text-primary-foreground border-t border-white/30 shadow-lg shadow-primary/40"
                          : "bg-white/[0.04] border border-white/10 text-foreground/70 hover:bg-white/[0.08] hover:text-foreground"
                      )}
                    >
                      <span className="truncate max-w-full">{server.server_name}</span>
                      {isActive && (
                        <span className="mt-0.5 text-[8px] font-medium tracking-widest text-white/70 leading-none">HD LIVE</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Ad - After Servers */}
          {matchAdPositions.after_servers && (
            <MultiAdSlot position="match_after_servers" className="my-4" />
          )}

          {/* Sponsor Notice - Before Scoreboard */}
          <SponsorNotice position="before_scoreboard" matchId={match.id} />

          {/* Ad - Before Scoreboard */}
          {matchAdPositions.before_scoreboard && (
            <MultiAdSlot position="match_before_scoreboard" className="my-4" />
          )}

          {/* Live Score from API Cricket or ESPN - Now positioned under server selection */}
          {((match as any)?.score_source === 'api_cricket' || (match as any)?.score_source === 'espn' || match?.api_score_enabled) && match.team_a && match.team_b && (
            <ApiCricketLiveScore
              teamAName={match.team_a.name}
              teamBName={match.team_b.name}
              teamALogo={match.team_a.logo_url}
              teamBLogo={match.team_b.logo_url}
              enabled={true}
              matchId={match.id}
              matchStatus={match.status}
            />
          )}

          {/* Ad - After Score */}
          {matchAdPositions.after_score && (
            <MultiAdSlot position="match_after_score" className="my-4" />
          )}

          {/* Football Match Details - Lineups, Goals, Substitutions */}
          {isFootball && teamA && teamB && (
            <FootballMatchDetails
              matchId={match.id}
              teamA={teamA}
              teamB={teamB}
              goalsTeamA={goalsTeamA}
              goalsTeamB={goalsTeamB}
              scoreA={displayScoreA}
              scoreB={displayScoreB}
              matchMinute={match.match_minute}
              matchStatus={match.status}
            />
          )}

          {/* View Points Table Button - before Playing XI */}
          {hasPointsTable && tournament?.id && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="my-4"
            >
              <button
                onClick={() => {
                  document.getElementById('points-table-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors group"
              >
                <Trophy className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">View Points Table</span>
                <ChevronDown className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" />
              </button>
            </motion.div>
          )}

          {/* Ad - Before Playing XI */}
          {matchAdPositions.before_playingxi && (
            <MultiAdSlot position="match_before_playingxi" className="my-4" />
          )}

          {/* Playing XI Section - For non-football matches (only if show_playing_xi is enabled) */}
          {!isFootball && teamA && teamB && (match as any).show_playing_xi && (
            <>
              <PlayingXI
                matchId={match.id}
                teamAId={teamA.id}
                teamBId={teamB.id}
                teamAName={teamA.name}
                teamBName={teamB.name}
                teamALogo={teamA.logo_url}
                teamBLogo={teamB.logo_url}
              />
              {/* Ad - After Playing XI */}
              {matchAdPositions.after_playingxi && (
                <MultiAdSlot position="match_after_playingxi" className="my-4" />
              )}
            </>
          )}

          {/* Score Card - Shows innings data (always shown for cricket) */}
          {/* If Points Table exists, show AFTER points table. Otherwise show here */}
          {sport?.name?.toLowerCase().includes('cricket') && teamA && teamB && !hasPointsTable && (
            <ManualScoreCard 
              matchId={match.id}
              teamAId={teamA.id}
              teamBId={teamB.id}
              matchStatus={match.status}
              isPrimary={true}
              matchResult={match.match_result}
              teamAName={teamA.name}
              teamBName={teamB.name}
              matchFormat={match.match_format}
              testDay={match.test_day}
              isStumps={match.is_stumps}
              stumpsTime={match.stumps_time}
              nextDayStart={match.next_day_start}
              dayStartTime={match.day_start_time}
            />
          )}

          {/* Ad - After Scoreboard */}
          {matchAdPositions.after_scoreboard && (
            <MultiAdSlot position="match_after_scoreboard" className="my-4" />
          )}

          {/* Sidebar Ad - Desktop Only */}
          {matchAdPositions.sidebar && (
            <div className="hidden lg:block my-6">
              <MultiAdSlot position="match_sidebar" fallbackPosition="sidebar" className="sticky top-4" />
            </div>
          )}

          {/* Match Header Card - Show here ONLY if no Points Table exists */}
          {!hasPointsTable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-xl shadow-2xl">
                <CardContent className="p-6 relative">
                  {/* Status badge - top right */}
                  <div className="absolute top-5 right-5 z-10">
                    <Badge variant={getStatusVariant(match.status)} className="rounded-full text-[10px] font-black uppercase tracking-widest px-3 py-1 shadow-lg">
                      {match.status === 'live' && <span className="w-1.5 h-1.5 bg-current rounded-full mr-1.5 animate-pulse" />}
                      {getStatusText(match.status)}
                    </Badge>
                  </div>

                  {/* Tournament kicker */}
                  <div className="mb-8 flex items-center gap-3">
                    {tournament?.logo_url && (
                      <div
                        className={`w-9 h-9 rounded-lg p-1 border border-white/10 flex items-center justify-center flex-shrink-0 ${
                          (tournament as any)?.logo_background_color ? '' : 'bg-white/5'
                        }`}
                        style={(tournament as any)?.logo_background_color ? { backgroundColor: (tournament as any).logo_background_color } : undefined}
                      >
                        <img src={tournament.logo_url} alt={tournament.name} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-primary truncate">{tournament?.name || 'Match'}</div>
                      <p className="text-xs text-muted-foreground/70 font-medium tracking-wide truncate">{sport?.name}{tournament?.season ? ` • ${tournament.season}` : ''}</p>
                    </div>
                  </div>

                  {/* Teams Section */}
                  <div className="flex items-center justify-between gap-2 py-2">
                    <div className="flex-1 flex flex-col items-center text-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/25 blur-2xl rounded-full" />
                        <div
                          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center p-2 border border-white/10 ${
                            teamA?.logo_background_color ? '' : 'bg-white/5 backdrop-blur-sm'
                          }`}
                          style={teamA?.logo_background_color ? { backgroundColor: teamA.logo_background_color } : undefined}
                        >
                          {teamA?.logo_url ? (
                            <img src={teamA.logo_url} alt={teamA.name} className="w-14 h-14 md:w-16 md:h-16 object-contain" />
                          ) : (
                            <span className="font-display text-2xl text-primary">{teamA?.short_name}</span>
                          )}
                        </div>
                      </div>
                      <h1 className="text-sm md:text-base font-bold tracking-tight uppercase break-words text-center leading-tight">{teamA?.name}</h1>
                      {displayScoreA && <span className="text-2xl font-black text-primary">{displayScoreA}</span>}
                    </div>

                    <div className="flex flex-col items-center justify-center px-2 shrink-0">
                      <span className="font-display italic text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground/80 to-foreground/20">vs</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center text-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-pink-500/25 blur-2xl rounded-full" />
                        <div
                          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center p-2 border border-white/10 ${
                            teamB?.logo_background_color ? '' : 'bg-white/5 backdrop-blur-sm'
                          }`}
                          style={teamB?.logo_background_color ? { backgroundColor: teamB.logo_background_color } : undefined}
                        >
                          {teamB?.logo_url ? (
                            <img src={teamB.logo_url} alt={teamB.name} className="w-14 h-14 md:w-16 md:h-16 object-contain" />
                          ) : (
                            <span className="font-display text-2xl text-primary">{teamB?.short_name}</span>
                          )}
                        </div>
                      </div>
                      <h1 className="text-sm md:text-base font-bold tracking-tight uppercase break-words text-center leading-tight">{teamB?.name}</h1>
                      {displayScoreB && <span className="text-2xl font-black text-primary">{displayScoreB}</span>}
                    </div>
                  </div>

                  {/* Goal Scorers for Football */}
                  {isFootball && (goalsTeamA.length > 0 || goalsTeamB.length > 0) && (
                    <div className="pt-4 mt-4 border-t border-border/30">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Team A Goals */}
                        {goalsTeamA.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {teamA?.logo_url && <img src={teamA.logo_url} className="w-4 h-4 object-contain" />}
                              <span>{teamA?.short_name || teamA?.name}</span>
                            </div>
                            {goalsTeamA.map((goal, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="text-green-500">⚽</span>
                                <span className="font-medium">{goal.player}</span>
                                <span className="text-primary">{goal.minute}</span>
                                {goal.type === 'penalty' && <span className="text-yellow-500 text-xs">(P)</span>}
                                {goal.type === 'own_goal' && <span className="text-red-500 text-xs">(OG)</span>}
                                {goal.assist && <span className="text-muted-foreground text-xs">({goal.assist})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Team B Goals */}
                        {goalsTeamB.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {teamB?.logo_url && <img src={teamB.logo_url} className="w-4 h-4 object-contain" />}
                              <span>{teamB?.short_name || teamB?.name}</span>
                            </div>
                            {goalsTeamB.map((goal, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="text-green-500">⚽</span>
                                <span className="font-medium">{goal.player}</span>
                                <span className="text-primary">{goal.minute}</span>
                                {goal.type === 'penalty' && <span className="text-yellow-500 text-xs">(P)</span>}
                                {goal.type === 'own_goal' && <span className="text-red-500 text-xs">(OG)</span>}
                                {goal.assist && <span className="text-muted-foreground text-xs">({goal.assist})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Match Info Footer */}
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border/30 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{match.match_date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{localTime}</span>
                      <span className="text-primary font-medium">({timezone})</span>
                    </div>
                    {match.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>{match.venue}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* In-Article Ad - After Match Header */}
          <AdSlot position="in_article" className="my-6" />

          {/* Points Table Section */}
          {tournament?.id && (
            <div id="points-table-section" className="mt-6 scroll-mt-20">
              <PointsTable tournamentId={tournament.id} tournamentName={tournament.name} syncTime={(tournament as any).points_table_sync_time} dailySyncEnabled={(tournament as any).points_table_daily_sync_enabled} onCompleteSyncEnabled={(tournament as any).points_table_on_complete_sync_enabled} />
            </div>
          )}

          {/* Sidebar Ad - After Points Table */}
          <div className="hidden lg:block my-6">
            <AdSlot position="sidebar" className="sticky top-4" />
          </div>

          {/* Match Header Card - Show AFTER Points Table if Points Table exists */}
          {hasPointsTable && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6"
            >
              <Card className="relative overflow-hidden rounded-3xl border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent backdrop-blur-xl shadow-2xl">
                <CardContent className="p-6 relative">
                  <div className="absolute top-5 right-5 z-10">
                    <Badge variant={getStatusVariant(match.status)} className="rounded-full text-[10px] font-black uppercase tracking-widest px-3 py-1 shadow-lg">
                      {match.status === 'live' && <span className="w-1.5 h-1.5 bg-current rounded-full mr-1.5 animate-pulse" />}
                      {getStatusText(match.status)}
                    </Badge>
                  </div>
                  <div className="mb-8 flex items-center gap-3">
                    {tournament?.logo_url && (
                      <div
                        className={`w-9 h-9 rounded-lg p-1 border border-white/10 flex items-center justify-center flex-shrink-0 ${
                          (tournament as any)?.logo_background_color ? '' : 'bg-white/5'
                        }`}
                        style={(tournament as any)?.logo_background_color ? { backgroundColor: (tournament as any).logo_background_color } : undefined}
                      >
                        <img src={tournament.logo_url} alt={tournament.name} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-primary truncate">{tournament?.name || 'Match'}</div>
                      <p className="text-xs text-muted-foreground/70 font-medium tracking-wide truncate">{sport?.name}{tournament?.season ? ` • ${tournament.season}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-2">
                    <div className="flex-1 flex flex-col items-center text-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/25 blur-2xl rounded-full" />
                        <div
                          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center p-2 border border-white/10 ${
                            teamA?.logo_background_color ? '' : 'bg-white/5 backdrop-blur-sm'
                          }`}
                          style={teamA?.logo_background_color ? { backgroundColor: teamA.logo_background_color } : undefined}
                        >
                          {teamA?.logo_url ? (
                            <img src={teamA.logo_url} alt={teamA.name} className="w-14 h-14 md:w-16 md:h-16 object-contain" />
                          ) : (
                            <span className="font-display text-2xl text-primary">{teamA?.short_name}</span>
                          )}
                        </div>
                      </div>
                      <h1 className="text-sm md:text-base font-bold tracking-tight uppercase break-words text-center leading-tight">{teamA?.name}</h1>
                      {displayScoreA && <span className="text-2xl font-black text-primary">{displayScoreA}</span>}
                    </div>
                    <div className="flex flex-col items-center justify-center px-2 shrink-0">
                      <span className="font-display italic text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground/80 to-foreground/20">vs</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center text-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-pink-500/25 blur-2xl rounded-full" />
                        <div
                          className={`relative w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center p-2 border border-white/10 ${
                            teamB?.logo_background_color ? '' : 'bg-white/5 backdrop-blur-sm'
                          }`}
                          style={teamB?.logo_background_color ? { backgroundColor: teamB.logo_background_color } : undefined}
                        >
                          {teamB?.logo_url ? (
                            <img src={teamB.logo_url} alt={teamB.name} className="w-14 h-14 md:w-16 md:h-16 object-contain" />
                          ) : (
                            <span className="font-display text-2xl text-primary">{teamB?.short_name}</span>
                          )}
                        </div>
                      </div>
                      <h1 className="text-sm md:text-base font-bold tracking-tight uppercase break-words text-center leading-tight">{teamB?.name}</h1>
                      {displayScoreB && <span className="text-2xl font-black text-primary">{displayScoreB}</span>}
                    </div>
                  </div>

                  {/* Goal Scorers for Football */}
                  {isFootball && (goalsTeamA.length > 0 || goalsTeamB.length > 0) && (
                    <div className="pt-4 mt-4 border-t border-border/30">
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Team A Goals */}
                        {goalsTeamA.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {teamA?.logo_url && <img src={teamA.logo_url} className="w-4 h-4 object-contain" />}
                              <span>{teamA?.short_name || teamA?.name}</span>
                            </div>
                            {goalsTeamA.map((goal, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="text-green-500">⚽</span>
                                <span className="font-medium">{goal.player}</span>
                                <span className="text-primary">{goal.minute}</span>
                                {goal.type === 'penalty' && <span className="text-yellow-500 text-xs">(P)</span>}
                                {goal.type === 'own_goal' && <span className="text-red-500 text-xs">(OG)</span>}
                                {goal.assist && <span className="text-muted-foreground text-xs">({goal.assist})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Team B Goals */}
                        {goalsTeamB.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {teamB?.logo_url && <img src={teamB.logo_url} className="w-4 h-4 object-contain" />}
                              <span>{teamB?.short_name || teamB?.name}</span>
                            </div>
                            {goalsTeamB.map((goal, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="text-green-500">⚽</span>
                                <span className="font-medium">{goal.player}</span>
                                <span className="text-primary">{goal.minute}</span>
                                {goal.type === 'penalty' && <span className="text-yellow-500 text-xs">(P)</span>}
                                {goal.type === 'own_goal' && <span className="text-red-500 text-xs">(OG)</span>}
                                {goal.assist && <span className="text-muted-foreground text-xs">({goal.assist})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Match Info Footer */}
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border/30 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{match.match_date}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{localTime}</span>
                      <span className="text-primary font-medium">({timezone})</span>
                    </div>
                    {match.venue && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>{match.venue}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Score Card - Shows innings data AFTER Match Header */}
          {sport?.name?.toLowerCase().includes('cricket') && teamA && teamB && hasPointsTable && (
            <div className="mt-6">
              <ManualScoreCard 
                matchId={match.id}
                teamAId={teamA.id}
                teamBId={teamB.id}
                matchStatus={match.status}
                isPrimary={true}
                matchResult={match.match_result}
                teamAName={teamA.name}
                teamBName={teamB.name}
                matchFormat={match.match_format}
                testDay={match.test_day}
                isStumps={match.is_stumps}
                stumpsTime={match.stumps_time}
                nextDayStart={match.next_day_start}
                dayStartTime={match.day_start_time}
              />
            </div>
          )}

        </div>
      </main>

      {/* Footer Ad */}
      <AdSlot position="footer" className="container mx-auto px-4 py-2" />

      <Footer />
    </div>
  );
};

export default MatchPage;
