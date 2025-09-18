import 'dotenv/config';
import express from 'express';
import { Bot, session, webhookCallback } from 'grammy';

import { createBotComposer } from './composer';
import { BotContext, SessionData } from './types/session.context';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

const bot = new Bot<BotContext>(token);

bot.use(
  session({
    initial: (): SessionData => ({
      clickCount: 0,
    }),
  }),
);

bot.use(createBotComposer());

bot.catch((err) => {
  console.error('Bot encountered an error', err);
});

const port = Number(process.env.PORT ?? 3000);
const useWebhook = process.env.USE_WEBHOOK === 'true';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

let webhookPath: string | undefined;
if (useWebhook) {
  webhookPath = `/webhook/${bot.token}`;
  app.post(webhookPath, webhookCallback(bot, 'express'));
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (useWebhook) {
    console.log(`Webhook endpoint ready at ${webhookPath}`);
    console.log('Webhook mode enabled. Remember to register the webhook with Telegram.');
  } else {
    console.log('Running in long polling mode');
  }
});

if (!useWebhook) {
  bot
    .api.deleteWebhook({ drop_pending_updates: true })
    .then(() =>
      bot.start({
        onStart: (botInfo) => console.log(`Bot @${botInfo.username} is up and running`),
      }),
    )
    .catch((error) => {
      console.error('Failed to launch bot via long polling', error);
      process.exit(1);
    });
}
