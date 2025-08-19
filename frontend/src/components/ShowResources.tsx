// src/components/ShowResources.tsx
"use client";

import { useState } from "react";
import { Citation } from "@/types/citation";
import dynamic from "next/dynamic";

const PDFViewerModal = dynamic(() => import("./pdf/PDFViewerModal"), { ssr: false });

export default function ShowResources({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Citation | null>(null);

  return (
    <div className="mt-4 border rounded-xl">
      <button
        className="w-full text-left px-4 py-3 font-medium hover:bg-gray-50 rounded-xl"
        onClick={() => setOpen(v => !v)}
      >
        {open ? "Hide resources" : "Show resources"}
      </button>

      {open && (
        <ul className="divide-y">
          {citations.map((c, idx) => (
            <li key={c.doc_id + idx} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{c.doc_title}</div>
                <div className="text-xs text-gray-600">
                  Page {c.page}{c.score != null ? ` • score ${c.score.toFixed(2)}` : ""}
                </div>
                <div className="text-sm text-gray-800 line-clamp-2 mt-1">
                  {c.snippet}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  className="text-xs underline text-blue-700"
                  href={`/viewer?pdf_url=${encodeURIComponent(c.pdf_url)}&page=${c.page}${
                    c.bbox ? `&x0=${c.bbox[0]}&y0=${c.bbox[1]}&x1=${c.bbox[2]}&y1=${c.bbox[3]}` : ""
                  }`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in new tab
                </a>
                <button
                  className="text-xs bg-gray-900 text-white rounded px-2 py-1"
                  onClick={() => setActive(c)}
                >
                  Preview here
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <PDFViewerModal
          citation={active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
