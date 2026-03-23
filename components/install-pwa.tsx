"use client";

import { useEffect, useState } from "react";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPWA() {
  const [prompt, setPrompt] = useState<DeferredPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as DeferredPrompt);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (isStandalone) return null;

  const handleInstall = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
      setShowHint(false);
      return;
    }

    setShowHint((prev) => !prev);
  };

  return (
    <div className="mt-3 flex flex-col items-center">
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-500/20 hover:text-white"
      >
        <span className="text-xs">⬇</span>
        Instalar app
      </button>

      {!prompt && showHint && (
        <div className="relative mt-3 w-full max-w-[260px] rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-3 text-center shadow-[0_0_20px_rgba(34,211,238,0.08)]">
          <div className="absolute -top-2 right-8 text-cyan-300 text-lg">↗</div>

          <p className="text-[11px] font-medium text-cyan-100">
            Para instalar o FlowDesk
          </p>

          <p className="mt-1 text-[11px] leading-5 text-zinc-300">
            clique em <span className="font-semibold text-white">“Instalar”</span> no
            canto superior direito do navegador.
          </p>
        </div>
      )}
    </div>
  );
}