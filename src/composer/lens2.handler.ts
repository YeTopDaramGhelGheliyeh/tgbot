import { Composer, InlineKeyboard, GrammyError } from 'grammy';

import { logger } from '../lib/logger';
import { BotContext, CreationState } from '../types/session.context';
import { choiceToMs, lensRegistry, type ExpiryChoice } from '../service/lens.service';

const START_CREATE = 'lens_create';
const START_LIST = 'lens_list';
const START_CREATE_ONLINE = 'lens_create_online';
const VIEW_PREFIX = 'lens_view_'; // +code
const EXPIRE_PREFIX = 'lens_expire_'; // +choice:code
const TOGGLE_PREFIX = 'lens_toggle_'; // +mode:code
const CANCEL = 'lens_cancel';
const HELP = 'lens_help';

function startKeyboard() {
  return new InlineKeyboard()
    .text('Create New Lens', START_CREATE)
    .row()
    .text('Create Online Lens', START_CREATE_ONLINE)
    .row()
    .text('My Lens', START_LIST)
    .row()
    .text('Help', HELP);
}

function listKeyboard(ownerId: number) {
  const lenses = lensRegistry.listByOwner(ownerId).filter((l) => Boolean(l.groupId));
  const kb = new InlineKeyboard();
  for (const l of lenses) {
    const status = lensRegistry.isExpired(l.code) ? 'Expired' : 'Active';
    const name = l.name.length > 30 ? l.name.slice(0, 27) + '...' : l.name;
    kb.text(`${name} (${status})`, `${VIEW_PREFIX}${l.code}`).row();
  }
  kb
    .text('Create New Lens', START_CREATE)
    .text('Create Online Lens', START_CREATE_ONLINE)
    .row()
    .text('Help', HELP)
    .text('Cancel', CANCEL);
  return kb;
}

function expiryKeyboard(code: string) {
  return new InlineKeyboard()
    .text('4h', `${EXPIRE_PREFIX}4h:${code}`)
    .text('10h', `${EXPIRE_PREFIX}10h:${code}`)
    .text('24h', `${EXPIRE_PREFIX}24h:${code}`)
    .row()
    .text('2 days', `${EXPIRE_PREFIX}2d:${code}`)
    .text('3 days', `${EXPIRE_PREFIX}3d:${code}`)
    .text('4 days', `${EXPIRE_PREFIX}4d:${code}`)
    .row()
    .text('Cancel', CANCEL)
    .text('Help', HELP);
}

function detailKeyboard(
  code: string,
  current: 'short' | 'long',
  longUrl?: string,
  _shortUrl?: string,
  kind: 'camera' | 'online' = 'camera',
) {
  const kb = new InlineKeyboard();
  if (longUrl) kb.url(kind === 'online' ? 'Open Online Lens' : 'Open Camera', longUrl);
  kb.row();
  if (current === 'long') {
    kb.text('Show Short Link', `${TOGGLE_PREFIX}short:${code}`);
  } else {
    kb.text('Show Long Link', `${TOGGLE_PREFIX}long:${code}`);
  }
  kb.row()
    .text('Back', START_LIST)
    .text('Help', HELP);
  kb.row()
    .text('Create New Lens', START_CREATE)
    .text('Create Online Lens', START_CREATE_ONLINE);
  return kb;
}

