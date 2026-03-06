"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"
import { toast } from "sonner"

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
  const [myRole, setMyRole] = useState("")
  const [myCompanyId, setMyCompanyId] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("vendedor")

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
    }

    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("user_id, email, role, status")
      .eq("company_id", me.company_id)
      .order("email", { ascending: true })

    if (companyUsers) {
      const usersFormatted = companyUsers.map((u: any) => ({
        id: u.user_id,
        email: u.email,
        role: u.role,
        status: u.status,
      }))

      setUsers(usersFormatted)
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

    const { error } = await supabase
      .from("companies")
      .update({ name: companyName })
      .eq("id", myCompanyId)

    if (error) {
      toast.error("Erro ao atualizar empresa")
      return
    }

    toast.success("Empresa atualizada")
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

    const { data: existingInvite } = await supabase
      .from("company_users")
      .select("id, email, status")
      .eq("company_id", myCompanyId)
      .eq("email", emailNormalizado)
      .maybeSingle()

    if (existingInvite) {
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

    if (error) {
      toast.error("Erro ao enviar convite")
      return
    }

    toast.success("Convite enviado")
    setInviteEmail("")
    setInviteRole("vendedor")
    loadCompany()
  }

  async function updateRole(email: string, role: string) {
    if (!myCompanyId) return

    const { error } = await supabase
      .from("company_users")
      .update({ role })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    if (error) {
      toast.error("Erro ao atualizar perfil")
      return
    }

    toast.success("Perfil atualizado")
    loadCompany()
  }

  async function deactivateUser(email: string) {
    if (!myCompanyId) return

    const { error } = await supabase
      .from("company_users")
      .update({ status: "inactive" })
      .eq("company_id", myCompanyId)
      .eq("email", email)

    if (error) {
      toast.error("Erro ao desativar usuário")
      return
    }

    toast.success("Usuário desativado")
    loadCompany()
  }

  async function removeUser(email: string) {
    if (!myCompanyId) return
    if (!confirm("Tem certeza?")) return

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("company_id", myCompanyId)
      .eq("email", email)

    if (error) {
      toast.error("Erro ao remover usuário")
      return
    }

    toast.success("Usuário removido")
    loadCompany()
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando...</div>
  }

  if (myRole === "vendedor") {
    return (
      <div className="p-10 text-white max-w-3xl mx-auto">
        <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-xl text-center">
          <div className="text-5xl mb-4">🔒</div>

          <h1 className="text-2xl font-bold mb-2">
            Acesso restrito
          </h1>

          <p className="text-zinc-400">
            Apenas administradores podem acessar as configurações da empresa.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-10 text-white max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">
        Administração da Empresa
      </h1>

      {(myRole === "admin" || myRole === "owner") && (
        <>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mb-10">
            <h2 className="text-lg font-semibold mb-4">
              Informações da Empresa
            </h2>

            <div className="flex gap-4">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-zinc-800 p-3 rounded-lg flex-1"
              />

              <button
                onClick={updateCompanyName}
                className="bg-purple-600 px-6 rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl mb-10">
            <h2 className="text-lg font-semibold mb-4">
              Convidar usuário
            </h2>

            <div className="flex gap-4">
              <input
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-zinc-800 p-3 rounded-lg flex-1"
              />

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="bg-zinc-800 p-3 rounded-lg"
              >
                <option value="admin">Admin</option>
                <option value="vendedor">Vendedor</option>
              </select>

              <button
                onClick={inviteUser}
                className="bg-green-600 px-6 py-2 rounded-lg"
              >
                Convidar
              </button>
            </div>
          </div>
        </>
      )}

      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <h2 className="text-lg font-semibold mb-6">
          Usuários da Empresa ({users.length})
        </h2>

        <table className="w-full text-left">
          <thead className="text-zinc-400 text-sm">
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr key={user.email} className="border-t border-zinc-800">
                <td className="py-4">{user.email}</td>

                <td>
                  <select
                    disabled={myRole !== "admin" && myRole !== "owner"}
                    value={user.role}
                    onChange={(e) => updateRole(user.email, e.target.value)}
                    className="bg-zinc-800 p-2 rounded"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="vendedor">Vendedor</option>
                  </select>
                </td>

                <td>{user.status}</td>

                <td className="flex gap-3">
                  {(myRole === "admin" || myRole === "owner") && (
                    <>
                      <button
                        onClick={() => deactivateUser(user.email)}
                        className="text-yellow-400"
                      >
                        Desativar
                      </button>

                      <button
                        onClick={() => removeUser(user.email)}
                        className="text-red-400"
                      >
                        Remover
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}