"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Search, TrendingUp, DollarSign, Layers, X } from "lucide-react";

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

export default function LeadsPage() {
  const supabase = createClient();

  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItens, setEditingItens] = useState<any[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [periodo, setPeriodo] = useState<"hoje" | "7dias" | "30dias" | "mes" | "todos">("hoje");
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);

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
  });

  const [itens, setItens] = useState<any[]>([
    { nome: "", quantidade: 1, valor: 0 },
  ]);
  
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
}, []);

    async function load() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  let query = supabase
    .from("servicos")
    .select("*")
    .eq("user_id", userData.user.id);

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
  const updateData: any = { status };

  if (status === "concluido") {
    updateData.ultima_compra = new Date().toISOString();
  }

  await supabase
    .from("servicos")
    .update(updateData)
    .eq("id", id);

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
    (acc, item) => acc + item.quantidade * item.valor,
    0
  );

  async function salvarNovoLead(e: any) {
  e.preventDefault();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const userId = userData.user.id;

  // 🔎 1️⃣ Verifica plano
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  if (profileError) {
    alert("Erro ao verificar plano");
    return;
  }

  const plan = profile?.plan ?? "free";
  const LIMITE_FREE = 5;

  // 🔒 2️⃣ Se for FREE, verifica limite
  if (plan === "free") {
    const { data: servicos, error: erroCount } = await supabase
      .from("servicos")
      .select("id")
      .eq("user_id", userId);

    if (erroCount) {
      alert("Erro ao verificar limite");
      return;
    }

    if (servicos && servicos.length >= LIMITE_FREE) {
      setOpenModal(false);
      setShowUpgrade(true);
      // ou melhor ainda: criar o mesmo modal showUpgrade da pipeline
      return;
    }
  }

  // 3️⃣ Se passou na validação, salva
  const { error } = await supabase.from("servicos").insert([
    {
      user_id: userId,
      titulo: form.cliente,
      descricao: form.descricao,
      status: "lead",
      cliente: form.cliente,
      origem_lead: form.origem_lead,
      telefone: form.telefone,
      responsavel: form.responsavel,
      valor_orcamento: totalOrcamento,
      itens,
      tipo_pessoa: form.tipo_pessoa,
      cpf: form.cpf,
      cnpj: form.cnpj,
      forma_pagamento: form.forma_pagamento,
      entrega: form.entrega,
      tipo_servico: form.tipo_servico,
      observacoes: form.observacoes,
    },
  ]);

  if (error) {
    alert("Erro ao salvar");
    return;
  }

  setOpenModal(false);
  load();
}

  const filtered = useMemo(() => {
  const now = new Date();

 

  const filtradoPorPeriodo = items.filter((item) => {
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

  return filtradoPorPeriodo.filter((i) =>
    i.cliente?.toLowerCase().includes(search.toLowerCase())
  );
}, [items, search, periodo]);
  function contarCompras(cliente: string) {
  return items.filter(
    (i) => i.cliente === cliente && i.status === "concluido"
  ).length;
}
  const metrics = useMemo(() => {
    const total = filtered.length;
    const receita = filtered.reduce(
      (acc, i) => acc + Number(i.valor_orcamento || 0),
      0
    );
    const concluidos = filtered.filter(
      (i) => i.status === "concluido"
    ).length;

    return {
      total,
      receita: receita.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      concluidos,
      conversao:
        total > 0
          ? `${Math.round((concluidos / total) * 100)}%`
          : "0%",
    };
  }, [filtered]);
  const funnelData = useMemo(() => {
  const counts: Record<string, number> = {};

  STATUS_COLUMNS.forEach((status) => {
    counts[status] = filtered.filter(
      (i) => i.status === status
    ).length;
  });

  const totalLeads = filtered.length;

  return STATUS_COLUMNS.map((status) => {
    const value = counts[status];
    const percentage =
      totalLeads > 0
        ? Math.round((value / totalLeads) * 100)
        : 0;

    return {
      status,
      label: STATUS_LABELS[status],
      value,
      percentage,
    };
  });
}, [filtered]);
      function EditableField({
    label,
    value,
    field,
  }: any) {
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
  // ===== FUNÇÕES PARA EDITAR ITENS DO ORÇAMENTO =====

function atualizarItemEditado(index: number, campo: string, valor: any) {
  const novos = [...editingItens];
  novos[index][campo] = valor;
  setEditingItens(novos);
}

function removerItemEditado(index: number) {
  const novos = editingItens.filter((_, i) => i !== index);
  setEditingItens(novos);
}

function adicionarItemEditado() {
  setEditingItens([
    ...editingItens,
    { nome: "", quantidade: 1, valor: 0 },
  ]);
}
  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white p-12 space-y-10">

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-blue-200">
            Gestão de Leads
          </h1>
          <p className="text-blue-100/60 mt-2">
            CRM Comercial Profissional
          </p>
        </div>

        <button
          onClick={() => setOpenModal(true)}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 font-bold shadow-lg hover:scale-105 transition"
        >
          + Novo Orçamento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <Metric icon={<Layers />} title="Total Leads" value={metrics.total} />
        <Metric icon={<DollarSign />} title="Receita Potencial" value={metrics.receita} />
        <Metric icon={<TrendingUp />} title="Concluídos" value={metrics.concluidos} />
        <Metric icon={<TrendingUp />} title="Taxa Conversão" value={metrics.conversao} />
      </div>
        {/* 🔥 FUNIL DE CONVERSÃO */}
<div className="w-full bg-[#0f172a] border border-white/10 rounded-3xl p-8 mt-8">
  <h3 className="text-lg font-bold text-cyan-400 mb-6">
    Funil de Conversão
  </h3>

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
      <div className="flex items-center bg-white/10 border border-white/20 px-5 py-3 rounded-2xl w-[400px]">
    
        <Search size={18} className="text-blue-200" />
        <input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent outline-none ml-3 w-full text-white"
        />
      </div>
          {/* FILTRO DE PERÍODO */}
<div className="flex gap-3 mt-6 flex-wrap">
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
    <div className="flex items-center gap-3 mt-4">
  <input
    type="date"
    value={dataSelecionada || ""}
    onChange={(e) => {
      setDataSelecionada(e.target.value);
      setPeriodo("todos"); // desativa filtro automático
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
      <div className="flex gap-3 mt-6 mb-4">
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
      {/* 🔵 FIM DOS BOTÕES 🔵 */}
      <div className="rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#111827]">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-blue-200 uppercase text-xs">
            <tr>
              <th className="p-4">Cliente</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Documento</th>
              <th className="p-4">Serviço</th>
              <th className="p-4">Pagamento</th>
              <th className="p-4">Entrega</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Sem Comprar</th>
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
                <td className="p-4">
                  {item.tipo_pessoa === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
                </td>
                <td className="p-4 text-xs">
                  {item.tipo_pessoa === "pf" ? item.cpf || "-" : item.cnpj || "-"}
                </td>
                <td className="p-4">{item.tipo_servico || "-"}</td>
                <td className="p-4">{item.forma_pagamento || "-"}</td>
                <td className="p-4">
                  {item.entrega ? "Sim" : "Não"}
                </td>
                <td className="p-4 text-green-400 font-bold">
                  {Number(item.valor_orcamento || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </td>
                <td className="p-4 text-xs">
  {item.ultima_compra ? (
    (() => {
      const dias = Math.floor(
        (Date.now() - new Date(item.ultima_compra).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      return (
        <span
          className={
            dias > 60
              ? "text-red-400 font-bold"
              : "text-yellow-300"
          }
        >
          {dias} dias
        </span>
      );
    })()
  ) : (
    <span className="text-yellow-300">Nunca comprou</span>
  )}
</td>


{/* STATUS */}
<td className="p-4">
  <select
    value={item.status}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) =>
      atualizarStatus(item.id, e.target.value)
    }
    className={`px-3 py-2 rounded-xl border text-sm font-semibold ${STATUS_COLORS[item.status]}`}
  >
    {STATUS_COLUMNS.map((col) => (
      <option key={col} value={col} className="bg-[#0f172a]">
        {STATUS_LABELS[col]}
      </option>
    ))}
  </select>
</td>

{/* COMPRAS */}
<td className="p-4 text-cyan-400 font-bold">
  {contarCompras(item.cliente)}x
</td>

{/* ATIVO */}
<td className="p-4 text-center">
  <span
    title={item.ativo ? "Lead Ativo" : "Lead Inativo"}
    className={`inline-block w-3 h-3 rounded-full ${
      item.ativo ? "bg-green-500" : "bg-red-500"
    }`}
  ></span>
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

            <h2 className="text-2xl font-bold mb-6">
              Novo Orçamento Completo
            </h2>

            <form onSubmit={salvarNovoLead} className="space-y-4">

              <input required placeholder="Cliente"
                onChange={(e)=>setForm({...form, cliente:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input placeholder="Origem do Lead"
                onChange={(e)=>setForm({...form, origem_lead:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input placeholder="Telefone"
                onChange={(e)=>setForm({...form, telefone:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input placeholder="Responsável"
                onChange={(e)=>setForm({...form, responsavel:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <select
                value={form.tipo_pessoa}
                onChange={(e)=>setForm({...form, tipo_pessoa:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              >
                <option value="pf">Pessoa Física</option>
                <option value="pj">Pessoa Jurídica</option>
              </select>

              {form.tipo_pessoa === "pf" ? (
                <input placeholder="CPF"
                  onChange={(e)=>setForm({...form, cpf:e.target.value})}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
                />
              ) : (
                <input placeholder="CNPJ"
                  onChange={(e)=>setForm({...form, cnpj:e.target.value})}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
                />
              )}

              <input placeholder="Tipo de Serviço"
                onChange={(e)=>setForm({...form, tipo_servico:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <input placeholder="Forma de Pagamento"
                onChange={(e)=>setForm({...form, forma_pagamento:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <label className="flex items-center gap-2">
                <input type="checkbox"
                  onChange={(e)=>setForm({...form, entrega:e.target.checked})}
                />
                Possui Entrega?
              </label>

              <textarea placeholder="Descrição do que o cliente precisa"
                onChange={(e)=>setForm({...form, descricao:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <textarea placeholder="Observações Comerciais"
                onChange={(e)=>setForm({...form, observacoes:e.target.value})}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
              />

              <h3 className="font-bold text-lg pt-4">Itens do Orçamento</h3>

              {itens.map((item,index)=>(
                <div key={index} className="grid grid-cols-3 gap-3">
                  <input placeholder="Item"
                    onChange={(e)=>atualizarItem(index,"nome",e.target.value)}
                    className="p-2 rounded-lg bg-white/10"
                  />
                  <input type="number" placeholder="Qtd"
                    onChange={(e)=>atualizarItem(index,"quantidade",Number(e.target.value))}
                    className="p-2 rounded-lg bg-white/10"
                  />
                  <input type="number" placeholder="Valor"
                    onChange={(e)=>atualizarItem(index,"valor",Number(e.target.value))}
                    className="p-2 rounded-lg bg-white/10"
                  />
                </div>
              ))}

              <button type="button" onClick={adicionarItem} className="text-blue-400">
                + Adicionar Item
              </button>

              <div className="text-right text-xl font-bold text-green-400">
                Total: {totalOrcamento.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
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
        <div><strong>Entrega:</strong> {selectedLead.entrega ? "Sim" : "Não"}</div>

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
    <p className="text-gray-300">
      {selectedLead.descricao || "-"}
    </p>
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
    <p className="text-gray-300">
      {selectedLead.observacoes || "-"}
    </p>
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
  <div className="mt-6 space-y-3">

    <button
      onClick={async () => {
        const novoTotal = editingItens.reduce(
          (acc, item) => acc + item.quantidade * item.valor,
          0
        );

        await supabase
          .from("servicos")
          .update({
            ...selectedLead,
            itens: editingItens,
            valor_orcamento: novoTotal,
          })
          .eq("id", selectedLead.id);

        setIsEditing(false);
        load();
      }}
      className="w-full py-3 bg-green-600 rounded-xl font-bold"
    >
      Salvar Alterações
    </button>

    <button
      onClick={async () => {
        await supabase
          .from("servicos")
          .update({ ativo: false })
          .eq("id", selectedLead.id);

        setSelectedLead(null);
        load();
      }}
      className="w-full py-3 bg-red-600 rounded-xl font-bold"
    >
      Inativar Lead
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