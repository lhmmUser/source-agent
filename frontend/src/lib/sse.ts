// lib/sse.ts

export function streamSSE(
  url: string,
  body: any,
  onMessage: (msg: { role: string; content: string; citations?: any[] }) => void
): () => void {
  // We can’t send POST directly with EventSource, so normally we proxy via Next API route
  // or use fetch + ReadableStream. For simplicity, assume backend accepts GET + querystring here.
  // If your backend expects POST, we’ll need a small proxy in /api/chat.

  const es = new EventSource(url, { withCredentials: false });

  es.onmessage = (event) => {
    if (event.data === "[DONE]") {
      es.close();
      return;
    }

    try {
      const parsed = JSON.parse(event.data);

      if (parsed.type === "final") {
        // final structured message with citations
        onMessage({
          role: "assistant",
          content: parsed.answer,
          citations: parsed.citations,
        });
      } else {
        // fallback in case other JSON comes
        onMessage({
          role: "assistant",
          content: parsed.answer ?? "",
        });
      }
    } catch {
      // Not JSON → it’s just a token being streamed
      onMessage({
        role: "assistant",
        content: event.data,
      });
    }
  };

  es.onerror = (err) => {
    console.error("[SSE] error", err);
    es.close();
  };

  // return a cleanup function
  return () => es.close();
}
