import { createClient } from '@supabase/supabase-js'

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log("KEY START:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20))

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)