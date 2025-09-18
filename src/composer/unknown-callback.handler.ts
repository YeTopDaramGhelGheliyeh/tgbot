import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';

export function registerUnknownCallbackHandler(composer: Composer<BotContext>) {
  composer.on('callback_query:data', async (ctx) => {
    logger.warn('Received unknown callback data', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      data: ctx.callbackQuery?.data,
    });
    await ctx.answerCallbackQuery({ text: 'Unknown action', show_alert: true });
  });
}
