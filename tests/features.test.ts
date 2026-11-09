import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup } from '../services/backup';
import { bundleMatches } from '../utils/search';
import { restoreBackup } from '../services/restoreBackup';
import { db } from '../db/db';
import { ItemType, type Bundle } from '../types';

const bundle: Bundle = {
  id: 'one', title: 'Research', createdAt: '2026-01-01', updatedAt: '2026-01-01', folder: 'Work', tags: ['ideas'],
  items: [
    { id: 'n', type: ItemType.NOTE, title: 'Note', createdAt: '2026-01-01', text: 'A rare searchable phrase' },
    { id: 'f', type: ItemType.FILE, title: 'Picture', createdAt: '2026-01-01', filename: 'a.png', mimeType: 'image/png', size: 1, checksum: 'abc', content: 'data:image/png;base64,YQ==' },
  ],
};

test('backup round trip retains binary content and organization', () => {
  assert.deepEqual(parseBackup(makeBackup([bundle])), [bundle]);
});
test('backup rejects invalid formats, malformed items, and duplicate IDs', () => {
  assert.throws(() => parseBackup('{}'));
  const broken = { ...bundle, items: [{ ...bundle.items[1], content: null }] };
  assert.throws(() => parseBackup(JSON.stringify({ format: 'linknest-backup', version: 1, bundles: [broken] })));
  assert.throws(() => parseBackup(makeBackup([bundle, bundle])));
});
test('global search covers folder, tags and content but hides locked content', () => {
  assert.equal(bundleMatches(bundle, 'work'), true);
  assert.equal(bundleMatches(bundle, 'ideas'), true);
  assert.equal(bundleMatches(bundle, 'searchable phrase'), true);
  assert.equal(bundleMatches({ ...bundle, isLocked: true }, 'searchable phrase'), false);
  assert.equal(bundleMatches({ ...bundle, isLocked: true }, 'research'), true);
});
test('restore skips existing IDs without overwriting and retains new bundles', async () => {
  await db.bundles.clear();
  await db.bundles.add(bundle);
  const incoming = { ...bundle, title: 'Do not overwrite' };
  const second = { ...bundle, id: 'two', title: 'New' };
  const result = await restoreBackup([incoming, second]);
  assert.deepEqual(result, { added: 1, skipped: 1 });
  assert.equal((await db.bundles.get('one'))?.title, 'Research');
  assert.deepEqual(await db.bundles.get('two'), second);
  await db.bundles.clear();
});

test('restore rolls back all writes if a later write fails', async () => {
  await db.bundles.clear();
  const rejectSecond = (key: unknown) => { if (key === 'bad') throw new Error('simulated failure'); };
  db.bundles.hook('creating', rejectSecond);
  try {
    await assert.rejects(restoreBackup([{ ...bundle, id: 'good' }, { ...bundle, id: 'bad' }]));
    assert.equal(await db.bundles.get('good'), undefined);
  } finally {
    db.bundles.hook('creating').unsubscribe(rejectSecond);
    await db.bundles.clear();
  }
});

test('link previews use public metadata and resolve relative thumbnails', async () => {
  const { fetchLinkPreview } = await import('../services/linkPreview');
  const originalFetch = globalThis.fetch;
  const originalParser = globalThis.DOMParser;
  globalThis.fetch = (async () => ({ ok: true, url: 'https://example.com/path/page', headers: new Headers({ 'content-type': 'text/html' }), text: async () => '<html></html>' })) as unknown as typeof fetch;
  globalThis.DOMParser = class {
    parseFromString() {
      return { querySelector(selector: string) {
        const content = selector.includes('og:title') ? 'Page title' : selector.includes('og:description') ? 'Description' : selector.includes('og:image') ? '../image.png' : '';
        return content ? { getAttribute: () => content, textContent: content } : null;
      }};
    }
  } as unknown as typeof DOMParser;
  try {
    assert.deepEqual(await fetchLinkPreview('https://example.com/path/page'), { title: 'Page title', description: 'Description', imageUrl: 'https://example.com/image.png' });
    await assert.rejects(fetchLinkPreview('javascript:alert(1)'));
  } finally { globalThis.fetch = originalFetch; globalThis.DOMParser = originalParser; }
});
