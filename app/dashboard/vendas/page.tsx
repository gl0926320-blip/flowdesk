"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Target,
  Search,
  Users,
  CreditCard,
  CalendarDays,
  BadgeDollarSign,
  Eye,
  X,
  Percent,
} from "lucide-react";

interface Venda {
  id: string;
  cliente: string;
  status: string;
  valor_orcamento: number;
  created_at: string;
  data_fechamento?: string | null;
  forma_pagamento: string;
  percentual_comissao: number;
  valor_comissao: number;
  telefone: string;
  email: string;
  tipo_servico: string;
  ativo: boolean;
  origem_lead?: string | null;
  responsavel?: string | null;
  user_id?: string | null;
  criado_por?: string | null;
  criado_por_email?: string | null;
  company_id?: string | null;
  custo?: number | null;
  descricao?: string | null;
  numero_os?: string | null;
  temperatura?: string | null;
}

interface VendaCalculada extends Venda {
  percentual_comissao_calculado: number;
  valor_comissao_calculado: number;
  lucro_calculado: number;
}

interface Vendedor {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
  meta_receita?: number | null;
}

export default function VendasPage() {
  const supabase = createClient();

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("30");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [selectedVenda, setSelectedVenda] = useState<VendaCalculada | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [filtroVendedor, setFiltroVendedor] = useState("all");
  const [filtroOrigem, setFiltroOrigem] = useState("all");
  const [filtroPagamento, setFiltroPagamento] = useState("all");

  const meta = 50000;

  useEffect(() => {
    load();
  }, []);

  function findVendedorByUserId(userId?: string | null) {
    if (!userId) return null;
    return vendedores.find((v) => v.user_id === userId) || null;
  }

  function findVendedorByEmail(email?: string | null) {
    if (!email) return null;
    return (
      vendedores.find(
        (v) => (v.email || "").toLowerCase() === email.toLowerCase()
      ) || null
    );
  }

  function calcularComissaoCongelada(params: {
    valorOrcamento: number;
    valorComissaoAtual?: number | null;
    percentualComissaoAtual?: number | null;
    vendedor?: Vendedor | null;
  }) {
    const valorOrcamento = Number(params.valorOrcamento || 0);
    const valorComissaoAtual = Number(params.valorComissaoAtual || 0);
    const percentualComissaoAtual = Number(params.percentualComissaoAtual || 0);
    const percentualVendedor = Number(params.vendedor?.comissao_percentual || 0);

    const percentualFinal =
      percentualComissaoAtual > 0 ? percentualComissaoAtual : percentualVendedor;

    const valorFinal =
      valorComissaoAtual > 0
        ? valorComissaoAtual
        : percentualFinal > 0 && valorOrcamento > 0
        ? (valorOrcamento * percentualFinal) / 100
        : 0;

    return {
      percentual_comissao: percentualFinal,
      valor_comissao: valorFinal,
    };
  }

  async function load() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const user = userData.user;
    setCurrentUserId(user.id);

const { data: memberships, error: companyUserError } = await supabase
  .from("company_users")
  .select("company_id, role")
  .eq("user_id", user.id)
  .eq("status", "ativo");

if (companyUserError) {
  console.error("Erro ao buscar vínculo:", companyUserError);
  setLoading(false);
  return;
}

const companyUser = memberships?.[0];

if (!companyUser) {
  setLoading(false);
  return;
}

    const currentCompanyId = companyUser.company_id;
    const currentRole = companyUser.role;

    setCompanyId(currentCompanyId);
    setRole(currentRole);

    if (currentRole === "vendedor") {
      setFiltroVendedor(user.id);
    }

const { data: equipe } = await supabase
  .from("company_users")
  .select("user_id, email, role, status, comissao_percentual, meta_receita")
  .eq("company_id", currentCompanyId)
  .eq("status", "ativo")
  .order("email", { ascending: true });

    setVendedores((equipe as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", currentCompanyId)
      .eq("status", "concluido")
      .eq("ativo", true);

if (currentRole === "vendedor") {
  query = query.eq("criado_por", user.id);
}

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    setVendas((data as Venda[]) || []);
    setLoading(false);
  }

  function filtrarPorPeriodo(data: string) {
    const hoje = new Date();
    const dataVenda = new Date(data);

    if (periodo === "Hoje") {
      return dataVenda.toDateString() === hoje.toDateString();
    }

    if (periodo === "7") {
      const seteDias = new Date();
      seteDias.setDate(hoje.getDate() - 7);
      return dataVenda >= seteDias;
    }

    if (periodo === "30") {
      const trintaDias = new Date();
      trintaDias.setDate(hoje.getDate() - 30);
      return dataVenda >= trintaDias;
    }

    if (periodo === "Mês") {
      return (
        dataVenda.getMonth() === hoje.getMonth() &&
        dataVenda.getFullYear() === hoje.getFullYear()
      );
    }

    if (periodo === "Personalizado" && dataInicio && dataFim) {
      return (
        dataVenda >= new Date(dataInicio + "T00:00:00") &&
        dataVenda <= new Date(dataFim + "T23:59:59")
      );
    }

    return true;
  }

  const vendasCalculadas = useMemo<VendaCalculada[]>(() => {
    return vendas.map((v) => {
const vendedor =
  findVendedorByUserId(v.criado_por || v.user_id) ||
  findVendedorByEmail(v.responsavel);

      const comissao = calcularComissaoCongelada({
        valorOrcamento: Number(v.valor_orcamento || 0),
        valorComissaoAtual: v.valor_comissao,
        percentualComissaoAtual: v.percentual_comissao,
        vendedor,
      });

      const lucro =
        Number(v.valor_orcamento || 0) -
        Number(v.custo || 0) -
        Number(comissao.valor_comissao || 0);

      return {
        ...v,
        percentual_comissao_calculado: Number(comissao.percentual_comissao || 0),
        valor_comissao_calculado: Number(comissao.valor_comissao || 0),
        lucro_calculado: lucro,
      };
    });
  }, [vendas, vendedores]);

  const origens = useMemo(() => {
    const lista = Array.from(
      new Set(
        vendasCalculadas.map((v) => (v.origem_lead || "").trim()).filter(Boolean)
      )
    );
    return lista.sort((a, b) => a.localeCompare(b));
  }, [vendasCalculadas]);

  const formasPagamento = useMemo(() => {
    const lista = Array.from(
      new Set(
        vendasCalculadas.map((v) => (v.forma_pagamento || "").trim()).filter(Boolean)
      )
    );
    return lista.sort((a, b) => a.localeCompare(b));
  }, [vendasCalculadas]);

  const vendasFiltradas = useMemo(() => {
    return vendasCalculadas.filter((v) => {
      const termo = busca.toLowerCase();

      const matchBusca =
        (v.cliente || "").toLowerCase().includes(termo) ||
        (v.tipo_servico || "").toLowerCase().includes(termo) ||
        (v.forma_pagamento || "").toLowerCase().includes(termo) ||
        (v.origem_lead || "").toLowerCase().includes(termo) ||
        (v.responsavel || "").toLowerCase().includes(termo) ||
        (v.numero_os || "").toLowerCase().includes(termo);

      if (!matchBusca) return false;

      if (!filtrarPorPeriodo(v.data_fechamento || v.created_at)) return false;

if (
  filtroVendedor !== "all" &&
  (v.criado_por || v.user_id) !== filtroVendedor
) {
  return false;
}

      if (
        filtroOrigem !== "all" &&
        (v.origem_lead || "").trim() !== filtroOrigem
      ) {
        return false;
      }

      if (
        filtroPagamento !== "all" &&
        (v.forma_pagamento || "").trim() !== filtroPagamento
      ) {
        return false;
      }

      return true;
    });
  }, [
    vendasCalculadas,
    busca,
    periodo,
    dataInicio,
    dataFim,
    filtroVendedor,
    filtroOrigem,
    filtroPagamento,
  ]);

  const totalVendas = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.valor_orcamento || 0),
    0
  );

  const totalComissao = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.valor_comissao_calculado || 0),
    0
  );

  const totalCustos = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.custo || 0),
    0
  );

  const lucroTotal = vendasFiltradas.reduce(
    (acc, v) => acc + Number(v.lucro_calculado || 0),
    0
  );

  const ticketMedio =
    vendasFiltradas.length > 0 ? totalVendas / vendasFiltradas.length : 0;

  const progresso = meta > 0 ? (totalVendas / meta) * 100 : 0;

  const melhorOrigem = useMemo(() => {
    const mapa: Record<string, number> = {};

    vendasFiltradas.forEach((v) => {
      const origem = (v.origem_lead || "Sem origem").trim();
      mapa[origem] = (mapa[origem] || 0) + Number(v.valor_orcamento || 0);
    });

    const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "-";
  }, [vendasFiltradas]);

  const vendedorTop = useMemo(() => {
    const mapa: Record<string, number> = {};

    vendasFiltradas.forEach((v) => {
      const nome = (v.responsavel || "Sem responsável").trim();
      mapa[nome] = (mapa[nome] || 0) + Number(v.valor_orcamento || 0);
    });

    const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "-";
  }, [vendasFiltradas]);

  function limparFiltros() {
    setBusca("");
    setPeriodo("30");
    setDataInicio("");
    setDataFim("");
    setFiltroOrigem("all");
    setFiltroPagamento("all");
    setFiltroVendedor(role === "vendedor" ? currentUserId || "all" : "all");
  }

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando vendas...</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_35%),linear-gradient(180deg,#081120_0%,#0b1730_45%,#0f172a_100%)] text-white p-6 md:p-10 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-blue-200">
            💰 Vendas
          </h1>
          <p className="text-blue-100/60 mt-2">
            Acompanhe vendas concluídas, lucro, comissão e desempenho comercial.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-7 gap-5">
        <Card
          titulo="Total Vendas"
          valor={formatarMoeda(totalVendas)}
          subtitulo="Faturamento concluído"
          icon={<DollarSign size={18} />}
          glow="rgba(34,197,94,0.18)"
        />
        <Card
          titulo="Total Comissão"
          valor={formatarMoeda(totalComissao)}
          subtitulo="Comissões acumuladas"
          icon={<BadgeDollarSign size={18} />}
          glow="rgba(168,85,247,0.18)"
        />
        <Card
          titulo="Lucro Total"
          valor={formatarMoeda(lucroTotal)}
          subtitulo="Receita - custo - comissão"
          icon={<TrendingUp size={18} />}
          glow="rgba(6,182,212,0.18)"
        />
        <Card
          titulo="Quantidade"
          valor={String(vendasFiltradas.length)}
          subtitulo="Vendas filtradas"
          icon={<ShoppingCart size={18} />}
          glow="rgba(249,115,22,0.18)"
        />
        <Card
          titulo="Ticket Médio"
          valor={formatarMoeda(ticketMedio)}
          subtitulo="Média por venda"
          icon={<CreditCard size={18} />}
          glow="rgba(59,130,246,0.18)"
        />
        <Card
          titulo="Meta 50k"
          valor={`${progresso.toFixed(1)}%`}
          subtitulo="Progresso da meta"
          icon={<Target size={18} />}
          glow="rgba(250,204,21,0.18)"
        />
        <Card
          titulo="Top Vendedor"
          valor={vendedorTop}
          subtitulo="Maior faturamento no filtro"
          icon={<Users size={18} />}
          glow="rgba(45,212,191,0.18)"
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)]">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Meta comercial</h3>
            <p className="text-sm text-slate-400">
              Melhor origem atual:{" "}
              <span className="text-cyan-400 font-semibold">{melhorOrigem}</span>
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-400">Meta definida</p>
            <p className="text-xl font-bold text-emerald-400">{formatarMoeda(meta)}</p>
          </div>
        </div>

        <div className="w-full h-5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-green-500 transition-all duration-500"
            style={{ width: `${Math.min(progresso, 100)}%` }}
          />
        </div>

        <div className="flex justify-between mt-3 text-sm text-slate-400">
          <span>Realizado: {formatarMoeda(totalVendas)}</span>
          <span>{progresso.toFixed(1)}%</span>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 md:p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)] space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Search size={18} />
          Filtros de vendas
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 flex items-center bg-white/10 border border-white/20 px-4 py-3 rounded-2xl">
            <Search size={18} className="text-blue-200" />
            <input
              type="text"
              placeholder="Buscar cliente, serviço, origem, responsável ou OS..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent outline-none ml-3 w-full text-white placeholder:text-white/40"
            />
          </div>

          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="Hoje" className="bg-[#0f172a]">Hoje</option>
            <option value="7" className="bg-[#0f172a]">Últimos 7 dias</option>
            <option value="30" className="bg-[#0f172a]">Últimos 30 dias</option>
            <option value="Mês" className="bg-[#0f172a]">Este mês</option>
            <option value="Personalizado" className="bg-[#0f172a]">Personalizado</option>
          </select>

          <select
            value={role === "vendedor" ? currentUserId || "all" : filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            disabled={role === "vendedor"}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white disabled:opacity-60"
          >
            {role !== "vendedor" && (
              <option value="all" className="bg-[#0f172a]">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {periodo === "Personalizado" && (
            <>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
              />
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
              />
            </>
          )}

          <select
            value={filtroOrigem}
            onChange={(e) => setFiltroOrigem(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="all" className="bg-[#0f172a]">
              Todas origens
            </option>
            {origens.map((origem) => (
              <option key={origem} value={origem} className="bg-[#0f172a]">
                {origem}
              </option>
            ))}
          </select>

          <select
            value={filtroPagamento}
            onChange={(e) => setFiltroPagamento(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="all" className="bg-[#0f172a]">
              Todas formas
            </option>
            {formasPagamento.map((forma) => (
              <option key={forma} value={forma} className="bg-[#0f172a]">
                {forma}
              </option>
            ))}
          </select>

          <button
            onClick={limparFiltros}
            className="bg-red-600 hover:bg-red-700 rounded-2xl p-3 font-semibold transition"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] shadow-[0_16px_42px_rgba(0,0,0,0.30)]">
        <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-200">
              Lista de Vendas
            </h2>
            <p className="text-sm text-white/50">
              {vendasFiltradas.length} venda(s) encontrada(s)
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left min-w-[1450px]">
            <thead className="bg-white/5 text-blue-200 uppercase text-xs">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Serviço</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Custo</th>
                <th className="p-4">Comissão</th>
                <th className="p-4">% Comissão</th>
                <th className="p-4">Lucro</th>
                <th className="p-4">Pagamento</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Responsável</th>
                <th className="p-4">Data</th>
                <th className="p-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-white/40">
                    Nenhuma venda encontrada
                  </td>
                </tr>
              ) : (
                vendasFiltradas.map((v) => (
                  <tr
                    key={v.id}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="p-4 font-semibold">{v.cliente || "-"}</td>
                    <td className="p-4 text-white/80">{v.tipo_servico || "-"}</td>
                    <td className="p-4 text-cyan-400 font-bold">
                      {formatarMoeda(Number(v.valor_orcamento || 0))}
                    </td>
                    <td className="p-4 text-rose-400">
                      {formatarMoeda(Number(v.custo || 0))}
                    </td>
                    <td className="p-4 text-purple-300 font-semibold">
                      {formatarMoeda(Number(v.valor_comissao_calculado || 0))}
                    </td>
                    <td className="p-4 text-yellow-300 font-semibold">
                      {Number(v.percentual_comissao_calculado || 0).toFixed(1)}%
                    </td>
                    <td className="p-4 text-emerald-400 font-semibold">
                      {formatarMoeda(Number(v.lucro_calculado || 0))}
                    </td>
                    <td className="p-4">{v.forma_pagamento || "-"}</td>
                    <td className="p-4">{v.origem_lead || "-"}</td>
                    <td className="p-4">{v.responsavel || "-"}</td>
                    <td className="p-4">
                      {new Date(v.data_fechamento || v.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedVenda(v)}
                        className="inline-flex items-center gap-2 bg-blue-600 px-3 py-2 rounded-xl hover:bg-blue-700 transition font-medium"
                      >
                        <Eye size={15} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedVenda && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedVenda(null)}
        >
          <div
            className="bg-[#0f172a] border border-white/10 w-full max-w-3xl rounded-3xl shadow-2xl p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedVenda(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-blue-200">
                📄 Detalhes da Venda
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Informações completas da venda concluída.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Info label="Cliente" value={selectedVenda.cliente} />
              <Info label="Telefone" value={selectedVenda.telefone} />
              <Info label="Email" value={selectedVenda.email} />
              <Info label="Serviço" value={selectedVenda.tipo_servico} />
              <Info
                label="Valor"
                value={formatarMoeda(Number(selectedVenda.valor_orcamento || 0))}
              />
              <Info
                label="Custo"
                value={formatarMoeda(Number(selectedVenda.custo || 0))}
              />
              <Info label="Forma Pagamento" value={selectedVenda.forma_pagamento} />
              <Info label="Origem do Lead" value={selectedVenda.origem_lead} />
              <Info label="Responsável" value={selectedVenda.responsavel} />
              <Info
                label="Comissão"
                value={formatarMoeda(Number(selectedVenda.valor_comissao_calculado || 0))}
              />
              <Info
                label="Percentual Comissão"
                value={`${Number(selectedVenda.percentual_comissao_calculado || 0).toFixed(1)}%`}
              />
              <Info
                label="Data"
                value={new Date(selectedVenda.data_fechamento || selectedVenda.created_at).toLocaleDateString("pt-BR")}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Info label="Número OS" value={selectedVenda.numero_os || "-"} />
              <Info label="Temperatura" value={selectedVenda.temperatura || "-"} />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Info
                label="Lucro"
                value={formatarMoeda(Number(selectedVenda.lucro_calculado || 0))}
              />
              <Info
                label="Status"
                value={selectedVenda.status || "-"}
              />
            </div>

            <div className="mt-6 bg-white/5 p-4 rounded-2xl">
              <p className="text-gray-400 text-xs mb-2">Descrição</p>
              <p className="font-medium text-white/90">
                {selectedVenda.descricao || "-"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  titulo,
  valor,
  subtitulo,
  icon,
  glow,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  icon: React.ReactNode;
  glow: string;
}) {
  const isEmailLongo = valor.includes("@") || valor.length > 18;

  return (
    <div
      className="p-5 rounded-2xl border border-[#22314a] hover:scale-[1.02] transition-all duration-200 min-w-0"
      style={{
        background:
          "linear-gradient(135deg, rgba(17,24,39,0.92), rgba(15,23,42,0.96))",
        boxShadow: `0 12px 32px ${glow}`,
      }}
    >
      <div className="flex justify-between gap-3 text-gray-400 text-sm">
        <span className="truncate">{titulo}</span>
        <span className="text-blue-400 shrink-0">{icon}</span>
      </div>

      <div
        className={`mt-4 font-bold text-cyan-400 min-w-0 ${
          isEmailLongo ? "text-lg break-all leading-tight" : "text-3xl"
        }`}
        title={valor}
      >
        {valor}
      </div>

      <div className="mt-2 text-xs text-slate-400 line-clamp-2">{subtitulo}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#1e293b] p-4 rounded-2xl border border-white/5">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className="font-semibold text-white">{value || "-"}</p>
    </div>
  );
}