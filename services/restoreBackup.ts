import { db } from '../db/db';
import type { Bundle } from '../types';

/** Restore is atomic and never replaces existing bundles. */
export async function restoreBackup(bundles: Bundle[]): Promise<{ added: number; skipped: number }> {
  let added = 0;
  await db.transaction('rw', db.bundles, async () => {
    for (const bundle of bundles) {
      if (!await db.bundles.get(bundle.id)) { await db.bundles.add(bundle); added++; }
    }
  });
  return { added, skipped: bundles.length - added };
}
