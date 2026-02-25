"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
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
  const [items, setItems] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const metrics = useMemo(() => {
    const receita = items.reduce(
      (acc, i) => acc + Number(i.valor_orcamento || 0),
      0
    );
    const custo = items.reduce((acc, i) => acc + Number(i.custo || 0), 0);

    return {
      total: items.length,
      receita,
      custo,
      lucro: receita - custo,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-[#0B1B3B] relative overflow-hidden">

      {/* Glow Background */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] bg-blue-600 opacity-20 blur-[180px] rounded-full"></div>
      <div className="absolute bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-indigo-500 opacity-20 blur-[180px] rounded-full"></div>

      <div className="relative z-10 p-14 space-y-14 text-white">

        {/* MÉTRICAS */}
        <div className="grid grid-cols-4 gap-10">
          <Metric title="Total" value={metrics.total} />
          <Metric title="Receita" value={`R$ ${metrics.receita}`} />
          <Metric title="Custos" value={`R$ ${metrics.custo}`} />
          <Metric title="Lucro" value={`R$ ${metrics.lucro}`} />
        </div>

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-semibold tracking-[0.2em] uppercase text-blue-200">
            Pipeline
          </h2>

          <button
            onClick={() => setOpenModal(true)}
            className="bg-blue-600 hover:bg-blue-500 px-7 py-3 rounded-2xl font-medium shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all hover:scale-105"
          >
            + Novo Serviço
          </button>
        </div>

        {/* PIPELINE */}
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex gap-10 overflow-x-auto pb-10 scroll-smooth">
            {columns.map((col) => (
              <Column key={col} id={col} title={col}>
                {items
                  .filter((i) => i.status === col)
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
            <div className="bg-white/10 backdrop-blur-2xl border border-white/20 p-10 rounded-3xl w-[460px] space-y-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)] text-white">
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
      </div>
    </div>
  );
}

/* COLUMN */
function Column({ id, title, children }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-w-[380px]
        p-6
        rounded-3xl
        bg-white/5
        backdrop-blur-xl
        border border-white/10
        shadow-[0_30px_80px_rgba(0,0,0,0.6)]
        transition-all duration-300
        ${isOver ? "scale-[1.03] border-blue-400" : ""}
      `}
      style={{ transform: "perspective(1200px) rotateX(4deg)" }}
    >
      <h3 className="text-xs uppercase tracking-[0.4em] text-blue-300 mb-6 font-semibold">
        {title.replaceAll("_", " ")}
      </h3>
      <div className="space-y-6 min-h-[50px]">{children}</div>
    </div>
  );
}

/* CARD */
function Card({ item, expanded, toggleExpand, atualizarItem, deletar }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: item.id });

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
        p-5 rounded-2xl
        bg-gradient-to-br from-white/20 to-white/5
        backdrop-blur-xl
        border border-white/10
        text-white
        shadow-[0_20px_60px_rgba(0,0,0,0.7)]
        transition-all duration-300
        hover:scale-[1.05] hover:-translate-y-2
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
    <div className="p-8 rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.5)] transition hover:scale-[1.03]">
      <div className="text-xs uppercase tracking-[0.4em] text-blue-200">
        {title}
      </div>
      <div className="text-3xl font-semibold text-white mt-4">
        {value}
      </div>
    </div>
  );
}

/* INPUT */
function Input({ value, onChange, type="text", placeholder="" }: any) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
    />
  );
}