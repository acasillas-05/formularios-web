/**
 * Concatena clases Tailwind filtrando falsy. Reemplaza clsx para el uso basico.
 * No hay merge de duplicados: si necesitas eso, la alternativa es tailwind-merge.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}
