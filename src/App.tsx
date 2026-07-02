import { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ThemeProvider } from "@/hooks/useTheme";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { usePublicSiteSettings } from "@/hooks/usePublicSiteSettings";
import CustomCodeInjector from "@/components/CustomCodeInjector";
import GoogleAnalyticsProvider from "@/components/GoogleAnalyticsProvider";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import MatchPage from "./pages/MatchPage";
import TournamentPage from "./pages/TournamentPage";
import ChannelPage from "./pages/ChannelPage";
import ChannelsPage from "./pages/ChannelsPage";
import DynamicPage from "./pages/DynamicPage";
import AdsTxt from "./pages/AdsTxt";
import Sitemap from "./pages/Sitemap";
import NotFound from "./pages/NotFound";
import MaintenancePage from "./pages/MaintenancePage";
import ScrollToTop from "./components/ScrollToTop";
import { AdClickProtectionProvider } from "./components/AdClickProtectionProvider";
import BottomNav from "./components/BottomNav";

// Maintenance mode wrapper - shows maintenance page for non-admin users
const MaintenanceWrapper = ({ children }: { children: React.ReactNode }) => {
  const { data: settings, isLoading: settingsLoading } = usePublicSiteSettings();
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  
  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user?.id) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }
      
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        setIsAdmin(!!data);
      } catch (error) {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    };
    
    checkAdmin();
  }, [session?.user?.id]);
  
  // Don't block while loading
  if (settingsLoading || authLoading || checkingAdmin) return <>{children}</>;
  
  // Check if maintenance mode is enabled
  const isMaintenanceMode = settings?.maintenance_mode === true;
  
  if (!isMaintenanceMode) return <>{children}</>;
  
  // Get admin slug for checking admin routes
  const adminSlug = settings?.admin_slug || 'admin';
  const currentPath = location.pathname;
  
  // Allow access to auth page
  if (currentPath === '/auth') return <>{children}</>;
  
  // Allow access to admin routes for authenticated admin users
  const isAdminRoute = 
    currentPath === '/admin' || 
    currentPath.startsWith('/admin/') || 
    currentPath === `/${adminSlug}` ||
    currentPath.startsWith(`/${adminSlug}/`);
  
  // If user is admin, allow access (they can see maintenance page but also navigate)
  if (session && isAdmin) {
    return <>{children}</>;
  }
  
  // Show maintenance page for everyone else
  return <MaintenancePage />;
};

// Protected admin route - blocks /admin if custom slug is set
const ProtectedAdminRoute = () => {
  const { data: settings, isLoading } = usePublicSiteSettings();
  
  if (isLoading) return null;
  
  // If a custom admin slug is set (not 'admin'), block the default /admin route
  const adminSlug = settings?.admin_slug;
  if (adminSlug && adminSlug !== 'admin' && adminSlug.trim() !== '') {
    // Custom slug is set, block /admin access - show 404
    return <NotFound />;
  }
  
  // No custom slug or slug is 'admin' - allow access
  return <Admin />;
};

// Dynamic admin route handler - redirects to Admin if slug matches
const DynamicAdminRoute = () => {
  const { dynamicAdmin } = useParams();
  const { data: settings, isLoading } = usePublicSiteSettings();
  
  // If loading, show nothing (avoid flash)
  if (isLoading) return null;
  
  // Check if the current route matches the custom admin slug
  const adminSlug = settings?.admin_slug || 'admin';
  
  if (dynamicAdmin === adminSlug && adminSlug !== 'admin') {
    // Render admin page for custom slug
    return <Admin />;
  }
  
  // Not an admin route - show 404
  return <NotFound />;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // Data is fresh for 1 minute
      gcTime: 1000 * 60 * 5, // Cache for 5 minutes
      refetchOnWindowFocus: true, // Refetch when window regains focus
      refetchOnMount: true, // Always refetch on component mount
      refetchOnReconnect: true, // Refetch when network reconnects
    },
  },
});

// Component that uses the realtime sync hook
const RealtimeSyncProvider = ({ children }: { children: React.ReactNode }) => {
  useRealtimeSync();
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <RealtimeSyncProvider>
          <AdClickProtectionProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <CustomCodeInjector />
            <BrowserRouter>
              <ScrollToTop />
              <GoogleAnalyticsProvider>
                <MaintenanceWrapper>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/admin" element={<ProtectedAdminRoute />} />
                  <Route path="/admin/*" element={<ProtectedAdminRoute />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/match/:slug" element={<MatchPage />} />
                  <Route path="/tournament/:slug" element={<TournamentPage />} />
                  <Route path="/channel/:slug" element={<ChannelPage />} />
                  <Route path="/channels" element={<ChannelsPage />} />
                  <Route path="/page/:slug" element={<DynamicPage />} />
                  {/* Handle both /ads.txt and /ads.txt/ */}
                  <Route path="/ads.txt/*" element={<AdsTxt />} />
                  {/* Handle /sitemap.xml */}
                  <Route path="/sitemap.xml" element={<Sitemap />} />
                  {/* Dynamic admin routes - use the slug from site settings */}
                  <Route path="/:dynamicAdmin" element={<DynamicAdminRoute />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </MaintenanceWrapper>
              </GoogleAnalyticsProvider>
            </BrowserRouter>
          </TooltipProvider>
          </AdClickProtectionProvider>
        </RealtimeSyncProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
