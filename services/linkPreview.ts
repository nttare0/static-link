import { webUrl } from '../utils/media';

export interface LinkPreview { title?: string; description?: string; imageUrl?: string }
/** Fetch directly in the browser: many sites block cross-origin requests. No third-party proxy is used. */
export async function fetchLinkPreview(value: string): Promise<LinkPreview> {
  const url = webUrl(value);
  if (!url) throw new Error('Enter a valid HTTP or HTTPS URL first.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page metadata unavailable.');
    const document = new DOMParser().parseFromString(await response.text(), 'text/html');
    const meta = (name: string) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim();
    const title = meta('og:title') || meta('twitter:title') || document.querySelector('title')?.textContent?.trim();
    const description = meta('og:description') || meta('description');
    const rawImage = meta('og:image') || meta('twitter:image');
    let imageUrl: string | undefined;
    if (rawImage) { try { imageUrl = webUrl(new URL(rawImage, response.url).href) || undefined; } catch { /* Ignore invalid metadata. */ } }
    if (!title && !description && !imageUrl) throw new Error('No page metadata found.');
    return { title: title?.slice(0, 300), description: description?.slice(0, 500), imageUrl };
  } finally { clearTimeout(timeout); }
}
