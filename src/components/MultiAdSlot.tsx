import { useEffect, useRef, useMemo, useState } from 'react';
import { usePublicSiteSettings } from '@/hooks/usePublicSiteSettings';
import { trackAdImpression } from '@/hooks/useGoogleAnalytics';
import { useAdClickProtectionContext } from '@/components/AdClickProtectionProvider';
import { useCurrentUserPermissions } from '@/hooks/usePermissions';

interface AdCodeSlot {
  id: string;
  name: string;
  code: string;
  enabled: boolean;
}

interface MultipleAdCodes {
  header: AdCodeSlot[];
  sidebar: AdCodeSlot[];
  footer: AdCodeSlot[];
  in_article: AdCodeSlot[];
  popup: AdCodeSlot[];
  match_before_player: AdCodeSlot[];
  match_after_player: AdCodeSlot[];
  match_sidebar: AdCodeSlot[];
  match_below_info: AdCodeSlot[];
  match_after_servers: AdCodeSlot[];
  match_after_score: AdCodeSlot[];
  match_before_scoreboard: AdCodeSlot[];
  match_after_scoreboard: AdCodeSlot[];
  match_before_playingxi: AdCodeSlot[];
  match_after_playingxi: AdCodeSlot[];
  tournament_before_matches: AdCodeSlot[];
  tournament_after_matches: AdCodeSlot[];
  tournament_sidebar: AdCodeSlot[];
  tournament_before_points: AdCodeSlot[];
  tournament_after_points: AdCodeSlot[];
  tournament_before_teams: AdCodeSlot[];
  tournament_after_teams: AdCodeSlot[];
  tournament_before_about: AdCodeSlot[];
  tournament_after_about: AdCodeSlot[];
  tournament_between_sections: AdCodeSlot[];
}

interface MultiAdSlotProps {
  position: keyof MultipleAdCodes;
  className?: string;
  fallbackPosition?: 'header' | 'sidebar' | 'footer' | 'in_article' | 'popup';
}

const MultiAdSlot = ({ position, className = '', fallbackPosition }: MultiAdSlotProps) => {
  const { data: settings } = usePublicSiteSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasExecuted = useRef(false);
  const hasTrackedImpression = useRef(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const { isBlocked, trackAdClick } = useAdClickProtectionContext();
  const { isAdmin } = useCurrentUserPermissions();

  const adSlots = useMemo(() => {
    if (!settings?.ads_enabled || isAdmin) return [];
    const multipleAdCodes = (settings as any).multiple_ad_codes as MultipleAdCodes | null;
    if (!multipleAdCodes) return [];
    const slots = multipleAdCodes[position] || [];
    return slots.filter((slot: AdCodeSlot) => slot.enabled && slot.code?.trim());
  }, [settings, position, isAdmin]);

  const legacyAdCode = useMemo(() => {
    if (!settings?.ads_enabled || adSlots.length > 0 || isAdmin) return null;
    if (!fallbackPosition) return null;
    const legacyCodeMap: Record<string, string | null | undefined> = {
      header: settings.header_ad_code,
      sidebar: settings.sidebar_ad_code,
      footer: settings.footer_ad_code,
      in_article: settings.in_article_ad_code,
      popup: settings.popup_ad_code,
    };
    return legacyCodeMap[fallbackPosition] || null;
  }, [settings, adSlots.length, fallbackPosition, isAdmin]);

  useEffect(() => {
    if (!containerRef.current || hasExecuted.current || isBlocked) return;
    if (adSlots.length === 0 && !legacyAdCode) return;

    const container = containerRef.current;
    container.innerHTML = '';

    const allCodes: string[] = adSlots.length > 0 
      ? adSlots.map((slot: AdCodeSlot) => slot.code)
      : legacyAdCode ? [legacyAdCode] : [];

    allCodes.forEach((adCode: string) => {
      const slotWrapper = document.createElement('div');
      slotWrapper.className = 'ad-slot-item mb-2';
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = adCode;

      const scripts: HTMLScriptElement[] = [];
      const nonScriptNodes: Node[] = [];

      tempDiv.childNodes.forEach((node) => {
        if (node.nodeName === 'SCRIPT') {
          scripts.push(node as HTMLScriptElement);
        } else {
          nonScriptNodes.push(node.cloneNode(true));
        }
      });

      nonScriptNodes.forEach((node) => {
        slotWrapper.appendChild(node);
      });

      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        if (oldScript.src) {
          newScript.src = oldScript.src;
          newScript.async = true;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        slotWrapper.appendChild(newScript);
      });

      container.appendChild(slotWrapper);
    });

    hasExecuted.current = true;

    // Track clicks
    const handleClick = () => {
      trackAdClick();
    };
    container.addEventListener('click', handleClick);

    if (!hasTrackedImpression.current) {
      trackAdImpression(position);
      hasTrackedImpression.current = true;
    }

    return () => {
      hasExecuted.current = false;
      setIsEmpty(false);
      container.removeEventListener('click', handleClick);
    };
  }, [adSlots, legacyAdCode, position, isBlocked, trackAdClick]);

  useEffect(() => {
    hasExecuted.current = false;
    hasTrackedImpression.current = false;
    setIsEmpty(false);
  }, [position]);

  // Collapse if the ad slots don't render any visible content
  useEffect(() => {
    if ((adSlots.length === 0 && !legacyAdCode) || !containerRef.current) return;
    const el = containerRef.current;
    const check = () => {
      const walk = (node: Element): boolean => {
        for (const c of Array.from(node.children)) {
          if (c.tagName === 'SCRIPT') continue;
          const r = (c as HTMLElement).getBoundingClientRect();
          if (r.height > 1 && r.width > 1) return true;
          if (walk(c)) return true;
        }
        return false;
      };
      setIsEmpty(!walk(el));
    };
    const timers = [setTimeout(check, 800), setTimeout(check, 2500), setTimeout(check, 5000)];
    return () => timers.forEach(clearTimeout);
  }, [adSlots, legacyAdCode]);

  if (adSlots.length === 0 && !legacyAdCode) return null;
  if (isBlocked || isAdmin) return null;

  return (
    <div 
      ref={containerRef}
      className={`multi-ad-slot multi-ad-slot-${position} ${className}`}
      style={{
        width: '100%',
        overflow: 'visible',
        display: isEmpty ? 'none' : 'block',
      }}
      data-ad-position={position}
    />
  );
};

export default MultiAdSlot;
