import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.");

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = [
  { username: "admin", password: "ippadmin123", role: "admin", fullName: "Administrador IPP" },
  { username: "profe", password: "ippprofe123", role: "teacher", fullName: "Profesor demo" },
  { username: "gestor", password: "ippgestor123", role: "contact_manager", fullName: "Gestor demo" },
];

for (const entry of users) {
  const email = `${entry.username}@ipp.local`;
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;
  let user = listed.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: entry.password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`No fue posible crear ${entry.username}.`);
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: entry.password, email_confirm: true });
    if (error) throw error;
  }
  const { error: profileError } = await admin.from("profiles").upsert({ id: user.id, role: entry.role, full_name: entry.fullName, active: true });
  if (profileError) throw profileError;
  if (entry.role === "teacher") {
    const { error: teacherError } = await admin.from("teachers").upsert({ profile_id: user.id, display_name: entry.fullName, active: true }, { onConflict: "profile_id" });
    if (teacherError) throw teacherError;
  }
  console.log(`Provisionado: ${entry.username}`);
}
