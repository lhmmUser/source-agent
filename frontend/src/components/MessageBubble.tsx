import React from 'react'

type Props = { role: 'user' | 'assistant', content: string }

export default function MessageBubble({ role, content }: Props) {
  const bg = role === 'user' ? '#e8f0fe' : '#f3f4f6'
  return (
    <div style={{ background: bg, padding: 12, borderRadius: 12, margin: '8px 0', whiteSpace: 'pre-wrap' }}>
      <strong style={{ opacity: 0.7 }}>{role === 'user' ? 'You' : 'Assistant'}</strong>
      <div>{content}</div>
    </div>
  )
}