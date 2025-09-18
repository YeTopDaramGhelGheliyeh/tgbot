import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';
import { updateCounterMessage } from './counter.helpers';

export function registerIncrementHandler(composer: Composer<BotContext>) {
  composer.callbackQuery('increment', async (ctx) => {
    ctx.session.clickCount += 1;
    logger.debug('Increment button pressed', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      clickCount: ctx.session.clickCount,
    });
    await ctx.answerCallbackQuery();
    await updateCounterMessage(ctx);
  });
}
