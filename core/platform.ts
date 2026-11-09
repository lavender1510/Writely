import type {DocumentFile} from './types';

/** Ciphertext only. Implementations must atomically replace the last good file. */
export interface SealedStorage {
  read(): Promise<string | null>;
  write(envelope: string): Promise<void>;
}
export interface TransferFile {name: string; text: string; base64?:string}
export interface PlatformFiles {
  open(): Promise<TransferFile | null>;
  save(name: string, contents: string, mime: string): Promise<boolean>;
}
export interface DocumentRepository {
  get(id: string): Promise<DocumentFile>;
  put(document: DocumentFile, folderId: string | null): Promise<void>;
  trash(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}
export interface Lifecycle {
  onBackground(callback: () => void): () => void;
}
