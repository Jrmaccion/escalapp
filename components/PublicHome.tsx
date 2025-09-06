// components/PublicHome.tsx - Página educativa sobre el sistema de escalera
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
  ArrowDown,
  Minus,
  Star,
  Target,
  RotateCcw,
  Award
} from "lucide-react";

export default function PublicHome() {
  const [activeDemo, setActiveDemo] = useState('rotation');

  // Componente para mostrar la rotación de sets
  const SetRotationDemo = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h4 className="font-semibold mb-4 text-center">Rotación Automática de Sets</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { set: 1, teams: ['#1 + #4', '#2 + #3'] },
          { set: 2, teams: ['#1 + #3', '#2 + #4'] },
          { set: 3, teams: ['#1 + #2', '#3 + #4'] }
        ].map((match) => (
          <div key={match.set} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-center mb-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
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

  // Componente para mostrar el sistema de puntuación
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
            • Carlos: 5 + 1 (bonus) = 6 puntos<br/>
            • Ana: 5 + 1 (bonus) = 6 puntos<br/>
            • Miguel: 3 puntos<br/>
            • Laura: 3 puntos
          </div>
        </div>
      </div>
    </div>
  );

  // Componente para mostrar movimientos de escalera
  const LadderMovementsDemo = () => (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <h4 className="font-semibold mb-4 text-center">Movimientos de Escalera</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { pos: '1º', move: '↑↑', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', desc: 'Sube 2 grupos' },
          { pos: '2º', move: '↑', color: 'bg-green-50 border-green-200 text-green-800', desc: 'Sube 1 grupo' },
          { pos: '3º', move: '↓', color: 'bg-orange-50 border-orange-200 text-orange-800', desc: 'Baja 1 grupo' },
          { pos: '4º', move: '↓↓', color: 'bg-red-50 border-red-200 text-red-800', desc: 'Baja 2 grupos' }
        ].map((movement) => (
          <div key={movement.pos} className={`border rounded-lg p-3 ${movement.color}`}>
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600 rounded-full">
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-blue-600 mb-6">
            Escalapp
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto">
            Sistema de torneos de pádel con escalera automática.<br/>
            4 jugadores por grupo, 3 sets por ronda, movimientos automáticos.
          </p>

          {/* Mecánica Básica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-white shadow-md rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4 Jugadores</h3>
              <p className="text-gray-600 text-sm">
                Grupos exactos de 4 personas. Rotación completa en cada ronda.
              </p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3 Sets</h3>
              <p className="text-gray-600 text-sm">
                Cada jugador juega con todos y contra todos automáticamente.
              </p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ArrowUp className="w-6 h-6 text-orange-600" />
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
              <div className="bg-white rounded-lg p-1 shadow-md">
                <button
                  onClick={() => setActiveDemo('rotation')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeDemo === 'rotation' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Rotación
                </button>
                <button
                  onClick={() => setActiveDemo('scoring')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeDemo === 'scoring' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Puntuación
                </button>
                <button
                  onClick={() => setActiveDemo('ladder')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeDemo === 'ladder' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Escalera
                </button>
              </div>
            </div>

            {/* Demo content */}
            <div className="min-h-[300px]">
              {activeDemo === 'rotation' && <SetRotationDemo />}
              {activeDemo === 'scoring' && <ScoringDemo />}
              {activeDemo === 'ladder' && <LadderMovementsDemo />}
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Crear Cuenta
            </Link>
            <Link 
              href="/auth/login" 
              className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 rounded-lg"
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
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Gestión Automática</h3>
              <p className="text-gray-600">
                Emparejamientos, rotaciones y movimientos de escalera completamente automatizados.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Doble Ranking</h3>
              <p className="text-gray-600">
                Ranking oficial por calidad y ranking Ironman por participación constante.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-6 h-6 text-orange-600" />
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
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <RotateCcw className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Validación Doble</h3>
              <p className="text-gray-600">
                Un jugador reporta el resultado y otro lo confirma para mayor transparencia.
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-pink-600" />
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
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ejemplo de Clasificación
            </h2>
            <p className="text-lg text-gray-600">
              Ranking oficial por promedio de puntos por ronda
            </p>
          </div>

          <div className="bg-white shadow-lg rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
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
                  { name: "Ana García", points: "7.20", rounds: "5", position: 5, medal: "#5" }
                ].map((player) => (
                  <div key={player.position} className={`flex items-center justify-between p-4 rounded-lg border ${
                    player.position <= 3 
                      ? 'bg-gradient-to-r from-gray-50 to-white border-gray-200 shadow-sm' 
                      : 'bg-white border-gray-100'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700">
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
                  className="inline-flex items-center text-blue-600 hover:text-blue-700"
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
      <section className="py-16 px-4 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            ¿Listo para participar?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Crea tu cuenta y únete al sistema de escalera automático.
          </p>
          <div className="flex justify-center">
            <Link 
              href="/auth/register" 
              className="inline-flex items-center px-8 py-3 text-lg font-medium text-blue-600 bg-white hover:bg-gray-100 rounded-lg"
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