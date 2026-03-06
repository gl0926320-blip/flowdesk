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

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("vendedor")

  async function loadCompany() {

    const { data: userData } = await supabase.auth.getUser()

    const { data: me } = await supabase
  .from("company_users")
  .select("role")
  .eq("user_id", userData.user?.id)
  .maybeSingle()

    if (me) setMyRole(me.role)

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", userData.user?.id)
      .maybeSingle()

    if (!companyUser) return

    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyUser.company_id)
      .single()

    if (company) setCompanyName(company.name)

    const { data: companyUsers } = await supabase
      .from("company_users")
      .select("user_id, email, role, status")
      .eq("company_id", companyUser.company_id)

    if (companyUsers) {
      const usersFormatted = companyUsers.map((u: any) => ({
        id: u.user_id,
        email: u.email,
        role: u.role,
        status: u.status
      }))

      setUsers(usersFormatted)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadCompany()
  }, [])

  async function updateCompanyName() {

    const { data: userData } = await supabase.auth.getUser()

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", userData.user?.id)
      .single()

    if (!companyUser) {
      alert("Empresa não encontrada")
      return
    }

    await supabase
      .from("companies")
      .update({ name: companyName })
      .eq("id", companyUser.company_id)

    toast.success("Empresa atualizada")
  }

  async function inviteUser() {

    const { data: userData } = await supabase.auth.getUser()

    const { data: companyUser } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", userData.user?.id)
      .single()

    if (!companyUser) {
      toast.error("Empresa não encontrada")
      return
    }

    const { error } = await supabase
      .from("company_users")
      .insert({
        company_id: companyUser.company_id,
        email: inviteEmail,
        role: inviteRole,
        status: "pending"
      })

    if (error) {
      toast.error("Erro ao enviar convite")
      return
    }

    toast.success("Convite enviado")
    setInviteEmail("")
    loadCompany()
  }

  async function updateRole(email: string, role: string) {

    await supabase
      .from("company_users")
      .update({ role })
      .eq("email", email)

    loadCompany()
  }

  async function deactivateUser(email: string) {

    await supabase
      .from("company_users")
      .update({ status: "inactive" })
      .eq("email", email)

    loadCompany()
  }

  async function removeUser(email: string) {

    if (!confirm("Tem certeza?")) return

    await supabase
      .from("company_users")
      .delete()
      .eq("email", email)

    loadCompany()
  }

  if (loading) {
    return <div className="p-10 text-white">Carregando...</div>
  }

  if (myRole === "vendedor") {
  return (
    <div className="p-10 text-white max-w-3xl mx-auto">

      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-xl text-center">

        <div className="text-5xl mb-4">
          🔒
        </div>

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
                    onChange={(e) =>
                      updateRole(user.email, e.target.value)
                    }
                    className="bg-zinc-800 p-2 rounded"
                  >
                    <option value="admin">Admin</option>
                    <option value="vendedor">Vendedor</option>
                  </select>

                </td>

                <td>{user.status}</td>

                <td className="flex gap-3">

                  {myRole === "admin" && (
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