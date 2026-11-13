import type {DocumentFile} from '../core/types';
export type {JSONContent,StyleDefinition,FontReference,PageLayout,DocumentFile} from '../core/types';
export interface VersionInfo { id: string; title: string; updatedAt: string;documentId?:string;capturedAt?:string;size?:number }
export interface HistorySettings {historyLimit:number;intervalMinutes:number;maxMegabytes:number}
export type ExportFormat = 'docx' | 'pdf' | 'html' | 'txt' | 'md' | 'odt' | 'rtf' | 'epub';
export interface WindowPreferences { mode:'windowed'|'maximized'|'fullscreen';displayId:number;displays:{id:number;label:string}[]; }
export interface DesktopBridge {
  bookProjects?():Promise<{id:string;modifiedAt:number}[]>;
  bookRemoveProject?(projectId:string):Promise<void>;
  bookRead?(projectId:string,id:string):Promise<string|null>;
  bookWriteNew?(projectId:string,id:string,text:string):Promise<void>;
  bookCommit?(projectId:string,text:string,expected:string|null,required?:string[]):Promise<void>;
  bookCollect?(projectId:string,expected:string,keep:string[],cutoff:number):Promise<number>;
  bookList?(projectId:string):Promise<{id:string;modifiedAt:number}[]>;
  bookRemove?(projectId:string,id:string):Promise<void>;
  onSecureFlush?(callback:()=>Promise<void>):()=>void;
  sealedCommit?(text:string,expected:string|null):Promise<void>;
  sealedRead?():Promise<string|null>;
  sealedWrite?(text:string):Promise<void>;
  secureOpen?():Promise<{name:string;text:string}|null>;
  secureSave?(name:string,text:string,mime:string):Promise<boolean>;
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
  libraryPut?(doc:DocumentFile,path?:string,folderId?:string|null):Promise<any>;
  libraryMutate?(action:string,data:any):Promise<any>;
  open(folderId?:string|null): Promise<{ path: string; document: DocumentFile } | null>;
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
