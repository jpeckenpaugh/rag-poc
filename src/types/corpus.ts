export interface CorpusDocument {
  id: string;
  title: string;
  filename: string;
  pages: number;
  extracted_characters: number;
  status: 'current' | 'scheduled' | 'superseded' | string;
  access_scope: 'all_staff' | 'site_operations' | 'operations_leads' | string;
  audience: string;
  description: string;
  sha256: string;
}

export interface ChunkRecord {
  id: string;
  source: string;
  docId: string;
  title: string;
  status: string;
  page: number;
  text: string;
  vector?: Float32Array;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  docId: string;
  title: string;
  filename: string;
  status: string;
  pages: ExtractedPage[];
  totalCharacters: number;
}
