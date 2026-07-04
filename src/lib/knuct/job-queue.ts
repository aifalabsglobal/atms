type KnuctJob = () => Promise<void>;

const queue: KnuctJob[] = [];
let draining = false;

/** In-process async worker queue (Phase 4 will swap for BullMQ). */
export function enqueueKnuctJob(job: KnuctJob): void {
  queue.push(job);
  scheduleDrain();
}

export function getKnuctQueueStats(): { pending: number; draining: boolean } {
  return { pending: queue.length, draining };
}

function scheduleDrain(): void {
  if (draining) return;
  draining = true;
  setImmediate(async () => {
    try {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        await job();
      }
    } catch (err) {
      console.error('[knuct] job queue drain error', err);
    } finally {
      draining = false;
      if (queue.length > 0) scheduleDrain();
    }
  });
}
