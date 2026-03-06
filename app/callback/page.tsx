"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function handleInvite() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // vínculo atual do usuário
      const { data: existingMembership } = await supabase
        .from("company_users")
        .select("id, company_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "accepted")
        .maybeSingle();

      // convite pendente por email
      const { data: invite } = await supabase
        .from("company_users")
        .select("id, company_id, email, role, status")
        .eq("email", user.email)
        .eq("status", "pending")
        .maybeSingle();

      // se não existe convite, segue normal
      if (!invite) {
        router.push("/dashboard");
        return;
      }

      // se existe convite e já existe vínculo em outra empresa, pedir confirmação
      if (
        existingMembership &&
        existingMembership.company_id !== invite.company_id
      ) {
        router.push(`/dashboard/trocar-empresa?inviteId=${invite.id}`);
        return;
      }

      // se não tem vínculo atual, ou o vínculo é da mesma empresa, aceita direto
      await supabase
        .from("company_users")
        .update({
          user_id: user.id,
          status: "accepted",
        })
        .eq("id", invite.id);

      router.push("/dashboard");
    }

    handleInvite();
  }, [router, supabase]);

  return (
    <div className="flex items-center justify-center h-screen text-white">
      Conectando sua conta...
    </div>
  );
}