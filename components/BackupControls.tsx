import React, { useRef, useState } from 'react';
import saveAs from 'file-saver';
import { db } from '../db/db';
import { makeBackup, parseBackup } from '../services/backup';
import { restoreBackup } from '../services/restoreBackup';
import type { Bundle } from '../types';

export const BackupControls: React.FC = () => {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Bundle[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const backup = async () => {
    try {
      const bundles = await db.bundles.toArray();
      saveAs(new Blob([makeBackup(bundles)], { type: 'application/json' }), `linknest-backup-${new Date().toISOString().slice(0,10)}.json`);
      setStatus(`Backup created with ${bundles.length} bundles. Keep this unencrypted file private.`);
    } catch { setStatus('Could not create backup. Please try again.'); }
  };
  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPending(parseBackup(await file.text())); setStatus(''); }
    catch (error) { setPending(null); setStatus(error instanceof Error ? error.message : 'Could not read backup.'); }
  };
  const restore = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const result = await restoreBackup(pending);
      setStatus(`Restored ${result.added} bundles; skipped ${result.skipped} already present.`);
      setPending(null);
    } catch { setStatus('Restore failed; no bundles were imported. Check available storage.'); }
    finally { setBusy(false); }
  };
  return <section className="bg-card border border-border rounded-lg p-4 space-y-3" aria-label="Backup and restore">
    <h2 className="font-semibold">Backup &amp; restore</h2>
    <p className="text-sm text-muted-foreground">Save all bundles, including files and organization, to a private, unencrypted backup.</p>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={backup} className="px-3 py-2 text-sm font-medium bg-muted rounded-md hover:bg-accent">Download backup</button><button type="button" onClick={() => input.current?.click()} className="px-3 py-2 text-sm font-medium bg-muted rounded-md hover:bg-accent">Restore backup</button><input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={choose}/></div>
    {pending && <div className="text-sm space-y-2"><p>Restore {pending.length} bundles? Existing bundle IDs will be skipped, not overwritten.</p><div className="flex gap-2"><button disabled={busy} onClick={restore} className="px-3 py-2 bg-primary text-primary-foreground rounded-md">Confirm restore</button><button disabled={busy} onClick={() => setPending(null)} className="px-3 py-2 bg-muted rounded-md">Cancel</button></div></div>}
    {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
  </section>;
};
