'use client'

import ChatClient from '@/components/ChatClient'

export default function HomePage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 24 }}>LLM Agent Chatbot</h1>
      <ChatClient />
    </main>
  )
}
