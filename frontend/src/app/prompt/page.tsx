'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
// If you use shadcn/ui, keep these; otherwise swap for your own components
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// ----------------------
// Types
// ----------------------
type PromptDTO = { template: string }; // shape returned by /prompt
type DocRow = { id: number; source: string; created_at: string }; // shape from /ingest/documents
type CountsDTO = { documents: number; chunks: number }; // shape from /debug/counts

export default function PromptPage() {
  // --------------- ENV / API Roots ---------------
  const API_ROOT = process.env.NEXT_PUBLIC_BACKEND_URL; // e.g., http://localhost:8000
  const PROMPT_API = `${API_ROOT}/prompt`; // GET/PUT
  const DOCS_API = `${API_ROOT}/ingest/documents`; // GET
  const DELETE_DOC_API = (id: number) => `${API_ROOT}/ingest/document/${id}`; // DELETE
  const UPLOAD_API = `${API_ROOT}/ingest/pdf`; // POST multipart
  const COUNTS_API = `${API_ROOT}/debug/counts`; // GET

  // --------------- Prompt State ---------------
  const [template, setTemplate] = useState(''); // system prompt content
  const [loadingPrompt, setLoadingPrompt] = useState(true); // loading spinner for prompt
  const [savingPrompt, setSavingPrompt] = useState(false); // saving spinner for prompt
  const [promptMsg, setPromptMsg] = useState<string | null>(null); // save status message

  // --------------- Docs State ---------------
  const [docs, setDocs] = useState<DocRow[]>([]); // existing docs from DB
  const [counts, setCounts] = useState<CountsDTO | null>(null); // row counts
  const [loadingDocs, setLoadingDocs] = useState(true); // loading spinner for docs section
  const [workingDocs, setWorkingDocs] = useState(false); // upload/delete in progress

  // Files selected on the client but not yet uploaded
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --------------- Init: load prompt + docs ---------------
  useEffect(() => {
    // fetch prompt
    (async () => {
      try {
        const res = await fetch(PROMPT_API, { cache: 'no-store' });
        const data: PromptDTO = await res.json();
        setTemplate(data?.template ?? '');
      } catch {
        setPromptMsg('Failed to load prompt');
      } finally {
        setLoadingPrompt(false);
      }
    })();
  }, [PROMPT_API]);

  useEffect(() => {
    // fetch documents + counts
    (async () => {
      try {
        const [docRes, countRes] = await Promise.all([
          fetch(`${DOCS_API}?limit=1000`, { cache: 'no-store' }),
          fetch(COUNTS_API, { cache: 'no-store' }),
        ]);
        const docList: DocRow[] = await docRes.json();
        const cnt: CountsDTO = await countRes.json();
        setDocs(docList);
        setCounts(cnt);
      } catch {
        // ignore; keep minimal UI
      } finally {
        setLoadingDocs(false);
      }
    })();
  }, [DOCS_API, COUNTS_API]);

  // --------------- Actions: Prompt Save ---------------
  async function savePrompt() {
    setSavingPrompt(true);
    setPromptMsg(null);
    try {
      const res = await fetch(PROMPT_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || 'Save failed');
      }
      setPromptMsg('Saved!');
    } catch (e: any) {
      setPromptMsg(e?.message || 'Save failed');
    } finally {
      setSavingPrompt(false);
    }
  }

  // --------------- Actions: File staging ---------------
  function onAttachClick() {
    // programmatically click the hidden input
    fileInputRef.current?.click();
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // de-dup by name (simple guard)
    const existing = new Set(stagedFiles.map(f => f.name));
    const next = [
      ...stagedFiles,
      ...files.filter(f => f.type === 'application/pdf' && !existing.has(f.name)),
    ];
    setStagedFiles(next);
    // reset input so picking the same file again re-triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeStaged(name: string) {
    setStagedFiles(prev => prev.filter(f => f.name !== name));
  }

  // --------------- Actions: Upload staged files ---------------
  async function uploadStaged() {
    if (!stagedFiles.length) return;
    setWorkingDocs(true);
    try {
      // upload all PDFs sequentially (safer for big files; change to Promise.all if you prefer)
      for (const file of stagedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(UPLOAD_API, { method: 'POST', body: fd });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e?.detail || `Failed to ingest ${file.name}`);
        }
      }
      setStagedFiles([]); // clear after success
      await refreshDocs(); // reload lists/counts
    } catch (e) {
      console.error(e);
      // keep staged files so user can retry
    } finally {
      setWorkingDocs(false);
    }
  }

  // --------------- Actions: Delete a stored document ---------------
  async function deleteDoc(id: number) {
    if (!confirm('Delete this document and all its chunks?')) return;
    setWorkingDocs(true);
    try {
      const r = await fetch(DELETE_DOC_API(id), { method: 'DELETE' });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.detail || 'Delete failed');
      }
      await refreshDocs();
    } catch (e) {
      console.error(e);
    } finally {
      setWorkingDocs(false);
    }
  }

  // --------------- Helpers ---------------
  async function refreshDocs() {
    const [docRes, countRes] = await Promise.all([
      fetch(`${DOCS_API}?limit=1000`, { cache: 'no-store' }),
      fetch(COUNTS_API, { cache: 'no-store' }),
    ]);
    const docList: DocRow[] = await docRes.json();
    const cnt: CountsDTO = await countRes.json();
    setDocs(docList);
    setCounts(cnt);
  }

  const docCount = counts?.documents ?? docs.length;

  // --------------- Render ---------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">System Prompts and Document Management</h1>
              <p className="text-gray-600 text-sm mt-1">Change the system prompts and manage documents</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="bg-gray-100 rounded px-3 py-1 border">
                <span className="text-gray-600">Documents:</span>
                <span className="ml-2 font-medium text-gray-900">{docCount}</span>
              </div>
              {counts && (
                <div className="bg-gray-100 rounded px-3 py-1 border">
                  <span className="text-gray-600">Chunks:</span>
                  <span className="ml-2 font-medium text-gray-900">{counts.chunks}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="p-4 h-[calc(100vh-120px)]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
          {/* ---------- System Prompt ---------- */}
          <Card className="bg-white border-gray-200 shadow-sm flex flex-col">
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">System Prompt</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Use{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono text-xs">
                    {'{context}'}
                  </code>{' '}
                  and{' '}
                  <code className="bg-gray-100 px-2 py-1 rounded text-gray-800 font-mono text-xs">
                    {'{question}'}
                  </code>{' '}
                  placeholders
                </p>
              </div>

              <div className="flex-1 flex flex-col space-y-4">
                <div className="relative flex-1">
                  <textarea
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="w-full h-full bg-white text-gray-900 rounded border border-gray-300 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none"
                    placeholder="Enter your system prompt template..."
                    spellCheck={false}
                  />
                  <div className="absolute top-3 right-3">
                    <div className="bg-gray-100 rounded px-2 py-1 text-xs text-gray-500">
                      {template.length} chars
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 flex-shrink-0">
                  <Button 
                    onClick={savePrompt} 
                    disabled={savingPrompt || loadingPrompt}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded"
                  >
                    {savingPrompt ? 'Saving...' : 'Save Prompt'}
                  </Button>
                  
                  {promptMsg && (
                    <span className={`text-sm px-3 py-1 rounded ${
                      promptMsg === 'Saved!' 
                        ? 'text-green-700 bg-green-100' 
                        : 'text-red-700 bg-red-100'
                    }`}>
                      {promptMsg}
                    </span>
                  )}

                  {loadingPrompt && (
                    <span className="text-sm text-gray-500">Loading...</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* ---------- Document Manager ---------- */}
          <Card className="bg-white border-gray-200 shadow-sm flex flex-col">
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
              </div>

              {/* Upload Section */}
              <div className="mb-4 flex-shrink-0">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <Button 
                    onClick={onAttachClick} 
                    variant="secondary" 
                    disabled={workingDocs}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
                  >
                    Attach documents
                  </Button>
                  
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="hidden"
                    onChange={onFilePicked}
                  />
                  
                  {stagedFiles.length > 0 && (
                    <Button
                      onClick={uploadStaged}
                      disabled={workingDocs}
                      className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      {workingDocs ? 'Updating...' : 'Update changes'}
                    </Button>
                  )}
                </div>

                {/* Staged files */}
                {stagedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {stagedFiles.map((f) => (
                      <span
                        key={f.name}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border text-sm text-gray-700"
                      >
                        <span className="truncate max-w-32">{f.name}</span>
                        <button
                          className="hover:bg-gray-200 rounded-full px-1 flex-shrink-0"
                          onClick={() => removeStaged(f.name)}
                          aria-label={`Remove ${f.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents List */}
              <div className="border border-gray-200 rounded flex-1 flex flex-col overflow-hidden">
                {loadingDocs ? (
                  <div className="p-4 text-sm text-gray-500">Loading...</div>
                ) : docs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 flex-1 flex items-center justify-center">
                    <p>No documents yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 overflow-y-auto flex-1">
                    {docs.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 hover:bg-gray-50 flex items-center justify-between min-h-[60px]"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="text-sm font-medium text-gray-900 truncate">{d.source}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            ID {d.id} • {new Date(d.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <a
                            className="text-sm text-gray-600 hover:text-gray-900 underline"
                            href={`${API_ROOT}/uploads/${encodeURIComponent(d.source)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteDoc(d.id)}
                            disabled={workingDocs}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}