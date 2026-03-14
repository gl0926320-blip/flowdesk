"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Membership = {
  company_id: string;
  role: string;
  status?: string;
};

export default function FlowIAPage() {
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá. Eu sou a FlowIA. Posso explicar o FlowDesk, analisar leads, conversão, pipeline, receita e gerar relatórios com base no seu CRM.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    loadCompany();
  }, []);

  async function loadCompany() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: membership } = await supabase
      .from("company_users")
      .select("company_id, role, status, created_at")
      .eq("user_id", userData.user.id)
      .eq("status", "ativo")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membership?.company_id) {
      setCompanyId(membership.company_id);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!companyId) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Não consegui identificar a empresa atual para consultar o CRM.",
        },
      ]);
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    const assistantIndex = messages.length + 1;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: "",
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/flowia/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          companyId,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao iniciar streaming da FlowIA.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        setMessages((prev) =>
          prev.map((msg, index) =>
            index === assistantIndex
              ? { ...msg, content: fullText }
              : msg
          )
        );
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === assistantIndex
            ? {
                ...msg,
                content: error?.message || "Erro ao falar com a FlowIA.",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b0f1d] text-white">
      <div className="border-b border-white/10 p-5 flex items-center gap-3">
        <div className="bg-cyan-500/20 p-2 rounded-xl">
          <Bot size={22} />
        </div>

        <div>
          <h1 className="font-bold text-lg">FlowIA</h1>
          <p className="text-xs text-gray-400">
            Assistente inteligente do FlowDesk
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                msg.role === "assistant" ? "bg-[#1b2238]" : "bg-cyan-600"
              }`}
            >
              {msg.content || (loading && i === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="animate-spin" size={16} />
            FlowIA escrevendo...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Pergunte algo sobre seu CRM..."
            className="flex-1 min-h-[60px] bg-[#11162a] rounded-xl px-4 py-3 resize-none outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 px-4 rounded-xl flex items-center justify-center disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}