"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  Layers,
  Trash2,
  Pencil,
  FileText,
  MessageCircle,
  Search,
  Thermometer,
  MapPinned,
  Percent,
  X,
} from "lucide-react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const columns = [
  "lead",
  "proposta_enviada",
  "aguardando_cliente",
  "proposta_validada",
  "andamento",
  "concluido",
  "perdido",
] as const;

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  proposta_enviada: "Proposta Enviada",
  aguardando_cliente: "Aguardando Cliente",
  proposta_validada: "Proposta Validada",
  andamento: "Em Andamento",
  concluido: "Concluído",
  perdido: "Perdido",
};


const OPTION_STYLE = {
  color: "#e5e7eb",
  backgroundColor: "#0f172a",
};

function getOriginColorDot(cor?: string | null) {
  switch (cor) {
    case "emerald":
      return "🟢";
    case "cyan":
      return "🔹";
    case "blue":
      return "🔵";
    case "violet":
      return "🟣";
    case "pink":
      return "🩷";
    case "orange":
      return "🟠";
    case "yellow":
      return "🟡";
    case "red":
      return "🔴";
    case "indigo":
      return "🔷";
    default:
      return "⚪";
  }
}

const DEFAULT_STAGE_COLORS: Record<string, string> = {
  lead: "sky",
  proposta_enviada: "yellow",
  aguardando_cliente: "purple",
  proposta_validada: "emerald",
  andamento: "orange",
  concluido: "green",
  perdido: "red",
};

const STAGE_COLOR_OPTIONS = [
  { value: "sky", label: "Azul Claro" },
  { value: "yellow", label: "Amarelo" },
  { value: "purple", label: "Roxo" },
  { value: "emerald", label: "Esmeralda" },
  { value: "orange", label: "Laranja" },
  { value: "green", label: "Verde" },
  { value: "red", label: "Vermelho" },
  { value: "blue", label: "Azul" },
  { value: "cyan", label: "Ciano" },
  { value: "pink", label: "Rosa" },
  { value: "indigo", label: "Índigo" },
] as const;


type Vendedor = {
  user_id: string;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
};

type ServicoCalculado = {
  [key: string]: any;
  valor_comissao_calculado: number;
  percentual_comissao_calculado: number;
  lucro_calculado: number;
};

type PipelineStageSetting = {
  id: string;
  company_id: string;
  stage_key: string;
  label: string | null;
  color: string | null;
  is_visible: boolean | null;
};

