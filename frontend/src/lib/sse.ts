export function streamSSE(url: string, body: any, onToken: (t: string) => void): () => void {
  const es = new EventSource(url, { withCredentials: false })
  // Note: For POST streams, we proxy through a Next API route or call FastAPI directly with fetch + ReadableStream.
  // Here we keep it simple by using fetch with ReadableStream instead.
  return () => es.close()
}