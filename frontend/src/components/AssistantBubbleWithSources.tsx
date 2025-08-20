'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

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
      {/* Force wrapping even for long unbroken tokens while streaming */}
      <div className="min-w-0 whitespace-pre-wrap break-all md:break-words">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[[rehypeSanitize, defaultSchema]]}
          components={{
            p: ({ children }) => (
              <p className="whitespace-pre-wrap break-all md:break-words">{children}</p>
            ),
            pre: ({ children }) => (
              <pre className="whitespace-pre-wrap break-all md:break-words overflow-x-auto">
                {children}
              </pre>
            ),
            code: ({ children }) => (
              <code className="whitespace-pre-wrap break-all md:break-words">{children}</code>
            ),
            a: ({ href, children, ...rest }) => (
              <a href={href} {...rest} className="break-all">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {citations && citations.length > 0 && (
        <>
          <button
            onClick={() => setShowSources(!showSources)}
            className="mt-2 text-blue-300 text-sm font-medium hover:underline"
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
                    className="text-blue-300 underline break-all"
                  >
                    {c.title} (Page {c.page})
                  </a>
                  {c.snippet && (
                    <div className="text-white-600 text-xs mt-1">{c.snippet}</div>
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
