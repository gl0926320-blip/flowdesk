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
} from "lucide-react"

type User = {
  id: string | null
  email: string
  role: string
  status: string
}

export default function EmpresaPage() {
  const supabase = createClient()

  const [companyName, setCompanyName] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [processingEmail, setProcessingEmail] = useState<string | null>(null)

  const [myRole, setMyRole] = useState("")
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("vendedor")

  const precisaDefinirNome =
    !companyName.trim() || companyName.trim().toLowerCase() === "minha empresa"

  const metrics = useMemo(() => {
    const total = users.length
    const ativos = users.filter((u) => u.status === "accepted").length
    const pendentes = users.filter((u) => u.status === "pending").length
    const inativos = users.filter((u) => u.status === "inactive").length

    return { total, ativos, pendentes, inativos }
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
      .select("user_id, email, role, status")
      .eq("company_id", me.company_id)
      .order("created_at", { ascending: true })

    if (companyUsers) {
      const usersFormatted = companyUsers.map((u: any) => ({
        id: u.user_id,
        email: u.email,
        role: u.role,
        status: u.status,
      }))

      setUsers(usersFormatted)
    } else {
      setUsers([])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadCompany()
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
    loadCompany()
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

    const { error } = await supabase
      .from("company_users")
      .insert({
        company_id: myCompanyId,
        email: emailNormalizado,
        role: inviteRole,
        status: "pending",
      })

    setSendingInvite(false)

    if (error) {
      toast.error("Erro ao enviar convite")
      return
    }

    toast.success("Convite enviado com sucesso")
    setInviteEmail("")
    setInviteRole("vendedor")
    loadCompany()
  }

  async function updateRole(email: string, role: string) {
    if (!myCompanyId) return

    setProcessingEmail(email)

    const { error } = await supabase
      .from("company_users")
      .update({ role })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    setProcessingEmail(null)

    if (error) {
      toast.error("Erro ao atualizar perfil")
      return
    }

    toast.success("Perfil atualizado")
    loadCompany()
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
    loadCompany()
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
    loadCompany()
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
    loadCompany()
  }

  if (loading) {
    return (
      <div className="p-10 text-white">
        Carregando...
      </div>
    )
  }

  if (myRole === "vendedor") {
    return (
      <div className="p-6 md:p-10 text-white max-w-4xl mx-auto">
        <div className="bg-zinc-900/90 border border-zinc-800 p-10 rounded-3xl text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-5">
            <Shield size={28} />
          </div>

          <h1 className="text-2xl font-bold mb-2">
            Acesso restrito
          </h1>

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
          Gerencie identidade da empresa, convites, permissões da equipe e status de acesso em um único painel.
        </p>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <p className="text-sm text-zinc-400">
                Perfil atual dentro da empresa.
              </p>
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
            <h2 className="text-lg font-semibold">
              Usuários da Empresa ({users.length})
            </h2>
            <p className="text-sm text-zinc-400">
              Controle de perfis, status e acesso da equipe.
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
          <table className="w-full min-w-[860px] text-left">
            <thead className="text-zinc-400 text-sm">
              <tr className="border-b border-zinc-800">
                <th className="pb-4 font-medium">Usuário</th>
                <th className="pb-4 font-medium">Perfil</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Resumo</th>
                <th className="pb-4 font-medium">Ações</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => {
                const isProcessing = processingEmail === user.email

                return (
                  <tr key={user.email} className="border-b border-zinc-900/80">
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
                          disabled={myRole !== "admin" && myRole !== "owner"}
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
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusClass(user.status)}`}>
                        {statusLabel(user.status)}
                      </span>
                    </td>

                    <td className="py-4 pr-4 text-sm text-zinc-400">
                      {user.status === "accepted" && "Usuário ativo na empresa"}
                      {user.status === "pending" && "Convite enviado aguardando aceite"}
                      {user.status === "inactive" && "Acesso desativado temporariamente"}
                    </td>

                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
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