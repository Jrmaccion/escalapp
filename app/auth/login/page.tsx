// app/auth/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Si ya hay sesión, redirige
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const isAdmin = (session.user as any)?.isAdmin;
      router.replace(isAdmin ? "/admin/dashboard" : "/dashboard");
    }
  }, [status, session, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      });
      if (res?.error) {
        setErrorMsg("Credenciales no válidas.");
      } else {
        // Redirige: el useEffect hará el replace al tener sesión
      }
    } catch {
      setErrorMsg("Error al iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
          <p className="text-gray-600">
            Accede con tu correo y contraseña
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo
              </label>
              <Input
                type="email"
                placeholder="tucorreo@dominio.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Accediendo…" : "Entrar"}
            </Button>
          </form>

          {/* Enlaces de navegación */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta?{" "}
              <a
                href="/auth/register"
                className="text-blue-600 hover:text-blue-500 font-medium underline"
              >
                Regístrate aquí
              </a>
            </p>
            <p className="text-xs text-gray-500">
              También puedes registrarte desde la{" "}
              <a
                href="/"
                className="text-blue-600 hover:text-blue-500 underline"
              >
                página de inicio
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
