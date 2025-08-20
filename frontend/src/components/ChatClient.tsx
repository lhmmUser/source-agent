'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Bot, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AssistantBubbleWithSources from './AssistantBubbleWithSources';
import MessageBubble from './MessageBubble';
import dynamic from 'next/dynamic';

type Citation = {
  title: string;
  pdf_url: string;
  page: number;
  snippet?: string;
};

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
};

const quickQuestions = [
   "more about the sun",
   'If you had a magic power to help the Earth, what would it be?',
   'Can you think of a way to reuse an old toy or a cardboard box?',
];

export default function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      content: 'Hello! How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function onAsk(optionalPreset?: string) {
    const q = (optionalPreset ?? input).trim();
    if (!q || loading) return;

    // 1) Optimistic UI updates
    setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    if (!optionalPreset) setInput('');
    setLoading(true);

    // 2) Post to FastAPI and stream tokens
    let assistantText = '';
    let buffer = '';
    let finished = false;

    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error('No stream');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines; keep trailing partial line
        let lineEnd: number;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const rawLine = buffer.slice(0, lineEnd);
          buffer = buffer.slice(lineEnd + 1);

          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;

          const payload = line.slice(5).trim(); // after "data:"

          // Stop on DONE
          if (payload === '[DONE]') {
            finished = true;
            break;
          }

          // Try parse final JSON frame
          let parsed: any = null;
          if (payload.startsWith('{') || payload.startsWith('[')) {
            try {
              parsed = JSON.parse(payload);
            } catch {
              // ignore parse errors, treat as plain token
            }
          }

          if (parsed && parsed.type === 'final') {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role: 'assistant',
                content: parsed.answer ?? '',
                citations: parsed.citations ?? [],
              };
              return copy;
            });
            continue; // do NOT also append as plain text
          }

          // Plain token (streaming text)
          assistantText += payload;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: 'assistant', content: assistantText };
            return copy;
          });
        }

        if (finished) break;
      }
    } catch (err) {
      console.error(err);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: 'Error: failed to stream.' };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* Background + overlay */}
      <div className="fixed inset-0 z-0">
        <Image src="/hills_.jpg" alt="Background" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-[#1a2b4b]/50 backdrop-blur-sm" />
      </div>

      {/* Main container */}
      <div className="w-full max-w-4xl mx-auto py-8 z-10">
        <Card className="flex flex-col h-[calc(100vh-4rem)] bg-gray-900/40 backdrop-blur-xl border-gray-700/30 rounded-2xl">

          {/* Messages */}
          <div
            className="flex-1 h-[calc(100%-180px)] overflow-y-auto p-4 space-y-4 pb-32"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`flex items-start gap-2.5 max-w-[80%]  min-w-0  ${
                      isUser ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-3 py-2 min-w-0 max-w-full break-words whitespace-pre-wrap  ${
                        isUser ? ' text-black' : 'bg-white/10 text-white'
                      }`}
                    >
                      {/* Keep your original bubbles: 
                          - user messages via MessageBubble (if it formats your user style)
                          - assistant via AssistantBubbleWithSources (keeps show/hide resources) */}
                      {isUser ? (
                        <MessageBubble role="user" content={msg.content} />
                      ) : (
                        
                          <AssistantBubbleWithSources
                            content={msg.content}
                            citations={msg.citations}
                          />
                        
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input + quick questions */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-4 bg-gray-900/40 backdrop-blur-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAsk();
              }}
              className="relative"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAsk();
                  }
                }}
                placeholder="Ask about your documents..."
                disabled={loading}
                className="w-full bg-white border-transparent pr-12 rounded-xl"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 bg-transparent hover:bg-transparent"
                aria-label="Send message"
              >
                <Send className="w-5 h-5 text-gray-500" />
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 justify-center ">
              {quickQuestions.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="secondary"
                  onClick={() => onAsk(q)}
                  disabled={loading}
                  className="bg-gray-700/50 hover:bg-gray-600/50 text-white border-0 rounded-full text-sm px-4 py-2"
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
