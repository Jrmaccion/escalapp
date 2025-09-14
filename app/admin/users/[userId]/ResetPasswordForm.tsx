"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type Props = { 
  userId: string; 
  userEmail?: string | null 
};

export default function ResetPasswordForm({ userId, userEmail }: Props) {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validación en tiempo real
  const isValidPassword = (pwd: string) => {
    return pwd.length >= 8 && /[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd);
  };

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = isValidPassword(formData.password) && passwordsMatch && formData.password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    // Validación final
    if (!isFormValid) {
      setError("La contraseña no cumple los requisitos o no coinciden");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/users/${userId}/password`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          newPassword: formData.password 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Error al actualizar contraseña");
      }

      // Éxito
      setMessage("Contraseña actualizada correctamente");
      setFormData({ password: "", confirmPassword: "" });

    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="text-sm text-gray-600 mb-4">
        Cambiar contraseña de{" "}
        <span className="font-medium text-gray-900">
          {userEmail || userId}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            placeholder="Mínimo 8 caracteres, letras y números"
            autoComplete="new-password"
            required
            className="w-full"
          />
          {formData.password && (
            <div className="text-xs">
              {isValidPassword(formData.password) ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Contraseña válida
                </span>
              ) : (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Mínimo 8 caracteres, incluir letras y números
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Repite la contraseña"
            autoComplete="new-password"
            required
            className="w-full"
          />
          {formData.confirmPassword && (
            <div className="text-xs">
              {passwordsMatch ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Las contraseñas coinciden
                </span>
              ) : (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Las contraseñas no coinciden
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-1">
            Requisitos de contraseña:
          </h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Mínimo 8 caracteres</li>
            <li>• Al menos una letra (a-z, A-Z)</li>
            <li>• Al menos un número (0-9)</li>
            <li>• Las contraseñas deben coincidir</li>
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            type="submit" 
            disabled={!isFormValid || loading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </Button>
          
          {!isFormValid && formData.password && (
            <span className="text-xs text-gray-500">
              Completa todos los requisitos
            </span>
          )}
        </div>

        {/* Mensajes de estado */}
        {message && (
          <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 p-3 rounded-md">
            <CheckCircle2 className="w-4 h-4" />
            {message}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </form>
    </div>
  );
}