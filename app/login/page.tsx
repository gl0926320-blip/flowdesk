"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: any) {
    e.preventDefault();

    if (!email || !password) {
      alert("Preencha email e senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("LOGIN ERROR:", error);

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleRegister() {
    if (!email || !password) {
      alert("Preencha email e senha.");
      return;
    }

    if (password.length < 6) {
      alert("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    console.log("SIGNUP DATA:", data);
    console.log("SIGNUP ERROR:", error);

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Conta criada com sucesso! Agora faça login.");
      setEmail("");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen flex bg-black text-white overflow-hidden">

      {/* LADO ESQUERDO */}
      <div className="hidden lg:flex w-1/2 relative bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 p-16 flex-col justify-between">

        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl font-bold tracking-tight">
            FlowDesk
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-md">
            O CRM inteligente que transforma orçamentos em serviços fechados.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <div>
            <p className="text-3xl font-bold">+2.000</p>
            <p className="text-white/70 text-sm">
              serviços organizados
            </p>
          </div>

          <div>
            <p className="text-3xl font-bold">98%</p>
            <p className="text-white/70 text-sm">
              taxa de acompanhamento
            </p>
          </div>

          <div>
            <p className="text-3xl font-bold">24h</p>
            <p className="text-white/70 text-sm">
              produtividade otimizada
            </p>
          </div>
        </motion.div>

        <div className="absolute w-[400px] h-[400px] bg-white/20 blur-3xl rounded-full top-[-100px] left-[-100px]" />
        <div className="absolute w-[400px] h-[400px] bg-purple-800/40 blur-3xl rounded-full bottom-[-100px] right-[-100px]" />
      </div>

      {/* LADO DIREITO */}
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-6 relative">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl rounded-2xl p-10 w-full max-w-md"
        >
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold">
              Acesse sua conta
            </h2>
            <p className="text-zinc-400 text-sm mt-2">
              Gerencie seus serviços com inteligência
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            <input
              type="email"
              placeholder="Seu email"
              value={email}
              className="w-full bg-zinc-900/60 border border-zinc-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Sua senha"
              value={password}
              className="w-full bg-zinc-900/60 border border-zinc-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              disabled={loading}
              className="relative w-full overflow-hidden bg-blue-600 hover:bg-blue-700 transition p-3 rounded-lg font-semibold"
            >
              <span className="relative z-10">
                {loading ? "Entrando..." : "Entrar"}
              </span>

              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] animate-[shine_2s_infinite]" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={handleRegister}
              disabled={loading}
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              Criar nova conta
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-zinc-500">
            © {new Date().getFullYear()} FlowDesk
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>

    </div>
  );
}