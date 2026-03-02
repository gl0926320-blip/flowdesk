  "use client";

  import { useEffect, useState, useMemo } from "react";
  import { createClient } from "@/lib/supabase-browser";
  import {
    DndContext,
    useDraggable,
    useDroppable,
    closestCorners,
  } from "@dnd-kit/core";
  import { CSS } from "@dnd-kit/utilities";

  const columns = [
    "lead",
    "proposta_enviada",
    "aguardando_cliente",
    "proposta_validada",
    "andamento",
    "concluido",
  ];

  export default function Pipeline() {
    const supabase = createClient();
    const [items, setItems] = useState<any[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [openModal, setOpenModal] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [filtro, setFiltro] = useState<"hoje" | "7dias" | "30dias" | "mes" | "custom">("hoje");
    const [dataInicio, setDataInicio] = useState<string | null>(null);
    const [dataFim, setDataFim] = useState<string | null>(null);

    const [form, setForm] = useState({
      cliente: "",
      tipo_servico: "",
      descricao: "",
      valor_orcamento: "",
      custo: "",
      status: "lead",
    });

    useEffect(() => {
      async function load() {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;

        setUserId(data.user.id);

        const { data: servicos } = await supabase
          .from("servicos")
          .select("*")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false });

        if (servicos) setItems(servicos);
      }

      load();
    }, []);

    function resetForm() {
      setForm({
        cliente: "",
        tipo_servico: "",
        descricao: "",
        valor_orcamento: "",
        custo: "",
        status: "lead",
      });
    }

  async function salvar() {
    if (!userId) return;

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

    // 🔒 Só aplica limite se for FREE
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
        setShowUpgrade(true);
        return;
      }
    }

    const novo = {
  user_id: userId,
  numero_os: `OS-${Date.now()}`,
  cliente: form.cliente,
  titulo: form.tipo_servico,
  descricao: form.descricao,
  tipo_servico: form.tipo_servico,
  valor_orcamento: Number(form.valor_orcamento),
  custo: Number(form.custo),
  status: form.status,
  ativo: true, // 🔥 IMPORTANTE
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
      await supabase.from("servicos").update(updated).eq("id", id);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...updated } : i))
      );
    }

    async function deletar(id: string) {
      await supabase.from("servicos").delete().eq("id", id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    }

    function handleDragEnd(event: any) {
      const { active, over } = event;
      if (!over) return;
      atualizarItem(active.id, { status: over.id });
    }

    const itensFiltrados = useMemo(() => {
  const agora = new Date();

  return items.filter((item) => {
    if (!item.created_at) return true;

    const dataItem = new Date(item.created_at);

    switch (filtro) {
      case "hoje":
        return dataItem.toDateString() === agora.toDateString();

      case "7dias":
        return dataItem >= new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

      case "30dias":
        return dataItem >= new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

      case "mes":
        return (
          dataItem.getMonth() === agora.getMonth() &&
          dataItem.getFullYear() === agora.getFullYear()
        );

      case "custom":
        if (!dataInicio || !dataFim) return true;
        return (
          dataItem >= new Date(dataInicio) &&
          dataItem <= new Date(dataFim)
        );

      default:
        return true;
    }
  });
}, [items, filtro, dataInicio, dataFim]);

   const metrics = useMemo(() => {

  // ✅ SOMENTE ativos verdadeiros
  const ativos = itensFiltrados.filter(i => i.ativo === true);

  const concluidos = ativos.filter(i => i.status === "concluido");

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

  return {
    total: ativos.length,
    receita: receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    custo: custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
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
      {["hoje","7dias","30dias","mes"].map((tipo) => (
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
        onClick={() => setFiltro("custom")}
        className={`px-4 py-2 rounded-xl border transition text-sm ${
  filtro === "custom"
    ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30"
    : "bg-white/10 border-white/20 hover:bg-white/20"
}`}
      >
        Personalizado
      </button>

      {filtro === "custom" && (
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

        {/* Glow Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_60%)]" />

        <div className="relative z-10 p-6 md:p-14 space-y-10 md:space-y-14 text-white">

          <FiltroPeriodo
  filtro={filtro}
  setFiltro={setFiltro}
  setDataInicio={setDataInicio}
  setDataFim={setDataFim}
/>

          {/* MÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Metric title="Total" value={metrics.total} />
            <Metric title="Receita" value={` ${metrics.receita}`} />
            <Metric title="Custos" value={` ${metrics.custo}`} />
            <Metric title="Lucro" value={` ${metrics.lucro}`} />
          </div>

          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
            <h2 className="text-3xl font-semibold tracking-[0.2em] uppercase text-blue-200">
              Pipeline
            </h2>

            <button
              onClick={() => setOpenModal(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-7 py-3 rounded-xl font-semibold shadow-[0_10px_30px_rgba(59,130,246,0.4)] transition-all duration-200 hover:scale-[1.03]"
            >
              + Novo Serviço
            </button>
          </div>

          {/* PIPELINE */}
          <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex flex-wrap gap-6 md:gap-10 pb-6 md:pb-10">
              {columns.map((col) => (
                <Column key={col} id={col} title={col}>
                  {itensFiltrados
  .filter((i) => i.status === col && i.ativo === true)
                    .map((item) => (
                      <Card
                        key={item.id}
                        item={item}
                        expanded={expandedId === item.id}
                        toggleExpand={() =>
                          setExpandedId(
                            expandedId === item.id ? null : item.id
                          )
                        }
                        atualizarItem={atualizarItem}
                        deletar={deletar}
                      />
                    ))}
                </Column>
              ))}
            </div>
          </DndContext>

          {/* MODAL */}
          {openModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
              <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-3xl w-[90%] max-w-[460px] space-y-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white">
                <h3 className="text-xl font-semibold text-blue-200">
                  Novo Serviço
                </h3>

                <Input placeholder="Cliente" value={form.cliente} onChange={(v)=>setForm({...form,cliente:v})}/>
                <Input placeholder="Tipo Serviço" value={form.tipo_servico} onChange={(v)=>setForm({...form,tipo_servico:v})}/>
                <Input placeholder="Descrição" value={form.descricao} onChange={(v)=>setForm({...form,descricao:v})}/>
                <Input type="number" placeholder="Valor" value={form.valor_orcamento} onChange={(v)=>setForm({...form,valor_orcamento:v})}/>
                <Input type="number" placeholder="Custo" value={form.custo} onChange={(v)=>setForm({...form,custo:v})}/>

                <div className="flex justify-end gap-4 pt-4">
                  <button onClick={()=>setOpenModal(false)} className="px-5 py-2 rounded-xl border border-white/30 hover:bg-white/10 transition">
                    Cancelar
                  </button>

                  <button onClick={salvar} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl transition">
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
  function Column({ id, title, children }: any) {
    const { setNodeRef, isOver } = useDroppable({ id });

    const count = Array.isArray(children) ? children.length : 0;

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
  relative
rounded-3xl
bg-[#0f172a]
border border-[#1e293b]
shadow-[0_15px_50px_rgba(0,0,0,0.6)]
  transition-all duration-300
  ${isOver ? "scale-[1.02] border-blue-500 shadow-[0_20px_70px_rgba(59,130,246,0.3)]" : ""}
`}
      >
          {/* 🔥 BARRA SUPERIOR */}
  <div
    className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-3xl bg-gradient-to-r ${colorStyle}`}
  />

  <div className="flex items-center justify-between mb-6"></div>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            
            {/* Título */}
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

            {/* Contador */}
            <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-xs font-medium text-white">
              {count}
            </div>

          </div>
        </div>

        <div className="space-y-6 min-h-[50px]">
          {children}
        </div>
      </div>
    );
  }

  /* CARD */
  function Card({ item, expanded, toggleExpand, atualizarItem, deletar }: any) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({ 
  id: item.id,
  disabled: item.ativo === false
});

    const style = {
      transform: CSS.Translate.toString(transform),
      zIndex: isDragging ? 50 : "auto",
    };

    const [editMode, setEditMode] = useState(false);
    const [local, setLocal] = useState(item);

    function salvarEdicao() {
      atualizarItem(item.id, local);
      setEditMode(false);
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
       className={`
  p-4 md:p-5 rounded-2xl
  backdrop-blur-xl
  border
  text-white
  shadow-[0_20px_60px_rgba(0,0,0,0.7)]
  transition-all duration-300
  hover:scale-[1.05] hover:-translate-y-2

  ${
    item.ativo === false
      ? "bg-gradient-to-br from-red-900/60 to-red-700/30 border-red-500/40 opacity-70"
      : "bg-gradient-to-br from-white/20 to-white/5 border-white/10"
  }

  ${isDragging ? "scale-[1.08] rotate-1 shadow-[0_40px_100px_rgba(0,0,0,0.9)]" : ""}
`}
      >
        <div {...listeners} {...attributes} className="cursor-grab font-medium flex justify-between">
          <span>{item.cliente}</span>
          <span className="text-blue-300 font-semibold">
            R$ {item.valor_orcamento}
          </span>
        </div>

        <div onClick={toggleExpand} className="text-xs text-blue-200 mt-3 cursor-pointer">
          {expanded ? "Fechar ↑" : "Detalhes ↓"}
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 text-sm text-blue-100">
            {editMode ? (
              <>
                <Input value={local.cliente} onChange={(v)=>setLocal({...local,cliente:v})}/>
                <Input value={local.descricao} onChange={(v)=>setLocal({...local,descricao:v})}/>
                <Input type="number" value={local.valor_orcamento} onChange={(v)=>setLocal({...local,valor_orcamento:v})}/>
                <Input type="number" value={local.custo} onChange={(v)=>setLocal({...local,custo:v})}/>

{/* 🔥 NOVO CAMPO DE STATUS */}
<select
  value={local.status}
  onChange={(e) =>
    setLocal({ ...local, status: e.target.value })
  }
  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
>
  {columns.map((col) => (
    <option key={col} value={col} className="bg-[#0f172a]">
      {col.replaceAll("_", " ").toUpperCase()}
    </option>
  ))}
</select>

<button onClick={salvarEdicao} className="w-full bg-blue-600 py-2 rounded-xl">
  Salvar Alterações
</button>
              </>
            ) : (
              <>
                <div>{item.descricao}</div>
                <div>Custo: R$ {item.custo}</div>
                <div className="flex gap-3 pt-2">
                  <button onClick={()=>setEditMode(true)} className="flex-1 bg-blue-600 py-2 rounded-xl">
                    Editar
                  </button>
                  <button onClick={()=>deletar(item.id)} className="flex-1 bg-red-600 py-2 rounded-xl">
                    Deletar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* METRIC */
  function Metric({ title, value }: any) {
  return (
    <div className="
      p-6 sm:p-8
      rounded-2xl
      bg-gradient-to-br from-[#111827] to-[#0f172a]
      border border-[#1f2937]
      shadow-[0_10px_40px_rgba(0,0,0,0.6)]
      hover:border-blue-500/40
      transition-all duration-300
      min-h-[120px]
      flex flex-col justify-center
    ">
      
      <div className="text-xs uppercase tracking-widest text-gray-500">
        {title}
      </div>

      <div className="
        mt-3
        font-extrabold
        leading-none
        tracking-tight
        text-2xl
        sm:text-3xl
        md:text-4xl
        lg:text-5xl
        break-words
        bg-gradient-to-r from-blue-400 to-cyan-300
        bg-clip-text
        text-transparent
      ">
        {value}
      </div>

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