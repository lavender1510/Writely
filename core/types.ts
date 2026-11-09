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

