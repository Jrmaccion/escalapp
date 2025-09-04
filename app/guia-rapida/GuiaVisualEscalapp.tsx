"use client";

import React, { useState } from 'react';
import { ChevronRight, Users, Trophy, Calendar, Star, ArrowUp, ArrowDown, Minus, Check, Clock, Shield } from 'lucide-react';

const GuiaVisualEscalapp = () => {
  const [activeSection, setActiveSection] = useState('concepto');

  const sections = [
    { id: 'concepto', label: 'Qué es y cómo se juega', icon: Users },
    { id: 'sets', label: 'Sets y validaciones', icon: Check },
    { id: 'puntos', label: 'Puntuación exacta', icon: Trophy },
    { id: 'racha', label: 'Racha (cómo suma)', icon: Star },
    { id: 'comodin', label: 'Comodín: media y suplente', icon: Shield },
    { id: 'movimientos', label: 'Movimientos de escalera', icon: ArrowUp },
    { id: 'rankings', label: 'Clasificaciones', icon: Trophy },
  ];

  const SetRotation = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { set: 1, teams: ['#1 + #4', '#2 + #3'] },
        { set: 2, teams: ['#1 + #3', '#2 + #4'] },
        { set: 3, teams: ['#1 + #2', '#3 + #4'] }
      ].map((match) => (
        <div key={match.set} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
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
  );

  const ScoreExample = () => (
    <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
      <h4 className="font-semibold mb-4 text-center">Ejemplo de Puntuación</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
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
        <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
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

  const StreakVisualization = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h5 className="font-medium text-red-800 mb-2">❌ Sin Racha</h5>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <span className="text-sm">Ronda 1: No jugada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm">Ronda 2: Jugada</span>
          </div>
          <div className="text-xs text-red-600 mt-2">Puntos base solamente</div>
        </div>
      </div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h5 className="font-medium text-green-800 mb-2">✅ Con Racha (2 rondas)</h5>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm">Ronda 1: Jugada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm">Ronda 2: Jugada</span>
          </div>
          <div className="text-xs text-green-600 mt-2">+2 puntos por set jugado</div>
        </div>
      </div>
    </div>
  );

  const LadderMovements = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {[
        { pos: '1º', move: '↑↑', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', desc: 'Sube 2 grupos' },
        { pos: '2º', move: '↑', color: 'bg-green-50 border-green-200 text-green-800', desc: 'Sube 1 grupo' },
        { pos: '3º', move: '↓', color: 'bg-orange-50 border-orange-200 text-orange-800', desc: 'Baja 1 grupo' },
        { pos: '4º', move: '↓↓', color: 'bg-red-50 border-red-200 text-red-800', desc: 'Baja 2 grupos' }
      ].map((movement) => (
        <div key={movement.pos} className={`border-2 rounded-lg p-4 ${movement.color}`}>
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">{movement.pos}</div>
            <div className="text-3xl font-bold mb-2">{movement.move}</div>
            <div className="text-sm">{movement.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );

  const ComodinOptions = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <Trophy className="w-4 h-4 text-blue-600" />
          </div>
          <h4 className="font-semibold text-blue-800">Opción: Media</h4>
        </div>
        <ul className="space-y-2 text-sm text-blue-700">
          <li>• Ronda ≤ 2: Media del grupo (otros 3 jugadores)</li>
          <li>• Ronda ≥ 3: Tu media histórica personal</li>
          <li>• No cuenta como "ronda jugada"</li>
        </ul>
      </div>
      
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <h4 className="font-semibold text-purple-800">Opción: Suplente</h4>
        </div>
        <ul className="space-y-2 text-sm text-purple-700">
          <li>• Eliges jugador elegible de la misma ronda</li>
          <li>• Sus puntos se te asignan a ti</li>
          <li>• Debe estar en grupos inferiores (salvo último grupo)</li>
        </ul>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'concepto':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-blue-900 mb-4">Torneo por Grupos de 4 Jugadores</h3>
              <p className="text-blue-700 mb-4">
                Cada ronda genera 3 sets con rotación fija entre todos los jugadores del grupo.
              </p>
              <SetRotation />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold">4 Jugadores</h4>
                <p className="text-sm text-gray-600">Por grupo exacto</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-green-600">3</span>
                </div>
                <h4 className="font-semibold">3 Sets</h4>
                <p className="text-sm text-gray-600">Rotación completa</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <ArrowUp className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold">Escalera</h4>
                <p className="text-sm text-gray-600">Movimientos entre grupos</p>
              </div>
            </div>
          </div>
        );

      case 'sets':
        return (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-green-900 mb-4">Reglas de los Sets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span>Se juega a <strong>4 juegos</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span>Diferencia de <strong>2 juegos</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span>4-4 → <strong>Tie-break obligatorio</strong></span>
                  </div>
                </div>
                <div className="bg-white border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Validación Doble</h4>
                  <div className="text-sm space-y-1">
                    <div>1. Un jugador reporta</div>
                    <div>2. Otro confirma</div>
                    <div>3. Admin puede forzar cambios</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Tie-break (4-4)</h4>
              <p className="text-sm text-yellow-700">
                Se guarda el marcador real del tie-break (ej: 7-5) pero para cómputo de puntos se trata como 5-4 para el ganador.
              </p>
            </div>
          </div>
        );

      case 'puntos':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-green-900 mb-4">Sistema de Puntuación</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-white border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">Regla Base</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold">+1</span>
                        Por cada juego ganado
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center text-xs font-bold">+1</span>
                        Bonus por ganar el set
                      </li>
                    </ul>
                  </div>
                </div>
                <ScoreExample />
              </div>
            </div>
          </div>
        );

      case 'racha':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-orange-900 mb-4">Sistema de Racha</h3>
              <div className="bg-white border border-orange-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-orange-800 mb-2">¿Cómo Funciona?</h4>
                <p className="text-sm text-orange-700">
                  La racha cuenta <strong>rondas consecutivas jugadas</strong> (sin comodín). 
                  Desde la segunda ronda consecutiva, añade <strong>+2 puntos por set jugado</strong>.
                </p>
              </div>
              <StreakVisualization />
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-2">💡 Ejemplo Práctico</h4>
                <p className="text-sm text-yellow-700">
                  Si tienes racha de 2 rondas y juegas los 3 sets → +6 puntos extra (2×3 sets)
                </p>
              </div>
            </div>
          </div>
        );

      case 'comodin':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-purple-900 mb-4">Sistema de Comodín</h3>
              <ComodinOptions />
              
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">🚫 Restricciones</h4>
                <ul className="space-y-1 text-sm text-red-700">
                  <li>• No tener resultados confirmados en la ronda</li>
                  <li>• No tener fecha aceptada en próximas 24h</li>
                  <li>• La ronda no puede estar cerrada</li>
                  <li>• No haber superado tu límite de comodines del torneo</li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'movimientos':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-indigo-900 mb-4">Movimientos de Escalera</h3>
              <p className="text-indigo-700 mb-6">
                Al finalizar cada ronda, los jugadores se mueven entre grupos según su posición:
              </p>
              <LadderMovements />
              
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-2">⚖️ Orden en Nuevo Grupo</h4>
                  <p className="text-sm text-indigo-700">
                    Se decide por <strong>puntos de la ronda que cierra</strong> (descendente)
                  </p>
                </div>
                <div className="bg-white border border-indigo-200 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-2">🔒 Saturación</h4>
                  <p className="text-sm text-indigo-700">
                    Los extremos se saturan: no hay wrap-around entre primer/último grupo
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'rankings':
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6">
              <h3 className="text-xl font-bold text-amber-900 mb-4">Sistema de Clasificaciones</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-amber-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-6 h-6 text-yellow-600" />
                    <h4 className="font-semibold text-amber-800">Ranking Oficial</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-amber-700">
                    <li>• Media de puntos por ronda jugada</li>
                    <li>• Elegible a Campeón si juega ≥50% de rondas</li>
                    <li>• Refleja consistencia y calidad</li>
                    <li>• Determina el ganador del torneo</li>
                  </ul>
                </div>
                
                <div className="bg-white border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-6 h-6 text-orange-600" />
                    <h4 className="font-semibold text-orange-800">Ranking Ironman</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-orange-700">
                    <li>• Puntos totales acumulados</li>
                    <li>• Premia la participación constante</li>
                    <li>• Reconoce esfuerzo y dedicación</li>
                    <li>• Premio especial para el líder</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">📊 Cálculo Actual</h4>
                <p className="text-sm text-blue-700">
                  Se basa en <strong>sets confirmados</strong>: suma juegos + bonus por set ganado. 
                  El bonus de racha y créditos de suplente se aplican en puntos de grupo.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path>
                </svg>
                <span className="text-xl font-bold text-gray-900">Escalapp</span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm text-gray-600">Guía Visual Interactiva</div>
                <div className="text-xs text-gray-500">Aprende jugando</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Guía Visual de Escalapp</h1>
          <p className="text-gray-600">Aprende las reglas del torneo de forma visual e interactiva</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow sticky top-8">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Contenidos</h2>
              </div>
              <nav className="p-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{section.label}</span>
                      {activeSection === section.id && (
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                {renderContent()}
              </div>
            </div>

            {/* FAQ Section */}
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Preguntas Frecuentes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">¿Puedo editar un resultado?</h4>
                      <p className="text-sm text-gray-600">
                        Sí, a través del flujo de reportar/confirmar. El admin puede forzar cambios si es necesario.
                      </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">¿Qué pasa si uso comodín?</h4>
                      <p className="text-sm text-gray-600">
                        La ronda no cuenta para racha. Con "media" se fija tu media, con "suplente" se asignan los puntos del suplente.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">¿Cómo se decide mi nuevo grupo?</h4>
                      <p className="text-sm text-gray-600">
                        Por la regla de movimientos (↑↑/↑/↓/↓↓) y orden en destino por puntos de la ronda.
                      </p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">¿Cuántos grupos estrictamente?</h4>
                      <p className="text-sm text-gray-600">
                        Siempre grupos de 4. Si no es múltiplo de 4, los sobrantes quedan fuera de esa ronda.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuiaVisualEscalapp;