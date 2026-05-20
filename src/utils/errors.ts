type MaybeSupabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes("failed to fetch")) {
      return "No se pudo conectar con Supabase. Revisa la conexión y vuelve a intentarlo.";
    }
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const supabaseError = error as MaybeSupabaseError;
    if (supabaseError.code === "PGRST202") {
      return "Falta instalar las funciones RPC en Supabase. Ejecuta supabase/rpc.sql en el SQL Editor.";
    }
    if (supabaseError.code === "PGRST205" || supabaseError.message?.includes("Could not find the table")) {
      return "Faltan las tablas en Supabase. Ejecuta supabase/schema.sql, policies.sql, rpc.sql y seed.sql.";
    }
    return [supabaseError.message, supabaseError.details, supabaseError.hint].filter(Boolean).join(" ") || fallback;
  }

  return fallback;
};
