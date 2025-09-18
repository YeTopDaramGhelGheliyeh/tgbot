import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';
import { updateCounterMessage } from './counter.helpers';

export function registerResetHandler(composer: Composer<BotContext>) {
  composer.callbackQuery('reset', async (ctx) => {
    ctx.session.clickCount = 0;
    await ctx.answerCallbackQuery({ text: 'Counter reset' });
    await updateCounterMessage(ctx);
  });
}
