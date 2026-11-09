/** Allow only web URLs; these values can also come from imported bundles. */
export function webUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function videoSource(value: string): { kind: 'embed' | 'video'; url: string } | null {
  const valid = webUrl(value);
  if (!valid) return null;
  const url = new URL(valid);
  const host = url.hostname.toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = url.pathname.split('/')[1] || '';
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    const parts = url.pathname.split('/');
    id = url.pathname === '/watch' ? url.searchParams.get('v') || '' : ['embed', 'shorts', 'live'].includes(parts[1]) ? parts[2] || '' : '';
  }
  if (/^[\w-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/);
    if (match) return { kind: 'embed', url: `https://player.vimeo.com/video/${match[1]}` };
  }
  if (/\.(mp4|webm|ogv)(?:$)/i.test(url.pathname)) return { kind: 'video', url: valid };
  return null;
}

export function imageUrlFromTransfer(data: DataTransfer): string | null {
  const html = data.getData('text/html');
  if (html) {
    const src = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src');
    if (src && webUrl(src)) return webUrl(src);
  }
  const text = (data.getData('text/uri-list').split('\n').find(line => line && !line.startsWith('#')) || data.getData('text/plain')).trim();
  const valid = webUrl(text);
  return valid && /\.(png|jpe?g|gif|webp|avif|bmp|svg)(?:$)/i.test(new URL(valid).pathname) ? valid : null;
}
