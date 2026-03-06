import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import DashboardClientLayout from "./DashboardClientLayout";
import { Toaster } from "sonner";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <DashboardClientLayout>
        {children}
      </DashboardClientLayout>

      {/* Toast notifications */}
      <Toaster richColors position="top-right" />
    </>
  );
}