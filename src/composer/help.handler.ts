import { Composer } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';

const helpMessage = [
  'Here is what I can do:',
  '/start - Reset the counter and show the inline buttons.',
  '/help - Display this help message.',
  '/jokeshoharammeh - Send you a random joke.',
  '',
  'Tip: use the inline buttons to increment or reset the counter instantly.',
].join('\n');

export function registerHelpCommand(composer: Composer<BotContext>) {
  composer.command('help', async (ctx) => {
    logger.debug('Received /help command', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    await ctx.reply(helpMessage);
  });
}
