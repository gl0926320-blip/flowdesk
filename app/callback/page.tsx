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

      // 1) Se já existe vínculo pelo user_id, não tenta aceitar convite novamente
      const { data: existingMembership } = await supabase
        .from("company_users")
        .select("id, role, status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingMembership) {
        router.push("/dashboard");
        return;
      }

      // 2) Procura convite pendente pelo email
      const { data: invite } = await supabase
        .from("company_users")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pending")
        .maybeSingle();

      // 3) Se existir convite, vincula o user autenticado e aceita
      if (invite) {
        await supabase
          .from("company_users")
          .update({
            status: "accepted",
            user_id: user.id,
          })
          .eq("id", invite.id);
      }

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