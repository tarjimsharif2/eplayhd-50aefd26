import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Play, Settings, Check, Loader2, PictureInPicture2, Volume2, VolumeX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StreamHeaders {
  referer?: string | null;
  origin?: string | null;
  cookie?: string | null;
  userAgent?: string | null;
}

interface VideoPlayerProps {
  url: string;
  type: 'iframe' | 'm3u8' | 'embed' | 'iframe_to_m3u8';
  headers?: StreamHeaders;
  onStreamError?: () => void;
  onStreamSuccess?: () => void;
}

// Validate that URL uses safe protocols (http:// or https://)
const isValidUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Check if headers are configured
const hasCustomHeaders = (headers?: StreamHeaders): boolean => {
  if (!headers) return false;
  return !!(headers.referer || headers.origin || headers.cookie || headers.userAgent);
};

// Build proxy URL for M3U8 streams
const buildM3U8ProxyUrl = (url: string, headers?: StreamHeaders): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
  proxyUrl.searchParams.set('url', url);
  
  if (headers?.referer) proxyUrl.searchParams.set('referer', headers.referer);
  if (headers?.origin) proxyUrl.searchParams.set('origin', headers.origin);
  if (headers?.userAgent) proxyUrl.searchParams.set('userAgent', headers.userAgent);
  if (headers?.cookie) proxyUrl.searchParams.set('cookie', headers.cookie);
  
  return proxyUrl.toString();
};

// Build proxy URL for iframe content
const buildIframeProxyUrl = (url: string, headers?: StreamHeaders): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyUrl = new URL(`${supabaseUrl}/functions/v1/iframe-proxy`);
  proxyUrl.searchParams.set('url', url);
  
  if (headers?.referer) proxyUrl.searchParams.set('referer', headers.referer);
  if (headers?.origin) proxyUrl.searchParams.set('origin', headers.origin);
  if (headers?.userAgent) proxyUrl.searchParams.set('userAgent', headers.userAgent);
  if (headers?.cookie) proxyUrl.searchParams.set('cookie', headers.cookie);
  
  return proxyUrl.toString();
};

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

