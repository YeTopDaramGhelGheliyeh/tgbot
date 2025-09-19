import fs from 'fs';
import path from 'path';

export function renderOnlinePage(code: string, botToken: string, groupId?: number): string {
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

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MoriLens Online Lens</title>
    <style>
      :root { --bg:#0b0b0c; --card:#121215; --fg:#f5f5f5; --muted:#b9bbc2; --accent:#7c5cff; }
      html, body { margin:0; padding:0; height:100%; background:var(--bg); color:var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; }
      .wrap { min-height:100%; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:min(920px, 96vw); background:var(--card); border:1px solid #1e1f25; border-radius:16px; padding:20px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
      .row { display:flex; gap:16px; align-items:center; justify-content:space-between; flex-wrap:wrap; }
      .badge { font-size:13px; color:var(--muted); }
      .code { position:relative; margin-top:14px; background:#0e0f13; border:1px solid #1a1b20; border-radius:12px; padding:16px; overflow:auto; }
      pre { margin:0; white-space:pre; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size:13px; line-height:1.5; color:#e6e8ee; }
      .toolbar { display:flex; gap:8px; }
      .btn { background:#1a1b23; color:#fff; border:1px solid #2a2c37; padding:8px 12px; border-radius:10px; cursor:pointer; font-size:13px; }
      .btn:active { transform: translateY(1px); }
      .title { font-size:16px; font-weight:600; }
      .muted { color:var(--muted); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="row">
          <div class="title">Online Lens</div>
          <div class="badge">Code: <strong>${safeCode}</strong></div>
        </div>
        <div class="row" style="margin-top:4px">
          <div class="muted">This snippet is pre-filled with your bot token and group ID. Copy and use it where needed.</div>
          <div class="toolbar">
            <button class="btn" id="copyBtn">Copy Code</button>
          </div>
        </div>
        <div class="code">
          <pre id="code">${escapeHtml(filled)}</pre>
        </div>
      </div>
    </div>
    <script>
      const btn = document.getElementById('copyBtn');
      const pre = document.getElementById('code');
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(pre.textContent || '');
          btn.textContent = 'Copied!';
          setTimeout(()=> btn.textContent='Copy Code', 1200);
        } catch {
          btn.textContent = 'Copy failed';
          setTimeout(()=> btn.textContent='Copy Code', 1200);
        }
      });
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

