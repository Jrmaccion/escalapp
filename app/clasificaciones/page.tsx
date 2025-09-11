import Breadcrumbs from "@/components/Breadcrumbs";
import ClasificacionesClient from "./ClasificacionesClient";

export const metadata = {
  title: "Clasificaciones | PadelRise",
  description: "Ranking oficial por promedio e Ironman por puntos totales",
};

export default function ClasificacionesPage() {
  const items = [
    { label: "Inicio", href: "/dashboard" },
    { label: "Clasificaciones", current: true },
  ];

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto space-y-6">
      <Breadcrumbs items={items} />
      <ClasificacionesClient />
    </div>
  );
}
