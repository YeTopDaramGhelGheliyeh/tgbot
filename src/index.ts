import 'dotenv/config';
import express from 'express';
import { Bot, InputFile, session, webhookCallback } from 'grammy';
import { lensRegistry } from './service/lens.service';
import { renderCameraPage } from './service/camera.page';

import { createBotComposer } from './composer';
import { logger } from './lib/logger';
import { BotContext, SessionData } from './types/session.context';

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
const useWebhook = process.env.USE_WEBHOOK === 'true';

logger.info('Bootstrapping bot server', { port, useWebhook });

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  logger.debug('Health check endpoint accessed');
  res.json({ status: 'ok' });
});

let webhookPath: string | undefined;
if (useWebhook) {
  webhookPath = `/webhook/${bot.token}`;
  app.post(webhookPath, webhookCallback(bot, 'express'));
  logger.info('Webhook mode enabled', { webhookPath });
} else {
  logger.info('Long polling mode enabled');
}

app.listen(port, () => {
  logger.info('Server listening for bot traffic', {
    port,
    mode: useWebhook ? 'webhook' : 'long-polling',
  });
  if (useWebhook) {
    logger.info('Webhook endpoint ready for Telegram registration', { webhookPath });
  }
});

if (!useWebhook) {
  bot
    .api.deleteWebhook({ drop_pending_updates: true })
    .then(() => {
      logger.info('Webhook removed; starting long polling');
      return bot.start({
        onStart: (botInfo) => {
          logger.info('Bot is up and running', { username: botInfo.username });
        },
      });
    })
    .catch((error) => {
      logger.error(error, 'Failed to launch bot via long polling');
      process.exit(1);
    });
}

// Routes for MoriLens web and API

app.get('/', (_req, res) => {
  res.type('html').send('<!doctype html><html><head><meta charset="utf-8"><title>MoriLens</title></head><body><h3>MoriLens</h3><p>Use the bot to create a Lens and get a link.</p></body></html>');
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
    const base64 = image.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    await bot.api.sendPhoto(lens.groupId, new InputFile(buf, `lens-${code}.jpg`));
    res.json({ ok: true });
  } catch (error) {
    logger.error(error, 'Failed to relay lens frame');
    res.status(500).send('Internal error');
  }
});
