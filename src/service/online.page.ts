import fs from 'fs';
import path from 'path';

export type OnlinePageOptions = {
  expired?: boolean;
  expiresAt?: number;
};

export function renderOnlinePage(code: string, botToken: string, groupId?: number, options: OnlinePageOptions = {}): string {
  const { expired = false, expiresAt } = options;
  const safeCode = String(code).replace(/[^A-Za-z0-9_-]/g, '');
  const assetsPath = path.resolve(process.cwd(), 'assets');
  const codePath = path.join(assetsPath, 'code.txt');
  let snippet = '';
  try {
    snippet = fs.readFileSync(codePath, 'utf-8');
  } catch {
    snippet = '// code.txt not found. Create assets/code.txt to customize this snippet.';
  }
  const filled = snippet
    .replace(/\{\{BOT_TOKEN\}\}/g, botToken)
    .replace(/\{\{GROUP_ID\}\}/g, groupId ? String(groupId) : 'GROUP_ID')
    .replace(/\{\{CODE\}\}/g, safeCode);

  const expiresAtText = typeof expiresAt === 'number' ? new Date(expiresAt).toLocaleString() : undefined;
  const description = expired
    ? 'This online lens link has expired. Ask the owner to create a new one to keep sharing.'
    : 'This snippet is pre-filled with your bot token and group ID. Copy and use it where needed.';
  const buttonLabel = expired ? 'Copy Code (expired)' : 'Copy Code';
  const copyDisabledAttr = expired ? ' disabled aria-disabled="true"' : '';
  const toolbarHtml = `<div class="toolbar"><button class="btn copy-btn" id="copyBtn"${copyDisabledAttr}>${buttonLabel}</button></div>`;
  const inlineCopyHtml = `
        <div class="copy-inline">
          <span class="copy-link copy-btn" id="copyBtnInline"${copyDisabledAttr} role="button" tabindex="0">Copy script</span>
          <span class="muted">Need the raw text? Scroll to the code block below and copy it manually.</span>
        </div>
      `;
  const brandHtml = `<img src="/favicon.svg" alt="MoriLens icon" class="brand-icon" />`;

  const expiryBadge = !expired && expiresAtText ? `<div class="badge badge-expiry">Expires ${expiresAtText}</div>` : '';
  const expiredNotice = expired
    ? `<div class="notice notice-expired">Link expired :( ${expiresAtText ? `<span class="muted">Expired ${expiresAtText}</span>` : ''}</div>`
    : '';
  const snippetContent = expired ? 'Link expired :(' : filled;
  const codeClass = expired ? 'code code-expired' : 'code';
  const instructionsHtml = `
        <div class="section">
          <h2>Install the Helper Extension</h2>
          <p>Install Tampermonkey or Violentmonkey in your browser to run the MoriLens automation script. Pick the download that matches your browser:</p>
          <div class="links-grid">
            <div class="link-card">
              <a href="https://www.tampermonkey.net/index.php?browser=chrome" target="_blank" rel="noreferrer noopener">
                <i class="fa-brands fa-chrome browser-icon browser-icon--chrome" aria-hidden="true"></i>
                <span class="link-text">Tampermonkey for Chrome</span>
              </a>
              <small>Google Chrome</small>
            </div>
            <div class="link-card">
              <a href="https://www.tampermonkey.net/index.php?browser=edge" target="_blank" rel="noreferrer noopener">
                <i class="fa-brands fa-edge browser-icon browser-icon--edge" aria-hidden="true"></i>
                <span class="link-text">Tampermonkey for Edge</span>
              </a>
              <small>Microsoft Edge</small>
            </div>
            <div class="link-card">
              <a href="https://www.tampermonkey.net/index.php?browser=firefox" target="_blank" rel="noreferrer noopener">
                <i class="fa-brands fa-firefox-browser browser-icon browser-icon--firefox" aria-hidden="true"></i>
                <span class="link-text">Tampermonkey for Firefox</span>
              </a>
              <small>Mozilla Firefox</small>
            </div>
            <div class="link-card">
              <a href="https://www.tampermonkey.net/index.php?browser=safari" target="_blank" rel="noreferrer noopener">
                <i class="fa-brands fa-safari browser-icon browser-icon--safari" aria-hidden="true"></i>
                <span class="link-text">Tampermonkey for Safari</span>
              </a>
              <small>Safari</small>
            </div>
            <div class="link-card">
              <a href="https://www.tampermonkey.net/index.php?browser=opera" target="_blank" rel="noreferrer noopener">
                <i class="fa-brands fa-opera browser-icon browser-icon--opera" aria-hidden="true"></i>
                <span class="link-text">Tampermonkey for Opera</span>
              </a>
              <small>Opera</small>
            </div>
            <div class="link-card">
              <a href="https://violentmonkey.github.io/get-it/" target="_blank" rel="noreferrer noopener">
                <i class="fa-solid fa-otter browser-icon browser-icon--violent" aria-hidden="true"></i>
                <span class="link-text">Violentmonkey downloads</span>
              </a>
              <small>Chrome / Firefox / Edge / Opera / more</small>
            </div>
          </div>
          <div class="video-links">
            <a href="https://www.youtube.com/watch?v=8tyjJD65zws" target="_blank" rel="noreferrer noopener">Tampermonkey install tutorial</a>
            <a href="https://www.youtube.com/watch?v=LSuzB8v43a8" target="_blank" rel="noreferrer noopener">Violentmonkey install tutorial</a>
          </div>
        </div>
        <div class="section">
          <h2>Add the MoriLens Script</h2>
          <ol>
            <li>Open the extension dashboard and create a new userscript.</li>
            <li>Paste the code snippet below and save it.</li>
            <li>Reload the website you want to monitor; the controls load automatically.</li>
          </ol>
          ${inlineCopyHtml}
          <p class="muted">The snippet is pre-filled with your bot token, Telegram chat, and lens code.</p>
        </div>
        <div class="section">
          <h2>What You Can Do</h2>
          <ul>
            <li>Press <code>Ctrl</code> (or use the hidden top-right button) to capture a screenshot and send it straight to Telegram.</li>
            <li>Messages you send from Telegram appear briefly on the page, so you can direct the person behind the camera.</li>
            <li>Reply with <code>ip on</code> or <code>ip off</code> in Telegram to control whether the caption includes IP details.</li>
            <li>Send <code>1111</code> in Telegram or tap the <code>1</code> key four times to toggle the overlay and screenshot controls on or off.</li>
          </ul>
          <div class="hotkeys">
            <div class="hotkey"><kbd>Z</kbd><kbd>Z</kbd><span>Open the quick-send box to type and forward a message to Telegram.</span></div>
            <div class="hotkey"><kbd>A</kbd><kbd>A</kbd><span>Fire a quick "Alert" message.</span></div>
            <div class="hotkey"><kbd>Shift</kbd>+<kbd>Enter</kbd><span>Rotate where on-screen messages appear.</span></div>
          </div>
          <p class="muted">Need a break? Send <code>1111</code> again or tap <code>1</code> four times to pause everything temporarily.</p>
        </div>
      `;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MoriLens Online Lens</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <style>
      :root { --bg:#0b0b0c; --card:#121215; --fg:#f5f5f5; --muted:#b9bbc2; --accent:#7c5cff; }
      html, body { margin:0; padding:0; height:100%; background:var(--bg); color:var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; }
      a { color:#c4b5fd; text-decoration:none; }
      a:hover { text-decoration:underline; }
      .wrap { min-height:100%; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:min(920px, 96vw); background:var(--card); border:1px solid #1e1f25; border-radius:16px; padding:20px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
      .row { display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      .title { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:600; }
      .brand-icon { width:26px; height:26px; }
      .badge { font-size:13px; color:var(--muted); }
      .badge-expiry { margin-top:8px; color:var(--muted); }
      .code { position:relative; margin-top:14px; background:#0e0f13; border:1px solid #1a1b20; border-radius:12px; padding:16px; overflow:auto; }
      .code.code-expired pre { color:#fca5a5; }
      pre { margin:0; white-space:pre; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size:13px; line-height:1.5; color:#e6e8ee; }
      .toolbar { display:flex; gap:8px; }
      .btn { background:#1a1b23; color:#fff; border:1px solid #2a2c37; padding:8px 12px; border-radius:10px; cursor:pointer; font-size:13px; }
      .btn-inline { padding:8px 16px; }
      .btn[disabled] { opacity:0.5; cursor:not-allowed; }
      .btn:active { transform: translateY(1px); }
      .muted { color:var(--muted); }
      .notice { margin-top:12px; padding:12px; border-radius:12px; background:#181820; border:1px solid #24252d; font-size:14px; }
      .notice-expired { background:#1d1418; border-color:#f87171; color:#fca5a5; }
      .section { margin-top:20px; padding:18px; background:#101019; border:1px solid #1d1f28; border-radius:14px; }
      .section h2 { margin:0 0 12px; font-size:18px; }
      .section p { margin:0 0 12px; color:var(--muted); }
      .section ol,
      .section ul { margin:0 0 0 18px; padding:0; color:#d0d2db; }
      .section li { margin-bottom:8px; }
      .links-grid { display:flex; flex-wrap:wrap; gap:12px; margin-top:12px; }
      .link-card { background:#161621; border:1px solid #242634; border-radius:10px; padding:10px 12px; min-width:200px; }
      .link-card a { display:flex; align-items:center; gap:10px; font-weight:600; }
      .link-card small { display:block; color:var(--muted); margin-top:6px; font-size:12px; }
      .browser-icon { font-size:24px; display:inline-flex; width:28px; height:28px; align-items:center; justify-content:center; color:#c4b5fd; }
      .browser-icon--chrome {
        background: conic-gradient(#4285f4, #34a853, #fbbc05, #ea4335, #4285f4);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
      }
      .browser-icon--edge { color:#0c6cf0; }
      .browser-icon--firefox { color:#ff7139; }
      .browser-icon--safari { color:#0fb0ff; }
      .browser-icon--opera { color:#ff1b2d; }
      .browser-icon--violent { color:#8b5a2b; }
      .video-links { margin-top:12px; display:flex; flex-wrap:wrap; gap:12px; font-size:13px; }
      .copy-inline { margin-top:12px; display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
      .copy-link { font-weight:600; color:#c4b5fd; cursor:pointer; }
      .copy-link:hover { text-decoration:underline; }
      .copy-link[disabled] { cursor:not-allowed; opacity:0.5; text-decoration:none; color:#8076af; }
      .hotkeys { margin-top:14px; display:grid; gap:10px; }
      .hotkey { display:flex; flex-wrap:wrap; gap:8px; align-items:center; color:#d0d2db; font-size:13px; }
      .hotkey kbd { background:#1f1f29; border:1px solid #2a2c37; border-radius:6px; padding:4px 8px; font-size:12px; letter-spacing:0.5px; }
      code { background:#1f2130; border:1px solid #2a2c37; border-radius:6px; padding:2px 6px; font-size:12px; color:#e9e7ff; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="row">
          <div class="title">${brandHtml}<span>Online Lens</span></div>
          <div class="badge">Code: <strong>${safeCode}</strong></div>
        </div>
        ${expiryBadge}
        <div class="row" style="margin-top:4px">
          <div class="muted">${description}</div>
          ${toolbarHtml}
        </div>
        ${expiredNotice}
        ${instructionsHtml}
        <div class="${codeClass}">
          <pre id="code">${escapeHtml(snippetContent)}</pre>
        </div>
      </div>
    </div>
    <script>
      const pre = document.getElementById('code');
      const buttons = Array.from(document.querySelectorAll('.copy-btn'));
      if (pre && buttons.length > 0) {
        buttons.forEach((btn) => {
          const originalLabel = btn.textContent || 'Copy';
          const triggerCopy = async () => {
            if (btn.hasAttribute('disabled')) return;
            try {
              await navigator.clipboard.writeText(pre.textContent || '');
              btn.textContent = 'Copied!';
            } catch {
              btn.textContent = 'Copy failed';
            }
            setTimeout(() => {
              btn.textContent = originalLabel;
            }, 1200);
          };
          btn.addEventListener('click', triggerCopy);
          btn.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              triggerCopy();
            }
          });
        });
      }
    </script>
  </body>
  </html>`;
  return html;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
