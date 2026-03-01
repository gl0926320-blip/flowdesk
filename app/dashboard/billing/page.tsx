"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { Crown, Rocket, Shield, BarChart3, Users, FileText } from "lucide-react"

export default function BillingPage() {
  const supabase = createClient()

  const [subscription, setSubscription] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)

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

      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single()

      setSubscription(data)
      setLoadingPlan(false)
    }

    carregarPlano()
  }, [])

  if (loadingPlan) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-white">
        Carregando plano...
      </div>
    )
  }

  const isPro = subscription?.plan === "pro"

  const whatsappLink =
    "https://wa.me/5562994693465?text=Olá!%20👋%20Tudo%20bem?%20Estou%20conhecendo%20o%20FlowDesk%20e%20gostaria%20de%20receber%20mais%20informações%20sobre%20como%20funciona,%20valores%20e%20como%20pode%20ajudar%20minha%20empresa.%20Poderia%20me%20orientar?%20😊"

  return (
    <div className="p-10 text-white max-w-7xl mx-auto space-y-16">

      {/* HEADER PREMIUM */}
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Crown className="text-yellow-400" />
          Upgrade para o FlowDesk Pro
        </h1>
        <p className="text-gray-400 mt-3 max-w-2xl">
          Desbloqueie todo o potencial do seu CRM, aumente suas vendas
          e tenha controle total da sua operação comercial.
        </p>
      </div>

      {/* BLOCO DE VALOR */}
      <div className="grid md:grid-cols-3 gap-6">

        <FeatureCard
          icon={<BarChart3 />}
          title="Métricas Avançadas"
          desc="Dashboard completo com faturamento, comissão, ranking de vendedores e conversão."
        />

        <FeatureCard
          icon={<Users />}
          title="Gestão de Equipe"
          desc="Controle total da performance individual de cada vendedor."
        />

        <FeatureCard
          icon={<FileText />}
          title="Orçamentos Ilimitados"
          desc="No Free você pode criar apenas 5 serviços. No Pro é ilimitado."
        />

        <FeatureCard
          icon={<Rocket />}
          title="Crescimento Escalável"
          desc="Organize leads, pipeline, vendas e comissões em um único sistema."
        />

        <FeatureCard
          icon={<Shield />}
          title="Suporte Prioritário"
          desc="Atendimento direto via WhatsApp e suporte estratégico."
        />

        <FeatureCard
          icon={<Crown />}
          title="Exportação PDF"
          desc="Gere relatórios profissionais para seus clientes."
        />

      </div>

      {/* PLANOS */}
      <div className="grid md:grid-cols-2 gap-10">

        {/* FREE */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-10 rounded-3xl border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-bold mb-6">Plano Free</h2>

          <p className="text-4xl font-bold mb-8">
            R$0 <span className="text-sm text-gray-400">/mês</span>
          </p>

          <ul className="space-y-4 text-gray-400 mb-10">
            <li>✔ Até 5 serviços</li>
            <li>✔ Dashboard básico</li>
            <li>✔ Pipeline simples</li>
            <li>✖ Bloqueia após 5 serviços</li>
            <li>✖ Sem métricas avançadas</li>
          </ul>

          <button
            disabled
            className="w-full bg-gray-700 py-4 rounded-xl opacity-50"
          >
            Plano Atual
          </button>
        </div>

        {/* PRO */}
        <div className="relative bg-gradient-to-br from-purple-700 to-purple-500 p-10 rounded-3xl border border-purple-400 shadow-2xl scale-105">

          <div className="absolute top-5 right-5 bg-white text-purple-700 text-xs font-bold px-4 py-1 rounded-full">
            RECOMENDADO
          </div>

          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Crown />
            Plano Pro
          </h2>

          <p className="text-4xl font-bold mb-8">
            Sob consulta
          </p>

          <ul className="space-y-4 text-purple-100 mb-10">
            <li>✔ Serviços ilimitados</li>
            <li>✔ Métricas avançadas</li>
            <li>✔ Gestão completa de equipe</li>
            <li>✔ Controle de comissões</li>
            <li>✔ Exportação PDF</li>
            <li>✔ Suporte prioritário</li>
          </ul>

          <a
            href={whatsappLink}
            target="_blank"
            className="block text-center w-full bg-white text-purple-700 font-bold py-4 rounded-xl hover:scale-105 transition"
          >
            🚀 Virar Pro no WhatsApp
          </a>

        </div>

      </div>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="bg-[#111827] p-6 rounded-2xl border border-white/10 hover:border-purple-400 transition">
      <div className="text-purple-400 mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  )
}