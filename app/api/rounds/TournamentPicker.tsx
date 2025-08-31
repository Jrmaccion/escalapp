"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PickerTournament = {
  id: string;
  title: string;
  isActive: boolean;
  startDate: string; // ISO
  endDate: string;   // ISO
  roundsCount?: number;
};

export default function TournamentPicker({
  tournaments,
  selectedId,
  className,
}: {
  tournaments: PickerTournament[];
  selectedId: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const onChange = (value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value) params.set("tournament", value);
    else params.delete("tournament");
    router.push(`${pathname}?${params.toString()}`);
  };

  if (!tournaments.length) return null;

  return (
    <div className={className}>
      <label htmlFor="tournament-picker" className="mb-1 block text-sm font-medium text-gray-700">
        Torneo
      </label>
      <select
        id="tournament-picker"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-96 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
            {t.isActive ? " · Activo" : ""}
            {typeof t.roundsCount === "number" ? ` · ${t.roundsCount} rondas` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
