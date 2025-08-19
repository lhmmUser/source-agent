'use client';
import { useState } from 'react';

type Citation = {
  title: string;
  pdf_url: string;
  page: number;
  snippet?: string;
};

export default function AssistantBubbleWithSources({
  content,
  citations
}: {
  content: string;
  citations?: Citation[];
}) {
  const [showSources, setShowSources] = useState(false);

  return (
    <div className="bg-gray-500 p-4 rounded-lg border max-w-xl">
      <p className="whitespace-pre-line">{content}</p>

      {citations && citations.length > 0 && (
        <>
          <button
            onClick={() => setShowSources(!showSources)}
            className="mt-2 text-blue-600 text-sm font-medium hover:underline"
          >
            {showSources ? 'Hide Sources ↑' : 'Show Sources ↓'}
          </button>

          {showSources && (
            <ul className="mt-2 space-y-2 text-sm">
              {citations.map((c, i) => (
                <li key={i} className="pl-2 border-l-2 border-gray-300">
                  <a
                    href={`http://127.0.0.1:8000${c.pdf_url}#page=${c.page}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {c.title} (Page {c.page})
                  </a>
                  {c.snippet && (
                    <div className="text-gray-600 text-xs mt-1">{c.snippet}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
