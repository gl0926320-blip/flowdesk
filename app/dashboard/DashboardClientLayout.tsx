  "use client";

  import Link from "next/link";
  import { usePathname } from "next/navigation";
  import { ReactNode, useEffect, useState } from "react";
  import { Building2 } from "lucide-react";
  import {
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
  } from "lucide-react";
  import { createClient } from "@/lib/supabase-browser";

  export default function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const supabase = createClient();


    const [empresa, setEmpresa] = useState<string>("");
    
    const [companyId, setCompanyId] = useState<string | null>(null);
    const [plan, setPlan] = useState<string>("free");
    const [role, setRole] = useState<string>("vendedor");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [email, setEmail] = useState<string>("");
    const inicial = email ? email.charAt(0).toUpperCase() : "";
    async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }
  async function aceitarConvite() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) return;

    const { data: convite } = await supabase
      .from("company_users")
      .select("*")
      .eq("email", user.email)
      .eq("status", "pending")
      .maybeSingle();

    if (!convite) return;

    await supabase
      .from("company_users")
      .update({
        user_id: user.id,
        status: "accepted",
      })
      .eq("id", convite.id);
  }
  async function carregarPlano() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;
    if (!user) return;

    setEmail(user.email || "");

    // plano
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (profile?.plan) {
      setPlan(profile.plan);
    }

    // empresa
    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id, role, companies(name)")
      .eq("user_id", user.id)
  .eq("status", "accepted")
      .maybeSingle();

    if (companyUser) {
      setCompanyId((companyUser as any).company_id);
          setRole((companyUser as any).role);

      if ((companyUser as any)?.companies?.name) {
        setEmpresa((companyUser as any).companies.name);
      }
    }
  }

  useEffect(() => {
    async function init() {
      await aceitarConvite();
      await carregarPlano();
    }

    init();

    const onFocus = () => carregarPlano();
    window.addEventListener("focus", onFocus);

    if (window.location.search.includes("success=true")) {
      window.history.replaceState({}, document.title, window.location.pathname);
      carregarPlano();
    }

    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const menu = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },

    // 🔥 Comercial
    { name: "Leads", href: "/dashboard/leads", icon: UserPlus },
    { name: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
    { name: "Orçamentos", href: "/dashboard/orcamentos", icon: FileText },
    { name: "Vendas", href: "/dashboard/vendas", icon: DollarSign },
    { name: "Comissões", href: "/dashboard/comissoes", icon: Percent },

  // 👥 Gestão
  { name: "Clientes", href: "/dashboard/clientes", icon: Users },
  { name: "Empresas", href: "/dashboard/empresas", icon: Building2 },
  { name: "Equipe", href: "/dashboard/equipe", icon: Users2 },

    // ⚙️ Sistema
    { name: "Assinatura", href: "/dashboard/billing", icon: CreditCard },
    { name: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
  ];

    return (
      <div className="flex min-h-screen bg-[#0F172A] text-white">
        {/* SIDEBAR */}
        <aside
          className={`w-64 bg-[#0B1120] border-r border-white/10 flex flex-col fixed top-0 left-0 h-full z-40 transition-all duration-300 transform ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
        >
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
          {/* Suporte WhatsApp */}
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

        {/* Overlay mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* CONTEÚDO */}
        <div className="flex-1 flex flex-col ml-0 md:ml-64">
          {/* HEADER */}
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
    {/* Avatar */}
    <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center font-semibold text-sm shadow-lg shadow-cyan-600/30">
      {inicial}
    </div>

    {/* Email */}
  <div className="flex flex-col leading-tight">
    <span className="text-sm text-gray-300 hidden sm:block">
      {email}
    </span>

    {empresa && (
      <span className="text-xs text-gray-500 hidden sm:block">
        {empresa}
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

          <main className="flex-1 p-4 md:p-8 bg-[#0F172A]">
            {children}
          </main>
        </div>
      </div>
    );
  }