export default function Pipeline() {
  const supabase = createClient();

  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [openModal, setOpenModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filtro, setFiltro] = useState<
    "Hoje" | "7 Dias" | "30 Dias" | "Mês" | "Custom"
  >("Hoje");
  const [dataInicio, setDataInicio] = useState<string | null>(null);
  const [dataFim, setDataFim] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");
  const [filtroTemperatura, setFiltroTemperatura] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const [showPerdaModal, setShowPerdaModal] = useState(false);
  const [itemPerdaId, setItemPerdaId] = useState<string | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");

  const [leadOrigins, setLeadOrigins] = useState<
  { id: string; nome: string; ordem: number; ativo: boolean; cor?: string | null }[]
>([]);

const [pipelineStageSettings, setPipelineStageSettings] = useState<PipelineStageSetting[]>([]);

const [showStageEditor, setShowStageEditor] = useState(false);
const [stageEditorForm, setStageEditorForm] = useState<{
  stage_key: string;
  label: string;
  color: string;
}>({
  stage_key: "lead",
  label: "",
  color: "sky",
});

  const [form, setForm] = useState({
    cliente: "",
    origem_lead: "",
    telefone: "",
    tipo_servico: "",
    descricao: "",
    valor_orcamento: "",
    custo: "",
    status: "lead",
    temperatura: "morno",
  });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
  if (typeof window === "undefined") return;

  (window as any).__PIPELINE_ROLE__ = role;
  (window as any).__OPEN_PIPELINE_STAGE_EDITOR__ = openStageEditor;

  return () => {
    delete (window as any).__PIPELINE_ROLE__;
    delete (window as any).__OPEN_PIPELINE_STAGE_EDITOR__;
  };
}, [role, pipelineStageSettings]);

  function findVendedorByUserId(id?: string | null) {
    if (!id) return null;
    return vendedores.find((v) => v.user_id === id) || null;
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

  async function registrarAtividade(params: {
    servicoId: string;
    tipo: string;
    titulo?: string;
    descricao?: string;
    dataAtividade?: string | null;
  }) {
    if (!companyId || !userId) return;

    const { error } = await supabase.from("lead_atividades").insert({
      company_id: companyId,
      servico_id: params.servicoId,
      tipo: params.tipo,
      titulo: params.titulo || null,
      descricao: params.descricao || null,
      data_atividade: params.dataAtividade || null,
      criado_por: userId,
      criado_por_email: userEmail || null,
      concluida: false,
    });

    if (error) {
      console.error("Erro ao registrar atividade no pipeline:", error);
    }
  }


  async function loadLeadOrigins(currentCompanyId: string) {
  const { data, error } = await supabase
    .from("company_lead_origins")
    .select("id, nome, ordem, ativo, cor")
    .eq("company_id", currentCompanyId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao carregar origens no pipeline:", error);
    setLeadOrigins([]);
    return;
  }

  setLeadOrigins(
    (data || []) as {
      id: string;
      nome: string;
      ordem: number;
      ativo: boolean;
      cor?: string | null;
    }[]
  );
}


async function loadPipelineStageSettings(currentCompanyId: string) {
  const { data, error } = await supabase
    .from("company_pipeline_stage_settings")
    .select("id, company_id, stage_key, label, color, is_visible")
    .eq("company_id", currentCompanyId);

  if (error) {
    console.error("Erro ao carregar config visual do pipeline:", error);
    setPipelineStageSettings([]);
    return;
  }

  setPipelineStageSettings((data || []) as PipelineStageSetting[]);
}


  async function load() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const currentUserId = data.user.id;
    const currentUserEmail = data.user.email || "";

    setUserId(currentUserId);
    setUserEmail(currentUserEmail);

    const { data: companyUsers, error: companyUserError } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", currentUserId)
      .eq("status", "ativo");

    if (companyUserError) {
      console.error("Erro ao buscar vínculo:", companyUserError);
      return;
    }

    const companyUser = companyUsers?.[0];
    if (!companyUser?.company_id) return;

setCompanyId(companyUser.company_id);
setRole(companyUser.role);
await loadLeadOrigins(companyUser.company_id);
await loadPipelineStageSettings(companyUser.company_id);




    const { data: vendedoresData } = await supabase
      .from("company_users")
      .select("user_id, email, role, status, comissao_percentual")
      .eq("company_id", companyUser.company_id)
      .eq("status", "ativo")
      .order("email", { ascending: true });

    const vendedoresLista = (vendedoresData as Vendedor[]) || [];
    setVendedores(vendedoresLista);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .eq("ativo", true);

    if (companyUser.role === "vendedor") {
      query = query.or(`criado_por.eq.${currentUserId},user_id.eq.${currentUserId}`);
      setFiltroVendedor(currentUserId);
    }

    const { data: servicos } = await query.order("created_at", {
      ascending: false,
    });

    if (servicos) setItems(servicos);
  }

  function resetForm() {
    setForm({
      cliente: "",
      origem_lead: "",
      telefone: "",
      tipo_servico: "",
      descricao: "",
      valor_orcamento: "",
      custo: "",
      status: "lead",
      temperatura: "morno",
    });
  }

  async function salvar() {
    if (!userId) return;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Erro ao verificar plano:", profileError);
      alert("Erro ao verificar plano");
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("company_users")
      .select("company_id, role, status, email")
      .eq("user_id", userId)
      .eq("status", "ativo");

    if (membershipError) {
      console.error("Erro ao buscar vínculo:", membershipError);
      alert("Erro ao buscar empresa do usuário");
      return;
    }

    const membership = memberships?.[0];
    if (!membership?.company_id) {
      alert("Usuário sem empresa vinculada");
      return;
    }

    const plan = profile?.plan ?? "free";
    const LIMITE_FREE = 5;

    if (plan === "free") {
      const { count, error: erroCount } = await supabase
        .from("servicos")
        .select("*", { count: "exact", head: true })
        .eq("company_id", membership.company_id)
        .eq("criado_por", userId)
        .eq("ativo", true);

      if (erroCount) {
        console.error("Erro ao verificar limite:", erroCount);
        alert("Erro ao verificar limite");
        return;
      }

      if ((count ?? 0) >= LIMITE_FREE) {
        setShowUpgrade(true);
        return;
      }
    }

    const meuVinculo = vendedores.find((v) => v.user_id === userId) || null;
    const statusInicial = form.status;
    const valorOrcamento = Number(form.valor_orcamento || 0);
    const agoraIso = new Date().toISOString();

    const comissaoCongelada =
      statusInicial === "concluido"
        ? calcularComissaoCongelada({
            valorOrcamento,
            vendedor: meuVinculo,
          })
        : { percentual_comissao: 0, valor_comissao: 0 };

    const novo = {
      user_id: userId,
      criado_por: userId,
      criado_por_email: meuVinculo?.email || userEmail || "",
      company_id: membership.company_id,
      numero_os: `OS-${Date.now()}`,
      cliente: form.cliente,
      origem_lead: form.origem_lead,
      telefone: form.telefone,
      titulo: form.tipo_servico,
      descricao: form.descricao,
      tipo_servico: form.tipo_servico,
      valor_orcamento: valorOrcamento,
      custo: Number(form.custo || 0),
      status: statusInicial,
      temperatura: form.temperatura,
      responsavel: meuVinculo?.email || userEmail || "",
      percentual_comissao: comissaoCongelada.percentual_comissao,
      valor_comissao: comissaoCongelada.valor_comissao,
      data_fechamento: statusInicial === "concluido" ? agoraIso : null,
      ultima_compra: statusInicial === "concluido" ? agoraIso : null,
      ativo: true,
    };

    const { data, error } = await supabase
      .from("servicos")
      .insert([novo])
      .select();

    if (error) {
      console.error("Erro ao salvar no pipeline:", error);
      alert(error.message || "Erro ao salvar");
      return;
    }

    if (data?.[0]) {
      await registrarAtividade({
        servicoId: data[0].id,
        tipo: "status",
        titulo: "Lead criado pelo pipeline",
        descricao: `Lead criado com status inicial "${STATUS_LABELS[statusInicial] || statusInicial}".`,
      });

      if (form.descricao?.trim()) {
        await registrarAtividade({
          servicoId: data[0].id,
          tipo: "observacao",
          titulo: "Observação inicial",
          descricao: form.descricao,
        });
      }

      setItems((prev) => [data[0], ...prev]);
      setOpenModal(false);
      resetForm();
    }
  }

  async function atualizarItem(id: string, updated: any) {
    const itemAtual = items.find((i) => i.id === id);
    if (!itemAtual || !companyId) return;

    if (updated.status === "perdido" && itemAtual.status !== "perdido") {
      setItemPerdaId(id);
      setMotivoPerda(itemAtual.motivo_perda || "");
      setShowPerdaModal(true);
      return;
    }

    const payload = { ...updated };

    if (payload.status && payload.status !== "perdido") {
      payload.motivo_perda = null;
    }

    if (payload.status === "concluido" && itemAtual.status !== "concluido") {
      const vendedor =
        findVendedorByUserId(payload.user_id || itemAtual.user_id) ||
        findVendedorByEmail(payload.responsavel || itemAtual.responsavel);

      const valorOrcamento = Number(
        payload.valor_orcamento ?? itemAtual.valor_orcamento ?? 0
      );

      const comissaoCongelada = calcularComissaoCongelada({
        valorOrcamento,
        valorComissaoAtual: payload.valor_comissao ?? itemAtual.valor_comissao,
        percentualComissaoAtual:
          payload.percentual_comissao ?? itemAtual.percentual_comissao,
        vendedor,
      });

      payload.data_fechamento =
        itemAtual.data_fechamento || new Date().toISOString();
      payload.ultima_compra = new Date().toISOString();
      payload.percentual_comissao = comissaoCongelada.percentual_comissao;
      payload.valor_comissao = comissaoCongelada.valor_comissao;
    }

    const oldStatus = itemAtual.status;

    const { data, error } = await supabase
      .from("servicos")
      .update(payload)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar item no pipeline:", error);
      alert("Erro ao salvar alterações: " + error.message);
      return;
    }

    if (payload.status && payload.status !== oldStatus) {
      await registrarAtividade({
        servicoId: id,
        tipo: "status",
        titulo: "Status atualizado pelo pipeline",
        descricao: `Status alterado de "${STATUS_LABELS[oldStatus] || oldStatus}" para "${STATUS_LABELS[payload.status] || payload.status}".`,
      });
    }

    setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
  }

  async function deletar(id: string) {
    await supabase
      .from("servicos")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over) return;
    if (columns.includes(over.id)) {
      atualizarItem(active.id, { status: over.id });
    }
  }

  async function confirmarPerdaPipeline() {
    if (!itemPerdaId || !companyId) return;

    if (!motivoPerda.trim()) {
      alert("Informe o motivo da perda.");
      return;
    }

    const itemAtual = items.find((item) => item.id === itemPerdaId);

    const { error } = await supabase
      .from("servicos")
      .update({
        status: "perdido",
        motivo_perda: motivoPerda,
      })
      .eq("id", itemPerdaId)
      .eq("company_id", companyId);

    if (error) {
      console.error("Erro ao registrar perda no pipeline:", error);
      alert("Erro ao registrar perda.");
      return;
    }

    await registrarAtividade({
      servicoId: itemPerdaId,
      tipo: "perda",
      titulo: "Lead marcado como perdido pelo pipeline",
      descricao: motivoPerda,
    });

    if (itemAtual?.status && itemAtual.status !== "perdido") {
      await registrarAtividade({
        servicoId: itemPerdaId,
        tipo: "status",
        titulo: "Status atualizado pelo pipeline",
        descricao: `Status alterado de "${STATUS_LABELS[itemAtual.status] || itemAtual.status}" para "${STATUS_LABELS.perdido}".`,
      });
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemPerdaId
          ? { ...item, status: "perdido", motivo_perda: motivoPerda }
          : item
      )
    );

    setShowPerdaModal(false);
    setItemPerdaId(null);
    setMotivoPerda("");
  }

  function getStageSetting(stageKey: string) {
  const found = pipelineStageSettings.find((item) => item.stage_key === stageKey);

  return {
    label: found?.label?.trim() || STATUS_LABELS[stageKey] || stageKey,
    color: found?.color?.trim() || DEFAULT_STAGE_COLORS[stageKey] || "blue",
    isVisible: found?.is_visible !== false,
  };
}

