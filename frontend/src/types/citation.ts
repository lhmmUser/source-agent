// src/types/citation.ts
export type Citation = {
  doc_id: string;
  doc_title: string;
  pdf_url: string;
  page: number;               // 1-based
  bbox?: [number, number, number, number]; // [x0,y0,x1,y1] in PDF points
  snippet: string;
  score?: number;
};
