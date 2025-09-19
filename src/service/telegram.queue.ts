import { logger } from '../lib/logger';

type Task = () => Promise<void>;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class TelegramSendQueue {
  private perChat = new Map<number, Promise<void>>();

  private active = 0;

  private waiters: Array<() => void> = [];

  constructor(private readonly opts: { maxConcurrent?: number; perChatDelayMs?: number } = {}) {}

  private get maxConcurrent() {
    const env = Number(process.env.SEND_CONCURRENCY ?? '0');
    return this.opts.maxConcurrent ?? (env > 0 ? env : 8);
  }

  private get perChatDelayMs() {
    const env = Number(process.env.PER_CHAT_DELAY_MS ?? '0');
    return this.opts.perChatDelayMs ?? (env > 0 ? env : 400);
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiters.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release() {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  async enqueue(chatId: number, task: Task): Promise<void> {
    const chain = this.perChat.get(chatId) ?? Promise.resolve();
    const next = chain
      .then(async () => {
        await this.acquire();
        try {
          await this.runWithRetry(task, chatId);
        } finally {
          this.release();
        }
        await sleep(this.perChatDelayMs);
      })
      .catch((err) => {
        logger.error(err, 'Telegram send task failed', { chatId });
      });

    this.perChat.set(chatId, next);
    // Let the chain clean up after itself to avoid unbounded growth
    next.then(() => {
      const current = this.perChat.get(chatId);
      if (current === next) {
        // keep last promise to preserve ordering; do not delete here
      }
    });
    return next;
  }

  private async runWithRetry(task: Task, chatId: number) {
    let attempt = 0;
    let delayMs = 1000;
    // up to 3 retries on 429/5xx
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await task();
        return;
      } catch (e: any) {
        const msg = (e && (e.description || e.message)) as string | undefined;
        const isTooMany = msg?.includes('Too Many Requests');
        const retryAfter = this.parseRetryAfter(msg);
        const is5xx = /50\d/.test(String(e?.error_code ?? ''));
        if ((isTooMany || is5xx) && attempt < 3) {
          attempt += 1;
          const wait = retryAfter ? (retryAfter + 0.5) * 1000 : delayMs;
          logger.warn('Retrying Telegram send after backoff', { chatId, attempt, waitMs: wait });
          await sleep(wait);
          delayMs *= 2;
          continue;
        }
        throw e;
      }
    }
  }

  private parseRetryAfter(text?: string): number | undefined {
    if (!text) return undefined;
    const m = text.match(/retry after (\d+)/i);
    if (m) return Number(m[1]);
    return undefined;
  }
}
