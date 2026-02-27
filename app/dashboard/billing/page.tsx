"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"

export default function BillingPage() {
  const supabase = createClient()

  const [subscription, setSubscription] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [loadingCheckout, setLoadingCheckout] = useState(false)

  useEffect(() => {
    async function carregarPlano() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user
      if (!user) {
        setLoadingPlan(false)
        return
      }

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          plan,
          current_period_end,
          cancel_at_period_end,
          subscription_status
        `)
        .eq("id", user.id)
        .single()

      if (!error) {
        setSubscription(data)
      }

      setLoadingPlan(false)
    }

    carregarPlano()

    const onFocus = () => carregarPlano()
    window.addEventListener("focus", onFocus)

    return () => window.removeEventListener("focus", onFocus)
  }, [])

  async function handleUpgrade() {
    setLoadingCheckout(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user) return

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
      }),
    })

    const data = await res.json()

    if (data.url) {
      window.location.href = data.url
    }

    setLoadingCheckout(false)
  }

  async function handlePortal() {
    setLoadingPortal(true)

    const res = await fetch("/api/portal", {
      method: "POST",
    })

    const data = await res.json()

    if (data.url) {
      window.location.href = data.url
    }

    setLoadingPortal(false)
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("pt-BR")
  }

  function getDaysRemaining(date: string) {
    const now = new Date()
    const end = new Date(date)
    const diff = end.getTime() - now.getTime()
    return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0)
  }

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-white">
        Carregando assinatura...
      </div>
    )
  }

  const isPro = subscription?.plan === "pro"
  const isCanceling = subscription?.cancel_at_period_end
  const hasPeriodEnd = subscription?.current_period_end

  return (
    <div className="p-8 text-white max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Assinatura</h1>
        <p className="text-gray-400">
          Gerencie seu plano e acompanhe seu ciclo de cobrança.
        </p>
      </div>

      {/* ============================= */}
      {/* GERENCIAMENTO DA ASSINATURA */}
      {/* ============================= */}

      {isPro && (
        <div className="bg-gradient-to-r from-purple-900 to-purple-800 p-8 rounded-3xl border border-purple-500 shadow-2xl mb-12">

          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Sua Assinatura 🚀</h2>

            <span
              className={`px-4 py-1 rounded-full text-xs font-semibold ${
                isCanceling
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-green-500/20 text-green-400"
              }`}
            >
              {isCanceling ? "Cancelamento agendado" : "Ativo"}
            </span>
          </div>

          {hasPeriodEnd && (
            <div className="grid md:grid-cols-3 gap-6 mb-6">

              <div className="bg-black/30 p-5 rounded-2xl">
                <p className="text-gray-400 text-sm">Próxima fatura</p>
                <p className="text-lg font-semibold">
                  {formatDate(subscription.current_period_end)}
                </p>
              </div>

              <div className="bg-black/30 p-5 rounded-2xl">
                <p className="text-gray-400 text-sm">Dias restantes</p>
                <p className="text-lg font-semibold">
                  {getDaysRemaining(subscription.current_period_end)} dias
                </p>
              </div>

              <div className="bg-black/30 p-5 rounded-2xl">
                <p className="text-gray-400 text-sm">Plano</p>
                <p className="text-lg font-semibold">
                  {isCanceling ? "Pro (encerrando)" : "Pro ativo"}
                </p>
              </div>

            </div>
          )}

          <button
            onClick={handlePortal}
            disabled={loadingPortal}
            className="bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl hover:scale-105 transition disabled:opacity-40"
          >
            {loadingPortal
              ? "Redirecionando..."
              : "Gerenciar pagamento / Cancelar assinatura"}
          </button>
        </div>
      )}

      {/* ============================= */}
      {/* PLANOS */}
      {/* ============================= */}

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
            {isPro
              ? "Downgrade automático após vencimento"
              : "Plano Atual"}
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
            disabled={isPro || loadingCheckout}
            className="w-full bg-white text-purple-700 font-semibold py-3 rounded-xl hover:scale-105 transition disabled:opacity-40"
          >
            {isPro
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