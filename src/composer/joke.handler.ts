import { Composer } from 'grammy';

import { fetchRandomJoke } from '../service/joke.service';
import { BotContext } from '../types/session.context';

export function registerJokeCommand(composer: Composer<BotContext>) {
  composer.command('jokeshoharammeh', async (ctx) => {
    try {
      const joke = await fetchRandomJoke();
      await ctx.reply(`${joke.setup}\n\n${joke.punchline}`);
    } catch (error) {
      console.error('Failed to fetch joke', error);
      await ctx.reply('Sorry, I could not fetch a joke right now. Please try again later.');
    }
  });
}
