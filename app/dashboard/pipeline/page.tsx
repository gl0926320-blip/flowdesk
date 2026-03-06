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
];

type Vendedor = {
  user_id: string;
  email: string;
  role: string;
  status: string;
};

export default function Pipeline() {
  const supabase = createClient();

  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
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

  async function load() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const currentUserId = data.user.id;
    setUserId(currentUserId);

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role")
      .eq("user_id", currentUserId)
      .eq("status", "accepted")
      .maybeSingle();

    if (!companyUser?.company_id) return;

    setCompanyId(companyUser.company_id);
    setRole(companyUser.role);

    const { data: vendedoresData } = await supabase
      .from("company_users")
      .select("user_id, email, role, status")
      .eq("company_id", companyUser.company_id)
      .eq("status", "accepted")
      .order("email", { ascending: true });

    setVendedores((vendedoresData as Vendedor[]) || []);

    let query = supabase
      .from("servicos")
      .select("*")
      .eq("company_id", companyUser.company_id)
      .eq("ativo", true);

    if (companyUser.role === "vendedor") {
      query = query.eq("user_id", currentUserId);
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
    if (!userId || !companyId) return;

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

    const plan = profile?.plan ?? "free";
    const LIMITE_FREE = 5;

    if (plan === "free") {
      const { data: servicos, error: erroCount } = await supabase
        .from("servicos")
        .select("id")
        .eq("company_id", companyId)
        .eq("ativo", true);

      if (erroCount) {
        alert("Erro ao verificar limite");
        return;
      }

      if (servicos && servicos.length >= LIMITE_FREE) {
        setShowUpgrade(true);
        return;
      }
    }

    const meuVinculo = vendedores.find((v) => v.user_id === userId);

    const novo = {
      user_id: userId,
      company_id: companyId,
      numero_os: `OS-${Date.now()}`,
      cliente: form.cliente,
      origem_lead: form.origem_lead,
      telefone: form.telefone,
      titulo: form.tipo_servico,
      descricao: form.descricao,
      tipo_servico: form.tipo_servico,
      valor_orcamento: Number(form.valor_orcamento),
      custo: Number(form.custo),
      status: form.status,
      temperatura: form.temperatura,
      responsavel: meuVinculo?.email || "",
      ativo: true,
    };

    const { data, error } = await supabase
      .from("servicos")
      .insert([novo])
      .select();

    if (error) {
      alert(error.message);
      return;
    }

    if (data) {
      setItems((prev) => [data[0], ...prev]);
      setOpenModal(false);
      resetForm();
    }
  }

  async function atualizarItem(id: string, updated: any) {
    await supabase
      .from("servicos")
      .update(updated)
      .eq("id", id)
      .eq("company_id", companyId);

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...updated } : i))
    );
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

  const itensFiltrados = useMemo(() => {
    const agora = new Date();

    return items.filter((item) => {
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
              dataItem >= new Date(dataInicio) && dataItem <= new Date(dataFim)
            );

          default:
            return true;
        }
      })();

      if (!passouPeriodo) return false;

      if (filtroVendedor !== "todos" && item.user_id !== filtroVendedor) {
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
  }, [items, filtro, dataInicio, dataFim, filtroVendedor, filtroTemperatura, busca]);

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
      (acc, i) => acc + Number(i.valor_comissao || 0),
      0
    );

    const quentes = ativos.filter(
      (i) => (i.temperatura || "morno") === "quente"
    ).length;

    return {
      total: ativos.length,
      quentes,
      receita: receita.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      custo: custo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
      lucro: (receita - custo - comissao).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
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
                <option value="todos" className="text-black">
                  Todos os vendedores
                </option>
              )}

              {vendedores
                .filter((v) => v.role === "vendedor" || v.role === "owner" || v.role === "admin")
                .map((vendedor) => (
                  <option
                    key={vendedor.user_id}
                    value={vendedor.user_id}
                    className="text-black"
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
              <option value="todos" className="text-black">
                Todas temperaturas
              </option>
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
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <Metric icon={<Layers size={18} />} title="Total" value={metrics.total} />
          <Metric
            icon={<Thermometer size={18} />}
            title="Leads Quentes"
            value={metrics.quentes}
          />
          <Metric icon={<DollarSign size={18} />} title="Receita" value={metrics.receita} />
          <Metric icon={<BarChart3 size={18} />} title="Custos" value={metrics.custo} />
          <Metric icon={<TrendingUp size={18} />} title="Lucro" value={metrics.lucro} />
        </div>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-semibold tracking-[0.2em] uppercase text-blue-200">
              Pipeline
            </h2>
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
              const itensDaColuna = itensFiltrados.filter(
                (i) => i.status === col && i.ativo === true
              );

              return (
                <Column
                  key={col}
                  id={col}
                  title={col}
                  count={itensDaColuna.length}
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

              <Input
                placeholder="Origem do Lead"
                value={form.origem_lead}
                onChange={(v) => setForm({ ...form, origem_lead: v })}
              />

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
function Column({ id, title, children, count }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });

  function getColumnStyle(columnId: string) {
    switch (columnId) {
      case "lead":
        return "from-sky-600/40 to-sky-500/10 border-sky-400/40 text-sky-200";
      case "proposta_enviada":
        return "from-yellow-600/40 to-yellow-500/10 border-yellow-400/40 text-yellow-200";
      case "aguardando_cliente":
        return "from-purple-600/40 to-purple-500/10 border-purple-400/40 text-purple-200";
      case "proposta_validada":
        return "from-emerald-600/40 to-emerald-500/10 border-emerald-400/40 text-emerald-200";
      case "andamento":
        return "from-orange-600/40 to-orange-500/10 border-orange-400/40 text-orange-200";
      case "concluido":
        return "from-green-600/40 to-green-500/10 border-green-400/40 text-green-200";
      default:
        return "from-blue-600/40 to-blue-500/10 border-blue-400/40 text-blue-200";
    }
  }

  const colorStyle = getColumnStyle(id);

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
      </div>

      <div className="space-y-6 min-h-[50px]">{children}</div>
    </div>
  );
}

/* CARD */
function Card({ item, expanded, toggleExpand, atualizarItem, deletar }: any) {
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

  const lucro =
    Number(item.valor_orcamento || 0) - Number(item.custo || 0);

  function salvarEdicao() {
    atualizarItem(item.id, local);
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

              <Input
                placeholder="Origem do Lead"
                value={local.origem_lead || ""}
                onChange={(v) => setLocal({ ...local, origem_lead: v })}
              />

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
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Responsável</p>
                  <p>{item.responsavel || "Não definido"}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Telefone</p>
                  <p>{item.telefone || "Não informado"}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Temperatura</p>
                  <p>
                    {temperatura === "frio"
                      ? "Frio"
                      : temperatura === "quente"
                      ? "Quente"
                      : "Morno"}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Custo</p>
                  <p>{formatMoney(Number(item.custo || 0))}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 col-span-2">
                  <p className="text-[11px] text-gray-400">Origem do Lead</p>
                  <p>{item.origem_lead || "Não informada"}</p>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-[11px] text-gray-400 mb-1">Descrição</p>
                <p>{item.descricao || "Sem descrição"}</p>
              </div>

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