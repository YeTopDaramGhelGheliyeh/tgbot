import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';
import { updateCounterMessage } from './counter.helpers';

export function registerResetHandler(composer: Composer<BotContext>) {
  composer.callbackQuery('reset', async (ctx) => {
    ctx.session.clickCount = 0;
    logger.info('Reset button pressed', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    await ctx.answerCallbackQuery({ text: 'Counter reset' });
    await updateCounterMessage(ctx);
  });
}
