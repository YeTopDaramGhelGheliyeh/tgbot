import { Context, SessionFlavor } from 'grammy';

export interface SessionData {
  clickCount: number;
}

export type BotContext = Context & SessionFlavor<SessionData>;
