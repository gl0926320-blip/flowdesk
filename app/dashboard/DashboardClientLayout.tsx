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
  ChevronLeft,
  Headset,
  Bot,
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
  const supabase = createClient();

  const isMasterPage = pathname.startsWith("/dashboard/master");

  const [empresa, setEmpresa] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
      .select(
        "company_id, role, status, email, user_id, companies(name, plan), created_at"
      )
      .eq("user_id", userId)
      .eq("status", "ativo")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return null;
    }

    if (!data || data.length === 0) {
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
      setCompanyId(membership.company_id);
      setRole(membership.role);
      setEmpresa(membership?.companies?.name || "");
      setPlan(membership?.companies?.plan || profile?.plan || "free");
    } else {
      setPlan(profile?.plan || "free");
    }

    setLoadedMembership(true);
  }

  useEffect(() => {
    carregarPlanoEMembership();

    const savedSidebar = localStorage.getItem("flowdesk_sidebar_collapsed");

    if (savedSidebar === "true") {
      setIsSidebarCollapsed(true);
    }

    const onFocus = () => carregarPlanoEMembership();

    window.addEventListener("focus", onFocus);

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "flowdesk_sidebar_collapsed",
      String(isSidebarCollapsed)
    );
  }, [isSidebarCollapsed]);

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

    if (pathname.startsWith("/dashboard/atendimento") && role === "vendedor") {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/flowia") && role === "vendedor") {
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

  const sidebarWidth = isSidebarCollapsed ? "md:w-20" : "md:w-64";
  const desktopMarginLeft = isSidebarCollapsed ? "md:ml-20" : "md:ml-64";

  const menu: MenuItem[] = useMemo(
    () =>
      [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Leads", href: "/dashboard/leads", icon: UserPlus },
        {
          name: "Carteira",
          href: "/dashboard/carteira",
          icon: BriefcaseBusiness,
        },
        { name: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
        {
          name: "Atendimento",
          href: "/dashboard/atendimento",
          icon: Headset,
          visible: role !== "vendedor",
        },
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
        {
          name: "FlowIA",
          href: "/dashboard/flowia",
          icon: Bot,
          visible: role !== "vendedor",
        },
      ].filter((item) => item.visible !== false),
    [role]
  );

  if (isMasterPage) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white">{children}</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white">
      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r border-white/10 bg-[#0B1120] transition-all duration-300 transform ${sidebarWidth} ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="border-b border-white/10 p-4">
          <div className="flex flex-col gap-3">
            <div
              className={`min-w-0 ${isSidebarCollapsed ? "text-center" : ""}`}
            >
              <div
                className={`font-bold ${
                  isSidebarCollapsed ? "text-base" : "text-lg"
                }`}
              >
                {isSidebarCollapsed ? "FlowDesk" : empresa || "FlowDesk"}
              </div>

              {!isSidebarCollapsed && (
                <div className="mt-1 text-xs text-white/40">CRM Comercial</div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 md:flex"
            >
              {isSidebarCollapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-3">
          {menu.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const isOpen = openMenus[item.name];

              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className="flex w-full items-center justify-between rounded-lg p-3 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      {!isSidebarCollapsed && item.name}
                    </div>

                    {!isSidebarCollapsed &&
                      (isOpen ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      ))}
                  </button>

                  {!isSidebarCollapsed && isOpen && (
                    <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block rounded-lg p-2 text-sm hover:bg-white/5"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href!);

            return (
              <Link
                key={item.name}
                href={item.href!}
                className={`flex items-center rounded-lg p-3 transition ${
                  isSidebarCollapsed ? "justify-center" : "gap-3"
                } ${
                  isActive
                    ? "border border-cyan-500/20 bg-cyan-500/15 text-cyan-300"
                    : "hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                {!isSidebarCollapsed && item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="rounded-xl border border-blue-500/30 bg-blue-600/20 p-4">
            <p className="mb-2 text-sm font-semibold">
              Plano {plan === "pro" ? "Pro 🚀" : "Free"}
            </p>

            {plan !== "pro" && role !== "vendedor" && (
              <Link
                href="/dashboard/billing"
                className="block rounded-lg bg-blue-600 p-2 text-center text-sm hover:bg-blue-700"
              >
                Fazer Upgrade
              </Link>
            )}
          </div>
        </div>

        <div className="p-3">
          <a
            href="https://wa.me/5562994693465"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg bg-green-600/20 p-3 text-green-400 hover:bg-green-600/30"
          >
            <MessageCircle size={18} />
            {!isSidebarCollapsed && "Suporte Técnico"}
          </a>
        </div>
      </aside>

      <div className={`flex flex-1 flex-col ${desktopMarginLeft}`}>
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#0B1120] px-6">
          <button
            className="md:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={22} />
          </button>

          <h1 className="text-lg font-semibold">Área Restrita</h1>

          <div className="flex items-center gap-4">
            <span
              className={`rounded-full px-3 py-1 text-xs ${
                plan === "pro"
                  ? "bg-purple-600/20 text-purple-400"
                  : "bg-green-600/20 text-green-400"
              }`}
            >
              Plano {plan === "pro" ? "Pro 🚀" : "Free"}
            </span>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-semibold">
                {inicial}
              </div>

              <div className="hidden flex-col sm:flex">
                <span className="text-sm text-gray-300">{email}</span>

                {(empresa || roleLabel) && (
                  <span className="text-xs text-gray-500">
                    {empresa}
                    {empresa && roleLabel ? " • " : ""}
                    {roleLabel}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-red-500/30 bg-red-600/20 px-3 py-2 text-sm text-red-400"
            >
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 bg-[#0F172A] p-6">{children}</main>
      </div>
    </div>
  );
}