import React, { useState, useEffect, useRef } from 'react';
import { Send, Copy, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ChatWindow({ sessionId, initialAnalysis }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: initialAnalysis,
      type: 'analysis'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/api/chat/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      const data = await response.json();

      if (data.status === 'success') {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message 
        }]);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <h2 className="text-white font-semibold">Log Analysis Chat</h2>
        <p className="text-slate-400 text-sm">Session ID: {sessionId.slice(0, 12)}...</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-2xl rounded-lg p-4 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              <ReactMarkdown className="prose prose-invert max-w-none">
                {msg.content}
              </ReactMarkdown>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="mt-2 text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-slate-800 border-t border-slate-700 p-6">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask for help or next steps..."
            className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}