// app/guia-rapida/page.tsx
import type { Metadata } from "next";
import GuiaVisualEscalapp from './GuiaVisualEscalapp';

export const metadata: Metadata = {
  title: "Guía Visual | Escalapp",
  description:
    "Aprende las reglas del torneo de forma visual e interactiva: sets, validaciones, puntuación, racha, comodín, movimientos y clasificaciones.",
  robots: { index: true, follow: true },
};

export default function QuickGuidePage() {
  return <GuiaVisualEscalapp />;
}