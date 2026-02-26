"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"

export default function BillingPage() {
  const supabase = createClient()

  const [plan, setPlan] = useState("free")
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(true)

  useEffect(() => {
    async function carregarPlano() {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user
      if (!user) {
        setLoadingPlan(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single()

      if (profile?.plan) {
        setPlan(profile.plan)
      }

      setLoadingPlan(false)
    }

    carregarPlano()

    // 🔁 Atualiza quando volta do Stripe
    const onFocus = () => carregarPlano()
    window.addEventListener("focus", onFocus)

    // 🔥 Se voltou com success=true força reload uma vez
    if (window.location.search.includes("success=true")) {
      window.history.replaceState({}, document.title, window.location.pathname)
      carregarPlano()
    }

    return () => window.removeEventListener("focus", onFocus)
  }, [])

  async function handleUpgrade() {
    try {
      setLoadingCheckout(true)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (!user) {
        alert("Usuário não autenticado")
        setLoadingCheckout(false)
        return
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
        }),
      })

      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        console.error("Erro ao criar sessão:", data)
        setLoadingCheckout(false)
      }
    } catch (error) {
      console.error("Erro upgrade:", error)
      setLoadingCheckout(false)
    }
  }

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-white">
        Carregando plano...
      </div>
    )
  }

  return (
    <div className="p-8 text-white max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Assinatura</h1>
        <p className="text-gray-400">
          Gerencie seu plano e desbloqueie recursos avançados.
        </p>
      </div>

      {/* Plano Atual */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-2xl mb-12 border border-gray-700 shadow-lg">
        <h2 className="text-lg mb-2 text-gray-300">Plano Atual</h2>
        <p className="text-2xl font-semibold">
          {plan === "pro" ? "Plano Pro 🚀" : "Plano Free"}
        </p>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 gap-8">

        {/* FREE */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl border border-gray-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-4">Plano Free</h2>

          <p className="text-4xl font-bold mb-6">
            R$0 <span className="text-sm text-gray-400">/mês</span>
          </p>

          <ul className="space-y-3 text-gray-400 mb-8">
            <li>✔ Até 5 serviços</li>
            <li>✔ Dashboard básico</li>
          </ul>

          <button
            disabled
            className="w-full bg-gray-700 py-3 rounded-xl opacity-40 cursor-not-allowed"
          >
            {plan === "free" ? "Plano Atual" : "Downgrade via suporte"}
          </button>
        </div>

        {/* PRO */}
        <div className="relative bg-gradient-to-br from-purple-800 to-purple-600 p-8 rounded-3xl border border-purple-400 shadow-2xl scale-105">
          
          <div className="absolute top-4 right-4 bg-white text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
            MAIS POPULAR
          </div>

          <h2 className="text-xl font-semibold mb-4">Plano Pro 🚀</h2>

          <p className="text-4xl font-bold mb-6">
            R$29 <span className="text-sm text-purple-200">/mês</span>
          </p>

          <ul className="space-y-3 text-purple-100 mb-8">
            <li>✔ Serviços ilimitados</li>
            <li>✔ Métricas avançadas</li>
            <li>✔ Exportação PDF</li>
          </ul>

          <button
            onClick={handleUpgrade}
            disabled={plan === "pro" || loadingCheckout}
            className="w-full bg-white text-purple-700 font-semibold py-3 rounded-xl hover:scale-105 transition disabled:opacity-40"
          >
            {plan === "pro"
              ? "Plano Atual 🚀"
              : loadingCheckout
              ? "Redirecionando..."
              : "Assinar Plano Pro"}
          </button>
        </div>
      </div>
    </div>
  )
}