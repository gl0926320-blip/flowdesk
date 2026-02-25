"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation"

export default function Register() {
  const supabase = createClient();
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    const user = data.user

    if (user) {
      await supabase.from("profiles").insert([
        {
          id: user.id,
          email: user.email,
          plano: "free",
        },
      ])
    }

    alert("Conta criada com sucesso!")
    router.push("/login")
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <div className="bg-gray-900 p-8 rounded-xl w-full max-w-md">
        <h1 className="text-2xl mb-6 font-semibold text-center">
          Criar conta
        </h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-3 bg-gray-800 rounded outline-none focus:ring-2 focus:ring-purple-600"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full mb-6 p-3 bg-gray-800 rounded outline-none focus:ring-2 focus:ring-purple-600"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleSignUp}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 transition p-3 rounded font-medium"
        >
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </div>
    </div>
  )
}