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

  const [empresa,setEmpresa] = useState("");
  const [companyId,setCompanyId] = useState<string | null>(null);
  const [plan,setPlan] = useState("free");
  const [role,setRole] = useState("");
  const [email,setEmail] = useState("");

  const [isSidebarOpen,setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed,setIsSidebarCollapsed] = useState(false);

  const [loadedMembership,setLoadedMembership] = useState(false);

  const [openMenus,setOpenMenus] = useState<Record<string,boolean>>({
    Campanhas: pathname.startsWith("/dashboard/campanhas")
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

  async function handleLogout(){
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function getMembership(userId:string):Promise<Membership | null>{

    const { data,error } = await supabase
      .from("company_users")
      .select("company_id, role, status, email, user_id, companies(name, plan), created_at")
      .eq("user_id",userId)
      .eq("status","ativo")
      .order("created_at",{ascending:false});

    if(error){
      console.error(error);
      return null;
    }

    if(!data || data.length === 0){
      return null;
    }

    return data[0] as Membership;
  }

  async function carregarPlanoEMembership(){

    setLoadedMembership(false);

    const { data:{session} } = await supabase.auth.getSession();
    const user = session?.user;

    if(!user){
      setLoadedMembership(true);
      return;
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    setEmail(userEmail);

    const { data:profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id",user.id)
      .maybeSingle();

    const membership = await getMembership(user.id);

    if(membership?.company_id){
      setCompanyId(membership.company_id);
      setRole(membership.role);
      setEmpresa(membership?.companies?.name || "");
      setPlan(membership?.companies?.plan || profile?.plan || "free");
    } else {
      setPlan(profile?.plan || "free");
    }

    setLoadedMembership(true);
  }

  useEffect(()=>{

    carregarPlanoEMembership();

    const savedSidebar = localStorage.getItem("flowdesk_sidebar_collapsed");

    if(savedSidebar === "true"){
      setIsSidebarCollapsed(true);
    }

    const onFocus = () => carregarPlanoEMembership();

    window.addEventListener("focus",onFocus);

    return () => window.removeEventListener("focus",onFocus);

  },[]);

  useEffect(()=>{

    localStorage.setItem(
      "flowdesk_sidebar_collapsed",
      String(isSidebarCollapsed)
    );

  },[isSidebarCollapsed]);

  useEffect(()=>{

    if(!loadedMembership) return;

    if(pathname.startsWith("/dashboard/empresas") && role !== "owner"){
      router.replace("/dashboard");
      return;
    }

    if(pathname.startsWith("/dashboard/campanhas") && role === "vendedor"){
      router.replace("/dashboard");
      return;
    }

    if(pathname.startsWith("/dashboard/billing") && role === "vendedor"){
      router.replace("/dashboard");
      return;
    }

    if(pathname.startsWith("/dashboard/atendimento") && role === "vendedor"){
      router.replace("/dashboard");
      return;
    }

  },[pathname,role,loadedMembership,router]);

  function toggleMenu(menuName:string){

    setOpenMenus(prev=>({
      ...prev,
      [menuName]: !prev[menuName]
    }));

  }

  const sidebarWidth = isSidebarCollapsed ? "md:w-20" : "md:w-64";
  const desktopMarginLeft = isSidebarCollapsed ? "md:ml-20" : "md:ml-64";

  const menu:MenuItem[] = useMemo(()=>[
    { name:"Dashboard", href:"/dashboard", icon:LayoutDashboard },
    { name:"Leads", href:"/dashboard/leads", icon:UserPlus },
    { name:"Carteira", href:"/dashboard/carteira", icon:BriefcaseBusiness },
    { name:"Pipeline", href:"/dashboard/pipeline", icon:Kanban },
    { name:"Atendimento", href:"/dashboard/atendimento", icon:Headset, visible: role !== "vendedor" },
    { name:"Orçamentos", href:"/dashboard/orcamentos", icon:FileText },
    { name:"Vendas", href:"/dashboard/vendas", icon:DollarSign },
    { name:"Comissões", href:"/dashboard/comissoes", icon:Percent },
    {
      name:"Campanhas",
      icon:Megaphone,
      visible: role !== "vendedor",
      children:[
        { name:"Campanhas", href:"/dashboard/campanhas" },
        { name:"Master Dashboard", href:"/dashboard/campanhas/master" }
      ]
    },
    { name:"Clientes", href:"/dashboard/clientes", icon:Users },
    { name:"Empresas", href:"/dashboard/empresas", icon:Building2, visible: role === "owner" },
    { name:"Equipe", href:"/dashboard/equipe", icon:Users2, visible: role === "owner" || role === "admin" },
    { name:"Assinatura", href:"/dashboard/billing", icon:CreditCard, visible: role !== "vendedor" },
    { name:"Configurações", href:"/dashboard/configuracoes", icon:Settings },
  ].filter(item => item.visible !== false),[role]);

  if(isMasterPage){
    return <div className="min-h-screen bg-[#0F172A] text-white">{children}</div>
  }

  return(

    <div className="flex min-h-screen bg-[#0F172A] text-white">

      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col border-r border-white/10 bg-[#0B1120] transition-all duration-300 transform w-64 ${sidebarWidth} ${isSidebarOpen ? "translate-x-0":"-translate-x-full"} md:translate-x-0`}>

        <div className="border-b border-white/10 p-4">

<div className="flex flex-col gap-3">

  <div className={`min-w-0 ${isSidebarCollapsed ? "text-center":""}`}>

    <div className={`font-bold ${isSidebarCollapsed ? "text-base":"text-lg"}`}>
      {isSidebarCollapsed ? "FlowDesk" : empresa || "FlowDesk"}
    </div>

    {!isSidebarCollapsed && (
      <div className="text-xs text-white/40 mt-1">
        CRM Comercial
      </div>
    )}

  </div>

  <button
    onClick={()=>setIsSidebarCollapsed(prev=>!prev)}
    className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-white/10"
  >
    {isSidebarCollapsed
      ? <ChevronRight size={18}/>
      : <ChevronLeft size={18}/>
    }
  </button>

</div>

        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">

          {menu.map(item=>{

            const Icon = item.icon;

            if(item.children){

              const isOpen = openMenus[item.name];

              return(

                <div key={item.name}>

                  <button
                    onClick={()=>toggleMenu(item.name)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5"
                  >

                    <div className="flex items-center gap-3">
                      <Icon size={18}/>
                      {!isSidebarCollapsed && item.name}
                    </div>

                    {!isSidebarCollapsed && (
                      isOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>
                    )}

                  </button>

                  {!isSidebarCollapsed && isOpen && (
                    <div className="ml-4 border-l border-white/10 pl-3 space-y-1">

                      {item.children.map(child=>(
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block p-2 text-sm hover:bg-white/5 rounded-lg"
                        >
                          {child.name}
                        </Link>
                      ))}

                    </div>
                  )}

                </div>

              );

            }

            return(

              <Link
                key={item.name}
                href={item.href!}
                className={`flex items-center ${isSidebarCollapsed ? "justify-center":"gap-3"} p-3 rounded-lg hover:bg-white/5`}
              >
                <Icon size={18}/>
                {!isSidebarCollapsed && item.name}
              </Link>

            );

          })}

        </nav>

        <div className="p-3 border-t border-white/10">

          <div className="border border-blue-500/30 bg-blue-600/20 p-4 rounded-xl">

            <p className="text-sm font-semibold mb-2">
              Plano {plan === "pro" ? "Pro 🚀":"Free"}
            </p>

            {plan !== "pro" && role !== "vendedor" && (

              <Link
                href="/dashboard/billing"
                className="block text-center bg-blue-600 hover:bg-blue-700 p-2 rounded-lg text-sm"
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
            className="flex items-center gap-3 p-3 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30"
          >
            <MessageCircle size={18}/>
            {!isSidebarCollapsed && "Suporte Técnico"}
          </a>

        </div>

      </aside>

      <div className={`flex-1 flex flex-col ${desktopMarginLeft}`}>

        <header className="h-16 border-b border-white/10 bg-[#0B1120] flex items-center justify-between px-6">

          <button
            className="md:hidden"
            onClick={()=>setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={22}/>
          </button>

          <h1 className="text-lg font-semibold">
            Área Restrita
          </h1>

          <div className="flex items-center gap-4">

            <span className={`px-3 py-1 rounded-full text-xs ${plan==="pro"?"bg-purple-600/20 text-purple-400":"bg-green-600/20 text-green-400"}`}>
              Plano {plan === "pro" ? "Pro 🚀":"Free"}
            </span>

            <div className="flex items-center gap-3">

              <div className="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center font-semibold text-sm">
                {inicial}
              </div>

              <div className="hidden sm:flex flex-col">

                <span className="text-sm text-gray-300">
                  {email}
                </span>

                {empresa && (
                  <span className="text-xs text-gray-500">
                    {empresa}
                  </span>
                )}

              </div>

            </div>

            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg"
            >
              Sair
            </button>

          </div>

        </header>

        <main className="flex-1 p-6 bg-[#0F172A]">
          {children}
        </main>

      </div>

    </div>

  );

}