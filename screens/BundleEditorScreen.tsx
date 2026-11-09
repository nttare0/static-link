import React, { useState, useEffect, useMemo } from 'react';
import { useBundles } from '../hooks/useBundles';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ItemType } from '../types';
import type { Bundle, BundleItem, FileItem, LinkItem, NoteItem, AudioItem, ChecklistItem, ContactItem, LocationItem, DrawingItem, EmailItem, CodeSnippetItem } from '../types';
import { IconArrowLeft, IconChevronDown, IconChevronUp, IconDownload, IconFile, IconLink, IconNote, IconTrash, IconShare2, IconCopy, IconCheck, IconMic, IconListChecks, IconContact, IconMapPin, IconPenSquare, IconMail, IconImage, IconFileText, IconCode, IconSearch, IconLock, IconUnlock, IconEdit, IconVideo } from '../components/icons';
import { AddItemForms } from '../components/AddItemForms';
import { BundleOrganization } from '../components/BundleOrganization';
import { ImageDropZone } from '../components/ImageDropZone';
import { videoSource, webUrl } from '../utils/media';
import { base64ToBlob } from '../services/bundleService';
import saveAs from 'file-saver';
import Modal from '../components/Modal';
import showdown from 'showdown';

interface BundleEditorScreenProps {
  bundleId: string;
  onBack: () => void;
  onNavigateToShare: (bundleId: string) => void;
}

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

type SortOption = 'manual' | 'createdAt_desc' | 'createdAt_asc' | 'title_asc' | 'title_desc' | 'type_asc';

const markdownConverter = new showdown.Converter({ sanitize: true });

