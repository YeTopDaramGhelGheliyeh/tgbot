import { Composer } from 'grammy';

import { fetchRandomJoke } from '../service/joke.service';
import { logger } from '../lib/logger';
import { BotContext } from '../types/session.context';

export function registerJokeCommand(composer: Composer<BotContext>) {
  composer.command('jokeshoharammeh', async (ctx) => {
    logger.info('Received joke command', {
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    try {
      const joke = await fetchRandomJoke();
      logger.debug('Fetched joke from API', {
        jokeId: joke.id,
        jokeType: joke.type,
      });
      await ctx.reply(`${joke.setup}\n\n${joke.punchline}`);
    } catch (error) {
      logger.error(error, 'Failed to fetch joke for user', {
        chatId: ctx.chat?.id,
        userId: ctx.from?.id,
      });
      await ctx.reply('Sorry, I could not fetch a joke right now. Please try again later.');
    }
  });
}
