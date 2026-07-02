import { useActiveBanners, Banner } from "@/hooks/useSportsData";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Play, Clock, Radio, Zap, Timer, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePublicSiteSettings } from "@/hooks/usePublicSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { optimizeImage, optimizeSrcSet } from "@/lib/imageUrl";

// Hook to check which tournaments have live matches
const useTournamentLiveStatus = (tournamentIds: string[]) => {
  return useQuery({
    queryKey: ['tournament-live-status', tournamentIds],
    queryFn: async () => {
      if (tournamentIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('matches')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
        .eq('status', 'live')
        .eq('is_active', true);
      
      if (error) throw error;
      
      const liveMap: Record<string, boolean> = {};
      tournamentIds.forEach(id => { liveMap[id] = false; });
      data?.forEach(m => {
        if (m.tournament_id) liveMap[m.tournament_id] = true;
      });
      return liveMap;
    },
    enabled: tournamentIds.length > 0,
    refetchInterval: 30000,
  });
};

// Hook to get next upcoming match time for each tournament
const useTournamentNextMatch = (tournamentIds: string[]) => {
  return useQuery({
    queryKey: ['tournament-next-match', tournamentIds],
    queryFn: async () => {
      if (tournamentIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('matches')
        .select('tournament_id, match_date, match_time, match_start_time')
        .in('tournament_id', tournamentIds)
        .eq('status', 'upcoming')
        .eq('is_active', true)
        .order('match_date', { ascending: true })
        .order('match_time', { ascending: true });
      
      if (error) throw error;
      
      // For each tournament, find the earliest upcoming match
      const nextMatchMap: Record<string, Date> = {};
      data?.forEach(m => {
        if (!m.tournament_id) return;
        
        let matchDate: Date | null = null;
        if (m.match_start_time) {
          matchDate = new Date(m.match_start_time);
        } else if (m.match_date && m.match_time) {
          matchDate = new Date(`${m.match_date}T${m.match_time}`);
        }
        
        if (matchDate && !isNaN(matchDate.getTime())) {
          if (!nextMatchMap[m.tournament_id] || matchDate < nextMatchMap[m.tournament_id]) {
            nextMatchMap[m.tournament_id] = matchDate;
          }
        }
      });
      
      return nextMatchMap;
    },
    enabled: tournamentIds.length > 0,
    refetchInterval: 60000, // Refresh every minute
  });
};

// Countdown hook
const useCountdown = (targetDate: Date | null) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) { setTimeLeft(null); return; }

    const calc = () => {
      const now = new Date().getTime();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) { setTimeLeft(null); return; }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
};

// Countdown badge sub-component
const CountdownBadge = ({ targetDate }: { targetDate: Date }) => {
  const timeLeft = useCountdown(targetDate);

  if (!timeLeft) return null;

  const formatUnit = (val: number) => String(val).padStart(2, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md border border-primary/30 text-primary px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-lg"
    >
      <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
      <span className="text-[10px] sm:text-xs font-semibold tracking-wide uppercase text-primary/80">Next Match In</span>
      <div className="flex items-center gap-1">
        {timeLeft.days > 0 && (
          <span className="bg-primary/20 text-primary font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md font-mono tabular-nums">
            {timeLeft.days}d
          </span>
        )}
        <span className="bg-primary/20 text-primary font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md font-mono tabular-nums">
          {formatUnit(timeLeft.hours)}h
        </span>
        <span className="bg-primary/20 text-primary font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md font-mono tabular-nums">
          {formatUnit(timeLeft.minutes)}m
        </span>
        <span className="bg-primary/20 text-primary font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-md font-mono tabular-nums">
          {formatUnit(timeLeft.seconds)}s
        </span>
      </div>
    </motion.div>
  );
};