const ClapprPlayer = ({ url, headers, onStreamError, onStreamSuccess }: { url: string; headers?: StreamHeaders; onStreamError?: () => void; onStreamSuccess?: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerIdRef = useRef(`clappr-${Math.random().toString(36).substr(2, 9)}`);

  const isPiPSupported = 'pictureInPictureEnabled' in document;

  const togglePiP = async () => {
    try {
      const videoElement = containerRef.current?.querySelector('video');
      if (!videoElement) {
        toast.error('Video element not found');
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoElement.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.error('PiP error:', err);
      toast.error('Picture-in-Picture not available');
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadClappr = async () => {
      if (!containerRef.current) return;

      try {
        // Destroy previous player first
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            console.warn('Error destroying previous player:', e);
          }
          playerRef.current = null;
        }

        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const ClapprModule = await import('@clappr/player');
        const Clappr = ClapprModule.default || ClapprModule;

        if (!mounted) return;

        // Use proxy URL if headers are configured
        const streamUrl = hasCustomHeaders(headers) 
          ? buildM3U8ProxyUrl(url, headers) 
          : url;

        console.log('Playing M3U8:', hasCustomHeaders(headers) ? 'via proxy' : 'direct', streamUrl.substring(0, 100));

        const player = new Clappr.Player({
          source: streamUrl,
          parent: containerRef.current,
          width: '100%',
          height: '100%',
          autoPlay: true,
          mute: false,
          hideMediaControl: true,
          hideMediaControlDelay: 3000,
          mediacontrol: { seekbar: '#E91E63', buttons: '#E91E63' },
          playback: {
            playInline: true,
            controls: false,
            hlsjsConfig: {
              enableWorker: true,
              lowLatencyMode: false,
            },
          },
          disableVideoTagContextMenu: true,
        });

        // Handle fullscreen orientation for mobile
        player.on('fullscreen', () => {
          try {
            const orientation = screen.orientation as any;
            if (orientation && typeof orientation.lock === 'function') {
              orientation.lock('landscape').catch(() => {});
            }
          } catch (e) {}
        });

        player.on('fullscreenexit', () => {
          try {
            const orientation = screen.orientation as any;
            if (orientation && typeof orientation.unlock === 'function') {
              orientation.unlock();
            }
          } catch (e) {}
        });

        player.on('ready', () => {
          if (mounted) {
            setIsLoading(false);
            
            // Force video element to stretch
            const videoEl = containerRef.current?.querySelector('video') as HTMLVideoElement;
            if (videoEl) {
              videoEl.style.objectFit = 'fill';
              videoEl.style.width = '100%';
              videoEl.style.height = '100%';
            }
            
            try {
              const playback = player.core?.activePlayback;
              if (playback && playback._hls) {
                playback._hls.on('hlsManifestParsed', (_: any, data: any) => {
                  if (data.levels && mounted) {
                    const levels: QualityLevel[] = data.levels.map((level: any, index: number) => ({
                      index,
                      height: level.height,
                      bitrate: level.bitrate,
                      label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
                    }));
                    levels.sort((a, b) => b.height - a.height);
                    setQualityLevels(levels);
                  }
                });
              }
            } catch (e) {
              console.warn('Could not extract quality levels:', e);
            }
          }
        });

        // Track successful playback
        let successNotified = false;
        player.on('play', () => {
          if (mounted) {
            setIsPlaying(true);
            if (!successNotified && onStreamSuccess) {
              successNotified = true;
              onStreamSuccess();
            }
          }
        });

        player.on('pause', () => {
          if (mounted) setIsPlaying(false);
        });

        player.on('error', (e: any) => {
          console.error('Clappr playback error:', e);
          if (mounted) {
            setError('Failed to load stream');
            setIsLoading(false);
            if (onStreamError) {
              onStreamError();
            }
          }
        });

        playerRef.current = player;
        
        setTimeout(() => {
          if (mounted && isLoading) {
            setIsLoading(false);
          }
        }, 3000);

      } catch (err) {
        console.error('Failed to load Clappr:', err);
        if (mounted) {
          setError('Failed to initialize player');
          setIsLoading(false);
        }
      }
    };

    loadClappr();

    return () => {
      mounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          console.warn('Error during cleanup:', e);
        }
        playerRef.current = null;
      }
    };
  }, [url, headers]);

  const handleQualityChange = (levelIndex: number) => {
    try {
      const playback = playerRef.current?.core?.activePlayback;
      if (playback && playback._hls) {
        playback._hls.currentLevel = levelIndex;
        setCurrentQuality(levelIndex);
      }
    } catch (e) {
      console.warn('Could not change quality:', e);
    }
    setShowQualityMenu(false);
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return 'Auto';
    const level = qualityLevels.find(l => l.index === currentQuality);
    return level?.label || 'Auto';
  };

  if (error) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-destructive text-center px-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}
      <div 
        ref={containerRef} 
        id={playerIdRef.current}
        className="absolute inset-0 w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-fill [&_.play-wrapper]:!absolute [&_.play-wrapper]:!left-1/2 [&_.play-wrapper]:!top-1/2 [&_.play-wrapper]:!-translate-x-1/2 [&_.play-wrapper]:!-translate-y-1/2 [&_.play-wrapper]:!right-auto [&_.play-wrapper]:!bottom-auto [&_.media-control-icon]:!text-6xl"
        style={{ zIndex: 1 }}
      />

      {/* Controls - PiP and Quality */}
      <div className="absolute bottom-16 right-4 z-20 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* PiP Button */}
        {isPiPSupported && (
          <Button 
            variant="secondary" 
            size="sm" 
            className={`bg-black/70 hover:bg-black/90 text-white border-0 ${isPiPActive ? 'ring-2 ring-primary' : ''}`}
            onClick={togglePiP}
            title="Picture-in-Picture"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </Button>
        )}

        {/* Quality Selector */}
        {qualityLevels.length > 1 && (
          <DropdownMenu open={showQualityMenu} onOpenChange={setShowQualityMenu}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-black/70 hover:bg-black/90 text-white border-0 gap-1.5"
              >
                <Settings className="w-4 h-4" />
                <span className="text-xs">{getCurrentQualityLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
              <DropdownMenuItem 
                onClick={() => handleQualityChange(-1)}
                className="text-white hover:bg-white/20 gap-2"
              >
                {currentQuality === -1 && <Check className="w-4 h-4" />}
                <span className={currentQuality !== -1 ? 'ml-6' : ''}>Auto</span>
              </DropdownMenuItem>
              {qualityLevels.map((level) => (
                <DropdownMenuItem
                  key={level.index}
                  onClick={() => handleQualityChange(level.index)}
                  className="text-white hover:bg-white/20 gap-2"
                >
                  {currentQuality === level.index && <Check className="w-4 h-4" />}
                  <span className={currentQuality !== level.index ? 'ml-6' : ''}>
                    {level.label}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

// Component for iframe_to_m3u8 type that extracts and plays M3U8
const IframeToM3U8Player = ({ url, headers, onStreamError, onStreamSuccess }: { url: string; headers?: StreamHeaders; onStreamError?: () => void; onStreamSuccess?: () => void }) => {
  const [extractedUrl, setExtractedUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const extractM3U8 = async () => {
      setIsExtracting(true);
      setError(null);
      
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const extractUrl = new URL(`${supabaseUrl}/functions/v1/extract-m3u8`);
        extractUrl.searchParams.set('url', url);
        
        if (headers?.referer) extractUrl.searchParams.set('referer', headers.referer);
        if (headers?.origin) extractUrl.searchParams.set('origin', headers.origin);
        if (headers?.userAgent) extractUrl.searchParams.set('userAgent', headers.userAgent);
        if (headers?.cookie) extractUrl.searchParams.set('cookie', headers.cookie);

        console.log('Extracting M3U8 from:', url);
        
        const response = await fetch(extractUrl.toString());
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to extract stream');
        }
        
        if (data.streamUrls && data.streamUrls.length > 0) {
          console.log('Found M3U8 URLs:', data.streamUrls);
          setExtractedUrl(data.streamUrls[0]);
        } else {
          throw new Error('No M3U8 stream found in the page');
        }
      } catch (err) {
        console.error('M3U8 extraction error:', err);
        setError(err instanceof Error ? err.message : 'Failed to extract stream');
        if (onStreamError) {
          onStreamError();
        }
      } finally {
        setIsExtracting(false);
      }
    };

    extractM3U8();
  }, [url, headers]);

  if (isExtracting) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground text-sm">Extracting stream URL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-destructive text-center px-4">{error}</p>
        <p className="text-muted-foreground text-xs text-center px-4">
          Try using the iframe type instead
        </p>
      </div>
    );
  }

  if (extractedUrl) {
    return <ClapprPlayer url={extractedUrl} headers={headers} onStreamError={onStreamError} onStreamSuccess={onStreamSuccess} />;
  }

  return null;
};

const VideoPlayer = ({ url, type, headers, onStreamError, onStreamSuccess }: VideoPlayerProps) => {
  const [useDirectEmbed, setUseDirectEmbed] = useState(false);
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successNotifiedRef = useRef(false);

  // Handle iframe timeout detection
  useEffect(() => {
    if (type === 'iframe' || type === 'embed') {
      // Reset state on URL change
      setIsIframeLoading(true);
      setIframeTimedOut(false);
      setLoadingSeconds(0);
      successNotifiedRef.current = false;

      // Tick a counter so the user sees progress on slow networks
      tickRef.current = setInterval(() => {
        setLoadingSeconds((s) => s + 1);
      }, 1000);

      // Generous 60s timeout so slow mobile networks aren't cut off early
      timeoutRef.current = setTimeout(() => {
        if (isIframeLoading && !successNotifiedRef.current) {
          setIframeTimedOut(true);
          setIsIframeLoading(false);
          if (onStreamError) {
            onStreamError();
          }
        }
      }, 60000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (tickRef.current) {
          clearInterval(tickRef.current);
        }
      };
    }
  }, [url, type]);

  const handleIframeLoad = () => {
    setIsIframeLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
    }
    if (!successNotifiedRef.current && onStreamSuccess) {
      successNotifiedRef.current = true;
      onStreamSuccess();
    }
  };

  // Validate URL before rendering to prevent XSS attacks
  if (!isValidUrl(url)) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        <p className="text-destructive">Invalid streaming URL</p>
      </div>
    );
  }

  // For M3U8 streams, use Clappr player (with proxy if headers are set)
  if (type === 'm3u8') {
    return <ClapprPlayer url={url} headers={headers} onStreamError={onStreamError} onStreamSuccess={onStreamSuccess} />;
  }

  // For iframe_to_m3u8 type, extract and play M3U8
  if (type === 'iframe_to_m3u8') {
    return <IframeToM3U8Player url={url} headers={headers} onStreamError={onStreamError} onStreamSuccess={onStreamSuccess} />;
  }

  // For iframe and embed types - only use proxy if headers are needed AND not using direct embed
  const needsProxy = hasCustomHeaders(headers) && !useDirectEmbed;
  
  // Build iframe URL - use direct URL for fastest loading when possible
  const buildIframeSrc = () => {
    // Skip proxy entirely if no custom headers - direct is faster
    if (!hasCustomHeaders(headers)) {
      return url;
    }
    
    if (needsProxy) {
      return buildIframeProxyUrl(url, headers);
    }
    return url;
  };
  
  const iframeSrc = buildIframeSrc();

  // Preconnect to the iframe origin so DNS/TLS handshake happens early.
  // Big win on slow mobile networks.
  useEffect(() => {
    if (type !== 'iframe' && type !== 'embed') return;
    try {
      const origin = new URL(iframeSrc).origin;
      const links: HTMLLinkElement[] = [];
      (['preconnect', 'dns-prefetch'] as const).forEach((rel) => {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        links.push(link);
      });
      return () => {
        links.forEach((l) => l.remove());
      };
    } catch {
      // ignore invalid URL
    }
  }, [iframeSrc, type]);

  // Show timeout error
  if (iframeTimedOut) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <p className="text-destructive text-center px-4">Stream failed to load</p>
        <p className="text-muted-foreground text-xs text-center px-4">
          Try selecting another server
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group">
      {/* Loading spinner */}
      {isIframeLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-black px-4 text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-white/80 text-sm">
            {loadingSeconds < 10
              ? 'Stream loading...'
              : loadingSeconds < 25
              ? 'Still loading, please wait...'
              : 'Slow network detected. Hang on...'}
          </p>
          {loadingSeconds >= 15 && (
            <p className="text-white/50 text-xs">{loadingSeconds}s</p>
          )}
        </div>
      )}
      
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="absolute inset-0 w-full h-full border-0"
        style={{ 
          width: '100%', 
          height: '100%', 
          border: 'none',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}
        onLoad={handleIframeLoad}
        onError={() => {
          setIsIframeLoading(false);
          setIframeTimedOut(true);
          if (onStreamError) {
            onStreamError();
          }
        }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        frameBorder="0"
        scrolling="no"
        referrerPolicy="unsafe-url"
        loading="eager"
      />
      
      {/* Direct embed toggle for iframe streams with headers */}
      {hasCustomHeaders(headers) && (type === 'iframe' || type === 'embed') && (
        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setUseDirectEmbed(!useDirectEmbed)}
            className="px-2 py-1 text-xs bg-black/70 hover:bg-black/90 text-white rounded transition-colors"
            title={useDirectEmbed ? "Using direct embed" : "Using proxy (click to try direct)"}
          >
            {useDirectEmbed ? "Direct" : "Proxy"}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
