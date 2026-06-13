import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { 
  useMatches, useTeams, useTournaments, useBanners, useSports, useIsAdmin,
  useCreateMatch, useUpdateMatch, useDeleteMatch,
  useCreateTeam, useUpdateTeam, useDeleteTeam,
  useCreateTournament, useUpdateTournament, useDeleteTournament,
  useCreateBanner, useUpdateBanner, useDeleteBanner,
  useCreateSport, useUpdateSport, useDeleteSport,
  Match, Team, Tournament, Banner, Sport
} from "@/hooks/useSportsData";
import { useSiteSettings, useUpdateSiteSettings, SiteSettings } from "@/hooks/useSiteSettings";
import { useState, useEffect, useMemo } from "react";
import { Plus, Edit2, Trash2, Calendar, Trophy, Users, LogOut, Loader2, Image, Link as LinkIcon, Gamepad2, Star, ShieldAlert, Settings, Tv, Save, Play, Copy, RefreshCw, Moon, Sun, Globe, CloudDownload, Radio, Map, Zap, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LiveScoreUpdater from "@/components/LiveScoreUpdater";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import DateTimePicker from "@/components/DateTimePicker";
import { format } from "date-fns";
import StreamingServersManager from "@/components/StreamingServersManager";
import StreamingJsonSourcesManager from "@/components/StreamingJsonSourcesManager";
import InningsManager from "@/components/InningsManager";
import PlayingXIManager from "@/components/PlayingXIManager";
import FootballPlayingXIManager from "@/components/FootballPlayingXIManager";
import ManualTossManager from "@/components/ManualTossManager";
import PointsTableManager from "@/components/PointsTableManager";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect from "@/components/SearchableSelect";
import MultiSelectTeams from "@/components/MultiSelectTeams";

import PasswordChangeDialog from "@/components/PasswordChangeDialog";
import { Table, FileText, Megaphone, Clock } from "lucide-react";
import { useGoogleIndexing } from "@/hooks/useGoogleIndexing";
import DynamicPagesManager from "@/components/DynamicPagesManager";
import AdsSettingsManager from "@/components/AdsSettingsManager";
import AutoScoreSyncManager from "@/components/AutoScoreSyncManager";
import { useStreamingServerCounts } from "@/hooks/useStreamingServerCounts";
import SitemapManager from "@/components/SitemapManager";
import SponsorNoticeManager from "@/components/SponsorNoticeManager";
import UserRolesManager from "@/components/UserRolesManager";
import { useVisibleAdminTabs, useHasPermission, useHasAdminAccess } from "@/hooks/usePermissions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import FootballMatchImporter from "@/components/FootballMatchImporter";
import CricketMatchImporter from "@/components/CricketMatchImporter";
import RapidApiEndpointsManager from "@/components/RapidApiEndpointsManager";
import MaintenanceModeManager from "@/components/MaintenanceModeManager";
import ChannelsManager from "@/components/ChannelsManager";
import MenuManager from "@/components/MenuManager";
import TournamentVenueManager from "@/components/TournamentVenueManager";
import { useTournamentVenues } from "@/hooks/useTournamentVenues";
import VenueComboInput from "@/components/VenueComboInput";

const Admin = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user has admin panel access (any permission)
  const { hasAccess: hasAdminAccess, isLoading: accessLoading } = useHasAdminAccess();
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin(user?.id);
  
  // Permission-based tab visibility
  const visibleTabs = useVisibleAdminTabs();
  const canManageMatches = useHasPermission('manage_matches');
  const canManageTeams = useHasPermission('manage_teams');
  const canManageTournaments = useHasPermission('manage_tournaments');
  const canManageBanners = useHasPermission('manage_banners');
  const canManageStreaming = useHasPermission('manage_streaming');
  const canManageSettings = useHasPermission('manage_settings');
  const canManageUsers = useHasPermission('manage_users');
  const canManagePages = useHasPermission('manage_pages');
  const canManageAds = useHasPermission('manage_ads');
  const canManageApiKeys = useHasPermission('manage_api_keys');
  const canManageSeo = useHasPermission('manage_seo');
  const canManageSponsor = useHasPermission('manage_sponsor_notices');
  const canManagePointsTable = useHasPermission('manage_points_table');

  // Data hooks - MUST be called unconditionally before any returns
  const { data: matches, isLoading: matchesLoading } = useMatches();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: tournaments, isLoading: tournamentsLoading } = useTournaments();
  const { data: banners, isLoading: bannersLoading } = useBanners();
  const { data: sports, isLoading: sportsLoading } = useSports();
  const { data: siteSettings, isLoading: siteSettingsLoading } = useSiteSettings();
  const { data: serverCounts } = useStreamingServerCounts();
  const updateSiteSettings = useUpdateSiteSettings();
  
  // Enable realtime sync for live updates in admin panel
  useRealtimeSync();

  // Mutation hooks
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const createSport = useCreateSport();
  const updateSport = useUpdateSport();
  const deleteSport = useDeleteSport();

  // Google Indexing hook
  const { submitMatchForIndexing, submitTournamentForIndexing } = useGoogleIndexing();

  // ALL useState hooks must be called before any conditional returns
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [tournamentDialogOpen, setTournamentDialogOpen] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [sportDialogOpen, setSportDialogOpen] = useState(false);
  const [streamingDialogOpen, setStreamingDialogOpen] = useState(false);
  const [inningsDialogOpen, setInningsDialogOpen] = useState(false);
  const [playingXIDialogOpen, setPlayingXIDialogOpen] = useState(false);
  const [selectedMatchForStreaming, setSelectedMatchForStreaming] = useState<Match | null>(null);
  const [selectedMatchForInnings, setSelectedMatchForInnings] = useState<Match | null>(null);
  const [selectedMatchForPlayingXI, setSelectedMatchForPlayingXI] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  
  // Match search state
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [matchStatusFilter, setMatchStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [streamingSearchQuery, setStreamingSearchQuery] = useState('');
  const [streamingStatusFilter, setStreamingStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [matchSportFilter, setMatchSportFilter] = useState<string>('all');
  const [streamingSportFilter, setStreamingSportFilter] = useState<string>('all');
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  
  // Bulk selection state
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  // Bulk delete confirmation dialogs
  const [bulkDeleteMatchesDialogOpen, setBulkDeleteMatchesDialogOpen] = useState(false);
  const [bulkDeleteTeamsDialogOpen, setBulkDeleteTeamsDialogOpen] = useState(false);
  const [bulkDeleteTournamentsDialogOpen, setBulkDeleteTournamentsDialogOpen] = useState(false);
  
  // Single delete confirmation dialogs
  const [deleteMatchId, setDeleteMatchId] = useState<string | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [deleteTournamentId, setDeleteTournamentId] = useState<string | null>(null);
  
  // Form states
  const [matchForm, setMatchForm] = useState({
    tournament_id: '' as string | null,
    team_a_id: '',
    team_b_id: '',
    match_number: '' as string,
    match_date: '',
    match_time: '',
    status: 'upcoming' as 'upcoming' | 'live' | 'completed' | 'abandoned' | 'postponed',
    is_active: true,
    venue: '',
    score_a: '',
    score_b: '',
    match_link: '',
    match_duration_minutes: 180,
    match_end_time: null as string | null,
    duration_type: 'duration' as 'duration' | 'end_time',
    match_start_time: null as string | null,
    is_priority: false,
    match_label: '',
    sport_id: '' as string | null,
    page_type: 'page' as string,
    slug: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    match_minute: null as number | null,
    match_format: null as string | null,
    test_day: null as number | null,
    is_stumps: false,
    stumps_time: null as string | null,
    day_start_time: '' as string | null,
    daily_stumps_time: '' as string | null,
    next_day_start: null as string | null,
    match_result: null as 'team_a_won' | 'team_b_won' | 'tied' | 'no_result' | 'draw' | null,
    result_margin: '' as string | null,
    api_score_enabled: true,
    auto_sync_enabled: false,
    auto_match_result_enabled: true,
    cricbuzz_match_id: '' as string | null,
    cricapi_match_id: '' as string | null,
    manual_status_override: false,
    score_source: 'api_cricket' as 'manual' | 'api_cricket' | 'espn',
    espn_event_id: '' as string | null,
    show_playing_xi: false,
    manual_scoreboard_enabled: false,
  });

  const [teamForm, setTeamForm] = useState({
    name: '',
    short_name: '',
    logo_url: '',
    use_logo_background_color: false,
    logo_background_color: '#1a1a2e',
    aliases: '',
  });

  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    sport: 'Cricket',
    season: '',
    logo_url: '',
    use_logo_background_color: false,
    logo_background_color: '#1a1a2e',
    slug: '',
    is_active: true,
    show_in_menu: true,
    show_in_homepage: true,
    show_points_table: true,
    is_completed: false,
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    total_matches: null as number | null,
    start_date: '' as string | null,
    end_date: '' as string | null,
    description: '',
    total_teams: null as number | null,
    total_venues: null as number | null,
    show_participating_teams: true,
    participating_teams_position: 'before_matches' as string,
    custom_participating_teams: [] as { name: string; logo_url?: string }[],
    use_custom_teams: false,
    selectedTeamsToAdd: [] as string[],
  });

  const [bannerForm, setBannerForm] = useState({
    title: '',
    image_url: '',
    link_url: '',
    is_active: true,
    display_order: 0,
    banner_type: 'custom' as 'match' | 'tournament' | 'custom',
    match_id: '' as string,
    tournament_id: '' as string,
    subtitle: '',
    badge_type: 'none' as 'none' | 'live' | 'upcoming' | 'watch_now',
  });

  const [sportForm, setSportForm] = useState({
    name: '',
    icon_url: '',
    display_order: 0,
  });

  const [siteSettingsForm, setSiteSettingsForm] = useState({
    site_name: '',
    site_title: '',
    site_description: '',
    site_keywords: '',
    logo_url: '',
    favicon_url: '',
    og_image_url: '',
    footer_text: '',
    disclaimer_text: '',
    show_disclaimer: true,
    google_analytics_id: '',
    // Ad settings
    ads_enabled: false,
    google_adsense_id: '',
    header_ad_code: '',
    sidebar_ad_code: '',
    footer_ad_code: '',
    in_article_ad_code: '',
    popup_ad_code: '',
    // Additional SEO
    canonical_url: '',
    twitter_handle: '',
    facebook_app_id: '',
    telegram_link: '',
    // Cricket API settings (legacy)
    cricket_api_key: '',
    cricket_api_enabled: true,
    // API Cricket settings (api-cricket.com)
    api_cricket_key: '',
    api_cricket_enabled: false,
    auto_match_result_enabled: true,
    api_sync_interval_seconds: 120,
    // RapidAPI settings (Cricbuzz)
    rapidapi_key: '',
    rapidapi_enabled: false,
    rapidapi_endpoints: null as any,
    // Ads.txt
    ads_txt_content: '',
    // Custom code injection
    custom_header_code: '',
    custom_footer_code: '',
    // Banner slider settings
    slider_duration_seconds: 6,
    // Homepage completed matches days
    homepage_completed_days: 2,
    // Homepage channels limit
    homepage_channels_limit: 8,
    // Admin slug
    admin_slug: 'admin',
    // Points table auto sync
    points_table_auto_sync_enabled: false,
    points_table_sync_time: '03:00',
    // Playing XI auto sync source
    playing_xi_auto_sync_source: 'api_cricket',
  });
  
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [syncingMatchId, setSyncingMatchId] = useState<string | null>(null);
  const [forceSyncingMatchId, setForceSyncingMatchId] = useState<string | null>(null);
  const [slugConflict, setSlugConflict] = useState<{ matchId: string; teamA: string; teamB: string; matchDate: string } | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // ALL useEffect hooks must be called before any conditional returns
  useEffect(() => {
    if (siteSettings) {
      setSiteSettingsForm({
        site_name: siteSettings.site_name || '',
        site_title: siteSettings.site_title || '',
        site_description: siteSettings.site_description || '',
        site_keywords: siteSettings.site_keywords || '',
        logo_url: siteSettings.logo_url || '',
        favicon_url: siteSettings.favicon_url || '',
        og_image_url: siteSettings.og_image_url || '',
        footer_text: siteSettings.footer_text || '',
        disclaimer_text: (siteSettings as any).disclaimer_text || '',
        show_disclaimer: (siteSettings as any).show_disclaimer !== false,
        google_analytics_id: siteSettings.google_analytics_id || '',
        ads_enabled: siteSettings.ads_enabled || false,
        google_adsense_id: siteSettings.google_adsense_id || '',
        header_ad_code: siteSettings.header_ad_code || '',
        sidebar_ad_code: siteSettings.sidebar_ad_code || '',
        footer_ad_code: siteSettings.footer_ad_code || '',
        in_article_ad_code: siteSettings.in_article_ad_code || '',
        popup_ad_code: siteSettings.popup_ad_code || '',
        canonical_url: siteSettings.canonical_url || '',
        twitter_handle: siteSettings.twitter_handle || '',
        facebook_app_id: siteSettings.facebook_app_id || '',
        telegram_link: siteSettings.telegram_link || '',
        cricket_api_key: siteSettings.cricket_api_key || '',
        cricket_api_enabled: siteSettings.cricket_api_enabled !== false,
        api_cricket_key: (siteSettings as any).api_cricket_key || '',
        api_cricket_enabled: (siteSettings as any).api_cricket_enabled || false,
        auto_match_result_enabled: (siteSettings as any).auto_match_result_enabled !== false,
        api_sync_interval_seconds: (siteSettings as any).api_sync_interval_seconds || 120,
        rapidapi_key: (siteSettings as any).rapidapi_key || '',
        rapidapi_enabled: (siteSettings as any).rapidapi_enabled || false,
        rapidapi_endpoints: (siteSettings as any).rapidapi_endpoints || null,
        ads_txt_content: (siteSettings as any).ads_txt_content || '',
        custom_header_code: siteSettings.custom_header_code || '',
        custom_footer_code: siteSettings.custom_footer_code || '',
        slider_duration_seconds: (siteSettings as any).slider_duration_seconds || 6,
        homepage_completed_days: (siteSettings as any).homepage_completed_days || 2,
        homepage_channels_limit: (siteSettings as any).homepage_channels_limit || 8,
        admin_slug: (siteSettings as any).admin_slug || 'admin',
        points_table_auto_sync_enabled: (siteSettings as any).points_table_auto_sync_enabled || false,
        points_table_sync_time: (siteSettings as any).points_table_sync_time || '03:00',
        playing_xi_auto_sync_source: (siteSettings as any).playing_xi_auto_sync_source || 'api_cricket',
      });
    }
  }, [siteSettings]);

  // Check for slug conflicts when slug changes
  useEffect(() => {
    const checkSlugConflict = async () => {
      if (!matchForm.slug || matchForm.slug.length < 3 || matchForm.page_type !== 'page') {
        setSlugConflict(null);
        return;
      }

      setIsCheckingSlug(true);
      try {
        const currentMatchId = editingMatch?.id || '00000000-0000-0000-0000-000000000000';
        const { data: existingMatches } = await supabase
          .from('matches')
          .select('id, match_date, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name)')
          .eq('slug', matchForm.slug)
          .neq('id', currentMatchId)
          .limit(1);

        if (existingMatches && existingMatches.length > 0) {
          const match = existingMatches[0];
          setSlugConflict({
            matchId: match.id,
            teamA: (match.team_a as any)?.name || 'Unknown',
            teamB: (match.team_b as any)?.name || 'Unknown',
            matchDate: match.match_date,
          });
        } else {
          setSlugConflict(null);
        }
      } catch (error) {
        console.error('Error checking slug:', error);
      } finally {
        setIsCheckingSlug(false);
      }
    };

    const debounce = setTimeout(checkSlugConflict, 300);
    return () => clearTimeout(debounce);
  }, [matchForm.slug, matchForm.page_type, editingMatch?.id]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // NOW we can have conditional returns - after ALL hooks are called
  if (!loading && !accessLoading && user && !hasAdminAccess) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center py-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md mx-4"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="font-display text-3xl text-gradient mb-4">Access Denied</h1>
            <p className="text-muted-foreground mb-6">
              You don't have any permissions to access this page. Please contact an administrator.
            </p>
            <Button variant="gradient" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Helper function to get effective match status (frontend fallback for stale data)
  const getEffectiveMatchStatus = (match: Match): string => {
    // If DB says completed/abandoned, trust it
    if (match.status === 'completed' || match.status === 'abandoned') {
      return match.status;
    }
    
    // If manual override is enabled, trust the current status
    if (match.manual_status_override) {
      return match.status;
    }
    
    const now = new Date();
    
    // Only check explicit end time (no defaults)
    if (match.match_end_time) {
      const endTime = new Date(match.match_end_time);
      if (endTime < now) return 'completed';
    }
    
    // Only check explicit duration (no defaults)
    if (match.match_start_time && match.match_duration_minutes) {
      const startTime = new Date(match.match_start_time);
      const expectedEnd = new Date(startTime.getTime() + match.match_duration_minutes * 60 * 1000);
      if (expectedEnd < now) return 'completed';
    }
    
    return match.status;
  };

  const handleClearCache = async () => {
    try {
      // Clear React Query cache
      const queryClient = (await import('@tanstack/react-query')).useQueryClient;
      
      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Clear localStorage cache items (keep auth)
      const authKeys = ['supabase.auth.token'];
      Object.keys(localStorage).forEach(key => {
        if (!authKeys.some(authKey => key.includes(authKey))) {
          if (key.includes('cache') || key.includes('query')) {
            localStorage.removeItem(key);
          }
        }
      });
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      toast({
        title: "Cache cleared",
        description: "All cached data has been cleared. Refreshing page...",
      });
      
      // Reload the page to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear cache. Please try refreshing the page manually.",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
  };


  // Match handlers
  const handleSaveMatch = async () => {
    try {
      // Generate SEO-friendly slug from team names (format: team-a-vs-team-b-live)
      const teamAName = teams?.find(t => t.id === matchForm.team_a_id)?.name || '';
      const teamBName = teams?.find(t => t.id === matchForm.team_b_id)?.name || '';
      const generateBaseSlug = (teamA: string, teamB: string) => {
        return `${teamA}-vs-${teamB}-live`.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      };

      let finalSlug: string | null = null;
      
      if (matchForm.page_type === 'page') {
        // If user provided custom slug, use it
        if (matchForm.slug && matchForm.slug.trim()) {
          finalSlug = matchForm.slug.trim();
        } else if (editingMatch?.slug) {
          // Keep existing slug when editing
          finalSlug = editingMatch.slug;
        } else {
          // Auto-generate slug with duplicate handling
          const baseSlug = generateBaseSlug(teamAName, teamBName);
          const currentMatchId = editingMatch?.id;
          
          // Check for existing matches with same base slug pattern
          const { data: existingMatches } = await supabase
            .from('matches')
            .select('id, slug, status, match_start_time')
            .ilike('slug', `${baseSlug}%`)
            .neq('id', currentMatchId || '00000000-0000-0000-0000-000000000000')
            .order('match_start_time', { ascending: true });
          
          if (!existingMatches || existingMatches.length === 0) {
            // No existing - use clean slug
            finalSlug = baseSlug;
          } else {
            // Find next available number
            const usedNumbers = existingMatches
              .map(m => {
                if (m.slug === baseSlug) return 1;
                const match = m.slug?.match(new RegExp(`^${baseSlug.replace(/[-]/g, '\\-')}-(\\d+)$`));
                return match ? parseInt(match[1]) : 0;
              })
              .filter(n => n > 0);
            
            if (usedNumbers.includes(1)) {
              // Base slug (count as 1) is taken, find next number
              const nextNumber = Math.max(...usedNumbers) + 1;
              finalSlug = `${baseSlug}-${nextNumber}`;
            } else {
              // Base slug is available (other matches have numbered slugs)
              finalSlug = baseSlug;
            }
          }
        }
      }

      const matchData = {
        tournament_id: matchForm.tournament_id || null,
        team_a_id: matchForm.team_a_id,
        team_b_id: matchForm.team_b_id,
        match_number: matchForm.match_number || null,
        match_date: matchForm.match_date,
        match_time: matchForm.match_time,
        status: matchForm.status,
        is_active: matchForm.is_active,
        venue: matchForm.venue || null,
        score_a: matchForm.score_a || null,
        score_b: matchForm.score_b || null,
        match_link: matchForm.page_type === 'redirect' ? (matchForm.match_link || null) : null,
        match_duration_minutes: matchForm.duration_type === 'duration' ? (matchForm.match_duration_minutes ?? 180) : null,
        match_end_time: matchForm.duration_type === 'end_time' ? (matchForm.match_end_time || null) : null,
        match_start_time: matchForm.match_start_time || null,
        is_priority: matchForm.is_priority,
        match_label: matchForm.match_label || null,
        sport_id: matchForm.sport_id || null,
        page_type: matchForm.page_type,
        slug: finalSlug,
        seo_title: matchForm.seo_title || null,
        seo_description: matchForm.seo_description || null,
        seo_keywords: matchForm.seo_keywords || null,
        match_minute: matchForm.match_minute,
        match_format: matchForm.match_format || null,
        test_day: matchForm.test_day,
        is_stumps: matchForm.is_stumps,
        stumps_time: matchForm.daily_stumps_time 
          ? (() => {
              const [hours, minutes] = matchForm.daily_stumps_time.split(':').map(Number);
              const today = new Date();
              today.setHours(hours, minutes, 0, 0);
              return today.toISOString();
            })()
          : matchForm.stumps_time || null,
        day_start_time: matchForm.day_start_time || null,
        next_day_start: matchForm.next_day_start || null,
        match_result: matchForm.match_result,
        result_margin: matchForm.result_margin || null,
        api_score_enabled: matchForm.api_score_enabled,
        auto_sync_enabled: matchForm.auto_sync_enabled,
        auto_match_result_enabled: matchForm.auto_match_result_enabled,
        cricbuzz_match_id: matchForm.cricbuzz_match_id || null,
        cricapi_match_id: (matchForm as any).cricapi_match_id || null,
        manual_status_override: matchForm.manual_status_override,
        score_source: matchForm.score_source || 'manual',
        espn_event_id: matchForm.espn_event_id || null,
        show_playing_xi: matchForm.show_playing_xi,
        manual_scoreboard_enabled: matchForm.manual_scoreboard_enabled,
      };
      let matchId: string | undefined;
      
      if (editingMatch) {
        await updateMatch.mutateAsync({ id: editingMatch.id, ...matchData });
        matchId = editingMatch.id;
        toast({ title: "Match updated successfully" });
      } else {
        const result = await createMatch.mutateAsync(matchData);
        matchId = result?.id;
        toast({ title: "Match created successfully" });
      }
      
      // Submit to Google Indexing if page_type is 'page' (has its own URL)
      if (matchData.page_type === 'page' && matchId) {
        submitMatchForIndexing(matchId);
        
        // Auto-ping search engines for sitemap update
        supabase.functions.invoke('sitemap-ping', {
          body: { 
            ping_type: 'auto_match', 
            triggered_by: matchId 
          }
        }).catch(err => console.error('Auto-ping failed:', err));
      }
      
      setMatchDialogOpen(false);
      resetMatchForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setMatchForm({
      tournament_id: match.tournament_id || '',
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
      match_number: match.match_number || '',
      match_date: match.match_date,
      match_time: match.match_time,
      status: match.status,
      is_active: match.is_active !== false,
      venue: match.venue || '',
      score_a: match.score_a || '',
      score_b: match.score_b || '',
      match_link: match.match_link || '',
      match_duration_minutes: match.match_duration_minutes ?? null,
      match_end_time: (match as any).match_end_time || null,
      duration_type: (match as any).match_end_time ? 'end_time' : 'duration',
      match_start_time: match.match_start_time || null,
      is_priority: match.is_priority || false,
      match_label: match.match_label || '',
      sport_id: match.sport_id || '',
      page_type: match.page_type || 'page',
      slug: match.slug || '',
      seo_title: match.seo_title || '',
      seo_description: match.seo_description || '',
      seo_keywords: match.seo_keywords || '',
      match_minute: match.match_minute,
      match_format: match.match_format || null,
      test_day: match.test_day,
      is_stumps: match.is_stumps || false,
      stumps_time: match.stumps_time || null,
      day_start_time: match.day_start_time || '',
      daily_stumps_time: match.stumps_time ? new Date(match.stumps_time).toTimeString().slice(0, 5) : '',
      next_day_start: match.next_day_start || null,
      match_result: match.match_result,
      result_margin: match.result_margin || '',
      api_score_enabled: match.api_score_enabled !== false,
      auto_sync_enabled: (match as any).auto_sync_enabled || false,
      auto_match_result_enabled: (match as any).auto_match_result_enabled !== false,
      cricbuzz_match_id: match.cricbuzz_match_id || '',
      cricapi_match_id: (match as any).cricapi_match_id || '',
      manual_status_override: (match as any).manual_status_override || false,
      score_source: (match as any).score_source || 'manual',
      espn_event_id: (match as any).espn_event_id || '',
      show_playing_xi: (match as any).show_playing_xi || false,
      manual_scoreboard_enabled: (match as any).manual_scoreboard_enabled || false,
    });
    setMatchDialogOpen(true);
  };

  const handleDeleteMatch = async (id: string) => {
    try {
      await deleteMatch.mutateAsync(id);
      setSelectedMatches(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteMatchId(null);
      toast({ title: "Match deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDeleteMatches = async () => {
    if (selectedMatches.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedMatches).map(id => deleteMatch.mutateAsync(id)));
      setSelectedMatches(new Set());
      setBulkDeleteMatchesDialogOpen(false);
      toast({ title: `${selectedMatches.size} matches deleted successfully` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleMatchSelection = (id: string) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllMatchesSelection = (matchIds: string[]) => {
    setSelectedMatches(prev => {
      const allSelected = matchIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(matchIds);
    });
  };

  const handleCopyMatch = (match: Match) => {
    // Generate new slug for copied match
    const teamAName = match.team_a?.name || '';
    const teamBName = match.team_b?.name || '';
    const newSlug = `${teamAName}-vs-${teamBName}`.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    setEditingMatch(null); // Ensure we're creating, not editing
    setMatchForm({
      tournament_id: match.tournament_id || '',
      team_a_id: match.team_a_id,
      team_b_id: match.team_b_id,
      match_number: match.match_number || '',
      match_date: match.match_date,
      match_time: match.match_time,
      status: 'upcoming',
      is_active: true,
      venue: match.venue || '',
      score_a: '',
      score_b: '',
      match_link: match.match_link || '',
      match_duration_minutes: match.match_duration_minutes ?? null,
      match_end_time: null,
      duration_type: 'duration',
      match_start_time: match.match_start_time || null,
      is_priority: match.is_priority || false,
      match_label: match.match_label || '',
      sport_id: match.sport_id || '',
      page_type: match.page_type || 'redirect',
      slug: '',
      seo_title: match.seo_title || '',
      seo_description: match.seo_description || '',
      seo_keywords: match.seo_keywords || '',
      match_minute: null,
      match_format: match.match_format || null,
      test_day: null,
      is_stumps: false,
      stumps_time: null,
      day_start_time: match.day_start_time || '',
      daily_stumps_time: '',
      next_day_start: null,
      match_result: null,
      result_margin: '',
      api_score_enabled: true,
      auto_sync_enabled: false,
      auto_match_result_enabled: true,
      cricbuzz_match_id: '',
      cricapi_match_id: '',
      manual_status_override: false,
      score_source: 'api_cricket',
      espn_event_id: '',
      show_playing_xi: false,
      manual_scoreboard_enabled: false,
    });
    setMatchDialogOpen(true);
    toast({ title: "Match copied", description: "Edit the details and save to create a new match." });
  };

  const resetMatchForm = () => {
    setEditingMatch(null);
    setMatchForm({
      tournament_id: '',
      team_a_id: '',
      team_b_id: '',
      match_number: '',
      match_date: '',
      match_time: '',
      status: 'upcoming',
      is_active: true,
      venue: '',
      score_a: '',
      score_b: '',
      match_link: '',
      match_duration_minutes: null,
      match_end_time: null,
      duration_type: 'duration',
      match_start_time: null,
      is_priority: false,
      match_label: '',
      sport_id: '',
      page_type: 'page',
      slug: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      match_minute: null,
      match_format: null,
      test_day: null,
      is_stumps: false,
      stumps_time: null,
      day_start_time: '',
      daily_stumps_time: '',
      next_day_start: null,
      match_result: null,
      result_margin: '',
      api_score_enabled: true,
      auto_sync_enabled: false,
      auto_match_result_enabled: true,
      cricbuzz_match_id: '',
      cricapi_match_id: '',
      manual_status_override: false,
      score_source: 'api_cricket',
      espn_event_id: '',
      show_playing_xi: false,
      manual_scoreboard_enabled: false,
    });
  };

  // Sync match from API Cricket (api-cricket.com)
  
  const handleSyncFromApiCricket = async (match: Match) => {
    if (syncingMatchId) return;
    
    const teamA = teams?.find(t => t.id === match.team_a_id);
    const teamB = teams?.find(t => t.id === match.team_b_id);
    
    if (!teamA || !teamB) {
      toast({
        title: "Sync failed",
        description: "Could not find team information",
        variant: "destructive"
      });
      return;
    }
    
    setSyncingMatchId(match.id);
    try {
      const { data, error } = await supabase.functions.invoke('api-cricket', {
        body: {
          action: 'syncMatch',
          matchId: match.id,
          teamAName: teamA.name,
          teamBName: teamB.name
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        toast({
          title: "Sync failed",
          description: data.error || "Failed to sync match data",
          variant: "destructive"
        });
        return;
      }

      if (!data.match) {
        toast({
          title: "No match found",
          description: "Could not find a matching live event for this match",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Match synced",
        description: `Score: ${data.match.homeScore} vs ${data.match.awayScore} - ${data.match.statusInfo || data.match.status}`,
      });
      
      // Refresh matches data
      window.location.reload();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync from API Cricket",
        variant: "destructive"
      });
    } finally {
      setSyncingMatchId(null);
    }
  };

  // Force Re-sync using sync-api-scores edge function (cricket) or scrape-football-scores (football)
  const handleForceResync = async (match: Match) => {
    if (forceSyncingMatchId) return;
    
    setForceSyncingMatchId(match.id);
    try {
      // Check if it's a football match
      const sport = sports?.find(s => s.id === match.sport_id);
      const isFootball = sport?.name?.toLowerCase().includes('football') || sport?.name?.toLowerCase().includes('soccer');
      
      if (isFootball) {
        // For football - sync scores, lineups, and substitutions
        const { data: apiResponse, error: apiError } = await supabase.functions.invoke(
          'scrape-football-scores',
          { body: { allLeagues: true, includeDetails: true } }
        );

        if (apiError || !apiResponse?.success) {
          throw new Error(apiError?.message || 'Failed to fetch football data');
        }

        const apiMatches = apiResponse.matches || [];
        
        // Find matching match using fuzzy matching
        const normalizeTeamName = (name: string): string => {
          return name
            .toLowerCase()
            .replace(/\s+fc$/i, '')
            .replace(/\s+united$/i, ' utd')
            .replace(/\s+city$/i, '')
            .replace(/manchester\s+/i, 'man ')
            .replace(/tottenham\s+hotspur/i, 'spurs')
            .replace(/wolverhampton\s+wanderers/i, 'wolves')
            .replace(/west\s+ham\s+united/i, 'west ham')
            .replace(/newcastle\s+united/i, 'newcastle')
            .replace(/\s+/g, ' ')
            .trim();
        };

        const teamsMatch = (dbTeam: string, apiTeam: string): boolean => {
          const normalizedDb = normalizeTeamName(dbTeam);
          const normalizedApi = normalizeTeamName(apiTeam);
          if (normalizedDb === normalizedApi) return true;
          if (normalizedDb.includes(normalizedApi) || normalizedApi.includes(normalizedDb)) return true;
          const dbWords = normalizedDb.split(' ').filter(w => w.length > 2);
          const apiWords = normalizedApi.split(' ').filter(w => w.length > 2);
          const matchingWords = dbWords.filter(w => apiWords.includes(w));
          return matchingWords.length >= 1 && matchingWords.length >= Math.min(dbWords.length, apiWords.length) * 0.5;
        };

        const teamA = teams?.find(t => t.id === match.team_a_id);
        const teamB = teams?.find(t => t.id === match.team_b_id);
        
        if (!teamA || !teamB) {
          throw new Error('Team data not found');
        }

        // Find the matching API match
        const apiMatch = apiMatches.find((api: { homeTeam: string; awayTeam: string }) => {
          const homeMatches = teamsMatch(teamA.name, api.homeTeam) || teamsMatch(teamA.short_name, api.homeTeam);
          const awayMatches = teamsMatch(teamB.name, api.awayTeam) || teamsMatch(teamB.short_name, api.awayTeam);
          return homeMatches && awayMatches;
        });

        const apiMatchReverse = !apiMatch ? apiMatches.find((api: { homeTeam: string; awayTeam: string }) => {
          const homeMatches = teamsMatch(teamB.name, api.homeTeam) || teamsMatch(teamB.short_name, api.homeTeam);
          const awayMatches = teamsMatch(teamA.name, api.awayTeam) || teamsMatch(teamA.short_name, api.awayTeam);
          return homeMatches && awayMatches;
        }) : null;

        const matchedApi = apiMatch || apiMatchReverse;
        const isReversed = !!apiMatchReverse && !apiMatch;

        if (!matchedApi) {
          toast({
            title: "No match found",
            description: `Could not find API data for ${teamA.name} vs ${teamB.name}`,
            variant: "destructive"
          });
          return;
        }

        // Update scores and goals in database
        const homeScore = matchedApi.homeScore ?? null;
        const awayScore = matchedApi.awayScore ?? null;
        const homeGoals = matchedApi.homeGoals || [];
        const awayGoals = matchedApi.awayGoals || [];
        
        await supabase
          .from('matches')
          .update({
            score_a: isReversed ? String(awayScore) : String(homeScore),
            score_b: isReversed ? String(homeScore) : String(awayScore),
            match_minute: matchedApi.minute || null,
            goals_team_a: isReversed ? awayGoals : homeGoals,
            goals_team_b: isReversed ? homeGoals : awayGoals,
            last_api_sync: new Date().toISOString()
          })
          .eq('id', match.id);

        // Sync lineups
        const lineupTeamA = isReversed ? matchedApi.awayLineup : matchedApi.homeLineup;
        const lineupTeamB = isReversed ? matchedApi.homeLineup : matchedApi.awayLineup;
        const subsTeamA = isReversed ? matchedApi.awaySubs : matchedApi.homeSubs;
        const subsTeamB = isReversed ? matchedApi.homeSubs : matchedApi.awaySubs;

        let insertedPlayers = 0;
        let insertedSubs = 0;

        // Delete existing lineup and insert new
        if (lineupTeamA?.length || lineupTeamB?.length) {
          await supabase.from('match_playing_xi').delete().eq('match_id', match.id);

          const lineupInserts: any[] = [];
          
          if (lineupTeamA) {
            for (let i = 0; i < lineupTeamA.length; i++) {
              const player = lineupTeamA[i];
              lineupInserts.push({
                match_id: match.id,
                team_id: teamA.id,
                player_name: player.name,
                player_role: player.position || null,
                batting_order: i + 1,
                is_captain: player.isCaptain || false,
                is_vice_captain: false,
              });
            }
          }
          
          if (lineupTeamB) {
            for (let i = 0; i < lineupTeamB.length; i++) {
              const player = lineupTeamB[i];
              lineupInserts.push({
                match_id: match.id,
                team_id: teamB.id,
                player_name: player.name,
                player_role: player.position || null,
                batting_order: i + 1,
                is_captain: player.isCaptain || false,
                is_vice_captain: false,
              });
            }
          }
          
          if (lineupInserts.length > 0) {
            const { error: lineupError } = await supabase.from('match_playing_xi').insert(lineupInserts);
            if (!lineupError) insertedPlayers = lineupInserts.length;
          }
        }

        // Sync substitutions
        if (subsTeamA?.length || subsTeamB?.length) {
          await supabase.from('match_substitutions').delete().eq('match_id', match.id);

          const subsInserts: any[] = [];
          
          if (subsTeamA) {
            for (const sub of subsTeamA) {
              subsInserts.push({
                match_id: match.id,
                team_id: teamA.id,
                player_out: sub.playerOut,
                player_in: sub.playerIn,
                minute: sub.minute,
              });
            }
          }
          
          if (subsTeamB) {
            for (const sub of subsTeamB) {
              subsInserts.push({
                match_id: match.id,
                team_id: teamB.id,
                player_out: sub.playerOut,
                player_in: sub.playerIn,
                minute: sub.minute,
              });
            }
          }
          
          if (subsInserts.length > 0) {
            const { error: subsError } = await supabase.from('match_substitutions').insert(subsInserts);
            if (!subsError) insertedSubs = subsInserts.length;
          }
        }

        toast({
          title: "Football match synced",
          description: `Score: ${isReversed ? awayScore : homeScore}-${isReversed ? homeScore : awayScore}, ${insertedPlayers} players, ${insertedSubs} subs`,
        });
        
        window.location.reload();
        return;
      }

      // For cricket - use existing sync-api-scores
      const { data, error } = await supabase.functions.invoke('sync-api-scores', {
        body: { matchId: match.id }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        toast({
          title: "Re-sync failed",
          description: data?.error || "Failed to re-sync match data",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Match re-synced",
        description: `Successfully re-synced ${data.synced || 1} match(es)`,
      });
      
      // Refresh matches data
      window.location.reload();
    } catch (error: any) {
      console.error('Force Re-sync error:', error);
      toast({
        title: "Re-sync failed",
        description: error.message || "Failed to force re-sync",
        variant: "destructive"
      });
    } finally {
      setForceSyncingMatchId(null);
    }
  };

  // Team handlers
  const handleSaveTeam = async () => {
    try {
      const teamData = {
        name: teamForm.name,
        short_name: teamForm.short_name,
        logo_url: teamForm.logo_url || null,
        logo_background_color: teamForm.use_logo_background_color ? teamForm.logo_background_color : null,
        aliases: teamForm.aliases
          ? teamForm.aliases.split(',').map(s => s.trim()).filter(Boolean)
          : [],
      };
      
      if (editingTeam) {
        await updateTeam.mutateAsync({ id: editingTeam.id, ...teamData });
        toast({ title: "Team updated successfully" });
      } else {
        await createTeam.mutateAsync(teamData);
        toast({ title: "Team created successfully" });
      }
      setTeamDialogOpen(false);
      resetTeamForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      short_name: team.short_name,
      logo_url: team.logo_url || '',
      use_logo_background_color: !!team.logo_background_color,
      logo_background_color: team.logo_background_color || '#1a1a2e',
      aliases: Array.isArray((team as any).aliases) ? (team as any).aliases.join(', ') : '',
    });
    setTeamDialogOpen(true);
  };

  const handleDeleteTeam = async (id: string) => {
    try {
      await deleteTeam.mutateAsync(id);
      setSelectedTeams(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteTeamId(null);
      toast({ title: "Team deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDeleteTeams = async () => {
    if (selectedTeams.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedTeams).map(id => deleteTeam.mutateAsync(id)));
      setSelectedTeams(new Set());
      setBulkDeleteTeamsDialogOpen(false);
      toast({ title: `${selectedTeams.size} teams deleted successfully` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleTeamSelection = (id: string) => {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllTeamsSelection = (teamIds: string[]) => {
    setSelectedTeams(prev => {
      const allSelected = teamIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(teamIds);
    });
  };

  const resetTeamForm = () => {
    setEditingTeam(null);
    setTeamForm({ name: '', short_name: '', logo_url: '', use_logo_background_color: false, logo_background_color: '#1a1a2e', aliases: '' });
  };

  // Tournament handlers
  const handleSaveTournament = async () => {
    try {
      // Generate slug from name if not provided
      const generateSlug = (name: string) => {
        return name.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      };

      const tournamentData = {
        name: tournamentForm.name,
        sport: tournamentForm.sport,
        season: tournamentForm.season,
        logo_url: tournamentForm.logo_url || null,
        logo_background_color: tournamentForm.use_logo_background_color ? tournamentForm.logo_background_color : null,
        slug: tournamentForm.slug || generateSlug(tournamentForm.name),
        is_active: tournamentForm.is_active,
        show_in_menu: tournamentForm.show_in_menu,
        show_in_homepage: tournamentForm.show_in_homepage,
        show_points_table: tournamentForm.show_points_table,
        is_completed: tournamentForm.is_completed,
        seo_title: tournamentForm.seo_title || null,
        seo_description: tournamentForm.seo_description || null,
        seo_keywords: tournamentForm.seo_keywords || null,
        total_matches: tournamentForm.total_matches || null,
        start_date: tournamentForm.start_date || null,
        end_date: tournamentForm.end_date || null,
        description: tournamentForm.description || null,
        total_teams: tournamentForm.total_teams || null,
        total_venues: tournamentForm.total_venues || null,
        show_participating_teams: tournamentForm.show_participating_teams,
        participating_teams_position: tournamentForm.participating_teams_position,
        custom_participating_teams: (() => {
          if (!tournamentForm.use_custom_teams) return null;
          // Filter out teams with empty names
          const validTeams = tournamentForm.custom_participating_teams.filter(t => t.name && t.name.trim() !== '');
          // Return empty array if use_custom_teams is ON but no teams - this preserves the toggle state
          return validTeams;
        })(),
      };
      const tournamentSlug = tournamentData.slug;
      
      if (editingTournament) {
        const teamsCount = Array.isArray(tournamentData.custom_participating_teams) ? tournamentData.custom_participating_teams.length : 0;
        await updateTournament.mutateAsync({ id: editingTournament.id, ...tournamentData });
        toast({ title: "Tournament updated successfully", description: `Saved ${teamsCount} custom team(s)` });
      } else {
        await createTournament.mutateAsync(tournamentData);
        toast({ title: "Tournament created successfully" });
      }
      
      // Submit to Google Indexing
      if (tournamentSlug) {
        submitTournamentForIndexing(tournamentSlug);
        
        // Auto-ping search engines for sitemap update
        supabase.functions.invoke('sitemap-ping', {
          body: { 
            ping_type: 'auto_tournament', 
            triggered_by: tournamentSlug 
          }
        }).catch(err => console.error('Auto-ping failed:', err));
      }
      
      setTournamentDialogOpen(false);
      resetTournamentForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditTournament = (tournament: Tournament) => {
    setEditingTournament(tournament);
    const customTeams = Array.isArray(tournament.custom_participating_teams) 
      ? tournament.custom_participating_teams as { name: string; logo_url?: string }[]
      : [];
    // use_custom_teams is true if custom_participating_teams is an array (even if empty)
    const hasCustomTeamsEnabled = Array.isArray(tournament.custom_participating_teams);
    setTournamentForm({
      name: tournament.name,
      sport: tournament.sport,
      season: tournament.season,
      logo_url: tournament.logo_url || '',
      use_logo_background_color: !!(tournament as any).logo_background_color,
      logo_background_color: (tournament as any).logo_background_color || '#1a1a2e',
      slug: tournament.slug || '',
      is_active: tournament.is_active ?? true,
      show_in_menu: tournament.show_in_menu ?? true,
      show_in_homepage: tournament.show_in_homepage ?? true,
      show_points_table: (tournament as any).show_points_table ?? true,
      is_completed: tournament.is_completed ?? false,
      seo_title: tournament.seo_title || '',
      seo_description: tournament.seo_description || '',
      seo_keywords: tournament.seo_keywords || '',
      total_matches: tournament.total_matches ?? null,
      start_date: tournament.start_date || '',
      end_date: tournament.end_date || '',
      description: tournament.description || '',
      total_teams: tournament.total_teams ?? null,
      total_venues: tournament.total_venues ?? null,
      show_participating_teams: tournament.show_participating_teams ?? true,
      participating_teams_position: tournament.participating_teams_position || 'before_matches',
      custom_participating_teams: customTeams,
      use_custom_teams: hasCustomTeamsEnabled,
      selectedTeamsToAdd: [],
    });
    setTournamentDialogOpen(true);
  };

  const handleDeleteTournament = async (id: string) => {
    try {
      await deleteTournament.mutateAsync(id);
      setSelectedTournaments(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeleteTournamentId(null);
      toast({ title: "Tournament deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkDeleteTournaments = async () => {
    if (selectedTournaments.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedTournaments).map(id => deleteTournament.mutateAsync(id)));
      setSelectedTournaments(new Set());
      setBulkDeleteTournamentsDialogOpen(false);
      toast({ title: `${selectedTournaments.size} tournaments deleted successfully` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const toggleTournamentSelection = (id: string) => {
    setSelectedTournaments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllTournamentsSelection = (tournamentIds: string[]) => {
    setSelectedTournaments(prev => {
      const allSelected = tournamentIds.every(id => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(tournamentIds);
    });
  };

  const resetTournamentForm = () => {
    setEditingTournament(null);
    setTournamentForm({ 
      name: '', 
      sport: 'Cricket', 
      season: '', 
      logo_url: '', 
      use_logo_background_color: false,
      logo_background_color: '#1a1a2e',
      slug: '', 
      is_active: true, 
      show_in_menu: true, 
      show_in_homepage: true, 
      show_points_table: true,
      is_completed: false, 
      seo_title: '', 
      seo_description: '', 
      seo_keywords: '', 
      total_matches: null, 
      start_date: '', 
      end_date: '', 
      description: '', 
      total_teams: null, 
      total_venues: null,
      show_participating_teams: true,
      participating_teams_position: 'before_matches',
      custom_participating_teams: [],
      use_custom_teams: false,
      selectedTeamsToAdd: [],
    });
  };

  const handleSaveBanner = async () => {
    try {
      const bannerData = {
        title: bannerForm.title,
        image_url: bannerForm.image_url,
        link_url: bannerForm.link_url || null,
        is_active: bannerForm.is_active,
        display_order: bannerForm.display_order,
        banner_type: bannerForm.banner_type,
        match_id: bannerForm.banner_type === 'match' ? (bannerForm.match_id || null) : null,
        tournament_id: bannerForm.banner_type === 'tournament' ? (bannerForm.tournament_id || null) : null,
        subtitle: bannerForm.subtitle || null,
        badge_type: bannerForm.badge_type,
      };
      
      if (editingBanner) {
        await updateBanner.mutateAsync({ id: editingBanner.id, ...bannerData });
        toast({ title: "Banner updated successfully" });
      } else {
        await createBanner.mutateAsync(bannerData);
        toast({ title: "Banner created successfully" });
      }
      setBannerDialogOpen(false);
      resetBannerForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditBanner = (banner: Banner) => {
    setEditingBanner(banner);
    setBannerForm({
      title: banner.title,
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active,
      display_order: banner.display_order,
      banner_type: banner.banner_type || 'custom',
      match_id: banner.match_id || '',
      tournament_id: banner.tournament_id || '',
      subtitle: banner.subtitle || '',
      badge_type: banner.badge_type || 'none',
    });
    setBannerDialogOpen(true);
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await deleteBanner.mutateAsync(id);
      toast({ title: "Banner deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetBannerForm = () => {
    setEditingBanner(null);
    setBannerForm({ 
      title: '', 
      image_url: '', 
      link_url: '', 
      is_active: true, 
      display_order: 0,
      banner_type: 'custom',
      match_id: '',
      tournament_id: '',
      subtitle: '',
      badge_type: 'none',
    });
  };

  // Sport handlers
  const handleSaveSport = async () => {
    try {
      const sportData = {
        name: sportForm.name,
        icon_url: sportForm.icon_url || null,
        display_order: sportForm.display_order,
      };
      
      if (editingSport) {
        await updateSport.mutateAsync({ id: editingSport.id, ...sportData });
        toast({ title: "Sport updated successfully" });
      } else {
        await createSport.mutateAsync(sportData);
        toast({ title: "Sport created successfully" });
      }
      setSportDialogOpen(false);
      resetSportForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEditSport = (sport: Sport) => {
    setEditingSport(sport);
    setSportForm({
      name: sport.name,
      icon_url: sport.icon_url || '',
      display_order: sport.display_order ?? 0,
    });
    setSportDialogOpen(true);
  };

  const handleDeleteSport = async (id: string) => {
    try {
      await deleteSport.mutateAsync(id);
      toast({ title: "Sport deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const resetSportForm = () => {
    setEditingSport(null);
    setSportForm({ name: '', icon_url: '', display_order: 0 });
  };

  // Site Settings handler
  const handleSaveSiteSettings = async () => {
    if (!siteSettings?.id) {
      toast({ title: "Error", description: "Site settings not found", variant: "destructive" });
      return;
    }
    
    try {
      await updateSiteSettings.mutateAsync({
        id: siteSettings.id,
        site_name: siteSettingsForm.site_name,
        site_title: siteSettingsForm.site_title,
        site_description: siteSettingsForm.site_description || null,
        site_keywords: siteSettingsForm.site_keywords || null,
        logo_url: siteSettingsForm.logo_url || null,
        favicon_url: siteSettingsForm.favicon_url || null,
        og_image_url: siteSettingsForm.og_image_url || null,
        footer_text: siteSettingsForm.footer_text || null,
        disclaimer_text: siteSettingsForm.disclaimer_text || null,
        show_disclaimer: siteSettingsForm.show_disclaimer,
        google_analytics_id: siteSettingsForm.google_analytics_id || null,
        // Ad settings
        ads_enabled: siteSettingsForm.ads_enabled,
        google_adsense_id: siteSettingsForm.google_adsense_id || null,
        header_ad_code: siteSettingsForm.header_ad_code || null,
        sidebar_ad_code: siteSettingsForm.sidebar_ad_code || null,
        footer_ad_code: siteSettingsForm.footer_ad_code || null,
        in_article_ad_code: siteSettingsForm.in_article_ad_code || null,
        popup_ad_code: siteSettingsForm.popup_ad_code || null,
        // Additional SEO
        canonical_url: siteSettingsForm.canonical_url || null,
        twitter_handle: siteSettingsForm.twitter_handle || null,
        facebook_app_id: siteSettingsForm.facebook_app_id || null,
        telegram_link: siteSettingsForm.telegram_link || null,
        // Cricket API settings (legacy)
        cricket_api_key: siteSettingsForm.cricket_api_key || null,
        cricket_api_enabled: siteSettingsForm.cricket_api_enabled,
        // API Cricket settings (api-cricket.com)
        api_cricket_key: siteSettingsForm.api_cricket_key || null,
        api_cricket_enabled: siteSettingsForm.api_cricket_enabled,
        auto_match_result_enabled: siteSettingsForm.auto_match_result_enabled,
        api_sync_interval_seconds: siteSettingsForm.api_sync_interval_seconds || 120,
        // RapidAPI settings (Cricbuzz)
        rapidapi_key: siteSettingsForm.rapidapi_key || null,
        rapidapi_enabled: siteSettingsForm.rapidapi_enabled,
        rapidapi_endpoints: siteSettingsForm.rapidapi_endpoints || null,
        // Ads.txt
        ads_txt_content: siteSettingsForm.ads_txt_content || null,
        // Custom code injection
        custom_header_code: siteSettingsForm.custom_header_code || null,
        custom_footer_code: siteSettingsForm.custom_footer_code || null,
        // Banner slider settings
        slider_duration_seconds: siteSettingsForm.slider_duration_seconds || 6,
        // Homepage completed matches days
        homepage_completed_days: (siteSettingsForm as any).homepage_completed_days || 2,
        // Homepage channels limit
        homepage_channels_limit: (siteSettingsForm as any).homepage_channels_limit || 8,
        // Points table auto sync
        points_table_auto_sync_enabled: (siteSettingsForm as any).points_table_auto_sync_enabled || false,
        points_table_sync_time: (siteSettingsForm as any).points_table_sync_time || '03:00',
        // Playing XI auto sync source
        playing_xi_auto_sync_source: (siteSettingsForm as any).playing_xi_auto_sync_source || 'api_cricket',
      } as any);
      toast({ title: "Site settings updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl tracking-wide text-gradient mb-1 sm:mb-2">
                Admin Panel
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Manage matches, teams, tournaments & more
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleClearCache} className="flex-1 sm:flex-none">
                <RefreshCw className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Clear Cache</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="flex-1 sm:flex-none">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </motion.div>

          <Tabs defaultValue={visibleTabs[0] || "matches"} className="space-y-4 sm:space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
              <TabsList className="bg-muted/50 p-1 inline-flex flex-nowrap sm:flex-wrap h-auto gap-1 w-max sm:w-auto">
                {canManageMatches && (
                  <TabsTrigger value="matches" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Matches
                  </TabsTrigger>
                )}
                {canManageMatches && (
                  <TabsTrigger value="live-scores" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Live Scores
                  </TabsTrigger>
                )}
                {canManageStreaming && (
                  <TabsTrigger value="streaming" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Streaming
                  </TabsTrigger>
                )}
                {canManageTeams && (
                  <TabsTrigger value="teams" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Teams
                  </TabsTrigger>
                )}
                {canManageTournaments && (
                  <TabsTrigger value="tournaments" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Tournaments
                  </TabsTrigger>
                )}
                {canManagePointsTable && (
                  <TabsTrigger value="points-table" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Points Table
                  </TabsTrigger>
                )}
                {canManageMatches && (
                  <TabsTrigger value="sports" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Sports
                  </TabsTrigger>
                )}
                {canManageBanners && (
                  <TabsTrigger value="banners" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Banners
                  </TabsTrigger>
                )}
                {canManageStreaming && (
                  <TabsTrigger value="channels" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Channels
                  </TabsTrigger>
                )}
                {canManagePages && (
                  <TabsTrigger value="pages" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Pages
                  </TabsTrigger>
                )}
                {canManagePages && (
                  <TabsTrigger value="menus" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Menus
                  </TabsTrigger>
                )}
                {canManageAds && (
                  <TabsTrigger value="ads" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Ads
                  </TabsTrigger>
                )}
                {canManageApiKeys && (
                  <TabsTrigger value="live-api" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Live Score API
                  </TabsTrigger>
                )}
                {canManageSeo && (
                  <TabsTrigger value="sitemap" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Sitemap
                  </TabsTrigger>
                )}
                {canManageSponsor && (
                  <TabsTrigger value="sponsor" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Sponsor Notice
                  </TabsTrigger>
                )}
                {canManageSettings && (
                  <TabsTrigger value="settings" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Settings
                  </TabsTrigger>
                )}
                {canManageUsers && (
                  <TabsTrigger value="users" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Users
                  </TabsTrigger>
                )}
                {canManageSettings && (
                  <TabsTrigger value="maintenance" className="text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3">
                    Maintenance
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Matches Tab */}
            <TabsContent value="matches" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-semibold">All Matches</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <CricketMatchImporter />
                  <FootballMatchImporter />
                  <Dialog open={matchDialogOpen} onOpenChange={(open) => {
                    setMatchDialogOpen(open);
                    if (!open) resetMatchForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="gradient" size="sm">
                        <Plus className="w-4 h-4" />
                        Add Match
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingMatch ? 'Edit Match' : 'Add New Match'}</DialogTitle>
                      <DialogDescription>
                        Fill in the match details below
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Sport and Tournament Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sport *</Label>
                          <Select value={matchForm.sport_id || ''} onValueChange={(v) => setMatchForm({ ...matchForm, sport_id: v || null })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sport" />
                            </SelectTrigger>
                            <SelectContent>
                              {sports?.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Tournament (optional)</Label>
                          <SearchableSelect
                            options={[
                              { value: 'none', label: 'No Tournament' },
                              ...(tournaments?.map((t) => ({
                                value: t.id,
                                label: t.name,
                                sublabel: t.season,
                                imageUrl: t.logo_url,
                              })) || [])
                            ]}
                            value={matchForm.tournament_id || 'none'}
                            onValueChange={(v) => setMatchForm({ ...matchForm, tournament_id: v === 'none' ? null : v })}
                            placeholder="Select tournament (optional)"
                            searchPlaceholder="Search tournaments..."
                            emptyText="No tournaments found."
                          />
                        </div>
                      </div>
                      
                      {/* Teams Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Team A *</Label>
                          <SearchableSelect
                            options={teams?.map((t) => ({
                              value: t.id,
                              label: t.name,
                              sublabel: t.short_name,
                              imageUrl: t.logo_url,
                            })) || []}
                            value={matchForm.team_a_id}
                            onValueChange={(v) => setMatchForm({ ...matchForm, team_a_id: v })}
                            placeholder="Select team"
                            searchPlaceholder="Search teams..."
                            emptyText="No teams found."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Team B *</Label>
                          <SearchableSelect
                            options={teams?.map((t) => ({
                              value: t.id,
                              label: t.name,
                              sublabel: t.short_name,
                              imageUrl: t.logo_url,
                            })) || []}
                            value={matchForm.team_b_id}
                            onValueChange={(v) => setMatchForm({ ...matchForm, team_b_id: v })}
                            placeholder="Select team"
                            searchPlaceholder="Search teams..."
                            emptyText="No teams found."
                          />
                        </div>
                      </div>
                      
                      {/* Match Number and Status Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Match Number (optional)</Label>
                          <div className="space-y-2">
                            <Input 
                              type="text" 
                              placeholder="e.g., 1, Round 7, Match 15"
                              value={matchForm.match_number || ''} 
                              onChange={(e) => setMatchForm({ ...matchForm, match_number: e.target.value })} 
                            />
                            <div className="flex flex-wrap gap-1">
                              {['1', '2', '3', '4', '5'].map((num) => (
                                <Button
                                  key={num}
                                  type="button"
                                  variant={matchForm.match_number === num ? 'default' : 'outline'}
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setMatchForm({ ...matchForm, match_number: num })}
                                >
                                  {num}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={matchForm.status} onValueChange={(v: 'upcoming' | 'live' | 'completed' | 'abandoned' | 'postponed') => setMatchForm({ ...matchForm, status: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upcoming">Upcoming</SelectItem>
                              <SelectItem value="live">Live</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="abandoned">Abandoned</SelectItem>
                              <SelectItem value="postponed">Postponed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="is_active"
                            checked={matchForm.is_active}
                            onCheckedChange={(checked) => setMatchForm({ ...matchForm, is_active: checked })}
                          />
                          <Label htmlFor="is_active">Show on Homepage</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="manual_status_override"
                            checked={matchForm.manual_status_override}
                            onCheckedChange={(checked) => setMatchForm({ ...matchForm, manual_status_override: checked })}
                          />
                          <Label htmlFor="manual_status_override" className="text-sm">
                            Lock Status (Disable Auto-Update)
                          </Label>
                        </div>
                      </div>
                      
                      {/* Match Result - Only show when status is completed */}
                      {matchForm.status === 'completed' && (
                        <div className="space-y-2">
                          <Label>Match Result *</Label>
                          <Select 
                            value={matchForm.match_result || 'none'} 
                            onValueChange={(v) => setMatchForm({ 
                              ...matchForm, 
                              match_result: v === 'none' ? null : v as 'team_a_won' | 'team_b_won' | 'tied' | 'no_result' | 'draw'
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not Set</SelectItem>
                              <SelectItem value="team_a_won">
                                {teams?.find(t => t.id === matchForm.team_a_id)?.short_name || 'Team A'} Won
                              </SelectItem>
                              <SelectItem value="team_b_won">
                                {teams?.find(t => t.id === matchForm.team_b_id)?.short_name || 'Team B'} Won
                              </SelectItem>
                              <SelectItem value="tied">Tied</SelectItem>
                              <SelectItem value="no_result">No Result</SelectItem>
                              <SelectItem value="draw">Draw</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            ✅ Recommended: Set this manually. Points table updates automatically on save.
                          </p>
                          <Button 
                            type="button"
                            variant="outline" 
                            size="sm" 
                            className="mt-2 w-full"
                            onClick={async () => {
                              if (!editingMatch?.id) return;
                              try {
                                const { data, error } = await supabase.functions.invoke('sync-match-nrr', {
                                  body: { matchId: editingMatch.id }
                                });
                                if (error) throw error;
                                if (data?.success) {
                                  toast({ title: "NRR synced", description: "Points table updated with match NRR contribution" });
                                } else {
                                  toast({ title: "Sync failed", description: data?.error || 'Unknown error', variant: "destructive" });
                                }
                              } catch (err: any) {
                                toast({ title: "Error", description: err.message, variant: "destructive" });
                              }
                            }}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Sync NRR to Points Table
                          </Button>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Match Label (optional)</Label>
                        <div className="space-y-2">
                          <Input 
                            type="text" 
                            placeholder="e.g., Final, Semi-Final, Group A"
                            value={matchForm.match_label || ''} 
                            onChange={(e) => setMatchForm({ ...matchForm, match_label: e.target.value })} 
                          />
                          <div className="flex flex-wrap gap-1">
                            {['Final', 'Semi-Final', 'Quarter-Final', 'Qualifier', 'Eliminator', 'Group Stage'].map((label) => (
                              <Button
                                key={label}
                                type="button"
                                variant={matchForm.match_label === label ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setMatchForm({ ...matchForm, match_label: matchForm.match_label === label ? '' : label })}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Priority Match Toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500" />
                            Priority Match
                          </Label>
                          <p className="text-xs text-muted-foreground">Show this match at the top of the list</p>
                        </div>
                        <Switch
                          checked={matchForm.is_priority}
                          onCheckedChange={(checked) => setMatchForm({ ...matchForm, is_priority: checked })}
                        />
                      </div>

                      {/* Show Playing XI Toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            Show Playing XI
                          </Label>
                          <p className="text-xs text-muted-foreground">Display Playing XI section on match page</p>
                        </div>
                        <Switch
                          checked={matchForm.show_playing_xi}
                          onCheckedChange={(checked) => setMatchForm({ ...matchForm, show_playing_xi: checked })}
                        />
                      </div>

                      {/* Manual Scoreboard Toggle (hidden by default for manual matches) */}
                      <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            Show Manual Scoreboard
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Manual matches hide the score by default. Enable to display score_a / score_b on cards & match page.
                          </p>
                        </div>
                        <Switch
                          checked={matchForm.manual_scoreboard_enabled}
                          onCheckedChange={(checked) => setMatchForm({ ...matchForm, manual_scoreboard_enabled: checked })}
                        />
                      </div>



                      <div className="space-y-2">
                        <Label>Match Date & Time *</Label>
                        <DateTimePicker
                          value={matchForm.match_start_time ? new Date(matchForm.match_start_time) : null}
                          onChange={(date) => {
                            if (date) {
                              const dateStr = format(date, "do MMMM yyyy");
                              const timeStr = format(date, "h:mm a");
                              setMatchForm({
                                ...matchForm,
                                match_start_time: date.toISOString(),
                                match_date: dateStr,
                                match_time: timeStr
                              });
                            } else {
                              setMatchForm({
                                ...matchForm,
                                match_start_time: null,
                                match_date: '',
                                match_time: ''
                              });
                            }
                          }}
                          placeholder="Select match date & time"
                        />
                        {matchForm.match_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {matchForm.match_date} at {matchForm.match_time}
                          </p>
                        )}
                      </div>
                      
                      {/* Match Duration/End Time Selection */}
                      <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/10">
                        <div className="flex items-center gap-4">
                          <Label className="text-sm font-medium">Match Length:</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={matchForm.duration_type === 'duration' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMatchForm({ ...matchForm, duration_type: 'duration', match_end_time: null })}
                            >
                              Duration
                            </Button>
                            <Button
                              type="button"
                              variant={matchForm.duration_type === 'end_time' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setMatchForm({ ...matchForm, duration_type: 'end_time', match_duration_minutes: 0 })}
                            >
                              End Time
                            </Button>
                          </div>
                        </div>
                        
                        {matchForm.duration_type === 'duration' ? (
                          <div className="space-y-2">
                            <Label>Duration (minutes)</Label>
                            <Input 
                              type="number" 
                              placeholder="180" 
                            value={matchForm.match_duration_minutes ?? ''} 
                            onChange={(e) => setMatchForm({ ...matchForm, match_duration_minutes: e.target.value ? parseInt(e.target.value) : null })} 
                            />
                            <p className="text-xs text-muted-foreground">How long the match will run</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label>Match End Date & Time</Label>
                            <DateTimePicker
                              value={matchForm.match_end_time ? new Date(matchForm.match_end_time) : null}
                              onChange={(date) => setMatchForm({ 
                                ...matchForm, 
                                match_end_time: date ? date.toISOString() : null 
                              })}
                              placeholder="Select end date & time"
                            />
                            <p className="text-xs text-muted-foreground">When the match will end</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Venue (optional)</Label>
                        <VenueComboInput
                          tournamentId={matchForm.tournament_id || undefined}
                          value={matchForm.venue}
                          onChange={(v) => setMatchForm({ ...matchForm, venue: v })}
                        />
                      </div>
                      
                      {/* Page Type Selection */}
                      <div className="space-y-2">
                        <Label>Match Page Type</Label>
                        <Select value={matchForm.page_type} onValueChange={(v) => setMatchForm({ ...matchForm, page_type: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="redirect">Redirect URL</SelectItem>
                            <SelectItem value="page">SEO Match Page</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {matchForm.page_type === 'redirect' 
                            ? 'Match card will redirect to an external URL' 
                            : 'Auto-generate an SEO-friendly match page with streaming servers'}
                        </p>
                      </div>

                      {matchForm.page_type === 'redirect' ? (
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" />
                            Match Link (redirect URL)
                          </Label>
                          <Input placeholder="https://..." value={matchForm.match_link} onChange={(e) => setMatchForm({ ...matchForm, match_link: e.target.value })} />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Globe className="w-4 h-4" />
                              Custom URL Slug (optional)
                              {isCheckingSlug && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                            </Label>
                            <Input 
                              placeholder="e.g., team-a-vs-team-b-live" 
                              value={matchForm.slug} 
                              onChange={(e) => {
                                // Sanitize slug: lowercase, replace spaces with dashes, remove special chars
                                const sanitized = e.target.value.toLowerCase()
                                  .replace(/\s+/g, '-')
                                  .replace(/[^a-z0-9-]/g, '');
                                setMatchForm({ ...matchForm, slug: sanitized });
                              }} 
                              className={slugConflict ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                            />
                            {slugConflict ? (
                              <div className="p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
                                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                                  <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                  <span>
                                    <strong>Slug in use:</strong> Currently assigned to <strong>{slugConflict.teamA} vs {slugConflict.teamB}</strong> ({slugConflict.matchDate}). 
                                    Saving will transfer this URL to the new match.
                                  </span>
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Leave empty to auto-generate from team names. Same slug can be reused for recurring matches.</p>
                            )}
                          </div>
                          {/* Import SEO from Tournament Button */}
                          {matchForm.tournament_id && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => {
                                const selectedTournament = tournaments?.find(t => t.id === matchForm.tournament_id);
                                if (selectedTournament) {
                                  setMatchForm({
                                    ...matchForm,
                                    seo_title: selectedTournament.seo_title || '',
                                    seo_description: selectedTournament.seo_description || '',
                                    seo_keywords: selectedTournament.seo_keywords || ''
                                  });
                                  toast({ title: "SEO Imported", description: "Tournament SEO details imported successfully" });
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                              Import SEO from Tournament
                            </Button>
                          )}
                          <div className="space-y-2">
                            <Label>SEO Title (optional)</Label>
                            <Input 
                              placeholder="e.g., Team A vs Team B Live Stream" 
                              value={matchForm.seo_title} 
                              onChange={(e) => setMatchForm({ ...matchForm, seo_title: e.target.value })} 
                            />
                            <p className="text-xs text-muted-foreground">Leave empty to auto-generate from team names</p>
                          </div>
                          <div className="space-y-2">
                            <Label>SEO Description (optional)</Label>
                            <Input 
                              placeholder="Watch live stream online..." 
                              value={matchForm.seo_description} 
                              onChange={(e) => setMatchForm({ ...matchForm, seo_description: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>SEO Keywords (optional)</Label>
                            <Input 
                              placeholder="team a, team b, live stream, cricket match" 
                              value={matchForm.seo_keywords} 
                              onChange={(e) => setMatchForm({ ...matchForm, seo_keywords: e.target.value })} 
                            />
                            <p className="text-xs text-muted-foreground">Comma-separated keywords for this match page</p>
                          </div>
                        </>
                      )}
                      
                      {/* Cricket Format Settings */}
                      <div className="space-y-4 p-4 rounded-lg border border-border/50 bg-muted/20">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4" />
                          Cricket Match Format (optional)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Match Format</Label>
                            <Select value={matchForm.match_format || 'none'} onValueChange={(v) => setMatchForm({ ...matchForm, match_format: v === 'none' ? null : v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Format</SelectItem>
                                <SelectItem value="test">Test</SelectItem>
                                <SelectItem value="odi">ODI</SelectItem>
                                <SelectItem value="t20">T20</SelectItem>
                                <SelectItem value="t10">T10</SelectItem>
                                <SelectItem value="the_hundred">The Hundred</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {matchForm.match_format === 'test' && (
                            <div className="space-y-2">
                              <Label>Test Day (1-5)</Label>
                              <Select value={matchForm.test_day?.toString() || ''} onValueChange={(v) => setMatchForm({ ...matchForm, test_day: v ? parseInt(v) : null })}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1">Day 1</SelectItem>
                                  <SelectItem value="2">Day 2</SelectItem>
                                  <SelectItem value="3">Day 3</SelectItem>
                                  <SelectItem value="4">Day 4</SelectItem>
                                  <SelectItem value="5">Day 5</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        {matchForm.match_format === 'test' && (
                          <div className="space-y-4 pt-2 border-t border-border/30">
                            {/* Manual STUMPS/Resume Controls */}
                            <div className="flex gap-2">
                              {!matchForm.is_stumps ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1 gap-2 border-slate-500/50 hover:bg-slate-500/20"
                                  onClick={() => {
                                    const now = new Date();
                                    let nextStart: string | null = null;
                                    if (matchForm.day_start_time) {
                                      const tomorrow = new Date(now);
                                      tomorrow.setDate(tomorrow.getDate() + 1);
                                      const [hours, minutes] = matchForm.day_start_time.split(':').map(Number);
                                      tomorrow.setHours(hours, minutes, 0, 0);
                                      nextStart = tomorrow.toISOString();
                                    }
                                    setMatchForm({
                                      ...matchForm,
                                      is_stumps: true,
                                      stumps_time: now.toISOString(),
                                      next_day_start: nextStart,
                                    });
                                    toast({ title: "STUMPS set", description: "Don't forget to save the match!" });
                                  }}
                                >
                                  <Moon className="w-4 h-4" />
                                  Call STUMPS Now
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex-1 gap-2 border-green-500/50 hover:bg-green-500/20 text-green-500"
                                  onClick={() => {
                                    setMatchForm({
                                      ...matchForm,
                                      is_stumps: false,
                                      test_day: (matchForm.test_day || 1) + 1,
                                      next_day_start: null,
                                      stumps_time: null,
                                    });
                                    toast({ title: "Play resumed", description: `Day ${(matchForm.test_day || 1) + 1} set. Don't forget to save!` });
                                  }}
                                >
                                  <Play className="w-4 h-4" />
                                  Resume Play (Start Day {(matchForm.test_day || 1) + 1})
                                </Button>
                              )}
                            </div>

                            {/* Current Status */}
                            {matchForm.is_stumps && (
                              <Badge className="bg-slate-600 text-white">
                                <Moon className="w-3 h-3 mr-1" />
                                STUMPS - Day {matchForm.test_day || 1} ended
                              </Badge>
                            )}

                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <Sun className="w-3 h-3 text-yellow-500" />
                                Daily Start Time (Auto-Resume)
                              </Label>
                              <Input
                                type="time"
                                value={matchForm.day_start_time || ''}
                                onChange={(e) => setMatchForm({ ...matchForm, day_start_time: e.target.value || null })}
                                placeholder="10:00"
                              />
                              <p className="text-xs text-muted-foreground">
                                At this time daily, Day auto-increments & STUMPS is removed.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <Moon className="w-3 h-3 text-slate-400" />
                                Daily STUMPS Time (Auto-Call)
                              </Label>
                              <Input
                                type="time"
                                value={matchForm.daily_stumps_time || ''}
                                onChange={(e) => setMatchForm({ ...matchForm, daily_stumps_time: e.target.value || null })}
                                placeholder="17:00"
                              />
                              <p className="text-xs text-muted-foreground">
                                At this time daily, STUMPS is called automatically.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {matchForm.status !== 'upcoming' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Score A</Label>
                            <Input placeholder="e.g., 180/5" value={matchForm.score_a} onChange={(e) => setMatchForm({ ...matchForm, score_a: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Score B</Label>
                            <Input placeholder="e.g., 175/8" value={matchForm.score_b} onChange={(e) => setMatchForm({ ...matchForm, score_b: e.target.value })} />
                          </div>
                        </div>
                      )}

                      {/* Cricket Score Source Selection */}
                      <div className="rounded-lg border p-4 shadow-sm bg-muted/20 space-y-3">
                        <div className="space-y-0.5">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Radio className="w-4 h-4 text-live" />
                            Cricket Score Source
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Enable to sync toss, live score, and scorecard
                          </p>
                        </div>
                        <Switch
                          checked={matchForm.score_source === 'api_cricket'}
                          onCheckedChange={(checked) => setMatchForm({ 
                            ...matchForm, 
                            score_source: checked ? 'api_cricket' : (matchForm.score_source === 'api_cricket' ? 'manual' : matchForm.score_source),
                            api_score_enabled: checked,
                          })}
                        />
                      </div>

                      {/* ESPN Cricinfo Toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                        <div className="space-y-0.5">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Radio className="w-4 h-4 text-blue-500" />
                            ESPN Cricinfo
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Enable to sync toss, live score, scorecard and Playing XI
                          </p>
                        </div>
                        <Switch
                          checked={matchForm.score_source === 'espn'}
                          onCheckedChange={(checked) => setMatchForm({ 
                            ...matchForm, 
                            score_source: checked ? 'espn' : (matchForm.score_source === 'espn' ? 'manual' : matchForm.score_source),
                            api_score_enabled: checked,
                          })}
                        />
                      </div>



                      {/* Football Auto-Sync Toggle */}
                      <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm bg-muted/20">
                        <div className="space-y-0.5">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            Football Auto-Sync (ESPN)
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Automatically sync live football scores from ESPN API every 60 seconds
                          </p>
                        </div>
                        <Switch
                          checked={matchForm.auto_sync_enabled}
                          onCheckedChange={(checked) => setMatchForm({ ...matchForm, auto_sync_enabled: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <Label className="text-sm font-medium">
                            Auto Match Result
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            ম্যাচ শেষে API থেকে অটো result সেট করবে
                          </p>
                        </div>
                        <Switch
                          checked={matchForm.auto_match_result_enabled}
                          onCheckedChange={(checked) => setMatchForm({ ...matchForm, auto_match_result_enabled: checked })}
                        />
                      </div>

                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={handleSaveMatch} disabled={createMatch.isPending || updateMatch.isPending}>
                        {(createMatch.isPending || updateMatch.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingMatch ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              {/* Match Search & Filter */}
              <div className="space-y-3">
                <Input
                  placeholder="Search matches by team name, tournament, or venue..."
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                  className="w-full md:max-w-md"
                />
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
                    <div className="flex gap-1.5 w-max sm:w-auto">
                      {(['all', 'live', 'upcoming', 'completed'] as const).map((status) => (
                        <Button
                          key={status}
                          variant={matchStatusFilter === status ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMatchStatusFilter(status)}
                          className="capitalize text-xs sm:text-sm px-2.5 sm:px-3"
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Select value={matchSportFilter} onValueChange={setMatchSportFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="All Sports" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {sports?.map((sport) => (
                        <SelectItem key={sport.id} value={sport.id}>{sport.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {matchesLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (() => {
                const filteredMatches = matches
                  ?.filter((match) => {
                    if (matchStatusFilter !== 'all' && match.status !== matchStatusFilter) return false;
                    if (matchSportFilter !== 'all' && match.sport_id !== matchSportFilter) return false;
                    if (!matchSearchQuery.trim()) return true;
                    const query = matchSearchQuery.toLowerCase();
                    return (
                      match.team_a?.name?.toLowerCase().includes(query) ||
                      match.team_b?.name?.toLowerCase().includes(query) ||
                      match.team_a?.short_name?.toLowerCase().includes(query) ||
                      match.team_b?.short_name?.toLowerCase().includes(query) ||
                      match.tournament?.name?.toLowerCase().includes(query) ||
                      match.venue?.toLowerCase().includes(query) ||
                      match.match_label?.toLowerCase().includes(query)
                    );
                  })
                  .sort((a, b) => {
                    // Use effective status for sorting
                    const effectiveStatusA = getEffectiveMatchStatus(a);
                    const effectiveStatusB = getEffectiveMatchStatus(b);
                    const statusOrder: Record<string, number> = { live: 0, upcoming: 1, completed: 2, abandoned: 3 };
                    const statusDiff = (statusOrder[effectiveStatusA] ?? 4) - (statusOrder[effectiveStatusB] ?? 4);
                    if (statusDiff !== 0) return statusDiff;
                    // Within same status, sort by start time (earlier first for upcoming, later first for completed)
                    const timeA = a.match_start_time ? new Date(a.match_start_time).getTime() : 0;
                    const timeB = b.match_start_time ? new Date(b.match_start_time).getTime() : 0;
                    if (effectiveStatusA === 'completed') {
                      return timeB - timeA; // Most recent completed first
                    }
                    return timeA - timeB; // Earliest upcoming/live first
                  }) || [];
                const filteredMatchIds = filteredMatches.map(m => m.id);
                const allSelected = filteredMatchIds.length > 0 && filteredMatchIds.every(id => selectedMatches.has(id));
                
                return (
                  <div className="space-y-4">
                    {/* Bulk Actions Bar */}
                    {filteredMatches.length > 0 && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllMatchesSelection(filteredMatchIds)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {selectedMatches.size > 0 ? `${selectedMatches.size} selected` : 'Select all'}
                          </span>
                        </div>
                        {selectedMatches.size > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setBulkDeleteMatchesDialogOpen(true)}
                            disabled={isBulkDeleting}
                          >
                            {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete {selectedMatches.size}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    <div className="grid gap-4">
                      {filteredMatches.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No matches yet. Add your first match!</p>
                      )}
                      {filteredMatches.map((match, index) => (
                        <motion.div
                          key={match.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className={`hover:border-primary/50 transition-colors ${match.is_priority ? 'border-yellow-500/50 bg-yellow-500/5' : ''} ${selectedMatches.has(match.id) ? 'border-primary bg-primary/5' : ''}`}>
                            <CardContent className="p-4">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <Checkbox
                                    checked={selectedMatches.has(match.id)}
                                    onCheckedChange={() => toggleMatchSelection(match.id)}
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      {match.is_priority && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                                      {match.match_label && <Badge variant="outline" className="text-xs">{match.match_label}</Badge>}
                                      <Badge variant="sport">{match.sport?.name || match.tournament?.sport}</Badge>
                                      {match.tournament && (
                                        <span className="text-muted-foreground text-sm">
                                          {match.tournament.name} {match.tournament.season}
                                        </span>
                                      )}
                                      {match.match_link && (
                                        <LinkIcon className="w-3 h-3 text-primary" />
                                      )}
                                    </div>
                                    <p className="font-semibold text-lg">
                                      {match.team_a?.name} vs {match.team_b?.name}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                      {match.match_date} • {match.match_time}
                                      {match.venue && ` • ${match.venue}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                                  {(() => {
                                    const effectiveStatus = getEffectiveMatchStatus(match);
                                    return (
                                      <Badge variant={effectiveStatus === 'live' ? 'live' : effectiveStatus === 'completed' ? 'completed' : 'upcoming'}>
                                        {effectiveStatus}
                                      </Badge>
                                    );
                                  })()}
                                  {match.sport?.name?.toLowerCase() === 'cricket' && (
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedMatchForInnings(match);
                                        setInningsDialogOpen(true);
                                      }}
                                    >
                                      <Play className="w-3 h-3 mr-1" />
                                      Innings
                                    </Button>
                                  )}
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedMatchForPlayingXI(match);
                                      setPlayingXIDialogOpen(true);
                                    }}
                                  >
                                    <Users className="w-3 h-3 mr-1" />
                                    XI
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleEditMatch(match)} title="Edit match">
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleCopyMatch(match)} title="Duplicate match">
                                    <Copy className="w-4 h-4 text-primary" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleSyncFromApiCricket(match)} 
                                    disabled={syncingMatchId === match.id}
                                    title="Sync from API Cricket"
                                  >
                                    {syncingMatchId === match.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                    ) : (
                                      <CloudDownload className="w-4 h-4 text-blue-500" />
                                    )}
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleForceResync(match)} 
                                    disabled={forceSyncingMatchId === match.id}
                                    title="Force Re-sync scores"
                                  >
                                    {forceSyncingMatchId === match.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                                    ) : (
                                      <RefreshCw className="w-4 h-4 text-orange-500" />
                                    )}
                                  </Button>
                                  {match.page_type === 'page' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => submitMatchForIndexing(match.id)} 
                                      title="Submit to Google"
                                    >
                                      <Globe className="w-4 h-4 text-green-500" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" onClick={() => setDeleteMatchId(match.id)} title="Delete match">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* Live Scores Tab */}
            <TabsContent value="live-scores" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Live Score Updates</h2>
                  <p className="text-sm text-muted-foreground">Quickly update scores for live matches</p>
                </div>
              </div>

              {matchesLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {matches?.filter(m => m.status === 'live').length === 0 && (
                    <div className="col-span-full text-center py-8">
                      <p className="text-muted-foreground">No live matches at the moment.</p>
                      <p className="text-sm text-muted-foreground mt-1">Set a match status to "Live" to update its score here.</p>
                    </div>
                  )}
                  {matches?.filter(m => m.status === 'live').map((match) => (
                    <LiveScoreUpdater key={match.id} match={match} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Streaming Servers Tab */}
            <TabsContent value="streaming" className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold">Streaming Servers</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Manage M3U8 and iframe links for each match</p>
                </div>
              </div>

              <StreamingJsonSourcesManager />

              {/* Streaming Search & Filter */}
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Search matches by team name..."
                  value={streamingSearchQuery}
                  onChange={(e) => setStreamingSearchQuery(e.target.value)}
                  className="w-full"
                />
                <div className="flex flex-wrap gap-2">
                  {(['all', 'live', 'upcoming', 'completed'] as const).map((status) => (
                    <Button
                      key={status}
                      variant={streamingStatusFilter === status ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStreamingStatusFilter(status)}
                      className="capitalize text-xs sm:text-sm"
                    >
                      {status}
                    </Button>
                  ))}
                  <Select value={streamingSportFilter} onValueChange={setStreamingSportFilter}>
                    <SelectTrigger className="w-[120px] sm:w-[140px] text-xs sm:text-sm">
                      <SelectValue placeholder="All Sports" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {sports?.map((sport) => (
                        <SelectItem key={sport.id} value={sport.id}>{sport.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {matchesLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="space-y-4">
                  {matches?.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No matches available. Create matches first to add streaming servers.</p>
                  )}
                  {matches
                    ?.filter(m => m.page_type === 'page')
                    .filter((match) => {
                      // Status filter
                      if (streamingStatusFilter !== 'all' && match.status !== streamingStatusFilter) return false;
                      // Sport filter
                      if (streamingSportFilter !== 'all' && match.sport_id !== streamingSportFilter) return false;
                      // Search filter
                      if (!streamingSearchQuery.trim()) return true;
                      const query = streamingSearchQuery.toLowerCase();
                      return (
                        match.team_a?.name?.toLowerCase().includes(query) ||
                        match.team_b?.name?.toLowerCase().includes(query) ||
                        match.team_a?.short_name?.toLowerCase().includes(query) ||
                        match.team_b?.short_name?.toLowerCase().includes(query)
                      );
                    })
                    .sort((a, b) => {
                      // Sort by status: live first, then upcoming, then completed
                      const statusOrder = { live: 0, upcoming: 1, completed: 2 };
                      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
                      if (statusDiff !== 0) return statusDiff;
                      // Within same status: upcoming = earliest first, completed = latest first
                      const timeA = a.match_start_time ? new Date(a.match_start_time).getTime() : 0;
                      const timeB = b.match_start_time ? new Date(b.match_start_time).getTime() : 0;
                      if (a.status === 'completed') return timeB - timeA;
                      return timeA - timeB;
                    })
                    .map((match, index) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Card className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/20 flex-shrink-0">
                                <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm sm:text-base truncate">
                                  {match.team_a?.name || 'TBA'} vs {match.team_b?.name || 'TBA'}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {match.match_date} • {match.match_time}
                                </p>
                              </div>
                              {(() => {
                                const effStatus = getEffectiveMatchStatus(match);
                                return (
                                  <Badge variant={effStatus === 'live' ? 'live' : effStatus === 'completed' ? 'completed' : 'upcoming'} className="text-xs flex-shrink-0">{effStatus}</Badge>
                                );
                              })()}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button 
                                variant="gradient" 
                                size="sm"
                                onClick={() => {
                                  setSelectedMatchForStreaming(match);
                                  setStreamingDialogOpen(true);
                                }}
                                className="flex-1 sm:flex-none text-xs sm:text-sm relative"
                              >
                                <Tv className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                Servers
                                {serverCounts && serverCounts[match.id] > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                    {serverCounts[match.id]}
                                  </span>
                                )}
                              </Button>
                              <label className="flex items-center gap-1.5 text-xs px-2 py-1 border rounded-md cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  checked={(match as any).auto_streaming_enabled !== false}
                                  onChange={async (e) => {
                                    await supabase.from('matches').update({ auto_streaming_enabled: e.target.checked } as any).eq('id', match.id);
                                    queryClient.invalidateQueries({ queryKey: ['matches'] });
                                  }}
                                />
                                Auto JSON
                              </label>
                              {match.sport?.name?.toLowerCase() === 'cricket' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMatchForInnings(match);
                                    setInningsDialogOpen(true);
                                  }}
                                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                                >
                                  <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                  Innings
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedMatchForPlayingXI(match);
                                  setPlayingXIDialogOpen(true);
                                }}
                                className="flex-1 sm:flex-none text-xs sm:text-sm"
                              >
                                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                                XI
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                  {matches?.filter(m => m.page_type === 'page').length === 0 && matches?.length > 0 && (
                    <Card className="border-dashed">
                      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                        <Tv className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground">No matches with "Page" type found</p>
                        <p className="text-sm text-muted-foreground/70">Set match page type to "Page" to add streaming servers</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Streaming Servers Dialog */}
            <Dialog open={streamingDialogOpen} onOpenChange={(open) => {
              setStreamingDialogOpen(open);
              if (!open) setSelectedMatchForStreaming(null);
            }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                {selectedMatchForStreaming && (
                  <StreamingServersManager
                    match={selectedMatchForStreaming}
                    onClose={() => {
                      setStreamingDialogOpen(false);
                      setSelectedMatchForStreaming(null);
                    }}
                  />
                )}
              </DialogContent>
            </Dialog>

            {/* Innings Management Dialog */}
            <Dialog open={inningsDialogOpen} onOpenChange={(open) => {
              setInningsDialogOpen(open);
              if (!open) setSelectedMatchForInnings(null);
            }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Manage Innings - {selectedMatchForInnings?.team_a?.name} vs {selectedMatchForInnings?.team_b?.name}
                  </DialogTitle>
                </DialogHeader>
                {selectedMatchForInnings && selectedMatchForInnings.team_a && selectedMatchForInnings.team_b && (
                  <InningsManager
                    matchId={selectedMatchForInnings.id}
                    teamA={selectedMatchForInnings.team_a}
                    teamB={selectedMatchForInnings.team_b}
                    matchFormat={selectedMatchForInnings.match_format}
                  />
                )}
              </DialogContent>
            </Dialog>

            {/* Playing XI Management Dialog */}
            <Dialog open={playingXIDialogOpen} onOpenChange={(open) => {
              setPlayingXIDialogOpen(open);
              if (!open) setSelectedMatchForPlayingXI(null);
            }}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Playing XI - {selectedMatchForPlayingXI?.team_a?.name} vs {selectedMatchForPlayingXI?.team_b?.name}
                  </DialogTitle>
                </DialogHeader>
                {selectedMatchForPlayingXI && selectedMatchForPlayingXI.team_a && selectedMatchForPlayingXI.team_b && (
                  <div className="space-y-6">
                    {/* Manual Toss Manager - Only for Cricket */}
                    {!selectedMatchForPlayingXI.sport?.name?.toLowerCase().includes('football') && (
                      <ManualTossManager
                        matchId={selectedMatchForPlayingXI.id}
                        teamA={selectedMatchForPlayingXI.team_a}
                        teamB={selectedMatchForPlayingXI.team_b}
                      />
                    )}

                    {/* Playing XI / Lineup Manager */}
                    {selectedMatchForPlayingXI.sport?.name?.toLowerCase().includes('football') ? (
                      <FootballPlayingXIManager
                        matchId={selectedMatchForPlayingXI.id}
                        teamA={selectedMatchForPlayingXI.team_a}
                        teamB={selectedMatchForPlayingXI.team_b}
                      />
                    ) : (
                      <PlayingXIManager
                        matchId={selectedMatchForPlayingXI.id}
                        teamA={selectedMatchForPlayingXI.team_a}
                        teamB={selectedMatchForPlayingXI.team_b}
                        cricapiMatchId={(selectedMatchForPlayingXI as any).cricapi_match_id}
                      />
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Teams Tab */}
            <TabsContent value="teams" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Teams</h2>
                <Dialog open={teamDialogOpen} onOpenChange={(open) => {
                  setTeamDialogOpen(open);
                  if (!open) resetTeamForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" size="sm">
                      <Plus className="w-4 h-4" />
                      Add Team
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingTeam ? 'Edit Team' : 'Add New Team'}</DialogTitle>
                      <DialogDescription>
                        Fill in the team details below
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Team Name</Label>
                        <Input placeholder="e.g., Sylhet Titans" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Short Name</Label>
                        <Input placeholder="e.g., SYL" value={teamForm.short_name} onChange={(e) => setTeamForm({ ...teamForm, short_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Logo URL (optional)</Label>
                        <Input placeholder="https://..." value={teamForm.logo_url} onChange={(e) => setTeamForm({ ...teamForm, logo_url: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Logo Background Color</Label>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={teamForm.use_logo_background_color}
                            onCheckedChange={(checked) =>
                              setTeamForm({ ...teamForm, use_logo_background_color: checked === true })
                            }
                          />
                          <span className="text-xs text-muted-foreground">Use custom background</span>
                        </div>
                        <div className="flex gap-2">
                          <Input 
                            type="color" 
                            value={teamForm.logo_background_color} 
                            onChange={(e) => setTeamForm({ ...teamForm, logo_background_color: e.target.value })} 
                            disabled={!teamForm.use_logo_background_color}
                            className="w-14 h-10 p-1 cursor-pointer"
                          />
                          <Input 
                            placeholder="#1a1a2e" 
                            value={teamForm.logo_background_color} 
                            onChange={(e) => setTeamForm({ ...teamForm, logo_background_color: e.target.value })}
                            disabled={!teamForm.use_logo_background_color}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={handleSaveTeam} disabled={createTeam.isPending || updateTeam.isPending}>
                        {(createTeam.isPending || updateTeam.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingTeam ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Team Search */}
              <div className="mb-4">
                <Input
                  placeholder="Search teams by name or short name..."
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  className="max-w-md"
                />
              </div>

              {teamsLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (() => {
                const filteredTeams = teams
                  ?.filter((team) => {
                    if (!teamSearchQuery.trim()) return true;
                    const query = teamSearchQuery.toLowerCase();
                    return (
                      team.name?.toLowerCase().includes(query) ||
                      team.short_name?.toLowerCase().includes(query)
                    );
                  }) || [];
                const filteredTeamIds = filteredTeams.map(t => t.id);
                const allSelected = filteredTeamIds.length > 0 && filteredTeamIds.every(id => selectedTeams.has(id));

                return (
                  <div className="space-y-4">
                    {/* Bulk Actions Bar */}
                    {filteredTeams.length > 0 && (
                      <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleAllTeamsSelection(filteredTeamIds)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {selectedTeams.size > 0 ? `${selectedTeams.size} selected` : 'Select all'}
                          </span>
                        </div>
                        {selectedTeams.size > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setBulkDeleteTeamsDialogOpen(true)}
                            disabled={isBulkDeleting}
                          >
                            {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete {selectedTeams.size}
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredTeams.length === 0 && (
                        <p className="text-center text-muted-foreground py-8 col-span-full">No teams yet. Add your first team!</p>
                      )}
                      {filteredTeams.map((team, index) => (
                        <motion.div
                          key={team.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Card className={`hover:border-primary/50 transition-colors ${selectedTeams.has(team.id) ? 'border-primary bg-primary/5' : ''}`}>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                <Checkbox
                                  checked={selectedTeams.has(team.id)}
                                  onCheckedChange={() => toggleTeamSelection(team.id)}
                                />
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/20">
                                  {team.logo_url ? (
                                    <img src={team.logo_url} alt={team.name} className="w-8 h-8 object-contain" />
                                  ) : (
                                    <span className="font-display text-primary">{team.short_name}</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold">{team.name}</p>
                                  <p className="text-muted-foreground text-sm">{team.short_name}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditTeam(team)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => setDeleteTeamId(team.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            {/* Tournaments Tab */}
            <TabsContent value="tournaments" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Tournaments</h2>
                <Dialog open={tournamentDialogOpen} onOpenChange={(open) => {
                  setTournamentDialogOpen(open);
                  if (!open) resetTournamentForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" size="sm">
                      <Plus className="w-4 h-4" />
                      Add Tournament
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingTournament ? 'Edit Tournament' : 'Add New Tournament'}</DialogTitle>
                      <DialogDescription>
                        Fill in the tournament details below
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Tournament Name</Label>
                          <Input placeholder="e.g., BPL" value={tournamentForm.name} onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Sport</Label>
                          <Select value={tournamentForm.sport} onValueChange={(v) => setTournamentForm({ ...tournamentForm, sport: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {sports?.map((s) => (
                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Season</Label>
                          <Input placeholder="e.g., 2025-26" value={tournamentForm.season} onChange={(e) => setTournamentForm({ ...tournamentForm, season: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>URL Slug</Label>
                          <Input placeholder="e.g., bpl-2025" value={tournamentForm.slug} onChange={(e) => setTournamentForm({ ...tournamentForm, slug: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Logo URL (optional)</Label>
                          <Input placeholder="https://..." value={tournamentForm.logo_url} onChange={(e) => setTournamentForm({ ...tournamentForm, logo_url: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Logo Background</Label>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={tournamentForm.use_logo_background_color}
                              onCheckedChange={(checked) =>
                                setTournamentForm({ ...tournamentForm, use_logo_background_color: checked === true })
                              }
                            />
                            <span className="text-xs text-muted-foreground">Use custom background</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={tournamentForm.logo_background_color} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, logo_background_color: e.target.value })}
                              disabled={!tournamentForm.use_logo_background_color}
                              className="w-12 h-10 rounded-md border border-border cursor-pointer"
                            />
                            <Input 
                              placeholder="#1a1a2e" 
                              value={tournamentForm.logo_background_color} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, logo_background_color: e.target.value })}
                              disabled={!tournamentForm.use_logo_background_color}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tournament Details */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Tournament Details</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="space-y-2">
                            <Label>Total Matches</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 34" 
                              value={tournamentForm.total_matches ?? ''} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, total_matches: e.target.value ? parseInt(e.target.value) : null })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total Teams</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 6" 
                              value={tournamentForm.total_teams ?? ''} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, total_teams: e.target.value ? parseInt(e.target.value) : null })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Total Venues</Label>
                            <Input 
                              type="number" 
                              placeholder="e.g., 3" 
                              value={tournamentForm.total_venues ?? ''} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, total_venues: e.target.value ? parseInt(e.target.value) : null })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input 
                              type="date" 
                              value={tournamentForm.start_date || ''} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, start_date: e.target.value || null })} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>End Date</Label>
                            <Input 
                              type="date" 
                              value={tournamentForm.end_date || ''} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, end_date: e.target.value || null })} 
                            />
                          </div>
                        </div>
                        <div className="space-y-2 mt-4">
                          <Label>Tournament Description (SEO Friendly)</Label>
                          <Textarea 
                            placeholder="Write a detailed SEO-friendly description about the tournament. Include key information like format, participating teams, venue, etc." 
                            value={tournamentForm.description} 
                            onChange={(e) => setTournamentForm({ ...tournamentForm, description: e.target.value })}
                            rows={4}
                          />
                          <p className="text-xs text-muted-foreground">This description will be shown on the tournament page and helps with search engine optimization.</p>
                        </div>
                      </div>

                      {/* Display Settings */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Display Settings</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Show in Menu</Label>
                              <p className="text-sm text-muted-foreground">Display this tournament in the navigation menu dropdown</p>
                            </div>
                            <Switch
                              checked={tournamentForm.show_in_menu}
                              onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, show_in_menu: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Show in Homepage</Label>
                              <p className="text-sm text-muted-foreground">Display this tournament in the Live Tournaments list on homepage</p>
                            </div>
                            <Switch
                              checked={tournamentForm.show_in_homepage}
                              onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, show_in_homepage: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Show Points Table</Label>
                              <p className="text-sm text-muted-foreground">Display points table section on tournament page & Points Table manager</p>
                            </div>
                            <Switch
                              checked={tournamentForm.show_points_table}
                              onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, show_points_table: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm border-orange-500/30 bg-orange-500/5">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium text-orange-600 dark:text-orange-400">Tournament Completed</Label>
                              <p className="text-sm text-muted-foreground">Mark as completed when all matches are finished. Completed tournaments won't show in Points Table manager</p>
                            </div>
                            <Switch
                              checked={tournamentForm.is_completed}
                              onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, is_completed: checked })}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Participating Teams Section */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">Participating Teams Settings</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                            <div className="space-y-0.5">
                              <Label className="text-base font-medium">Show Participating Teams</Label>
                              <p className="text-sm text-muted-foreground">Display participating teams section on tournament page</p>
                            </div>
                            <Switch
                              checked={tournamentForm.show_participating_teams}
                              onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, show_participating_teams: checked })}
                            />
                          </div>
                          
                          {tournamentForm.show_participating_teams && (
                            <>
                              <div className="space-y-2">
                                <Label>Position</Label>
                                <Select 
                                  value={tournamentForm.participating_teams_position} 
                                  onValueChange={(v) => setTournamentForm({ ...tournamentForm, participating_teams_position: v })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="before_matches">Before Matches (Current)</SelectItem>
                                    <SelectItem value="after_matches">After Matches</SelectItem>
                                    <SelectItem value="after_points_table">After Points Table</SelectItem>
                                    <SelectItem value="before_about">Before About Tournament</SelectItem>
                                    <SelectItem value="after_about">After About Tournament</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                                <div className="space-y-0.5">
                                  <Label className="text-base font-medium">Use Custom Teams</Label>
                                  <p className="text-sm text-muted-foreground">Select specific teams or add custom team names instead of auto-detecting from matches</p>
                                </div>
                                <Switch
                                  checked={tournamentForm.use_custom_teams}
                                  onCheckedChange={(checked) => setTournamentForm({ ...tournamentForm, use_custom_teams: checked })}
                                />
                              </div>
                              
                              {tournamentForm.use_custom_teams && (
                                <div className="space-y-3">
                                  <Label>Custom Teams</Label>
                                  <div className="space-y-2">
                                    {tournamentForm.custom_participating_teams.map((team, index) => (
                                      <div key={index} className="flex gap-2 items-center">
                                        <Input
                                          placeholder="Team name"
                                          value={team.name}
                                          onChange={(e) => {
                                            const newTeams = [...tournamentForm.custom_participating_teams];
                                            newTeams[index] = { ...newTeams[index], name: e.target.value };
                                            setTournamentForm({ ...tournamentForm, custom_participating_teams: newTeams });
                                          }}
                                          className="flex-1"
                                        />
                                        <Input
                                          placeholder="Logo URL (optional)"
                                          value={team.logo_url || ''}
                                          onChange={(e) => {
                                            const newTeams = [...tournamentForm.custom_participating_teams];
                                            newTeams[index] = { ...newTeams[index], logo_url: e.target.value || undefined };
                                            setTournamentForm({ ...tournamentForm, custom_participating_teams: newTeams });
                                          }}
                                          className="flex-1"
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            const newTeams = tournamentForm.custom_participating_teams.filter((_, i) => i !== index);
                                            setTournamentForm({ ...tournamentForm, custom_participating_teams: newTeams });
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setTournamentForm({
                                          ...tournamentForm,
                                          custom_participating_teams: [...tournamentForm.custom_participating_teams, { name: '' }]
                                        });
                                      }}
                                    >
                                      <Plus className="w-4 h-4 mr-1" /> Add Team
                                    </Button>
                                  </div>
                                  
                                  {/* Search and add from existing teams */}
                                  <div className="mt-3">
                                    <Label className="text-sm text-muted-foreground">Add from Existing Teams</Label>
                                    <div className="mt-2">
                                      <MultiSelectTeams
                                        options={(teams || [])
                                          .filter(team => !tournamentForm.custom_participating_teams.some(t => t.name === team.name))
                                          .map(team => ({
                                            value: team.id,
                                            label: team.name,
                                            sublabel: team.short_name,
                                            imageUrl: team.logo_url
                                          }))}
                                        selectedValues={tournamentForm.selectedTeamsToAdd}
                                        onSelectionChange={(values) => {
                                          setTournamentForm(prev => ({
                                            ...prev,
                                            selectedTeamsToAdd: values
                                          }));
                                        }}
                                        onAddTeams={(selectedTeamIds) => {
                                          if (selectedTeamIds.length === 0) {
                                            toast({ title: "No teams selected", variant: "destructive" });
                                            return;
                                          }
                                          
                                          const teamsToAdd = selectedTeamIds
                                            .map(teamId => teams?.find(t => t.id === teamId))
                                            .filter((team): team is NonNullable<typeof team> => team !== null && team !== undefined)
                                            .map(team => ({
                                              name: team.name,
                                              logo_url: team.logo_url || undefined
                                            }));
                                          
                                          if (teamsToAdd.length > 0) {
                                            setTournamentForm(prev => ({
                                              ...prev,
                                              custom_participating_teams: [
                                                ...prev.custom_participating_teams,
                                                ...teamsToAdd
                                              ],
                                              selectedTeamsToAdd: []
                                            }));
                                            toast({ title: `${teamsToAdd.length} team(s) added successfully` });
                                          } else {
                                            toast({ title: "Could not find selected teams", variant: "destructive" });
                                          }
                                        }}
                                        placeholder="Search and select teams..."
                                        searchPlaceholder="Search teams..."
                                        emptyText="No teams found"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                      </div>

                      {/* Venue Management */}
                      {editingTournament && (
                        <div className="border-t pt-4 mt-4">
                          <TournamentVenueManager tournamentId={editingTournament.id} />
                        </div>
                      )}
                      </div>
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-medium mb-3 text-sm text-muted-foreground">SEO Settings</h4>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>SEO Title</Label>
                            <Input 
                              placeholder="e.g., BPL 2025 Live Scores & Schedule" 
                              value={tournamentForm.seo_title} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, seo_title: e.target.value })} 
                            />
                            <p className="text-xs text-muted-foreground">Max 60 characters recommended for Google</p>
                          </div>
                          <div className="space-y-2">
                            <Label>SEO Description</Label>
                            <Textarea 
                              placeholder="A brief description for search engines (150-160 characters recommended)" 
                              value={tournamentForm.seo_description} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, seo_description: e.target.value })}
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground">{tournamentForm.seo_description.length}/160 characters</p>
                          </div>
                          <div className="space-y-2">
                            <Label>SEO Keywords</Label>
                            <Input 
                              placeholder="e.g., BPL 2025, Bangladesh Premier League, cricket live, T20" 
                              value={tournamentForm.seo_keywords} 
                              onChange={(e) => setTournamentForm({ ...tournamentForm, seo_keywords: e.target.value })} 
                            />
                            <p className="text-xs text-muted-foreground">Comma-separated keywords for better SEO ranking</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTournamentDialogOpen(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={handleSaveTournament} disabled={createTournament.isPending || updateTournament.isPending}>
                        {(createTournament.isPending || updateTournament.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingTournament ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Tournament Sub-Tabs */}
              {tournamentsLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (() => {
                const activeTournaments = tournaments?.filter(t => !t.is_completed) || [];
                const completedTournaments = tournaments?.filter(t => t.is_completed) || [];
                
                const renderTournamentList = (tournamentsToShow: typeof tournaments, emptyMessage: string) => {
                  const filteredTournaments = tournamentsToShow
                    ?.filter((tournament) => {
                      if (!tournamentSearchQuery.trim()) return true;
                      const query = tournamentSearchQuery.toLowerCase();
                      return (
                        tournament.name?.toLowerCase().includes(query) ||
                        tournament.sport?.toLowerCase().includes(query) ||
                        tournament.season?.toLowerCase().includes(query)
                      );
                    }) || [];
                  const filteredTournamentIds = filteredTournaments.map(t => t.id);
                  const allSelected = filteredTournamentIds.length > 0 && filteredTournamentIds.every(id => selectedTournaments.has(id));

                  return (
                    <div className="space-y-4">
                      {/* Tournament Search */}
                      <div className="mb-4">
                        <Input
                          placeholder="Search tournaments by name or sport..."
                          value={tournamentSearchQuery}
                          onChange={(e) => setTournamentSearchQuery(e.target.value)}
                          className="max-w-md"
                        />
                      </div>
                      
                      {/* Bulk Actions Bar */}
                      {filteredTournaments.length > 0 && (
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={() => toggleAllTournamentsSelection(filteredTournamentIds)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {selectedTournaments.size > 0 ? `${selectedTournaments.size} selected` : 'Select all'}
                            </span>
                          </div>
                          {selectedTournaments.size > 0 && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setBulkDeleteTournamentsDialogOpen(true)}
                              disabled={isBulkDeleting}
                            >
                              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete {selectedTournaments.size}
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        {filteredTournaments.length === 0 && (
                          <p className="text-center text-muted-foreground py-8 col-span-full">{emptyMessage}</p>
                        )}
                        {filteredTournaments.map((tournament, index) => (
                          <motion.div
                            key={tournament.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                          >
                            <Card className={`hover:border-primary/50 transition-colors ${selectedTournaments.has(tournament.id) ? 'border-primary bg-primary/5' : ''}`}>
                              <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-4">
                                    <Checkbox
                                      checked={selectedTournaments.has(tournament.id)}
                                      onCheckedChange={() => toggleTournamentSelection(tournament.id)}
                                      className="mt-1"
                                    />
                                    {tournament.logo_url && (
                                      <div
                                        className={`w-12 h-12 rounded-lg p-1.5 border flex items-center justify-center flex-shrink-0 ${
                                          (tournament as any).logo_background_color
                                            ? 'border-border/30'
                                            : 'bg-background/60 border-border/30'
                                        }`}
                                        style={(tournament as any).logo_background_color ? { backgroundColor: (tournament as any).logo_background_color } : undefined}
                                      >
                                        <img src={tournament.logo_url} alt={tournament.name} className="w-full h-full object-contain" />
                                      </div>
                                    )}
                                    <div>
                                      <h3 className="font-display text-2xl text-gradient tracking-wider mb-2">
                                        {tournament.name}
                                      </h3>
                                      <div className="flex items-center gap-2">
                                        <Badge variant="sport">{tournament.sport}</Badge>
                                        <span className="text-muted-foreground text-sm">
                                          Season {tournament.season}
                                        </span>
                                        {tournament.is_completed && (
                                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-[10px]">
                                            Completed
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditTournament(tournament)}>
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    {tournament.slug && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => submitTournamentForIndexing(tournament.slug!)} 
                                        title="Submit to Google"
                                      >
                                        <Globe className="w-4 h-4 text-green-500" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTournamentId(tournament.id)}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  );
                };

                return (
                  <Tabs defaultValue="active" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="active" className="gap-2">
                        Active
                        <Badge variant="secondary" className="ml-1 text-[10px]">{activeTournaments.length}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="gap-2">
                        Completed
                        <Badge variant="secondary" className="ml-1 text-[10px]">{completedTournaments.length}</Badge>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="active">
                      {renderTournamentList(activeTournaments, 'No active tournaments yet. Add your first tournament!')}
                    </TabsContent>
                    <TabsContent value="completed">
                      {renderTournamentList(completedTournaments, 'No completed tournaments yet.')}
                    </TabsContent>
                  </Tabs>
                );
              })()}
            </TabsContent>

            {/* Points Table Tab */}
            <TabsContent value="points-table" className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Tournament Points Tables</h2>
                <p className="text-sm text-muted-foreground">Manage team standings for each tournament</p>
              </div>

              {tournamentsLoading || teamsLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : tournaments && tournaments.filter(t => !t.is_completed && (t as any).show_points_table !== false).length > 0 ? (
                <div className="space-y-6">
                  {tournaments.filter(t => !t.is_completed && (t as any).show_points_table !== false).map((tournament) => {
                    return (
                      <Card key={tournament.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              {tournament.logo_url && (
                                <img src={tournament.logo_url} alt="" className="w-8 h-8 object-contain rounded" />
                              )}
                              <CardTitle className="text-base">{tournament.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-4 flex-wrap">
                              {/* Daily Auto Sync Toggle */}
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={(tournament as any).points_table_daily_sync_enabled || false}
                                  onCheckedChange={async (checked) => {
                                    const { error } = await supabase
                                      .from('tournaments')
                                      .update({ points_table_daily_sync_enabled: checked } as any)
                                      .eq('id', tournament.id);
                                    if (!error) {
                                      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                                      toast({ title: checked ? "Daily sync enabled" : "Daily sync disabled" });
                                    }
                                  }}
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Daily Sync</span>
                              </div>
                              {/* Per-tournament sync times (multiple) */}
                              {(tournament as any).points_table_daily_sync_enabled && (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {((tournament as any).points_table_sync_time || '').split(',').filter(Boolean).map((timeEntry: string, idx: number) => {
                                      const timePart = timeEntry.trim().split(/[+-]/)[0];
                                      return (
                                        <div key={idx} className="flex items-center gap-1 bg-muted/50 rounded px-2 py-1">
                                          <Clock className="w-3 h-3 text-muted-foreground" />
                                          <span className="text-xs">{timePart}</span>
                                          <button
                                            className="text-xs text-destructive hover:text-destructive/80 ml-1"
                                            onClick={async () => {
                                              const times = ((tournament as any).points_table_sync_time || '').split(',').filter(Boolean);
                                              times.splice(idx, 1);
                                              const newValue = times.join(',') || null;
                                              const { error } = await supabase
                                                .from('tournaments')
                                                .update({ points_table_sync_time: newValue } as any)
                                                .eq('id', tournament.id);
                                              if (!error) {
                                                queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                                                toast({ title: "Sync time removed" });
                                              }
                                            }}
                                          >×</button>
                                        </div>
                                      );
                                    })}
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="time"
                                        className="w-[110px] h-7 text-xs"
                                        onChange={async (e) => {
                                          const timeValue = e.target.value;
                                          if (!timeValue) return;
                                          const offset = new Date().getTimezoneOffset();
                                          const absOffset = Math.abs(offset);
                                          const sign = offset <= 0 ? '+' : '-';
                                          const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
                                          const mins = String(absOffset % 60).padStart(2, '0');
                                          const tzString = `${sign}${hours}:${mins}`;
                                          const newTimeEntry = `${timeValue}${tzString}`;
                                          
                                          const existing = ((tournament as any).points_table_sync_time || '').split(',').filter(Boolean);
                                          existing.push(newTimeEntry);
                                          const fullTime = existing.join(',');
                                          
                                          const { error } = await supabase
                                            .from('tournaments')
                                            .update({ points_table_sync_time: fullTime } as any)
                                            .eq('id', tournament.id);
                                          
                                          if (!error) {
                                            queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                                            toast({ title: "Sync time added", description: `${timeValue} (${Intl.DateTimeFormat().resolvedOptions().timeZone})` });
                                          }
                                          e.target.value = '';
                                        }}
                                      />
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        Add time
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">
                                    {Intl.DateTimeFormat().resolvedOptions().timeZone} • Each time syncs once only
                                  </span>
                                </div>
                              )}
                              {/* On Match Complete Sync Toggle */}
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={(tournament as any).points_table_on_complete_sync_enabled || false}
                                  onCheckedChange={async (checked) => {
                                    const { error } = await supabase
                                      .from('tournaments')
                                      .update({ points_table_on_complete_sync_enabled: checked } as any)
                                      .eq('id', tournament.id);
                                    if (!error) {
                                      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
                                      toast({ title: checked ? "Match complete sync enabled" : "Match complete sync disabled" });
                                    }
                                  }}
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">On Complete</span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2 pb-6 px-6">
                          <PointsTableManager 
                            tournament={tournament} 
                            teams={teams || []} 
                          />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No tournaments yet. Create tournaments first to manage points tables.</p>
                </div>
              )}
            </TabsContent>

            {/* Sports Tab */}
            <TabsContent value="sports" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Sports</h2>
                <Dialog open={sportDialogOpen} onOpenChange={(open) => {
                  setSportDialogOpen(open);
                  if (!open) resetSportForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" size="sm">
                      <Plus className="w-4 h-4" />
                      Add Sport
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSport ? 'Edit Sport' : 'Add New Sport'}</DialogTitle>
                      <DialogDescription>
                        Add a new sport type with an optional icon
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Sport Name</Label>
                        <Input placeholder="e.g., Badminton" value={sportForm.name} onChange={(e) => setSportForm({ ...sportForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Icon URL (optional)</Label>
                        <Input placeholder="https://..." value={sportForm.icon_url} onChange={(e) => setSportForm({ ...sportForm, icon_url: e.target.value })} />
                        <p className="text-xs text-muted-foreground">Leave empty to use default icon</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Display Order</Label>
                        <Input 
                          type="number" 
                          placeholder="1, 2, 3..." 
                          min={0}
                          value={sportForm.display_order} 
                          onChange={(e) => setSportForm({ ...sportForm, display_order: parseInt(e.target.value) || 0 })} 
                        />
                        <p className="text-xs text-muted-foreground">Lower numbers appear first (e.g., 1 = first, 2 = second)</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSportDialogOpen(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={handleSaveSport} disabled={createSport.isPending || updateSport.isPending}>
                        {(createSport.isPending || updateSport.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingSport ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {sportsLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {sports?.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 col-span-full">No sports yet. Add your first sport!</p>
                  )}
                  {sports?.map((sport, index) => (
                    <motion.div
                      key={sport.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                              {sport.display_order ?? 0}
                            </div>
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/20">
                              {sport.icon_url ? (
                                <img src={sport.icon_url} alt={sport.name} className="w-6 h-6 object-contain" />
                              ) : (
                                <Gamepad2 className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{sport.name}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleEditSport(sport)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteSport(sport.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Banners Tab */}
            <TabsContent value="banners" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">All Banners</h2>
                <Dialog open={bannerDialogOpen} onOpenChange={(open) => {
                  setBannerDialogOpen(open);
                  if (!open) resetBannerForm();
                }}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" size="sm">
                      <Plus className="w-4 h-4" />
                      Add Banner
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingBanner ? 'Edit Banner' : 'Add New Banner'}</DialogTitle>
                      <DialogDescription>
                        Create banners for matches, tournaments, or custom links
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Banner Type Selection */}
                      <div className="space-y-2">
                        <Label>Banner Type</Label>
                        <Select
                          value={bannerForm.banner_type}
                          onValueChange={(value: 'match' | 'tournament' | 'custom') => {
                            setBannerForm({ 
                              ...bannerForm, 
                              banner_type: value,
                              match_id: '',
                              tournament_id: '',
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select banner type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="match">Match</SelectItem>
                            <SelectItem value="tournament">Tournament</SelectItem>
                            <SelectItem value="custom">Custom Link</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Match Search - show only for match type */}
                      {bannerForm.banner_type === 'match' && (
                        <div className="space-y-2">
                          <Label>Select Match</Label>
                          <SearchableSelect
                            options={(matches || [])
                              .sort((a, b) => {
                                const statusOrder: Record<string, number> = { live: 0, upcoming: 1, stumps: 2, completed: 3 };
                                const statusDiff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
                                if (statusDiff !== 0) return statusDiff;
                                const timeA = a.match_start_time ? new Date(a.match_start_time).getTime() : 0;
                                const timeB = b.match_start_time ? new Date(b.match_start_time).getTime() : 0;
                                return timeA - timeB;
                              })
                              .map(match => ({
                                value: match.id,
                                label: `${match.team_a?.short_name || 'TBA'} vs ${match.team_b?.short_name || 'TBA'}`,
                                sublabel: `${match.status.charAt(0).toUpperCase() + match.status.slice(1)} • ${match.tournament?.name || 'No Tournament'} • ${match.match_format || 'Match'}`,
                              }))}
                            value={bannerForm.match_id}
                            onValueChange={(value) => {
                              const selectedMatch = matches?.find(m => m.id === value);
                              if (selectedMatch) {
                                const matchTitle = `${selectedMatch.team_a?.short_name || 'TBA'} vs ${selectedMatch.team_b?.short_name || 'TBA'}`;
                                const matchSubtitle = `${selectedMatch.tournament?.sport || 'Cricket'} • ${selectedMatch.match_format || 'Match'}`;
                                setBannerForm({ 
                                  ...bannerForm, 
                                  match_id: value,
                                  title: bannerForm.title || matchTitle,
                                  subtitle: bannerForm.subtitle || matchSubtitle,
                                  badge_type: selectedMatch.status === 'live' ? 'live' : selectedMatch.status === 'upcoming' ? 'upcoming' : 'watch_now',
                                });
                              }
                            }}
                            placeholder="Search and select match..."
                            searchPlaceholder="Search by team name..."
                            emptyText="No matches found"
                          />
                        </div>
                      )}

                      {/* Tournament Search - show only for tournament type */}
                      {bannerForm.banner_type === 'tournament' && (
                        <div className="space-y-2">
                          <Label>Select Tournament</Label>
                          <SearchableSelect
                            options={(tournaments || []).map(tournament => ({
                              value: tournament.id,
                              label: tournament.name,
                              sublabel: `${tournament.sport} • ${tournament.season}`,
                              imageUrl: tournament.logo_url,
                            }))}
                            value={bannerForm.tournament_id}
                            onValueChange={(value) => {
                              const selectedTournament = tournaments?.find(t => t.id === value);
                              if (selectedTournament) {
                                setBannerForm({ 
                                  ...bannerForm, 
                                  tournament_id: value,
                                  title: bannerForm.title || selectedTournament.name,
                                  subtitle: bannerForm.subtitle || `${selectedTournament.sport} • ${selectedTournament.season}`,
                                  badge_type: 'watch_now',
                                });
                              }
                            }}
                            placeholder="Search and select tournament..."
                            searchPlaceholder="Search by tournament name..."
                            emptyText="No tournaments found"
                          />
                        </div>
                      )}

                      {/* Custom Link URL - show only for custom type */}
                      {bannerForm.banner_type === 'custom' && (
                        <div className="space-y-2">
                          <Label>Link URL</Label>
                          <Input placeholder="https://..." value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input placeholder="Banner title" value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label>Subtitle (optional)</Label>
                          <Input placeholder="Cricket • T20 • Series" value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Image URL</Label>
                        <Input placeholder="https://..." value={bannerForm.image_url} onChange={(e) => setBannerForm({ ...bannerForm, image_url: e.target.value })} />
                        {bannerForm.image_url && (
                          <div className="w-full aspect-[21/9] rounded-lg overflow-hidden bg-muted mt-2">
                            <img src={bannerForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Badge Type</Label>
                          <Select
                            value={bannerForm.badge_type}
                            onValueChange={(value: 'none' | 'live' | 'upcoming' | 'watch_now') => setBannerForm({ ...bannerForm, badge_type: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select badge" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Badge</SelectItem>
                              <SelectItem value="live">🔴 Live</SelectItem>
                              <SelectItem value="upcoming">⏰ Upcoming</SelectItem>
                              <SelectItem value="watch_now">▶️ Watch Now</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Display Order</Label>
                          <Input type="number" value={bannerForm.display_order} onChange={(e) => setBannerForm({ ...bannerForm, display_order: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="flex items-center gap-2 pt-7">
                          <Switch
                            checked={bannerForm.is_active}
                            onCheckedChange={(checked) => setBannerForm({ ...bannerForm, is_active: checked })}
                          />
                          <Label>Active</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setBannerDialogOpen(false)}>Cancel</Button>
                      <Button variant="gradient" onClick={handleSaveBanner} disabled={createBanner.isPending || updateBanner.isPending}>
                        {(createBanner.isPending || updateBanner.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {editingBanner ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {bannersLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="grid gap-4">
                  {banners?.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No banners yet. Add your first banner!</p>
                  )}
                  {banners?.map((banner, index) => (
                    <motion.div
                      key={banner.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="w-full md:w-48 h-24 rounded-lg overflow-hidden bg-muted relative">
                              <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                              {banner.badge_type && banner.badge_type !== 'none' && (
                                <div className="absolute top-1 left-1">
                                  <Badge variant={banner.badge_type === 'live' ? 'live' : banner.badge_type === 'upcoming' ? 'upcoming' : 'default'} className="text-xs">
                                    {banner.badge_type === 'live' ? '🔴 Live' : banner.badge_type === 'upcoming' ? '⏰ Upcoming' : '▶️ Watch'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-lg truncate">{banner.title}</p>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span className="capitalize">{banner.banner_type || 'custom'}</span>
                                <span>•</span>
                                <span>Order: {banner.display_order}</span>
                              </div>
                              {banner.subtitle && (
                                <p className="text-primary text-sm truncate">{banner.subtitle}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant={banner.is_active ? 'upcoming' : 'completed'}>
                                {banner.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Button variant="ghost" size="icon" onClick={() => handleEditBanner(banner)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteBanner(banner.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Pages Tab */}
            <TabsContent value="pages" className="space-y-6">
              <DynamicPagesManager />
            </TabsContent>

            {/* Menus Tab */}
            <TabsContent value="menus" className="space-y-6">
              <MenuManager />
            </TabsContent>

            {/* Channels Tab */}
            <TabsContent value="channels" className="space-y-6">
              <ChannelsManager />
            </TabsContent>

            {/* Ads Tab */}
            <TabsContent value="ads" className="space-y-6">
              <AdsSettingsManager />
            </TabsContent>

            {/* Live Score API Tab */}
            <TabsContent value="live-api" className="space-y-6">
              {/* RapidAPI Settings - Cricbuzz */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    RapidAPI (Cricbuzz) - Points Table
                  </CardTitle>
                  <CardDescription>Configure RapidAPI for syncing points table from Cricbuzz</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Enable RapidAPI</Label>
                      <p className="text-sm text-muted-foreground">Enable points table sync from Cricbuzz via RapidAPI</p>
                    </div>
                    <Switch
                      checked={siteSettingsForm.rapidapi_enabled}
                      onCheckedChange={(checked) => setSiteSettingsForm({ ...siteSettingsForm, rapidapi_enabled: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>RapidAPI Key</Label>
                    <Input 
                      type="password"
                      placeholder="Enter your RapidAPI key" 
                      value={siteSettingsForm.rapidapi_key} 
                      onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, rapidapi_key: e.target.value })} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a href="https://rapidapi.com/cricbuzz-cricket/api/cricbuzz-cricket" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        RapidAPI - Cricbuzz Cricket
                      </a>
                    </p>
                  </div>

                  {/* RapidAPI Endpoints Configuration */}
                  <RapidApiEndpointsManager 
                    value={siteSettingsForm.rapidapi_endpoints}
                    onChange={(endpoints) => setSiteSettingsForm({ ...siteSettingsForm, rapidapi_endpoints: endpoints })}
                  />

                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">
                      <strong>Usage:</strong> Go to Tournament → Points Table → Click "Sync from API" → Enter Series ID from Cricbuzz URL
                    </p>
                  </div>

                  {/* Points Table Auto Sync Settings */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Daily Auto Sync
                    </h4>
                    
                    <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Enable Daily Auto Sync</Label>
                        <p className="text-sm text-muted-foreground">Automatically sync points table for all active tournaments daily</p>
                      </div>
                      <Switch
                        checked={(siteSettingsForm as any).points_table_auto_sync_enabled}
                        onCheckedChange={(checked) => setSiteSettingsForm({ ...siteSettingsForm, points_table_auto_sync_enabled: checked } as any)}
                      />
                    </div>

                    {(siteSettingsForm as any).points_table_auto_sync_enabled && (
                      <div className="space-y-2">
                        <Label>Sync Time (UTC)</Label>
                        <Input 
                          type="time"
                          value={(siteSettingsForm as any).points_table_sync_time || '03:00'}
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, points_table_sync_time: e.target.value } as any)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Points table will auto-sync daily at this time (UTC). Only active tournaments with Series ID will be synced.
                          Currently set to: <strong>{(siteSettingsForm as any).points_table_sync_time || '03:00'} UTC</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button variant="gradient" onClick={handleSaveSiteSettings} disabled={updateSiteSettings.isPending}>
                      {updateSiteSettings.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" />
                      Save RapidAPI Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* CricAPI Settings (cricapi.com) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-green-500" />
                    CricAPI (cricapi.com)
                  </CardTitle>
                  <CardDescription>Configure API key for fetching Playing XI / Full Squad from cricapi.com</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>CricAPI Key</Label>
                    <Input 
                      type="password"
                      placeholder="Enter your API key from cricapi.com" 
                      value={siteSettingsForm.cricket_api_key} 
                      onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, cricket_api_key: e.target.value })} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a href="https://cricapi.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        cricapi.com
                      </a>
                      . Used in Playing XI → Fetch Squad → CricAPI.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">
                      <strong>Usage:</strong> Go to Match → Playing XI → Fetch Squad → "CricAPI (cricapi.com)". Match ID is auto-detected from current matches.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="gradient" onClick={handleSaveSiteSettings} disabled={updateSiteSettings.isPending}>
                      {updateSiteSettings.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" />
                      Save CricAPI Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* API Cricket Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="w-5 h-5 text-live" />
                    Live Score API (api-cricket.com)
                  </CardTitle>
                  <CardDescription>Configure live cricket score display on match stream pages</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Enable API Cricket</Label>
                      <p className="text-sm text-muted-foreground">Globally enable/disable live score display from api-cricket.com</p>
                    </div>
                    <Switch
                      checked={siteSettingsForm.api_cricket_enabled}
                      onCheckedChange={(checked) => setSiteSettingsForm({ ...siteSettingsForm, api_cricket_enabled: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>API Cricket Key</Label>
                    <Input 
                      type="password"
                      placeholder="Enter your API key from api-cricket.com" 
                      value={siteSettingsForm.api_cricket_key} 
                      onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, api_cricket_key: e.target.value })} 
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{' '}
                      <a href="https://api-cricket.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        api-cricket.com
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Sync Interval (seconds)</Label>
                    <Input 
                      type="number"
                      min="30"
                      placeholder="120" 
                      value={siteSettingsForm.api_sync_interval_seconds} 
                      onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, api_sync_interval_seconds: Math.max(30, parseInt(e.target.value) || 120) })} 
                    />
                    <p className="text-xs text-muted-foreground">
                      How often to sync scores from API (minimum 30 seconds). Currently: {siteSettingsForm.api_sync_interval_seconds} seconds ({(siteSettingsForm.api_sync_interval_seconds / 60).toFixed(1)} minutes)
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Auto Match Result</Label>
                      <p className="text-sm text-muted-foreground">ম্যাচ শেষ হলে API থেকে অটো result (team_a_won/team_b_won) সেট করবে</p>
                    </div>
                    <Switch
                      checked={siteSettingsForm.auto_match_result_enabled}
                      onCheckedChange={(checked) => setSiteSettingsForm({ ...siteSettingsForm, auto_match_result_enabled: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Playing XI Auto-Sync Source</Label>
                    <Select
                      value={(siteSettingsForm as any).playing_xi_auto_sync_source || 'api_cricket'}
                      onValueChange={(value) => setSiteSettingsForm({ ...siteSettingsForm, playing_xi_auto_sync_source: value } as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api_cricket">API Cricket (api-cricket.com)</SelectItem>
                        <SelectItem value="espn">ESPN Cricinfo</SelectItem>
                        <SelectItem value="sofascore">Sofascore</SelectItem>
                        <SelectItem value="crex">Crex.live (Squad + Bench + Images)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      ম্যাচ শুরুর ২০ মিনিট আগে থেকে অটোমেটিক Playing XI ফেচ করবে। যতক্ষণ ১১ জন না পাবে ততক্ষণ ৫ মিনিট পর পর চেষ্টা করবে।
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> Enable live scores per-match using the "Enable API Score Sync" toggle in each match's edit dialog.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="gradient" onClick={handleSaveSiteSettings} disabled={updateSiteSettings.isPending}>
                      {updateSiteSettings.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" />
                      Save API Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Auto Score Sync Manager */}
              {siteSettingsForm.api_cricket_enabled && (
                <AutoScoreSyncManager 
                  matches={matches?.map(m => ({
                    ...m,
                    team_a: m.team_a,
                    team_b: m.team_b,
                  })) || []} 
                  onSyncComplete={() => {
                    // Trigger matches refetch - the query will automatically refetch
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="sitemap" className="space-y-6">
              <SitemapManager />
            </TabsContent>

            {/* Sponsor Notice Tab */}
            <TabsContent value="sponsor" className="space-y-6">
              <SponsorNoticeManager />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              {siteSettingsLoading ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : (
                <div className="space-y-6">
                  {/* General Site Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>General Settings</CardTitle>
                      <CardDescription>Configure your website name, logo and basic info</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Site Name</Label>
                          <Input 
                            placeholder="My Sports Site" 
                            value={siteSettingsForm.site_name} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, site_name: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Site Title (SEO)</Label>
                          <Input 
                            placeholder="My Sports Site - Watch Live Matches" 
                            value={siteSettingsForm.site_title} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, site_title: e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Logo URL</Label>
                          <Input 
                            placeholder="https://..." 
                            value={siteSettingsForm.logo_url} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, logo_url: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Favicon URL</Label>
                          <Input 
                            placeholder="https://..." 
                            value={siteSettingsForm.favicon_url} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, favicon_url: e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Footer Text</Label>
                          <Input 
                            placeholder="© 2025 My Sports Site. All rights reserved." 
                            value={siteSettingsForm.footer_text} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, footer_text: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Telegram Link</Label>
                          <Input 
                            placeholder="https://t.me/yourchannel" 
                            value={siteSettingsForm.telegram_link} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, telegram_link: e.target.value })} 
                          />
                        </div>
                      </div>

                      {/* Disclaimer Section */}
                      <div className="space-y-4 p-4 border border-border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">Show Disclaimer</Label>
                            <p className="text-xs text-muted-foreground">Display disclaimer section in footer</p>
                          </div>
                          <Switch
                            checked={siteSettingsForm.show_disclaimer}
                            onCheckedChange={(checked) => setSiteSettingsForm({ ...siteSettingsForm, show_disclaimer: checked })}
                          />
                        </div>
                        
                        {siteSettingsForm.show_disclaimer && (
                          <div className="space-y-2 pt-2 border-t border-border">
                            <Label>Disclaimer Text</Label>
                            <Textarea 
                              placeholder="All content displayed here is from publicly available sources on the internet. We do not own or claim ownership of any cricket matches, streams, or highlights. This platform is for informational purposes only."
                              value={siteSettingsForm.disclaimer_text} 
                              onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, disclaimer_text: e.target.value })}
                              rows={3}
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Banner Slider Duration (seconds)</Label>
                          <Input 
                            type="number"
                            min={2}
                            max={30}
                            placeholder="6" 
                            value={siteSettingsForm.slider_duration_seconds} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, slider_duration_seconds: parseInt(e.target.value) || 6 })} 
                          />
                          <p className="text-xs text-muted-foreground">Auto-slide interval for banner carousel (2-30 seconds)</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Completed Matches Display (days)</Label>
                          <Input 
                            type="number"
                            min={1}
                            max={30}
                            placeholder="2" 
                            value={(siteSettingsForm as any).homepage_completed_days || 2} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, homepage_completed_days: parseInt(e.target.value) || 2 } as any)} 
                          />
                          <p className="text-xs text-muted-foreground">Show completed matches from last N days on homepage</p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Homepage Channels Limit</Label>
                          <Input 
                            type="number"
                            min={1}
                            max={50}
                            placeholder="8" 
                            value={(siteSettingsForm as any).homepage_channels_limit || 8} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, homepage_channels_limit: parseInt(e.target.value) || 8 } as any)} 
                          />
                          <p className="text-xs text-muted-foreground">Maximum channels to show on homepage (View All link appears if more)</p>
                        </div>
                      </div>

                      {/* Text File Upload Section */}
                      <div className="space-y-4 pt-4 border-t border-border">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Import Settings from .txt File
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept=".txt"
                              className="flex-1"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                
                                try {
                                  const text = await file.text();
                                  const lines = text.split('\n');
                                  const settings: Record<string, string> = {};
                                  
                                  for (const line of lines) {
                                    const [key, ...valueParts] = line.split('=');
                                    if (key && valueParts.length > 0) {
                                      const trimmedKey = key.trim();
                                      const value = valueParts.join('=').trim();
                                      settings[trimmedKey] = value;
                                    }
                                  }
                                  
                                  // Update form with parsed settings
                                  setSiteSettingsForm(prev => ({
                                    ...prev,
                                    site_name: settings.site_name || prev.site_name,
                                    site_title: settings.site_title || prev.site_title,
                                    site_description: settings.site_description || prev.site_description,
                                    site_keywords: settings.site_keywords || prev.site_keywords,
                                    logo_url: settings.logo_url || prev.logo_url,
                                    favicon_url: settings.favicon_url || prev.favicon_url,
                                    og_image_url: settings.og_image_url || prev.og_image_url,
                                    footer_text: settings.footer_text || prev.footer_text,
                                    google_analytics_id: settings.google_analytics_id || prev.google_analytics_id,
                                    telegram_link: settings.telegram_link || prev.telegram_link,
                                    canonical_url: settings.canonical_url || prev.canonical_url,
                                    twitter_handle: settings.twitter_handle || prev.twitter_handle,
                                    facebook_app_id: settings.facebook_app_id || prev.facebook_app_id,
                                    google_adsense_id: settings.google_adsense_id || prev.google_adsense_id,
                                  }));
                                  
                                  toast({ 
                                    title: "Settings imported", 
                                    description: "Settings loaded from file. Click 'Save All Settings' to apply." 
                                  });
                                } catch (error) {
                                  toast({ 
                                    title: "Error", 
                                    description: "Failed to parse settings file", 
                                    variant: "destructive" 
                                  });
                                }
                                e.target.value = '';
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Upload a .txt file with key=value format (one per line). E.g., site_name=My Site
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* SEO Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>SEO Settings</CardTitle>
                      <CardDescription>Optimize your site for search engines like Google</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Site Description</Label>
                        <Textarea 
                          placeholder="Describe your site for search engines (max 160 characters recommended)..." 
                          value={siteSettingsForm.site_description} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, site_description: e.target.value })} 
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">{(siteSettingsForm.site_description || '').length}/160 characters</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Site Keywords</Label>
                        <Input 
                          placeholder="live sports, cricket, football, streaming, live match" 
                          value={siteSettingsForm.site_keywords} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, site_keywords: e.target.value })} 
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated keywords for SEO</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Canonical URL</Label>
                        <Input 
                          placeholder="https://yoursite.com" 
                          value={siteSettingsForm.canonical_url} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, canonical_url: e.target.value })} 
                        />
                        <p className="text-xs text-muted-foreground">Your main website URL for canonical tags</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Open Graph Image URL (Social Sharing)</Label>
                        <Input 
                          placeholder="https://..." 
                          value={siteSettingsForm.og_image_url} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, og_image_url: e.target.value })} 
                        />
                        <p className="text-xs text-muted-foreground">Image shown when shared on social media (1200x630 recommended)</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Twitter Handle</Label>
                          <Input 
                            placeholder="@youraccount" 
                            value={siteSettingsForm.twitter_handle} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, twitter_handle: e.target.value })} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Facebook App ID</Label>
                          <Input 
                            placeholder="123456789" 
                            value={siteSettingsForm.facebook_app_id} 
                            onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, facebook_app_id: e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Google Analytics ID</Label>
                        <Input 
                          placeholder="G-XXXXXXXXXX" 
                          value={siteSettingsForm.google_analytics_id} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, google_analytics_id: e.target.value })} 
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Custom Code Injection */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Custom Code Injection</CardTitle>
                      <CardDescription>Add custom scripts to header and footer sections of your site</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label>Custom Header Code</Label>
                        <Textarea 
                          placeholder={"<!-- Custom scripts for <head> section -->\n<script>\n  // Your custom JavaScript here\n</script>"}
                          value={siteSettingsForm.custom_header_code} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, custom_header_code: e.target.value })} 
                          rows={6}
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">Code will be injected into the &lt;head&gt; section. Use for analytics, tracking pixels, or custom stylesheets.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Custom Footer Code</Label>
                        <Textarea 
                          placeholder={"<!-- Custom scripts for footer section -->\n<script>\n  // Your custom JavaScript here\n</script>"}
                          value={siteSettingsForm.custom_footer_code} 
                          onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, custom_footer_code: e.target.value })} 
                          rows={6}
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground">Code will be injected before the closing &lt;/body&gt; tag. Use for chat widgets, tracking scripts, etc.</p>
                      </div>
                    </CardContent>
                  </Card>


                  {/* Security Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Security</CardTitle>
                      <CardDescription>Manage your account security settings</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                        Change Password
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="flex justify-end pt-4">
                    <Button variant="gradient" onClick={handleSaveSiteSettings} disabled={updateSiteSettings.isPending}>
                      {updateSiteSettings.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" />
                      Save All Settings
                    </Button>
                  </div>

                  <PasswordChangeDialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen} />
                </div>
              )}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <UserRolesManager 
                adminSlug={siteSettingsForm.admin_slug}
                onAdminSlugChange={(slug) => setSiteSettingsForm({ ...siteSettingsForm, admin_slug: slug })}
                onSaveAdminSlug={async () => {
                  if (!siteSettings?.id) return;
                  try {
                    await updateSiteSettings.mutateAsync({
                      id: siteSettings.id,
                      admin_slug: siteSettingsForm.admin_slug,
                    } as any);
                    toast({ title: "Admin URL saved successfully" });
                  } catch (error: any) {
                    toast({ title: "Error", description: error.message, variant: "destructive" });
                  }
                }}
                isSaving={updateSiteSettings.isPending}
              />
            </TabsContent>

            {/* Maintenance Mode Tab */}
            <TabsContent value="maintenance" className="space-y-6">
              <MaintenanceModeManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Bulk Delete Confirmation Dialogs */}
      <AlertDialog open={bulkDeleteMatchesDialogOpen} onOpenChange={setBulkDeleteMatchesDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMatches.size} Match{selectedMatches.size > 1 ? 'es' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected match{selectedMatches.size > 1 ? 'es' : ''} and all associated data including streaming servers and innings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteMatches}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete {selectedMatches.size} Match{selectedMatches.size > 1 ? 'es' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteTeamsDialogOpen} onOpenChange={setBulkDeleteTeamsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTeams.size} Team{selectedTeams.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected team{selectedTeams.size > 1 ? 's' : ''}. Make sure no matches are using these teams.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteTeams}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete {selectedTeams.size} Team{selectedTeams.size > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteTournamentsDialogOpen} onOpenChange={setBulkDeleteTournamentsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTournaments.size} Tournament{selectedTournaments.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected tournament{selectedTournaments.size > 1 ? 's' : ''} and may affect associated matches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteTournaments}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete {selectedTournaments.size} Tournament{selectedTournaments.size > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation Dialogs */}
      <AlertDialog open={!!deleteMatchId} onOpenChange={(open) => !open && setDeleteMatchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Match?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the match and all associated data including streaming servers and innings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMatchId && handleDeleteMatch(deleteMatchId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTeamId} onOpenChange={(open) => !open && setDeleteTeamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the team. Make sure no matches are using this team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTeamId && handleDeleteTeam(deleteTeamId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTournamentId} onOpenChange={(open) => !open && setDeleteTournamentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the tournament and may affect associated matches.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTournamentId && handleDeleteTournament(deleteTournamentId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Tournament
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
