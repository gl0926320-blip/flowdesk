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

      // procura convite pelo email
      const { data: invite } = await supabase
        .from("company_users")
        .select("*")
        .eq("email", user.email)
        .eq("status", "pending")
        .single();

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
  }, []);

  return (
    <div className="flex items-center justify-center h-screen text-white">
      Conectando sua conta...
    </div>
  );
}