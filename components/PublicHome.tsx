// components/PublicHome.tsx
"use client";

import Link from "next/link";
import { 
  Trophy, 
  Users, 
  LogIn,
  UserPlus,
  ArrowRight,
  Zap,
  Target
} from "lucide-react";

export default function PublicHome() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600 rounded-full">
              <Trophy className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              Escalapp
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto">
            La plataforma líder para torneos de pádel con sistema de escalera automático.
            Compite, mejora y asciende en los rankings oficiales.
          </p>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-12">
            <div className="bg-white/80 backdrop-blur border-0 shadow-md rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">2</div>
              <div className="text-sm text-gray-600">Torneos Activos</div>
            </div>
            <div className="bg-white/80 backdrop-blur border-0 shadow-md rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">28</div>
              <div className="text-sm text-gray-600">Jugadores</div>
            </div>
            <div className="bg-white/80 backdrop-blur border-0 shadow-md rounded-lg p-4 text-center col-span-2 md:col-span-1">
              <div className="text-2xl font-bold text-orange-600">∞</div>
              <div className="text-sm text-gray-600">Diversión</div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/auth/register" className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              <UserPlus className="w-5 h-5 mr-2" />
              Únete Ahora
            </Link>
            <Link href="/auth/login" className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-blue-600 bg-white border border-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <LogIn className="w-5 h-5 mr-2" />
              Iniciar Sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            ¿Por qué elegir Escalapp?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white border-0 shadow-md hover:shadow-lg transition-shadow rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Sistema Automático</h3>
              <p className="text-gray-600">
                Gestión automatizada de grupos, emparejamientos y movimientos de escalera. 
                Sin complicaciones manuales.
              </p>
            </div>

            <div className="bg-white border-0 shadow-md hover:shadow-lg transition-shadow rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Rankings Duales</h3>
              <p className="text-gray-600">
                Ranking oficial por calidad de juego y ranking Ironman por participación. 
                Doble motivación para competir.
              </p>
            </div>

            <div className="bg-white border-0 shadow-md hover:shadow-lg transition-shadow rounded-lg p-6 text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Comunidad Activa</h3>
              <p className="text-gray-600">
                Conecta con jugadores de tu nivel, programa partidos y forma parte 
                de una comunidad apasionada por el pádel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rankings Preview Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Clasificaciones en Vivo
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Torneo Escalera Primavera 2025
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-lg">
              12 jugadores compitiendo
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur border-0 shadow-lg rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-center text-xl font-semibold flex items-center justify-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  Top 5 - Ranking Oficial
                </h3>
                <p className="text-center text-gray-600">Por promedio de puntos por ronda</p>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border-2 bg-gradient-to-r from-gray-50 to-white border-gray-200 shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold bg-yellow-100 text-yellow-800 border-yellow-200">
                        🥇
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">David Sánchez</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>9.20 pts/ronda</span>
                          <span>5 rondas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border-2 bg-gradient-to-r from-gray-50 to-white border-gray-200 shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold bg-gray-100 text-gray-700 border-gray-200">
                        🥈
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">Carlos Martínez</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>8.50 pts/ronda</span>
                          <span>5 rondas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border-2 bg-gradient-to-r from-gray-50 to-white border-gray-200 shadow-md">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold bg-orange-100 text-orange-800 border-orange-200">
                        🥉
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">Elena Fernández</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>8.10 pts/ronda</span>
                          <span>5 rondas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-white border-gray-100 border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold bg-blue-100 text-blue-700 border-blue-200">
                        #4
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">Javier Torres</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>7.80 pts/ronda</span>
                          <span>5 rondas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-white border-gray-100 border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold bg-blue-100 text-blue-700 border-blue-200">
                        #5
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">Ana García</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>7.20 pts/ronda</span>
                          <span>5 rondas</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-green-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            ¿Listo para subir en la escalera?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Únete a miles de jugadores que ya están compitiendo en Escalapp.
            Tu próximo partido te espera.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register" className="inline-flex items-center justify-center px-8 py-3 text-lg font-medium text-blue-600 bg-white hover:bg-gray-100 rounded-lg transition-colors">
              <UserPlus className="w-5 h-5 mr-2" />
              Crear Cuenta Gratis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}