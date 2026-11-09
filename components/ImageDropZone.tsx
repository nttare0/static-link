import React, { useState } from 'react';
import { useBundles } from '../hooks/useBundles';
import { calculateChecksum, fileToBase64 } from '../services/bundleService';
import { ItemType } from '../types';
import { imageUrlFromTransfer } from '../utils/media';
import { IconImage } from './icons';

/** A focused paste target avoids hijacking pastes into the editor's text fields. */
export const ImageDropZone: React.FC<{ bundleId: string }> = ({ bundleId }) => {
  const { addItemToBundle } = useBundles();
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const receive = async (data: DataTransfer) => {
    const files = Array.from(data.files).filter(file => file.type.startsWith('image/'));
    const url = files.length ? null : imageUrlFromTransfer(data);
    if (!files.length && !url) {
      setMessage('No image found. Try copying an image, or an image address ending in .jpg, .png, .gif, or .webp.');
      return;
    }
    setBusy(true);
    setMessage('Adding image...');
    try {
      for (const file of files) {
        const id = crypto.randomUUID();
        const name = file.name || `image.${file.type.split('/')[1] || 'png'}`;
        // Package filenames must be unique to avoid overwriting images on export.
        const filename = `${id}-${name}`;
        const content = await fileToBase64(file);
        const checksum = await calculateChecksum(file);
        await addItemToBundle(bundleId, { id, createdAt: new Date().toISOString(), type: ItemType.FILE, title: name, filename, mimeType: file.type, size: file.size, content, checksum });
      }
      if (url) {
        await addItemToBundle(bundleId, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), type: ItemType.IMAGE_LINK, title: 'Image link', url });
      }
      setMessage(files.length ? `${files.length} image${files.length === 1 ? '' : 's'} added to this bundle.` : 'Image link added. It requires an internet connection.');
    } catch {
      setMessage('Could not add the image. Check your browser storage and try again.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="mb-6">
    <div tabIndex={0} role="region" aria-label="Drop or paste images into this bundle" aria-describedby="image-drop-help" onDragEnter={e => { e.preventDefault(); setDragging(true); }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) void receive(e.dataTransfer); }} onPaste={e => { e.preventDefault(); if (!busy) void receive(e.clipboardData); }} className={`rounded-lg border-2 border-dashed p-5 text-center focus:outline-none focus:ring-2 focus:ring-primary ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
      <IconImage size={24} className="mx-auto mb-2 text-primary" />
      <p className="font-semibold">Drop images here or click and paste</p>
      <p id="image-drop-help" className="mt-1 text-sm text-muted-foreground">Copy an image from the web or your device, click here, then press Ctrl+V (⌘+V on Mac). Image links need internet.</p>
    </div>
    <p role="status" className="mt-2 text-sm text-muted-foreground">{message}</p>
  </div>;
};
