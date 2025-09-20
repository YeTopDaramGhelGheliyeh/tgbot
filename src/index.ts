import 'dotenv/config';
import express from 'express';
import path from 'path';
import { Bot, InputFile, session, webhookCallback } from 'grammy';
import { lensRegistry } from './service/lens.service';
import { renderCameraPage } from './service/camera.page';
import { renderOnlinePage } from './service/online.page';
import { TelegramSendQueue } from './service/telegram.queue';

import { createBotComposer } from './composer';
import { logger } from './lib/logger';
import { BotContext, SessionData } from './types/session.context';

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (typeof raw === 'undefined') return defaultValue;
  const value = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  logger.warn('Unrecognized boolean environment value; using default', { name, value: raw });
  return defaultValue;
}

function buildWebhookUrl(base: string, path: string): string {
  const url = new URL(base);
  const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  url.pathname = `${basePath}${suffix}`;
  return url.toString();
}


const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  const error = new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  logger.error(error, 'Missing TELEGRAM_BOT_TOKEN environment variable during startup');
  throw error;
}

const bot = new Bot<BotContext>(token);

logger.debug('Configuring session middleware');
bot.use(
  session({
    initial: (): SessionData => ({
      clickCount: 0,
      lenses: [],
      creating: undefined,
    }),
  }),
);

logger.debug('Registering bot composer handlers');
bot.use(createBotComposer());

bot.catch((err) => {
  logger.error(err, 'Bot encountered an unhandled runtime error');
});

const port = Number(process.env.PORT ?? 3000);
let useWebhook = envFlag('USE_WEBHOOK');
const publicBaseUrl = process.env.PUBLIC_BASE_URL;

if (useWebhook) {
  if (!publicBaseUrl) {
    const error = new Error('PUBLIC_BASE_URL environment variable is required when USE_WEBHOOK=true');
    logger.error(error, 'Missing PUBLIC_BASE_URL environment variable during startup');
    throw error;
  }
  let parsedBase: URL;
  try {
    parsedBase = new URL(publicBaseUrl);
  } catch (_err) {
    const error = new Error(`PUBLIC_BASE_URL is not a valid URL: ${publicBaseUrl}`);
    logger.error(error, 'Invalid PUBLIC_BASE_URL environment variable');
    throw error;
  }
  if (parsedBase.protocol !== 'https:') {
    const error = new Error('PUBLIC_BASE_URL must use https:// scheme for Telegram webhooks');
    logger.error(error, 'Invalid PUBLIC_BASE_URL environment variable');
    throw error;
  }
}

logger.info('Bootstrapping bot server', {
  port,
  requestedMode: useWebhook ? 'webhook' : 'long-polling',
});
const app = express();
const faviconPath = path.resolve(process.cwd(), 'assets', 'MoriLensNoBack.svg');
app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  logger.debug('Health check endpoint accessed');
  res.json({ status: 'ok' });
});

app.get(['/favicon.svg', '/favicon.ico'], (_req, res) => {
  res.type('image/svg+xml');
  res.sendFile(faviconPath, (error) => {
    if (error) {
      logger.error(error, 'Failed to send favicon');
      if (!res.headersSent) res.status(500).end();
    }
  });
});

let webhookPath: string | undefined;
if (useWebhook) {
  const wp = `/webhook/${bot.token}`;
  webhookPath = wp;
  app.post(wp, webhookCallback(bot, 'express'));
  logger.info('Webhook route registered', { webhookPath: wp });
} else {
  logger.info('Long polling mode requested');
}

const server = app.listen(port, () => {
  logger.info('Server listening for bot traffic', { port });
  if (useWebhook && webhookPath) {
    logger.info('Webhook endpoint ready for Telegram registration', { webhookPath });
  }
  void configureBotTransport();
});

server.on('error', (error) => {
  logger.error(error, 'Failed to start HTTP server');
  process.exit(1);
});

