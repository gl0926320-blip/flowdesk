"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  Kanban,
  Settings,
  CreditCard,
  Menu,
  MessageCircle,
  UserPlus,
  DollarSign,
  Percent,
  Users2,
  BriefcaseBusiness,
  Megaphone,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type MenuItem = {
  name: string;
  href?: string;
  icon: LucideIcon;
  children?: {
    name: string;
    href: string;
  }[];
  visible?: boolean;
};

type Membership = {
  company_id: string;
  role: string;
  status?: string;
  email?: string;
  user_id?: string | null;
  companies?: {
    name?: string | null;
    plan?: string | null;
  } | null;
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isMasterPage = pathname.startsWith("/dashboard/master");
  const supabase = createClient();

  const [empresa, setEmpresa] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [role, setRole] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loadedMembership, setLoadedMembership] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Campanhas: pathname.startsWith("/dashboard/campanhas"),
  });

  const inicial = email ? email.charAt(0).toUpperCase() : "";

  const roleLabel =
    role === "owner"
      ? "Owner"
      : role === "admin"
      ? "Admin"
      : role === "vendedor"
      ? "Vendedor"
      : "";

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function getMembership(userId: string): Promise<Membership | null> {
    const { data, error } = await supabase
      .from("company_users")
      .select("company_id, role, status, email, user_id, companies(name, plan), created_at")
      .eq("user_id", userId)
      .eq("status", "ativo")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar vínculo ativo por user_id:", error);
      return null;
    }

    if (!data || data.length === 0) {
      console.error("Nenhum vínculo ativo encontrado para o user_id:", userId);
      return null;
    }

    if (data.length > 1) {
      console.error("Usuário com múltiplos vínculos ativos:", data);
      alert("Este usuário possui múltiplos vínculos ativos. Corrija isso na base.");
      return null;
    }

    return data[0] as Membership;
  }

  async function carregarPlanoEMembership() {
    setLoadedMembership(false);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      setEmail("");
      setEmpresa("");
      setCompanyId(null);
      setRole("");
      setPlan("free");
      setLoadedMembership(true);
      return;
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    setEmail(userEmail);

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    const membership = await getMembership(user.id);

    if (membership?.company_id) {
      setCompanyId(membership.company_id || null);
      setRole(membership.role || "");
      setEmpresa(membership?.companies?.name || "");
      setPlan(membership?.companies?.plan || profile?.plan || "free");
    } else {
      setCompanyId(null);
      setRole("");
      setEmpresa("");
      setPlan(profile?.plan || "free");
    }

    setLoadedMembership(true);
  }

  useEffect(() => {
    carregarPlanoEMembership();

    const onFocus = () => carregarPlanoEMembership();
    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/dashboard/campanhas") && role !== "vendedor") {
      setOpenMenus((prev) => ({
        ...prev,
        Campanhas: true,
      }));
    }
  }, [pathname, role]);

  useEffect(() => {
    if (!loadedMembership) return;

    if (pathname.startsWith("/dashboard/empresas") && role !== "owner") {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/campanhas") && role === "vendedor") {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/billing") && role === "vendedor") {
      router.replace("/dashboard");
      return;
    }
  }, [pathname, role, loadedMembership, router]);

  function toggleMenu(menuName: string) {
    setOpenMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  }

  const menu: MenuItem[] = useMemo(
    () =>
      [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Leads", href: "/dashboard/leads", icon: UserPlus },
        { name: "Carteira", href: "/dashboard/carteira", icon: BriefcaseBusiness },
        { name: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
        { name: "Orçamentos", href: "/dashboard/orcamentos", icon: FileText },
        { name: "Vendas", href: "/dashboard/vendas", icon: DollarSign },
        { name: "Comissões", href: "/dashboard/comissoes", icon: Percent },
        {
          name: "Campanhas",
          icon: Megaphone,
          visible: role !== "vendedor",
          children: [
            { name: "Campanhas", href: "/dashboard/campanhas" },
            { name: "Master Dashboard", href: "/dashboard/campanhas/master" },
          ],
        },
        { name: "Clientes", href: "/dashboard/clientes", icon: Users },
        {
          name: "Empresas",
          href: "/dashboard/empresas",
          icon: Building2,
          visible: role === "owner",
        },
        {
          name: "Equipe",
          href: "/dashboard/equipe",
          icon: Users2,
          visible: role === "owner" || role === "admin",
        },
        {
          name: "Assinatura",
          href: "/dashboard/billing",
          icon: CreditCard,
          visible: role !== "vendedor",
        },
        { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
      ].filter((item) => item.visible !== false),
    [role]
  );

  if (isMasterPage) {
    return <div className="min-h-screen bg-[#0F172A] text-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white">
      <aside
        className={`w-64 bg-[#0B1120] border-r border-white/10 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="p-5 border-b border-white/10">
          <div
            title={empresa || "FlowDesk"}
            className="text-lg font-bold leading-tight text-white break-words overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {empresa || "FlowDesk"}
          </div>

          <div className="text-xs text-white/40 mt-1">CRM Comercial</div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const isOpen = openMenus[item.name];
              const parentActive = item.children.some(
                (child) =>
                  pathname === child.href || pathname.startsWith(child.href + "/")
              );

              return (
                <div key={item.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition ${
                      parentActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </div>

                    {isOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>

                  {isOpen && (
                    <div className="ml-4 pl-3 border-l border-white/10 space-y-1">
                      {item.children.map((child) => {
                        const childActive = pathname === child.href;

                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition ${
                              childActive
                                ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/20"
                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span>{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = pathname === item.href;

            return (
              <Link
                key={item.name}
                href={item.href!}
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

        <div className="p-4 border-t border-white/10">
          <div className="bg-blue-600/20 border border-blue-500/30 p-4 rounded-xl">
            <p className="text-sm font-semibold mb-2">
              Plano {plan === "pro" ? "Pro 🚀" : "Free"}
            </p>

            {plan !== "pro" && role !== "vendedor" && (
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

        <div className="p-4">
          <a
            href="https://wa.me/5562994693465?text=Olá,%20preciso%20de%20ajuda%20no%20FlowDesk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 transition"
          >
            <MessageCircle size={18} />
            Suporte Técnico
          </a>
        </div>
      </aside>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col ml-0 md:ml-64">
        <header className="h-16 bg-[#0B1120] border-b border-white/10 flex items-center justify-between px-6">
          <button
            className="md:hidden p-3"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} color="white" />
          </button>

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

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center font-semibold text-sm shadow-lg shadow-cyan-600/30">
                {inicial}
              </div>

              <div className="flex flex-col leading-tight min-w-0 max-w-[220px]">
                <span
                  className="text-sm text-gray-300 hidden sm:block truncate"
                  title={email}
                >
                  {email}
                </span>

                {empresa && (
                  <span
                    className="text-xs text-gray-500 hidden sm:block truncate"
                    title={empresa}
                  >
                    {empresa}
                  </span>
                )}

                {roleLabel && (
                  <span className="text-xs text-cyan-400 hidden sm:block">
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition"
            >
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 bg-[#0F172A]">{children}</main>
      </div>
    </div>
  );
}