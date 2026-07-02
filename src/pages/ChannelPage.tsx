import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import VideoPlayer from '@/components/VideoPlayer';
import SEOHead from '@/components/SEOHead';
import AdSlot from '@/components/AdSlot';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useChannelBySlug, useChannelStreamingServers, ChannelStreamingServer, useMarkChannelServerNotWorking, useMarkChannelServerWorking } from '@/hooks/useChannels';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { usePreconnectServers } from '@/hooks/usePreconnectServers';
import { Tv, Loader2, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import DOMPurify from 'dompurify';

const ChannelPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [activeServer, setActiveServer] = useState<ChannelStreamingServer | null>(null);
  
  const { data: siteSettings } = useSiteSettings();
  const { data: channel, isLoading: channelLoading } = useChannelBySlug(slug || '');
  const { data: servers, isLoading: serversLoading } = useChannelStreamingServers(channel?.id || '');
  usePreconnectServers((servers || []).map((s: any) => s.server_url));
  const markNotWorking = useMarkChannelServerNotWorking();
  const markWorking = useMarkChannelServerWorking();

  // Scroll to top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Set first server as active
  useEffect(() => {
    if (servers && servers.length > 0 && !activeServer) {
      setActiveServer(servers[0]);
    }
  }, [servers, activeServer]);

  if (channelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-display text-3xl text-gradient mb-4">Channel Not Found</h1>
            <p className="text-muted-foreground">The channel you're looking for doesn't exist.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const seoTitle = channel.seo_title || `${channel.name} Live Stream - ${siteSettings?.site_name || 'Live Sports'}`;
  const seoDescription = channel.seo_description || `Watch ${channel.name} live stream online. Enjoy live sports coverage.`;
  const seoKeywords = channel.seo_keywords || `${channel.name}, live stream, sports channel`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead 
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        type="article"
      />
      <Header />
      
      <AdSlot position="header" className="container mx-auto px-4 py-2" />
      
      <main className="flex-1 py-6">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Channel Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div 
                className="w-16 h-16 rounded-xl flex items-center justify-center p-2 border border-border/30"
                style={{ backgroundColor: channel.logo_background_color || '#1a1a2e' }}
              >
                {channel.logo_url ? (
                  <img src={channel.logo_url} alt={channel.name} className="w-full h-full object-contain" />
                ) : (
                  <Radio className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <h1 className="font-display text-2xl md:text-3xl text-gradient">{channel.name}</h1>
                <p className="text-muted-foreground text-sm">Live Sports Channel</p>
              </div>
            </div>
          </motion.div>

          {/* Video Player */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur">
              <CardContent className="p-0">
                {activeServer ? (
                  <VideoPlayer 
                    key={`${activeServer.id}-${activeServer.server_type}`}
                    url={activeServer.server_url} 
                    type={activeServer.server_type as 'iframe' | 'm3u8' | 'embed' | 'iframe_to_m3u8'}
                    headers={{
                      referer: activeServer.referer_value,
                      origin: activeServer.origin_value,
                      cookie: activeServer.cookie_value,
                      userAgent: activeServer.user_agent,
                    }}
                    onStreamError={() => {
                      markNotWorking.mutate(activeServer.id);
                    }}
                    onStreamSuccess={() => {
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

          {/* Server Selection */}
          {servers && servers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Select Server:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {servers.map((server) => (
                  <Button
                    key={server.id}
                    variant={activeServer?.id === server.id ? 'gradient' : 'outline'}
                    onClick={() => setActiveServer(server)}
                    className="min-w-[100px]"
                  >
                    {server.server_name}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* In-Article Ad */}
          <AdSlot position="in_article" className="mb-6" />

          {/* Channel Description */}
          {channel.description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur">
                <CardContent className="p-6">
                  <h2 className="font-display text-xl text-gradient mb-4">About {channel.name}</h2>
                  <div 
                    className="prose prose-invert max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(channel.description) }}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default ChannelPage;