function getStageColorStyleByName(colorName?: string | null) {
  switch (colorName) {
    case "sky":
      return "from-sky-600/40 to-sky-500/10 border-sky-400/40 text-sky-200";
    case "yellow":
      return "from-yellow-600/40 to-yellow-500/10 border-yellow-400/40 text-yellow-200";
    case "purple":
      return "from-purple-600/40 to-purple-500/10 border-purple-400/40 text-purple-200";
    case "emerald":
      return "from-emerald-600/40 to-emerald-500/10 border-emerald-400/40 text-emerald-200";
    case "orange":
      return "from-orange-600/40 to-orange-500/10 border-orange-400/40 text-orange-200";
    case "green":
      return "from-green-600/40 to-green-500/10 border-green-400/40 text-green-200";
    case "red":
      return "from-red-600/40 to-red-500/10 border-red-400/40 text-red-200";
    case "blue":
      return "from-blue-600/40 to-blue-500/10 border-blue-400/40 text-blue-200";
    case "cyan":
      return "from-cyan-600/40 to-cyan-500/10 border-cyan-400/40 text-cyan-200";
    case "pink":
      return "from-pink-600/40 to-pink-500/10 border-pink-400/40 text-pink-200";
    case "indigo":
      return "from-indigo-600/40 to-indigo-500/10 border-indigo-400/40 text-indigo-200";
    default:
      return "from-blue-600/40 to-blue-500/10 border-blue-400/40 text-blue-200";
  }
}

