// src/app/viewer/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

// ⬇️ key change: client-only import to avoid DOM APIs on the server
const PDFViewerModal = dynamic(
  () => import("@/components/pdf/PDFViewerModal"),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-sm">Loading PDF viewer…</div>
    ),
  }
);

export default function ViewerPage() {
  const sp = useSearchParams();
  const pdf_url = sp.get("pdf_url")!;
  const page = Number(sp.get("page") || "1");
  const bbox = ((): [number, number, number, number] | undefined => {
    const x0 = sp.get("x0"), y0 = sp.get("y0"), x1 = sp.get("x1"), y1 = sp.get("y1");
    if ([x0,y0,x1,y1].every(Boolean)) return [Number(x0), Number(y0), Number(x1), Number(y1)];
    return undefined;
  })();

  const citation = useMemo(() => ({
    doc_id: "deeplink",
    doc_title: "Document",
    pdf_url,
    page,
    bbox,
    snippet: ""
  }), [pdf_url, page, bbox]);

  const [open, setOpen] = useState(true);
  if (!open) return <div className="p-6 text-sm">Closed</div>;
  return <PDFViewerModal citation={citation} onClose={() => setOpen(false)} />;
}
