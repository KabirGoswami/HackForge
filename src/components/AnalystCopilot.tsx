import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "ai";
  content: string;
}

interface AnalystCopilotProps {
  suspectId?: string;
  onSuspectChange?: (id: string) => void;
}

export const AnalystCopilot: React.FC<AnalystCopilotProps> = ({ suspectId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      content: "Ready for forensic inquiry. I have access to the Bayesian posterior matrix and the OSINT evidence bridge. What would you like to investigate?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await fetch("/war-room/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg, suspect_id: suspectId }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "ai", content: data.response }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", content: "Error connecting to the Copilot engine. Please verify backend status." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel flex flex-col h-full bg-canvas overflow-hidden border-l border-outline">
      <div className="panel-heading flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-sky-400" />
          <h2 className="text-base font-semibold text-slate-100">Analyst Copilot</h2>
        </div>
        <Sparkles size={16} className="text-amber-400" />
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "ai" && (
              <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0 border border-sky-500/30">
                <Bot size={12} className="text-sky-400" />
              </div>
            )}
            <div className={`max-w-[80%] p-3 rounded-lg text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-sky-600 text-white rounded-tr-none"
                : "bg-slate-800 text-slate-300 border border-outline rounded-tl-none"
            }`}>
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0 border border-outline">
                <User size={12} className="text-slate-400" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-pulse">
            <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center shrink-0 border border-sky-500/30">
              <Bot size={12} className="text-sky-400" />
            </div>
            <div className="bg-slate-800 p-3 rounded-lg rounded-tl-none border border-outline">
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-outline bg-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Query evidence bridge..."
            className="flex-1 bg-canvas border border-outline rounded px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="p-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white rounded transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
