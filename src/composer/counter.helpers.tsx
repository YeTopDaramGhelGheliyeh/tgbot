import { InlineKeyboard } from 'grammy';

import { BotContext } from '../types/session.context';

export const createCounterKeyboard = () =>
  new InlineKeyboard().text('Increment', 'increment').row().text('Reset', 'reset');

export const renderCounter = (count: number) =>
  `You have pressed the button ${count} time${count === 1 ? '' : 's'}.`;

export async function updateCounterMessage(ctx: BotContext) {
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
