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

export interface PageLayout { size:'A4'|'A5'|'A3'|'Letter'|'Legal'|'Tabloid'|'Executive'|'Custom';marginMm:number;widthMm?:number;heightMm?:number;orientation?:'portrait'|'landscape';unit?:'mm'|'cm'|'in'|'pt';margins?:{top:number;right:number;bottom:number;left:number};gutterMm?:number;mirrored?:boolean;columns?:number;columnGapMm?:number;columnRule?:boolean;background?:string;backgroundRaster?:string;border?:boolean;watermark?:string;watermarkRaster?:string;header?:string;footer?:string;numbering?:{enabled:boolean;start:number;restart?:boolean;position:'header'|'footer';format:'arabic'|'roman'|'letters';total:boolean;firstDifferent:boolean}; }

export interface DocumentFile {
  schemaVersion: 1|2;
  theme?: string;
  proofing?:{language:'de-DE'|'en-US';enabled:boolean};
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  content: JSONContent;
  styles: Record<string, StyleDefinition>;
  page: PageLayout;
  fonts: FontReference[];
  importWarnings?: string[];
}

export interface VersionInfo { id: string; title: string; updatedAt: string;documentId?:string;capturedAt?:string;size?:number }
export interface HistorySettings {historyLimit:number;intervalMinutes:number;maxMegabytes:number}
export type ExportFormat = 'docx' | 'pdf' | 'html' | 'txt' | 'md' | 'odt' | 'rtf' | 'epub';
export interface WindowPreferences { mode:'windowed'|'maximized'|'fullscreen';displayId:number;displays:{id:number;label:string}[]; }
export interface DesktopBridge {
  nativeWindow?:boolean;
  onWindowSettingsChanged?(callback:(settings:WindowPreferences)=>void):()=>void;
  getWindowSettings?():Promise<WindowPreferences>;
  setWindowMode?(mode:WindowPreferences['mode']):Promise<WindowPreferences>;
  moveWindowToDisplay?(id:number):Promise<WindowPreferences>;
  spellCheck?(language:string,words:string[]):Promise<string[]>;
  spellSuggest?(language:string,word:string):Promise<string[]>;
  dictionaryWords?(language:string):Promise<string[]>;
  dictionaryChange?(language:string,word:string,remove:boolean):Promise<string[]>;
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
  versions(documentId?:string): Promise<VersionInfo[]>;
  restoreVersion(id: string,documentId?:string): Promise<DocumentFile>;
  previewVersion?(id:string,documentId:string):Promise<DocumentFile>;
  librarySearch?(query:string):Promise<{id:string;title:string;snippet:string;folderId:string|null}[]>;
  exportBackup?():Promise<{path:string}|null>;
  importBackup?():Promise<{documents:number;folders:number}|null>;
  historySettings?():Promise<HistorySettings>;
  configureHistory?(value:HistorySettings):Promise<HistorySettings>;
  clipboardImage?():Promise<string>;
  captureScreenshot?():Promise<string|null>;
  previewDocument?(document:DocumentFile):Promise<void>;
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
