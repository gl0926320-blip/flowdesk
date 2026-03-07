"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Search,
  TrendingUp,
  DollarSign,
  Layers,
  X,
  Users,
  Thermometer,
  ClipboardList,
  Filter,
} from "lucide-react";

const STATUS_COLUMNS = [
  "lead",
  "proposta_enviada",
  "aguardando_cliente",
  "proposta_validada",
  "andamento",
  "concluido",
] as const;

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

const TEMPERATURA_OPTIONS = ["frio", "morno", "quente"] as const;

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

const OPTION_STYLE = {
  color: "#111827",
  backgroundColor: "#ffffff",
};

type TeamMember = {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
  meta_leads?: number | null;
  meta_vendas?: number | null;
  meta_receita?: number | null;
};

export default function LeadsPage() {
  const supabase = createClient();

  const [items, setItems] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItens, setEditingItens] = useState<any[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [periodo, setPeriodo] = useState<"hoje" | "7dias" | "30dias" | "mes" | "todos">("hoje");
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);

  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [filtroTemperatura, setFiltroTemperatura] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [form, setForm] = useState({
    cliente: "",
    origem_lead: "",
    telefone: "",
    responsavel: "",
    descricao: "",
    tipo_pessoa: "pf",
    cpf: "",
    cnpj: "",
    forma_pagamento: "",
    entrega: false,
    tipo_servico: "",
    observacoes: "",
    temperatura: "morno",
  });

  const [itens, setItens] = useState<any[]>([{ nome: "", quantidade: 1, valor: 0 }]);

  useEffect(() => {
    load();
  }, [filtroAtivo]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-area, #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
          color: black;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  function findTeamMemberByUserId(userId?: string | null) {
    if (!userId) return null;
    return teamMembers.find((m) => m.user_id === userId) || null;
  }

  function findTeamMemberByEmail(email?: string | null) {
    if (!email) return null;
    return (
      teamMembers.find(
        (m) => (m.email || "").toLowerCase() === email.toLowerCase()
      ) || null
    );
  }

function findTeamMemberByLead(lead: any) {
  return (
    findTeamMemberByUserId(lead?.criado_por || lead?.user_id) ||
    findTeamMemberByEmail(lead?.responsavel) ||
    null
  );
}

  function calcularComissaoCongelada(params: {
  valorOrcamento: number;
  member?: TeamMember | null;
}) {
  const valorOrcamento = Number(params.valorOrcamento || 0);

  const percentualDoVendedor =
    params.member?.comissao_percentual != null
      ? Number(params.member.comissao_percentual)
      : null;

  if (percentualDoVendedor == null || percentualDoVendedor <= 0) {
    return {
      percentual_comissao: null,
      valor_comissao: null,
    };
  }

  const valorFinal =
    valorOrcamento > 0 ? (valorOrcamento * percentualDoVendedor) / 100 : 0;

  return {
    percentual_comissao: percentualDoVendedor,
    valor_comissao: valorFinal,
  };
}

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const userId = userData.user.id;
    setMyUserId(userId);

const { data: companyUsers, error: companyUserError } = await supabase
  .from("company_users")
  .select("company_id, role")
  .eq("user_id", userId)
  .eq("status", "ativo");

if (companyUserError) {
  console.error("Erro ao buscar vínculo:", companyUserError);
  return;
}

const companyUser = companyUsers?.[0];
if (!companyUser) return;

    if (!companyUser) return;

    const currentCompanyId = companyUser.company_id;
    const currentRole = companyUser.role;

    setCompanyId(currentCompanyId);
    setMyRole(currentRole);

    if (currentRole === "vendedor") {
      setFiltroResponsavel(userId);
    }

const { data: equipe } = await supabase
  .from("company_users")
  .select(
    "user_id, email, role, status, comissao_percentual, meta_leads, meta_vendas, meta_receita"
  )
  .eq("company_id", currentCompanyId)
  .eq("status", "ativo")
  .order("email", { ascending: true });

    setTeamMembers((equipe as TeamMember[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", currentCompanyId);

if (currentRole === "vendedor") {
  query = query.eq("criado_por", userId);
}

    if (filtroAtivo === "ativos") {
      query = query.eq("ativo", true);
    }

    if (filtroAtivo === "inativos") {
      query = query.eq("ativo", false);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

async function atualizarStatus(id: string, status: string) {
  const lead = items.find((i) => i.id === id);
  if (!lead) return;

  const updateData: any = { status };

  if (status === "concluido") {
    const member = findTeamMemberByLead(lead);
const comissaoCongelada = calcularComissaoCongelada({
  valorOrcamento: Number(lead.valor_orcamento || 0),
  member,
});
    updateData.ultima_compra = new Date().toISOString();
    updateData.data_fechamento =
      lead.data_fechamento || new Date().toISOString();
updateData.percentual_comissao = comissaoCongelada.percentual_comissao;
updateData.valor_comissao = comissaoCongelada.valor_comissao;
  }

  const { error } = await supabase
    .from("servicos")
    .update(updateData)
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    console.error("Erro ao atualizar status:", error);
    alert("Erro ao atualizar status: " + error.message);
    return;
  }

  load();
}

  async function atualizarTemperatura(id: string, temperatura: string) {
    await supabase
      .from("servicos")
      .update({ temperatura })
      .eq("id", id)
      .eq("company_id", companyId);

    load();
  }

  function adicionarItem() {
    setItens([...itens, { nome: "", quantidade: 1, valor: 0 }]);
  }

  function atualizarItem(index: number, campo: string, valor: any) {
    const novos = [...itens];
    novos[index][campo] = valor;
    setItens(novos);
  }

  const totalOrcamento = itens.reduce(
    (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valor || 0),
    0
  );

async function salvarNovoLead(e: any) {
  e.preventDefault();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    alert("Usuário não autenticado");
    return;
  }

  const currentUser = userData.user;
  const currentUserId = currentUser.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", currentUserId)
    .maybeSingle();

  if (profileError) {
    console.error("Erro ao verificar plano:", profileError);
    alert("Erro ao verificar plano");
    return;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("company_users")
    .select("company_id, role, status, email")
    .eq("user_id", currentUserId)
    .eq("status", "ativo");

  if (membershipError) {
    console.error("Erro ao buscar vínculo da empresa:", membershipError);
    alert("Erro ao buscar empresa do usuário");
    return;
  }

  const membership = memberships?.[0];
  if (!membership?.company_id) {
    alert("Usuário sem empresa vinculada");
    return;
  }

  const currentCompanyId = membership.company_id;
  const currentRole = membership.role;
  const plan = profile?.plan ?? "free";
  const LIMITE_FREE = 5;

  if (plan === "free") {
    const { count, error: erroCount } = await supabase
      .from("servicos")
      .select("*", { count: "exact", head: true })
      .eq("company_id", currentCompanyId)
      .eq("criado_por", currentUserId)
      .eq("ativo", true);

    if (erroCount) {
      console.error("Erro ao verificar limite:", erroCount);
      alert("Erro ao verificar limite");
      return;
    }

    if ((count ?? 0) >= LIMITE_FREE) {
      setOpenModal(false);
      setShowUpgrade(true);
      return;
    }
  }

  const responsavelSelecionado =
    currentRole === "vendedor"
      ? currentUser.email || ""
      : form.responsavel;

  const responsavelMembro =
    currentRole === "vendedor"
      ? findTeamMemberByUserId(currentUserId)
      : findTeamMemberByEmail(responsavelSelecionado);

  const responsavelUserId =
    currentRole === "vendedor"
      ? currentUserId
      : responsavelMembro?.user_id || null;

  const payload = {
    company_id: currentCompanyId,
    user_id: responsavelUserId,
    criado_por: currentUserId,
    criado_por_email: currentUser.email || "",
    titulo: form.cliente,
    descricao: form.descricao,
    status: "lead",
    cliente: form.cliente,
    origem_lead: form.origem_lead,
    telefone: form.telefone,
    responsavel: responsavelSelecionado,
    valor_orcamento: totalOrcamento,
    itens,
    tipo_pessoa: form.tipo_pessoa,
    cpf: form.cpf,
    cnpj: form.cnpj,
    forma_pagamento: form.forma_pagamento,
    entrega: form.entrega,
    tipo_servico: form.tipo_servico,
    observacoes: form.observacoes,
    temperatura: form.temperatura,
    ativo: true,
  };

  const { error } = await supabase.from("servicos").insert([payload]);

  if (error) {
    console.error("Erro ao salvar lead:", error);
    alert(error.message || "Erro ao salvar");
    return;
  }

  setOpenModal(false);
  setForm({
    cliente: "",
    origem_lead: "",
    telefone: "",
    responsavel: "",
    descricao: "",
    tipo_pessoa: "pf",
    cpf: "",
    cnpj: "",
    forma_pagamento: "",
    entrega: false,
    tipo_servico: "",
    observacoes: "",
    temperatura: "morno",
  });
  setItens([{ nome: "", quantidade: 1, valor: 0 }]);
  load();
}
  const filtered = useMemo(() => {
    const now = new Date();

    let base = items.filter((item) => {
      if (!item.created_at) return true;

      const date = new Date(item.created_at);

      if (dataSelecionada) {
        const selecionada = new Date(dataSelecionada + "T00:00:00");
        return (
          date.getDate() === selecionada.getDate() &&
          date.getMonth() === selecionada.getMonth() &&
          date.getFullYear() === selecionada.getFullYear()
        );
      }

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

    if (search.trim()) {
      const termo = search.toLowerCase();
      base = base.filter((i) =>
        i.cliente?.toLowerCase().includes(termo) ||
        i.origem_lead?.toLowerCase().includes(termo) ||
        i.telefone?.toLowerCase().includes(termo) ||
        i.responsavel?.toLowerCase().includes(termo) ||
        i.tipo_servico?.toLowerCase().includes(termo)
      );
    }

if (filtroResponsavel !== "todos") {
  base = base.filter(
    (i) => (i.criado_por || i.user_id) === filtroResponsavel
  );
}

    if (filtroTemperatura !== "todos") {
      base = base.filter((i) => (i.temperatura || "morno") === filtroTemperatura);
    }

    if (filtroStatus !== "todos") {
      base = base.filter((i) => i.status === filtroStatus);
    }

    return base;
  }, [items, search, periodo, dataSelecionada, filtroResponsavel, filtroTemperatura, filtroStatus]);

  function contarCompras(cliente: string) {
    return items.filter(
      (i) => i.cliente === cliente && i.status === "concluido"
    ).length;
  }

  const metrics = useMemo(() => {
    const total = filtered.length;

    const STATUS_POTENCIAL = ["lead", "proposta_enviada", "aguardando_cliente"];
    const STATUS_CONFIRMADA = ["proposta_validada", "andamento"];
    const STATUS_REALIZADA = ["concluido"];

    const receitaPotencial = filtered
      .filter((i) => STATUS_POTENCIAL.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const receitaConfirmada = filtered
      .filter((i) => STATUS_CONFIRMADA.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const receitaReal = filtered
      .filter((i) => STATUS_REALIZADA.includes(i.status))
      .reduce((acc, i) => acc + Number(i.valor_orcamento || 0), 0);

    const concluidos = filtered.filter((i) =>
      STATUS_REALIZADA.includes(i.status)
    ).length;

    return {
      total,
      receitaReal: receitaReal.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      receitaPotencial: receitaPotencial.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      receitaConfirmada: receitaConfirmada.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      concluidos,
      conversao: total > 0 ? `${Math.round((concluidos / total) * 100)}%` : "0%",
    };
  }, [filtered]);

  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};

    STATUS_COLUMNS.forEach((status) => {
      counts[status] = filtered.filter((i) => i.status === status).length;
    });

    const totalLeads = filtered.length;

    return STATUS_COLUMNS.map((status) => {
      const value = counts[status];
      const percentage = totalLeads > 0 ? Math.round((value / totalLeads) * 100) : 0;

      return {
        status,
        label: STATUS_LABELS[status],
        value,
        percentage,
      };
    });
  }, [filtered]);

  function EditableField({ label, value, field }: any) {
    return (
      <div className="bg-white/5 p-4 rounded-xl">
        <p className="text-gray-400 text-xs">{label}</p>

        {isEditing ? (
          <input
            value={value || ""}
            onChange={(e) =>
              setSelectedLead({
                ...selectedLead,
                [field]: e.target.value,
              })
            }
            className="bg-white/10 p-2 rounded-lg w-full"
          />
        ) : (
          <p className="font-semibold">{value || "-"}</p>
        )}
      </div>
    );
  }

  function atualizarItemEditado(index: number, campo: string, valor: any) {
    const novos = [...editingItens];
    novos[index][campo] = valor;
    setEditingItens(novos);
  }

  function removerItemEditado(index: number) {
    const novos = editingItens.filter((_: any, i: number) => i !== index);
    setEditingItens(novos);
  }

  function adicionarItemEditado() {
    setEditingItens([
      ...editingItens,
      { nome: "", quantidade: 1, valor: 0 },
    ]);
  }

  async function salvarLeadEditado() {
    if (!selectedLead) return;

    const novoTotal = editingItens.reduce(
      (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valor || 0),
      0
    );

    const responsavelMember = findTeamMemberByEmail(selectedLead.responsavel);
    const userIdResponsavel = responsavelMember?.user_id || selectedLead.user_id || null;

    const updatePayload: any = {
      ...selectedLead,
      user_id: userIdResponsavel,
      itens: editingItens,
      valor_orcamento: novoTotal,
    };

if (selectedLead.status === "concluido") {
  const comissaoCongelada = calcularComissaoCongelada({
    valorOrcamento: novoTotal,
    member: responsavelMember,
  });

  updatePayload.percentual_comissao = comissaoCongelada.percentual_comissao;
  updatePayload.valor_comissao = comissaoCongelada.valor_comissao;
  updatePayload.data_fechamento =
    selectedLead.data_fechamento || new Date().toISOString();
  updatePayload.ultima_compra =
    selectedLead.ultima_compra || new Date().toISOString();
}

    await supabase
      .from("servicos")
      .update(updatePayload)
      .eq("id", selectedLead.id)
      .eq("company_id", companyId);

    setIsEditing(false);
    load();
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white p-12 space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-blue-200">Gestão de Leads</h1>
          <p className="text-blue-100/60 mt-2">CRM Comercial Profissional</p>
        </div>

        <button
          onClick={() => setOpenModal(true)}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-bold shadow-lg hover:scale-105 transition"
        >
          + Novo Orçamento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
        <Metric icon={<Layers />} title="Total Leads" value={metrics.total} />
        <Metric icon={<DollarSign />} title="Receita Realizada" value={metrics.receitaReal} />
        <Metric icon={<DollarSign />} title="Receita Potencial" value={metrics.receitaPotencial} />
        <Metric icon={<DollarSign />} title="Receita Confirmada" value={metrics.receitaConfirmada} />
        <Metric icon={<TrendingUp />} title="Concluídos" value={metrics.concluidos} />
        <Metric icon={<TrendingUp />} title="Taxa Conversão" value={metrics.conversao} />
      </div>

      <div className="w-full bg-[#0f172a] border border-white/10 rounded-3xl p-8 mt-8">
        <h3 className="text-lg font-bold text-cyan-400 mb-6">Funil de Conversão</h3>

        <div className="space-y-4">
          {funnelData.map((step) => (
            <div key={step.status}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">
                  {step.label} ({step.value})
                </span>
                <span className="text-cyan-400 font-semibold">
                  {step.percentage}%
                </span>
              </div>

              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-blue-500 to-cyan-400"
                  style={{ width: `${step.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Filter size={18} />
          <span>Filtros</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="flex items-center bg-white/10 border border-white/20 px-5 py-3 rounded-2xl">
            <Search size={18} className="text-blue-200" />
            <input
              placeholder="Buscar cliente, origem, telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none ml-3 w-full text-white"
            />
          </div>

          <div className="relative">
            <Users
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none"
            />
            <select
              value={myRole === "vendedor" ? myUserId || "todos" : filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              disabled={myRole === "vendedor"}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white outline-none appearance-none"
            >
              {myRole !== "vendedor" && (
                <option value="todos" style={OPTION_STYLE}>
                  Todos os vendedores
                </option>
              )}

              {teamMembers
                .filter((member) => member.user_id && member.status === "ativo")
                .map((member) => (
                  <option
                    key={member.user_id || member.email}
                    value={member.user_id || ""}
                    style={OPTION_STYLE}
                  >
                    {member.email}
                  </option>
                ))}
            </select>
          </div>

          <div className="relative">
            <Thermometer
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none"
            />
            <select
              value={filtroTemperatura}
              onChange={(e) => setFiltroTemperatura(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white outline-none appearance-none"
            >
              <option value="todos" style={OPTION_STYLE}>
                Todas temperaturas
              </option>
              <option value="frio" style={OPTION_STYLE}>
                Frio
              </option>
              <option value="morno" style={OPTION_STYLE}>
                Morno
              </option>
              <option value="quente" style={OPTION_STYLE}>
                Quente
              </option>
            </select>
          </div>

          <div className="relative">
            <ClipboardList
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white outline-none appearance-none"
            >
              <option value="todos" style={OPTION_STYLE}>
                Todos status
              </option>

              {STATUS_COLUMNS.map((status) => (
                <option key={status} value={status} style={OPTION_STYLE}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-2 flex-wrap">
          {[
            { id: "hoje", label: "Hoje" },
            { id: "7dias", label: "7 dias" },
            { id: "30dias", label: "30 dias" },
            { id: "mes", label: "Mês atual" },
            { id: "todos", label: "Todos" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id as any)}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                periodo === p.id
                  ? "bg-cyan-500 text-black font-semibold"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <input
            type="date"
            value={dataSelecionada || ""}
            onChange={(e) => {
              setDataSelecionada(e.target.value);
              setPeriodo("todos");
            }}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20"
          />

          {dataSelecionada && (
            <button
              onClick={() => setDataSelecionada(null)}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm"
            >
              Limpar Data
            </button>
          )}
        </div>

        <div className="flex gap-3 mt-1 flex-wrap">
          <button
            onClick={() => setFiltroAtivo("ativos")}
            className={`px-4 py-2 rounded-xl ${
              filtroAtivo === "ativos"
                ? "bg-blue-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Ativos
          </button>

          <button
            onClick={() => setFiltroAtivo("inativos")}
            className={`px-4 py-2 rounded-xl ${
              filtroAtivo === "inativos"
                ? "bg-blue-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Inativos
          </button>

          <button
            onClick={() => setFiltroAtivo("todos")}
            className={`px-4 py-2 rounded-xl ${
              filtroAtivo === "todos"
                ? "bg-blue-600"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-blue-200 uppercase text-xs">
            <tr>
              <th className="p-4">Cliente</th>
              <th className="p-4">Responsável</th>
              <th className="p-4">Origem</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Documento</th>
              <th className="p-4">Serviço</th>
              <th className="p-4">Pagamento</th>
              <th className="p-4">Entrega</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Sem Comprar</th>
              <th className="p-4">Temperatura</th>
              <th className="p-4">Status</th>
              <th className="p-4">Compras</th>
              <th className="p-4 text-center">Ativo</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                onClick={() => {
                  setSelectedLead(item);
                  setEditingItens(item.itens || []);
                }}
                className="border-t border-white/5 cursor-pointer hover:bg-white/5"
              >
                <td className="p-4 font-semibold">{item.cliente}</td>
                <td className="p-4 text-cyan-400">{item.responsavel || "-"}</td>
                <td className="p-4">{item.origem_lead || "-"}</td>
                <td className="p-4">
                  {item.tipo_pessoa === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                </td>
                <td className="p-4 text-xs">
                  {item.tipo_pessoa === "pf" ? item.cpf || "-" : item.cnpj || "-"}
                </td>
                <td className="p-4">{item.tipo_servico || "-"}</td>
                <td className="p-4">{item.forma_pagamento || "-"}</td>
                <td className="p-4">{item.entrega ? "Sim" : "Não"}</td>
                <td className="p-4 text-green-400 font-bold">
                  {Number(item.valor_orcamento || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>
                <td className="p-4 text-xs">
                  {item.ultima_compra ? (
                    (() => {
                      const diasBruto =
                        (Date.now() - new Date(item.ultima_compra).getTime()) /
                        (1000 * 60 * 60 * 24);

                      const dias = Math.max(0, Math.floor(diasBruto));

                      return (
                        <span
                          className={
                            dias > 60
                              ? "text-red-400 font-bold"
                              : "text-yellow-300"
                          }
                        >
                          {dias === 1 ? "Há 1 dia" : `Há ${dias} dias`}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-yellow-300">Nunca comprou</span>
                  )}
                </td>

                <td className="p-4">
                  <select
                    value={item.temperatura || "morno"}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => atualizarTemperatura(item.id, e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                      TEMPERATURA_COLORS[item.temperatura || "morno"]
                    }`}
                  >
                    {TEMPERATURA_OPTIONS.map((temp) => (
                      <option key={temp} value={temp} className="bg-[#0f172a]">
                        {TEMPERATURA_LABELS[temp]}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  <select
                    value={item.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => atualizarStatus(item.id, e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-sm font-semibold ${STATUS_COLORS[item.status]}`}
                  >
                    {STATUS_COLUMNS.map((col) => (
                      <option key={col} value={col} className="bg-[#0f172a]">
                        {STATUS_LABELS[col]}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4 text-cyan-400 font-bold">
                  {contarCompras(item.cliente)}x
                </td>

                <td className="p-4 text-center">
                  <span
                    title={item.ativo ? "Lead Ativo" : "Lead Inativo"}
                    className={`inline-block w-3 h-3 rounded-full ${
                      item.ativo ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#0f172a] p-8 rounded-3xl w-[900px] relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setOpenModal(false)}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold mb-6">Novo Orçamento Completo</h2>

            <form onSubmit={salvarNovoLead} className="space-y-4">
              <input
                required
                placeholder="Cliente"
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input
                placeholder="Origem do Lead"
                value={form.origem_lead}
                onChange={(e) => setForm({ ...form, origem_lead: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

<select
  value={form.temperatura}
  onChange={(e) => setForm({ ...form, temperatura: e.target.value })}
  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
>
  <option value="frio" style={OPTION_STYLE}>
    Lead Frio
  </option>
  <option value="morno" style={OPTION_STYLE}>
    Lead Morno
  </option>
  <option value="quente" style={OPTION_STYLE}>
    Lead Quente
  </option>
</select>

              <input
                placeholder="Telefone"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input
                placeholder="Responsável"
                value={
                  myRole === "vendedor"
                    ? teamMembers.find((m) => m.user_id === myUserId)?.email || form.responsavel
                    : form.responsavel
                }
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                disabled={myRole === "vendedor"}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

<select
  value={form.tipo_pessoa}
  onChange={(e) => setForm({ ...form, tipo_pessoa: e.target.value })}
  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
>
  <option value="pf" style={OPTION_STYLE}>
    Pessoa Física
  </option>
  <option value="pj" style={OPTION_STYLE}>
    Pessoa Jurídica
  </option>
</select> o

              {form.tipo_pessoa === "pf" ? (
                <input
                  placeholder="CPF"
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
                />
              ) : (
                <input
                  placeholder="CNPJ"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
                />
              )}

              <input
                placeholder="Tipo de Serviço"
                value={form.tipo_servico}
                onChange={(e) => setForm({ ...form, tipo_servico: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input
                placeholder="Forma de Pagamento"
                value={form.forma_pagamento}
                onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.entrega}
                  onChange={(e) => setForm({ ...form, entrega: e.target.checked })}
                />
                Possui Entrega?
              </label>

              <textarea
                placeholder="Descrição do que o cliente precisa"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <textarea
                placeholder="Observações Comerciais"
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <h3 className="font-bold text-lg pt-4">Itens do Orçamento</h3>

              {itens.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-3">
                  <input
                    placeholder="Item"
                    value={item.nome}
                    onChange={(e) => atualizarItem(index, "nome", e.target.value)}
                    className="p-2 rounded-lg bg-white/10"
                  />
                  <input
                    type="number"
                    placeholder="Qtd"
                    value={item.quantidade}
                    onChange={(e) => atualizarItem(index, "quantidade", Number(e.target.value))}
                    className="p-2 rounded-lg bg-white/10"
                  />
                  <input
                    type="number"
                    placeholder="Valor"
                    value={item.valor}
                    onChange={(e) => atualizarItem(index, "valor", Number(e.target.value))}
                    className="p-2 rounded-lg bg-white/10"
                  />
                </div>
              ))}

              <button type="button" onClick={adicionarItem} className="text-blue-400">
                + Adicionar Item
              </button>

              <div className="text-right text-xl font-bold text-green-400">
                Total:{" "}
                {totalOrcamento.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>

              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 font-bold">
                Salvar Orçamento
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div
            id="print-area"
            className="bg-[#0f172a] p-8 rounded-3xl w-[800px] max-h-[90vh] overflow-y-auto relative"
          >
            <button
              onClick={() => setSelectedLead(null)}
              className="absolute top-4 right-4 text-gray-400"
            >
              <X />
            </button>

            <h2 className="text-2xl font-bold mb-2 text-cyan-400">
              Orçamento Flowdesk - {selectedLead.cliente}
            </h2>

            <p className="text-xs text-gray-400 mb-6">
              Gerado em {new Date(selectedLead.created_at).toLocaleDateString("pt-BR")}
            </p>

            <div className="flex gap-3 mb-6">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-green-600 rounded-xl text-sm font-semibold"
              >
                Exportar PDF
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-blue-600 rounded-xl text-sm font-semibold"
              >
                {isEditing ? "Cancelar" : "Editar"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-gray-400 text-xs">Cliente</p>

                {isEditing ? (
                  <input
                    value={selectedLead.cliente}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, cliente: e.target.value })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  />
                ) : (
                  <p className="font-semibold">{selectedLead.cliente}</p>
                )}
              </div>

              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-gray-400 text-xs">Telefone</p>

                {isEditing ? (
                  <input
                    value={selectedLead.telefone || ""}
                    onChange={(e) =>
                      setSelectedLead({ ...selectedLead, telefone: e.target.value })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  />
                ) : (
                  <p className="font-semibold">{selectedLead.telefone || "-"}</p>
                )}
              </div>

              <EditableField
                label="Origem"
                value={selectedLead.origem_lead}
                field="origem_lead"
              />

              <EditableField
                label="Responsável"
                value={selectedLead.responsavel}
                field="responsavel"
              />

              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-gray-400 text-xs">Temperatura</p>

                {isEditing ? (
                  <select
                    value={selectedLead.temperatura || "morno"}
                    onChange={(e) =>
                      setSelectedLead({
                        ...selectedLead,
                        temperatura: e.target.value,
                      })
                    }
                    className={`p-2 rounded-lg w-full border ${
                      TEMPERATURA_COLORS[selectedLead.temperatura || "morno"]
                    }`}
                  >
                    {TEMPERATURA_OPTIONS.map((temp) => (
                      <option key={temp} value={temp} className="bg-[#0f172a]">
                        {TEMPERATURA_LABELS[temp]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex px-3 py-1 rounded-xl border text-sm font-semibold ${
                      TEMPERATURA_COLORS[selectedLead.temperatura || "morno"]
                    }`}
                  >
                    {TEMPERATURA_LABELS[selectedLead.temperatura || "morno"]}
                  </span>
                )}
              </div>

              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-gray-400 text-xs">Tipo Pessoa</p>

                {isEditing ? (
                  <select
                    value={selectedLead.tipo_pessoa}
                    onChange={(e) =>
                      setSelectedLead({
                        ...selectedLead,
                        tipo_pessoa: e.target.value,
                      })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  >
                    <option value="pf">Pessoa Física</option>
                    <option value="pj">Pessoa Jurídica</option>
                  </select>
                ) : (
                  <p className="font-semibold">
                    {selectedLead.tipo_pessoa === "pf"
                      ? "Pessoa Física"
                      : "Pessoa Jurídica"}
                  </p>
                )}
              </div>

              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-gray-400 text-xs">
                  {selectedLead.tipo_pessoa === "pf" ? "CPF" : "CNPJ"}
                </p>

                {isEditing ? (
                  <input
                    value={
                      selectedLead.tipo_pessoa === "pf"
                        ? selectedLead.cpf || ""
                        : selectedLead.cnpj || ""
                    }
                    onChange={(e) =>
                      setSelectedLead({
                        ...selectedLead,
                        [selectedLead.tipo_pessoa === "pf" ? "cpf" : "cnpj"]:
                          e.target.value,
                      })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  />
                ) : (
                  <p className="font-semibold">
                    {selectedLead.tipo_pessoa === "pf"
                      ? selectedLead.cpf || "-"
                      : selectedLead.cnpj || "-"}
                  </p>
                )}
              </div>

              <EditableField
                label="Tipo de Serviço"
                value={selectedLead.tipo_servico}
                field="tipo_servico"
              />

              <EditableField
                label="Forma de Pagamento"
                value={selectedLead.forma_pagamento}
                field="forma_pagamento"
              />

              <div>
                <strong>Entrega:</strong> {selectedLead.entrega ? "Sim" : "Não"}
              </div>

              <div>
                <strong>Valor Total:</strong>{" "}
                {Number(selectedLead.valor_orcamento || 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>

              <div className="bg-white/5 p-4 rounded-xl col-span-2">
                <p className="text-gray-400 text-xs">Descrição</p>

                {isEditing ? (
                  <textarea
                    value={selectedLead.descricao || ""}
                    onChange={(e) =>
                      setSelectedLead({
                        ...selectedLead,
                        descricao: e.target.value,
                      })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  />
                ) : (
                  <p className="text-gray-300">{selectedLead.descricao || "-"}</p>
                )}
              </div>

              <div className="bg-white/5 p-4 rounded-xl col-span-2">
                <p className="text-gray-400 text-xs">Observações</p>

                {isEditing ? (
                  <textarea
                    value={selectedLead.observacoes || ""}
                    onChange={(e) =>
                      setSelectedLead({
                        ...selectedLead,
                        observacoes: e.target.value,
                      })
                    }
                    className="bg-white/10 p-2 rounded-lg w-full"
                  />
                ) : (
                  <p className="text-gray-300">{selectedLead.observacoes || "-"}</p>
                )}
              </div>

              <div className="col-span-2">
                <strong>Itens:</strong>

                <div className="mt-3 space-y-3">
                  {editingItens.map((i: any, idx: number) => (
                    <div
                      key={idx}
                      className="grid grid-cols-4 gap-3 bg-white/5 p-3 rounded-xl items-center"
                    >
                      {isEditing ? (
                        <>
                          <input
                            value={i.nome}
                            onChange={(e) =>
                              atualizarItemEditado(idx, "nome", e.target.value)
                            }
                            className="p-2 rounded-lg bg-white/10"
                            placeholder="Item"
                          />

                          <input
                            type="number"
                            value={i.quantidade}
                            onChange={(e) =>
                              atualizarItemEditado(
                                idx,
                                "quantidade",
                                Number(e.target.value)
                              )
                            }
                            className="p-2 rounded-lg bg-white/10"
                          />

                          <input
                            type="number"
                            value={i.valor}
                            onChange={(e) =>
                              atualizarItemEditado(
                                idx,
                                "valor",
                                Number(e.target.value)
                              )
                            }
                            className="p-2 rounded-lg bg-white/10"
                          />

                          <button
                            onClick={() => removerItemEditado(idx)}
                            className="text-red-400 font-bold"
                          >
                            Remover
                          </button>
                        </>
                      ) : (
                        <>
                          <span>
                            {i.nome} ({i.quantidade}x)
                          </span>
                          <span className="text-green-400 font-semibold col-span-3 text-right">
                            {(i.quantidade * i.valor).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <button
                    onClick={adicionarItemEditado}
                    className="mt-3 text-blue-400"
                  >
                    + Adicionar Item
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="mt-6 space-y-3 col-span-2">
                  <button
                    onClick={salvarLeadEditado}
                    className="w-full py-3 bg-green-600 rounded-xl font-bold"
                  >
                    Salvar Alterações
                  </button>

                  <button
                    onClick={async () => {
                      await supabase
                        .from("servicos")
                        .update({ ativo: !selectedLead.ativo })
                        .eq("id", selectedLead.id);

                      setSelectedLead(null);
                      load();
                    }}
                    className={`w-full py-3 rounded-xl font-bold ${
                      selectedLead.ativo ? "bg-red-600" : "bg-green-600"
                    }`}
                  >
                    {selectedLead.ativo ? "Inativar Lead" : "Reativar Lead"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpgrade && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-3xl w-[420px] space-y-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white text-center">
            <h3 className="text-xl font-semibold text-blue-200">
              Limite do plano Free atingido 🚀
            </h3>

            <p className="text-blue-100 text-sm">
              Seu plano Free permite até 5 orçamentos.
              Faça upgrade para desbloquear orçamentos ilimitados.
            </p>

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => setShowUpgrade(false)}
                className="px-5 py-2 rounded-xl border border-white/30 hover:bg-white/10 transition"
              >
                Fechar
              </button>

              <button
                onClick={() => {
                  setShowUpgrade(false);
                  window.location.href = "/dashboard/billing";
                }}
                className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl transition"
              >
                Fazer Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
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