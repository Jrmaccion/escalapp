export default function DemoPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="max-w-2xl w-full p-6 rounded-xl border">
        <h1 className="text-2xl font-bold mb-2">Demo de Escalapp</h1>
        <p className="text-gray-600 mb-6">
          Esta es una demo estática. Inicia sesión para ver tu panel real con datos del seed.
        </p>
        <ul className="list-disc pl-5 text-sm space-y-2">
          <li>Prueba login jugador: <code>carlos@escalapp.com</code> / <code>password123</code></li>
          <li>Prueba login admin: <code>admin@escalapp.com</code> / <code>password123</code></li>
        </ul>
        <div className="mt-6 flex gap-3">
          <a className="px-4 py-2 rounded-lg bg-blue-600 text-white" href="/auth/login">Entrar</a>
          <a className="px-4 py-2 rounded-lg border" href="/">Volver</a>
        </div>
      </div>
    </main>
  );
}
