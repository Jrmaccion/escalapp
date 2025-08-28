"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const errorMap: Record<string, string> = {
  Configuration: "Error de configuración de autenticación.",
  AccessDenied: "Acceso denegado.",
  CredentialsSignin: "Email o contraseña incorrectos.",
  Default: "Ha ocurrido un error al iniciar sesión.",
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Introduce tu email y contraseña.");
      return;
    }
    if (asAdmin && !adminKey) {
      setError("Introduce la clave de administrador.");
      return;
    }

    setSubmitting(true);

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      adminKey: asAdmin ? adminKey : "",
    });

    setSubmitting(false);

    if (res?.error) {
      const friendly = errorMap[res.error] ?? errorMap.Default;
      setError(friendly);
      return;
    }

    // Redirección según modo de acceso
    router.replace(asAdmin ? "/admin" : "/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-1 text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1 text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Entrar como admin</p>
              <p className="text-xs text-gray-500">
                Necesitas la clave configurada en <code>ADMIN_KEY</code>
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={asAdmin}
                onChange={(e) => setAsAdmin(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm text-gray-700">Admin</span>
            </label>
          </div>

          {asAdmin && (
            <div>
              <label htmlFor="adminKey" className="block mb-1 text-sm font-medium">
                Clave de administrador
              </label>
              <input
                id="adminKey"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Consejo: en local (con seed) prueba <b>admin@escalapp.com</b> / <b>password123</b> +
          la <em>ADMIN_KEY</em>.
        </p>
      </div>
    </div>
  );
}
