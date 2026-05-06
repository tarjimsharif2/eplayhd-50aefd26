import { useEffect, useRef, useMemo, forwardRef, useState } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { trackAdImpression } from '@/hooks/useGoogleAnalytics';
import { useAdClickProtectionContext } from '@/components/AdClickProtectionProvider';

interface AdSlotProps {
  position: 'header' | 'sidebar' | 'footer' | 'in_article' | 'popup';
  className?: string;
}

const AdSlot = forwardRef<HTMLDivElement, AdSlotProps>(({ position, className = '' }, ref) => {
  const { data: settings } = useSiteSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasExecuted = useRef(false);
  const hasTrackedImpression = useRef(false);
  const [hasContent, setHasContent] = useState(false);
  const { isBlocked, trackAdClick } = useAdClickProtectionContext();

  const adCode = useMemo(() => {
    if (!settings?.ads_enabled) return null;

    const adCodeMap: Record<string, string | null | undefined> = {
      header: settings.header_ad_code,
      sidebar: settings.sidebar_ad_code,
      footer: settings.footer_ad_code,
      in_article: settings.in_article_ad_code,
      popup: settings.popup_ad_code,
    };

    return adCodeMap[position] || null;
  }, [settings, position]);

  useEffect(() => {
    if (!adCode || !containerRef.current || hasExecuted.current || isBlocked) return;

    const container = containerRef.current;
    container.innerHTML = '';
    
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
      container.appendChild(node);
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
        newScript.textContent = `try {\n${oldScript.textContent || ''}\n} catch (error) { console.warn('Ad script blocked after runtime error', error); }`;
      }
      container.appendChild(newScript);
    });

    hasExecuted.current = true;

    // Track clicks on the ad container
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
      container.removeEventListener('click', handleClick);
    };
  }, [adCode, position, isBlocked, trackAdClick]);

  useEffect(() => {
    hasExecuted.current = false;
    hasTrackedImpression.current = false;
    setHasContent(false);
  }, [position]);

  // Don't render if blocked or no ad code
  if (!adCode || isBlocked) return null;

  return (
    <div 
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      className={`ad-slot ad-slot-${position} ${className}`}
      style={{
        width: '100%',
        overflow: 'visible',
        display: 'block',
      }}
      data-ad-position={position}
    />
  );
});

AdSlot.displayName = 'AdSlot';

export default AdSlot;
