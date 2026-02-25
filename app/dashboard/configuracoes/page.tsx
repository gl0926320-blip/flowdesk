"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-browser"

export default function ConfiguracoesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [nomeEmpresa, setNomeEmpresa] = useState("")
  const [telefone, setTelefone] = useState("")

  const [toast, setToast] = useState<{
    mensagem: string
    tipo: "sucesso" | "erro"
  } | null>(null)

  useEffect(() => {
    async function carregarDados() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from("profiles")
        .select("nome_empresa, telefone")
        .eq("id", user.id)
        .single()

      if (data) {
        setNomeEmpresa(data.nome_empresa || "")
        setTelefone(data.telefone || "")
      }

      setLoading(false)
    }

    carregarDados()
  }, [supabase])

  function mostrarToast(mensagem: string, tipo: "sucesso" | "erro") {
    setToast({ mensagem, tipo })

    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  // ✅ Validação profissional de telefone brasileiro
  function validarTelefone(valor: string) {
    const numero = valor.replace(/\D/g, "")

    // Deve ter 10 ou 11 dígitos
    if (numero.length < 10 || numero.length > 11) {
      return false
    }

    // Não pode ser todos números iguais (ex: 99999999999)
    if (/^(\d)\1+$/.test(numero)) {
      return false
    }

    const ddd = numero.slice(0, 2)

    // DDD não pode começar com 0
    if (ddd.startsWith("0")) {
      return false
    }

    // Se for celular (11 dígitos), o terceiro número deve ser 9
    if (numero.length === 11 && numero[2] !== "9") {
      return false
    }

    return true
  }

  async function salvar() {
    if (!nomeEmpresa.trim()) {
      mostrarToast("Nome da empresa é obrigatório", "erro")
      return
    }

    if (!validarTelefone(telefone)) {
      mostrarToast("Telefone inválido. Use DDD + número válido.", "erro")
      return
    }

    setSaving(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      mostrarToast("Erro ao autenticar usuário", "erro")
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        nome_empresa: nomeEmpresa.trim(),
        telefone: telefone.replace(/\D/g, ""),
      })
      .eq("id", user.id)

    if (error) {
      console.error(error)
      mostrarToast("Erro ao salvar configurações", "erro")
      setSaving(false)
      return
    }

    mostrarToast("Configurações salvas com sucesso!", "sucesso")
    setSaving(false)
  }

  if (loading) {
    return <div className="p-6 text-white">Carregando...</div>
  }

  return (
    <div className="p-6 text-white relative">
      <h1 className="text-2xl mb-6">Configurações</h1>

      <div className="bg-gray-900 p-6 rounded max-w-xl">
        <div className="mb-4">
          <label className="block mb-2">Nome da Empresa</label>
          <input
            className="w-full p-2 bg-gray-800 rounded"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2">Telefone</label>
          <input
            className="w-full p-2 bg-gray-800 rounded"
            value={telefone}
            onChange={(e) =>
              setTelefone(e.target.value.replace(/\D/g, ""))
            }
            placeholder="Ex: 11999999999"
            maxLength={11}
          />
        </div>

        <button
          onClick={salvar}
          disabled={saving}
          className="bg-purple-600 px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      {toast && (
        <div
          className={`fixed top-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
            toast.tipo === "sucesso"
              ? "bg-green-600"
              : "bg-red-600"
          }`}
        >
          {toast.mensagem}
        </div>
      )}
    </div>
  )
}