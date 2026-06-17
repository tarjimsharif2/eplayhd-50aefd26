import { Match, useMatchInnings, GoalEvent } from "@/hooks/useSportsData";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, Star, Calendar } from "lucide-react";
import TossCoin from "@/components/TossCoin";
import InningsDisplay from "@/components/InningsDisplay";
import FlipClock from "@/components/FlipClock";
import FootballTimer from "@/components/FootballTimer";

import { useMatchToss } from "@/hooks/useMatchToss";
import { formatOvers } from "@/lib/utils";

interface MatchCardProps {
  match: Match;
  index?: number;
  effectiveStatus?: string; // Frontend-calculated status for display (handles stale data)
}

// Cricket format badges with colors
const CRICKET_FORMATS: Record<string, { label: string; color: string }> = {
  'test': { label: 'TEST', color: 'bg-red-600' },
  'odi': { label: 'ODI', color: 'bg-blue-600' },
  't20': { label: 'T20', color: 'bg-green-600' },
  't10': { label: 'T10', color: 'bg-purple-600' },
  'the_hundred': { label: 'THE HUNDRED', color: 'bg-orange-600' },
};

// Sport icon component that uses custom icon_url or fallback SVG
const SportIcon = ({ sport, iconUrl }: { sport: string; iconUrl?: string | null }) => {
  if (iconUrl) {
    return <img src={iconUrl} alt={sport} className="w-4 h-4 object-contain" />;
  }
  
  // Fallback SVG icons
  const sportLower = sport.toLowerCase();
  
  if (sportLower === 'cricket') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    );
  }
  
  if (sportLower.includes('football')) {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2l3 7h-6l3-7zM12 22l-3-7h6l-3 7zM2 12l7-3v6l-7-3zM22 12l-7 3v-6l7 3z" fill="currentColor"/>
      </svg>
    );
  }
  
  if (sportLower === 'tennis') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 3c-2 4-2 10 0 18M12 3c2 4 2 10 0 18M3 12h18" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    );
  }
  
  if (sportLower === 'basketball') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M12 2v20M2 12h20M4 6c4 1 8 1 16 0M4 18c4-1 8-1 16 0" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    );
  }
  
  // Default circle
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
};

// Helper to format date as "1st February 2026"
const formatDateOrdinal = (date: Date): string => {
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  
  // Get ordinal suffix (st, nd, rd, th)
  const getOrdinalSuffix = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };
  
  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
};

// Helper to check if date is today or tomorrow
const getDateLabel = (matchStartTime: string | null, matchDate: string): { label: string; isTodayOrTomorrow: boolean } => {
  let formattedDate = matchDate;
  let matchDateTime: Date | null = null;
  
  // Try to parse the date for formatting
  if (matchStartTime) {
    matchDateTime = new Date(matchStartTime);
    if (!isNaN(matchDateTime.getTime())) {
      formattedDate = formatDateOrdinal(matchDateTime);
    }
  } else if (matchDate) {
    // Try to parse matchDate string (format: YYYY-MM-DD or similar)
    const parsed = new Date(matchDate);
    if (!isNaN(parsed.getTime())) {
      formattedDate = formatDateOrdinal(parsed);
    }
  }
  
  if (!matchDateTime) {
    return { label: formattedDate, isTodayOrTomorrow: false };
  }

  const now = new Date();
  
  // Get start of today and tomorrow in local timezone
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get match date in local timezone
  const matchDay = new Date(matchDateTime.getFullYear(), matchDateTime.getMonth(), matchDateTime.getDate());

  if (matchDay.getTime() === today.getTime()) {
    return { label: 'Today', isTodayOrTomorrow: true };
  } else if (matchDay.getTime() === tomorrow.getTime()) {
    return { label: `Tomorrow`, isTodayOrTomorrow: true };
  }
  
  return { label: formattedDate, isTodayOrTomorrow: false };
};

