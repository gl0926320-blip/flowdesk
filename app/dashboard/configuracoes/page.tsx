"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Brain,
  Crown,
  DollarSign,
  Flame,
  Gauge,
  Lightbulb,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"

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

type Vendedor = {
  user_id: string | null
  email: string
  role: string
  status: string
}

export default function ConfiguracoesPage() {
  const supabase = createClient()

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [servicos, setServicos] = useState<any[]>([])
  const [role, setRole] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [filtroVendedor, setFiltroVendedor] = useState("todos")
  const [busca, setBusca] = useState("")
  const [periodo, setPeriodo] = useState<"Hoje" | "7 Dias" | "30 Dias" | "Mês" | "Personalizado">("Hoje")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")

  useEffect(() => {
    async function carregar() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: companyUser } = await supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .single()

      if (!companyUser) {
        setLoading(false)
        return
      }

      setRole(companyUser.role)

      if (companyUser.role === "vendedor") {
        setFiltroVendedor(user.id)
      }

      const companyId = companyUser.company_id
      setCompanyId(companyId)

      const { data: equipe } = await supabase
        .from("company_users")
        .select("user_id, email, role, status")
        .eq("company_id", companyId)
        .eq("status", "accepted")
        .order("email", { ascending: true })

      setVendedores((equipe as Vendedor[]) || [])

      let query = supabase
        .from("servicos")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativo", true)

      if (companyUser.role === "vendedor") {
        query = query.eq("user_id", user.id)
      }

      const { data } = await query

      setServicos(data || [])
      setLoading(false)
    }

    carregar()
  }, [supabase])

  const servicosFiltradosBase = useMemo(() => {
    let lista = [...servicos]

    const agora = new Date()

    lista = lista.filter((s) => {
      const dataRef = new Date(s.created_at)

      if (periodo === "Hoje") {
        return (
          dataRef.getDate() === agora.getDate() &&
          dataRef.getMonth() === agora.getMonth() &&
          dataRef.getFullYear() === agora.getFullYear()
        )
      }

      if (periodo === "7 Dias") {
        const limite = new Date()
        limite.setDate(agora.getDate() - 7)
        return dataRef >= limite
      }

      if (periodo === "30 Dias") {
        const limite = new Date()
        limite.setDate(agora.getDate() - 30)
        return dataRef >= limite
      }

      if (periodo === "Mês") {
        return (
          dataRef.getMonth() === agora.getMonth() &&
          dataRef.getFullYear() === agora.getFullYear()
        )
      }

      if (periodo === "Personalizado" && dataInicio && dataFim) {
        const inicio = new Date(dataInicio + "T00:00:00")
        const fim = new Date(dataFim + "T23:59:59")
        return dataRef >= inicio && dataRef <= fim
      }

      return true
    })

    if (role !== "vendedor" && filtroVendedor !== "todos") {
      lista = lista.filter((s) => s.user_id === filtroVendedor)
    }

    if (busca.trim()) {
      const termo = busca.toLowerCase()

      lista = lista.filter((s) => {
        return (
          (s.cliente || "").toLowerCase().includes(termo) ||
          (s.tipo_servico || "").toLowerCase().includes(termo) ||
          (s.origem_lead || "").toLowerCase().includes(termo) ||
          (s.responsavel || "").toLowerCase().includes(termo)
        )
      })
    }

    return lista
  }, [servicos, periodo, dataInicio, dataFim, filtroVendedor, busca, role])

  const diagnostico = useMemo(() => {
    const hoje = new Date()
    const ativos = servicosFiltradosBase.filter((s) => s.ativo === true)
    const DIAS_LEAD_PARADO = 2

    const leads = ativos.filter(
      (s) => s.status?.trim().toLowerCase() === "lead"
    )

    const propostas = ativos.filter((s) => {
      const status = s.status?.trim().toLowerCase()
      return status === "proposta_enviada" || status === "aguardando_cliente"
    })

    const concluidos = ativos.filter(
      (s) => s.status?.trim().toLowerCase() === "concluido"
    )

    const perdidos = ativos.filter((s) =>
      ["recusado", "cancelado", "perdido"].includes(
        s.status?.trim().toLowerCase()
      )
    )

    const STATUS_POTENCIAL = [
      "lead",
      "proposta_enviada",
      "aguardando_cliente",
    ]

    const STATUS_CONFIRMADA = [
      "proposta_validada",
      "andamento",
    ]

    const STATUS_REALIZADA = [
      "concluido",
    ]

    const potencialList = ativos.filter((o) =>
      STATUS_POTENCIAL.includes(o.status?.trim().toLowerCase())
    )

    const confirmadaList = ativos.filter((o) =>
      STATUS_CONFIRMADA.includes(o.status?.trim().toLowerCase())
    )

    const realizadosList = ativos.filter((o) =>
      STATUS_REALIZADA.includes(o.status?.trim().toLowerCase())
    )

    const baseConversao =
      potencialList.length + confirmadaList.length + realizadosList.length

    const conversao =
      baseConversao > 0
        ? (realizadosList.length / baseConversao) * 100
        : 0

    const receitaMes = realizadosList
      .filter((s) => {
        const data = new Date(s.data_fechamento || s.created_at)
        return (
          data.getMonth() === hoje.getMonth() &&
          data.getFullYear() === hoje.getFullYear()
        )
      })
      .reduce((acc, s) => acc + Number(s.valor_orcamento || 0), 0)

    const taxaPerda =
      baseConversao > 0 ? (perdidos.length / baseConversao) * 100 : 0

    const ticketMedio =
      concluidos.length > 0
        ? concluidos.reduce((acc, s) => acc + Number(s.valor_orcamento || 0), 0) /
          concluidos.length
        : 0

    const margemMedia =
      concluidos.length > 0
        ? concluidos.reduce((acc, s) => {
            if (!s.valor_orcamento) return acc
            const custo = Number(s.custo || 0)
            const comissao = Number(s.valor_comissao || 0)
            return (
              acc +
              ((Number(s.valor_orcamento) - custo - comissao) /
                Number(s.valor_orcamento)) *
                100
            )
          }, 0) / concluidos.length
        : 0

    const fechadosComData = concluidos.filter((s) => s.data_fechamento)

    const tempoMedioFechamento =
      fechadosComData.length > 0
        ? fechadosComData.reduce((acc, s) => {
            const inicio = new Date(s.created_at)
            const fim = new Date(s.data_fechamento)
            const diff = (fim.getTime() - inicio.getTime()) / 86400000
            return acc + diff
          }, 0) / fechadosComData.length
        : 0

    const leadsParados = leads.filter(
      (s) => diasDesde(s.ultimo_contato || s.data_entrada || s.created_at) > DIAS_LEAD_PARADO
    )

    const propostasParadas = propostas.filter(
      (s) => diasDesde(s.ultimo_contato || s.data_orcamento || s.created_at) > 2
    )

    const comissoesPendentes = concluidos.filter(
      (s) => !s.comissao_paga && diasDesde(s.created_at) > 7
    )

    const clientesInativos = ativos.filter(
      (s) => diasDesde(s.ultima_compra) > 30
    )

    const oportunidadesQuentes = ativos.filter(
      (s) => (s.temperatura || "").trim().toLowerCase() === "quente"
    )

    const oportunidadesFrias = ativos.filter(
      (s) => (s.temperatura || "").trim().toLowerCase() === "frio"
    )

    const vendedoresMap: Record<string, number> = {}

    concluidos.forEach((s) => {
      const nome = s.responsavel || "Não definido"
      vendedoresMap[nome] =
        (vendedoresMap[nome] || 0) + Number(s.valor_orcamento || 0)
    })

    const topVendedor =
      Object.entries(vendedoresMap).sort((a, b) => b[1] - a[1])[0] || null

    const statusCount: Record<string, number> = {}
    ativos.forEach((s) => {
      const status = s.status?.trim().toLowerCase() || "sem_status"
      statusCount[status] = (statusCount[status] || 0) + 1
    })

    const gargalo =
      Object.entries(statusCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-"

    let score = 100

    if (ativos.length < 5) score -= 15
    if (leads.length >= 5 && realizadosList.length === 0) score -= 15

    if (baseConversao >= 3) {
      if (conversao < 15) score -= 25
      else if (conversao < 25) score -= 15
      else if (conversao < 35) score -= 8
    } else {
      score -= 10
    }

    if (margemMedia < 15) score -= 20
    else if (margemMedia < 25) score -= 10

    if (taxaPerda > 40) score -= 20
    else if (taxaPerda > 30) score -= 10

    if (leadsParados.length >= 5) score -= 15
    else if (leadsParados.length >= 3) score -= 8

    if (propostasParadas.length >= 4) score -= 12
    else if (propostasParadas.length >= 2) score -= 6

    if (tempoMedioFechamento > 30) score -= 10

    if (baseConversao < 3) {
      score = Math.min(score, 85)
    }

    score = Math.min(score, 98)
    score = Math.max(score, 0)

    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)

    const receitaMesAnterior = realizadosList
      .filter((s) => {
        const data = new Date(s.data_fechamento || s.created_at)
        return (
          data.getMonth() === mesAnterior.getMonth() &&
          data.getFullYear() === mesAnterior.getFullYear()
        )
      })
      .reduce((acc, s) => acc + Number(s.valor_orcamento || 0), 0)

    const variacaoReceita =
      receitaMesAnterior > 0
        ? ((receitaMes - receitaMesAnterior) / receitaMesAnterior) * 100
        : 0

    const rankingVendedores = Object.entries(vendedoresMap)
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)

    const alertasCriticos = [
      leadsParados.length >= 5
        ? `Há ${leadsParados.length} leads parados precisando de ação imediata.`
        : null,
      propostasParadas.length >= 4
        ? `Existem ${propostasParadas.length} propostas sem avanço comercial.`
        : null,
      taxaPerda > 40
        ? `A taxa de perda está muito alta (${taxaPerda.toFixed(1)}%).`
        : null,
      margemMedia < 15 && concluidos.length > 0
        ? `A margem média está apertada (${margemMedia.toFixed(1)}%).`
        : null,
      comissoesPendentes.length >= 3
        ? `Existem ${comissoesPendentes.length} comissões aguardando pagamento.`
        : null,
    ].filter(Boolean) as string[]

    const alertasModerados = [
      clientesInativos.length > 0
        ? `${clientesInativos.length} clientes estão sem recompra há mais de 30 dias.`
        : null,
      oportunidadesFrias.length > oportunidadesQuentes.length
        ? `Há mais oportunidades frias do que quentes no funil.`
        : null,
      tempoMedioFechamento > 20
        ? `O ciclo médio de fechamento está longo (${tempoMedioFechamento.toFixed(0)} dias).`
        : null,
      conversao < 25 && baseConversao >= 3
        ? `A conversão está abaixo do ideal (${conversao.toFixed(1)}%).`
        : null,
    ].filter(Boolean) as string[]

    const insights = [
      receitaMes > receitaMesAnterior && receitaMesAnterior > 0
        ? `A receita cresceu ${variacaoReceita.toFixed(1)}% contra o mês anterior.`
        : null,
      receitaMes < receitaMesAnterior && receitaMesAnterior > 0
        ? `A receita caiu ${Math.abs(variacaoReceita).toFixed(1)}% em relação ao mês anterior.`
        : null,
      topVendedor
        ? `O melhor vendedor do período é ${topVendedor[0]}, com ${formatarMoeda(Number(topVendedor[1]))} em vendas.`
        : null,
      gargalo !== "-"
        ? `O maior acúmulo do funil está em "${gargalo}".`
        : null,
      oportunidadesQuentes.length > 0
        ? `Existem ${oportunidadesQuentes.length} oportunidades quentes para priorizar.`
        : null,
    ].filter(Boolean) as string[]

    return {
      ativos,
      leads,
      propostas,
      concluidos,
      perdidos,
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
      baseConversao,
      oportunidadesQuentes,
      oportunidadesFrias,
      rankingVendedores,
      alertasCriticos,
      alertasModerados,
      insights,
      totalAtivos: ativos.length,
      totalConcluidos: concluidos.length,
      totalPerdidos: perdidos.length,
      totalPotenciais: potencialList.length,
      totalConfirmadas: confirmadaList.length,
    }
  }, [servicosFiltradosBase])

  if (loading) {
    return <div className="p-6 text-white">Analisando dados...</div>
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_35%),linear-gradient(180deg,#081120_0%,#0b1730_45%,#0f172a_100%)] p-6 md:p-10 text-white space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-cyan-400 flex items-center gap-3">
          <Brain />
          Central Estratégica
        </h1>
        <p className="text-white/40">
          Alertas inteligentes, saúde do funil e leitura estratégica da operação
        </p>
      </div>

      {/* FILTROS */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 md:p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)] space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Search size={18} />
          Filtros estratégicos
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 flex items-center bg-white/10 border border-white/20 px-4 py-3 rounded-2xl">
            <Search size={18} className="text-blue-200" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cliente, serviço, origem ou responsável..."
              className="bg-transparent outline-none ml-3 w-full text-white placeholder:text-white/40"
            />
          </div>

          <select
            value={role === "vendedor" ? userId || "todos" : filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            disabled={role === "vendedor"}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white disabled:opacity-60"
          >
            {role !== "vendedor" && (
              <option value="todos" className="bg-[#0f172a]">
                Todos vendedores
              </option>
            )}

            {vendedores
              .filter((v) => ["vendedor", "admin", "owner"].includes(v.role))
              .map((v) => (
                <option
                  key={v.user_id || v.email}
                  value={v.user_id || ""}
                  className="bg-[#0f172a]"
                >
                  {v.email}
                </option>
              ))}
          </select>

          <button
            onClick={() => {
              setBusca("")
              setPeriodo("Hoje")
              setDataInicio("")
              setDataFim("")
              setFiltroVendedor(role === "vendedor" ? userId || "todos" : "todos")
            }}
            className="p-3 rounded-2xl bg-red-600 hover:bg-red-700 transition font-semibold"
          >
            Limpar filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {["Hoje", "7 Dias", "30 Dias", "Mês"].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p as any)
                setDataInicio("")
                setDataFim("")
              }}
              className={`px-4 py-2 rounded-xl transition ${
                periodo === p
                  ? "bg-cyan-600 shadow-lg shadow-cyan-600/30"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => setPeriodo("Personalizado")}
            className={`px-4 py-2 rounded-xl transition ${
              periodo === "Personalizado"
                ? "bg-cyan-600 shadow-lg shadow-cyan-600/30"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            Personalizado
          </button>
        </div>

        {periodo === "Personalizado" && (
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white"
            />
          </div>
        )}
      </div>

      {/* SCORE */}
      <div className="bg-gradient-to-r from-cyan-600/10 to-blue-500/10 p-8 rounded-3xl border border-cyan-400/20">
        <div className="flex items-center gap-3 mb-4">
          <Gauge className="text-cyan-400" />
          <h2 className="text-xl font-semibold text-cyan-400">
            Saúde do Funil
          </h2>
        </div>

        <div className="text-5xl font-bold">
          {diagnostico.score}
          <span className="text-lg ml-2 text-white/60">/ 100</span>
        </div>

        <div className="mt-3 text-sm text-white/60">
          {diagnostico.score > 80 && "Funil saudável, previsível e com boa tração. 🚀"}
          {diagnostico.score <= 80 && diagnostico.score > 50 && "Existem pontos de atenção que já impactam a operação. ⚠️"}
          {diagnostico.score <= 50 && "A operação está em risco e precisa de correção rápida. 🔴"}
        </div>

        <div className="w-full h-4 rounded-full bg-slate-800 overflow-hidden mt-5">
          <div
            className={`h-full rounded-full ${
              diagnostico.score > 80
                ? "bg-gradient-to-r from-green-400 to-cyan-400"
                : diagnostico.score > 50
                ? "bg-gradient-to-r from-yellow-400 to-orange-400"
                : "bg-gradient-to-r from-red-500 to-rose-500"
            }`}
            style={{ width: `${diagnostico.score}%` }}
          />
        </div>
      </div>

      {/* MÉTRICAS PRINCIPAIS */}
      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-5">
        <MiniCard
          title="Receita do período"
          value={formatarMoeda(diagnostico.receitaMes)}
          icon={<DollarSign size={18} />}
          tone="cyan"
          subtitle={
            diagnostico.variacaoReceita >= 0
              ? `+${diagnostico.variacaoReceita.toFixed(1)}% vs mês anterior`
              : `${diagnostico.variacaoReceita.toFixed(1)}% vs mês anterior`
          }
        />

        <MiniCard
          title="Conversão"
          value={`${diagnostico.conversao.toFixed(1)}%`}
          icon={<Target size={18} />}
          tone="green"
          subtitle={`${diagnostico.totalConcluidos} fechados / ${diagnostico.baseConversao} oportunidades`}
        />

        <MiniCard
          title="Taxa de perda"
          value={`${diagnostico.taxaPerda.toFixed(1)}%`}
          icon={<TrendingDown size={18} />}
          tone="red"
          subtitle={`${diagnostico.totalPerdidos} perdidos`}
        />

        <MiniCard
          title="Ticket médio"
          value={formatarMoeda(diagnostico.ticketMedio)}
          icon={<TrendingUp size={18} />}
          tone="yellow"
          subtitle="Valor médio por fechamento"
        />

        <MiniCard
          title="Margem média"
          value={`${diagnostico.margemMedia.toFixed(1)}%`}
          icon={<BarChart3 size={18} />}
          tone="blue"
          subtitle="Rentabilidade média"
        />

        <MiniCard
          title="Tempo de fechamento"
          value={`${diagnostico.tempoMedioFechamento.toFixed(0)} dias`}
          icon={<BellRing size={18} />}
          tone="purple"
          subtitle="Ciclo médio de venda"
        />
      </div>

      {/* ALERTAS */}
      <div className="grid lg:grid-cols-2 gap-6">
        <AlertBox
          title="Alertas críticos"
          icon={<AlertTriangle size={18} />}
          color="red"
          items={diagnostico.alertasCriticos}
          emptyText="Nenhum alerta crítico identificado."
        />

        <AlertBox
          title="Alertas moderados"
          icon={<BellRing size={18} />}
          color="yellow"
          items={diagnostico.alertasModerados}
          emptyText="Nenhum alerta moderado no momento."
        />
      </div>

      {/* OPERAÇÃO */}
      <div className="grid lg:grid-cols-4 gap-5">
        <StatPanel
          title="Leads parados"
          value={String(diagnostico.leadsParados.length)}
          subtitle="Precisam de follow-up urgente"
          icon={<Flame size={18} />}
          color="text-orange-400"
        />
        <StatPanel
          title="Propostas paradas"
          value={String(diagnostico.propostasParadas.length)}
          subtitle="Sem avanço comercial"
          icon={<Target size={18} />}
          color="text-yellow-400"
        />
        <StatPanel
          title="Comissões pendentes"
          value={String(diagnostico.comissoesPendentes.length)}
          subtitle="Aguardando pagamento"
          icon={<DollarSign size={18} />}
          color="text-purple-400"
        />
        <StatPanel
          title="Clientes inativos"
          value={String(diagnostico.clientesInativos.length)}
          subtitle="Sem recompra recente"
          icon={<Users size={18} />}
          color="text-cyan-400"
        />
      </div>

      {/* INSIGHTS ESTRATÉGICOS */}
      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center gap-3 text-yellow-400">
          <Lightbulb />
          <h2 className="text-xl font-semibold">Diagnóstico Estratégico</h2>
        </div>

        <div className="space-y-3">
          {diagnostico.insights.length === 0 ? (
            <p className="text-white/50">Sem insights relevantes para o período.</p>
          ) : (
            diagnostico.insights.map((item, index) => (
              <div
                key={index}
                className="bg-white/5 border border-white/5 rounded-2xl p-4 text-white/80"
              >
                {item}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RESUMO DO FUNIL */}
      <div className="grid md:grid-cols-4 gap-5">
        <FunilCard label="Potenciais" value={diagnostico.totalPotenciais} />
        <FunilCard label="Confirmadas" value={diagnostico.totalConfirmadas} />
        <FunilCard label="Concluídas" value={diagnostico.totalConcluidos} />
        <FunilCard label="Gargalo atual" value={String(diagnostico.gargalo)} />
      </div>

      {/* TOP VENDEDOR */}
      {diagnostico.topVendedor && (
        <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-300/10 p-6 rounded-3xl border border-yellow-400/20">
          <div className="flex items-center gap-3 text-yellow-400 mb-2">
            <Crown />
            <h2 className="text-xl font-semibold">Melhor vendedor do período</h2>
          </div>

          <div className="text-2xl font-bold">{diagnostico.topVendedor[0]}</div>
          <p className="text-cyan-400 font-semibold mt-1">
            {formatarMoeda(Number(diagnostico.topVendedor[1]))}
          </p>
        </div>
      )}

      {/* RANKING */}
      <div className="bg-[#0f172a] p-6 rounded-3xl border border-white/10">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Crown className="text-yellow-400" size={18} />
          Ranking Comercial
        </h2>

        <div className="space-y-4">
          {diagnostico.rankingVendedores.length === 0 ? (
            <div className="text-white/50">Nenhum vendedor com resultado no período.</div>
          ) : (
            diagnostico.rankingVendedores.map((item: any, index: number) => {
              const percentual =
                diagnostico.receitaMes > 0
                  ? (item.valor / diagnostico.receitaMes) * 100
                  : 0

              return (
                <div
                  key={item.nome}
                  className="bg-white/5 rounded-2xl p-5 border border-white/5"
                >
                  <div className="flex justify-between items-center gap-4">
                    <div className="font-semibold text-lg">
                      {index === 0 && "🥇 "}
                      {index === 1 && "🥈 "}
                      {index === 2 && "🥉 "}
                      {item.nome}
                    </div>

                    <div className="text-cyan-400 font-bold">
                      {formatarMoeda(item.valor)}
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden mt-4">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-cyan-400"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>

                  <div className="mt-3 text-xs text-white/50">
                    Participação no faturamento: {percentual.toFixed(1)}%
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function MiniCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  tone: "cyan" | "green" | "red" | "yellow" | "blue" | "purple"
}) {
  const toneMap = {
    cyan: "text-cyan-400",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
  }

  return (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#111827] p-5 rounded-2xl border border-white/10">
      <div className="flex justify-between text-white/50 text-sm">
        <span>{title}</span>
        <span className={toneMap[tone]}>{icon}</span>
      </div>

      <div className={`mt-4 text-2xl font-bold ${toneMap[tone]}`}>{value}</div>
      <div className="mt-2 text-xs text-white/40">{subtitle}</div>
    </div>
  )
}

function AlertBox({
  title,
  icon,
  color,
  items,
  emptyText,
}: {
  title: string
  icon: React.ReactNode
  color: "red" | "yellow"
  items: string[]
  emptyText: string
}) {
  const styles = {
    red: {
      wrap: "bg-red-500/10 border-red-400/20",
      title: "text-red-400",
      item: "bg-red-500/10 border-red-400/10",
    },
    yellow: {
      wrap: "bg-yellow-500/10 border-yellow-400/20",
      title: "text-yellow-400",
      item: "bg-yellow-500/10 border-yellow-400/10",
    },
  }

  return (
    <div className={`p-6 rounded-3xl border ${styles[color].wrap}`}>
      <div className={`flex items-center gap-3 mb-4 ${styles[color].title}`}>
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-white/50">{emptyText}</div>
        ) : (
          items.map((item, index) => (
            <div
              key={index}
              className={`p-4 rounded-2xl border text-white/80 ${styles[color].item}`}
            >
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatPanel({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-5">
      <div className="flex justify-between text-white/50 text-sm">
        <span>{title}</span>
        <span className={color}>{icon}</span>
      </div>

      <div className={`mt-4 text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-2 text-xs text-white/40">{subtitle}</div>
    </div>
  )
}

function FunilCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-3 text-2xl font-bold text-cyan-400">{value}</div>
    </div>
  )
}