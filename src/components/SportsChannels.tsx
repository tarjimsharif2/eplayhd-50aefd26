import { Link } from 'react-router-dom';
import { useChannels } from '@/hooks/useChannels';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';
import { Tv, Radio, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { optimizeImage } from '@/lib/imageUrl';

const SportsChannels = () => {
  const { data: channels, isLoading } = useChannels();
  const { data: settings } = usePublicSiteSettings();

  const channelsLimit = settings?.homepage_channels_limit || 8;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return null;
  }

  const displayedChannels = channels.slice(0, channelsLimit);
  const hasMore = channels.length > channelsLimit;

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
            <Radio className="w-4 h-4 text-primary" />
          </div>
          <h2 className="font-display text-xl text-gradient">Sports Channels</h2>
        </div>
        
        {hasMore && (
          <Link 
            to="/channels" 
            className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View All
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {displayedChannels.map((channel, index) => (
          <motion.div
            key={channel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Link to={`/channel/${channel.slug || channel.id}`}>
              <div className="group relative flex flex-col items-center p-2.5 rounded-lg bg-card/50 border border-border/30 hover:border-primary/40 hover:bg-card transition-all duration-300">
                {/* Channel Logo */}
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-border/20 group-hover:border-primary/30 transition-colors shadow-md"
                  style={{ backgroundColor: channel.logo_background_color || '#1a1a2e' }}
                >
                  {channel.logo_url ? (
                    <img 
                            src={optimizeImage(channel.logo_url, { width: 80, quality: 75 })}
                      alt={channel.name} 
                            loading="lazy"
                            decoding="async"
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <Tv className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>

                {/* Channel Name */}
                <span className="mt-2 font-semibold text-[15px] text-center group-hover:text-primary transition-colors line-clamp-1">
                  {channel.name}
                </span>
                
                {/* Watch Badge */}
                <span className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-red-500 animate-pulse">
                  <span className="w-1 h-1 bg-red-500 rounded-full" />
                  Watch
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default SportsChannels;
