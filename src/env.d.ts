declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient<import("@/db/database.types").Database> | null;
    user: import("@supabase/supabase-js").User | null;
  }
}
