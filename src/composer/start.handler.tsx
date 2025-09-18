import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';
import { createCounterKeyboard } from './counter.helpers';

export function registerStartCommand(composer: Composer<BotContext>) {
  composer.command('start', async (ctx) => {
    ctx.session.clickCount = 0;
    await ctx.reply('Welcome! Use the buttons below.', {
      reply_markup: createCounterKeyboard(),
    });
  });
}
