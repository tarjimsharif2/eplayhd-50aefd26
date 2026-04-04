import { useMatches, useSports } from "@/hooks/useSportsData";
import { usePublicSiteSettings } from "@/hooks/usePublicSiteSettings";
import MatchCard from "@/components/MatchCard";
import MatchFilters, { MatchFilter } from "@/components/MatchFilters";
import BannerSlider from "@/components/BannerSlider";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

const MatchList = () => {
  const { data: matches, isLoading, error } = useMatches();
  const { data: sports } = useSports();
  const { data: publicSettings } = usePublicSiteSettings();
  const [activeFilter, setActiveFilter] = useState<MatchFilter>('all');
  const [activeSportFilter, setActiveSportFilter] = useState<string>('all');

  // Get configurable days for completed matches (default to 2)
  const completedMatchDays = publicSettings?.homepage_completed_days || 2;

  // Filter and sort matches: Live first, then upcoming, then completed - sorted by match start time
  const filteredMatches = useMemo(() => {
    if (!matches) return [];

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - completedMatchDays * 24 * 60 * 60 * 1000);

    // Helper function to get sort priority based on status and stumps
    const getStatusPriority = (status: string, isStumps?: boolean | null) => {
      if (status === 'live' && !isStumps) return 0; // Live matches first
      if (status === 'live' && isStumps) return 1;   // STUMPS matches after live
      if (status === 'postponed') return 2;          // Postponed before upcoming
      if (status === 'upcoming') return 3;
      if (status === 'completed' || status === 'abandoned') return 4;
      return 5;
    };

    // Helper function to parse match date/time into a Date object
    const parseMatchDateTime = (matchDate: string, matchTime: string, matchStartTime: string | null): Date => {
      // Use match_start_time if available (it's already a timestamp)
      if (matchStartTime) {
        return new Date(matchStartTime);
      }
      
      // Otherwise, try to parse from match_date and match_time
      try {
        const dateMatch = matchDate.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          const monthMap: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
          };
          const monthNum = monthMap[month.toLowerCase()];
          
          // Parse time like "7:30 PM IST" or "19:30"
          let hours = 0;
          let minutes = 0;
          const timeMatch = matchTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (timeMatch) {
            hours = parseInt(timeMatch[1]);
            minutes = parseInt(timeMatch[2]);
            const period = timeMatch[3]?.toUpperCase();
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
          }
          
          return new Date(parseInt(year), monthNum, parseInt(day), hours, minutes);
        }
      } catch {
        // Fall back to current time if parsing fails
      }
      return new Date();
    };

    // Helper function to check if a match should be treated as completed (frontend fallback)
    // IMPORTANT: Match server-side logic in update-match-status edge function
    // - For Cricket: Only use EXPLICIT end time or duration
    // - For Football: Use default 120 minutes if no explicit duration
    const shouldBeCompleted = (match: typeof matches[0]): boolean => {
      // If manual override is enabled, trust the database status
      if (match.manual_status_override) {
        return false;
      }
      
      // If match_end_time exists and has passed, treat as completed
      if (match.match_end_time) {
        const endTime = new Date(match.match_end_time);
        if (endTime < now) return true;
      }
      
      // Calculate using duration
      if (match.match_start_time && match.match_format !== 'test') {
        const startTime = new Date(match.match_start_time);
        
        // Use explicit duration, or sport-based default for football only
        let durationMinutes = match.match_duration_minutes;
        if (!durationMinutes) {
          const sportName = match.sport?.name?.toLowerCase() || '';
          if (sportName.includes('football') || sportName.includes('soccer')) {
            durationMinutes = 120; // 2 hours for football
          }
        }
        
        if (durationMinutes) {
          const expectedEnd = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
          if (expectedEnd < now) return true;
        }
      }
      
      return false;
    };

    // Helper function to get effective status (frontend fallback for stale data)
    const getEffectiveStatus = (match: typeof matches[0]): string => {
      // If DB says completed/abandoned, trust it
      if (match.status === 'completed' || match.status === 'abandoned') {
        return match.status;
      }
      
      // Frontend fallback: If match should be completed but status is still live/upcoming
      if ((match.status === 'live' || match.status === 'upcoming') && shouldBeCompleted(match)) {
        return 'completed';
      }
      
      return match.status;
    };

    const filtered = matches.filter((match) => {
      // Filter out inactive matches
      if (match.is_active === false) return false;

      // Get effective status (with frontend fallback for stale data)
      const effectiveStatus = getEffectiveStatus(match);

      // Hide completed/abandoned matches older than configured days
      if (effectiveStatus === 'completed' || effectiveStatus === 'abandoned') {
        try {
          let matchDate: Date | null = null;
          
          // Try ISO format first (YYYY-MM-DD)
          const isoMatch = match.match_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) {
            const [, year, month, day] = isoMatch;
            matchDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            // Try text format (e.g., "27th January 2026")
            const dateMatch = match.match_date.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
            if (dateMatch) {
              const [, day, month, year] = dateMatch;
              const monthMap: Record<string, number> = {
                january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
                july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
              };
              matchDate = new Date(parseInt(year), monthMap[month.toLowerCase()], parseInt(day));
            }
          }
          
          if (matchDate && matchDate < cutoffDate) return false;
        } catch {
          // Keep match if date parsing fails
        }
      }

      // Apply sport filter
      if (activeSportFilter !== 'all') {
        const matchSportName = match.sport?.name || match.tournament?.sport;
        if (matchSportName?.toLowerCase() !== activeSportFilter.toLowerCase()) return false;
      }

      // Apply status filter using effective status
      if (activeFilter === 'all') return true;
      // STUMPS matches should show in live filter
      if (activeFilter === 'live') {
        return effectiveStatus === 'live';
      }
      // Abandoned matches show in completed filter
      if (activeFilter === 'completed') {
        return effectiveStatus === 'completed' || effectiveStatus === 'abandoned';
      }
      // Postponed matches show in upcoming filter
      if (activeFilter === 'upcoming') {
        return effectiveStatus === 'upcoming' || effectiveStatus === 'postponed';
      }
      return effectiveStatus === activeFilter;
    });

    // Sort: Priority first, then Live, then postponed, then upcoming, then completed/abandoned - all sorted by start time
    return filtered.sort((a, b) => {
      // First, priority matches always come first
      if (a.is_priority && !b.is_priority) return -1;
      if (!a.is_priority && b.is_priority) return 1;

      // Get effective status for sorting
      const effectiveStatusA = getEffectiveStatus(a);
      const effectiveStatusB = getEffectiveStatus(b);

      // Then sort by status priority (considering stumps)
      const priorityDiff = getStatusPriority(effectiveStatusA, a.is_stumps) - getStatusPriority(effectiveStatusB, b.is_stumps);
      if (priorityDiff !== 0) return priorityDiff;

      // Within same status, sort by match start time
      const dateA = parseMatchDateTime(a.match_date, a.match_time, a.match_start_time);
      const dateB = parseMatchDateTime(b.match_date, b.match_time, b.match_start_time);
      
      // For live, postponed, and upcoming matches, sort by start time (earliest first)
      // For completed/abandoned, show most recent first
      if (effectiveStatusA === 'live' || effectiveStatusA === 'upcoming' || effectiveStatusA === 'postponed') {
        return dateA.getTime() - dateB.getTime();
      }
      return dateB.getTime() - dateA.getTime();
    });
  }, [matches, activeFilter, activeSportFilter, completedMatchDays]);

  // Get unique sports that have matches (for sport filter) - sorted by display_order
  const sportsWithMatches = useMemo(() => {
    if (!matches) return [];
    
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - completedMatchDays * 24 * 60 * 60 * 1000);
    
    const sportSet = new Set<string>();
    
    matches.forEach((match) => {
      // Filter out inactive matches
      if (match.is_active === false) return;

      // Skip completed/abandoned matches older than configured days
      if (match.status === 'completed' || match.status === 'abandoned') {
        try {
          let matchDate: Date | null = null;
          
          // Try ISO format first (YYYY-MM-DD)
          const isoMatch = match.match_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) {
            const [, year, month, day] = isoMatch;
            matchDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            // Try text format (e.g., "27th January 2026")
            const dateMatch = match.match_date.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
            if (dateMatch) {
              const [, day, month, year] = dateMatch;
              const monthMap: Record<string, number> = {
                january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
                july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
              };
              matchDate = new Date(parseInt(year), monthMap[month.toLowerCase()], parseInt(day));
            }
          }
          
          if (matchDate && matchDate < cutoffDate) return;
        } catch {
          // Continue if date parsing fails
        }
      }
      
      const sportName = match.sport?.name || match.tournament?.sport;
      if (sportName) {
        sportSet.add(sportName);
      }
    });
    
    const sportNames = Array.from(sportSet);
    
    // Sort by display_order from sports data
    if (sports && sports.length > 0) {
      const orderMap = new Map<string, number>();
      sports.forEach((sport, index) => {
        orderMap.set(sport.name.toLowerCase(), sport.display_order ?? index);
      });
      
      return sportNames.sort((a, b) => {
        const orderA = orderMap.get(a.toLowerCase()) ?? 999;
        const orderB = orderMap.get(b.toLowerCase()) ?? 999;
        return orderA - orderB;
      });
    }
    
    return sportNames.sort();
  }, [matches, sports, completedMatchDays]);

  // Calculate counts for filter badges (using effective status for accurate counts)
  const counts = useMemo(() => {
    if (!matches) return { all: 0, upcoming: 0, live: 0, completed: 0 };
    
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - completedMatchDays * 24 * 60 * 60 * 1000);
    
    // Helper function to check if a match should be treated as completed (same logic as above)
    // For Football: Use default 120 minutes if no explicit duration
    const shouldBeCompletedForCount = (match: typeof matches[0]): boolean => {
      // If manual override is enabled, trust the database status
      if (match.manual_status_override) {
        return false;
      }
      
      if (match.match_end_time) {
        const endTime = new Date(match.match_end_time);
        if (endTime < now) return true;
      }
      
      if (match.match_start_time && match.match_format !== 'test') {
        const startTime = new Date(match.match_start_time);
        
        let durationMinutes = match.match_duration_minutes;
        if (!durationMinutes) {
          const sportName = match.sport?.name?.toLowerCase() || '';
          if (sportName === 'football' || sportName === 'soccer') {
            durationMinutes = 120;
          }
        }
        
        if (durationMinutes) {
          const expectedEnd = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
          if (expectedEnd < now) return true;
        }
      }
      
      return false;
    };

    const getEffectiveStatusForCount = (match: typeof matches[0]): string => {
      if (match.status === 'completed' || match.status === 'abandoned') {
        return match.status;
      }
      
      if ((match.status === 'live' || match.status === 'upcoming') && shouldBeCompletedForCount(match)) {
        return 'completed';
      }
      
      return match.status;
    };
    
    let all = 0, upcoming = 0, live = 0, completed = 0;
    
    matches.forEach((match) => {
      // Filter out inactive matches
      if (match.is_active === false) return;

      const effectiveStatus = getEffectiveStatusForCount(match);

      // Skip completed/abandoned matches older than configured days
      if (effectiveStatus === 'completed' || effectiveStatus === 'abandoned') {
        try {
          let matchDate: Date | null = null;
          
          // Try ISO format first (YYYY-MM-DD)
          const isoMatch = match.match_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (isoMatch) {
            const [, year, month, day] = isoMatch;
            matchDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          } else {
            // Try text format (e.g., "27th January 2026")
            const dateMatch = match.match_date.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
            if (dateMatch) {
              const [, day, month, year] = dateMatch;
              const monthMap: Record<string, number> = {
                january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
                july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
              };
              matchDate = new Date(parseInt(year), monthMap[month.toLowerCase()], parseInt(day));
            }
          }
          
          if (matchDate && matchDate < cutoffDate) return;
        } catch {
          // Continue counting if date parsing fails
        }
      }
      
      all++;
      if (effectiveStatus === 'upcoming' || effectiveStatus === 'postponed') upcoming++;
      else if (effectiveStatus === 'live') live++;
      else if (effectiveStatus === 'completed' || effectiveStatus === 'abandoned') completed++;
    });
    
    return { all, upcoming, live, completed };
  }, [matches, completedMatchDays]);

  // Create a map to store effective status for each match
  const matchEffectiveStatuses = useMemo(() => {
    if (!matches) return new Map<string, string>();
    
    const now = new Date();
    const statusMap = new Map<string, string>();
    
    // For Football: Use default 120 minutes if no explicit duration
    const shouldBeCompletedCheck = (match: typeof matches[0]): boolean => {
      // If manual override is enabled, trust the database status
      if (match.manual_status_override) {
        return false;
      }
      
      if (match.match_end_time) {
        const endTime = new Date(match.match_end_time);
        if (endTime < now) return true;
      }
      
      if (match.match_start_time && match.match_format !== 'test') {
        const startTime = new Date(match.match_start_time);
        
        let durationMinutes = match.match_duration_minutes;
        if (!durationMinutes) {
          const sportName = match.sport?.name?.toLowerCase() || '';
          if (sportName === 'football' || sportName === 'soccer') {
            durationMinutes = 120;
          }
        }
        
        if (durationMinutes) {
          const expectedEnd = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
          if (expectedEnd < now) return true;
        }
      }
      
      return false;
    };
    
    matches.forEach((match) => {
      let effectiveStatus = match.status;
      
      if ((match.status === 'live' || match.status === 'upcoming') && shouldBeCompletedCheck(match)) {
        effectiveStatus = 'completed';
      }
      
      statusMap.set(match.id, effectiveStatus);
    });
    
    return statusMap;
  }, [matches]);

  if (isLoading) {
    return (
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground mt-4">Loading matches...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-destructive">Error loading matches. Please try again later.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="matches" className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Banner Slider */}
        <div className="mb-10">
          <BannerSlider />
        </div>

        {/* Sport Filters - Only show when multiple sports have matches */}
        {sportsWithMatches.length > 1 && (
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant={activeSportFilter === 'all' ? "gradient" : "outline"}
                size="sm"
                onClick={() => setActiveSportFilter('all')}
                className="gap-1.5"
              >
                All Sports
              </Button>
            </motion.div>
            {sportsWithMatches.map((sport) => (
              <motion.div key={sport} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  variant={activeSportFilter === sport ? "gradient" : "outline"}
                  size="sm"
                  onClick={() => setActiveSportFilter(sport)}
                  className="gap-1.5"
                >
                  {sport}
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Status Filters */}
        <div className="mb-8">
          <MatchFilters 
            activeFilter={activeFilter} 
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        {filteredMatches.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((match, index) => (
              <MatchCard 
                key={match.id} 
                match={match} 
                index={index} 
                effectiveStatus={matchEffectiveStatuses.get(match.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">
              {activeFilter === 'all' 
                ? 'No matches scheduled yet.' 
                : `No ${activeFilter} matches at the moment.`}
            </p>
            <p className="text-muted-foreground text-sm mt-2">Check back soon for upcoming fixtures!</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default MatchList;
