"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FileSpreadsheet,
  FileDown,
  FileUp,
  Filter,
  Search,
  DollarSign,
  Receipt,
  TrendingUp,
  Users,
  CalendarDays,
  RefreshCcw,
  Percent,
} from "lucide-react";

interface Orcamento {
  id: string;
  numero_os: string | null;
  cliente: string | null;
  tipo_servico: string | null;
  valor_orcamento: number | null;
  custo: number | null;
  valor_comissao?: number | null;
  percentual_comissao?: number | null;
  responsavel: string | null;
  origem_lead: string | null;
  status: string | null;
  data_orcamento: string | null;
  created_at: string;
  user_id?: string | null;
  criado_por?: string | null;
  criado_por_email?: string | null;
  company_id?: string | null;
  ativo?: boolean | null;
  temperatura?: string | null;
  descricao?: string | null;
  forma_pagamento?: string | null;
  telefone?: string | null;
  data_fechamento?: string | null;
  ultima_compra?: string | null;
}

interface OrcamentoCalculado extends Orcamento {
  valor_comissao_calculado: number;
  percentual_comissao_calculado: number;
  lucro_calculado: number;
}

interface Vendedor {
  user_id: string | null;
  email: string;
  role: string;
  status: string;
  comissao_percentual?: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  proposta_enviada: "Proposta Enviada",
  aguardando_cliente: "Aguardando Cliente",
  proposta_validada: "Proposta Validada",
  andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  recusado: "Recusado",
};

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  proposta_enviada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  aguardando_cliente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  proposta_validada: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  andamento: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  concluido: "bg-green-500/20 text-green-300 border-green-500/30",
  cancelado: "bg-red-500/20 text-red-300 border-red-500/30",
  recusado: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export default function OrcamentosPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("all");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [periodo, setPeriodo] = useState("all");
  const [vendedorFiltro, setVendedorFiltro] = useState("all");
  const [ativoFiltro, setAtivoFiltro] = useState("ativos");

  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("");

  useEffect(() => {
    fetchOrcamentos();
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

  async function fetchOrcamentos() {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
      setLoading(false);
      return;
    }

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

    setCompanyId(companyUser.company_id);
    setCurrentRole(companyUser.role);

    if (companyUser.role === "vendedor") {
      setVendedorFiltro(user.id);
    }

const { data: equipe } = await supabase
  .from("company_users")
  .select("user_id, email, role, status, comissao_percentual")
  .eq("company_id", companyUser.company_id)
  .eq("status", "ativo")
  .order("email", { ascending: true });

    setVendedores((equipe as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", companyUser.company_id);

if (companyUser.role === "vendedor") {
  query = query.eq("criado_por", user.id);
}

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (!error) {
      setOrcamentos((data || []) as Orcamento[]);
    }

    setLoading(false);
  }

  function limparFiltros() {
    setBusca("");
    setStatusFiltro("all");
    setValorMin("");
    setValorMax("");
    setDataInicio("");
    setDataFim("");
    setPeriodo("all");
    setAtivoFiltro("ativos");
    setVendedorFiltro(currentRole === "vendedor" ? currentUserId || "all" : "all");
  }

  const orcamentosCalculados = useMemo<OrcamentoCalculado[]>(() => {
    return orcamentos.map((o) => {
const vendedor =
  findVendedorByUserId(o.criado_por || o.user_id) ||
  findVendedorByEmail(o.responsavel);

      const comissao = calcularComissaoCongelada({
        valorOrcamento: Number(o.valor_orcamento || 0),
        valorComissaoAtual: o.valor_comissao,
        percentualComissaoAtual: o.percentual_comissao,
        vendedor,
      });

      const lucro =
        Number(o.valor_orcamento || 0) -
        Number(o.custo || 0) -
        Number(comissao.valor_comissao || 0);

      return {
        ...o,
        valor_comissao_calculado: Number(comissao.valor_comissao || 0),
        percentual_comissao_calculado: Number(comissao.percentual_comissao || 0),
        lucro_calculado: lucro,
      };
    });
  }, [orcamentos, vendedores]);

  const filtrado = useMemo(() => {
    return orcamentosCalculados.filter((o) => {
      const cliente = (o.cliente || "").toLowerCase();
      const servico = (o.tipo_servico || "").toLowerCase();
      const origem = (o.origem_lead || "").toLowerCase();
      const responsavel = (o.responsavel || "").toLowerCase();
      const numeroOs = (o.numero_os || "").toLowerCase();
      const termo = busca.toLowerCase();

      if (
        termo &&
        !cliente.includes(termo) &&
        !servico.includes(termo) &&
        !origem.includes(termo) &&
        !responsavel.includes(termo) &&
        !numeroOs.includes(termo)
      ) {
        return false;
      }

      if (statusFiltro !== "all" && o.status !== statusFiltro) {
        return false;
      }

if (
  vendedorFiltro !== "all" &&
  (o.criado_por || o.user_id) !== vendedorFiltro
) {
  return false;
}

      if (ativoFiltro === "ativos" && o.ativo === false) {
        return false;
      }

      if (ativoFiltro === "inativos" && o.ativo !== false) {
        return false;
      }

      if (valorMin && Number(o.valor_orcamento || 0) < Number(valorMin)) {
        return false;
      }

      if (valorMax && Number(o.valor_orcamento || 0) > Number(valorMax)) {
        return false;
      }

      const dataRef = new Date(o.data_orcamento || o.created_at);
      const agora = new Date();

      if (periodo === "hoje") {
        if (
          dataRef.getDate() !== agora.getDate() ||
          dataRef.getMonth() !== agora.getMonth() ||
          dataRef.getFullYear() !== agora.getFullYear()
        ) {
          return false;
        }
      }

      if (periodo === "7dias") {
        const limite = new Date();
        limite.setDate(agora.getDate() - 7);
        if (dataRef < limite) return false;
      }

      if (periodo === "30dias") {
        const limite = new Date();
        limite.setDate(agora.getDate() - 30);
        if (dataRef < limite) return false;
      }

      if (periodo === "mes") {
        if (
          dataRef.getMonth() !== agora.getMonth() ||
          dataRef.getFullYear() !== agora.getFullYear()
        ) {
          return false;
        }
      }

      if (dataInicio && dataRef < new Date(dataInicio + "T00:00:00")) {
        return false;
      }

      if (dataFim && dataRef > new Date(dataFim + "T23:59:59")) {
        return false;
      }

      return true;
    });
  }, [
    orcamentosCalculados,
    busca,
    statusFiltro,
    valorMin,
    valorMax,
    dataInicio,
    dataFim,
    periodo,
    vendedorFiltro,
    ativoFiltro,
  ]);

  const resumo = useMemo(() => {
    const total = filtrado.length;
    const concluidos = filtrado.filter((o) => o.status === "concluido");
    const andamento = filtrado.filter((o) =>
      ["proposta_validada", "andamento"].includes(o.status || "")
    );
    const potenciais = filtrado.filter((o) =>
      ["lead", "proposta_enviada", "aguardando_cliente"].includes(o.status || "")
    );

    const valorTotal = filtrado.reduce(
      (acc, o) => acc + Number(o.valor_orcamento || 0),
      0
    );

    const custoTotal = filtrado.reduce(
      (acc, o) => acc + Number(o.custo || 0),
      0
    );

    const comissaoTotal = filtrado.reduce(
      (acc, o) => acc + Number(o.valor_comissao_calculado || 0),
      0
    );

    const lucroTotal = filtrado.reduce(
      (acc, o) => acc + Number(o.lucro_calculado || 0),
      0
    );

    const valorConcluido = concluidos.reduce(
      (acc, o) => acc + Number(o.valor_orcamento || 0),
      0
    );

    const valorPotencial = potenciais.reduce(
      (acc, o) => acc + Number(o.valor_orcamento || 0),
      0
    );

    const ticketMedio =
      concluidos.length > 0 ? valorConcluido / concluidos.length : 0;

    return {
      total,
      valorTotal,
      custoTotal,
      comissaoTotal,
      lucroTotal,
      valorConcluido,
      valorPotencial,
      ticketMedio,
      andamento: andamento.length,
      concluidos: concluidos.length,
    };
  }, [filtrado]);

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data?: string | null) {
    if (!data) return "-";
    return new Date(data).toLocaleDateString("pt-BR");
  }

  function exportCSV() {
    const headers = [
      "OS",
      "Cliente",
      "Serviço",
      "Valor",
      "Custo",
      "Comissão",
      "% Comissão",
      "Lucro",
      "Responsável",
      "Origem",
      "Status",
      "Data",
    ];

    const rows = filtrado.map((o) => [
      o.numero_os || "",
      o.cliente || "",
      o.tipo_servico || "",
      o.valor_orcamento || 0,
      o.custo || 0,
      o.valor_comissao_calculado || 0,
      o.percentual_comissao_calculado || 0,
      o.lucro_calculado || 0,
      o.responsavel || "",
      o.origem_lead || "",
      STATUS_LABELS[o.status || ""] || o.status || "",
      formatarData(o.data_orcamento || o.created_at),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((campo) => `"${String(campo).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orcamentos.csv";
    link.click();
  }

  function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(
      filtrado.map((o) => ({
        OS: o.numero_os,
        Cliente: o.cliente,
        Serviço: o.tipo_servico,
        Valor: o.valor_orcamento,
        Custo: o.custo,
        Comissão: o.valor_comissao_calculado,
        "% Comissão": o.percentual_comissao_calculado,
        Lucro: o.lucro_calculado,
        Responsável: o.responsavel,
        Origem: o.origem_lead,
        Status: STATUS_LABELS[o.status || ""] || o.status,
        Data: formatarData(o.data_orcamento || o.created_at),
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orcamentos");
    XLSX.writeFile(wb, "orcamentos.xlsx");
  }

  function exportPDF() {
    const doc = new jsPDF();

    const rows = filtrado.map((o) => [
      o.numero_os || "-",
      o.cliente || "-",
      o.tipo_servico || "-",
      formatarMoeda(o.valor_orcamento || 0),
      formatarMoeda(o.custo || 0),
      formatarMoeda(o.valor_comissao_calculado || 0),
      formatarMoeda(o.lucro_calculado || 0),
      STATUS_LABELS[o.status || ""] || o.status || "-",
      formatarData(o.data_orcamento || o.created_at),
    ]);

    doc.setFontSize(16);
    doc.text("Relatório de Orçamentos", 14, 18);

    autoTable(doc, {
      startY: 28,
      head: [[
        "OS",
        "Cliente",
        "Serviço",
        "Valor",
        "Custo",
        "Comissão",
        "Lucro",
        "Status",
        "Data",
      ]],
      body: rows,
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [37, 99, 235],
      },
    });

    doc.save("orcamentos.pdf");
  }

  function baixarModeloImportacao() {
    const modelo = [
      {
        cliente: "Empresa Exemplo",
        tipo_servico: "Desenvolvimento de site",
        valor_orcamento: 3500,
        custo: 1200,
        responsavel: "joao@empresa.com",
        origem_lead: "WhatsApp",
        status: "lead",
        data_orcamento: new Date().toISOString().slice(0, 10),
        telefone: "62999999999",
        descricao: "Serviço de exemplo para importação",
        forma_pagamento: "PIX",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo-importacao-orcamentos.xlsx");
  }

  async function importarArquivo(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const arquivo = event.target.files?.[0];
    if (!arquivo || !companyId || !currentUserId) return;
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    setImportando(true);

    try {
      const buffer = await arquivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const linhas = XLSX.utils.sheet_to_json<any>(sheet);

      if (!linhas.length) {
        alert("Arquivo vazio ou inválido.");
        setImportando(false);
        return;
      }

      const registros = linhas.map((linha: any, index: number) => {
        const responsavel =
          linha.responsavel || linha.Responsável || "";
        const vendedor =
          findVendedorByEmail(responsavel) ||
          (currentRole === "vendedor" ? findVendedorByUserId(currentUserId) : null);

        const userIdRegistro =
          vendedor?.user_id || (currentRole === "vendedor" ? currentUserId : null);

        const status = (
          linha.status ||
          linha.Status ||
          "lead"
        ).toString().toLowerCase().trim();

        const valorOrcamento = Number(
          linha.valor_orcamento || linha.Valor || linha.valor || 0
        );

        const valorComissaoLinha = Number(
          linha.valor_comissao || linha["Valor Comissão"] || 0
        );

        const percentualComissaoLinha = Number(
          linha.percentual_comissao || linha["% Comissão"] || 0
        );

        const comissao = calcularComissaoCongelada({
          valorOrcamento,
          valorComissaoAtual: valorComissaoLinha,
          percentualComissaoAtual: percentualComissaoLinha,
          vendedor,
        });

        const isConcluido = status === "concluido";

return {
  company_id: companyId,
  user_id: userIdRegistro,
  criado_por: currentUserId,
  criado_por_email: user?.email || "",
  numero_os:
    linha.numero_os || linha.OS || `OS-IMPORT-${Date.now()}-${index}`,
  cliente: linha.cliente || linha.Cliente || "",
  titulo: linha.tipo_servico || linha.Serviço || linha.servico || "",
  tipo_servico:
    linha.tipo_servico || linha.Serviço || linha.servico || "",
  valor_orcamento: valorOrcamento,
  custo: Number(linha.custo || linha.Custo || 0),
  valor_comissao: isConcluido ? comissao.valor_comissao : 0,
  percentual_comissao: isConcluido ? comissao.percentual_comissao : 0,
  responsavel: responsavel || vendedor?.email || "",
  origem_lead: linha.origem_lead || linha.Origem || "",
  status,
  data_orcamento:
    linha.data_orcamento || linha.Data || new Date().toISOString(),
  data_fechamento: isConcluido ? new Date().toISOString() : null,
  ultima_compra: isConcluido ? new Date().toISOString() : null,
  telefone: linha.telefone || linha.Telefone || "",
  descricao: linha.descricao || linha.Descrição || "",
  forma_pagamento:
    linha.forma_pagamento || linha["Forma de Pagamento"] || "",
  ativo: true,
};
      });

      const { error } = await supabase.from("servicos").insert(registros);

      if (error) {
        console.error(error);
        alert("Erro ao importar planilha.");
        setImportando(false);
        return;
      }

      alert("Importação concluída com sucesso.");
      await fetchOrcamentos();
    } catch (error) {
      console.error(error);
      alert("Erro ao processar arquivo.");
    } finally {
      setImportando(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white p-6 md:p-10 space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-blue-200">
            Orçamentos
          </h1>
          <p className="text-blue-100/60 mt-2">
            Visualize, filtre, exporte e importe os orçamentos da sua empresa.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={baixarModeloImportacao}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/15 transition"
          >
            <FileDown size={18} />
            Baixar modelo
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 transition font-semibold"
          >
            <FileUp size={18} />
            {importando ? "Importando..." : "Importar"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={importarArquivo}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-8 gap-5">
        <MetricCard
          icon={<Receipt size={18} />}
          title="Total de Orçamentos"
          value={String(resumo.total)}
          subtitle="Registros filtrados"
        />
        <MetricCard
          icon={<DollarSign size={18} />}
          title="Valor Total"
          value={formatarMoeda(resumo.valorTotal)}
          subtitle="Soma dos orçamentos"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          title="Valor Potencial"
          value={formatarMoeda(resumo.valorPotencial)}
          subtitle="Leads em aberto"
        />
        <MetricCard
          icon={<DollarSign size={18} />}
          title="Concluídos"
          value={formatarMoeda(resumo.valorConcluido)}
          subtitle={`${resumo.concluidos} fechados`}
        />
        <MetricCard
          icon={<Users size={18} />}
          title="Em Andamento"
          value={String(resumo.andamento)}
          subtitle="Propostas validadas e andamento"
        />
        <MetricCard
          icon={<CalendarDays size={18} />}
          title="Ticket Médio"
          value={formatarMoeda(resumo.ticketMedio)}
          subtitle="Média dos concluídos"
        />
        <MetricCard
          icon={<Percent size={18} />}
          title="Comissão Potencial"
          value={formatarMoeda(resumo.comissaoTotal)}
          subtitle="Comissão calculada"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          title="Lucro Potencial"
          value={formatarMoeda(resumo.lucroTotal)}
          subtitle="Valor - custo - comissão"
        />
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827] p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Filter size={18} />
          Filtros avançados
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
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="all" className="bg-[#0f172a]">
              Todos status
            </option>
            <option value="lead" className="bg-[#0f172a]">
              Lead
            </option>
            <option value="proposta_enviada" className="bg-[#0f172a]">
              Proposta Enviada
            </option>
            <option value="aguardando_cliente" className="bg-[#0f172a]">
              Aguardando Cliente
            </option>
            <option value="proposta_validada" className="bg-[#0f172a]">
              Proposta Validada
            </option>
            <option value="andamento" className="bg-[#0f172a]">
              Em Andamento
            </option>
            <option value="concluido" className="bg-[#0f172a]">
              Concluído
            </option>
            <option value="cancelado" className="bg-[#0f172a]">
              Cancelado
            </option>
            <option value="recusado" className="bg-[#0f172a]">
              Recusado
            </option>
          </select>

          <select
            value={ativoFiltro}
            onChange={(e) => setAtivoFiltro(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="ativos" className="bg-[#0f172a]">
              Apenas ativos
            </option>
            <option value="inativos" className="bg-[#0f172a]">
              Apenas inativos
            </option>
            <option value="todos" className="bg-[#0f172a]">
              Todos
            </option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <input
            type="number"
            placeholder="Valor mínimo"
            value={valorMin}
            onChange={(e) => setValorMin(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl"
          />

          <input
            type="number"
            placeholder="Valor máximo"
            value={valorMax}
            onChange={(e) => setValorMax(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl"
          />

          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl"
          />

          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl"
          />

          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white"
          >
            <option value="all" className="bg-[#0f172a]">
              Todo período
            </option>
            <option value="hoje" className="bg-[#0f172a]">
              Hoje
            </option>
            <option value="7dias" className="bg-[#0f172a]">
              7 dias
            </option>
            <option value="30dias" className="bg-[#0f172a]">
              30 dias
            </option>
            <option value="mes" className="bg-[#0f172a]">
              Este mês
            </option>
          </select>

          <select
            value={currentRole === "vendedor" ? currentUserId || "all" : vendedorFiltro}
            onChange={(e) => setVendedorFiltro(e.target.value)}
            disabled={currentRole === "vendedor"}
            className="p-3 bg-white/10 border border-white/20 rounded-2xl text-white disabled:opacity-60"
          >
            {currentRole !== "vendedor" && (
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

        <div className="flex flex-wrap justify-between gap-4 pt-2">
          <button
            onClick={limparFiltros}
            className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl hover:bg-white/15 transition"
          >
            <RefreshCcw size={16} />
            Limpar filtros
          </button>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportCSV}
              className="bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-500 transition font-medium"
            >
              CSV
            </button>

            <button
              onClick={exportExcel}
              className="bg-green-600 px-4 py-2 rounded-xl hover:bg-green-500 transition font-medium flex items-center gap-2"
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>

            <button
              onClick={exportPDF}
              className="bg-red-600 px-4 py-2 rounded-xl hover:bg-red-500 transition font-medium"
            >
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]">
        <div className="px-6 py-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-blue-200">
              Lista de Orçamentos
            </h2>
            <p className="text-sm text-white/50">
              {filtrado.length} registro(s) encontrados
            </p>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm text-left min-w-[1450px]">
            <thead className="bg-white/5 text-blue-200 uppercase text-xs">
              <tr>
                <th className="p-4">OS</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Serviço</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Custo</th>
                <th className="p-4">Comissão</th>
                <th className="p-4">% Comissão</th>
                <th className="p-4">Lucro</th>
                <th className="p-4">Responsável</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Status</th>
                <th className="p-4">Ativo</th>
                <th className="p-4">Data</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-white/60">
                    Carregando...
                  </td>
                </tr>
              ) : filtrado.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-white/40">
                    Nenhum orçamento encontrado
                  </td>
                </tr>
              ) : (
                filtrado.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="p-4 font-medium text-white/90">
                      {o.numero_os || "-"}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-white">
                        {o.cliente || "-"}
                      </div>
                    </td>

                    <td className="p-4 text-white/80">
                      {o.tipo_servico || "-"}
                    </td>

                    <td className="p-4 text-cyan-400 font-bold">
                      {formatarMoeda(o.valor_orcamento || 0)}
                    </td>

                    <td className="p-4 text-rose-400 font-medium">
                      {formatarMoeda(o.custo || 0)}
                    </td>

                    <td className="p-4 text-purple-300 font-medium">
                      {formatarMoeda(o.valor_comissao_calculado || 0)}
                    </td>

                    <td className="p-4 text-yellow-300 font-medium">
                      {Number(o.percentual_comissao_calculado || 0).toFixed(1)}%
                    </td>

                    <td className="p-4 text-emerald-400 font-medium">
                      {formatarMoeda(o.lucro_calculado || 0)}
                    </td>

                    <td className="p-4 text-white/80">
                      {o.responsavel || "-"}
                    </td>

                    <td className="p-4 text-white/70">
                      {o.origem_lead || "-"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-xl border text-xs font-semibold ${
                          STATUS_COLORS[o.status || ""] ||
                          "bg-white/10 text-white border-white/20"
                        }`}
                      >
                        {STATUS_LABELS[o.status || ""] || o.status || "-"}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${
                          o.ativo === false ? "bg-red-500" : "bg-green-500"
                        }`}
                        title={o.ativo === false ? "Inativo" : "Ativo"}
                      />
                    </td>

                    <td className="p-4 text-white/70">
                      {formatarData(o.data_orcamento || o.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#111827] to-[#0f172a] border border-[#1f2937] hover:scale-[1.02] transition-all duration-200">
      <div className="flex justify-between text-gray-400 text-sm">
        <span>{title}</span>
        <span className="text-blue-400">{icon}</span>
      </div>

      <div className="mt-4 text-2xl font-bold text-cyan-400">{value}</div>
      <div className="mt-2 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}