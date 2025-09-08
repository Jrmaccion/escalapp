// components/PublicHome.tsx - Landing pública PadelRise (branding aplicado + enlace a Guía)
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Trophy,
  Users,
  LogIn,
  UserPlus,
  ArrowRight,
  ArrowUp,
  BookOpen,
} from "lucide-react";

export default function PublicHome() {
  const [activeDemo, setActiveDemo] =
    useState<"rotation" | "scoring" | "ladder">("rotation");

  // Componente: Rotación de sets
  const SetRotationDemo = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h4 className="font-semibold mb-4 text-center">Rotación Automática de Sets</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { set: 1, teams: ["#1 + #4", "#2 + #3"] },
          { set: 2, teams: ["#1 + #3", "#2 + #4"] },
          { set: 3, teams: ["#1 + #2", "#3 + #4"] },
        ].map((match) => (
          <div
            key={match.set}
            className="bg-primary/5 border border-primary/20 rounded-lg p-4"
          >
            <div className="text-center mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Set {match.set}
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-center">{match.teams[0]}</div>
              <div className="text-center text-xs text-gray-500">VS</div>
              <div className="text-sm font-medium text-center">{match.teams[1]}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600 text-center mt-4">
        Cada jugador juega con todos y contra todos en 3 sets
      </p>
    </div>
  );

  // Componente: Sistema de puntuación
  const ScoringDemo = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h4 className="font-semibold mb-4 text-center">Sistema de Puntuación</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <span className="font-medium">Carlos + Ana</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">5</div>
            <div className="text-xs text-gray-500">juegos</div>
          </div>
        </div>
        <div className="text-center">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm">
            Ganadores del set
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
          <span className="font-medium">Miguel + Laura</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-red-600">3</div>
            <div className="text-xs text-gray-500">juegos</div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm font-medium text-yellow-800">Puntos obtenidos:</div>
          <div className="text-xs text-yellow-700 mt-1">
            • Carlos: 5 + 1 (bonus) = 6 puntos<br />
            • Ana: 5 + 1 (bonus) = 6 puntos<br />
            • Miguel: 3 puntos<br />
            • Laura: 3 puntos
          </div>
        </div>
      </div>
    </div>
  );

  // Componente: Movimientos de escalera
  const LadderMovementsDemo = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h4 className="font-semibold mb-4 text-center">Movimientos de Escalera</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            pos: "1º",
            move: "↑↑",
            color: "bg-yellow-50 border-yellow-200 text-yellow-800",
            desc: "Sube 2 grupos",
          },
          {
            pos: "2º",
            move: "↑",
            color: "bg-accent/10 border-accent/20 text-accent",
            desc: "Sube 1 grupo",
          },
          {
            pos: "3º",
            move: "↓",
            color: "bg-orange-50 border-orange-200 text-orange-800",
            desc: "Baja 1 grupo",
          },
          {
            pos: "4º",
            move: "↓↓",
            color: "bg-red-50 border-red-200 text-red-800",
            desc: "Baja 2 grupos",
          },
        ].map((movement) => (
          <div
            key={movement.pos}
            className={`border rounded-lg p-3 ${movement.color}`}
          >
            <div className="text-center">
              <div className="text-lg font-bold mb-1">{movement.pos}</div>
              <div className="text-2xl font-bold mb-1">{movement.move}</div>
              <div className="text-xs">{movement.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600 text-center mt-4">
        Al final de cada ronda, los jugadores se mueven según su posición
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary rounded-full">
              <Trophy className="w-12 h-12 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-primary mb-6">
            PadelRise
          </h1>

          <p className="text-xl md:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto">
            Sistema de torneos de pádel tipo Escalera, con rotación y movimientos
            automáticos. 4 jugadores por grupo, 3 sets por ronda.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Crear Cuenta
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Iniciar Sesión
            </Link>
          </div>

          {/* Enlace a Guía Rápida */}
          <div className="mb-12">
            <Link
              href="/guia-rapida"
              className="inline-flex items-center text-sm text-gray-700 hover:text-gray-900"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Ver Guía Rápida
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>

          {/* Mecánica Básica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-white shadow-card rounded-lg p-6 text-center border">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4 Jugadores</h3>
              <p className="text-gray-600 text-sm">
                Grupos de 4 personas. Rotación completa en cada ronda.
              </p>
            </div>
            <div className="bg-white shadow-card rounded-lg p-6 text-center border">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="font-bold text-green-700">3</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">3 Sets</h3>
              <p className="text-gray-600 text-sm">
                Cada jugador juega con todos y contra todos automáticamente.
              </p>
            </div>
            <div className="bg-white shadow-card rounded-lg p-6 text-center border">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Escalera</h3>
              <p className="text-gray-600 text-sm">
                Movimientos automáticos entre grupos según posición final.
              </p>
            </div>
          </div>

          {/* Demos Interactivos */}
          <div className="max-w-5xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">¿Cómo Funciona?</h2>

            {/* Selector de demos */}
            <div className="flex justify-center mb-8">
              <div className="bg-white rounded-lg p-1 shadow-card border">
                {[
                  { id: "rotation", label: "Rotación" },
                  { id: "scoring", label: "Puntuación" },
                  { id: "ladder", label: "Escalera" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveDemo(opt.id as any)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeDemo === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Demo content */}
            <div className="min-h-[300px]">
              {activeDemo === "rotation" && <SetRotationDemo />}
              {activeDemo === "scoring" && <ScoringDemo />}
              {activeDemo === "ladder" && <LadderMovementsDemo />}
            </div>
          </div>

          {/* CTA Buttons (repetición inferior opcional) */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Crear Cuenta
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-primary bg-white border border-primary hover:bg-primary/5 rounded-lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Características del Sistema */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Características del Sistema
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Gestión Automática</h3>
              <p className="text-gray-600">
                Emparejamientos, rotaciones y movimientos de escalera completamente automatizados.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="w-6 h-6 text-green-700 font-bold">◎</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Doble Ranking</h3>
              <p className="text-gray-600">
                Ranking oficial por calidad y ranking Ironman por participación constante.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="w-6 h-6 text-accent font-bold">★</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Sistema de Rachas</h3>
              <p className="text-gray-600">
                Puntos bonus por participación consecutiva que premian la constancia.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Sistema de Comodín</h3>
              <p className="text-gray-600">
                Opciones flexibles cuando no puedes jugar: media histórica o jugador suplente.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="w-6 h-6 text-emerald-700 font-bold">✓</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Validación Doble</h3>
              <p className="text-gray-600">
                Un jugador reporta el resultado y otro lo confirma para mayor transparencia.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="w-6 h-6 text-orange-600 font-bold">⚙</span>
              </div>
              <h3 className="text-xl font-semibold mb-3">Configuración Flexible</h3>
              <p className="text-gray-600">
                Ajusta duración de rondas, sistema de rachas y otros parámetros del torneo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Ejemplo de Ranking */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ejemplo de Clasificación
            </h2>
            <p className="text-lg text-gray-600">
              Ranking oficial por promedio de puntos por ronda
            </p>
          </div>

          <div className="bg-white rounded-lg border shadow-card">
            <div className="px-6 py-4 border-b">
              <h3 className="text-center text-xl font-semibold flex items-center justify-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Clasificación Actual
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { name: "David Sánchez", points: "9.20", rounds: "5", position: 1, medal: "🥇" },
                  { name: "Carlos Martínez", points: "8.50", rounds: "5", position: 2, medal: "🥈" },
                  { name: "Elena Fernández", points: "8.10", rounds: "5", position: 3, medal: "🥉" },
                  { name: "Javier Torres", points: "7.80", rounds: "5", position: 4, medal: "#4" },
                  { name: "Ana García", points: "7.20", rounds: "5", position: 5, medal: "#5" },
                ].map((player) => (
                  <div
                    key={player.position}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      player.position <= 3
                        ? "bg-gradient-to-r from-gray-50 to-white border-gray-200 shadow-sm"
                        : "bg-white border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                        {player.medal}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{player.name}</div>
                        <div className="text-sm text-gray-600">
                          {player.points} pts/ronda • {player.rounds} rondas
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/clasificaciones"
                  className="inline-flex items-center text-primary hover:text-primary/80"
                >
                  Ver clasificación completa
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 px-4 bg-gradient-padel">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            ¿Listo para participar?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Crea tu cuenta y únete a la escalera PadelRise.
          </p>
          <div className="flex justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center px-8 py-3 text-lg font-medium text-primary bg-white hover:bg-gray-100 rounded-lg"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Crear Cuenta
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
