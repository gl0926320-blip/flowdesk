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

    const [companyId, setCompanyId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [servicos, setServicos] = useState<any[]>([])

useEffect(() => {
  async function carregar() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

const { data: companyUser } = await supabase
  .from("company_users")
  .select("company_id, role")
  .eq("user_id", user.id)
  .single()

      

    if (!companyUser) {
      setLoading(false)
      return
    }

    const companyId = companyUser.company_id
    setCompanyId(companyId)

let query = supabase
  .from("servicos")
  .select("*")
  .eq("company_id", companyId)
  .eq("ativo", true)

if (companyUser.role === "vendedor") {
  query = query.eq("responsavel", user.email)
}

const { data } = await query

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
const concluidos = ativos.filter(
  s => s.status?.trim().toLowerCase() === "concluido"
)

const perdidos = ativos.filter(
  s => ["recusado","cancelado","perdido"].includes(
    s.status?.trim().toLowerCase()
  )
)

// 🔥 PADRÃO DASHBOARD

const STATUS_POTENCIAL = [
  "lead",
  "proposta_enviada",
  "aguardando_cliente",
];

const STATUS_CONFIRMADA = [
  "proposta_validada",
  "andamento",
];

const STATUS_REALIZADA = [
  "concluido",
];

const potencialList = ativos.filter(o =>
  STATUS_POTENCIAL.includes(
    o.status?.trim().toLowerCase()
  )
);

const confirmadaList = ativos.filter(o =>
  STATUS_CONFIRMADA.includes(
    o.status?.trim().toLowerCase()
  )
);

const realizadosList = ativos.filter(o =>
  STATUS_REALIZADA.includes(
    o.status?.trim().toLowerCase()
  )
);

const baseConversao =
  potencialList.length +
  confirmadaList.length +
  realizadosList.length;

const conversao =
  baseConversao > 0
    ? (realizadosList.length / baseConversao) * 100
    : 0;


      // 💰 Receita do mês
const receitaMes = realizadosList
  .filter(s => {
    const data = new Date(s.data_fechamento || s.created_at)
    return (
      data.getMonth() === hoje.getMonth() &&
      data.getFullYear() === hoje.getFullYear()
    )
  })
  .reduce((acc, s) => acc + Number(s.valor_orcamento || 0), 0)


// 📉 Taxa de perda baseada em oportunidades reais
const taxaPerda =
  baseConversao > 0
    ? (perdidos.length / baseConversao) * 100
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
const fechadosComData = concluidos.filter(s => s.data_fechamento)

const tempoMedioFechamento =
  fechadosComData.length > 0
    ? fechadosComData.reduce((acc, s) => {
        const inicio = new Date(s.created_at)
        const fim = new Date(s.data_fechamento)
        const diff = (fim.getTime() - inicio.getTime()) / 86400000
        return acc + diff
      }, 0) / fechadosComData.length
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

      const clientesInativos = ativos.filter(
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
const status = s.status?.trim().toLowerCase() || "sem_status"
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
if (leads.length >= 5 && realizadosList.length === 0) {
  score -= 15 // funil travado no topo
}

// 📊 CONVERSÃO REAL
if (baseConversao >= 3) {
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
if (baseConversao < 3) {
  score = Math.min(score, 85)
}
score = Math.min(score, 98)
score = Math.max(score, 0)
score = Math.min(score, 98)

const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)

const receitaMesAnterior = realizadosList
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

{/* 🧠 DIAGNÓSTICO DO FUNIL */}
<div className="bg-gray-900 p-6 rounded-xl space-y-3">
  <h2 className="text-xl font-semibold text-yellow-400">
    🧠 Diagnóstico do Funil
  </h2>

  {/* 🚀 FUNIL FORTE */}
  {diagnostico.score >= 85 && (
    <p className="text-green-400">
      ⭐ Excelente performance! Seu funil está saudável e gerando resultados consistentes.
    </p>
  )}

  {/* ⚠️ CONVERSÃO BAIXA */}
  {diagnostico.score < 85 && diagnostico.conversao < 25 && (
    <p className="text-yellow-400">
      ⚠️ Sua taxa de conversão está abaixo do ideal. Revise abordagem e follow-ups.
    </p>
  )}

  {/* 🚨 MUITAS PERDAS */}
  {diagnostico.taxaPerda > 40 && (
    <p className="text-red-400">
      🚨 Alta taxa de perda detectada. Pode haver problema na qualificação ou proposta.
    </p>
  )}

  {/* 💤 LEADS PARADOS */}
  {diagnostico.leadsParados.length > 0 && (
    <p className="text-yellow-400">
      🔔 {diagnostico.leadsParados.length} lead(s) aguardando ação imediata.
    </p>
  )}

  {/* 📈 CRESCIMENTO */}
  {diagnostico.variacaoReceita > 0 && (
    <p className="text-green-400">
      📈 Receita cresceu {diagnostico.variacaoReceita.toFixed(1)}% em relação ao mês anterior.
    </p>
  )}

  {/* 📉 QUEDA */}
  {diagnostico.variacaoReceita < 0 && (
    <p className="text-red-400">
      📉 Receita caiu {Math.abs(diagnostico.variacaoReceita).toFixed(1)}% vs mês anterior.
    </p>
  )}

  {/* 🟢 SEM ALERTAS */}
  {diagnostico.score >= 85 &&
    diagnostico.leadsParados.length === 0 &&
    diagnostico.taxaPerda < 30 && (
      <p className="text-green-400">
        🚀 Nenhum ponto crítico identificado no momento.
      </p>
    )}
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