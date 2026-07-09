import { createClient } from "@supabase/supabase-js";

// Server-side Supabase admin client using the service-role key.
// Bypasses all RLS. Only use in Route Handlers and Server Actions.
// NEVER import this file in client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
