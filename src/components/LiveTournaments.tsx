import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Tournament } from '@/hooks/useSportsData';

export const useActiveTournaments = () => {
  return useQuery({
    queryKey: ['tournaments', 'active'],
    queryFn: async () => {
      // Get tournaments that have live matches or recent upcoming matches
      const { data: tournamentsWithLiveMatches, error: liveError } = await supabase
        .from('matches')
        .select('tournament_id')
        .eq('status', 'live');

      if (liveError) throw liveError;

      const liveIds = tournamentsWithLiveMatches
        ?.map(m => m.tournament_id)
        .filter(Boolean) || [];

      // Get tournaments marked as active AND show_in_homepage = true AND not completed
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('is_active', true)
        .neq('show_in_homepage', false) // Only show if show_in_homepage is true or null
        .neq('is_completed', true) // Hide completed tournaments
        .order('name');
      
      if (error) throw error;

      // Client-side safety net: hide tournaments whose end_date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const notExpired = (data as Tournament[]).filter((t: any) => {
        if (!t.end_date) return true;
        return new Date(t.end_date) >= today;
      });

      // Combine with live match tournaments and mark which have live matches
      const allActiveTournaments = notExpired.map(t => ({
        ...t,
        hasLiveMatches: liveIds.includes(t.id)
      }));
      
      // Sort: Live tournaments first, then alphabetically by name
      return allActiveTournaments.sort((a, b) => {
        // Live matches first
        if (a.hasLiveMatches && !b.hasLiveMatches) return -1;
        if (!a.hasLiveMatches && b.hasLiveMatches) return 1;
        // Then alphabetically
        return a.name.localeCompare(b.name);
      });
    },
  });
};

const LiveTournaments = () => {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useActiveTournaments();

  if (isLoading || !tournaments || tournaments.length === 0) {
    return null;
  }

  const HOMEPAGE_LIMIT = 8;
  const displayed = tournaments.slice(0, HOMEPAGE_LIMIT);
  const hasMore = tournaments.length > HOMEPAGE_LIMIT;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto px-4 py-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="font-display text-2xl text-gradient">Live Tournaments</h2>
        </div>
        {hasMore && (
          <Link
            to="/tournaments"
            className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayed.map((tournament, index) => (
          <motion.div
            key={tournament.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card 
              className="cursor-pointer overflow-hidden border-border/50 bg-card/80 backdrop-blur hover:border-primary/50 transition-all group"
              onClick={() => navigate(`/tournament/${tournament.slug || tournament.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {tournament.logo_url ? (
                    <div
                      className={`w-12 h-12 rounded-lg p-1.5 border flex-shrink-0 ${
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
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                      {tournament.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{tournament.sport}</span>
                      {(tournament as any).hasLiveMatches && (
                        <Badge variant="live" className="text-[10px] px-1.5 py-0">
                          <span className="w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default LiveTournaments;
