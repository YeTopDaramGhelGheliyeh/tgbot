import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';
import { registerHelpCommand } from './help.handler';
import { registerIncrementHandler } from './increment.handler';
import { registerJokeCommand } from './joke.handler';
import { registerResetHandler } from './reset.handler';
import { registerStartCommand } from './start.handler';
import { registerUnknownCallbackHandler } from './unknown-callback.handler';
import { registerLensHandlers } from './lens2.handler';

export function createBotComposer() {
  const composer = new Composer<BotContext>();
  registerStartCommand(composer);
  registerHelpCommand(composer);
  registerJokeCommand(composer);
  registerIncrementHandler(composer);
  registerResetHandler(composer);
  registerLensHandlers(composer);
  registerUnknownCallbackHandler(composer);
  return composer;
}
