"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Briefcase,
  DollarSign,
  Flame,
  Layers,
  Search,
  Thermometer,
  TrendingUp,
  Users,
} from "lucide-react";

type CompanyUser = {
  user_id: string;
  email: string;
  role: string;
  status: string;
};

type Servico = {
  id: string;
  user_id: string | null;
  company_id: string;
  cliente: string;
  status: string;
  temperatura?: string | null;
  valor_orcamento?: number | null;
  ativo?: boolean | null;
  created_at?: string | null;
  tipo_servico?: string | null;
};

const TEMPERATURA_LABELS: Record<string, string> = {
  frio: "Frio",
  morno: "Morno",
  quente: "Quente",
};

const TEMPERATURA_COLORS: Record<string, string> = {
  frio: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  morno: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  quente: "bg-red-500/20 text-red-300 border-red-500/40",
};

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  proposta_enviada: "Proposta Enviada",
  aguardando_cliente: "Aguardando Cliente",
  proposta_validada: "Proposta Validada",
  andamento: "Em Andamento",
  concluido: "Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-gray-500/20 text-gray-300 border-gray-500/40",
  proposta_enviada: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  aguardando_cliente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  proposta_validada: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  andamento: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  concluido: "bg-green-500/20 text-green-300 border-green-500/40",
};

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

