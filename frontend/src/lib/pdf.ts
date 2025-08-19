import * as pdfjsLib from "pdfjs-dist";

// Use the official PDF.js CDN worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const getDocument = pdfjsLib.getDocument;
export type PDFDocumentProxy = pdfjsLib.PDFDocumentProxy;
