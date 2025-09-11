import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Navigation from "@/components/Navigation";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PadelRise — Torneo Escalera de Pádel",
  description:
    "PadelRise: gestiona tu Torneo Escalera de Pádel con rondas, grupos, resultados y clasificaciones.",
  keywords: ["pádel", "torneo", "escalera", "gestión", "deportes", "PadelRis"],
  applicationName: "PadelRis",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff5722" },
    { media: "(prefers-color-scheme: dark)", color: "#f4511e" },
  ],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "PadelRis— Torneo Escalera de Pádel",
    description:
      "Gestiona tu liga tipo Escalera de Pádel: grupos, rondas, comodines y rankings.",
    siteName: "PadelRis",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {/* Skip link para accesibilidad */}
        <a href="#main" className="skip-link">Saltar al contenido</a>
        <Providers>
          <div className="min-h-screen bg-background">
            <Navigation />
            <main id="main" role="main">
              {children}
            </main>
            <Toaster position="top-center" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