function openStageEditor(stageKey: string) {
  const current = getStageSetting(stageKey);

  setStageEditorForm({
    stage_key: stageKey,
    label: current.label,
    color: current.color,
  });

  setShowStageEditor(true);
}

async function saveStageEditor() {
  if (!companyId) return;
  if (role !== "owner") return;

  const payload = {
    company_id: companyId,
    stage_key: stageEditorForm.stage_key,
    label: stageEditorForm.label.trim(),
    color: stageEditorForm.color,
    is_visible: true,
  };

  const { error } = await supabase
    .from("company_pipeline_stage_settings")
    .upsert(payload, {
      onConflict: "company_id,stage_key",
    });

  if (error) {
    console.error("Erro ao salvar config visual da etapa:", error);
    alert("Erro ao salvar etapa: " + error.message);
    return;
  }

  await loadPipelineStageSettings(companyId);
  setShowStageEditor(false);
}


  const itensCalculados = useMemo<ServicoCalculado[]>(() => {
    return items.map((item) => {
      const vendedor =
        findVendedorByUserId(item.criado_por || item.user_id) ||
        findVendedorByEmail(item.responsavel);

      const comissao = calcularComissaoCongelada({
        valorOrcamento: Number(item.valor_orcamento || 0),
        valorComissaoAtual: item.valor_comissao,
        percentualComissaoAtual: item.percentual_comissao,
        vendedor,
      });

      const lucro =
        Number(item.valor_orcamento || 0) -
        Number(item.custo || 0) -
        Number(comissao.valor_comissao || 0);

      return {
        ...item,
        valor_comissao_calculado: Number(comissao.valor_comissao || 0),
        percentual_comissao_calculado: Number(comissao.percentual_comissao || 0),
        lucro_calculado: lucro,
      };
    });
  }, [items, vendedores]);

  const itensFiltrados = useMemo(() => {
    const agora = new Date();

    return itensCalculados.filter((item) => {
      if (!item.created_at) return true;

      const dataItem = new Date(item.created_at);

      const passouPeriodo = (() => {
        switch (filtro) {
          case "Hoje":
            return dataItem.toDateString() === agora.toDateString();

          case "7 Dias":
            return (
              dataItem >=
              new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000)
            );

          case "30 Dias":
            return (
              dataItem >=
              new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)
            );

          case "Mês":
            return (
              dataItem.getMonth() === agora.getMonth() &&
              dataItem.getFullYear() === agora.getFullYear()
            );

          case "Custom":
            if (!dataInicio || !dataFim) return true;
            return (
              dataItem >= new Date(dataInicio + "T00:00:00") &&
              dataItem <= new Date(dataFim + "T23:59:59")
            );

          default:
            return true;
        }
      })();

      if (!passouPeriodo) return false;

      if (
        filtroVendedor !== "todos" &&
        (item.criado_por || item.user_id) !== filtroVendedor
      ) {
        return false;
      }

      if (
        filtroTemperatura !== "todos" &&
        (item.temperatura || "morno") !== filtroTemperatura
      ) {
        return false;
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const bateBusca =
          item.cliente?.toLowerCase().includes(termo) ||
          item.tipo_servico?.toLowerCase().includes(termo) ||
          item.responsavel?.toLowerCase().includes(termo) ||
          item.origem_lead?.toLowerCase().includes(termo);

        if (!bateBusca) return false;
      }

      return true;
    });
  }, [
    itensCalculados,
    filtro,
    dataInicio,
    dataFim,
    filtroVendedor,
    filtroTemperatura,
    busca,
  ]);

  const metrics = useMemo(() => {
    const ativos = itensFiltrados.filter((i) => i.ativo === true);
    const concluidos = ativos.filter((i) => i.status === "concluido");

    const receita = concluidos.reduce(
      (acc, i) => acc + Number(i.valor_orcamento || 0),
      0
    );

    const custo = concluidos.reduce(
      (acc, i) => acc + Number(i.custo || 0),
      0
    );

    const comissao = concluidos.reduce(
      (acc, i) => acc + Number(i.valor_comissao_calculado || 0),
      0
    );

    const quentes = ativos.filter(
      (i) => (i.temperatura || "morno") === "quente"
    ).length;

    return {
      total: ativos.length,
      quentes,
      receita: formatMoney(receita),
      custo: formatMoney(custo),
      comissao: formatMoney(comissao),
      lucro: formatMoney(receita - custo - comissao),
    };
  }, [itensFiltrados]);

  function FiltroPeriodo({
    filtro,
    setFiltro,
    setDataInicio,
    setDataFim,
  }: any) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        {["Hoje", "7 Dias", "30 Dias", "Mês"].map((tipo) => (
          <button
            key={tipo}
            onClick={() => setFiltro(tipo as any)}
            className={`px-4 py-2 rounded-xl border transition text-sm ${
              filtro === tipo
                ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30"
                : "bg-white/10 border-white/20 hover:bg-white/20"
            }`}
          >
            {tipo}
          </button>
        ))}

        <button
          onClick={() => setFiltro("Custom")}
          className={`px-4 py-2 rounded-xl border transition text-sm ${
            filtro === "Custom"
              ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30"
              : "bg-white/10 border-white/20 hover:bg-white/20"
          }`}
        >
          Personalizado
        </button>

        {filtro === "Custom" && (
          <div className="flex gap-2">
            <input
              type="date"
              onChange={(e) => setDataInicio(e.target.value)}
              className="p-2 rounded-lg bg-white/10 border border-white/20"
            />
            <input
              type="date"
              onChange={(e) => setDataFim(e.target.value)}
              className="p-2 rounded-lg bg-white/10 border border-white/20"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

      <div className="relative z-10 p-6 md:p-14 space-y-8 text-white">
        <div className="flex flex-col gap-6">
          <FiltroPeriodo
            filtro={filtro}
            setFiltro={setFiltro}
            setDataInicio={setDataInicio}
            setDataFim={setDataFim}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-4">
            <div className="flex items-center bg-white/10 border border-white/20 px-5 py-3 rounded-2xl">
              <Search size={18} className="text-blue-200" />
              <input
                placeholder="Buscar cliente, serviço, origem ou responsável..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="bg-transparent outline-none ml-3 w-full text-white"
              />
            </div>

<select
  value={role === "vendedor" ? userId || "todos" : filtroVendedor}
  onChange={(e) => setFiltroVendedor(e.target.value)}
  disabled={role === "vendedor"}
  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white"
>
  {role !== "vendedor" && (
    <option value="todos" style={OPTION_STYLE}>
      Todos os vendedores
    </option>
  )}

  {vendedores
    .filter(
      (v) =>
        v.role === "vendedor" ||
        v.role === "owner" ||
        v.role === "admin"
    )
    .map((vendedor) => (
      <option
        key={vendedor.user_id}
        value={vendedor.user_id}
        style={OPTION_STYLE}
      >
        {vendedor.email}
      </option>
    ))}
</select>

          <select
  value={filtroTemperatura}
  onChange={(e) => setFiltroTemperatura(e.target.value)}
  className="px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white"
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
          <Metric icon={<Layers size={18} />} title="Total" value={metrics.total} />
          <Metric
            icon={<Thermometer size={18} />}
            title="Leads Quentes"
            value={metrics.quentes}
          />
          <Metric icon={<DollarSign size={18} />} title="Receita" value={metrics.receita} />
          <Metric icon={<BarChart3 size={18} />} title="Custos" value={metrics.custo} />
          <Metric icon={<Percent size={18} />} title="Comissão" value={metrics.comissao} />
          <Metric icon={<TrendingUp size={18} />} title="Lucro" value={metrics.lucro} />
        </div>

<div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
  <div>
    <div className="flex items-center gap-3">
      <h2 className="text-3xl font-semibold tracking-[0.2em] uppercase text-blue-200">
        Pipeline
      </h2>

      {role === "owner" && (
        <button
          type="button"
          onClick={() => openStageEditor("lead")}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-cyan-300"
          title="Editar visual das etapas"
        >
          <Pencil size={16} />
        </button>
      )}
    </div>

    <p className="text-blue-100/60 mt-2 text-sm">
      Visualize a carteira por etapa, vendedor, temperatura e origem do lead.
    </p>
  </div>

  <button
    onClick={() => setOpenModal(true)}
    className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-7 py-3 rounded-xl font-semibold shadow-[0_10px_30px_rgba(59,130,246,0.4)] transition-all duration-200 hover:scale-[1.03]"
  >
    + Novo Serviço
  </button>
</div>



        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex flex-wrap gap-6 md:gap-10 pb-6 md:pb-10">
     {columns.map((col) => {
  const stageConfig = getStageSetting(col);

  if (!stageConfig.isVisible) return null;

  const itensDaColuna = itensFiltrados.filter(
    (i) => i.status === col && i.ativo === true
  );

  return (
    <Column
      key={col}
      id={col}
      title={stageConfig.label}
      count={itensDaColuna.length}
      colorStyle={getStageColorStyleByName(stageConfig.color)}
    >
      {itensDaColuna.map((item) => (
        <Card
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          toggleExpand={() =>
            setExpandedId(expandedId === item.id ? null : item.id)
          }
          atualizarItem={atualizarItem}
          deletar={deletar}
          vendedores={vendedores}
        />
      ))}
    </Column>
  );
})}
          </div>
        </DndContext>

        {openModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-3xl w-[90%] max-w-[520px] space-y-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white">
              <h3 className="text-xl font-semibold text-blue-200">
                Novo Serviço
              </h3>

              <Input
                placeholder="Cliente"
                value={form.cliente}
                onChange={(v) => setForm({ ...form, cliente: v })}
              />
<select
  value={form.origem_lead || ""}
  onChange={(e) => setForm({ ...form, origem_lead: e.target.value })}
  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white"
>
  <option value="" style={OPTION_STYLE}>
    Selecione a origem do lead
  </option>

{leadOrigins.map((origem) => (
  <option key={origem.id} value={origem.nome} style={OPTION_STYLE}>
    {getOriginColorDot(origem.cor)} {origem.nome}
  </option>
))}
</select>




              <Input
                placeholder="Telefone WhatsApp (ex: 5511999999999)"
                value={form.telefone}
                onChange={(v) => setForm({ ...form, telefone: v })}
              />

              <Input
                placeholder="Tipo Serviço"
                value={form.tipo_servico}
                onChange={(v) => setForm({ ...form, tipo_servico: v })}
              />

              <Input
                placeholder="Descrição"
                value={form.descricao}
                onChange={(v) => setForm({ ...form, descricao: v })}
              />

              <Input
                type="number"
                placeholder="Valor"
                value={form.valor_orcamento}
                onChange={(v) => setForm({ ...form, valor_orcamento: v })}
              />

              <Input
                type="number"
                placeholder="Custo"
                value={form.custo}
                onChange={(v) => setForm({ ...form, custo: v })}
              />

              <select
                value={form.temperatura}
                onChange={(e) =>
                  setForm({ ...form, temperatura: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white"
              >
                <option value="frio" className="text-black">
                  Frio
                </option>
                <option value="morno" className="text-black">
                  Morno
                </option>
                <option value="quente" className="text-black">
                  Quente
                </option>
              </select>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  onClick={() => setOpenModal(false)}
                  className="px-5 py-2 rounded-xl border border-white/30 hover:bg-white/10 transition"
                >
                  Cancelar
                </button>

                <button
                  onClick={salvar}
                  className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl transition"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}


                {showStageEditor && role === "owner" && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
            <div className="bg-[#0f172a] border border-white/15 rounded-3xl w-[92%] max-w-[520px] p-8 space-y-5 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-cyan-300">
                    Editar etapa do pipeline
                  </h3>
                  <p className="text-sm text-white/55 mt-1">
                    O status interno continua o mesmo. Você altera só nome e cor visual.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowStageEditor(false)}
                  className="text-white/45 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Etapa interna
                </label>
                <div className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white/70">
                  {stageEditorForm.stage_key}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Nome visual
                </label>
                <input
                  value={stageEditorForm.label}
                  onChange={(e) =>
                    setStageEditorForm((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white"
                  placeholder="Ex: Aprovado"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.14em] text-white/45">
                  Cor visual
                </label>
                <select
                  value={stageEditorForm.color}
                  onChange={(e) =>
                    setStageEditorForm((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white outline-none"
                >
                  {STAGE_COLOR_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} style={OPTION_STYLE}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div
                  className={`inline-flex px-4 py-2 rounded-xl bg-gradient-to-r ${getStageColorStyleByName(
                    stageEditorForm.color
                  )}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {stageEditorForm.label || stageEditorForm.stage_key}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStageEditor(false)}
                  className="px-5 py-2 rounded-xl border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={saveStageEditor}
                  className="px-5 py-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500"
                >
                  Salvar visual
                </button>
              </div>
            </div>
          </div>
        )}


        {showPerdaModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-3xl w-[90%] max-w-[500px] space-y-5 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-red-300">
                    Registrar perda
                  </h3>
                  <p className="text-sm text-blue-100/70 mt-1">
                    Informe o motivo da perda deste lead no pipeline.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowPerdaModal(false);
                    setItemPerdaId(null);
                    setMotivoPerda("");
                  }}
                  className="text-gray-300 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              <textarea
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                placeholder="Ex: cliente achou caro, fechou com concorrente, desistiu, sem retorno..."
                rows={5}
                className="w-full p-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-blue-200/60 outline-none resize-none"
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPerdaModal(false);
                    setItemPerdaId(null);
                    setMotivoPerda("");
                  }}
                  className="px-5 py-2 rounded-xl border border-white/30 hover:bg-white/10 transition"
                >
                  Cancelar
                </button>

                <button
                  onClick={confirmarPerdaPipeline}
                  className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-xl transition"
                >
                  Confirmar perda
                </button>
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
                Você pode criar até 5 serviços no plano gratuito.
                Faça upgrade para desbloquear serviços ilimitados.
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
    </div>
  );
}

/* COLUMN */
function Column({ id, title, children, count, colorStyle }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative overflow-hidden
        w-full sm:w-[48%] lg:w-[360px]
        p-4 md:p-6
        rounded-3xl
        bg-[#0f172a]
        border border-[#1e293b]
        shadow-[0_15px_50px_rgba(0,0,0,0.6)]
        transition-all duration-300
        ${
          isOver
            ? "scale-[1.02] border-blue-500 shadow-[0_20px_70px_rgba(59,130,246,0.3)]"
            : ""
        }
      `}
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

      <div
        className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl bg-gradient-to-r ${colorStyle}`}
      />

<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <div
      className={`
        px-4 py-2
        rounded-xl
        bg-gradient-to-r
        ${colorStyle}
        backdrop-blur-md
        shadow-inner
      `}
    >
      <span className="text-xs font-semibold tracking-wide uppercase">
        {title.replaceAll("_", " ")}
      </span>
    </div>

    <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-medium text-white">
      {count}
    </div>
  </div>

  {typeof window !== "undefined" && (window as any).__PIPELINE_ROLE__ === "owner" && (
    <button
      type="button"
      onClick={() => (window as any).__OPEN_PIPELINE_STAGE_EDITOR__?.(id)}
      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-cyan-300"
      title="Editar etapa"
    >
      <Pencil size={14} />
    </button>
  )}
</div>

      <div className="space-y-6 min-h-[50px]">{children}</div>
    </div>
  );
}

/* CARD */
function Card({
  item,
  expanded,
  toggleExpand,
  atualizarItem,
  deletar,
  vendedores,
}: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      disabled: item.ativo === false,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 50 : "auto",
  };

  const [editMode, setEditMode] = useState(false);
  const [local, setLocal] = useState(item);

  useEffect(() => {
    setLocal(item);
  }, [item]);

  function findVendedorByUserId(id?: string | null) {
    if (!id) return null;
    return vendedores.find((v: any) => v.user_id === id) || null;
  }

  function findVendedorByEmail(email?: string | null) {
    if (!email) return null;
    return (
      vendedores.find(
        (v: any) => (v.email || "").toLowerCase() === email.toLowerCase()
      ) || null
    );
  }

  function calcularComissaoCongelada(params: {
    valorOrcamento: number;
    valorComissaoAtual?: number | null;
    percentualComissaoAtual?: number | null;
    vendedor?: any | null;
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

  const lucro =
    Number(item.valor_orcamento || 0) -
    Number(item.custo || 0) -
    Number(item.valor_comissao_calculado || 0);

  async function salvarEdicao() {
    const vendedor =
      findVendedorByUserId(local.user_id || item.user_id) ||
      findVendedorByEmail(local.responsavel || item.responsavel);

    const valorOrcamento = Number(local.valor_orcamento || 0);

    const payload: any = {
      cliente: local.cliente || "",
      origem_lead: local.origem_lead || "",
      telefone: local.telefone || "",
      tipo_servico: local.tipo_servico || "",
      descricao: local.descricao || "",
      valor_orcamento: valorOrcamento,
      custo: Number(local.custo || 0),
      temperatura: local.temperatura || "morno",
    };

    if (local.status) {
      payload.status = local.status;
    }

    if (local.responsavel) {
      payload.responsavel = local.responsavel;
    }

    if (local.user_id) {
      payload.user_id = local.user_id;
    }

    if (local.status === "concluido") {
      const comissaoCongelada = calcularComissaoCongelada({
        valorOrcamento,
        valorComissaoAtual: local.valor_comissao,
        percentualComissaoAtual: local.percentual_comissao,
        vendedor,
      });

      payload.percentual_comissao = comissaoCongelada.percentual_comissao;
      payload.valor_comissao = comissaoCongelada.valor_comissao;
      payload.data_fechamento =
        local.data_fechamento || new Date().toISOString();
      payload.ultima_compra =
        local.ultima_compra || new Date().toISOString();
    }

    await atualizarItem(item.id, payload);
    setEditMode(false);
  }

  const temperatura = item.temperatura || "morno";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative
        p-4 md:p-5
        rounded-2xl
        text-white
        backdrop-blur-2xl
        bg-white/5
        border border-white/10
        shadow-[0_20px_60px_rgba(0,0,0,0.6)]
        hover:shadow-[0_25px_80px_rgba(59,130,246,0.15)]
        transition-all duration-300
        hover:scale-[1.04]
        hover:-translate-y-1
        ${item.ativo === false ? "bg-red-900/20 border-red-500/30 opacity-60" : ""}
        ${isDragging ? "scale-[1.06] rotate-1 shadow-[0_40px_100px_rgba(0,0,0,0.8)]" : ""}
      `}
    >
      <div {...listeners} {...attributes} className="cursor-grab font-medium">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <span className="font-semibold block truncate">{item.cliente}</span>

            <div className="text-[11px] text-blue-200/70 mt-1 truncate">
              {item.tipo_servico || "Sem serviço definido"}
            </div>

            <div className="text-[11px] text-cyan-300/80 mt-1 truncate flex items-center gap-1">
              <MapPinned size={12} />
              {item.origem_lead || "Origem não informada"}
            </div>
          </div>

          <span className="text-blue-400 font-semibold whitespace-nowrap">
            {formatMoney(Number(item.valor_orcamento || 0))}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="text-purple-300">
            Comissão: {formatMoney(Number(item.valor_comissao_calculado || 0))}
          </span>
          <span className="text-yellow-300">
            {Number(item.percentual_comissao_calculado || 0).toFixed(1)}%
          </span>
        </div>

        <div className="text-xs text-emerald-400 mt-2">
          Lucro: {formatMoney(lucro)}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <span
            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${
              temperatura === "frio"
                ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                : temperatura === "quente"
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40"
            }`}
          >
            {temperatura === "frio"
              ? "Frio"
              : temperatura === "quente"
              ? "Quente"
              : "Morno"}
          </span>

          {item.responsavel && (
            <span className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-[11px] text-white/80 truncate max-w-full">
              {item.responsavel}
            </span>
          )}
        </div>
      </div>

      <div
        onClick={toggleExpand}
        className="text-xs text-blue-200 mt-3 cursor-pointer"
      >
        {expanded ? "Fechar ↑" : "Detalhes ↓"}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm text-blue-100">
          {editMode ? (
            <>
              <Input
                value={local.cliente}
                onChange={(v) => setLocal({ ...local, cliente: v })}
              />


<div className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white/80">
  {local.origem_lead || "Origem não informada"}
</div>

              <Input
                placeholder="Telefone WhatsApp"
                value={local.telefone || ""}
                onChange={(v) => setLocal({ ...local, telefone: v })}
              />

              <Input
                value={local.tipo_servico || ""}
                onChange={(v) => setLocal({ ...local, tipo_servico: v })}
                placeholder="Tipo de serviço"
              />

              <Input
                value={local.descricao || ""}
                onChange={(v) => setLocal({ ...local, descricao: v })}
              />

              <Input
                type="number"
                value={local.valor_orcamento}
                onChange={(v) => setLocal({ ...local, valor_orcamento: v })}
              />

              <Input
                type="number"
                value={local.custo}
                onChange={(v) => setLocal({ ...local, custo: v })}
              />

              <select
                value={local.temperatura || "morno"}
                onChange={(e) =>
                  setLocal({ ...local, temperatura: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white"
              >
                <option value="frio" className="text-black">
                  Frio
                </option>
                <option value="morno" className="text-black">
                  Morno
                </option>
                <option value="quente" className="text-black">
                  Quente
                </option>
              </select>

              <button
                onClick={salvarEdicao}
                className="w-full bg-blue-600 py-2 rounded-xl"
              >
                Salvar Alterações
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">Responsável</p>
                  <p className="break-all text-sm leading-snug">
                    {item.responsavel || "Não definido"}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">Telefone</p>
                  <p className="break-all text-sm leading-snug">
                    {item.telefone || "Não informado"}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">Temperatura</p>
                  <p className="text-sm leading-snug">
                    {temperatura === "frio"
                      ? "Frio"
                      : temperatura === "quente"
                      ? "Quente"
                      : "Morno"}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">Custo</p>
                  <p className="text-sm leading-snug">
                    {formatMoney(Number(item.custo || 0))}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">% Comissão</p>
                  <p className="text-sm leading-snug">
                    {Number(item.percentual_comissao_calculado || 0).toFixed(1)}%
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 min-w-0">
                  <p className="text-[11px] text-gray-400">Comissão</p>
                  <p className="text-sm leading-snug">
                    {formatMoney(Number(item.valor_comissao_calculado || 0))}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 sm:col-span-2 min-w-0">
                  <p className="text-[11px] text-gray-400">Origem do Lead</p>
                  <p className="break-words text-sm leading-snug">
                    {item.origem_lead || "Não informada"}
                  </p>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Descrição</p>
                <p>{item.descricao || "Sem descrição"}</p>
              </div>

              {item.status === "perdido" && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-[11px] text-red-300 mb-1 font-semibold">
                    Motivo da perda
                  </p>
                  <p className="text-red-100">
                    {item.motivo_perda || "Motivo não informado"}
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-3">
                <button
                  onClick={() => {
                    if (!item.telefone) {
                      alert("Cliente não possui telefone cadastrado");
                      return;
                    }

                    const link = `${window.location.origin}/orcamento/${item.id}`;
                    const mensagem = `Olá ${item.cliente}, segue seu orçamento:\n\n${link}`;
                    const whatsapp = `https://wa.me/${item.telefone}?text=${encodeURIComponent(
                      mensagem
                    )}`;

                    window.open(whatsapp, "_blank");
                  }}
                  className="bg-emerald-600 p-2 rounded-xl hover:scale-110 transition"
                >
                  <MessageCircle size={14} />
                </button>

                <button
                  onClick={async () => {
                    const response = await fetch("/api/gerar-pdf", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(item),
                    });

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                  className="bg-purple-600 p-2 rounded-xl hover:scale-110 hover:shadow-lg transition-all duration-200"
                >
                  <FileText size={16} />
                </button>

                <button
                  onClick={() => setEditMode(true)}
                  className="bg-blue-600 p-2 rounded-xl hover:scale-110 transition"
                >
                  <Pencil size={16} />
                </button>

                <button
                  onClick={() => deletar(item.id)}
                  className="bg-red-600 p-2 rounded-xl hover:scale-110 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* INPUT */
type InputProps = {
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

function Input({
  value,
  onChange,
  type = "text",
  placeholder = "",
}: InputProps) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange(e.target.value)
      }
      className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
    />
  );
}

function Metric({ icon, title, value }: any) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-[#1f2937] hover:scale-[1.02] transition-all duration-200">
      <div className="flex justify-between text-gray-400 text-sm">
        <span>{title}</span>
        <span className="text-blue-400">{icon}</span>
      </div>

      <div className="mt-4 text-3xl font-bold text-cyan-400">{value}</div>
    </div>
  );
}