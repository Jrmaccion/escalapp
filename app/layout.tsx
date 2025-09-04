import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Escalapp - Gestión de Torneos Escalera de Pádel",
  description: "Aplicación web para gestionar torneos de pádel con sistema de escalera automático",
  keywords: "pádel, torneo, escalera, gestión, deportes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main>{children}</main>
            {/* Mover Toaster al final para evitar problemas de hidratación */}
            <Toaster position="top-center" />
          </div>
        </Providers>
      </body>
    </html>
  );
}