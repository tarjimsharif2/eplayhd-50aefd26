import { useEffect } from 'react';

/**
 * Injects <link rel="preconnect"> + <link rel="dns-prefetch"> tags for every
 * unique origin in the provided URLs, so that when a user clicks a server the
 * TCP/TLS handshake is already warm and the iframe starts streaming faster.
 */
export function usePreconnectServers(urls: (string | null | undefined)[]) {
  useEffect(() => {
    const origins = new Set<string>();
    urls.forEach((u) => {
      if (!u) return;
      try {
        origins.add(new URL(u).origin);
      } catch {
        // ignore invalid URLs
      }
    });

    const links: HTMLLinkElement[] = [];
    origins.forEach((origin) => {
      (['preconnect', 'dns-prefetch'] as const).forEach((rel) => {
        const link = document.createElement('link');
        link.rel = rel;
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
        links.push(link);
      });
    });

    return () => {
      links.forEach((l) => l.remove());
    };
  }, [urls.join('|')]);
}
