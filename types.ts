export enum ItemType {
  LINK = 'link',
  IMAGE_LINK = 'image_link',
  VIDEO = 'video',
  NOTE = 'note',
  FILE = 'file',
  AUDIO = 'audio',
  CHECKLIST = 'checklist',
  CONTACT = 'contact',
  LOCATION = 'location',
  DRAWING = 'drawing',
  EMAIL = 'email',
  CODE = 'code',
}

export interface BaseBundleItem {
  id: string;
  type: ItemType;
  title: string;
  createdAt: string;
}

export interface LinkItem extends BaseBundleItem {
  type: ItemType.LINK;
  url: string;
  description?: string;
  imageUrl?: string;
}

export interface ImageLinkItem extends BaseBundleItem {
  type: ItemType.IMAGE_LINK;
  url: string;
}

export interface VideoItem extends BaseBundleItem {
  type: ItemType.VIDEO;
  url: string;
}

export interface NoteItem extends BaseBundleItem {
  type: ItemType.NOTE;
  text: string;
}

export interface FileItem extends BaseBundleItem {
  type: ItemType.FILE;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // Base64 encoded content
  checksum: string; // SHA-256
}

export interface AudioItem extends BaseBundleItem {
  type: ItemType.AUDIO;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // Base64 encoded content
  duration: number; // in seconds
}

export interface ChecklistItem extends BaseBundleItem {
  type: ItemType.CHECKLIST;
  items: { id: string; text: string; checked: boolean }[];
}

export interface ContactItem extends BaseBundleItem {
  type: ItemType.CONTACT;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  organization: string;
  address: string;
}

export interface LocationItem extends BaseBundleItem {
  type: ItemType.LOCATION;
  latitude: number;
  longitude: number;
  address: string;
}

export interface DrawingItem extends BaseBundleItem {
    type: ItemType.DRAWING;
    filename: string;
    mimeType: string; // e.g., 'image/png'
    size: number;
    content: string; // Base64 encoded content
}

export interface EmailItem extends BaseBundleItem {
    type: ItemType.EMAIL;
    to: string;
    subject: string;
    body: string;
}

export interface CodeSnippetItem extends BaseBundleItem {
    type: ItemType.CODE;
    language: string;
    code: string;
}

export type BundleItem = LinkItem | ImageLinkItem | VideoItem | NoteItem | FileItem | AudioItem | ChecklistItem | ContactItem | LocationItem | DrawingItem | EmailItem | CodeSnippetItem;

export interface Bundle {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  items: BundleItem[];
  folder?: string;
  tags?: string[];
  isLocked?: boolean;
  passwordHash?: string;
}

export enum Screen {
  HOME = 'home',
  EDITOR = 'editor',
  SHARE = 'share',
}
