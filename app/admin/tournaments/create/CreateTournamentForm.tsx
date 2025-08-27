"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Calendar, Trophy, Users, Clock, Globe, Lock, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateTournamentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    title: "",
    startDate: "",
    totalRounds: 6,
    roundDurationDays: 14,
    isPublic: true
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validaciones básicas
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "El título es requerido";
    }

    if (!formData.startDate) {
      newErrors.startDate = "La fecha de inicio es requerida";
    } else if (new Date(formData.startDate) <= new Date()) {
      newErrors.startDate = "La fecha de inicio debe ser futura";
    }

    if (formData.totalRounds < 3 || formData.totalRounds > 20) {
      newErrors.totalRounds = "Entre 3 y 20 rondas";
    }

    if (formData.roundDurationDays < 7 || formData.roundDurationDays > 30) {
      newErrors.roundDurationDays = "Entre 7 y 30 días";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/tournaments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const tournament = await response.json();
          router.push(`/admin/tournaments/${tournament.id}`);
        } else {
          const error = await response.json();
          setErrors({ general: error.error || "Error al crear el torneo" });
        }
      } catch (error) {
        setErrors({ general: "Error de conexión" });
      }
    });
  };

  const calculateEndDate = () => {
    if (!formData.startDate) return null;
    const startDate = new Date(formData.startDate);
    const totalDays = formData.totalRounds * formData.roundDurationDays;
    const endDate = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);
    return endDate.toLocaleDateString('es-ES');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/admin/tournaments" 
              className="inline-flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Torneos
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Crear Nuevo Torneo</h1>
              <p className="text-gray-600">Configura tu torneo escalera de pádel</p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            {/* Título */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                <Trophy className="inline w-4 h-4 mr-2" />
                Título del Torneo
              </label>
              <Input
                id="title"
                type="text"
                placeholder="ej. Torneo Escalera Primavera 2025"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={errors.title ? "border-red-300" : ""}
              />
              {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
            </div>

            {/* Fecha de inicio */}
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-2" />
                Fecha de Inicio
              </label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={errors.startDate ? "border-red-300" : ""}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.startDate && <p className="text-red-600 text-sm mt-1">{errors.startDate}</p>}
            </div>

            {/* Configuración de rondas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalRounds" className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="inline w-4 h-4 mr-2" />
                  Número de Rondas
                </label>
                <Input
                  id="totalRounds"
                  type="number"
                  min="3"
                  max="20"
                  value={formData.totalRounds}
                  onChange={(e) => setFormData({ ...formData, totalRounds: parseInt(e.target.value) })}
                  className={errors.totalRounds ? "border-red-300" : ""}
                />
                {errors.totalRounds && <p className="text-red-600 text-sm mt-1">{errors.totalRounds}</p>}
              </div>

              <div>
                <label htmlFor="roundDurationDays" className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="inline w-4 h-4 mr-2" />
                  Duración por Ronda (días)
                </label>
                <Input
                  id="roundDurationDays"
                  type="number"
                  min="7"
                  max="30"
                  value={formData.roundDurationDays}
                  onChange={(e) => setFormData({ ...formData, roundDurationDays: parseInt(e.target.value) })}
                  className={errors.roundDurationDays ? "border-red-300" : ""}
                />
                {errors.roundDurationDays && <p className="text-red-600 text-sm mt-1">{errors.roundDurationDays}</p>}
              </div>
            </div>

            {/* Visibilidad */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {formData.isPublic ? (
                  <Globe className="h-5 w-5 text-green-600" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-600" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {formData.isPublic ? "Torneo Público" : "Torneo Privado"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formData.isPublic 
                      ? "Visible para todos los usuarios registrados"
                      : "Solo visible para jugadores invitados"
                    }
                  </p>
                </div>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>

            {/* Resumen */}
            {formData.startDate && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Resumen del Torneo</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Duración:</strong> {formData.totalRounds} rondas × {formData.roundDurationDays} días = {formData.totalRounds * formData.roundDurationDays} días total</p>
                  <p><strong>Fecha de finalización estimada:</strong> {calculateEndDate()}</p>
                  <p><strong>Grupos por ronda:</strong> Depende del número de jugadores inscritos</p>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1"
              >
                {isPending ? "Creando..." : "Crear Torneo"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Información adicional */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-900 mb-2">Información Importante</h3>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>• El sistema inscribirá automáticamente jugadores disponibles si hay al menos 4</p>
            <p>• La primera ronda se creará con distribución aleatoria</p>
            <p>• Los matches se generarán automáticamente con rotación de parejas</p>
            <p>• Puedes añadir o quitar jugadores después de crear el torneo</p>
          </div>
        </div>
      </div>
    </div>
  );
}