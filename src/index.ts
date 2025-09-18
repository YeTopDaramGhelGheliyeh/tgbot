import 'dotenv/config';
import express from 'express';
import {
  Bot,
  Composer,
  Context,
  InlineKeyboard,
  SessionFlavor,
  session,
  webhookCallback,
} from 'grammy';

interface SessionData {
  clickCount: number;
}

type BotContext = Context & SessionFlavor<SessionData>;

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

const composer = new Composer<BotContext>();

const createCounterKeyboard = () =>
  new InlineKeyboard().text('Increment', 'increment').row().text('Reset', 'reset');

const renderCounter = (count: number) =>
  `You have pressed the button ${count} time${count === 1 ? '' : 's'}.`;

async function updateCounterMessage(ctx: BotContext) {
  const text = renderCounter(ctx.session.clickCount);
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        reply_markup: createCounterKeyboard(),
      });
    } else {
      await ctx.reply(text, {
        reply_markup: createCounterKeyboard(),
      });
    }
  } catch (error) {
    console.error('Failed to update counter message', error);
    if (ctx.callbackQuery?.message) {
      await ctx.reply(text, {
        reply_markup: createCounterKeyboard(),
      });
    }
  }
}

composer.callbackQuery('increment', async (ctx) => {
  ctx.session.clickCount += 1;
  await ctx.answerCallbackQuery();
  await updateCounterMessage(ctx);
});

composer.callbackQuery('reset', async (ctx) => {
  ctx.session.clickCount = 0;
  await ctx.answerCallbackQuery({ text: 'Counter reset' });
  await updateCounterMessage(ctx);
});

composer.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Unknown action', show_alert: true });
});

bot.use(composer);

bot.command('start', async (ctx) => {
  ctx.session.clickCount = 0;
  await ctx.reply('Welcome! Use the buttons below.', {
    reply_markup: createCounterKeyboard(),
  });
});

bot.catch((err) => {
  console.error('Bot encountered an error', err);
});

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const webhookPath = `/webhook/${bot.token}`;
app.post(webhookPath, webhookCallback(bot, 'express'));

const port = Number(process.env.PORT ?? 3000);
const useWebhook = process.env.USE_WEBHOOK === 'true';

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  if (useWebhook) {
    console.log(`Webhook endpoint ready at ${webhookPath}`);
  } else {
    console.log('Running in long polling mode');
  }
});

if (useWebhook) {
  console.log('Webhook mode enabled. Remember to register the webhook with Telegram.');
} else {
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
