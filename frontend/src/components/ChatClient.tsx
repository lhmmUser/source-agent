'use client'
import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'

type Msg = { role: 'user' | 'assistant', content: string }

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

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let assistantText = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      // SSE frames: lines like "data: token"
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const token = line.slice(6)
        assistantText += token
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { role: 'assistant', content: assistantText }
          return copy
        })
      }
    }

    setLoading(false)
  }

  return (
    <div>
      <h1>Knowledge Chatbot</h1>
      {messages.map((msg, i) => <MessageBubble key={i} role={msg.role} content={msg.content} />)}
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