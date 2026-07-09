import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client using the anon key.
// Safe to use in client components — only has access permitted by RLS policies.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
