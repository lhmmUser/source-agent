"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument, PDFDocumentProxy } from "@/lib/pdf";
import { Citation } from "@/types/citation";

type Props = { citation: Citation; onClose: () => void };

export default function PDFViewerModal({ citation, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let pdfDoc: PDFDocumentProxy | null = null;

    (async () => {
      try {
        const loadingTask = getDocument(citation.pdf_url);
        pdfDoc = await loadingTask.promise;
        if (!mounted) return;

        const page = await pdfDoc.getPage(citation.page);
        const viewport = page.getViewport({ scale: 1.5 }); // adjust scale as needed

        // Render PDF page to canvas
        const canvas = canvasRef.current!;
const ctx = canvas.getContext("2d")!;
canvas.width = viewport.width;
canvas.height = viewport.height;

await page.render({
  canvasContext: ctx,
  viewport,
  canvas, // ✅ required by newer pdf.js type defs
}).promise;
        // Draw highlight overlay if bbox is present
        if (citation.bbox && overlayRef.current) {
          const [x0, y0, x1, y1] = citation.bbox;
          const pdfHeight = page.view[3]; // page height in points
          const toTopLeftY = (y: number) => pdfHeight - y;

          const rect = {
            left: x0 * viewport.transform[0] + viewport.transform[4],
            top: toTopLeftY(y1) * viewport.transform[3] + viewport.transform[5],
            width: (x1 - x0) * viewport.transform[0],
            height: (y1 - y0) * viewport.transform[3],
          };

          const overlay = overlayRef.current;
          overlay.style.left = `${rect.left}px`;
          overlay.style.top = `${rect.top}px`;
          overlay.style.width = `${rect.width}px`;
          overlay.style.height = `${rect.height}px`;
          overlay.style.display = "block";
        }

        setLoading(false);
      } catch (e) {
        console.error("Error loading PDF page:", e);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [citation]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl relative">
        <button
          className="absolute right-3 top-3 text-sm px-3 py-1 rounded bg-gray-900 text-white"
          onClick={onClose}
        >
          Close
        </button>

        <div className="p-4 border-b">
          <div className="font-semibold text-sm">{citation.doc_title}</div>
          <div className="text-xs text-gray-600">Page {citation.page}</div>
        </div>

        <div className="relative p-4 overflow-auto">
          {loading && <div className="p-8 text-center text-sm">Loading page…</div>}
          <div className="relative inline-block">
            <canvas ref={canvasRef} className="block" />
            <div
              ref={overlayRef}
              style={{ display: "none" }}
              className="absolute border-2 border-yellow-500/90 bg-yellow-300/30 rounded"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
