import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Sparkles } from 'lucide-react';
import FlipClock from '@/components/FlipClock';
import { EventItem, getEffectiveEventStatus } from '@/hooks/useEvents';
import { optimizeImage } from '@/lib/imageUrl';

interface Props {
  event: EventItem;
  index?: number;
}

const EventCard = ({ event, index = 0 }: Props) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(() => getEffectiveEventStatus(event));

  useEffect(() => {
    const t = setInterval(() => setStatus(getEffectiveEventStatus(event)), 30_000);
    return () => clearInterval(t);
  }, [event]);

  const startDate = new Date(event.event_start_time);
  const formattedDate = startDate.toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const formattedTime = startDate.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  });

  const statusMeta = {
    live: { label: '● LIVE', className: 'bg-red-600 text-white animate-pulse' },
    upcoming: { label: 'UPCOMING', className: 'bg-blue-600 text-white' },
    completed: { label: 'COMPLETED', className: 'bg-muted text-muted-foreground' },
  }[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      onClick={() => navigate(`/event/${event.slug}`)}
      className="group cursor-pointer rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl hover:border-primary/50 transition-all"
    >
      <div className="relative p-5 flex flex-col items-center text-center gap-3 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
          {event.is_priority && (
            <Badge className="bg-amber-500 text-white gap-1">
              <Sparkles className="w-3 h-3" /> Featured
            </Badge>
          )}
        </div>
        <Badge variant="outline" className="absolute top-3 right-3 text-[10px]">EVENT</Badge>

        <div className="w-20 h-20 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center overflow-hidden mt-6">
          {event.logo_url ? (
            <img
              src={optimizeImage(event.logo_url, { width: 160, height: 160 })}
              alt={event.name}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          ) : (
            <Sparkles className="w-8 h-8 text-primary/60" />
          )}
        </div>

        <div>
          <h3 className="font-bold text-lg leading-tight line-clamp-2">{event.name}</h3>
          {event.year && <p className="text-sm text-muted-foreground mt-0.5">{event.year}</p>}
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formattedDate} • {formattedTime}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {event.location}
            </span>
          )}
        </div>
      </div>

      {status === 'upcoming' && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50">
          <p className="text-xs text-center text-muted-foreground mb-2">Starts in</p>
          <FlipClock targetDate={startDate} />
        </div>
      )}

      {status === 'live' && (
        <div className="px-4 py-3 border-t border-border/50 text-center text-sm font-semibold text-red-600">
          Watch now →
        </div>
      )}

      {status === 'completed' && (
        <div className="px-4 py-3 border-t border-border/50 text-center text-sm text-muted-foreground">
          Event ended
        </div>
      )}
    </motion.div>
  );
};

export default EventCard;