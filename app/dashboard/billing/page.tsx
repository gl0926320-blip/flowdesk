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

  function getCycleProgress(date: string) {
    const now = new Date().getTime()
    const end = new Date(date).getTime()
    const total = 30 * 24 * 60 * 60 * 1000
    const used = total - (end - now)
    return Math.min(Math.max((used / total) * 100, 0), 100)
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
  const daysRemaining = hasPeriodEnd
    ? getDaysRemaining(subscription.current_period_end)
    : 0

  return (
    <div className="p-8 text-white max-w-6xl mx-auto">

      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold mb-2">Assinatura</h1>
        <p className="text-gray-400">
          Gerencie seu plano e acompanhe seu ciclo de cobrança.
        </p>
      </div>

      {/* ============================= */}
      {/* CARD DE GERENCIAMENTO PRO */}
      {/* ============================= */}

      {isPro && (
        <div className="mb-14 bg-gradient-to-br from-purple-900 via-purple-800 to-purple-700 p-10 rounded-3xl border border-purple-500 shadow-2xl">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Plano Pro 🚀
              </h2>

              <span
                className={`inline-block px-4 py-1 rounded-full text-xs font-semibold ${
                  isCanceling
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-green-500/20 text-green-300"
                }`}
              >
                {isCanceling ? "Cancelamento agendado" : "Assinatura ativa"}
              </span>
            </div>

            <div className="mt-6 md:mt-0">
              <button
                onClick={handlePortal}
                disabled={loadingPortal}
                className="bg-white text-purple-700 font-semibold px-6 py-3 rounded-xl hover:scale-105 transition disabled:opacity-40"
              >
                {loadingPortal
                  ? "Redirecionando..."
                  : "Gerenciar pagamento"}
              </button>
            </div>
          </div>

          {hasPeriodEnd && (
            <>
              {/* MÉTRICAS */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">

                <div className="bg-black/30 p-6 rounded-2xl">
                  <p className="text-gray-300 text-sm mb-1">Próxima cobrança</p>
                  <p className="text-xl font-bold">
                    {formatDate(subscription.current_period_end)}
                  </p>
                </div>

                <div className="bg-black/30 p-6 rounded-2xl">
                  <p className="text-gray-300 text-sm mb-1">Dias restantes</p>
                  <p className="text-xl font-bold">
                    {daysRemaining} dias
                  </p>
                </div>

                <div className="bg-black/30 p-6 rounded-2xl">
                  <p className="text-gray-300 text-sm mb-1">Status</p>
                  <p className="text-xl font-bold">
                    {isCanceling
                      ? "Encerrando ao final do ciclo"
                      : "Renovação automática"}
                  </p>
                </div>

              </div>

              {/* BARRA DE PROGRESSO */}
              <div>
                <div className="flex justify-between text-sm text-purple-200 mb-2">
                  <span>Ciclo atual</span>
                  <span>{daysRemaining} dias restantes</span>
                </div>

                <div className="w-full bg-purple-950/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 bg-white transition-all duration-700"
                    style={{
                      width: `${100 - getCycleProgress(subscription.current_period_end)}%`,
                    }}
                  />
                </div>
              </div>
            </>
          )}
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
              ? "Downgrade automático ao final do ciclo"
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