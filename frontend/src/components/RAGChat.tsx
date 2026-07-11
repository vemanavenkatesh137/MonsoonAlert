import React, { useState, useRef, useEffect } from 'react';
import { Send, ShieldCheck, MessageSquare } from 'lucide-react';

interface RAGChatProps {
  placeholder: string;
  lang: string;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  sources?: string[];
  isGuardrailHit?: boolean;
}

export const RAGChat: React.FC<RAGChatProps> = ({ placeholder, lang }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'assistant',
      text: 'Hello. I can provide official safety guidelines and pre-monsoon instructions sourced directly from NDRF disaster manuals. How can I help you prepare today?',
      sources: ['Offline Guidelines Cache'],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryText = inputValue.trim();
    if (!queryText || isLoading) return;

    // 1. Add User Message
    const newMsg: Message = { sender: 'user', text: queryText };
    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 2. Query Fastify Backend API
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3051';
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: queryText, lang }),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json() as {
        answer: string;
        sources: string[];
        phaseGuardrailTriggered?: boolean;
      };

      // 3. Add Assistant Message with sources & guardrail statuses
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer,
          sources: data.sources,
          isGuardrailHit: data.phaseGuardrailTriggered,
        },
      ]);
    } catch (err: any) {
      console.error('[RAG CHAT] Request failed:', err.message);
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: `Connection failed: ${err.message}. Please verify the backend is running on port 3051.`,
          sources: ['System Network Layer'],
          isGuardrailHit: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card chat-card" id="rag-chat-element">
      <h2>
        <ShieldCheck size={20} style={{ color: 'var(--color-success)' }} />
        Official safety guidelines (RAG Verification)
      </h2>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-bubble ${msg.sender} ${msg.isGuardrailHit ? 'guardrail-hit' : ''}`}
          >
            <div>{msg.text}</div>
            {msg.sources && msg.sources.length > 0 && (
              <div className="chat-sources">
                <MessageSquare size={10} />
                <span>Verified Source: {msg.sources.join(', ')}</span>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="chat-bubble assistant" style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            Retrieving safety documentation...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-area">
        <input
          type="text"
          className="text-input chat-input"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={placeholder || 'Ask official safety instructions...'}
          disabled={isLoading}
        />
        <button type="submit" className="chat-send-btn" disabled={isLoading || !inputValue.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
