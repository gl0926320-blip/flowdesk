"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Teste() {
  useEffect(() => {
    async function test() {
      const { data, error } = await supabase.from("users").select("*");
      console.log(data, error);
    }

    test();
  }, []);

  return <div>Teste Supabase</div>;
}