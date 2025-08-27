import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Users, TrendingUp, Calendar, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="escalapp-gradient text-white">
        <div className="container mx-auto px-4 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Trophy className="w-12 h-12" />
              <h1 className="text-5xl font-bold">Escalapp</h1>
            </div>
            <p className="text-xl mb-8 opacity-90">
              La plataforma más completa para gestionar torneos escalera de pádel
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" asChild className="bg-white text-blue-600 hover:bg-gray-100">
                <Link href="/auth/login">
                  Iniciar Sesión
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                Ver Demo
              </Button>
            </div>
            
            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                <Users className="w-8 h-8 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Gestión Automática</h3>
                <p className="text-sm opacity-80">
                  Sistema completo de escalera con movimientos automáticos
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Rankings Duales</h3>
                <p className="text-sm opacity-80">
                  Clasificación oficial e ironman para premiar consistencia
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Mobile First</h3>
                <p className="text-sm opacity-80">
                  Optimizado para dispositivos móviles y fácil de usar
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Todo lo que necesitas para tu torneo</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Escalapp automatiza completamente la gestión de tu torneo escalera, 
              desde la inscripción hasta las clasificaciones finales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Trophy className="w-8 h-8 text-blue-600 mb-2" />
                <CardTitle>Sistema de Escalera</CardTitle>
                <CardDescription>
                  Movimientos automáticos: 1° sube, 4° baja, 2° y 3° se mantienen
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-green-600 mb-2" />
                <CardTitle>Grupos Dinámicos</CardTitle>
                <CardDescription>
                  Reorganización automática con drag & drop para administradores
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                <CardTitle>Puntuación Avanzada</CardTitle>
                <CardDescription>
                  Sistema complejo: +1 por juego, +1 por set, +2 por racha
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Calendar className="w-8 h-8 text-orange-600 mb-2" />
                <CardTitle>Recordatorios</CardTitle>
                <CardDescription>
                  Notificaciones automáticas 72h y 24h antes del cierre
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center mb-2">
                  📊
                </div>
                <CardTitle>Analytics</CardTitle>
                <CardDescription>
                  Estadísticas detalladas e historial completo de cada jugador
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center mb-2">
                  ✅
                </div>
                <CardTitle>Validación Doble</CardTitle>
                <CardDescription>
                  Sistema de confirmación cruzada entre jugadores
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">¿Listo para automatizar tu torneo?</h2>
          <p className="text-xl mb-8 opacity-90">
            Únete a los organizadores que ya confían en Escalapp
          </p>
          <Button size="lg" asChild className="bg-white text-blue-600 hover:bg-gray-100">
            <Link href="/auth/login">
              Comenzar Ahora
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="w-6 h-6" />
            <span className="text-lg font-bold">Escalapp</span>
          </div>
          <p className="text-gray-400 mb-4">
            Sistema de gestión de torneos escalera de pádel
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <Link href="/auth/login" className="hover:text-white">Acceso</Link>
            <span>•</span>
            <span>© 2025 Escalapp</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
