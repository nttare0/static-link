import type { Bundle } from '../types';
import { ItemType } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (obj: Record<string, unknown>, keys: string[]) => keys.every(key => isString(obj[key]));

// Validate the entire file before any data is written to IndexedDB.
function validItem(value: unknown): boolean {
  if (!isObject(value) || !strings(value, ['id', 'type', 'title', 'createdAt'])) return false;
  switch (value.type) {
    case ItemType.LINK: return strings(value, ['url']) && (value.description === undefined || isString(value.description)) && (value.imageUrl === undefined || isString(value.imageUrl));
    case ItemType.IMAGE_LINK: case ItemType.VIDEO: return strings(value, ['url']);
    case ItemType.NOTE: return strings(value, ['text']);
    case ItemType.FILE: return strings(value, ['filename', 'mimeType', 'content', 'checksum']) && typeof value.size === 'number';
    case ItemType.AUDIO: return strings(value, ['filename', 'mimeType', 'content']) && typeof value.size === 'number' && typeof value.duration === 'number';
    case ItemType.DRAWING: return strings(value, ['filename', 'mimeType', 'content']) && typeof value.size === 'number';
    case ItemType.CHECKLIST: return Array.isArray(value.items) && value.items.every(i => isObject(i) && strings(i, ['id', 'text']) && typeof i.checked === 'boolean');
    case ItemType.CONTACT: return strings(value, ['firstName', 'lastName', 'phone', 'email', 'organization', 'address']);
    case ItemType.LOCATION: return strings(value, ['address']) && typeof value.latitude === 'number' && typeof value.longitude === 'number';
    case ItemType.EMAIL: return strings(value, ['to', 'subject', 'body']);
    case ItemType.CODE: return strings(value, ['language', 'code']);
    default: return false;
  }
}
export function makeBackup(bundles: Bundle[]): string {
  return JSON.stringify({ format: 'linknest-backup', version: 1, exportedAt: new Date().toISOString(), bundles }, null, 2);
}
export function parseBackup(text: string): Bundle[] {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This is not a valid JSON backup.'); }
  if (!isObject(data) || data.format !== 'linknest-backup' || data.version !== 1 || !Array.isArray(data.bundles)) throw new Error('Unsupported LinkNest backup format.');
  const ids = new Set<string>();
  for (const bundle of data.bundles) {
    if (!isObject(bundle) || !strings(bundle, ['id', 'title', 'createdAt', 'updatedAt']) || !Array.isArray(bundle.items) || !bundle.items.every(validItem) || (bundle.folder !== undefined && !isString(bundle.folder)) || (bundle.tags !== undefined && (!Array.isArray(bundle.tags) || !bundle.tags.every(isString))) || (bundle.isLocked !== undefined && typeof bundle.isLocked !== 'boolean') || (bundle.passwordHash !== undefined && !isString(bundle.passwordHash))) throw new Error('Backup contains an invalid bundle or item.');
    if (ids.has(bundle.id as string)) throw new Error('Backup contains duplicate bundle IDs.');
    ids.add(bundle.id as string);
  }
  return data.bundles as Bundle[];
}
