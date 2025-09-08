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
  keywords: ["pádel", "torneo", "escalera", "gestión", "deportes", "PadelRise"],
  applicationName: "PadelRise",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e74c3c" },
    { media: "(prefers-color-scheme: dark)", color: "#c0392b" },
  ],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "PadelRise — Torneo Escalera de Pádel",
    description:
      "Gestiona tu liga tipo Escalera de Pádel: grupos, rondas, comodines y rankings.",
    siteName: "PadelRise",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <div className="min-h-screen bg-background">
            <Navigation />
            <main>{children}</main>
            <Toaster position="top-center" />
          </div>
        </Providers>
      </body>
    </html>
  );
}
