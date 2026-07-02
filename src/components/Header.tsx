import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Tv, Trophy, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import { usePublicSiteSettings } from "@/hooks/usePublicSiteSettings";
import { useTournaments } from "@/hooks/useSportsData";
import { useCustomMenus, buildMenuTree, CustomMenu } from "@/hooks/useCustomMenus";
import * as LucideIcons from "lucide-react";

const DynamicIcon = ({ iconName, className }: { iconName: string | null; className?: string }) => {
  if (!iconName) return null;
  const IconComponent = (LucideIcons as any)[iconName];
  if (!IconComponent) return null;
  return <IconComponent className={className || "w-4 h-4"} />;
};

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const [mobileOpenDropdowns, setMobileOpenDropdowns] = useState<Set<string>>(new Set());
  const location = useLocation();
  const { data: settings } = usePublicSiteSettings();
  const { data: tournaments } = useTournaments();
  const { data: customMenus } = useCustomMenus();

  const menuTournaments = tournaments?.filter((t) => {
    if (!(t.is_active && t.show_in_menu && !t.is_completed)) return false;
    if ((t as any).end_date) {
      const d = new Date((t as any).end_date);
      const today = new Date(); today.setHours(0,0,0,0);
      if (d < today) return false;
    }
    return true;
  }) || [];
  const menuTree = customMenus ? buildMenuTree(customMenus) : [];

  // Group tournaments by sport for Tournaments menu
  const tournamentsBySport = useMemo(() => {
    const groups: Record<string, typeof menuTournaments> = {};
    menuTournaments.forEach((tournament) => {
      const sport = tournament.sport || "Other";
      if (!groups[sport]) {
        groups[sport] = [];
      }
      groups[sport].push(tournament);
    });
    return groups;
  }, [menuTournaments]);

  const siteName = settings?.site_name || "ePlayHD.com";

  const toggleDropdown = (id: string) => {
    setOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleMobileDropdown = (id: string) => {
    setMobileOpenDropdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Check if this is a special Tournaments menu that should show dynamic tournaments
  const isTournamentsMenu = (menu: CustomMenu) => {
    return menu.title.toLowerCase() === 'tournaments' && menu.menu_type === 'dropdown';
  };

  const renderDesktopMenu = (menu: CustomMenu) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isOpen = openDropdowns.has(menu.id);
    const isTournaments = isTournamentsMenu(menu);

    // Special handling for Tournaments dropdown - show dynamic tournaments
    if (isTournaments && menuTournaments.length > 0) {
      return (
        <div key={menu.id} className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => toggleDropdown(menu.id)}
          >
            <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
            {menu.title}
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
          <AnimatePresence>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => toggleDropdown(menu.id)} />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 min-w-[220px] max-h-[70vh] overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-50 py-1"
                >
                  {Object.entries(tournamentsBySport).map(([sport, sportTournaments], sportIndex) => (
                    <div key={sport}>
                      {sportIndex > 0 && <div className="border-t border-border/50 my-1" />}
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
                        {sport}
                      </div>
                      {sportTournaments.map((tournament) => (
                        <Link
                          key={tournament.id}
                          to={`/tournament/${tournament.slug}`}
                          onClick={() => toggleDropdown(menu.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {tournament.logo_url && (
                            <div
                              className={`w-5 h-5 rounded-md p-0.5 border flex items-center justify-center flex-shrink-0 ${
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
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (hasChildren) {
      return (
        <div key={menu.id} className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => toggleDropdown(menu.id)}
          >
            <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
            {menu.title}
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
          <AnimatePresence>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => toggleDropdown(menu.id)} />
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 min-w-[180px] bg-popover border border-border rounded-md shadow-lg z-50 py-1"
                >
                  {menu.children!.map((child) => (
                    <Link
                      key={child.id}
                      to={child.url || "#"}
                      target={child.open_in_new_tab ? "_blank" : undefined}
                      rel={child.open_in_new_tab ? "noopener noreferrer" : undefined}
                      onClick={() => toggleDropdown(menu.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <DynamicIcon iconName={child.icon_name} className="w-4 h-4" />
                      {child.title}
                    </Link>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={menu.id}
        to={menu.url || "#"}
        target={menu.open_in_new_tab ? "_blank" : undefined}
        rel={menu.open_in_new_tab ? "noopener noreferrer" : undefined}
      >
        <Button variant={location.pathname === menu.url ? "secondary" : "ghost"} size="sm" className="gap-1">
          <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
          {menu.title}
        </Button>
      </Link>
    );
  };

  const renderMobileMenu = (menu: CustomMenu) => {
    const hasChildren = menu.children && menu.children.length > 0;
    const isOpen = mobileOpenDropdowns.has(menu.id);
    const isTournaments = isTournamentsMenu(menu);

    // Special handling for Tournaments dropdown - show dynamic tournaments
    if (isTournaments && menuTournaments.length > 0) {
      return (
        <div key={menu.id}>
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => toggleMobileDropdown(menu.id)}
          >
            <span className="flex items-center gap-2">
              <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
              {menu.title}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {Object.entries(tournamentsBySport).map(([sport, sportTournaments], sportIndex) => (
                  <div key={sport}>
                    {sportIndex > 0 && <div className="border-t border-border/30 my-1 ml-6" />}
                    <div className="pl-8 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {sport}
                    </div>
                    {sportTournaments.map((tournament) => (
                      <Link
                        key={tournament.id}
                        to={`/tournament/${tournament.slug}`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Button variant="ghost" className="w-full justify-start pl-10 gap-2">
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
                        </Button>
                      </Link>
                    ))}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (hasChildren) {
      return (
        <div key={menu.id}>
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => toggleMobileDropdown(menu.id)}
          >
            <span className="flex items-center gap-2">
              <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
              {menu.title}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </Button>
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                {menu.children!.map((child) => (
                  <Link
                    key={child.id}
                    to={child.url || "#"}
                    target={child.open_in_new_tab ? "_blank" : undefined}
                    rel={child.open_in_new_tab ? "noopener noreferrer" : undefined}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Button variant="ghost" className="w-full justify-start pl-8 gap-2">
                      <DynamicIcon iconName={child.icon_name} className="w-4 h-4" />
                      {child.title}
                    </Button>
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link
        key={menu.id}
        to={menu.url || "#"}
        target={menu.open_in_new_tab ? "_blank" : undefined}
        rel={menu.open_in_new_tab ? "noopener noreferrer" : undefined}
        onClick={() => setIsMenuOpen(false)}
      >
        <Button 
          variant={location.pathname === menu.url ? "secondary" : "ghost"} 
          className="w-full justify-start gap-2"
        >
          <DynamicIcon iconName={menu.icon_name} className="w-4 h-4" />
          {menu.title}
        </Button>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={siteName} className="w-10 h-10 rounded-xl object-contain" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center premium-shadow group-hover:glow-primary transition-shadow">
                <Tv className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-display text-lg tracking-wide text-gradient">{siteName}</span>
              <span className="text-[9px] text-muted-foreground -mt-1 tracking-wider">ANYTIME, ANYWHERE</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {/* Custom Menus - All navigation comes from here */}
            {menuTree.map(menu => renderDesktopMenu(menu))}

            <div className="ml-2 pl-2 border-l border-border">
              <ThemeToggle />
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-foreground">
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-b border-border"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {/* Mobile Custom Menus - All navigation comes from here */}
              {menuTree.map(menu => renderMobileMenu(menu))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
