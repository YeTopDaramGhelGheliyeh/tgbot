import { Composer, InlineKeyboard } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext, CreationState } from '../types/session.context';
import { choiceToMs, lensRegistry, type ExpiryChoice } from '../service/lens.service';

const START_CREATE = 'lens_create';
const START_LIST = 'lens_list';
const EXPIRE_PREFIX = 'lens_expire_'; // +choice:code
const TOGGLE_PREFIX = 'lens_toggle_'; // +code

function startKeyboard() {
  return new InlineKeyboard()
    .text('Create New Lens', START_CREATE)
    .row()
    .text('My Lens', START_LIST);
}

function expiryKeyboard(code: string) {
  return new InlineKeyboard()
    .text('4h', `${EXPIRE_PREFIX}4h:${code}`)
    .text('10h', `${EXPIRE_PREFIX}10h:${code}`)
    .text('24h', `${EXPIRE_PREFIX}24h:${code}`)
    .row()
    .text('2 days', `${EXPIRE_PREFIX}2d:${code}`)
    .text('3 days', `${EXPIRE_PREFIX}3d:${code}`)
    .text('4 days', `${EXPIRE_PREFIX}4d:${code}`);
}

function toggleKeyboard(code: string, show: 'short' | 'long') {
  const label = show === 'short' ? 'Show Short Link' : 'Show Long Link';
  return new InlineKeyboard().text(label, `${TOGGLE_PREFIX}${show}:${code}`);
}

export function registerLensHandlers(composer: Composer<BotContext>) {
  // Create or list entry points from custom buttons
  composer.callbackQuery(START_CREATE, async (ctx) => {
    ctx.session.creating = { step: 'await_name' } as CreationState;
    await ctx.answerCallbackQuery();
    await ctx.reply('Great! Send me a name for this Lens (e.g., Event Gate, Front Door, etc.).');
  });

  composer.callbackQuery(START_LIST, async (ctx) => {
    await ctx.answerCallbackQuery();
    const lenses = lensRegistry.listByOwner(ctx.from!.id);
    if (lenses.length === 0) {
      await ctx.reply('You have no lenses yet. Create one to get started.', { reply_markup: startKeyboard() });
      return;
    }
    const lines = lenses.map((l) => {
      const status = l.groupId ? (lensRegistry.isExpired(l.code) ? 'Expired' : 'Active') : 'Not connected';
      return `• ${l.name} — ${l.code} (${status})`;
    });
    await ctx.reply(['Your Lenses:', ...lines].join('\n'));
  });

  // Name collection in private chat
  composer.on('message:text', async (ctx, next) => {
    const step = ctx.session.creating?.step;
    if (ctx.chat?.type === 'private' && step === 'await_name') {
      const name = ctx.message.text.trim().slice(0, 80);
      const lens = lensRegistry.createLens(ctx.from!.id, name);
      ctx.session.creating = { step: 'await_connect', code: lens.code, name };

      const code = lens.code;
      const instructions = [
        `Lens "${name}" created.`,
        '',
        `Lens Code: ${code}`,
        '',
        'Next steps:',
        '1) Add @MoriLensbot to your group and make it admin.',
        '2) Send the connect code in that group: /connect ' + code,
        '',
        'Tip: Use the button below to open chats with the code prefilled.',
      ].join('\n');

      const share = encodeURIComponent(`/connect ${code}`);
      const shareUrl = `https://t.me/share/url?url=${share}&text=${share}`;
      const kb = new InlineKeyboard().url('Open Chats', shareUrl);
      await ctx.reply(instructions, { reply_markup: kb });
      return;
    }
    await next();
  });

  // Handle inline query to send the connect message easily in a chosen chat
  composer.on('inline_query', async (ctx) => {
    const q = ctx.inlineQuery.query || '';
    const trimmed = q.trim();
    const title = 'Send Lens connect code';
    const description = 'Posts the code in the selected chat';
    const message_text = trimmed.length > 0 ? trimmed : 'Tap to send the code.';
    await ctx.answerInlineQuery([
      {
        type: 'article',
        id: 'connect-code',
        title,
        description,
        input_message_content: { message_text },
      },
    ], { cache_time: 0 });
  });

  // Connect command in group: /connect CODE
  composer.chatType(['group', 'supergroup']).command('connect', async (ctx) => {
    const parts = (ctx.message.text || '').split(/\s+/);
    const code = parts[1]?.trim();
    if (!code) {
      await ctx.reply('Usage: /connect <LENS_CODE>');
      return;
    }
    const lens = lensRegistry.getLens(code);
    if (!lens) {
      await ctx.reply('Invalid code. Ask the owner to create a new Lens.');
      return;
    }
    lensRegistry.connectLens(code, ctx.chat.id);
    await ctx.reply('MoriLens connected to this group ✅');
    try {
      await ctx.api.sendMessage(lens.ownerUserId, `Your lens "${lens.name}" is now connected to the group. Choose an expiry:` , {
        reply_markup: expiryKeyboard(code),
      });
    } catch (err) {
      logger.error(err, 'Failed to DM owner after connect', { ownerUserId: lens.ownerUserId });
    }
  });

  // Expiry selection via callback
  composer.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery?.data || '';
    if (data.startsWith(EXPIRE_PREFIX)) {
      const tail = data.substring(EXPIRE_PREFIX.length);
      const [choiceRaw, code] = tail.split(':');
      const choice = choiceRaw as ExpiryChoice;
      const lens = code ? lensRegistry.getLens(code) : undefined;
      if (!lens) {
        await ctx.answerCallbackQuery({ text: 'No lens in progress', show_alert: true });
        return;
      }
      const expiresAt = Date.now() + choiceToMs(choice);
      lensRegistry.setExpiry(lens.code, expiresAt);
      const longUrl = lensRegistry.longUrl(lens.code, expiresAt);
      const { shortCode, shortUrl } = lensRegistry.ensureShort(longUrl);
      lens.shortCode = shortCode;

      const text = [
        `Lens "${lens.name}" ready.`,
        `Expires: ${new Date(expiresAt).toLocaleString()}`,
        '',
        `Long link:\n${longUrl}`,
      ].join('\n');

      await ctx.answerCallbackQuery({ text: 'Expiry set' });
      try {
        await ctx.editMessageText(text, { reply_markup: toggleKeyboard(lens.code, 'short') });
      } catch {
        await ctx.reply(text, { reply_markup: toggleKeyboard(lens.code, 'short') });
      }
      return;
    }

    if (data.startsWith(TOGGLE_PREFIX)) {
      const [, payload] = data.split(TOGGLE_PREFIX);
      const [mode, code] = payload.split(':');
      const lens = lensRegistry.getLens(code);
      if (!lens || !lens.expiresAt) {
        await ctx.answerCallbackQuery({ text: 'Lens not ready yet', show_alert: true });
        return;
      }
      const longUrl = lensRegistry.longUrl(code, lens.expiresAt);
      const { shortUrl } = lens.shortCode ? { shortUrl: lensRegistry.shortUrl(lens.shortCode) } : lensRegistry.ensureShort(longUrl);

      const showShort = mode === 'short';
      const text = showShort
        ? `Short link:\n${shortUrl}`
        : `Long link:\n${longUrl}`;
      await ctx.answerCallbackQuery();
      try {
        await ctx.editMessageText(text, { reply_markup: toggleKeyboard(code, showShort ? 'long' : 'short') });
      } catch {
        await ctx.reply(text, { reply_markup: toggleKeyboard(code, showShort ? 'long' : 'short') });
      }
      return;
    }

    await next();
  });
}

export function createStartKeyboard() {
  return startKeyboard();
}
