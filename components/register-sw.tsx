"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("Service Worker registrado com sucesso");
      })
      .catch((error) => {
        console.error("Erro ao registrar service worker:", error);
      });
  }, []);

  return null;
}