export default function CarteiraPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>("");
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [vendedores, setVendedores] = useState<CompanyUser[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [vendedorSelecionado, setVendedorSelecionado] = useState<string>("todos");
  const [periodo, setPeriodo] = useState<"hoje" | "7dias" | "30dias" | "mes" | "todos">("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setLoading(false);
      return;
    }

    setMyUserId(user.id);

    const { data: me, error: meError } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (meError || !me?.company_id) {
      setLoading(false);
      return;
    }

    setCompanyId(me.company_id);
    setMyRole(me.role);

    const { data: companyUsers, error: usersError } = await supabase
      .from("company_users")
      .select("user_id, email, role, status")
      .eq("company_id", me.company_id)
      .eq("status", "accepted")
      .eq("role", "vendedor")
      .order("email", { ascending: true });

    if (!usersError) {
      setVendedores((companyUsers as CompanyUser[]) || []);
    }

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", me.company_id)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    // vendedor vê só a própria carteira
    if (me.role === "vendedor") {
      query = query.eq("user_id", user.id);
    }

    const { data: servicosData, error: servicosError } = await query;

    if (!servicosError) {
      setServicos((servicosData as Servico[]) || []);
    }

    setLoading(false);
  }

  const servicosFiltrados = useMemo(() => {
    const now = new Date();

    let lista = [...servicos];

    if (myRole !== "vendedor" && vendedorSelecionado !== "todos") {
      lista = lista.filter((item) => item.user_id === vendedorSelecionado);
    }

    if (periodo !== "todos") {
      lista = lista.filter((item) => {
        if (!item.created_at) return true;

        const date = new Date(item.created_at);

        if (periodo === "hoje") {
          return (
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        }

        if (periodo === "7dias") {
          return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        if (periodo === "30dias") {
          return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        if (periodo === "mes") {
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        }

        return true;
      });
    }

    if (search.trim()) {
      const termo = search.toLowerCase();
      lista = lista.filter(
        (item) =>
          item.cliente?.toLowerCase().includes(termo) ||
          item.tipo_servico?.toLowerCase().includes(termo)
      );
    }

    return lista;
  }, [servicos, vendedorSelecionado, periodo, search, myRole]);

  const metrics = useMemo(() => {
    const total = servicosFiltrados.length;

    const frios = servicosFiltrados.filter(
      (i) => (i.temperatura || "morno") === "frio"
    ).length;

    const mornos = servicosFiltrados.filter(
      (i) => (i.temperatura || "morno") === "morno"
    ).length;

    const quentes = servicosFiltrados.filter(
      (i) => (i.temperatura || "morno") === "quente"
    ).length;

    const carteiraPotencial = servicosFiltrados
      .filter((i) => STATUS_POTENCIAL.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const receitaConfirmada = servicosFiltrados
      .filter((i) => STATUS_CONFIRMADA.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const receitaRealizada = servicosFiltrados
      .filter((i) => STATUS_REALIZADA.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const concluidos = servicosFiltrados.filter(
      (i) => i.status === "concluido"
    ).length;

    const conversao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

    return {
      total,
      frios,
      mornos,
      quentes,
      carteiraPotencial,
      receitaConfirmada,
      receitaRealizada,
      concluidos,
      conversao,
    };
  }, [servicosFiltrados]);

  const resumoPorVendedor = useMemo(() => {
    const baseUsuarios =
      myRole === "vendedor"
        ? vendedores.filter((v) => v.user_id === myUserId)
        : vendedores;

    return baseUsuarios.map((vendedor) => {
      const lista = servicos.filter(
        (item) =>
          item.user_id === vendedor.user_id &&
          item.ativo === true &&
          item.company_id === companyId
      );

      const total = lista.length;
      const frios = lista.filter((i) => (i.temperatura || "morno") === "frio").length;
      const mornos = lista.filter((i) => (i.temperatura || "morno") === "morno").length;
      const quentes = lista.filter((i) => (i.temperatura || "morno") === "quente").length;

      const potencial = lista
        .filter((i) => STATUS_POTENCIAL.includes(i.status))
        .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

      const confirmada = lista
        .filter((i) => STATUS_CONFIRMADA.includes(i.status))
        .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

      const concluidos = lista.filter((i) => i.status === "concluido").length;
      const conversao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

      return {
        vendedor,
        total,
        frios,
        mornos,
        quentes,
        potencial,
        confirmada,
        concluidos,
        conversao,
      };
    });
  }, [vendedores, servicos, companyId, myRole, myUserId]);

  function formatMoney(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] text-white p-10">
        Carregando carteira...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white p-6 md:p-10 space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold text-blue-200">Carteira Comercial</h1>
        <p className="text-blue-100/60">
          Acompanhe a carteira da empresa e filtre a operação por vendedor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-4">
        <div className="flex items-center bg-white/10 border border-white/20 px-5 py-3 rounded-2xl">
          <Search size={18} className="text-blue-200" />
          <input
            placeholder="Buscar cliente ou serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none ml-3 w-full text-white"
          />
        </div>

<select
  value={myRole === "vendedor" ? myUserId || "todos" : vendedorSelecionado}
  onChange={(e) => setVendedorSelecionado(e.target.value)}
  disabled={myRole === "vendedor"}
  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white"
>
  {myRole !== "vendedor" && (
    <option value="todos" className="bg-[#0f172a] text-white">
      Todos os vendedores
    </option>
  )}

  {vendedores.map((vendedor) => (
    <option
      key={vendedor.user_id}
      value={vendedor.user_id}
      className="bg-[#0f172a] text-white"
    >
      {vendedor.email}
    </option>
  ))}
</select>

<select
  value={periodo}
  onChange={(e) => setPeriodo(e.target.value as any)}
  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white"
>
  <option value="todos" className="bg-[#0f172a] text-white">
    Todo período
  </option>
  <option value="hoje" className="bg-[#0f172a] text-white">
    Hoje
  </option>
  <option value="7dias" className="bg-[#0f172a] text-white">
    Últimos 7 dias
  </option>
  <option value="30dias" className="bg-[#0f172a] text-white">
    Últimos 30 dias
  </option>
  <option value="mes" className="bg-[#0f172a] text-white">
    Mês atual
  </option>
</select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Metric icon={<Layers />} title="Total de Leads" value={String(metrics.total)} />
        <Metric icon={<Thermometer />} title="Leads Frios" value={String(metrics.frios)} />
        <Metric icon={<TrendingUp />} title="Leads Mornos" value={String(metrics.mornos)} />
        <Metric icon={<Flame />} title="Leads Quentes" value={String(metrics.quentes)} />
        <Metric icon={<Briefcase />} title="Carteira Potencial" value={formatMoney(metrics.carteiraPotencial)} />
        <Metric icon={<DollarSign />} title="Receita Confirmada" value={formatMoney(metrics.receitaConfirmada)} />
        <Metric icon={<DollarSign />} title="Receita Realizada" value={formatMoney(metrics.receitaRealizada)} />
        <Metric icon={<Users />} title="Conversão" value={`${metrics.conversao}%`} />
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-cyan-400">Resumo por Vendedor</h2>
          <p className="text-sm text-blue-100/60 mt-1">
            Visão consolidada da carteira dos vendedores desta empresa.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-white/5 text-blue-200 uppercase text-xs">
              <tr>
                <th className="p-4">Vendedor</th>
                <th className="p-4">Leads</th>
                <th className="p-4">Frios</th>
                <th className="p-4">Mornos</th>
                <th className="p-4">Quentes</th>
                <th className="p-4">Potencial</th>
                <th className="p-4">Confirmada</th>
                <th className="p-4">Concluídos</th>
                <th className="p-4">Conversão</th>
              </tr>
            </thead>

            <tbody>
              {resumoPorVendedor.map((row) => (
                <tr
                  key={row.vendedor.user_id}
                  className="border-t border-white/5 hover:bg-white/5"
                >
                  <td className="p-4 font-semibold">{row.vendedor.email}</td>
                  <td className="p-4">{row.total}</td>
                  <td className="p-4 text-sky-300 font-semibold">{row.frios}</td>
                  <td className="p-4 text-yellow-300 font-semibold">{row.mornos}</td>
                  <td className="p-4 text-red-300 font-semibold">{row.quentes}</td>
                  <td className="p-4 text-cyan-400 font-bold">{formatMoney(row.potencial)}</td>
                  <td className="p-4 text-emerald-400 font-bold">{formatMoney(row.confirmada)}</td>
                  <td className="p-4">{row.concluidos}</td>
                  <td className="p-4">{row.conversao}%</td>
                </tr>
              ))}

              {resumoPorVendedor.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-blue-100/60">
                    Nenhum vendedor encontrado para esta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-cyan-400">Leads da Carteira</h2>
          <p className="text-sm text-blue-100/60 mt-1">
            Lista detalhada da carteira conforme os filtros selecionados.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <thead className="bg-white/5 text-blue-200 uppercase text-xs">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Vendedor</th>
                <th className="p-4">Temperatura</th>
                <th className="p-4">Status</th>
                <th className="p-4">Serviço</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Data</th>
              </tr>
            </thead>

            <tbody>
              {servicosFiltrados.map((item) => {
                const vendedor = vendedores.find((v) => v.user_id === item.user_id);

                return (
                  <tr
                    key={item.id}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="p-4 font-semibold">{item.cliente}</td>

                    <td className="p-4">
                      {vendedor?.email || "Sem vendedor"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-xl border text-sm font-semibold ${
                          TEMPERATURA_COLORS[item.temperatura || "morno"]
                        }`}
                      >
                        {TEMPERATURA_LABELS[item.temperatura || "morno"]}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-xl border text-sm font-semibold ${
                          STATUS_COLORS[item.status] || "bg-white/10 text-white border-white/20"
                        }`}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>

                    <td className="p-4">{item.tipo_servico || "-"}</td>

                    <td className="p-4 text-green-400 font-bold">
                      {formatMoney(Number(item.valor_orcamento || 0))}
                    </td>

                    <td className="p-4 text-sm text-blue-100/70">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                  </tr>
                );
              })}

              {servicosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-blue-100/60">
                    Nenhum lead encontrado para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, title, value }: any) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-[#1f2937]">
      <div className="flex justify-between text-gray-400 text-sm">
        <span>{title}</span>
        <span className="text-blue-400">{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-bold text-cyan-400">{value}</div>
    </div>
  );
}