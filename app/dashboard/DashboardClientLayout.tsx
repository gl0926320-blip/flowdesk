"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
  Package,
  Bot,
  BarChart3,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase-browser";

type MenuChild = {
  name: string;
  href: string;
};

type MenuItem = {
  name: string;
  href?: string;
  icon: LucideIcon;
  children?: MenuChild[];
  visible?: boolean;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

type Membership = {
  company_id: string;
  role: string;
  status?: string;
  email?: string;
  user_id?: string | null;
  can_access_atendimento?: boolean | null;
  can_access_campanhas?: boolean | null;
  can_access_estoque?: boolean | null;
  companies?: {
    name?: string | null;
    plan?: string | null;
  } | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

  const [canAccessAtendimento, setCanAccessAtendimento] = useState(false);
  const [canAccessCampanhas, setCanAccessCampanhas] = useState(false);
  const [canAccessEstoque, setCanAccessEstoque] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [loadedMembership, setLoadedMembership] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement | null>(null);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Campanhas: pathname.startsWith("/dashboard/campanhas"),
  });

  const inicial = email ? email.charAt(0).toUpperCase() : "F";

  const roleLabel =
    role === "owner"
      ? "Owner"
      : role === "admin"
      ? "Admin"
      : role === "vendedor"
      ? "Vendedor"
      : "";

  const planLabel = plan === "pro" ? "Pro 🚀" : "Free";

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isVendedor = role === "vendedor";

  const hasAtendimentoAccess = canAccessAtendimento === true;
  const hasCampanhasAccess = canAccessCampanhas === true;
  const hasEstoqueAccess = canAccessEstoque === true;

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function getMembership(userId: string): Promise<Membership | null> {
    const { data, error } = await supabase
      .from("company_users")
      .select(
                "company_id, role, status, email, user_id, can_access_atendimento, can_access_campanhas, can_access_estoque, companies(name, plan), created_at"
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
      setCompanyId(null);
      setRole("");
      setEmpresa("");
      setPlan("free");
      setEmail("");
      setCanAccessAtendimento(false);
      setCanAccessCampanhas(false);
      setCanAccessEstoque(false);
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
      setRole(membership.role || "");
      setEmpresa(membership?.companies?.name || "");
      setPlan(membership?.companies?.plan || profile?.plan || "free");
      setCanAccessAtendimento(membership?.can_access_atendimento === true);
      setCanAccessCampanhas(membership?.can_access_campanhas === true);
      setCanAccessEstoque(membership?.can_access_estoque === true);
    } else {
      setCompanyId(null);
      setRole("");
      setEmpresa("");
      setPlan(profile?.plan || "free");
      setCanAccessAtendimento(false);
      setCanAccessCampanhas(false);
      setCanAccessEstoque(false);
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
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!loadedMembership) return;
    if (isMasterPage) return;

    if (pathname.startsWith("/dashboard/empresas") && !isOwner) {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/equipe") && !(isOwner || isAdmin)) {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/campanhas") && !hasCampanhasAccess) {
      router.replace("/dashboard");
      return;
    }

        if (pathname.startsWith("/dashboard/estoque") && !hasEstoqueAccess) {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/billing") && isVendedor) {
      router.replace("/dashboard");
      return;
    }

    if (
      pathname.startsWith("/dashboard/atendimento") &&
      !hasAtendimentoAccess
    ) {
      router.replace("/dashboard");
      return;
    }

    if (pathname.startsWith("/dashboard/flowia") && isVendedor) {
      router.replace("/dashboard");
      return;
    }
  }, [
    pathname,
    isOwner,
    isAdmin,
    isVendedor,
    hasAtendimentoAccess,
    hasCampanhasAccess,
    hasEstoqueAccess,
    loadedMembership,
    router,
    isMasterPage,
  ]);

  function toggleMenu(menuName: string) {
    setOpenMenus((prev) => ({
      ...prev,
      [menuName]: !prev[menuName],
    }));
  }

  function handleProfileToggle(e: ReactMouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsProfileOpen((prev) => !prev);
  }

  const sidebarWidth = isSidebarCollapsed ? "md:w-[92px]" : "md:w-[290px]";
  const desktopMarginLeft = isSidebarCollapsed
    ? "md:ml-[92px]"
    : "md:ml-[290px]";

