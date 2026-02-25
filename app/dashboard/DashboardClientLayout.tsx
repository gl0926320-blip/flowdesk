"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { LayoutDashboard, Users, FileText, Kanban, Settings, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();

  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    async function carregarPlano() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      if (profile?.plan) {
        setPlan(profile.plan);
      }
    }

    carregarPlano();
  }, []);

  const menu = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
    { name: "Orçamentos", href: "/dashboard/orcamentos", icon: FileText },
    { name: "Clientes", href: "/dashboard/clientes", icon: Users },
    { name: "Assinatura", href: "/dashboard/billing", icon: CreditCard },
    { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white">
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0B1120] border-r border-white/10 flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-white/10">
          FlowDesk
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade Card */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-blue-600/20 border border-blue-500/30 p-4 rounded-xl">
            <p className="text-sm font-semibold mb-2">
              Plano {plan === "pro" ? "Pro 🚀" : "Free"}
            </p>

            {plan !== "pro" && (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Desbloqueie recursos ilimitados
                </p>
                <Link
                  href="/dashboard/billing"
                  className="block text-center bg-blue-600 hover:bg-blue-700 p-2 rounded-lg text-sm font-semibold transition"
                >
                  Fazer Upgrade
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <header className="h-16 bg-[#0B1120] border-b border-white/10 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">Área Restrita</h1>

          <div className="flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-xs ${
                plan === "pro"
                  ? "bg-purple-600/20 text-purple-400"
                  : "bg-green-600/20 text-green-400"
              }`}
            >
              Plano {plan === "pro" ? "Pro 🚀" : "Free"}
            </span>

            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center font-bold">
              G
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1 p-8 bg-[#0F172A]">
          {children}
        </main>
      </div>
    </div>
  );
}