import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';
import { createCounterKeyboard } from './counter.helpers';

export function registerStartCommand(composer: Composer<BotContext>) {
  composer.command('start', async (ctx) => {
    logger.info('Received /start command', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    ctx.session.clickCount = 0;
    await ctx.reply('Welcome! Use the buttons below or send /help to see available commands.', {
      reply_markup: createCounterKeyboard(),
    });
  });
}
