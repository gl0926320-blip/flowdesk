"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type AuthMode = "login" | "register" | "reset" | "update";

export default function Login() {
  const router = useRouter();
  const supabase = createClient();
  const recoveryHandledRef = useRef(false);

  const [mode, setMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 6) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  const strengthLabel = ["Muito fraca", "Fraca", "Boa", "Forte", "Muito forte"];

  function resetMessages() {
    setErrorMsg(null);
    setSuccessMsg(null);
  }

  function clearSensitiveFields() {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
  }

  function changeMode(newMode: AuthMode) {
    resetMessages();
    clearSensitiveFields();
    setMode(newMode);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapAuthFlow() {
      try {
        resetMessages();

        const currentUrl = new URL(window.location.href);
        const code = currentUrl.searchParams.get("code");
        const type = currentUrl.searchParams.get("type");

        const hash = window.location.hash || "";
        const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
        const hashType = hashParams.get("type");

        if (recoveryHandledRef.current) {
          setBootLoading(false);
          return;
        }

        if (code) {
          recoveryHandledRef.current = true;

          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (!mounted) return;

          if (error) {
            const { data: sessionData } = await supabase.auth.getSession();

            if (sessionData.session) {
              clearSensitiveFields();
              setMode("update");
              window.history.replaceState({}, document.title, currentUrl.pathname);
              setBootLoading(false);
              return;
            }

            setErrorMsg("O link de recuperação é inválido ou expirou.");
            setMode("login");
            setBootLoading(false);
            return;
          }

          clearSensitiveFields();
          setMode("update");
          window.history.replaceState({}, document.title, currentUrl.pathname);
          setBootLoading(false);
          return;
        }

        if (type === "recovery") {
          recoveryHandledRef.current = true;
          clearSensitiveFields();
          setMode("update");
          setBootLoading(false);
          return;
        }

        if (hashType === "recovery") {
          recoveryHandledRef.current = true;
          clearSensitiveFields();
          setMode("update");
          setBootLoading(false);
          return;
        }

        setBootLoading(false);
      } catch {
        if (!mounted) return;
        setErrorMsg("Não foi possível validar o link de recuperação.");
        setMode("login");
        setBootLoading(false);
      }
    }

    bootstrapAuthFlow();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        resetMessages();
        clearSensitiveFields();
        setMode("update");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (!email || !password) {
      setErrorMsg("Preencha email e senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("Email ou senha incorretos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (!email || !password || !confirmPassword) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    if (passwordStrength < 2) {
      setErrorMsg("Use uma senha mais forte.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Conta criada! Verifique seu email.");
    setTimeout(() => changeMode("login"), 2000);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (!email) {
      setErrorMsg("Digite seu email.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("Erro ao enviar email.");
      return;
    }

    setSuccessMsg("Email de recuperação enviado!");
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    if (!password || !confirmPassword) {
      setErrorMsg("Preencha os dois campos de senha.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    if (passwordStrength < 2) {
      setErrorMsg("Use uma senha mais forte.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("Não foi possível atualizar sua senha.");
      return;
    }

    setSuccessMsg("Senha atualizada com sucesso! Redirecionando para o login...");

    setTimeout(async () => {
      await supabase.auth.signOut();
      clearSensitiveFields();
      setMode("login");
      router.replace("/login");
      router.refresh();
    }, 1800);
  }

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-sm text-zinc-400">Validando acesso...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-black text-white">
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-16 flex-col justify-between">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

        <div className="relative z-10">
          <span className="text-xs tracking-widest text-white/70 uppercase">
            Web Division
          </span>

          <h1 className="text-5xl font-bold mt-6 leading-tight">
            Feche mais orçamentos <br /> com inteligência.
          </h1>

          <p className="mt-6 text-white/90 text-lg max-w-md">
            Organize clientes, acompanhe propostas e visualize seu crescimento em tempo real.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-2xl"
          >
            <p className="text-white/70 text-sm">Conversões</p>
            <p className="text-2xl font-bold mt-1">+32%</p>

            <svg viewBox="0 0 320 160" className="mt-4">
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>

              <motion.path
                d="M10 140 Q 60 120 110 100 T 210 70 T 310 40"
                fill="transparent"
                stroke="url(#lineGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </svg>
          </motion.div>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-2xl"
          >
            <p className="text-white/70 text-sm">Receita</p>
            <p className="text-2xl font-bold mt-1">R$ 48k</p>

            <div className="flex items-end gap-3 h-24 mt-6">
              {[40, 70, 55, 90, 65].map((h, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-blue-500 to-purple-500 rounded"
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                />
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-2xl flex flex-col items-center"
          >
            <p className="text-white/70 text-sm self-start">Propostas</p>
            <p className="text-2xl font-bold mt-1 self-start">124</p>

            <svg width="120" height="120" viewBox="0 0 120 120" className="mt-4">
              <circle
                cx="60"
                cy="60"
                r="50"
                stroke="#1f2937"
                strokeWidth="15"
                fill="transparent"
              />

              <motion.circle
                cx="60"
                cy="60"
                r="50"
                stroke="url(#pieGradient)"
                strokeWidth="15"
                fill="transparent"
                strokeDasharray="314"
                strokeDashoffset="100"
                strokeLinecap="round"
                initial={{ strokeDashoffset: 314 }}
                animate={{ strokeDashoffset: 100 }}
                transition={{ duration: 1.5 }}
                transform="rotate(-90 60 60)"
              />

              <defs>
                <linearGradient id="pieGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>

            <p className="text-xs text-white/60 mt-2">68% fechadas</p>
          </motion.div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-8">
          <div>
            <p className="text-3xl font-bold">+2.000</p>
            <p className="text-white/80 text-sm">orçamentos gerados</p>
          </div>
          <div>
            <p className="text-3xl font-bold">98%</p>
            <p className="text-white/80 text-sm">mais organização</p>
          </div>
          <div>
            <p className="text-3xl font-bold">5h+</p>
            <p className="text-white/80 text-sm">economizadas/semana</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-6">
        <div className="relative w-full max-w-md">
          <motion.div
            key={mode}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="backdrop-blur-2xl bg-white/5 border border-white/10 shadow-[0_0_40px_rgba(139,92,246,0.15)] rounded-2xl p-10"
          >
            <h2 className="text-2xl font-bold text-center mb-2">
              {mode === "login" && "Acesse sua conta"}
              {mode === "register" && "Criar nova conta"}
              {mode === "reset" && "Recuperar senha"}
              {mode === "update" && "Definir nova senha"}
            </h2>

            <p className="text-center text-zinc-400 text-sm mb-6">
              {mode === "login" && "Gerencie seus serviços com inteligência"}
              {mode === "register" && "Comece gratuitamente. Sem cartão de crédito."}
              {mode === "reset" && "Enviaremos um link para redefinir sua senha"}
              {mode === "update" && "Digite sua nova senha para recuperar o acesso"}
            </p>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 text-sm p-3 rounded-lg mb-4">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-500/10 border border-green-500 text-green-400 text-sm p-3 rounded-lg mb-4">
                {successMsg}
              </div>
            )}

            <form
              onSubmit={
                mode === "login"
                  ? handleLogin
                  : mode === "register"
                  ? handleRegister
                  : mode === "reset"
                  ? handleReset
                  : handleUpdatePassword
              }
              className="space-y-4"
            >
              {(mode === "login" || mode === "register" || mode === "reset") && (
                <input
                  type="email"
                  placeholder="Seu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-zinc-700 p-3 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                />
              )}

              {(mode === "login" || mode === "register" || mode === "update") && (
                <>
                  <PasswordField
                    password={password}
                    setPassword={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                    placeholder={mode === "update" ? "Nova senha" : "Sua senha"}
                  />

                  {(mode === "register" || mode === "update") && (
                    <>
                      <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                          style={{ width: `${passwordStrength * 25}%` }}
                        />
                      </div>

                      <p className="text-xs text-zinc-400">
                        {strengthLabel[passwordStrength]}
                      </p>

                      <PasswordField
                        password={confirmPassword}
                        setPassword={setConfirmPassword}
                        show={showConfirm}
                        setShow={setShowConfirm}
                        placeholder={
                          mode === "update" ? "Confirmar nova senha" : "Confirmar senha"
                        }
                      />
                    </>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02] active:scale-[0.98] transition-all p-3 rounded-lg font-semibold shadow-lg disabled:opacity-70"
              >
                {loading
                  ? "Processando..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "register"
                  ? "Criar conta"
                  : mode === "reset"
                  ? "Enviar email"
                  : "Atualizar senha"}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-zinc-400 space-y-2">
              {mode === "login" && (
                <>
                  <button onClick={() => changeMode("reset")} className="hover:underline">
                    Esqueceu a senha?
                  </button>
                  <div>
                    Não tem conta?{" "}
                    <button
                      onClick={() => changeMode("register")}
                      className="text-white hover:underline"
                    >
                      Criar conta
                    </button>
                  </div>
                </>
              )}

              {mode === "register" && (
                <button onClick={() => changeMode("login")} className="hover:underline">
                  Já tem conta? Entrar
                </button>
              )}

              {mode === "reset" && (
                <button onClick={() => changeMode("login")} className="hover:underline">
                  Voltar para login
                </button>
              )}

              {mode === "update" && (
                <div className="text-zinc-500 text-xs">
                  Você está no fluxo seguro de redefinição de senha.
                </div>
              )}
            </div>

            <div className="mt-8 text-center text-xs text-zinc-500">
              © {new Date().getFullYear()} FlowDesk
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  password,
  setPassword,
  show,
  setShow,
  placeholder = "Sua senha",
}: {
  password: string;
  setPassword: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-zinc-900/60 border border-zinc-700 p-3 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition pr-12"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400"
      >
        {show ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}