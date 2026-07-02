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
    // Only transform Supabase storage public object URLs
    // e.g. https://xxx.supabase.co/storage/v1/object/public/bucket/path.png
    const marker = '/storage/v1/object/public/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;

    const base = url.substring(0, idx);
    const rest = url.substring(idx + marker.length);
    // Strip any existing query string on the source
    const [path, existingQuery] = rest.split('?');

    const params = new URLSearchParams(existingQuery || '');
    if (opts.width) params.set('width', String(Math.round(opts.width)));
    if (opts.height) params.set('height', String(Math.round(opts.height)));
    params.set('quality', String(opts.quality ?? 70));
    if (opts.resize) params.set('resize', opts.resize);

    return `${base}/storage/v1/render/image/public/${path}?${params.toString()}`;
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
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return undefined;
  return [1, 2]
    .map((dpr) => `${optimizeImage(url, { ...opts, width: baseWidth * dpr })} ${dpr}x`)
    .join(', ');
}