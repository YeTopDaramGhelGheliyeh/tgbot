import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';

export function registerUnknownCallbackHandler(composer: Composer<BotContext>) {
  composer.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'Unknown action', show_alert: true });
  });
}
