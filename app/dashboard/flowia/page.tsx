"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, Loader2 } from "lucide-react"

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function FlowIAPage() {

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá! Eu sou a FlowIA. Posso analisar seus leads, vendas, pipeline e responder dúvidas sobre o FlowDesk."
    }
  ])

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {

    if (!input.trim() || loading) return

    const userMessage = {
      role: "user" as const,
      content: input
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {

      const res = await fetch("/api/flowia/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage.content
        })
      })

      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: data.reply
        }
      ])

    } catch {

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Erro ao falar com a FlowIA."
        }
      ])

    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#0b0f1d] text-white">

      {/* HEADER */}

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


      {/* CHAT */}

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {messages.map((msg, i) => (

          <div
            key={i}
            className={`flex ${msg.role === "user"
              ? "justify-end"
              : "justify-start"
              }`}
          >

            <div
              className={`max-w-xl rounded-2xl px-4 py-3 text-sm ${
                msg.role === "assistant"
                  ? "bg-[#1b2238]"
                  : "bg-cyan-600"
              }`}
            >
              {msg.content}
            </div>

          </div>

        ))}

        {loading && (

          <div className="flex items-center gap-2 text-gray-400">

            <Loader2 className="animate-spin" size={16} />

            FlowIA pensando...

          </div>

        )}

        <div ref={bottomRef} />

      </div>


      {/* INPUT */}

      <div className="border-t border-white/10 p-4">

        <div className="flex gap-3">

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Pergunte algo sobre seu CRM..."
            className="flex-1 bg-[#11162a] rounded-xl px-4 py-3 resize-none outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-cyan-600 hover:bg-cyan-700 px-4 rounded-xl flex items-center justify-center"
          >
            <Send size={18} />
          </button>

        </div>

      </div>

    </div>
  )
}