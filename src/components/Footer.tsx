import { Tv, MessageCircle, Trophy, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { usePublicSiteSettings } from "@/hooks/usePublicSiteSettings";
import { useFooterPages } from "@/hooks/useDynamicPages";
import { useTournaments } from "@/hooks/useSportsData";

const Footer = () => {
  const { data: settings } = usePublicSiteSettings();
  const { data: footerPages } = useFooterPages();
  const { data: tournaments } = useTournaments();

  const siteName = settings?.site_name || "LIVE SPORTS";
  const footerText = settings?.footer_text || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;
  const disclaimerText = (settings as any)?.disclaimer_text || "All content displayed here is from publicly available sources on the internet. We do not own or claim ownership of any cricket matches, streams, or highlights. This platform is for informational purposes only.";
  const showDisclaimer = (settings as any)?.show_disclaimer !== false;
  const telegramLink = settings?.telegram_link || "#";
  // Only show tournaments that have show_in_menu enabled (same setting as header)
  const activeTournaments = tournaments?.filter((t: any) => {
    if (!(t.is_active && t.show_in_menu && !t.is_completed)) return false;
    if (t.end_date) {
      const d = new Date(t.end_date);
      const today = new Date(); today.setHours(0,0,0,0);
      if (d < today) return false;
    }
    return true;
  }) || [];

  // Group tournaments by sport
  const tournamentsBySport = useMemo(() => {
    const groups: Record<string, typeof activeTournaments> = {};
    activeTournaments.forEach(tournament => {
      const sport = tournament.sport || 'Other';
      if (!groups[sport]) {
        groups[sport] = [];
      }
      groups[sport].push(tournament);
    });
    return groups;
  }, [activeTournaments]);

  return (
    <footer className="bg-card border-t border-border py-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              {settings?.logo_url ? (
                <img 
                  src={settings.logo_url} 
                  alt={siteName}
                  className="w-8 h-8 rounded-lg object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center">
                  <Tv className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              <span className="font-display text-lg tracking-wider text-gradient">{siteName}</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              Watch live sports matches online. Get live scores, schedules and streaming links.
            </p>
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-full transition-colors text-sm font-medium shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              Join Telegram
            </a>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link to="/#matches" className="hover:text-foreground transition-colors">Matches</Link>
              {footerPages?.map((page) => (
                <Link 
                  key={page.id} 
                  to={`/page/${page.slug}`} 
                  className="hover:text-foreground transition-colors"
                >
                  {page.title}
                </Link>
              ))}
            </nav>
          </div>

          {/* Tournaments - Grouped by Sport */}
          {activeTournaments.length > 0 && (
            <div>
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Tournaments
              </h4>
              <nav className="flex flex-col gap-3 text-sm text-muted-foreground">
                {Object.entries(tournamentsBySport).map(([sport, sportTournaments]) => (
                  <div key={sport}>
                    <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                      {sport}
                    </span>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {sportTournaments.slice(0, 3).map((tournament) => (
                        <Link 
                          key={tournament.id} 
                          to={`/tournament/${tournament.slug}`} 
                          className="hover:text-foreground transition-colors flex items-center gap-2"
                        >
                          {tournament.logo_url && (
                            <div
                              className={`w-4 h-4 rounded p-0.5 border flex items-center justify-center flex-shrink-0 ${
                                (tournament as any).logo_background_color
                                  ? 'border-border/30'
                                  : 'bg-background/60 border-border/30'
                              }`}
                              style={(tournament as any).logo_background_color ? { backgroundColor: (tournament as any).logo_background_color } : undefined}
                            >
                              <img src={tournament.logo_url} alt="" className="w-full h-full object-contain" />
                            </div>
                          )}
                          {tournament.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
              {footerPages?.filter(p => ['dmca', 'privacy', 'terms', 'contact-us'].includes(p.slug)).map((page) => (
                <Link 
                  key={page.id} 
                  to={`/page/${page.slug}`} 
                  className="hover:text-foreground transition-colors"
                >
                  {page.title}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Disclaimer Section */}
        {showDisclaimer && (
          <div className="mt-8 pt-6 border-t border-border">
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-5 md:p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-primary" />
                <h3 className="font-display text-lg font-semibold text-primary tracking-wide uppercase">
                  Important Disclaimer
                </h3>
              </div>
              <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-3xl mx-auto">
                {disclaimerText}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>{footerText}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;