const MatchCard = ({ match, index = 0, effectiveStatus }: MatchCardProps) => {
  const navigate = useNavigate();
  // Use effectiveStatus if provided, otherwise fall back to match.status
  const displayStatus = effectiveStatus || match.status;
  const [countdown, setCountdown] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("");
  const [footballSeconds, setFootballSeconds] = useState(0);
  const prevMinuteRef = useRef<number | null>(null);

  // Get date label (Today/Tomorrow/Date)
  const dateLabel = useMemo(() => getDateLabel(match.match_start_time, match.match_date), [match.match_start_time, match.match_date]);

  // Get cricket format info
  const cricketFormat = useMemo(() => {
    if (!match.match_format) return null;
    return CRICKET_FORMATS[match.match_format.toLowerCase()] || null;
  }, [match.match_format]);

  // Check if it's a cricket or football match - also consider cricket formats
  const sportName = match.sport?.name || match.tournament?.sport || 'Sport';
  const sportLower = sportName.toLowerCase();
  const hasCricketFormat = match.match_format && Object.keys(CRICKET_FORMATS).includes(match.match_format.toLowerCase());
  const isCricket = sportLower.includes('cricket') || hasCricketFormat;
  const isFootball = sportLower.includes('football') || sportLower.includes('soccer');

  // Fetch innings for cricket matches
  const { data: innings } = useMatchInnings(isCricket ? match.id : undefined);
  
  // Fetch toss for all cricket matches - show as soon as toss is published
  const shouldFetchToss = isCricket;
  const { parsedToss, toss: rawToss } = useMatchToss({ matchId: match.id, enabled: shouldFetchToss });

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
    setTimezone(tzAbbr);
  }, []);


  useEffect(() => {
    if (match.match_start_time) {
      const matchDate = new Date(match.match_start_time);
      
      setLocalTime(matchDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }));

      const updateCountdown = () => {
        const now = new Date();
        const diff = matchDate.getTime() - now.getTime();
        
      if (diff > 0 && diff <= 48 * 60 * 60 * 1000 && displayStatus === 'upcoming') {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        } else {
          setCountdown(null);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    } else {
      setLocalTime(match.match_time);
      setCountdown(null);
    }
  }, [match.match_start_time, match.match_time, displayStatus]);

  // Football seconds timer - counts locally between server minute updates
  useEffect(() => {
    if (!isFootball || displayStatus !== 'live' || match.match_minute == null) {
      setFootballSeconds(0);
      prevMinuteRef.current = null;
      return;
    }

    // Reset seconds when minute changes from server
    if (prevMinuteRef.current !== match.match_minute) {
      setFootballSeconds(0);
      prevMinuteRef.current = match.match_minute;
    }

    const interval = setInterval(() => {
      setFootballSeconds(prev => (prev >= 59 ? 59 : prev + 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isFootball, displayStatus, match.match_minute]);

  const getStatusVariant = (status: string, isStumps?: boolean) => {
    if (isStumps) return 'secondary';
    switch (status) {
      case 'live': return 'live';
      case 'completed': return 'completed';
      case 'abandoned': return 'abandoned';
      case 'postponed': return 'postponed';
      default: return 'upcoming';
    }
  };

  const getStatusText = (status: string, isStumps?: boolean) => {
    if (isStumps) return 'STUMPS';
    switch (status) {
      case 'live': return 'Live';
      case 'completed': return 'Completed';
      case 'abandoned': return 'Abandoned';
      case 'postponed': return 'Postponed';
      default: return 'Upcoming';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  // Parse score to extract runs/wickets and overs
  const parseScore = (score: string | null) => {
    if (!score) return null;
    // Match patterns like "179/4 (20 ov)" or "179/4 (20.3 ov)" or just "179/4"
    const oversMatch = score.match(/\((\d+\.?\d*)\s*ov\)/i);
    const cleanScore = score.replace(/\s*\(\d+\.?\d*\s*ov\)/i, '').trim();
    return {
      score: cleanScore,
      overs: oversMatch ? oversMatch[1] : null
    };
  };

  const teamA = match.team_a;
  const teamB = match.team_b;
  const tournament = match.tournament;
  const sport = match.sport;

  // Parse scores with overs
  const scoreA = parseScore(match.score_a);
  const scoreB = parseScore(match.score_b);

  if (!teamA || !teamB) {
    return null;
  }

  const handleClick = () => {
    if (match.page_type === 'page' && match.slug) {
      navigate(`/match/${match.slug}`);
    } else if (match.match_link) {
      window.open(match.match_link, '_blank', 'noopener,noreferrer');
    }
  };

  const isClickable = (match.page_type === 'page' && match.slug) || match.match_link;

  // Get sport icon URL
  const sportIconUrl = sport?.icon_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ 
        duration: 0.3, 
        delay: index * 0.05,
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      onClick={handleClick}
      className={`relative overflow-hidden rounded-2xl ${isClickable ? 'cursor-pointer' : ''} group`}
    >
      {/* Glassmorphism card */}
      <div className="relative bg-gradient-to-br from-card/95 via-card/85 to-card/75 backdrop-blur-xl border border-border/40 rounded-2xl overflow-hidden transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-xl group-hover:shadow-primary/15">
        
        {/* Hover glow effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        
        {/* Priority indicator */}
        {match.is_priority && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
        )}
        
        {/* Tournament Logo - Top Right */}
        {tournament?.logo_url && (
          <div className="absolute top-3 right-3 z-10">
            <div 
              className={`w-10 h-10 rounded-xl backdrop-blur-sm p-1 border shadow-lg ${
                (tournament as any).logo_background_color
                  ? 'border-border/30'
                  : 'bg-background/60 border-border/30'
              }`}
              style={(tournament as any).logo_background_color ? { backgroundColor: (tournament as any).logo_background_color } : undefined}
            >
              <img 
                src={tournament.logo_url} 
                alt={tournament.name}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Test Match Day Badge - Always show for Test matches */}
          {match.match_format?.toLowerCase() === 'test' && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge className="bg-red-600 text-white border-0 font-bold text-xs uppercase tracking-wider px-3 py-1.5 shadow-lg">
                TEST
              </Badge>
              {match.status !== 'upcoming' && (
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 font-bold text-sm uppercase tracking-wider px-4 py-2 shadow-lg">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Day {match.test_day || 1}
                </Badge>
              )}
            </div>
          )}
          
          {/* Other Cricket Format Badges (ODI, T20, etc.) - Not Test */}
          {isCricket && cricketFormat && match.match_format?.toLowerCase() !== 'test' && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <Badge className={`${cricketFormat.color} text-white border-0 font-bold text-xs uppercase tracking-wider px-3 py-1.5 shadow-lg`}>
                {cricketFormat.label}
              </Badge>
            </div>
          )}

          {/* Match Label Badge - Above Tournament Name */}
          {match.match_label && (
            <div className="flex justify-start mb-2">
              <Badge className="bg-gradient-to-r from-yellow-500/90 to-orange-500/90 text-white border-0 font-semibold text-xs uppercase tracking-wider px-3 py-1.5 shadow-lg">
                {match.match_label}
              </Badge>
            </div>
          )}

          {/* Tournament Header */}
          {tournament && (
            <div className="text-center mb-3 px-10">
              <h3 className="text-base md:text-lg font-semibold text-foreground/95 line-clamp-2 leading-tight">
                {tournament.name}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <div className="h-px w-8 bg-gradient-to-r from-transparent via-primary/40 to-primary/60" />
                <span className="text-xs text-primary font-semibold tracking-wide">{tournament.season}</span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent via-primary/40 to-primary/60" />
              </div>
            </div>
          )}

          {/* Sport Badge & Match Number */}
          <div className="flex items-center justify-between mb-3">
          <Badge variant="sport" className="gap-1.5 text-sm">
              {sportName}
            </Badge>
            <div className="flex items-center gap-2">
              {match.is_priority && (
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              )}
              {match.match_number && (
                <span className="text-muted-foreground text-xs font-medium bg-muted/40 px-3 py-1.5 rounded-full">
                  {(() => {
                    const num = match.match_number;
                    // Pure number: "5" -> "Match #5"
                    if (/^\d+$/.test(num)) {
                      return `Match #${num}`;
                    }
                    // Already formatted correctly: "Round #22" -> keep as is
                    if (/^(Round|Matchday|Week|Match)\s*#?\s*\d+$/i.test(num)) {
                      // Ensure # is present
                      return num.replace(/^(Round|Matchday|Week|Match)\s*#?\s*(\d+)$/i, '$1 #$2');
                    }
                    // Other text like "Final", "Semi-Final", etc
                    return num;
                  })()}
                </span>
              )}
            </div>
          </div>

          {/* Check if it's a football match */}
          {(() => {
            // Only show football scores for live/completed matches (not upcoming)
            // Hide scoreboard for manual-source matches unless explicitly enabled
            const isManualSource = ((match as any).score_source ?? 'manual') === 'manual';
            const manualScoreboardEnabled = !!(match as any).manual_scoreboard_enabled;
            const scoreboardAllowed = !isManualSource || manualScoreboardEnabled;
            const hasFootballScore = isFootball && scoreboardAllowed && (displayStatus === 'live' || displayStatus === 'completed');
            
            // Parse goal data from match - ensure arrays
            const goalsTeamA: GoalEvent[] = Array.isArray(match.goals_team_a) ? match.goals_team_a as GoalEvent[] : [];
            const goalsTeamB: GoalEvent[] = Array.isArray(match.goals_team_b) ? match.goals_team_b as GoalEvent[] : [];
            
            if (isFootball && hasFootballScore) {
              // Football Score Display - Horizontal layout with scores
              const formatTime = (min: number, sec: number) => {
                return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
              };
              
              return (
                <div className="py-3">
                  <div className="flex items-center justify-center gap-3">
                    {/* Team A with Score */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div 
                          className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center p-1.5 ${
                            teamA.logo_background_color 
                              ? 'border border-border/30' 
                              : 'bg-gradient-to-br from-primary/15 to-transparent border border-primary/20'
                          }`}
                          style={teamA.logo_background_color ? { backgroundColor: teamA.logo_background_color } : undefined}
                        >
                          {teamA.logo_url ? (
                            <img src={teamA.logo_url} alt={teamA.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="font-display text-base text-primary">{getInitials(teamA.name)}</span>
                          )}
                        </div>
                        <span className="font-medium text-foreground text-xs leading-tight text-center max-w-[80px] line-clamp-2">{teamA.name}</span>
                      </div>
                      {/* Score A */}
                      <span className="text-3xl md:text-4xl font-bold text-foreground">{match.score_a || '0'}</span>
                    </div>

                    {/* Score Separator with Match Status */}
                    <div className="flex flex-col items-center">
                      <span className="text-xl md:text-2xl font-bold text-muted-foreground/60">-</span>
                      {/* Live minute indicator */}
                      {displayStatus === 'live' && match.match_minute != null && (
                        <div className="mt-1">
                          <FootballTimer minute={match.match_minute} seconds={footballSeconds} />
                        </div>
                      )}
                      {/* Full Time indicator for completed matches */}
                      {displayStatus === 'completed' && (
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                          <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px] px-2 py-0.5 font-bold">
                            FT
                          </Badge>
                          {match.match_minute != null && match.match_minute > 0 && (
                            <span className="text-[10px] text-muted-foreground font-medium">{match.match_minute}'</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Team B with Score */}
                    <div className="flex items-center gap-3">
                      {/* Score B */}
                      <span className="text-3xl md:text-4xl font-bold text-foreground">{match.score_b || '0'}</span>
                      <div className="flex flex-col items-center gap-1">
                        <div 
                          className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center p-1.5 ${
                            teamB.logo_background_color 
                              ? 'border border-border/30' 
                              : 'bg-gradient-to-br from-primary/15 to-transparent border border-primary/20'
                          }`}
                          style={teamB.logo_background_color ? { backgroundColor: teamB.logo_background_color } : undefined}
                        >
                          {teamB.logo_url ? (
                            <img src={teamB.logo_url} alt={teamB.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="font-display text-base text-primary">{getInitials(teamB.name)}</span>
                          )}
                        </div>
                        <span className="font-medium text-foreground text-xs leading-tight text-center max-w-[80px] line-clamp-2">{teamB.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Goal Scorers Section */}
                  {(goalsTeamA.length > 0 || goalsTeamB.length > 0) && (
                    <div className="mt-3 pt-3 border-t border-border/20">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Team A Goals */}
                        <div className="space-y-1">
                          {goalsTeamA.map((goal: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1 text-muted-foreground">
                              <span className="text-green-500">⚽</span>
                              <span className="font-medium text-foreground truncate">{goal.player}</span>
                              <span className="text-primary/80">{goal.minute}</span>
                              {goal.assist && (
                                <span className="text-muted-foreground/70 truncate">({goal.assist})</span>
                              )}
                              {goal.type === 'penalty' && <span className="text-yellow-500">(P)</span>}
                              {goal.type === 'own_goal' && <span className="text-red-500">(OG)</span>}
                            </div>
                          ))}
                        </div>
                        {/* Team B Goals */}
                        <div className="space-y-1 text-right">
                          {goalsTeamB.map((goal: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1 justify-end text-muted-foreground">
                              {goal.type === 'penalty' && <span className="text-yellow-500">(P)</span>}
                              {goal.type === 'own_goal' && <span className="text-red-500">(OG)</span>}
                              {goal.assist && (
                                <span className="text-muted-foreground/70 truncate">({goal.assist})</span>
                              )}
                              <span className="text-primary/80">{goal.minute}</span>
                              <span className="font-medium text-foreground truncate">{goal.player}</span>
                              <span className="text-green-500">⚽</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            
            // Default layout for Cricket and other sports / upcoming matches
            return (
              <div className="flex items-center justify-between gap-1">
                {/* Team A */}
                <div className="flex-1 flex flex-col items-center text-center gap-1.5">
                  <div 
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center p-1.5 ${
                      teamA.logo_background_color 
                        ? 'border border-border/30' 
                        : 'bg-gradient-to-br from-primary/15 to-transparent border border-primary/20'
                    }`}
                    style={teamA.logo_background_color ? { backgroundColor: teamA.logo_background_color } : undefined}
                  >
                    {teamA.logo_url ? (
                      <img src={teamA.logo_url} alt={teamA.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="font-display text-lg text-primary">{getInitials(teamA.name)}</span>
                    )}
                  </div>
                  <span className="font-medium text-foreground text-xs md:text-sm leading-tight line-clamp-2">{teamA.name}</span>
                  {/* Only show scores for non-football OR live/completed football matches */}
                  {scoreA && (!isFootball || displayStatus === 'live' || displayStatus === 'completed') && (
                    <div className="flex flex-col items-center">
                      <span className="text-lg md:text-xl font-bold text-primary">{scoreA.score}</span>
                      {scoreA.overs && (
                        <span className="text-xs text-muted-foreground">({formatOvers(scoreA.overs)} ov)</span>
                      )}
                    </div>
                  )}
                </div>

                {/* VS / Countdown / Match Minute */}
                <div className="flex flex-col items-center gap-1 px-1">
                  {countdown ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[11px] text-primary uppercase tracking-widest font-bold">
                        Starts in
                      </span>
                      <FlipClock time={countdown} />
                    </div>
                  ) : displayStatus === 'live' && match.match_minute != null && isFootball ? (
                    <div className="flex flex-col items-center">
                      <FootballTimer minute={match.match_minute} seconds={footballSeconds} />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30">
                      <span className="font-display text-sm text-foreground/80">VS</span>
                    </div>
                  )}
                </div>

                {/* Team B */}
                <div className="flex-1 flex flex-col items-center text-center gap-1.5">
                  <div 
                    className={`w-14 h-14 md:w-16 md:h-16 rounded-xl flex items-center justify-center p-1.5 ${
                      teamB.logo_background_color 
                        ? 'border border-border/30' 
                        : 'bg-gradient-to-br from-primary/15 to-transparent border border-primary/20'
                    }`}
                    style={teamB.logo_background_color ? { backgroundColor: teamB.logo_background_color } : undefined}
                  >
                    {teamB.logo_url ? (
                      <img src={teamB.logo_url} alt={teamB.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="font-display text-lg text-primary">{getInitials(teamB.name)}</span>
                    )}
                  </div>
                  <span className="font-medium text-foreground text-xs md:text-sm leading-tight line-clamp-2">{teamB.name}</span>
                  {/* Only show scores for non-football OR live/completed football matches */}
                  {scoreB && (!isFootball || displayStatus === 'live' || displayStatus === 'completed') && (
                    <div className="flex flex-col items-center">
                      <span className="text-lg md:text-xl font-bold text-primary">{scoreB.score}</span>
                      {scoreB.overs && (
                        <span className="text-xs text-muted-foreground">({formatOvers(scoreB.overs)} ov)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {/* Innings Display for Cricket */}
          {isCricket && innings && innings.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <InningsDisplay innings={innings} teamAId={teamA.id} teamBId={teamB.id} compact={true} />
            </div>
          )}

          {/* Toss Info for Cricket */}
          {isCricket && (parsedToss || rawToss) && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <TossCoin size={18} />
                {parsedToss ? (
                  <span className="line-clamp-1">
                    <span className="font-medium text-foreground">{parsedToss.winner}</span>
                    {' elected to '}
                    <span className={`font-semibold ${parsedToss.decision === 'bat' ? 'text-green-500' : 'text-blue-500'}`}>
                      {parsedToss.decision === 'bat' ? 'Bat' : 'Bowl'}
                    </span>
                  </span>
                ) : (
                  <span className="line-clamp-1">{rawToss}</span>
                )}
              </div>
            </div>
          )}

          {/* Match Result for Completed Matches */}
          {displayStatus === 'completed' && match.match_result && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <div className="text-center">
                <span className="text-sm font-semibold text-primary">
                  {match.match_result === 'team_a_won' && (
                    <>
                      {teamA.name} Won
                      {match.result_margin && <span className="text-muted-foreground font-normal"> by {match.result_margin}</span>}
                    </>
                  )}
                  {match.match_result === 'team_b_won' && (
                    <>
                      {teamB.name} Won
                      {match.result_margin && <span className="text-muted-foreground font-normal"> by {match.result_margin}</span>}
                    </>
                  )}
                  {match.match_result === 'tied' && 'Match Tied'}
                  {match.match_result === 'draw' && 'Match Drawn'}
                  {match.match_result === 'no_result' && 'No Result'}
                </span>
              </div>
            </div>
          )}

          {/* Footer: Venue, Time & Status */}
          <div className="mt-3 pt-2 border-t border-border/30 flex flex-col items-center gap-1.5">
            {match.venue && (
              <p className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {match.venue}
              </p>
            )}
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-3.5 h-3.5" />
              <span className={dateLabel.isTodayOrTomorrow ? 'text-primary font-semibold' : ''}>
                {dateLabel.label}
              </span>
              <span>• {localTime || match.match_time}</span>
              <span className="text-primary font-medium">({timezone})</span>
            </div>
            <Badge variant={getStatusVariant(displayStatus, match.is_stumps)} className="px-4 py-1.5 text-sm">
              {displayStatus === 'live' && !match.is_stumps && (
                <span className="w-2 h-2 bg-current rounded-full mr-1.5 animate-pulse" />
              )}
              {match.is_stumps && (
                <span className="w-2 h-2 bg-slate-400 rounded-full mr-1.5" />
              )}
              {getStatusText(displayStatus, match.is_stumps)}
            </Badge>
          </div>
          
          {/* Click indicator for clickable cards */}
          {isClickable && (
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center backdrop-blur-sm border border-primary/30">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MatchCard;
