import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';
import { updateCounterMessage } from './counter.helpers';

export function registerIncrementHandler(composer: Composer<BotContext>) {
  composer.callbackQuery('increment', async (ctx) => {
    ctx.session.clickCount += 1;
    await ctx.answerCallbackQuery();
    await updateCounterMessage(ctx);
  });
}