function fmtRemaining(ms: number) {
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

type AnswerCallbackQueryParams = Parameters<BotContext['answerCallbackQuery']>[0];

const staleCallbackFragments = ['query is too old', 'query ID is invalid'];

async function answerCallbackQuerySafe(ctx: BotContext, params?: AnswerCallbackQueryParams) {
  try {
    await ctx.answerCallbackQuery(params);
  } catch (error) {
    if (error instanceof GrammyError) {
      const description = error.description ?? '';
      if (staleCallbackFragments.some((fragment) => description.includes(fragment))) {
        logger.debug('Ignoring stale callback query', { description });
        return;
      }
    }
    throw error;
  }
}

export function registerLensHandlers(composer: Composer<BotContext>) {
  async function sendOrUpdate(ctx: BotContext, text: string, kb?: InlineKeyboard) {
    try {
      if (ctx.callbackQuery?.message) {
        await ctx.editMessageText(text, kb ? { reply_markup: kb } : undefined);
        return;
      }
    } catch {}
    // Fallback: replace previous UI message in private chat to reduce clutter
    try {
      if (ctx.chat?.type === 'private' && ctx.session.uiMessageId) {
        await ctx.api.deleteMessage(ctx.chat.id, ctx.session.uiMessageId).catch(() => undefined);
      }
    } catch {}
    const sent = await ctx.reply(text, kb ? { reply_markup: kb } : undefined);
    if (ctx.chat?.type === 'private') {
      ctx.session.uiMessageId = sent.message_id;
    }
  }

  // Create or list entry points from custom buttons
  composer.callbackQuery(START_CREATE, async (ctx) => {
    ctx.session.creating = { step: 'await_name' } as CreationState;
    await answerCallbackQuerySafe(ctx);
    await sendOrUpdate(ctx, 'Send a name for this Lens ✍️ (e.g., Event Gate, Front Door).', new InlineKeyboard().text('Cancel', CANCEL).text('Help', HELP));
  });

  composer.callbackQuery(START_CREATE_ONLINE, async (ctx) => {
    ctx.session.creating = { step: 'await_name', kind: 'online' } as CreationState;
    await answerCallbackQuerySafe(ctx);
    await sendOrUpdate(ctx, 'Send a name for this Online Lens ✍️ (e.g., Portal Code, Access Key).', new InlineKeyboard().text('Cancel', CANCEL).text('Help', HELP));
  });

  composer.callbackQuery(START_LIST, async (ctx) => {
    await answerCallbackQuerySafe(ctx);
    const lenses = lensRegistry.listByOwner(ctx.from!.id).filter((l) => Boolean(l.groupId));
    if (lenses.length === 0) {
      await sendOrUpdate(ctx, 'You have no connected lenses yet 🗒️ Create one to get started.', startKeyboard());
      return;
    }
    await sendOrUpdate(ctx, 'My Lens 📸 — Choose one to view details:', listKeyboard(ctx.from!.id));
  });

  // Name collection in private chat
  composer.on('message:text', async (ctx, next) => {
    const step = ctx.session.creating?.step;
    if (ctx.chat?.type === 'private' && step === 'await_name') {
      const name = ctx.message.text.trim().slice(0, 80);
      const kind = ctx.session.creating?.kind === 'online' ? 'online' : 'camera';
      const lens = lensRegistry.createLens(ctx.from!.id, name, kind);
      ctx.session.creating = { step: 'await_connect', code: lens.code, name, kind };

      const code = lens.code;
      const instructions = [
        kind === 'online' ? 'New Online Lens created ✨' : 'New Lens created ✨',
        `Name: ${name}`,
        `Code 🔑: ${code}`,
        '',
        'Next steps ✅:',
        '1) Add @MoriLensbot to your group and make it admin.',
        `2) Send /connect ${code} in that group.`,
        '',
        'Tip 💡: Use the button to open chats with code prefilled.',
      ].join('\n');

      const share = encodeURIComponent(`/connect ${code}`);
      const shareUrl = `https://t.me/share/url?url=${share}&text=${share}`;
      const kb = new InlineKeyboard().url('Open Chats', shareUrl).row().text('Cancel', CANCEL).text('Help', HELP);
      await sendOrUpdate(ctx, instructions, kb);
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
      await ctx.reply('Usage ℹ️: /connect <LENS_CODE>');
      return;
    }
    const lens = lensRegistry.getLens(code);
    if (!lens) {
      await ctx.reply('Invalid code ⚠️ Ask the owner to create a new Lens.');
      return;
    }
    lensRegistry.connectLens(code, ctx.chat.id);
    await ctx.reply('Connected to this group ✅');
    try {
      await ctx.api.sendMessage(lens.ownerUserId, `Your lens "${lens.name}" is now connected to the group. Choose an expiry:`, {
        reply_markup: expiryKeyboard(code),
      });
    } catch (err) {
      logger.error(err, 'Failed to DM owner after connect', { ownerUserId: lens.ownerUserId });
    }
  });

  // Details and expiry/toggle via callback
  composer.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery?.data || '';

    if (data.startsWith(VIEW_PREFIX)) {
      const code = data.substring(VIEW_PREFIX.length);
      const lens = lensRegistry.getLens(code);
      if (!lens) {
        await answerCallbackQuerySafe(ctx, { text: 'Lens not found', show_alert: true });
        return;
      }
      let groupLine = 'Group 👥: Not connected';
      if (lens.groupId) {
        try {
          const chat: any = await ctx.api.getChat(lens.groupId);
          const title = chat && chat.title ? chat.title : 'Connected';
          groupLine = `Group 👥: ${title}`;
        } catch {
          groupLine = 'Group 👥: Connected';
        }
      }
      const status = lens.groupId ? (lensRegistry.isExpired(lens.code) ? 'Expired ⌛️' : 'Active ✅') : 'Not connected 🚫';
      let expiryLine = 'Expiry ⏳: not set';
      let remainingLine = '';
      let longUrl: string | undefined;
      let shortUrl: string | undefined;
      if (lens.expiresAt) {
        expiryLine = `Expiry ⏳: ${new Date(lens.expiresAt).toLocaleString()}`;
        remainingLine = `Remaining ⌛️: ${fmtRemaining(lens.expiresAt - Date.now())}`;
        longUrl = lens.kind === 'online' ? lensRegistry.onlineUrl(lens.code, lens.expiresAt) : lensRegistry.longUrl(lens.code, lens.expiresAt);
        if (lens.shortCode) shortUrl = lensRegistry.shortUrl(lens.shortCode);
        if (!shortUrl && longUrl) {
          const { shortCode } = lensRegistry.ensureShort(longUrl);
          lens.shortCode = shortCode;
          shortUrl = lensRegistry.shortUrl(shortCode);
        }
      }
      const heading = lens.kind === 'online' ? 'Online Lens 🎯' : 'Lens 🎯';
      const text = [
        `${heading}: ${lens.name}`,
        `Code 🔑: ${lens.code}`,
        `Status: ${status}`,
        groupLine,
        expiryLine,
        remainingLine,
        longUrl ? `\nLong 🔗: ${longUrl}` : '',
      ].filter(Boolean).join('\n');

      await answerCallbackQuerySafe(ctx);
      await sendOrUpdate(ctx, text, detailKeyboard(lens.code, 'long', longUrl, shortUrl, lens.kind || 'camera'));
      return;
    }

    if (data.startsWith(EXPIRE_PREFIX)) {
      const tail = data.substring(EXPIRE_PREFIX.length);
      const [choiceRaw, code] = tail.split(':');
      const choice = choiceRaw as ExpiryChoice;
      const lens = code ? lensRegistry.getLens(code) : undefined;
      if (!lens) {
        await answerCallbackQuerySafe(ctx, { text: 'No lens in progress', show_alert: true });
        return;
      }
      const expiresAt = Date.now() + choiceToMs(choice);
      lensRegistry.setExpiry(lens.code, expiresAt);
      const longUrl = lens.kind === 'online' ? lensRegistry.onlineUrl(lens.code, expiresAt) : lensRegistry.longUrl(lens.code, expiresAt);
      const { shortCode } = lensRegistry.ensureShort(longUrl);
      lens.shortCode = shortCode;
      const shortUrl = lensRegistry.shortUrl(shortCode);

      const text = [
        lens.kind === 'online' ? `Online Lens 🎯: ${lens.name}` : `Lens 🎯: ${lens.name}`,
        `Code 🔑: ${lens.code}`,
        `Status: Active ✅`,
        'Group 👥: Connected',
        `Expiry ⏳: ${new Date(expiresAt).toLocaleString()}`,
        `Remaining ⌛️: ${fmtRemaining(expiresAt - Date.now())}`,
        '',
        `Long 🔗: ${longUrl}`,
      ].join('\n');

      await answerCallbackQuerySafe(ctx, { text: 'Expiry set' });
      await sendOrUpdate(ctx, text, detailKeyboard(lens.code, 'long', longUrl, shortUrl, lens.kind || 'camera'));
      return;
    }

    if (data.startsWith(TOGGLE_PREFIX)) {
      const [, payload] = data.split(TOGGLE_PREFIX);
      const [mode, code] = payload.split(':');
      const lens = lensRegistry.getLens(code);
      if (!lens || !lens.expiresAt) {
        await answerCallbackQuerySafe(ctx, { text: 'Lens not ready yet', show_alert: true });
        return;
      }
      const longUrl = lens.kind === 'online' ? lensRegistry.onlineUrl(code, lens.expiresAt) : lensRegistry.longUrl(code, lens.expiresAt);
      let shortUrl = lens.shortCode ? lensRegistry.shortUrl(lens.shortCode) : undefined;
      if (!shortUrl) {
        const { shortCode } = lensRegistry.ensureShort(longUrl);
        lens.shortCode = shortCode;
        shortUrl = lensRegistry.shortUrl(shortCode);
      }

      const firstShort = mode === 'short' && !!shortUrl;
      const heading = lens.kind === 'online' ? 'Online Lens 🎯' : 'Lens 🎯';
      const lines: string[] = [
        `${heading}: ${lens.name}`,
        `Code 🔑: ${lens.code}`,
        `Status: ${lens.groupId ? (lensRegistry.isExpired(lens.code) ? 'Expired ⌛️' : 'Active ✅') : 'Not connected 🚫'}`,
        lens.groupId ? 'Group 👥: Connected' : 'Group 👥: Not connected',
        `Expiry ⏳: ${new Date(lens.expiresAt).toLocaleString()}`,
        `Remaining ⌛️: ${fmtRemaining(lens.expiresAt - Date.now())}`,
        '',
      ];
      if (firstShort && shortUrl) {
        lines.push(`Short 🔗: ${shortUrl}`);
      } else {
        lines.push(`Long 🔗: ${longUrl}`);
      }
      const text = lines.join('\n');
      await answerCallbackQuerySafe(ctx);
      await sendOrUpdate(ctx, text, detailKeyboard(code, firstShort ? 'short' : 'long', longUrl, shortUrl, lens.kind || 'camera'));
      return;
    }

    await next();
  });

  // Cancel flow: return to menu without welcome
  composer.callbackQuery(CANCEL, async (ctx) => {
    ctx.session.creating = undefined;
    await answerCallbackQuerySafe(ctx);
    await sendOrUpdate(ctx, 'Back to the main menu ✨ Pick an option below to continue:', startKeyboard());
  });

  // Help content
  composer.callbackQuery(HELP, async (ctx) => {
    await answerCallbackQuerySafe(ctx);
    const msg = [
      'Help 📖',
      '1️⃣ Create a Lens and note the code.',
      '2️⃣ Add @MoriLensbot to your group as admin.',
      '3️⃣ Send /connect <CODE> in the group.',
      '4️⃣ Choose expiry, open the link, tap screen to send photos.',
      '',
      'Need more help? Contact @ItsGhostBlink',
    ].join('\n');
    const kb = new InlineKeyboard()
      .url('Contact Support', 'https://t.me/ItsGhostBlink')
      .row()
      .text('Create New Lens', START_CREATE)
      .text('Create Online Lens', START_CREATE_ONLINE)
      .row()
      .text('My Lens', START_LIST)
      .text('Back', CANCEL);
    await sendOrUpdate(ctx, msg, kb);
  });
}

export function createStartKeyboard() {
  return startKeyboard();
}

