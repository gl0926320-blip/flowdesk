"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Search,
  Calendar,
  Eye,
  Users,
  TrendingUp,
  Phone,
  Mail,
  UserSquare2,
} from "lucide-react";

interface Cliente {
  nome: string;
  total_servicos: number;
  total_orcado: number;
  total_custo: number;
  total_lucro: number;
  ultima_compra: string | null;
  telefone: string | null;
  email: string | null;
  tipo_pessoa: string | null;
  responsavel: string | null;
  ativos: number;
  inativos: number;
  margem: number;
  ticket_medio: number;
}

interface Vendedor {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
}

interface Servico {
  cliente: string | null;
  telefone: string | null;
  email: string | null;
  tipo_pessoa: string | null;
  valor_orcamento: number | null;
  custo: number | null;
  valor_comissao: number | null;
  percentual_comissao: number | null;
  created_at: string | null;
  status: string;
  responsavel: string | null;
  ativo: boolean | null;
  user_id: string | null;
  criado_por?: string | null;
  criado_por_email?: string | null;
  company_id: string;
}

export default function ClientesPage() {
  const supabase = createClient();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [filtroPeriodo, setFiltroPeriodo] = useState<
    "Hoje" | "7 Dias" | "30 Dias" | "Personalizado"
  >("Hoje");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const [role, setRole] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState("todos");
  const [filtroAtividade, setFiltroAtividade] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");

  function calcularPeriodo() {
    const agora = new Date();
    let inicio = new Date();
    let fim = new Date();

    if (filtroPeriodo === "Hoje") {
      inicio.setHours(0, 0, 0, 0);
      fim = new Date();
      fim.setHours(23, 59, 59, 999);
    }

    if (filtroPeriodo === "7 Dias") {
      inicio.setDate(agora.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      fim = new Date();
      fim.setHours(23, 59, 59, 999);
    }

    if (filtroPeriodo === "30 Dias") {
      inicio.setDate(agora.getDate() - 30);
      inicio.setHours(0, 0, 0, 0);
      fim = new Date();
      fim.setHours(23, 59, 59, 999);
    }

    if (filtroPeriodo === "Personalizado") {
      if (!dataInicio || !dataFim) {
        return {
          inicio: "1900-01-01",
          fim: "2999-12-31",
        };
      }

      return {
        inicio: new Date(dataInicio + "T00:00:00").toISOString(),
        fim: new Date(dataFim + "T23:59:59").toISOString(),
      };
    }

    return {
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
    };
  }

  function calcularComissaoServico(
    servico: Servico,
    vendedoresLista: Vendedor[]
  ) {
    const valorComissaoServico = Number(servico.valor_comissao || 0);
    if (valorComissaoServico > 0) return valorComissaoServico;

    const percentualServico = Number(servico.percentual_comissao || 0);

const vendedorPorId = vendedoresLista.find(
  (v) =>
    v.user_id &&
    (servico.criado_por || servico.user_id) &&
    v.user_id === (servico.criado_por || servico.user_id)
);

    const vendedorPorEmail = vendedoresLista.find(
      (v) =>
        v.email &&
        servico.responsavel &&
        v.email.toLowerCase() === servico.responsavel.toLowerCase()
    );

    const vendedor = vendedorPorId || vendedorPorEmail;

    const percentualVendedor = Number(vendedor?.comissao_percentual || 0);

    const percentualFinal =
      percentualServico > 0 ? percentualServico : percentualVendedor;

    const valorOrcamento = Number(servico.valor_orcamento || 0);

    if (percentualFinal <= 0 || valorOrcamento <= 0) return 0;

    return (valorOrcamento * percentualFinal) / 100;
  }

  async function fetchClientes() {
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
  .select("user_id, email, role, status, comissao_percentual")
  .eq("company_id", currentCompanyId)
  .eq("status", "ativo")
  .order("email", { ascending: true });

    const vendedoresLista = (equipe as Vendedor[]) || [];
    setVendedores(vendedoresLista);

    let query = supabase
      .from("servicos")
.select(`
  cliente,
  telefone,
  email,
  tipo_pessoa,
  valor_orcamento,
  custo,
  valor_comissao,
  percentual_comissao,
  created_at,
  status,
  responsavel,
  ativo,
  user_id,
  criado_por,
  criado_por_email,
  company_id
`)
      .eq("company_id", currentCompanyId)
      .eq("status", "concluido");

if (currentRole === "vendedor") {
  query = query.eq("criado_por", user.id);
}

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const { inicio, fim } = calcularPeriodo();

    let dataFiltrada =
      (data as Servico[] | null)?.filter((servico) => {
        if (!servico.created_at) return false;

        const d = new Date(servico.created_at);
        const dataInicioObj = new Date(inicio);
        const dataFimObj = new Date(fim);

        return d >= dataInicioObj && d <= dataFimObj;
      }) || [];

if (currentRole !== "vendedor" && filtroVendedor !== "todos") {
  dataFiltrada = dataFiltrada.filter(
    (servico) => (servico.criado_por || servico.user_id) === filtroVendedor
  );
}

    const agrupado: { [key: string]: Cliente } = {};

    dataFiltrada.forEach((servico) => {
      const nomeCliente = (servico.cliente || "Sem nome").trim().toLowerCase();

      if (!agrupado[nomeCliente]) {
        agrupado[nomeCliente] = {
          nome: servico.cliente || "Sem nome",
          total_servicos: 0,
          total_orcado: 0,
          total_custo: 0,
          total_lucro: 0,
          ultima_compra: servico.created_at || null,
          telefone: servico.telefone || null,
          email: servico.email || null,
          tipo_pessoa: servico.tipo_pessoa || null,
          responsavel: servico.responsavel || null,
          ativos: 0,
          inativos: 0,
          margem: 0,
          ticket_medio: 0,
        };
      }

      const valor = Number(servico.valor_orcamento) || 0;
      const custo = Number(servico.custo) || 0;
      const comissao = calcularComissaoServico(servico, vendedoresLista);

      agrupado[nomeCliente].total_servicos += 1;
      agrupado[nomeCliente].total_orcado += valor;
      agrupado[nomeCliente].total_custo += custo + comissao;
      agrupado[nomeCliente].total_lucro += valor - custo - comissao;

      if (servico.ativo === false) {
        agrupado[nomeCliente].inativos += 1;
      } else {
        agrupado[nomeCliente].ativos += 1;
      }

      if (
        servico.created_at &&
        (!agrupado[nomeCliente].ultima_compra ||
          new Date(servico.created_at) >
            new Date(agrupado[nomeCliente].ultima_compra as string))
      ) {
        agrupado[nomeCliente].ultima_compra = servico.created_at;
      }
    });

    const lista = Object.values(agrupado).map((cliente) => {
      const margem =
        cliente.total_orcado > 0
          ? (cliente.total_lucro / cliente.total_orcado) * 100
          : 0;

      const ticket_medio =
        cliente.total_servicos > 0
          ? cliente.total_orcado / cliente.total_servicos
          : 0;

      return {
        ...cliente,
        margem,
        ticket_medio,
      };
    });

    lista.sort((a, b) => b.total_orcado - a.total_orcado);

    setClientes(lista);
    setLoading(false);
  }

  useEffect(() => {
    fetchClientes();
  }, [filtroPeriodo, dataInicio, dataFim, filtroVendedor]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const termo = busca.toLowerCase();

      const bateBusca =
        c.nome.toLowerCase().includes(termo) ||
        (c.email || "").toLowerCase().includes(termo) ||
        (c.telefone || "").toLowerCase().includes(termo) ||
        (c.responsavel || "").toLowerCase().includes(termo);

      if (!bateBusca) return false;

      if (filtroAtividade === "ativos" && c.ativos <= 0) return false;
      if (filtroAtividade === "inativos" && c.inativos <= 0) return false;

      return true;
    });
  }, [clientes, busca, filtroAtividade]);

  const totalClientes = clientesFiltrados.length;
  const receitaTotal = clientesFiltrados.reduce(
    (acc, c) => acc + c.total_orcado,
    0
  );
  const custoTotal = clientesFiltrados.reduce(
    (acc, c) => acc + c.total_custo,
    0
  );
  const lucroTotal = receitaTotal - custoTotal;

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_35%),linear-gradient(180deg,#081120_0%,#0b1730_45%,#0f172a_100%)] p-6 md:p-10 text-white space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-blue-200">
          👥 Clientes
        </h1>
        <p className="text-white/50 mt-2">
          Carteira de clientes com visão financeira e comercial.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ResumoItem
          label="Total Clientes"
          value={String(totalClientes)}
          color="text-cyan-400"
        />
        <ResumoItem
          label="Receita Gerada"
          value={formatarMoeda(receitaTotal)}
          color="text-blue-400"
        />
        <ResumoItem
          label="Lucro Total"
          value={formatarMoeda(lucroTotal)}
          color="text-green-400"
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 md:p-6 shadow-[0_16px_42px_rgba(0,0,0,0.30)] space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Search size={18} />
          Filtros de clientes
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 flex items-center bg-white/10 border border-white/20 px-4 py-3 rounded-2xl">
            <Search size={18} className="text-blue-200" />
            <input
              type="text"
              placeholder="Buscar cliente, e-mail, telefone ou responsável..."
              className="bg-transparent outline-none ml-3 w-full text-white placeholder:text-white/40"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <select
            value={role === "vendedor" ? currentUserId || "todos" : filtroVendedor}
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

          <select
            value={filtroAtividade}
            onChange={(e) =>
              setFiltroAtividade(e.target.value as "todos" | "ativos" | "inativos")
            }
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="todos" className="bg-[#0f172a]">
              Todos clientes
            </option>
            <option value="ativos" className="bg-[#0f172a]">
              Clientes com itens ativos
            </option>
            <option value="inativos" className="bg-[#0f172a]">
              Clientes com itens inativos
            </option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroPeriodo("Hoje")}
            className={`px-4 py-2 rounded-xl ${
              filtroPeriodo === "Hoje"
                ? "bg-purple-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Hoje
          </button>

          <button
            onClick={() => setFiltroPeriodo("7 Dias")}
            className={`px-4 py-2 rounded-xl ${
              filtroPeriodo === "7 Dias"
                ? "bg-purple-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            7 dias
          </button>

          <button
            onClick={() => setFiltroPeriodo("30 Dias")}
            className={`px-4 py-2 rounded-xl ${
              filtroPeriodo === "30 Dias"
                ? "bg-purple-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            30 dias
          </button>

          <button
            onClick={() => setFiltroPeriodo("Personalizado")}
            className={`px-4 py-2 rounded-xl ${
              filtroPeriodo === "Personalizado"
                ? "bg-purple-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Personalizado
          </button>
        </div>

        {filtroPeriodo === "Personalizado" && (
          <div className="flex flex-wrap gap-4">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-white/10 border border-white/20 p-3 rounded-xl text-white"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-white/10 border border-white/20 p-3 rounded-xl text-white"
            />
          </div>
        )}
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#111827] to-[#0f172a] shadow-[0_16px_42px_rgba(0,0,0,0.30)]">
        <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-200">
              Carteira de Clientes
            </h2>
            <p className="text-sm text-white/50">
              {clientesFiltrados.length} cliente(s) encontrado(s)
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-white/5 text-blue-200 uppercase text-xs">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Responsável</th>
                <th className="p-4 text-center">Serviços</th>
                <th className="p-4 text-center">Ativos</th>
                <th className="p-4 text-center">Inativos</th>
                <th className="p-4 text-right">Receita</th>
                <th className="p-4 text-right">Lucro</th>
                <th className="p-4 text-right">Margem</th>
                <th className="p-4 text-right">Ticket Médio</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-white/50">
                    Carregando clientes...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-white/40">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente, index) => (
                  <tr
                    key={index}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="p-4 font-semibold text-white">
                      {cliente.nome}
                    </td>

                    <td className="p-4 text-white/70">
                      {cliente.responsavel || "-"}
                    </td>

                    <td className="p-4 text-center">{cliente.total_servicos}</td>

                    <td className="p-4 text-center text-green-400 font-semibold">
                      {cliente.ativos}
                    </td>

                    <td className="p-4 text-center text-red-400 font-semibold">
                      {cliente.inativos}
                    </td>

                    <td className="p-4 text-right text-blue-400 font-medium">
                      {formatarMoeda(cliente.total_orcado)}
                    </td>

                    <td className="p-4 text-right text-green-400 font-semibold">
                      {formatarMoeda(cliente.total_lucro)}
                    </td>

                    <td className="p-4 text-right">
                      {cliente.margem.toFixed(1)}%
                    </td>

                    <td className="p-4 text-right text-cyan-400">
                      {formatarMoeda(cliente.ticket_medio)}
                    </td>

                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedCliente(cliente)}
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

      {selectedCliente && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCliente(null)}
        >
          <div
            className="bg-[#0f172a] border border-white/10 w-full max-w-3xl rounded-3xl shadow-2xl p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedCliente(null)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-blue-200">
                📄 Detalhes do Cliente
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Visão consolidada da carteira do cliente.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Info
                label="Nome"
                value={selectedCliente.nome}
                icon={<Users size={16} />}
              />
              <Info
                label="Tipo Pessoa"
                value={selectedCliente.tipo_pessoa}
                icon={<UserSquare2 size={16} />}
              />
              <Info
                label="Responsável"
                value={selectedCliente.responsavel}
                icon={<TrendingUp size={16} />}
              />
              <Info
                label="Telefone"
                value={selectedCliente.telefone}
                icon={<Phone size={16} />}
              />
              <Info
                label="Email"
                value={selectedCliente.email}
                icon={<Mail size={16} />}
              />
              <Info
                label="Última Compra"
                value={
                  selectedCliente.ultima_compra
                    ? new Date(selectedCliente.ultima_compra).toLocaleDateString(
                        "pt-BR"
                      )
                    : "-"
                }
                icon={<Calendar size={16} />}
              />
              <Info
                label="Total Serviços"
                value={selectedCliente.total_servicos}
              />
              <Info label="Ativos" value={selectedCliente.ativos} />
              <Info label="Inativos" value={selectedCliente.inativos} />
              <Info
                label="Receita"
                value={formatarMoeda(selectedCliente.total_orcado)}
              />
              <Info
                label="Lucro"
                value={formatarMoeda(selectedCliente.total_lucro)}
              />
              <Info
                label="Margem"
                value={`${selectedCliente.margem.toFixed(1)}%`}
              />
              <Info
                label="Ticket Médio"
                value={formatarMoeda(selectedCliente.ticket_medio)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumoItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
  icon,
}: {
  label: string;
  value: any;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1e293b] p-4 rounded-2xl border border-white/5">
      <p className="text-gray-400 text-xs mb-2 flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="font-semibold text-white">{value || "-"}</p>
    </div>
  );
}