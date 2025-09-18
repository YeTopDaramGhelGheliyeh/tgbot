import { Context, SessionFlavor } from 'grammy';

export interface Lens {
  code: string;
  name: string;
  ownerUserId: number;
  groupId?: number;
  expiresAt?: number; // unix ms
  shortCode?: string;
}

export type CreationStep = 'await_name' | 'await_connect' | 'await_expiry' | undefined;

export interface CreationState {
  step: CreationStep;
  code?: string;
  name?: string;
}

export interface SessionData {
  clickCount: number;
  lenses: Lens[];
  creating?: CreationState;
  uiMessageId?: number;
}

export type BotContext = Context & SessionFlavor<SessionData>;
