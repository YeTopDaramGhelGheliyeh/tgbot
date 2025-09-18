import { Composer } from 'grammy';

import { BotContext } from '../types/session.context';
import { registerIncrementHandler } from './increment.handler';
import { registerResetHandler } from './reset.handler';
import { registerStartCommand } from './start.handler';
import { registerUnknownCallbackHandler } from './unknown-callback.handler';

export function createBotComposer() {
  const composer = new Composer<BotContext>();
  registerStartCommand(composer);
  registerIncrementHandler(composer);
  registerResetHandler(composer);
  registerUnknownCallbackHandler(composer);
  return composer;
}