const BannerSlider = () => {
  const { data: banners, isLoading } = useActiveBanners();
  const { data: siteSettings } = usePublicSiteSettings();
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  // Collect tournament IDs from banners
  const tournamentIds = (banners || [])
    .filter(b => b.banner_type === 'tournament' && b.tournament_id)
    .map(b => b.tournament_id!)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  const { data: tournamentLiveMap } = useTournamentLiveStatus(tournamentIds);
  const { data: tournamentNextMatchMap } = useTournamentNextMatch(tournamentIds);

  // Get slider duration from settings (default 6 seconds)
  const sliderDuration = ((siteSettings as any)?.slider_duration_seconds || 6) * 1000;

  // Preload the next banner image so slide transitions are instant
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const nextIdx = (currentIndex + 1) % banners.length;
    const nextUrl = banners[nextIdx]?.image_url;
    if (nextUrl) {
      const img = new Image();
      img.src = optimizeImage(nextUrl, { width: 1600, quality: 70 });
    }
  }, [banners, currentIndex]);

  // Reset timer whenever currentIndex changes (including manual nav)
  // This ensures the full duration starts AFTER the slide is shown
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    
    const timeout = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, sliderDuration);

    return () => clearTimeout(timeout);
  }, [banners, sliderDuration, currentIndex]);

  if (isLoading || !banners || banners.length === 0) {
    // Reserve aspect-ratio space to prevent CLS while banners load.
    // If no banners exist at all after loading, still render an invisible
    // placeholder briefly — collapses via parent conditional if desired.
    if (isLoading) {
      return (
        <div className="relative w-full overflow-hidden rounded-2xl premium-shadow-lg aspect-[16/9] bg-muted/30" />
      );
    }
    return null;
  }

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const handleClick = (banner: Banner) => {
    if (banner.banner_type === 'match' && banner.match?.slug) {
      navigate(`/match/${banner.match.slug}`);
      return;
    }
    
    if (banner.banner_type === 'tournament' && banner.tournament?.slug) {
      navigate(`/tournament/${banner.tournament.slug}`);
      return;
    }
    
    if (banner.link_url) {
      if (banner.link_url.startsWith('/')) {
        navigate(banner.link_url);
      } else {
        window.open(banner.link_url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Check if banner has live content (match or tournament with live matches)
  const isBannerLive = (banner: Banner): boolean => {
    if (banner.banner_type === 'match' && banner.match?.status === 'live') {
      return true;
    }
    if (banner.banner_type === 'tournament' && banner.tournament_id && tournamentLiveMap) {
      return !!tournamentLiveMap[banner.tournament_id];
    }
    return false;
  };

  // Auto-determine badge based on status
  const getAutoBadge = (banner: Banner): Banner['badge_type'] => {
    // For match banners
    if (banner.banner_type === 'match' && banner.match) {
      const matchStatus = banner.match.status;
      if (matchStatus === 'live') return 'watch_now';
      if (matchStatus === 'upcoming') return 'upcoming';
      if (matchStatus === 'completed') return 'watch_now';
      return 'watch_now';
    }
    
    // For tournament banners - check live status
    if (banner.banner_type === 'tournament' && banner.tournament_id && tournamentLiveMap) {
      if (tournamentLiveMap[banner.tournament_id]) return 'watch_now';
      return 'upcoming';
    }
    
    // For custom banners, use manual badge
    return banner.badge_type || 'none';
  };

  // Get the next match date for a banner's tournament
  const getNextMatchDate = (banner: Banner): Date | null => {
    if (banner.banner_type === 'tournament' && banner.tournament_id && tournamentNextMatchMap) {
      return tournamentNextMatchMap[banner.tournament_id] || null;
    }
    if (banner.banner_type === 'match' && banner.match) {
      if (banner.match.match_start_time) return new Date(banner.match.match_start_time);
      if (banner.match.match_date && banner.match.match_time) {
        return new Date(`${banner.match.match_date}T${banner.match.match_time}`);
      }
    }
    return null;
  };

  const getBadgeContent = (badge: Banner['badge_type'], isLive: boolean, banner: Banner) => {
    switch (badge) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1.5 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            LIVE
          </span>
        );
      case 'upcoming': {
        const nextDate = getNextMatchDate(banner);
        if (nextDate) {
          return <CountdownBadge targetDate={nextDate} />;
        }
        return (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md border border-primary/30 text-primary px-4 py-2 rounded-xl text-sm font-semibold shadow-lg"
          >
            <Clock className="w-3.5 h-3.5" />
            Coming Soon
          </motion.span>
        );
      }
      case 'watch_now':
        return (
          <motion.button
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            className="group cursor-pointer"
          >
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] sm:text-xs font-semibold transition-all duration-300 ${
              isLive
                ? 'bg-destructive/90 text-destructive-foreground backdrop-blur-sm'
                : 'bg-primary/90 text-primary-foreground backdrop-blur-sm'
            }`}>
              <Tv className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Watch Now
              {isLive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive-foreground" />
                </span>
              )}
            </span>
          </motion.button>
        );
      default:
        return null;
    }
  };

  const getSubtitle = (banner: Banner) => {
    if (banner.subtitle) return banner.subtitle;
    
    if (banner.banner_type === 'match' && banner.match) {
      const match = banner.match;
      const sport = match.tournament?.sport || 'Cricket';
      const format = match.match_format || '';
      return [sport, format].filter(Boolean).join(' • ');
    }
    
    if (banner.banner_type === 'tournament' && banner.tournament) {
      return `${banner.tournament.sport} • ${banner.tournament.season || 'Series'}`;
    }
    
    return null;
  };

  const currentBanner = banners[currentIndex];
  const currentIsLive = isBannerLive(currentBanner);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl premium-shadow-lg">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => handleClick(currentBanner)}
          className="relative aspect-[16/9] cursor-pointer group"
        >
          {/* Background Image */}
          <img
            src={optimizeImage(currentBanner.image_url, { width: 1600, quality: 70 })}
            srcSet={optimizeSrcSet(currentBanner.image_url, 800, { quality: 70 })}
            sizes="100vw"
            alt={currentBanner.title}
            loading="eager"
            decoding="async"
            // @ts-expect-error - fetchpriority not yet in React types
            fetchpriority="high"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
          
          {/* LIVE Indicator - Top left for live banners */}
          {currentIsLive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20"
            >
              <div className="flex items-center gap-2 bg-destructive/95 backdrop-blur-sm text-destructive-foreground px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow-lg">
                {/* Animated pulse dot */}
                <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white"></span>
                </span>
                <span className="text-xs sm:text-sm font-bold tracking-wide">LIVE</span>
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
              </div>
            </motion.div>
          )}

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="max-w-xl"
            >
              {/* Title */}
              <h3 className="font-display text-xl sm:text-2xl md:text-4xl lg:text-5xl text-foreground tracking-wide mb-1 sm:mb-2 line-clamp-2">
                {currentBanner.title}
              </h3>
              
              {/* Subtitle */}
              {getSubtitle(currentBanner) && (
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                  {getSubtitle(currentBanner)}
                </p>
              )}
              
              {/* Badge Button */}
              {(() => {
                const autoBadge = getAutoBadge(currentBanner);
                return autoBadge && autoBadge !== 'none' ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                  >
                    {getBadgeContent(autoBadge, currentIsLive, currentBanner)}
                  </motion.div>
                ) : null;
              })()}
            </motion.div>
          </div>

          {/* Team Logos - only for match banners */}
          {currentBanner.banner_type === 'match' && currentBanner.match && (
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 md:top-8 md:right-8 hidden sm:flex items-center gap-3">
              {currentBanner.match.team_a?.logo_url && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-background/80 backdrop-blur p-2 shadow-lg"
                >
                  <img 
                    src={currentBanner.match.team_a.logo_url} 
                    alt={currentBanner.match.team_a.name}
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              )}
              <span className="text-foreground/60 text-sm font-medium">vs</span>
              {currentBanner.match.team_b?.logo_url && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 }}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-background/80 backdrop-blur p-2 shadow-lg"
                >
                  <img 
                    src={currentBanner.match.team_b.logo_url} 
                    alt={currentBanner.match.team_b.name}
                    className="w-full h-full object-contain"
                  />
                </motion.div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            className="absolute left-2 sm:left-4 top-4 sm:top-1/3 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-background transition-all hover:scale-110 shadow-lg z-10"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="absolute right-2 sm:right-4 top-4 sm:top-1/3 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground hover:bg-background transition-all hover:scale-110 shadow-lg z-10"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Pagination Dots */}
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentIndex 
                    ? 'bg-primary w-6 sm:w-8' 
                    : 'bg-foreground/30 hover:bg-foreground/50 w-2'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerSlider;
