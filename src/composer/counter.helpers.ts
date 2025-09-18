import { InlineKeyboard } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';

export const createCounterKeyboard = () =>
  new InlineKeyboard().text('Increment', 'increment').row().text('Reset', 'reset');

export const renderCounter = (count: number) =>
  `You have pressed the button ${count} time${count === 1 ? '' : 's'}.`;

export async function updateCounterMessage(ctx: BotContext) {
  const text = renderCounter(ctx.session.clickCount);
  logger.debug('Updating counter message', {
    chatId: ctx.chat?.id,
    userId: ctx.from?.id,
    clickCount: ctx.session.clickCount,
  });

  try {
    if (ctx.callbackQuery?.message) {
      await ctx.editMessageText(text, {
        reply_markup: createCounterKeyboard(),
      });
      return;
    }

    await ctx.reply(text, {
      reply_markup: createCounterKeyboard(),
    });
  } catch (error) {
    logger.error(error, 'Failed to update counter message', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
      hasCallbackMessage: Boolean(ctx.callbackQuery?.message),
    });

    if (ctx.callbackQuery?.message) {
      await ctx.reply(text, {
        reply_markup: createCounterKeyboard(),
      });
      logger.info('Sent counter message via fallback reply after edit failure', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
      });
    }
  }
}
