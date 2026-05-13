import type { SupabaseUser } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: SupabaseUser;
    }
  }
}
