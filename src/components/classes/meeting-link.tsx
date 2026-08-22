"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function MeetingLink({ url }: Readonly<{ url: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="break-all text-sm text-muted-foreground">{url}</span><Button onClick={() => void copy()} type="button" variant="outline">{copied ? "Copiado" : "Copiar enlace"}</Button></div>;
}
