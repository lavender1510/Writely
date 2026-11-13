import type { DocumentFile } from "./types";
export interface BookReference {
  id: string;
  title: string;
  color?: string;
  key: string;
  createdAt: string;
  deletedAt?: string;
}
export type BookNodeKind = "part" | "folder" | "chapter" | "scene";
export interface BookRevision {
  blockId: string;
  capturedAt: string;
  title: string;
  label?: string;
}
export interface BookNode {
  id: string;
  parentId: string | null;
  kind: BookNodeKind;
  order: number;
  title: string;
  synopsis: string;
  notes: string;
  color: string;
  statusId: string;
  deletedAt?: string;
  trashBatch?: string;
  document?: {
    blockId: string;
    words: number;
    updatedAt: string;
    history: BookRevision[];
  };
}
export interface BookStatus {
  id: string;
  label: string;
  color: string;
}
export interface BookProject {
  format: "WritelyBookProject";
  schemaVersion: 1;
  id: string;
  revision: number;
  title: string;
  subtitle: string;
  author: string;
  pseudonym: string;
  genre: string;
  language: string;
  description: string;
  notes: string;
  series: string;
  goalWords: number;
  color: string;
  cover?: { blockId: string; mime: string; alt: string };
  createdAt: string;
  updatedAt: string;
  lastNodeId: string | null;
  statuses: BookStatus[];
  nodes: BookNode[];
}
/** Ciphertext only; compareAndSwap is atomic across callers, not a renderer read+write. */
export interface BookBlockStorage {
  read(projectId: string, blockId: string): Promise<string | null>;
  writeNew(projectId: string, blockId: string, text: string): Promise<void>;
  compareAndSwap(
    projectId: string,
    text: string,
    expected: string | null,
    required?: string[],
  ): Promise<void>;
  collect?(
    projectId: string,
    expected: string,
    keep: string[],
    cutoff: number,
  ): Promise<number>;
  projects?(): Promise<{ id: string; modifiedAt: number }[]>;
  removeProject?(projectId: string): Promise<void>;
  list(projectId: string): Promise<{ id: string; modifiedAt: number }[]>;
  remove(projectId: string, blockId: string): Promise<void>;
}
export interface BookArchive {
  reference: BookReference;
  blocks: { id: string; text: string }[];
}
export interface BookDocument {
  node: BookNode;
  document: DocumentFile;
}

export type BookMetadata = Pick<
  BookProject,
  | "title"
  | "subtitle"
  | "author"
  | "pseudonym"
  | "genre"
  | "language"
  | "description"
  | "notes"
  | "series"
  | "goalWords"
  | "color"
>;
