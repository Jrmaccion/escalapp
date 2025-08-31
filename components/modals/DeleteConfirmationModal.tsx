// components/modals/DeleteConfirmationModal.tsx
"use client";

import { AlertTriangle, Trash2, X } from "lucide-react";
import { useState } from "react";

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tournament: {
    title: string;
    totalRounds: number;
    playersCount: number;
    totalMatches: number;
    confirmedMatches: number;
  };
  isLoading: boolean;
};

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  tournament,
  isLoading
}: DeleteConfirmationModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const requiredText = `ELIMINAR ${tournament.title}`;

  if (!isOpen) return null;

  const isConfirmValid = confirmText === requiredText;
  const hasImportantData = tournament.confirmedMatches > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Eliminar Torneo
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-900 mb-2">
              ⚠️ Esta acción es irreversible
            </h4>
            <p className="text-sm text-red-700">
              Se eliminarán permanentemente todos los datos relacionados con este torneo:
            </p>
            <ul className="text-sm text-red-700 mt-2 space-y-1">
              <li>• {tournament.totalRounds} rondas creadas</li>
              <li>• {tournament.playersCount} inscripciones de jugadores</li>
              <li>• {tournament.totalMatches} partidos programados</li>
              {hasImportantData && (
                <li className="font-medium">• {tournament.confirmedMatches} resultados confirmados</li>
              )}
            </ul>
          </div>

          {hasImportantData && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-1">
                📊 Datos históricos importantes
              </h4>
              <p className="text-sm text-yellow-700">
                Este torneo contiene {tournament.confirmedMatches} partidos confirmados. 
                Eliminar destruirá el historial de juego de los participantes.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Para confirmar, escribe: <code className="bg-gray-100 px-1 rounded text-red-600">
                {requiredText}
              </code>
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Escribe para confirmar..."
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!isConfirmValid || isLoading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Eliminar Permanentemente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}