'use client'
import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import AssistantBubbleWithSources from './AssistantBubbleWithSources';


type Citation = {
  title: string
  pdf_url: string
  page: number
  snippet?: string
}

type Msg = {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[] // ✅ optional
}


export default function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function onAsk() {
    const q = input.trim()
    if (!q) return
    setMessages(m => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    // POST to FastAPI and stream tokens
    const resp = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })

    if (!resp.ok || !resp.body) {
      setLoading(false)
      setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: 'Error: failed to stream.' }])
      return
    }

    const reader = resp.body.getReader();
const decoder = new TextDecoder();
let assistantText = '';
let buffer = ''; // accumulate partial lines across chunks
let finished = false;

try {
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines; keep any trailing partial line in buffer
    let lineEnd;
    while ((lineEnd = buffer.indexOf('\n')) >= 0) {
      const rawLine = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 1);

      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;

      const payload = line.slice(5).trim(); // after "data:"

      // 1) Stop on DONE (don't append it to chat)
      if (payload === '[DONE]') {
        finished = true;
        break;
      }

      // 2) Try parse final JSON frame
      let parsed: any = null;
      if (payload.startsWith('{') || payload.startsWith('[')) {
        try {
          parsed = JSON.parse(payload);
        } catch {
          // not JSON; fall through
        }
      }

      if (parsed && parsed.type === 'final') {
        setMessages(m => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: parsed.answer ?? '',
            citations: parsed.citations ?? [],
          };
          return copy;
        });
        // do NOT also append as plain text
        continue;
      }

      // 3) Plain token (streaming text)
      assistantText += payload;
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: assistantText };
        return copy;
      });
    }

    if (finished) break;
  }
} finally {
  setLoading(false);
}

  }
  return (
    <div>
      <h1>Knowledge Chatbot</h1>
      {messages.map((msg, i) => {
  if (msg.role === 'assistant') {
    return (
      <AssistantBubbleWithSources
        key={i}
        content={msg.content}
        citations={msg.citations}
      />
    );
  }
  return <MessageBubble key={i} role={msg.role} content={msg.content} />;
})}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
          onKeyDown={e => { if (e.key === 'Enter') onAsk() }}
        />
        <button disabled={loading} onClick={onAsk} style={{ padding: '10px 16px', borderRadius: 8 }}>
          {loading ? 'Thinking…' : 'Ask'}
        </button>
      </div>
    </div>
  )
}