import React, { useState } from 'react';
import type { Bundle } from '../types';
import { useBundles } from '../hooks/useBundles';

export const BundleOrganization: React.FC<{ bundle: Bundle }> = ({ bundle }) => {
  const { updateBundle, bundles } = useBundles();
  const [folder, setFolder] = useState(bundle.folder || '');
  const [tags, setTags] = useState((bundle.tags || []).join(', '));
  const [saved, setSaved] = useState(false);
  const folders = [...new Set((bundles || []).map(b => b.folder).filter(Boolean))] as string[];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const uniqueTags = [...new Set(tags.split(',').map(t => t.trim()).filter(Boolean))];
    await updateBundle(bundle.id, { folder: folder.trim(), tags: uniqueTags });
    setSaved(true);
  };
  return <form onSubmit={save} className="bg-card border border-border rounded-lg p-4 mb-6 space-y-3">
    <h2 className="font-semibold">Organize bundle</h2>
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm text-muted-foreground">Folder
        <input list="bundle-folders" value={folder} onChange={e => {setFolder(e.target.value); setSaved(false);}} placeholder="e.g. Work" className="mt-1 block w-full px-3 py-2 bg-transparent border border-input rounded-md text-foreground" />
        <datalist id="bundle-folders">{folders.map(name => <option key={name} value={name}/>)}</datalist>
      </label>
      <label className="text-sm text-muted-foreground">Tags (comma-separated)
        <input value={tags} onChange={e => {setTags(e.target.value); setSaved(false);}} placeholder="e.g. ideas, research" className="mt-1 block w-full px-3 py-2 bg-transparent border border-input rounded-md text-foreground" />
      </label>
    </div>
    <div className="flex items-center gap-3"><button type="submit" className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-md">Save organization</button><span role="status" className="text-sm text-muted-foreground">{saved ? 'Saved' : ''}</span></div>
  </form>;
};
