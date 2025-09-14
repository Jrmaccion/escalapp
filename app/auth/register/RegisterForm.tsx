// app/auth/register/RegisterForm.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Eye, EyeOff, CheckCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Validaciones en tiempo real
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPassword = (pwd: string) => {
    return pwd.length >= 8 && /[A-Za-z]/.test(pwd) && /[0-9]/.test(pwd);
  };

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid = 
    formData.name.trim().length >= 2 &&
    isValidEmail(formData.email) &&
    isValidPassword(formData.password) &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validación final
    if (!isFormValid) {
      setError('Por favor, completa todos los campos correctamente');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(result.error || 'Error al registrarse');
      }
    } catch (err) {
      console.error('Register error:', err);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Registro Exitoso
            </h2>
            <p className="text-gray-600 mb-6">
              Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión con tus credenciales.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={() => router.push('/auth/login')} 
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Ir a Iniciar Sesión
              </Button>
              <Link 
                href="/" 
                className="block text-sm text-gray-500 hover:text-gray-700"
              >
                Volver al inicio
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Registro de Jugador
          </CardTitle>
          <p className="text-gray-600 mt-2">
            Únete a Escalapp y participa en los torneos
          </p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Tu nombre completo"
                required
                className="w-full"
              />
              {formData.name.length > 0 && (
                <div className="text-xs">
                  {formData.name.trim().length >= 2 ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Nombre válido
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Mínimo 2 caracteres
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
                className="w-full"
              />
              {formData.email.length > 0 && (
                <div className="text-xs">
                  {isValidEmail(formData.email) ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Email válido
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Formato de email inválido
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoComplete="new-password"
                  className="w-full pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.password.length > 0 && (
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
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Repite tu contraseña"
                required
                autoComplete="new-password"
                className="w-full"
              />
              {formData.confirmPassword.length > 0 && (
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
                Requisitos de registro:
              </h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Nombre: mínimo 2 caracteres</li>
                <li>• Email: formato válido</li>
                <li>• Contraseña: mínimo 8 caracteres</li>
                <li>• Incluir al menos una letra y un número</li>
                <li>• Confirmar contraseña correctamente</li>
              </ul>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit"
              disabled={!isFormValid || loading} 
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Registrando...
                </div>
              ) : (
                'Crear Cuenta'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <div className="text-sm text-gray-600">
              ¿Ya tienes cuenta?{' '}
              <Link 
                href="/auth/login" 
                className="text-orange-600 hover:text-orange-500 font-medium underline"
              >
                Inicia sesión aquí
              </Link>
            </div>
            
            <div className="text-xs text-gray-500">
              Al registrarte, aceptas participar en los torneos bajo las{' '}
              <Link 
                href="/guia-rapida" 
                className="text-orange-600 hover:text-orange-500 underline"
              >
                reglas de la escalera
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}