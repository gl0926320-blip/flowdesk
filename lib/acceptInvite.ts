import { createClient } from "@/lib/supabase-browser"

export async function acceptInvite() {

  const supabase = createClient()

  const { data: userData } = await supabase.auth.getUser()

  if (!userData.user) return

  const email = userData.user.email
  const userId = userData.user.id

  const { data: invite } = await supabase
    .from("company_users")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle()

  if (!invite) return

  await supabase
    .from("company_users")
    .update({
      status: "active",
      user_id: userId
    })
    .eq("id", invite.id)

}