import type { Bundle, BundleItem } from '../types';
import { ItemType } from '../types';

export function searchableItemText(item: BundleItem): string {
  const parts: string[] = [item.title];
  switch (item.type) {
    case ItemType.LINK: parts.push(item.url, item.description || ''); break;
    case ItemType.IMAGE_LINK: case ItemType.VIDEO: parts.push(item.url); break;
    case ItemType.NOTE: parts.push(item.text); break;
    case ItemType.FILE: case ItemType.AUDIO: case ItemType.DRAWING: parts.push(item.filename); break;
    case ItemType.CHECKLIST: parts.push(...item.items.map(i => i.text)); break;
    case ItemType.CONTACT: parts.push(item.firstName, item.lastName, item.phone, item.email, item.organization, item.address); break;
    case ItemType.LOCATION: parts.push(item.address, String(item.latitude), String(item.longitude)); break;
    case ItemType.EMAIL: parts.push(item.to, item.subject, item.body); break;
    case ItemType.CODE: parts.push(item.language, item.code); break;
  }
  return parts.join(' ').toLowerCase();
}

export function bundleMatches(bundle: Bundle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ([bundle.title, bundle.folder || '', ...(bundle.tags || [])].some(value => value.toLowerCase().includes(q))) return true;
  // Do not reveal the content of a password-protected bundle in global search.
  return !bundle.isLocked && bundle.items.some(item => searchableItemText(item).includes(q));
}
