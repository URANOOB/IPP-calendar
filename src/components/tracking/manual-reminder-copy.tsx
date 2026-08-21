"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function ManualReminderCopy({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); } }
  return <Button onClick={copy} type="button" variant="outline">{copied ? "Recordatorio copiado" : "Copiar recordatorio"}</Button>;
}
