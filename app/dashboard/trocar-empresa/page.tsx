"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function TrocarEmpresaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [empresaAtual, setEmpresaAtual] = useState<string>("");
  const [novaEmpresa, setNovaEmpresa] = useState<string>("");

  useEffect(() => {
    async function load() {
      const id = searchParams.get("inviteId");
      if (!id) {
        router.push("/dashboard");
        return;
      }

      setInviteId(id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: currentMembership } = await supabase
        .from("company_users")
        .select("company_id, companies(name)")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();

      const { data: invite } = await supabase
        .from("company_users")
        .select("company_id, companies(name)")
        .eq("id", id)
        .eq("status", "pending")
        .maybeSingle();

      setEmpresaAtual((currentMembership as any)?.companies?.name || "");
      setNovaEmpresa((invite as any)?.companies?.name || "");

      setLoading(false);
    }

    load();
  }, [router, searchParams, supabase]);

  async function aceitarTroca() {
    if (!inviteId) return;

    setProcessando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // pega convite
    const { data: invite } = await supabase
      .from("company_users")
      .select("id, company_id")
      .eq("id", inviteId)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite) {
      setProcessando(false);
      router.push("/dashboard");
      return;
    }

    // remove vínculo atual do usuário
    await supabase
      .from("company_users")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "accepted");

    // aceita o novo convite
    await supabase
      .from("company_users")
      .update({
        user_id: user.id,
        status: "accepted",
      })
      .eq("id", inviteId);

    setProcessando(false);
    router.push("/dashboard");
  }

  async function cancelarTroca() {
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0B1120] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
        <h1 className="text-2xl font-bold mb-4">Convite para nova empresa</h1>

        <p className="text-gray-300 mb-6">
          Você foi convidado para entrar em outra empresa.
        </p>

        <div className="space-y-3 mb-8">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <span className="text-xs text-gray-400 block mb-1">Empresa atual</span>
            <span className="font-semibold">{empresaAtual || "Não definida"}</span>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
            <span className="text-xs text-gray-400 block mb-1">Nova empresa</span>
            <span className="font-semibold">{novaEmpresa || "Não definida"}</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 mb-8 text-sm text-amber-200">
          Ao aceitar, você perderá o vínculo com sua empresa atual e passará a fazer parte da nova empresa.
        </div>

        <div className="flex gap-4 justify-end">
          <button
            onClick={cancelarTroca}
            className="px-5 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
          >
            Cancelar
          </button>

          <button
            onClick={aceitarTroca}
            disabled={processando}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition font-semibold disabled:opacity-60"
          >
            {processando ? "Processando..." : "Aceitar e trocar de empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}