"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { toast } from "sonner"
import {
  Building2,
  Save,
  Mail,
  Shield,
  Users,
  UserCheck,
  UserX,
  Crown,
  Briefcase,
  UserCog,
  Trash2,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Percent,
  Target,
  DollarSign,
  TrendingUp,
} from "lucide-react"

type User = {
  id: string | null
  email: string
  role: string
  status: string
  comissao_percentual?: number | null
  meta_leads?: number | null
  meta_vendas?: number | null
  meta_receita?: number | null
}

type InviteData = {
  id: string
  company_id: string
  email: string
  role: string
  status: string
  companies?: {
    name: string
  } | null
}

type SellerConfigDraft = {
  comissao_percentual: string
  meta_leads: string
  meta_vendas: string
  meta_receita: string
}

export default function EmpresaPage() {
  const supabase = createClient()

  const [companyName, setCompanyName] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [processingEmail, setProcessingEmail] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [savingSellerConfigEmail, setSavingSellerConfigEmail] = useState<string | null>(null)

  const [myRole, setMyRole] = useState("")
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("vendedor")

  const [receivedInvite, setReceivedInvite] = useState<InviteData | null>(null)
  const [sellerConfigs, setSellerConfigs] = useState<Record<string, SellerConfigDraft>>({})

  const precisaDefinirNome =
    !companyName.trim() || companyName.trim().toLowerCase() === "minha empresa"

  const metrics = useMemo(() => {
    const total = users.length
    const ativos = users.filter((u) => u.status === "accepted").length
    const pendentes = users.filter((u) => u.status === "pending").length
    const inativos = users.filter((u) => u.status === "inactive").length
    const vendedores = users.filter((u) => u.role === "vendedor").length

    const comissaoMedia =
      vendedores > 0
        ? users
            .filter((u) => u.role === "vendedor")
            .reduce((acc, u) => acc + Number(u.comissao_percentual || 0), 0) / vendedores
        : 0

    return { total, ativos, pendentes, inativos, vendedores, comissaoMedia }
  }, [users])

  function roleLabel(role: string) {
    if (role === "owner") return "Owner"
    if (role === "admin") return "Admin"
    if (role === "vendedor") return "Vendedor"
    return role
  }

  function roleIcon(role: string) {
    if (role === "owner") return <Crown size={14} />
    if (role === "admin") return <UserCog size={14} />
    return <Briefcase size={14} />
  }

  function statusLabel(status: string) {
    if (status === "accepted") return "Ativo"
    if (status === "pending") return "Pendente"
    if (status === "inactive") return "Inativo"
    return status
  }

  function statusClass(status: string) {
    if (status === "accepted") {
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
    }
    if (status === "pending") {
      return "bg-amber-500/15 text-amber-400 border border-amber-500/20"
    }
    if (status === "inactive") {
      return "bg-red-500/15 text-red-400 border border-red-500/20"
    }
    return "bg-zinc-500/15 text-zinc-300 border border-zinc-500/20"
  }

  function toDraft(user: User): SellerConfigDraft {
    return {
      comissao_percentual: String(user.comissao_percentual ?? 0),
      meta_leads: String(user.meta_leads ?? 0),
      meta_vendas: String(user.meta_vendas ?? 0),
      meta_receita: String(user.meta_receita ?? 0),
    }
  }

  function parseNumber(value: string) {
    if (!value?.trim()) return 0
    const normalized = value.replace(",", ".")
    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0)
  }

  function getSellerSummary(user: User) {
    const comissao = Number(user.comissao_percentual || 0)
    const metaLeads = Number(user.meta_leads || 0)
    const metaVendas = Number(user.meta_vendas || 0)
    const metaReceita = Number(user.meta_receita || 0)

    return {
      comissao,
      metaLeads,
      metaVendas,
      metaReceita,
    }
  }

  async function loadCompany() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setLoading(false)
      return
    }

    const { data: me } = await supabase
      .from("company_users")
      .select("company_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .maybeSingle()

    if (!me?.company_id) {
      setMyRole("")
      setMyCompanyId(null)
      setCompanyName("")
      setUsers([])
      setSellerConfigs({})
      setLoading(false)
      return
    }

    setMyRole(me.role)
    setMyCompanyId(me.company_id)

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", me.company_id)
      .maybeSingle()

    if (company?.name) {
      setCompanyName(company.name)
    } else {
      setCompanyName("")
    }

    const { data: companyUsers } = await supabase
      .from("company_users")
      .select(
        "user_id, email, role, status, comissao_percentual, meta_leads, meta_vendas, meta_receita"
      )
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: true })

    if (companyUsers) {
      const usersFormatted = companyUsers.map((u: any) => ({
        id: u.user_id,
        email: u.email,
        role: u.role,
        status: u.status,
        comissao_percentual: u.comissao_percentual ?? 0,
        meta_leads: u.meta_leads ?? 0,
        meta_vendas: u.meta_vendas ?? 0,
        meta_receita: u.meta_receita ?? 0,
      }))

      setUsers(usersFormatted)

      const configsMap: Record<string, SellerConfigDraft> = {}
      usersFormatted.forEach((u) => {
        configsMap[u.email] = toDraft(u)
      })
      setSellerConfigs(configsMap)
    } else {
      setUsers([])
      setSellerConfigs({})
    }

    setLoading(false)
  }

  async function loadReceivedInvite() {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user
    if (!user?.email) {
      setReceivedInvite(null)
      return
    }

    const { data: invite } = await supabase
      .from("company_users")
      .select("id, company_id, email, role, status, companies(name)")
      .eq("email", user.email)
      .eq("status", "pending")
      .maybeSingle()

    if (invite) {
      setReceivedInvite(invite as any)
    } else {
      setReceivedInvite(null)
    }
  }

  useEffect(() => {
    async function init() {
      await loadCompany()
      await loadReceivedInvite()
    }

    init()
  }, [])

  async function updateCompanyName() {
    if (!myCompanyId) {
      toast.error("Empresa não encontrada")
      return
    }

    const nomeLimpo = companyName.trim()

    if (!nomeLimpo) {
      toast.error("Informe o nome da empresa")
      return
    }

    setSavingName(true)

    const { error } = await supabase
      .from("companies")
      .update({ name: nomeLimpo })
      .eq("id", myCompanyId)

    setSavingName(false)

    if (error) {
      toast.error("Erro ao atualizar empresa")
      return
    }

    toast.success("Empresa atualizada com sucesso")
    await loadCompany()
  }

  async function inviteUser() {
    if (!myCompanyId) {
      toast.error("Empresa não encontrada")
      return
    }

    if (!inviteEmail.trim()) {
      toast.error("Informe um email")
      return
    }

    const emailNormalizado = inviteEmail.trim().toLowerCase()

    setSendingInvite(true)

    const { data: existingInvite } = await supabase
      .from("company_users")
      .select("id, email, status")
      .eq("company_id", myCompanyId)
      .eq("email", emailNormalizado)
      .maybeSingle()

    if (existingInvite) {
      setSendingInvite(false)
      toast.error("Esse usuário já está vinculado ou convidado para esta empresa")
      return
    }

    const payload: any = {
      company_id: myCompanyId,
      email: emailNormalizado,
      role: inviteRole,
      status: "pending",
    }

    if (inviteRole === "vendedor") {
      payload.comissao_percentual = 0
      payload.meta_leads = 0
      payload.meta_vendas = 0
      payload.meta_receita = 0
    }

    const { error } = await supabase.from("company_users").insert(payload)

    setSendingInvite(false)

    if (error) {
      toast.error("Erro ao enviar convite")
      return
    }

    toast.success("Convite enviado com sucesso")
    setInviteEmail("")
    setInviteRole("vendedor")
    await loadCompany()
    await loadReceivedInvite()
  }

  async function updateRole(email: string, role: string) {
    if (!myCompanyId) return

    setProcessingEmail(email)

    const payload: any = { role }

    if (role !== "vendedor") {
      payload.comissao_percentual = 0
      payload.meta_leads = 0
      payload.meta_vendas = 0
      payload.meta_receita = 0
    }

    const { error } = await supabase
      .from("company_users")
      .update(payload)
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setProcessingEmail(null)

    if (error) {
      toast.error("Erro ao atualizar perfil")
      return
    }

    toast.success("Perfil atualizado")
    await loadCompany()
  }

  function updateSellerDraft(
    email: string,
    field: keyof SellerConfigDraft,
    value: string
  ) {
    setSellerConfigs((prev) => ({
      ...prev,
      [email]: {
        ...(prev[email] || {
          comissao_percentual: "0",
          meta_leads: "0",
          meta_vendas: "0",
          meta_receita: "0",
        }),
        [field]: value,
      },
    }))
  }

  async function saveSellerConfig(email: string) {
    if (!myCompanyId) return

    const draft = sellerConfigs[email]

    if (!draft) {
      toast.error("Configuração não encontrada")
      return
    }

    const comissao = parseNumber(draft.comissao_percentual)
    const metaLeads = parseNumber(draft.meta_leads)
    const metaVendas = parseNumber(draft.meta_vendas)
    const metaReceita = parseNumber(draft.meta_receita)

    if (comissao < 0 || comissao > 100) {
      toast.error("A comissão deve estar entre 0 e 100")
      return
    }

    if (metaLeads < 0 || metaVendas < 0 || metaReceita < 0) {
      toast.error("As metas não podem ser negativas")
      return
    }

    setSavingSellerConfigEmail(email)

    const { error } = await supabase
      .from("company_users")
      .update({
        comissao_percentual: comissao,
        meta_leads: metaLeads,
        meta_vendas: metaVendas,
        meta_receita: metaReceita,
      })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setSavingSellerConfigEmail(null)

    if (error) {
      toast.error("Erro ao salvar configuração do vendedor")
      return
    }

    toast.success("Configuração do vendedor salva")
    await loadCompany()
  }

  async function deactivateUser(email: string) {
    if (!myCompanyId) return

    setProcessingEmail(email)

    const { error } = await supabase
      .from("company_users")
      .update({ status: "inactive" })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setProcessingEmail(null)

    if (error) {
      toast.error("Erro ao desativar usuário")
      return
    }

    toast.success("Usuário desativado")
    await loadCompany()
  }

  async function reactivateUser(email: string) {
    if (!myCompanyId) return

    setProcessingEmail(email)

    const { error } = await supabase
      .from("company_users")
      .update({ status: "accepted" })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setProcessingEmail(null)

    if (error) {
      toast.error("Erro ao reativar usuário")
      return
    }

    toast.success("Usuário reativado")
    await loadCompany()
  }

  async function removeUser(email: string) {
    if (!myCompanyId) return
    if (!confirm("Tem certeza que deseja remover este usuário da empresa?")) return

    setProcessingEmail(email)

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setProcessingEmail(null)

    if (error) {
      toast.error("Erro ao remover usuário")
      return
    }

    toast.success("Usuário removido")
    await loadCompany()
  }

  async function aceitarConviteRecebido() {
    if (!receivedInvite) return

    setInviteLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const user = userData.user

    if (!user) {
      setInviteLoading(false)
      toast.error("Usuário não autenticado")
      return
    }

    await supabase
      .from("company_users")
      .delete()
      .eq("user_id", user.id)
      .eq("status", "accepted")

    const { error } = await supabase
      .from("company_users")
      .update({
        user_id: user.id,
        status: "accepted",
      })
      .eq("id", receivedInvite.id)

    setInviteLoading(false)

    if (error) {
      toast.error("Erro ao aceitar convite")
      return
    }

    toast.success("Você agora faz parte da nova empresa")
    setReceivedInvite(null)
    await loadCompany()
    await loadReceivedInvite()
  }

  async function recusarConviteRecebido() {
    if (!receivedInvite) return

    setInviteLoading(true)

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("id", receivedInvite.id)

    setInviteLoading(false)

    if (error) {
      toast.error("Erro ao recusar convite")
      return
    }

    toast.success("Convite recusado")
    setReceivedInvite(null)
    await loadReceivedInvite()
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando...</div>
  }

  if (myRole === "vendedor" && !receivedInvite) {
    return (
      <div className="p-6 md:p-10 text-white max-w-4xl mx-auto">
        <div className="bg-zinc-900/90 border border-zinc-800 p-10 rounded-3xl text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-5">
            <Shield size={28} />
          </div>

          <h1 className="text-2xl font-bold mb-2">Acesso restrito</h1>

          <p className="text-zinc-400 max-w-xl mx-auto">
            Apenas administradores e owners podem acessar as configurações da empresa.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-10 text-white max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-3">
        <div className="inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs">
          <Building2 size={14} />
          Gestão multiempresa
        </div>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Administração da Empresa
        </h1>

        <p className="text-zinc-400 max-w-3xl">
          Gerencie identidade da empresa, convites, permissões da equipe, comissão dos vendedores e metas comerciais em um único painel.
        </p>
      </div>

      {receivedInvite && receivedInvite.company_id !== myCompanyId && (
        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5 md:p-6 shadow-[0_15px_60px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                <Mail size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-cyan-300">
                  Você recebeu um convite para outra empresa
                </h2>

                <p className="text-sm text-cyan-100/80 mt-1">
                  Empresa convidando:{" "}
                  <strong>{receivedInvite.companies?.name || "Empresa não identificada"}</strong>
                </p>

                <p className="text-sm text-cyan-100/80">
                  Perfil no convite: <strong>{roleLabel(receivedInvite.role)}</strong>
                </p>

                <p className="text-sm text-amber-300 mt-3">
                  Ao aceitar, você perderá o vínculo com sua empresa atual e passará a fazer parte da nova empresa.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={recusarConviteRecebido}
                disabled={inviteLoading}
                className="h-11 px-5 rounded-xl border border-red-500/20 bg-red-500/15 text-red-400 font-semibold hover:bg-red-500/20 transition disabled:opacity-60 flex items-center gap-2"
              >
                <XCircle size={16} />
                Recusar
              </button>

              <button
                onClick={aceitarConviteRecebido}
                disabled={inviteLoading}
                className="h-11 px-5 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition disabled:opacity-60 flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                {inviteLoading ? "Processando..." : "Aceitar e trocar de empresa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {precisaDefinirNome && (
        <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 md:p-6 shadow-[0_15px_60px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-amber-300">
                  Defina o nome da sua empresa para continuar
                </h2>
                <p className="text-sm text-amber-100/80 mt-1 max-w-2xl">
                  Sua conta foi criada com o nome padrão <strong>“Minha Empresa”</strong>.
                  Atualize esse nome para deixar seu CRM com identidade profissional e facilitar convites da equipe.
                </p>
              </div>
            </div>

            <button
              onClick={updateCompanyName}
              disabled={savingName || !companyName.trim()}
              className="h-11 px-5 rounded-xl bg-amber-500 text-black font-semibold hover:bg-amber-400 transition disabled:opacity-60"
            >
              {savingName ? "Salvando..." : "Salvar nome da empresa"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          icon={<Building2 size={18} />}
          label="Empresa"
          value={companyName || "Não definida"}
          subvalue="Identidade principal"
        />

        <MetricCard
          icon={<Users size={18} />}
          label="Total de usuários"
          value={String(metrics.total)}
          subvalue="Equipe vinculada"
        />

        <MetricCard
          icon={<UserCheck size={18} />}
          label="Usuários ativos"
          value={String(metrics.ativos)}
          subvalue="Status accepted"
        />

        <MetricCard
          icon={<Mail size={18} />}
          label="Convites pendentes"
          value={String(metrics.pendentes)}
          subvalue="Aguardando aceite"
        />

        <MetricCard
          icon={<Percent size={18} />}
          label="Comissão média"
          value={`${metrics.comissaoMedia.toFixed(1)}%`}
          subvalue="Entre vendedores"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-zinc-950/70 border border-zinc-800 rounded-3xl p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Building2 size={18} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Informações da Empresa</h2>
              <p className="text-sm text-zinc-400">
                Atualize a identidade exibida no sistema para todos os usuários da empresa.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Digite o nome da sua empresa"
              className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex-1 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />

            <button
              onClick={updateCompanyName}
              disabled={savingName || !companyName.trim()}
              className="h-[50px] px-6 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-95 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save size={16} />
              {savingName ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <div className="bg-zinc-950/70 border border-zinc-800 rounded-3xl p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Shield size={18} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Seu acesso</h2>
              <p className="text-sm text-zinc-400">Perfil atual dentro da empresa.</p>
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow label="Perfil" value={roleLabel(myRole)} />
            <InfoRow
              label="Permissão"
              value={
                myRole === "owner"
                  ? "Controle total da empresa"
                  : myRole === "admin"
                  ? "Gerenciamento operacional"
                  : "Acesso comercial restrito"
              }
            />
            <InfoRow label="Empresa atual" value={companyName || "Não definida"} />
          </div>
        </div>
      </div>

      {(myRole === "admin" || myRole === "owner") && (
        <div className="bg-zinc-950/70 border border-zinc-800 rounded-3xl p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Mail size={18} />
            </div>

            <div>
              <h2 className="text-lg font-semibold">Convidar usuário</h2>
              <p className="text-sm text-zinc-400">
                Convide pessoas para sua empresa e defina o perfil antes do aceite.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_160px] gap-4">
            <input
              placeholder="Digite o email do usuário"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl focus:outline-none"
            >
              <option value="admin">Admin</option>
              <option value="vendedor">Vendedor</option>
            </select>

            <button
              onClick={inviteUser}
              disabled={sendingInvite}
              className="h-[50px] rounded-xl bg-emerald-600 hover:bg-emerald-500 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Mail size={16} />
              {sendingInvite ? "Enviando..." : "Convidar"}
            </button>
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            O convite será salvo como pendente até que o usuário entre na plataforma e aceite o vínculo.
          </div>
        </div>
      )}

      <div className="bg-zinc-950/70 border border-zinc-800 rounded-3xl p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-semibold">Usuários da Empresa ({users.length})</h2>
            <p className="text-sm text-zinc-400">
              Controle de perfis, status, comissão e metas da equipe.
            </p>
          </div>

          <button
            onClick={loadCompany}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2 text-sm"
          >
            <RefreshCcw size={14} />
            Atualizar lista
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1450px] text-left">
            <thead className="text-zinc-400 text-sm">
              <tr className="border-b border-zinc-800">
                <th className="pb-4 font-medium">Usuário</th>
                <th className="pb-4 font-medium">Perfil</th>
                <th className="pb-4 font-medium">Comissão</th>
                <th className="pb-4 font-medium">Meta Leads</th>
                <th className="pb-4 font-medium">Meta Vendas</th>
                <th className="pb-4 font-medium">Meta Receita</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Resumo</th>
                <th className="pb-4 font-medium">Ações</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isProcessing = processingEmail === user.email
                const isSavingSellerConfig = savingSellerConfigEmail === user.email
                const draft = sellerConfigs[user.email] || toDraft(user)
                const sellerSummary = getSellerSummary(user)
                const isSeller = user.role === "vendedor"
                const canManage = myRole === "admin" || myRole === "owner"

                return (
                  <tr key={user.email} className="border-b border-zinc-900/80 align-top">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center font-semibold">
                          {(user.email?.[0] || "?").toUpperCase()}
                        </div>

                        <div>
                          <div className="font-medium text-white">{user.email}</div>
                          <div className="text-xs text-zinc-500">
                            {user.id ? "Conta vinculada" : "Aguardando vínculo"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      <div className="flex flex-col gap-2">
                        <div className="inline-flex items-center gap-2 text-sm text-zinc-300">
                          {roleIcon(user.role)}
                          {roleLabel(user.role)}
                        </div>

                        <select
                          disabled={!canManage}
                          value={user.role}
                          onChange={(e) => updateRole(user.email, e.target.value)}
                          className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl w-[150px]"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="vendedor">Vendedor</option>
                        </select>
                      </div>
                    </td>

                    <td className="py-4 pr-4">
                      {isSeller ? (
                        <div className="space-y-2">
                          <div className="relative w-[110px]">
                            <Percent
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                            />
                            <input
                              value={draft.comissao_percentual}
                              onChange={(e) =>
                                updateSellerDraft(
                                  user.email,
                                  "comissao_percentual",
                                  e.target.value
                                )
                              }
                              disabled={!canManage}
                              placeholder="0"
                              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 pl-9 rounded-xl"
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            Atual: {sellerSummary.comissao.toFixed(1)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Não se aplica</span>
                      )}
                    </td>

                    <td className="py-4 pr-4">
                      {isSeller ? (
                        <div className="space-y-2">
                          <div className="relative w-[120px]">
                            <Target
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                            />
                            <input
                              value={draft.meta_leads}
                              onChange={(e) =>
                                updateSellerDraft(user.email, "meta_leads", e.target.value)
                              }
                              disabled={!canManage}
                              placeholder="0"
                              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 pl-9 rounded-xl"
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            Atual: {sellerSummary.metaLeads}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Não se aplica</span>
                      )}
                    </td>

                    <td className="py-4 pr-4">
                      {isSeller ? (
                        <div className="space-y-2">
                          <div className="relative w-[120px]">
                            <TrendingUp
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                            />
                            <input
                              value={draft.meta_vendas}
                              onChange={(e) =>
                                updateSellerDraft(user.email, "meta_vendas", e.target.value)
                              }
                              disabled={!canManage}
                              placeholder="0"
                              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 pl-9 rounded-xl"
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            Atual: {sellerSummary.metaVendas}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Não se aplica</span>
                      )}
                    </td>

                    <td className="py-4 pr-4">
                      {isSeller ? (
                        <div className="space-y-2">
                          <div className="relative w-[150px]">
                            <DollarSign
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                            />
                            <input
                              value={draft.meta_receita}
                              onChange={(e) =>
                                updateSellerDraft(user.email, "meta_receita", e.target.value)
                              }
                              disabled={!canManage}
                              placeholder="0"
                              className="w-full bg-zinc-900 border border-zinc-800 p-2.5 pl-9 rounded-xl"
                            />
                          </div>
                          <div className="text-xs text-zinc-500">
                            Atual: {formatCurrency(sellerSummary.metaReceita)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">Não se aplica</span>
                      )}
                    </td>

                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusClass(
                          user.status
                        )}`}
                      >
                        {statusLabel(user.status)}
                      </span>
                    </td>

                    <td className="py-4 pr-4 text-sm text-zinc-400 min-w-[260px]">
                      {isSeller ? (
                        <div className="space-y-1">
                          <div>Comissão: {sellerSummary.comissao.toFixed(1)}%</div>
                          <div>Meta leads: {sellerSummary.metaLeads}</div>
                          <div>Meta vendas: {sellerSummary.metaVendas}</div>
                          <div>Meta receita: {formatCurrency(sellerSummary.metaReceita)}</div>
                        </div>
                      ) : (
                        <>
                          {user.status === "accepted" && "Usuário ativo na empresa"}
                          {user.status === "pending" && "Convite enviado aguardando aceite"}
                          {user.status === "inactive" && "Acesso desativado temporariamente"}
                        </>
                      )}
                    </td>

                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {isSeller && canManage && (
                          <button
                            onClick={() => saveSellerConfig(user.email)}
                            disabled={isSavingSellerConfig}
                            className="h-10 px-4 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                          >
                            <Save size={14} />
                            {isSavingSellerConfig ? "Salvando..." : "Salvar config"}
                          </button>
                        )}

                        {user.status !== "inactive" ? (
                          <button
                            onClick={() => deactivateUser(user.email)}
                            disabled={isProcessing}
                            className="h-10 px-4 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                          >
                            <UserX size={14} />
                            Desativar
                          </button>
                        ) : (
                          <button
                            onClick={() => reactivateUser(user.email)}
                            disabled={isProcessing}
                            className="h-10 px-4 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                          >
                            <UserCheck size={14} />
                            Reativar
                          </button>
                        )}

                        <button
                          onClick={() => removeUser(user.email)}
                          disabled={isProcessing}
                          className="h-10 px-4 rounded-xl bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode
  label: string
  value: string
  subvalue: string
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-zinc-400 text-sm">{label}</div>
        <div className="text-cyan-400">{icon}</div>
      </div>

      <div className="text-2xl font-bold text-white truncate">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{subvalue}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-zinc-400">{label}</span>
      <span className="text-sm text-white text-right max-w-[220px]">{value}</span>
    </div>
  )
}