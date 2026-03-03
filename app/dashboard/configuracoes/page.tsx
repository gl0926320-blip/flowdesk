  "use client"

  import { useEffect, useMemo, useState } from "react"
  import { createClient } from "@/lib/supabase-browser"

  function diasDesde(data?: string | null) {
    if (!data) return 0
    const d = new Date(data)
    const hoje = new Date()
    return Math.floor((hoje.getTime() - d.getTime()) / 86400000)
  }

  function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor)
}


  export default function ConfiguracoesPage() {
    const supabase = createClient()

    const [servicos, setServicos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function carregar() {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data } = await supabase
          .from("servicos")
          .select("*")
          .eq("user_id", user.id)

        setServicos(data || [])
        setLoading(false)
      }

      carregar()
    }, [])

   const diagnostico = useMemo(() => {
  const hoje = new Date()

  // ✅ USAR APENAS LEADS ATIVOS
  const ativos = servicos.filter(s => s.ativo === true)
      const DIAS_LEAD_PARADO = 2  

    const leads = ativos.filter(
  s => s.status?.trim().toLowerCase() === "lead"
)
     const propostas = ativos.filter(s => {
  const status = s.status?.trim().toLowerCase()
  return status === "proposta_enviada" || status === "aguardando_cliente"
})

      const concluidos = servicos.filter(
        s => s.status?.trim().toLowerCase() === "concluido"
      )

      const perdidos = servicos.filter(
        s => s.status?.trim().toLowerCase() === "perdido"
      )

      // 📊 Conversão baseada em oportunidades reais
const oportunidades =
  propostas.length + concluidos.length + perdidos.length

const conversao =
  oportunidades > 0
    ? (concluidos.length / oportunidades) * 100
    : 0


      // 💰 Receita do mês
const receitaMes = concluidos
  .filter(s => {
    const data = new Date(s.data_fechamento || s.created_at)
    return (
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear()
    )
  })
  .reduce((acc, s) => acc + (s.valor_orcamento || 0), 0)


// 📉 Taxa de perda baseada em oportunidades reais
const taxaPerda =
  oportunidades > 0
    ? (perdidos.length / oportunidades) * 100
    : 0

      // 💎 Ticket médio
      const ticketMedio =
        concluidos.length > 0
          ? concluidos.reduce((acc, s) => acc + (s.valor_orcamento || 0), 0) /
            concluidos.length
          : 0

      // 📈 Margem média
const margemMedia =
  concluidos.length > 0
    ? concluidos.reduce((acc, s) => {
        if (!s.valor_orcamento) return acc
        const custo = s.custo || 0
        return acc + ((s.valor_orcamento - custo) / s.valor_orcamento) * 100
      }, 0) / concluidos.length
    : 0

      // ⏳ Tempo médio de fechamento
const tempoMedioFechamento =
  concluidos.length > 0
    ? concluidos.reduce((acc, s) => {
        if (!s.data_fechamento) return acc
        const inicio = new Date(s.created_at)
        const fim = new Date(s.data_fechamento)
        const diff =
          (fim.getTime() - inicio.getTime()) / 86400000
        return acc + diff
      }, 0) / concluidos.length
    : 0

      // 🔥 Alertas
   const leadsParados = leads.filter(
  s => diasDesde(s.ultimo_contato || s.data_entrada || s.created_at) > DIAS_LEAD_PARADO
)

      const propostasParadas = propostas.filter(
        s => diasDesde(s.ultimo_contato || s.data_orcamento || s.created_at) > 2
      )

      const comissoesPendentes = concluidos.filter(
        s => !s.comissao_paga && diasDesde(s.created_at) > 7
      )

      const clientesInativos = servicos.filter(
        s => diasDesde(s.ultima_compra) > 30
      )

      // 🏆 Top vendedor
      const vendedores: Record<string, number> = {}

      concluidos.forEach(s => {
        if (!s.responsavel_id) return
        vendedores[s.responsavel_id] =
          (vendedores[s.responsavel_id] || 0) + (s.valor_orcamento || 0)
      })

      const topVendedor =
        Object.entries(vendedores).sort((a, b) => b[1] - a[1])[0] || null

      // 📌 Gargalo
      const statusCount: Record<string, number> = {}
     ativos.forEach(s => {
  const status = s.status?.trim().toLowerCase()
  statusCount[status] = (statusCount[status] || 0) + 1
})

      const gargalo =
        Object.entries(statusCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"

        // 🧠 Score de Saúde do Funil (0 a 100)

let score = 100

// 🚦 VOLUME MÍNIMO DE DADOS
if (ativos.length < 5) {
  score -= 15 // pouco histórico
}

// 🎯 GERAÇÃO DE OPORTUNIDADES
if (leads.length > 5 && oportunidades < 3) {
  score -= 15 // funil travado no topo
}

// 📊 CONVERSÃO REAL
if (oportunidades >= 3) {
  if (conversao < 15) score -= 25
  else if (conversao < 25) score -= 15
  else if (conversao < 35) score -= 8
} else {
  score -= 10 // poucos dados para validar conversão
}

// 💰 MARGEM
if (margemMedia < 15) score -= 20
else if (margemMedia < 25) score -= 10

// 📉 TAXA DE PERDA
if (taxaPerda > 40) score -= 20
else if (taxaPerda > 30) score -= 10

// 💤 LEADS ESTAGNADOS
if (leadsParados.length >= 5) score -= 15
else if (leadsParados.length >= 3) score -= 8

// 📄 PROPOSTAS PARADAS
if (propostasParadas.length >= 4) score -= 12
else if (propostasParadas.length >= 2) score -= 6

// ⏳ TEMPO MÉDIO MUITO ALTO
if (tempoMedioFechamento > 30) score -= 10

// 🧊 EVITAR SCORE 100 FALSO
if (oportunidades < 3) {
  score = Math.min(score, 85)
}

if (score < 0) score = 0

const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)

const receitaMesAnterior = concluidos
  .filter(s => {
    const data = new Date(s.data_fechamento || s.created_at)
    return (
      data.getMonth() === mesAnterior.getMonth() &&
      data.getFullYear() === mesAnterior.getFullYear()
    )
  })
  .reduce((acc, s) => acc + (s.valor_orcamento || 0), 0)

const variacaoReceita =
  receitaMesAnterior > 0
    ? ((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100
    : 0


      return {
        conversao,
        ticketMedio,
        margemMedia,
        leadsParados,
        propostasParadas,
        comissoesPendentes,
        clientesInativos,
        gargalo,
        receitaMes,
        taxaPerda,
        tempoMedioFechamento,
        topVendedor,
        score,
        receitaMesAnterior,
        variacaoReceita,
      }
    }, [servicos])

    if (loading) {
      return <div className="p-6 text-white">Analisando dados...</div>
    }

    return (
      <div className="p-8 text-white space-y-10 overflow-visible">

        <h1 className="text-3xl font-bold text-cyan-400">
          🚀 Central Estratégica
        </h1>

        {/* 🧠 SCORE DO FUNIL */}
<div className="bg-gradient-to-r from-cyan-600/10 to-blue-500/10 p-8 rounded-2xl border border-cyan-400/20">
  <h2 className="text-xl font-semibold text-cyan-400 mb-4">
    🔥 Saúde do Funil
  </h2>

  <div className="text-5xl font-bold">
    {diagnostico.score}
    <span className="text-lg ml-2 text-white/60">/ 100</span>
  </div>

  <div className="mt-2 text-sm text-white/60">
    {diagnostico.score > 80 && "Funil saudável e previsível 🚀"}
    {diagnostico.score <= 80 && diagnostico.score > 50 && "Atenção em alguns pontos ⚠️"}
    {diagnostico.score <= 50 && "Funil em risco 🔴"}
  </div>
</div>

        {/* 🔥 ALERTAS */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card titulo="🔥 Leads Parados">
            {diagnostico.leadsParados.length} aguardando ação
          </Card>

          <Card titulo="📄 Propostas sem resposta">
            {diagnostico.propostasParadas.length} pendentes
          </Card>

          <Card titulo="💰 Comissões não pagas">
            {diagnostico.comissoesPendentes.length} pendentes
          </Card>

          <Card titulo="🎯 Clientes inativos">
            {diagnostico.clientesInativos.length} há +30 dias
          </Card>
        </div>

        {/* 📊 MÉTRICAS PREMIUM */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card titulo="💵 Receita do mês">
  {formatarMoeda(diagnostico.receitaMes)}

  <div className="text-sm mt-2 text-white/60">
    {diagnostico.variacaoReceita >= 0 ? "📈" : "📉"}{" "}
    {diagnostico.variacaoReceita.toFixed(1)}% vs mês anterior
  </div>
</Card>

          

          <Card titulo="📉 Taxa de Perda">
            {diagnostico.taxaPerda.toFixed(1)}%
          </Card>

          <Card titulo="⏳ Tempo Médio de Fechamento">
            {diagnostico.tempoMedioFechamento.toFixed(0)} dias
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card titulo="📊 Taxa de Conversão">
            {diagnostico.conversao.toFixed(1)}%
          </Card>

          <Card titulo="💎 Ticket Médio">
          {formatarMoeda(diagnostico.ticketMedio)}
          </Card>

         <Card
  titulo="📈 Margem Média"
  tooltip="Margem é o percentual de lucro sobre cada venda.
É calculada como: (Valor - Custo) ÷ Valor × 100.
Abaixo de 15% é considerada margem apertada."
>
  {diagnostico.margemMedia.toFixed(1)}%
</Card>
        </div>

        {/* 🏆 GAMIFICAÇÃO */}
        {diagnostico.topVendedor && (
          <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-300/10 p-6 rounded-xl border border-yellow-400/20">
            <h2 className="text-xl font-semibold text-yellow-400 mb-2">
              🏆 Melhor vendedor do mês
            </h2>
            <p>
              ID: {diagnostico.topVendedor[0]} — {formatarMoeda(diagnostico.topVendedor[1])}
            </p>
          </div>
        )}

        {/* 🎯 SUGESTÕES */}
        <div className="bg-gray-900 p-6 rounded-xl space-y-3">
          <h2 className="text-xl font-semibold text-yellow-400">
            🎯 Recomendações Inteligentes
          </h2>

          {diagnostico.conversao < 20 && (
            <p>👉 Sua taxa de conversão está baixa. Ajuste abordagem.</p>
          )}

          {diagnostico.margemMedia < 15 && (
            <p>👉 Margem baixa. Revise custos ou precificação.</p>
          )}

          {diagnostico.taxaPerda > 40 && (
            <p>👉 Alta taxa de perda. Revise seu funil comercial.</p>
          )}

          <p>📌 Maior concentração está em: {diagnostico.gargalo}</p>
        </div>

      </div>
    )
  }

function Card({ titulo, children, tooltip }: any) {
  return (
    <div className="relative bg-gray-900 p-6 rounded-xl border border-white/10">
      
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm text-white/50">{titulo}</h3>

        {tooltip && (
          <div className="relative group">
            <span className="cursor-pointer text-white/40 hover:text-white">
              ℹ️
            </span>

            <div
              className="absolute left-1/2 -translate-x-1/2 top-8 
                         w-72 p-3 text-xs bg-gray-800 border 
                         border-white/20 rounded-lg shadow-2xl 
                         opacity-0 group-hover:opacity-100 
                         transition-opacity duration-200 
                         pointer-events-none z-50"
            >
              {tooltip}
            </div>
          </div>
        )}
      </div>

      <div className="text-2xl font-bold text-cyan-400">
        {children}
      </div>
    </div>
  )
}