async function configureBotTransport(): Promise<void> {
  if (useWebhook && webhookPath) {
    try {
      const webhookUrl = buildWebhookUrl(publicBaseUrl!, webhookPath);
      await bot.api.setWebhook(webhookUrl, { drop_pending_updates: false });
      const me = await bot.api.getMe();
      logger.info('Webhook registered with Telegram', { webhookUrl });
      logger.info('Bot is up and running', { username: me.username, mode: 'webhook' });
      return;
    } catch (error) {
      logger.error(error, 'Failed to register webhook with Telegram');
      process.exit(1);
    }
  }

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    logger.info('Webhook removed; starting long polling');
    await bot.start({
      onStart: (botInfo) => {
        logger.info('Bot is up and running', { username: botInfo.username, mode: 'long-polling' });
      },
    });
  } catch (error) {
    logger.error(error, 'Failed to launch bot via long polling');
    process.exit(1);
  }
}

// Routes for MoriLens web and API

app.get('/', (_req, res) => {
  res.type('html').send('<!doctype html><html><head><meta charset="utf-8"><title>MoriLens</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"></head><body><h3>MoriLens</h3><p>Use the bot to create a Lens and get a link.</p></body></html>');
});

app.get('/lens/:code', (req, res) => {
  const code = String(req.params.code || '');
  const lens = lensRegistry.getLens(code);
  if (!lens) {
    res.status(404).type('text').send('Unknown lens');
    return;
  }
  res.type('html').send(renderCameraPage(code));
});

app.get('/l/:short', (req, res) => {
  const shortCode = String(req.params.short || '');
  const longUrl = lensRegistry.resolveShort(shortCode);
  if (!longUrl) {
    res.status(404).type('text').send('Unknown short link');
    return;
  }
  res.redirect(longUrl);
});

app.get('/online/:code', (req, res) => {
  const code = String(req.params.code || '');
  const lens = lensRegistry.getLens(code);
  if (!lens) {
    res.status(404).type('text').send('Unknown lens');
    return;
  }
  if (lens.expiresAt && Date.now() > lens.expiresAt) {
    // show page anyway; users can still copy code even if expired
  }
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  res.type('html').send(renderOnlinePage(code, token, lens.groupId));
});

app.post('/api/lens/:code/shoot', async (req, res) => {
  try {
    const code = String(req.params.code || '');
    const lens = lensRegistry.getLens(code);
    if (!lens || !lens.groupId) {
      res.status(400).send('Lens not connected');
      return;
    }
    if (lens.expiresAt && Date.now() > lens.expiresAt) {
      res.status(410).send('Lens expired');
      return;
    }
    const image: unknown = req.body?.image;
    if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
      res.status(400).send('Invalid image');
      return;
    }
    // Simple per-lens and per-IP rate limits
    if (!allowRate(`lens:${code}`, 1, 5) || !allowRate(`ip:${getIp(req)}`, 2, 6)) {
      res.status(429).send('Too many requests');
      return;
    }
    const modeRaw = (req.body as any)?.mode;
    const asPhoto = modeRaw === 'photo';
    const base64 = image.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    const queue = getQueue();
    await queue.enqueue(lens.groupId, async () => {
      if (asPhoto) {
        await bot.api.sendPhoto(lens.groupId!, new InputFile(buf, `lens-${code}.jpg`));
      } else {
        await bot.api.sendDocument(lens.groupId!, new InputFile(buf, `lens-${code}.jpg`));
      }
    });
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to relay lens frame');
    res.status(500).send('Internal error');
  }
});

// --- Simple rate limiter (token bucket) ---
type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();
function allowRate(key: string, ratePerSec: number, capacity: number): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, last: now };
  const delta = (now - b.last) / 1000;
  b.tokens = Math.min(capacity, b.tokens + delta * ratePerSec);
  b.last = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
  }
  buckets.set(key, b);
  return false;
}

function getIp(req: any): string {
  const hdr = (req?.headers?.['cf-connecting-ip'] || req?.headers?.['x-forwarded-for']) as string | undefined;
  if (hdr && typeof hdr === 'string' && hdr.length > 0) return hdr.split(',')[0].trim();
  const ip = req?.ip as string | undefined;
  return typeof ip === 'string' && ip.length > 0 ? ip : '0.0.0.0';
}

let queueInstance: TelegramSendQueue | undefined;
function getQueue() {
  if (!queueInstance) {
    queueInstance = new TelegramSendQueue({});
  }
  return queueInstance;
}
