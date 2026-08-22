import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

export interface PlatformActivity {
  id: string;
  entityType: string;
  action: "created" | "updated" | "deleted";
  subject: string;
  metadata: Json;
  createdAt: string;
}

export async function getRecentPlatformActivity(limit = 20): Promise<PlatformActivity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_activity")
    .select("id, entity_type, action, subject, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("No fue posible consultar la actividad de la plataforma.");
    return [];
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    entityType: item.entity_type,
    action: item.action,
    subject: item.subject,
    metadata: item.metadata,
    createdAt: item.created_at,
  }));
}
