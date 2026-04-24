import { prisma } from '../prisma.js';

/**
 * Transporter abstracto. La implementacion por defecto imprime al console;
 * en produccion se puede agregar un SMTP/Graph transporter cuando haya
 * credenciales configuradas.
 */
export type NotificationTransporter = {
  send(payload: {
    id: string;
    kind: string;
    submissionId: string | null;
    body: unknown;
  }): Promise<void>;
};

const consoleTransporter: NotificationTransporter = {
  async send({ id, kind, submissionId, body }) {
    const preview = JSON.stringify(body);
    console.log(
      `[notify] ${kind} id=${id.slice(0, 8)} submission=${submissionId?.slice(0, 8) ?? 'n/a'} ${preview}`,
    );
  },
};

let transporter: NotificationTransporter = consoleTransporter;
export function setNotificationTransporter(t: NotificationTransporter): void {
  transporter = t;
}

type WorkerHandle = {
  stop(): void;
};

/**
 * Drena la cola cada `intervalMs`. Si hay filas con sent_at NULL, las
 * procesa en orden FIFO, las marca y registra. Errores de envio individuales
 * NO borran la fila — quedara para el siguiente tick.
 */
export function startNotificationWorker(options: { intervalMs?: number; batchSize?: number } = {}): WorkerHandle {
  const intervalMs = options.intervalMs ?? 15_000;
  const batchSize = options.batchSize ?? 20;
  let stopped = false;
  let inFlight = false;

  async function tick(): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const pending = await prisma.notificationQueue.findMany({
        where: { sent_at: null },
        orderBy: { created_at: 'asc' },
        take: batchSize,
      });
      for (const row of pending) {
        try {
          const body = row.payload_json ? (JSON.parse(row.payload_json) as unknown) : null;
          await transporter.send({
            id: row.id,
            kind: row.kind,
            submissionId: row.submission_id,
            body,
          });
          await prisma.notificationQueue.update({
            where: { id: row.id },
            data: { sent_at: new Date() },
          });
        } catch (err) {
          console.error(`[notify] falla al enviar ${row.id}:`, err instanceof Error ? err.message : err);
          // Sin reintentos explicitos: el siguiente tick lo intentara de nuevo.
        }
      }
    } catch (err) {
      console.error('[notify] error drenando cola:', err instanceof Error ? err.message : err);
    } finally {
      inFlight = false;
    }
  }

  // Primer tick inmediato + intervalo
  void tick();
  const handle = setInterval(() => void tick(), intervalMs);

  return {
    stop(): void {
      stopped = true;
      clearInterval(handle);
    },
  };
}
