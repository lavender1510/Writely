/** The versioned, open document interchange contract used by the desktop bridge. */
export interface JSONContent {
  type?: string;
  attrs?: Record<string, any>;
  content?: JSONContent[];
  marks?: { type: string; attrs?: Record<string, any> }[];
  text?: string;
}

export interface StyleDefinition {
  name: string;
  basedOn?: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  [property: string]: unknown;
}

export interface FontReference {
  family: string;
  source?: 'system' | 'bundled' | 'imported';
  fallback?: string;
}

export interface DocumentFile {
  schemaVersion: 1;
  theme?: string;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  content: JSONContent;
  styles: Record<string, StyleDefinition>;
  page: { size: 'A4' | 'Letter'; marginMm: number };
  fonts: FontReference[];
  importWarnings?: string[];
}

export interface VersionInfo { id: string; title: string; updatedAt: string }
export type ExportFormat = 'docx' | 'pdf' | 'html' | 'txt' | 'md' | 'odt' | 'rtf' | 'epub';
export interface WindowPreferences { mode:'windowed'|'maximized'|'fullscreen';displayId:number;displays:{id:number;label:string}[]; }
export interface DesktopBridge {
  nativeWindow?:boolean;
  onWindowSettingsChanged?(callback:(settings:WindowPreferences)=>void):()=>void;
  getWindowSettings?():Promise<WindowPreferences>;
  setWindowMode?(mode:WindowPreferences['mode']):Promise<WindowPreferences>;
  moveWindowToDisplay?(id:number):Promise<WindowPreferences>;
  platform: string;
  launchOpen?():Promise<{document:DocumentFile;path?:string}|null>;
  libraryList?():Promise<any>;
  libraryGet?(id:string):Promise<{document:DocumentFile;path?:string}>;
  libraryPut?(doc:DocumentFile,path?:string):Promise<any>;
  libraryMutate?(action:string,data:any):Promise<any>;
  open(): Promise<{ path: string; document: DocumentFile } | null>;
  save(document: DocumentFile, path?: string): Promise<{ path: string } | null>;
  recover(): Promise<DocumentFile | null>;
  autosave(document: DocumentFile): Promise<void>;
  versions(): Promise<VersionInfo[]>;
  restoreVersion(id: string): Promise<DocumentFile>;
  exportFile(format: ExportFormat, document: DocumentFile, html: string): Promise<{ path: string } | null>;
  listFonts(): Promise<string[]>;
  minimize(): void;
  maximize(): void;
  close(): void;
  /** Save the supplied current editor snapshot before closing the desktop window. */
  requestClose?(document: DocumentFile): Promise<void>;
  /** Native close/Alt+F4 requests the freshest editor content through this hook. */
  onFlush?(callback: () => DocumentFile | Promise<DocumentFile>): () => void;
}

declare global { interface Window { writely?: DesktopBridge } }
