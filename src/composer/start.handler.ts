import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';
import { createStartKeyboard } from './lens.handler';

export function registerStartCommand(composer: Composer<BotContext>) {
  composer.command('start', async (ctx) => {
    logger.info('Received /start command', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    ctx.session.clickCount = 0;
    ctx.session.lenses = ctx.session.lenses ?? [];
    ctx.session.creating = undefined;
    const text = [
      'Welcome to MoriLens! 👋',
      '',
      'Create a Lens to capture and send photos from a simple web camera page to your Telegram group.',
      'Use the buttons below to begin:',
    ].join('\n');
    await ctx.reply(text, {
      reply_markup: createStartKeyboard(),
    });
  });
}
