import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Inglés pa' la Paz",
    template: "%s | Inglés pa' la Paz",
  },
  description: "Gestión interna de Inglés pa' la Paz.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
