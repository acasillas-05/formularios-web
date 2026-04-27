/**
 * Devuelve "hace N seg/min/h/d" en espanol. Para tiempos > 30 dias,
 * cae a fecha absoluta dd/mm/yyyy.
 */
export function relativeTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);

  if (diffSec < 5) return 'justo ahora';
  if (diffSec < 60) return `hace ${diffSec} s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `hace ${diffD} d`;
  return date.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function absoluteDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
}