const NoteItemCard: React.FC<{ item: NoteItem, onUpdate: (updates: Partial<NoteItem>) => void }> = ({ item, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(item.text);

    const handleSave = () => {
        onUpdate({ text: editText });
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="mt-2 space-y-2">
                <textarea 
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={5}
                    className="w-full text-sm p-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs font-medium text-foreground bg-muted rounded-md hover:bg-accent">Cancel</button>
                    <button onClick={handleSave} className="px-3 py-1 text-xs font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90">Save</button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <div 
                className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground mt-2" 
                dangerouslySetInnerHTML={{ __html: markdownConverter.makeHtml(item.text) }} 
            />
            <button 
                onClick={() => setIsEditing(true)} 
                className="absolute -top-1 -right-1 p-1.5 text-muted-foreground hover:text-primary rounded-full hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit note"
            >
                <IconEdit size={14} />
            </button>
        </div>
    );
};


const BundleEditorScreen: React.FC<BundleEditorScreenProps> = ({ bundleId, onBack, onNavigateToShare }) => {
  const { updateBundle, removeItemFromBundle, moveItemInBundle, updateItemInBundle } = useBundles();
  const bundle = useLiveQuery(() => db.bundles.get(bundleId), [bundleId]);
  const [title, setTitle] = useState(bundle?.title || '');
  const [itemToDelete, setItemToDelete] = useState<BundleItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('manual');
  const [activeFilters, setActiveFilters] = useState<ItemType[]>([]);


  useEffect(() => {
    setTitle(bundle?.title || '');
  }, [bundle?.title]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };
  
  const handleTitleBlur = () => {
    if (bundle && title.trim() && title !== bundle.title) {
      updateBundle(bundle.id, { title });
    } else {
        setTitle(bundle?.title || '');
    }
  };

  const handleDeleteConfirm = () => {
    if(itemToDelete && bundle) {
        removeItemFromBundle(bundle.id, itemToDelete.id);
        setItemToDelete(null);
    }
  }
  
  const toggleFilter = (type: ItemType) => {
    setActiveFilters(prev => 
        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const processedItems = useMemo(() => {
    if (!bundle) return [];
    
    // 1. Filter
    let items = activeFilters.length > 0 
        ? bundle.items.filter(item => activeFilters.includes(item.type))
        : bundle.items;

    // 2. Search
    if (searchQuery.trim()) {
        const lowercasedQuery = searchQuery.toLowerCase();
        items = items.filter(item => {
            if (item.title.toLowerCase().includes(lowercasedQuery)) return true;
            // (rest of search logic)
            switch(item.type) {
                case ItemType.IMAGE_LINK:
                case ItemType.VIDEO:
                case ItemType.LINK: return (item as LinkItem).url.toLowerCase().includes(lowercasedQuery);
                case ItemType.NOTE: return (item as NoteItem).text.toLowerCase().includes(lowercasedQuery);
                case ItemType.FILE: return (item as FileItem).filename.toLowerCase().includes(lowercasedQuery);
                case ItemType.CHECKLIST: return (item as ChecklistItem).items.some(i => i.text.toLowerCase().includes(lowercasedQuery));
                case ItemType.CONTACT:
                    const c = item as ContactItem;
                    return `${c.firstName} ${c.lastName} ${c.email} ${c.organization} ${c.phone} ${c.address}`.toLowerCase().includes(lowercasedQuery);
                case ItemType.LOCATION: return (item as LocationItem).address.toLowerCase().includes(lowercasedQuery);
                case ItemType.EMAIL:
                    const e = item as EmailItem;
                    return `${e.to} ${e.subject} ${e.body}`.toLowerCase().includes(lowercasedQuery);
                case ItemType.CODE:
                    const code = item as CodeSnippetItem;
                    return `${code.language} ${code.code}`.toLowerCase().includes(lowercasedQuery);
                default: return false;
            }
        });
    }

    // 3. Sort
    return [...items].sort((a, b) => {
        switch (sortOption) {
            case 'manual': return 0;
            case 'createdAt_desc': return b.createdAt.localeCompare(a.createdAt);
            case 'createdAt_asc': return a.createdAt.localeCompare(b.createdAt);
            case 'title_asc': return a.title.localeCompare(b.title);
            case 'title_desc': return b.title.localeCompare(a.title);
            case 'type_asc': return a.type.localeCompare(b.type);
            default: return 0;
        }
    });
}, [bundle, searchQuery, sortOption, activeFilters]);

  if (!bundle) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading bundle...</p>
        </div>
      </div>
    );
  }

  const ItemCard: React.FC<{ item: BundleItem }> = ({ item }) => {
    const [copied, setCopied] = useState(false);
    
    const originalIndex = bundle.items.findIndex(i => i.id === item.id);
    const isFirst = originalIndex === 0;
    const isLast = originalIndex === bundle.items.length - 1;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    
    const handleDownload = (itemWithContent: {content: string, mimeType: string, filename: string}) => {
        const blob = base64ToBlob(itemWithContent.content, itemWithContent.mimeType);
        saveAs(blob, itemWithContent.filename);
    }

    const handleChecklistToggle = (checklistItem: ChecklistItem, itemIndex: number) => {
        const newItems = [...checklistItem.items];
        newItems[itemIndex].checked = !newItems[itemIndex].checked;
        updateItemInBundle(bundleId, checklistItem.id, { items: newItems });
    };

    const renderItemContent = () => {
      switch (item.type) {
        case ItemType.LINK: {
            const url = webUrl(item.url);
            const image = item.imageUrl && webUrl(item.imageUrl);
            return <div className="mt-1">{url ? <a className="text-sm text-primary break-all hover:underline" href={url} target="_blank" rel="noopener noreferrer">{item.url}</a> : <p className="text-sm text-destructive">Invalid link</p>}{image && <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 max-h-40 rounded-md" />}{item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}</div>;
        }
        case ItemType.IMAGE_LINK: {
            const url = webUrl(item.url);
            return url ? <div className="mt-2"><a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="max-h-64 max-w-full rounded-md object-contain" /></a><p className="text-xs text-muted-foreground mt-1">External image · internet required</p></div> : <p className="text-sm text-destructive">Invalid image URL</p>;
        }
        case ItemType.VIDEO: {
            const source = videoSource(item.url);
            if (!source) return <p className="text-sm text-destructive">Unsupported video URL</p>;
            return <div className="mt-2"><div className="aspect-video max-w-xl">{source.kind === 'embed' ? <iframe src={source.url} title={item.title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="w-full h-full rounded-md" /> : <video src={source.url} controls preload="metadata" className="w-full h-full rounded-md" />}</div><p className="text-xs text-muted-foreground mt-1">External video · internet required</p></div>;
        }
        case ItemType.NOTE: return <NoteItemCard item={item as NoteItem} onUpdate={(updates) => updateItemInBundle(bundleId, item.id, updates)} />;
        case ItemType.FILE:
            const file = item as FileItem;
             if (file.mimeType.startsWith('image/')) {
                return <img src={file.content} alt={file.filename} className="mt-2 max-h-48 rounded-md object-contain"/>
            }
            return <p className="text-sm text-foreground">{file.filename} <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(2)} KB)</span></p>;
        case ItemType.AUDIO: return <audio src={item.content} controls className="w-full mt-2 h-10" />;
        case ItemType.CHECKLIST:
            return <ul className="space-y-2 mt-2">
                {(item as ChecklistItem).items.map((checkItem, idx) => (
                    <li key={checkItem.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={checkItem.checked} onChange={() => handleChecklistToggle(item as ChecklistItem, idx)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"/>
                        <span className={checkItem.checked ? 'line-through text-muted-foreground' : 'text-foreground'}>{checkItem.text}</span>
                    </li>
                ))}
            </ul>;
        case ItemType.CONTACT:
            const contact = item as ContactItem;
            return <div className="text-sm text-muted-foreground space-y-1 mt-2">
                {contact.phone && <p><strong>Phone:</strong> {contact.phone}</p>}
                {contact.email && <p><strong>Email:</strong> {contact.email}</p>}
                {contact.organization && <p><strong>Org:</strong> {contact.organization}</p>}
            </div>
        case ItemType.LOCATION:
             const loc = item as LocationItem;
            return <a href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline mt-2 block">
                {loc.address || `${loc.latitude}, ${loc.longitude}`}
            </a>
        case ItemType.DRAWING: return <img src={item.content} alt={item.title} className="mt-2 max-h-48 rounded-md border border-border" />
        case ItemType.EMAIL:
            const email = item as EmailItem;
            return <div className="text-sm mt-2 space-y-1">
                <p><strong className="text-muted-foreground">To:</strong> {email.to}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{email.body.substring(0,100)}{email.body.length > 100 ? '...' : ''}</p>
            </div>
        case ItemType.CODE:
            const code = item as CodeSnippetItem;
            return <div className="mt-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground bg-muted px-2 py-1 rounded-md">{code.language}</span>
                <pre className="bg-muted p-3 rounded-md mt-2 overflow-x-auto text-sm"><code className="font-mono">{code.code.substring(0, 200)}{code.code.length > 200 ? '...' : ''}</code></pre>
            </div>;
        default: return null;
      }
    };

    const getItemIcon = () => {
        const iconProps = { className: "w-6 h-6" };
        switch (item.type) {
            case ItemType.LINK: return <IconLink {...iconProps} className="text-primary"/>;
            case ItemType.IMAGE_LINK: return <IconImage {...iconProps} className="text-purple-500"/>;
            case ItemType.VIDEO: return <IconVideo {...iconProps} className="text-red-500"/>;
            case ItemType.NOTE: return <IconNote {...iconProps} className="text-secondary"/>;
            case ItemType.FILE:
                const file = item as FileItem;
                if (file.mimeType.startsWith('image/')) return <IconImage {...iconProps} className="text-purple-500" />;
                if (file.mimeType.includes('pdf') || file.mimeType.includes('document')) return <IconFileText {...iconProps} className="text-blue-500" />;
                return <IconFile {...iconProps} className="text-orange-500"/>;
            case ItemType.AUDIO: return <IconMic {...iconProps} className="text-red-500"/>;
            case ItemType.CHECKLIST: return <IconListChecks {...iconProps} className="text-indigo-500"/>;
            case ItemType.CONTACT: return <IconContact {...iconProps} className="text-teal-500"/>;
            case ItemType.LOCATION: return <IconMapPin {...iconProps} className="text-green-500"/>;
            case ItemType.DRAWING: return <IconPenSquare {...iconProps} className="text-purple-500"/>;
            case ItemType.EMAIL: return <IconMail {...iconProps} className="text-blue-500"/>;
            case ItemType.CODE: return <IconCode {...iconProps} className="text-yellow-500"/>;
            default: return null;
        }
    };
    
    return (
      <div onDragOver={e => { if (Array.from(e.dataTransfer.types).includes('application/x-linknest-item') && sortOption === 'manual' && !searchQuery.trim() && activeFilters.length === 0) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }} onDrop={e => { const draggedId = e.dataTransfer.getData('application/x-linknest-item'); if (!draggedId || sortOption !== 'manual' || searchQuery.trim() || activeFilters.length) return; e.preventDefault(); const from = bundle.items.findIndex(i => i.id === draggedId); if (from >= 0 && from !== originalIndex) void moveItemInBundle(bundleId, from, originalIndex); }} className="bg-card p-4 rounded-lg border border-border flex items-start gap-4 transition-shadow hover:shadow-md group">
        <button type="button" draggable={sortOption === 'manual' && !searchQuery.trim() && activeFilters.length === 0} onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-linknest-item', item.id); }} title="Drag to reorder in manual order" aria-label={`Drag ${item.title} to reorder; use move buttons for keyboard access`} className="cursor-grab text-muted-foreground p-1 disabled:opacity-40" disabled={sortOption !== 'manual' || !!searchQuery.trim() || activeFilters.length > 0}>⋮⋮</button>
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-muted rounded-full">
            {getItemIcon()}
        </div>
        <div className="flex-grow min-w-0">
          <h4 className="font-semibold text-card-foreground truncate">{item.title}</h4>
          {renderItemContent()}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
            {(item.type === ItemType.FILE || item.type === ItemType.AUDIO || item.type === ItemType.DRAWING) && <button title="Download" onClick={() => handleDownload(item as any)} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent"><IconDownload size={18} /></button>}
            {(item.type === ItemType.LINK) && <button title="Copy URL" onClick={() => handleCopy((item as LinkItem).url)} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent">{copied ? <IconCheck size={18} className="text-green-500" /> : <IconCopy size={18} />}</button>}
            {(item.type === ItemType.NOTE) && <button title="Copy Text" onClick={() => handleCopy((item as NoteItem).text)} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent">{copied ? <IconCheck size={18} className="text-green-500" /> : <IconCopy size={18} />}</button>}
            {(item.type === ItemType.CODE) && <button title="Copy Code" onClick={() => handleCopy((item as CodeSnippetItem).code)} className="p-2 text-muted-foreground hover:text-primary rounded-full hover:bg-accent">{copied ? <IconCheck size={18} className="text-green-500" /> : <IconCopy size={18} />}</button>}

            <div className="flex flex-col border-l border-border ml-1 pl-1">
                <button title="Move Up" disabled={isFirst || sortOption !== 'manual' || !!searchQuery.trim() || activeFilters.length > 0} onClick={() => moveItemInBundle(bundleId, originalIndex, originalIndex-1)} className="p-1 disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"><IconChevronUp size={16}/></button>
                <button title="Move Down" disabled={isLast || sortOption !== 'manual' || !!searchQuery.trim() || activeFilters.length > 0} onClick={() => moveItemInBundle(bundleId, originalIndex, originalIndex+1)} className="p-1 disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground"><IconChevronDown size={16}/></button>
            </div>
            <button title="Delete Item" onClick={() => setItemToDelete(item)} className="p-2 text-muted-foreground hover:text-destructive rounded-full hover:bg-accent">
                <IconTrash size={18} />
            </button>
        </div>
      </div>
    );
  };

  const PasswordManagementModal: React.FC<{onClose: () => void}> = ({ onClose }) => {
    const [mode, setMode] = useState<'set' | 'remove'>(bundle.isLocked ? 'remove' : 'set');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password.length < 4) {
            setError('Password must be at least 4 characters long.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        const passwordHash = await hashPassword(password);
        await updateBundle(bundleId, { isLocked: true, passwordHash });
        onClose();
    };

    const handleRemovePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const hashed = await hashPassword(password);
        if (hashed !== bundle.passwordHash) {
            setError('Incorrect password.');
            return;
        }
        await updateBundle(bundleId, { isLocked: false, passwordHash: '' });
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Manage Bundle Protection">
            {mode === 'set' && (
                <form onSubmit={handleSetPassword} className="space-y-4">
                    <p>Set a password to lock this bundle. You will need it to view the contents later.</p>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New Password" required className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm Password" required className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-medium bg-muted text-foreground rounded-md hover:bg-accent">Cancel</button>
                        <button type="submit" className="px-4 py-2 font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90">Set Password</button>
                    </div>
                </form>
            )}
            {mode === 'remove' && (
                 <form onSubmit={handleRemovePassword} className="space-y-4">
                    <p>Enter the current password to remove protection from this bundle.</p>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Current Password" required className="w-full px-3 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                     <div className="flex justify-between items-center pt-2">
                        <button type="button" onClick={() => setMode('set')} className="text-sm text-primary hover:underline">Want to change password?</button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 font-medium bg-muted text-foreground rounded-md hover:bg-accent">Cancel</button>
                            <button type="submit" className="px-4 py-2 font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90">Remove Protection</button>
                        </div>
                    </div>
                 </form>
            )}
        </Modal>
    );
  };
  
  const filterOptions: {label: string, type: ItemType}[] = [
      { label: 'Link', type: ItemType.LINK },
      { label: 'Image link', type: ItemType.IMAGE_LINK },
      { label: 'Video', type: ItemType.VIDEO },
      { label: 'Note', type: ItemType.NOTE },
      { label: 'File', type: ItemType.FILE },
      { label: 'Code', type: ItemType.CODE },
      { label: 'Audio', type: ItemType.AUDIO },
      { label: 'Checklist', type: ItemType.CHECKLIST },
      { label: 'Contact', type: ItemType.CONTACT },
      { label: 'Location', type: ItemType.LOCATION },
      { label: 'Drawing', type: ItemType.DRAWING },
      { label: 'Email', type: ItemType.EMAIL },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {isPasswordModalOpen && <PasswordManagementModal onClose={() => setIsPasswordModalOpen(false)} />}
      <header className="mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-4">
          <IconArrowLeft size={16} />
          Back to My Bundles
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="text-3xl font-bold bg-transparent focus:outline-none w-full text-foreground -ml-1 p-1 rounded-md focus:bg-accent"
            aria-label="Bundle Title"
          />
          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap bg-muted px-3 py-1.5 rounded-full">{bundle.items.length} {bundle.items.length === 1 ? 'item' : 'items'}</span>
             <button onClick={() => setIsPasswordModalOpen(true)} title="Manage Protection" className="flex-shrink-0 flex items-center justify-center h-9 w-9 font-semibold text-primary bg-primary/10 rounded-md hover:bg-primary/20 shadow-sm transition-colors">
              {bundle.isLocked ? <IconLock size={18} /> : <IconUnlock size={18} />}
            </button>
            <button onClick={() => onNavigateToShare(bundle.id)} className="flex-shrink-0 flex items-center gap-2 px-4 py-2 font-semibold text-secondary-foreground bg-secondary rounded-md hover:bg-secondary/90 shadow-sm transition-colors">
              <IconShare2 size={18} />
              Share
            </button>
          </div>
        </div>
      </header>
      
      <BundleOrganization key={bundle.id} bundle={bundle} />
      <AddItemForms bundleId={bundle.id} />
      <ImageDropZone bundleId={bundle.id} />

      {bundle.items.length > 0 && (
         <div className="bg-card p-4 rounded-lg border border-border mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                 <div className="relative">
                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={`Search in ${bundle.items.length} items...`}
                      className="w-full sm:w-64 pl-10 pr-4 py-2 bg-transparent border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>
                 <div>
                    <label htmlFor="sort-select" className="sr-only">Sort by</label>
                    <select id="sort-select" value={sortOption} onChange={e => setSortOption(e.target.value as SortOption)} className="w-full sm:w-auto px-3 py-2 bg-transparent border border-input rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                        <option value="manual">Manual order</option>
                        <option value="createdAt_desc">Date (Newest)</option>
                        <option value="createdAt_asc">Date (Oldest)</option>
                        <option value="title_asc">Title (A-Z)</option>
                        <option value="title_desc">Title (Z-A)</option>
                        <option value="type_asc">Type</option>
                    </select>
                </div>
            </div>
            <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">Filter by type:</p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveFilters([])} className={`px-3 py-1 text-sm rounded-full ${activeFilters.length === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>All</button>
                    {filterOptions.map(({label, type}) => (
                        <button key={type} onClick={() => toggleFilter(type)} className={`px-3 py-1 text-sm rounded-full ${activeFilters.includes(type) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{label}</button>
                    ))}
                </div>
            </div>
         </div>
      )}

      <p className="text-xs text-muted-foreground mb-3">Drag the handle to reorder in manual order with no filters; use the arrow buttons for keyboard access.</p>
      <div className="space-y-4">
        {processedItems.length > 0 ? (
          processedItems.map((item) => <ItemCard key={item.id} item={item} />)
        ) : (
          <div className="text-center py-16 px-6 bg-card rounded-lg border-2 border-dashed border-border">
            <h3 className="text-xl font-semibold text-foreground">
                {bundle.items.length === 0 ? 'This bundle is empty' : 'No Matching Items'}
            </h3>
            <p className="mt-2 text-muted-foreground">
                {bundle.items.length === 0 ? 'Add an item to get started.' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        )}
      </div>
      
      <Modal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} title="Delete Item" footer={
        <>
          <button onClick={() => setItemToDelete(null)} className="px-4 py-2 font-medium bg-muted text-foreground rounded-md hover:bg-accent">
            Cancel
          </button>
          <button onClick={handleDeleteConfirm} className="px-4 py-2 font-medium text-destructive-foreground bg-destructive rounded-md hover:bg-destructive/90">
            Delete Item
          </button>
        </>
      }>
        <p>Are you sure you want to delete the item "{itemToDelete?.title}"? This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default BundleEditorScreen;
