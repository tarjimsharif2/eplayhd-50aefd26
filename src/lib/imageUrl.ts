/**
 * Optimize image URLs served from Supabase Storage using the built-in
 * image transformation endpoint. Automatically returns WebP/AVIF to
 * supporting browsers (Supabase negotiates via the Accept header when
 * using the /render/image/ endpoint).
 *
 * For non-Supabase URLs (external logos/badges), returns the URL unchanged.
 */
export type ImageOpts = {
  width?: number;
  height?: number;
  quality?: number; // 20-100
  resize?: 'cover' | 'contain' | 'fill';
};

export function optimizeImage(url: string | null | undefined, opts: ImageOpts = {}): string {
  if (!url) return '';
  try {
    const marker = '/storage/v1/object/public/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const base = url.substring(0, idx);
      const rest = url.substring(idx + marker.length);
      const [path, existingQuery] = rest.split('?');
      const params = new URLSearchParams(existingQuery || '');
      if (opts.width) params.set('width', String(Math.round(opts.width)));
      if (opts.height) params.set('height', String(Math.round(opts.height)));
      params.set('quality', String(opts.quality ?? 70));
      if (opts.resize) params.set('resize', opts.resize);
      return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`;
    }

    // External URL: proxy via images.weserv.nl for resize + WebP/AVIF
    if (!/^https?:\/\//i.test(url)) return url;
    if (/^data:|\.svg(\?|$)/i.test(url)) return url;
    // wsrv.nl requires host without scheme
    const stripped = url.replace(/^https?:\/\//i, '');
    const params = new URLSearchParams();
    params.set('url', stripped);
    if (opts.width) params.set('w', String(Math.round(opts.width)));
    if (opts.height) params.set('h', String(Math.round(opts.height)));
    params.set('q', String(opts.quality ?? 75));
    params.set('output', 'webp');
    if (opts.resize === 'contain') params.set('fit', 'contain');
    else if (opts.resize === 'fill') params.set('fit', 'fill');
    else params.set('fit', 'cover');
    return `https://images.weserv.nl/?${params.toString()}`;
  } catch {
    return url;
  }
}

/**
 * Build a srcset for responsive images at multiple DPRs.
 */
export function optimizeSrcSet(
  url: string | null | undefined,
  baseWidth: number,
  opts: Omit<ImageOpts, 'width'> = {}
): string | undefined {
  if (!url) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  if (/^data:|\.svg(\?|$)/i.test(url)) return undefined;
  return [1, 2]
    .map((dpr) => `${optimizeImage(url, { ...opts, width: baseWidth * dpr })} ${dpr}x`)
    .join(', ');
}