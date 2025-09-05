// lib/decorators.ts
// Helpers para crear decoradores tipados de método sin pelearse con TS.

export function methodDecorator(
  wrap: (original: Function, key: string | symbol) => Function
): MethodDecorator {
  return (_target: unknown, key: string | symbol, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    if (typeof original !== "function") return descriptor;
    descriptor.value = wrap(original, key);
    return descriptor;
  };
}

/**
 * Ejemplo de decorador de medición de tiempos (adáptalo a tu caso):
 */
export function withPerf(label?: string): MethodDecorator {
  return methodDecorator((original, key) => {
    const name = label ?? String(key);
    return async function (this: unknown, ...args: unknown[]) {
      const start = performance.now?.() ?? Date.now();
      try {
        // @ts-ignore - mantenemos el tipo dinámico de la función original
        return await original.apply(this, args);
      } finally {
        const end = performance.now?.() ?? Date.now();
        // eslint-disable-next-line no-console
        console.debug(`[perf] ${name}: ${(end - start).toFixed(1)}ms`);
      }
    };
  });
}
