import 'dotenv/config';
import express from 'express';
import { Bot, session, webhookCallback } from 'grammy';

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
app.use(express.json());

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