const sections: MenuSection[] = useMemo(() => {
  const result: MenuSection[] = [
    {
      title: "Visão Geral",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Operação Comercial",
      items: [
        {
          name: "Leads",
          href: "/dashboard/leads",
          icon: UserPlus,
        },
        {
          name: "Carteira",
          href: "/dashboard/carteira",
          icon: BriefcaseBusiness,
        },
        {
          name: "Pipeline",
          href: "/dashboard/pipeline",
          icon: Kanban,
        },
        {
          name: "Atendimento",
          href: "/dashboard/atendimento",
          icon: Headset,
          visible: hasAtendimentoAccess,
        },
        {
          name: "Clientes",
          href: "/dashboard/clientes",
          icon: Users,
        },

                {
          name: "Estoque",
          href: "/dashboard/estoque",
          icon: Package,
          visible: hasEstoqueAccess,
        },

      ].filter((item) => item.visible !== false),
    },
    {
      title: "Financeiro",
      items: [
        {
          name: "Orçamentos",
          href: "/dashboard/orcamentos",
          icon: FileText,
        },
        {
          name: "Vendas",
          href: "/dashboard/vendas",
          icon: DollarSign,
        },
        {
          name: "Comissões",
          href: "/dashboard/comissoes",
          icon: Percent,
        },
      ],
    },
    {
      title: "Marketing",
      items: [
        {
          name: "Campanhas",
          icon: Megaphone,
          visible: hasCampanhasAccess,
          children: [
            { name: "Campanhas", href: "/dashboard/campanhas" },
            { name: "Master Dashboard", href: "/dashboard/campanhas/master" },
          ],
        },
      ].filter((item) => item.visible !== false),
    },
    {
      title: "Administração",
      items: [
        {
          name: "Empresas",
          href: "/dashboard/empresas",
          icon: Building2,
          visible: isOwner,
        },
        {
          name: "Equipe",
          href: "/dashboard/equipe",
          icon: Users2,
          visible: isOwner || isAdmin,
        },
        {
          name: "Assinatura",
          href: "/dashboard/billing",
          icon: CreditCard,
          visible: !isVendedor,
        },
        {
          name: "Configurações",
          href: "/dashboard/configuracoes",
          icon: Settings,
        },
      ].filter((item) => item.visible !== false),
    },
    {
      title: "Inteligência",
      items: [
        {
          name: "FlowIA",
          href: "/dashboard/flowia",
          icon: Bot,
          visible: !isVendedor,
        },
      ].filter((item) => item.visible !== false),
    },
  ];

  return result.filter((section) => section.items.length > 0);
}, [
  hasAtendimentoAccess,
  hasCampanhasAccess,
  hasEstoqueAccess,
  isOwner,
  isAdmin,
  isVendedor,
]);

  if (isMasterPage) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-white">{children}</div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F172A] text-white">
      {isSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-72 flex-col border-r border-white/10 bg-[#0B1120] transition-all duration-300",
          sidebarWidth,
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
      >
        <div className="border-b border-white/10 p-4">
          <div
            className={cn(
              "rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]",
              isSidebarCollapsed && "p-2.5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex min-w-0 items-center",
                  isSidebarCollapsed ? "w-full justify-center" : "gap-3"
                )}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
                  <BarChart3 size={20} />
                </div>

                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      FlowDesk
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                      Sistema de Gestão Comercial
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white md:flex"
                aria-label="Recolher sidebar"
              >
                {isSidebarCollapsed ? (
                  <ChevronRight size={18} />
                ) : (
                  <ChevronLeft size={18} />
                )}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <div className="mt-3">
                <div className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-white/40">
                        Empresa atual
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-white">
                        {empresa || "Sem empresa vinculada"}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
                      {companyId ? "Ativa" : "Pendente"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flowdesk-scroll flex-1 overflow-y-auto px-3 py-4 pr-2">
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.title}>
                {!isSidebarCollapsed && (
                  <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    {section.title}
                  </div>
                )}

                <div className="space-y-1.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;

                    if (item.children) {
                      const isOpen = openMenus[item.name];
                      const hasActiveChild = item.children.some((child) =>
                        pathname.startsWith(child.href)
                      );

                      return (
                        <div key={item.name}>
                          <button
                            onClick={() => toggleMenu(item.name)}
                            className={cn(
                              "group flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm transition-all duration-200",
                              hasActiveChild
                                ? "border border-cyan-500/20 bg-cyan-500/12 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]"
                                : "border border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center",
                                isSidebarCollapsed
                                  ? "w-full justify-center"
                                  : "gap-3"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-xl transition",
                                  hasActiveChild
                                    ? "bg-cyan-500/15"
                                    : "bg-white/[0.04] group-hover:bg-white/[0.07]"
                                )}
                              >
                                <Icon size={18} />
                              </div>

                              {!isSidebarCollapsed && (
                                <div className="flex min-w-0 flex-col items-start">
                                  <span className="truncate font-medium">
                                    {item.name}
                                  </span>
                                  <span className="text-[11px] text-white/35">
                                    Gestão e análise
                                  </span>
                                </div>
                              )}
                            </div>

                            {!isSidebarCollapsed &&
                              (isOpen ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              ))}
                          </button>

                          {!isSidebarCollapsed && isOpen && (
                            <div className="ml-5 mt-2 space-y-1 border-l border-white/10 pl-4">
                              {item.children.map((child) => {
                                const childActive = pathname.startsWith(
                                  child.href
                                );

                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={cn(
                                      "block rounded-xl px-3 py-2 text-sm transition",
                                      childActive
                                        ? "bg-cyan-500/12 text-cyan-300"
                                        : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                                    )}
                                  >
                                    {child.name}
                                  </Link>
                                );
                              })}
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
                        className={cn(
                          "group flex items-center rounded-2xl px-3 py-3 text-sm transition-all duration-200",
                          isSidebarCollapsed ? "justify-center" : "gap-3",
                          isActive
                            ? "border border-cyan-500/20 bg-cyan-500/12 text-cyan-300 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]"
                            : "border border-transparent text-white/70 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                        )}
                        title={isSidebarCollapsed ? item.name : undefined}
                      >
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                            isActive
                              ? "bg-cyan-500/15"
                              : "bg-white/[0.04] group-hover:bg-white/[0.07]"
                          )}
                        >
                          <Icon size={18} />
                        </div>

                        {!isSidebarCollapsed && (
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {item.name}
                            </div>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <a
            href="https://wa.me/5562994693465"
            target="_blank"
            rel="noreferrer"
            className={cn(
              "flex items-center rounded-2xl border border-green-500/20 bg-green-600/10 px-3 py-3 text-green-300 transition hover:bg-green-600/20",
              isSidebarCollapsed ? "justify-center" : "gap-3"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/15">
              <MessageCircle size={18} />
            </div>

            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-medium">Suporte Técnico</div>
                <div className="text-[11px] text-green-300/70">
                  Atendimento rápido
                </div>
              </div>
            )}
          </a>
        </div>
      </aside>

      <div className={cn("flex flex-1 flex-col", desktopMarginLeft)}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#0B1120]/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] md:hidden"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            <div>
              <h1 className="text-base font-semibold text-white md:text-lg">
                Painel Comercial
              </h1>
              <p className="hidden text-xs text-white/35 sm:block">
                Gestão completa da sua operação de vendas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative" ref={profileRef}>
              <button
                onClick={handleProfileToggle}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2 transition hover:border-cyan-500/20 hover:bg-white/[0.05] md:px-3",
                  isProfileOpen && "border-cyan-500/20 bg-white/[0.05]"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-semibold text-white">
                  {inicial}
                </div>

                <div className="hidden min-w-0 flex-col items-start sm:flex">
                  <span className="max-w-[220px] truncate text-sm text-gray-200">
                    {email}
                  </span>
                  <span className="max-w-[220px] truncate text-xs text-gray-500">
                    {empresa || "FlowDesk"}
                    {empresa && roleLabel ? " • " : ""}
                    {roleLabel}
                  </span>
                </div>

                <ChevronDown
                  size={16}
                  className={cn(
                    "hidden text-white/50 transition sm:block",
                    isProfileOpen && "rotate-180"
                  )}
                />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] rounded-2xl border border-white/10 bg-[#0B1120] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-base font-semibold text-white">
                        {inicial}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">
                          {email || "Usuário"}
                        </div>
                        <div className="mt-1 truncate text-xs text-white/45">
                          {empresa || "FlowDesk"}
                          {empresa && roleLabel ? " • " : ""}
                          {roleLabel || "Sem função"}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                              plan === "pro"
                                ? "bg-purple-600/15 text-purple-300 ring-purple-500/20"
                                : "bg-emerald-600/15 text-emerald-300 ring-emerald-500/20"
                            )}
                          >
                            Plano {planLabel}
                          </span>

                          <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 ring-1 ring-cyan-500/20">
                            {roleLabel || "Sem cargo"}
                          </span>

                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                            {companyId ? "Empresa ativa" : "Sem empresa"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <div className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/35">
                          <Building2 size={13} />
                          Empresa
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-white">
                          {empresa || "Não vinculada"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[#0F172A] px-3 py-2.5">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/35">
                          <ShieldCheck size={13} />
                          Permissão
                        </div>
                        <div className="mt-1 text-sm font-medium text-white">
                          {roleLabel || "Sem permissão definida"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <Link
                      href="/dashboard/configuracoes"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.05] hover:text-white"
                    >
                      <Settings size={16} />
                      Configurações
                    </Link>

                    {!isVendedor && (
                      <Link
                        href="/dashboard/billing"
                        onClick={() => setIsProfileOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/75 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <CreditCard size={16} />
                        Assinatura e plano
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 bg-[#0F172A] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}