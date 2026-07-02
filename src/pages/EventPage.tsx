import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, MapPin, Calendar, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';
import VideoPlayer from '@/components/VideoPlayer';
import FlipClock from '@/components/FlipClock';
import { useEventBySlug, useEventStreamingServers, getEffectiveEventStatus } from '@/hooks/useEvents';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';
import { optimizeImage } from '@/lib/imageUrl';

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: event, isLoading } = useEventBySlug(slug);
  const { data: servers } = useEventStreamingServers(event?.id);
  const { data: settings } = usePublicSiteSettings();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('00:00:00');

  const status = event ? getEffectiveEventStatus(event) : 'upcoming';
  const activeServer = servers?.find(s => s.id === selectedId) ?? servers?.[0];

  useEffect(() => {
    if (servers && servers.length && !selectedId) setSelectedId(servers[0].id);
  }, [servers, selectedId]);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      const diff = new Date(event.event_start_time).getTime() - Date.now();
      if (diff <= 0) { setCountdown('00:00:00'); return; }
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [event]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Event not found.</p>
        <Button onClick={() => navigate('/')}>Go home</Button>
      </div>
    );
  }

  const startDate = new Date(event.event_start_time);
  const hasServers = (servers?.length ?? 0) > 0;
  const defaultIframe = settings?.default_iframe_enabled ? settings?.default_iframe_url : null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${event.name} - Live Event`}
        description={event.description || `${event.name} live event coverage${event.location ? ` from ${event.location}` : ''}.`}
      />
      <Header />

      <main className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Player / Countdown */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-border">
              {status === 'live' && activeServer ? (
                <VideoPlayer
                  url={activeServer.server_url}
                  type={activeServer.server_type}
                  headers={{
                    referer: activeServer.referer_value,
                    origin: activeServer.origin_value,
                    userAgent: activeServer.user_agent,
                  }}
                />
              ) : status === 'live' && defaultIframe ? (
                <iframe src={defaultIframe} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white gap-4 bg-gradient-to-br from-primary/20 via-black to-black">
                  {event.logo_url && (
                    <img src={optimizeImage(event.logo_url, { width: 200 })} alt={event.name} className="w-24 h-24 object-contain" />
                  )}
                  <h2 className="text-2xl font-bold text-center px-4">{event.name}</h2>
                  {status === 'upcoming' && (
                    <>
                      <p className="text-sm opacity-80">Starts in</p>
                      <FlipClock time={countdown} />
                    </>
                  )}
                  {status === 'completed' && <p className="opacity-80">Event has ended</p>}
                </div>
              )}
            </div>

            {/* Server selector */}
            {status === 'live' && hasServers && (
              <div>
                <p className="text-sm font-semibold mb-2">Servers</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {servers!.map((s) => {
                    const active = s.id === (activeServer?.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedId(s.id)}
                        className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-2 transition ${active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                      >
                        <span className="truncate">{s.server_name}</span>
                        {active && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Event Info */}
          <aside className="space-y-3">
            <div className="rounded-2xl border border-border p-5 bg-card text-center">
              {event.logo_url && (
                <img src={optimizeImage(event.logo_url, { width: 200 })} alt={event.name} className="w-20 h-20 mx-auto object-contain mb-3" />
              )}
              <h1 className="text-xl font-bold">{event.name}</h1>
              {event.year && <p className="text-sm text-muted-foreground">{event.year}</p>}
              <div className="mt-3 space-y-2 text-sm text-left">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{startDate.toLocaleString()}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <Badge variant="outline">{status.toUpperCase()}</Badge>
                </div>
              </div>
            </div>
            {event.description && (
              <div className="rounded-2xl border border-border p-5 bg-card">
                <h2 className="font-semibold mb-2">About</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default EventPage;