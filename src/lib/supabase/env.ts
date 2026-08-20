function requiredPublicEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example.`);
  }

  return value;
}

export function getSupabasePublicEnv() {
  return {
    url: requiredPublicEnv("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: requiredPublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}
