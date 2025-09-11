import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Error de autenticación | PadelRise",
  description: "Ha ocurrido un error durante el inicio de sesión",
};

type PageProps = {
  searchParams?: { error?: string | string[] };
};

function getFriendlyMessage(code?: string) {
  switch (code) {
    case "Signin":
    case "OAuthSignin":
    case "OAuthCallback":
      return "No se pudo completar el inicio de sesión con el proveedor seleccionado.";
    case "OAuthAccountNotLinked":
      return "Esta cuenta de proveedor no está vinculada a tu email. Inicia sesión con el método original.";
    case "CredentialsSignin":
      return "Credenciales inválidas. Revisa tu email y contraseña.";
    case "AccessDenied":
      return "Acceso denegado. No tienes permisos para acceder.";
    case "Verification":
      return "El enlace de verificación ha caducado o ya fue usado.";
    default:
      return "Se ha producido un error al autenticarte.";
  }
}

export default function AuthErrorPage({ searchParams }: PageProps) {
  const raw = searchParams?.error;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const message = getFriendlyMessage(code);

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow border border-gray-100 p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-xl">!</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">No se pudo iniciar sesión</h1>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
          >
            Volver a iniciar sesión
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
          >
            Ir al inicio
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-6">Código: {code ?? "desconocido"}</p>
      </div>
    </main>
  );
}
