"use client";
import { useSearchParams } from "next/navigation";

const map: Record<string,string> = {
  Configuration: "Error de configuración de autenticación.",
  AccessDenied: "Acceso denegado.",
  CredentialsSignin: "Email o contraseña incorrectos.",
  Default: "Ha ocurrido un error al iniciar sesión."
};

export default function AuthErrorPage() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const msg = map[error] ?? map.Default;

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full p-6 border rounded-xl">
        <h1 className="text-xl font-bold mb-2">Error de autenticación</h1>
        <p className="text-sm text-red-600 mb-6">{msg}</p>
        <a className="underline" href="/auth/login">Volver al login</a>
      </div>
    </main>
  );
}
