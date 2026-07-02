import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveTournaments } from '@/components/LiveTournaments';
import { Trophy, Loader2, ArrowLeft, Search, X, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';

const TournamentsPage = () => {
  const navigate = useNavigate();
  const { data: tournaments, isLoading } = useActiveTournaments();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!tournaments) return [];
    if (!searchQuery.trim()) return tournaments;
    const q = searchQuery.toLowerCase();
    return tournaments.filter((t: any) =>
      t.name.toLowerCase().includes(q) ||
      (t.sport || '').toLowerCase().includes(q)
    );
  }, [tournaments, searchQuery]);

  return (
    <>
      <SEOHead
        title="All Tournaments - Live & Upcoming"
        description="Browse all live and upcoming sports tournaments. Follow schedules, points tables, and live matches."
        keywords="tournaments, live tournaments, sports leagues, cricket tournaments, football tournaments"
      />
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/"
              className="p-2 rounded-lg bg-card border border-border/50 hover:border-primary/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl md:text-3xl text-gradient">All Tournaments</h1>
            </div>
          </div>

          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tournaments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !tournaments || tournaments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tournaments available</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No tournaments found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((tournament: any, index: number) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
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
                              tournament.logo_background_color
                                ? 'border-border/30'
                                : 'bg-background/60 border-border/30'
                            }`}
                            style={tournament.logo_background_color ? { backgroundColor: tournament.logo_background_color } : undefined}
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
                            {tournament.hasLiveMatches && (
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
          )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default TournamentsPage;