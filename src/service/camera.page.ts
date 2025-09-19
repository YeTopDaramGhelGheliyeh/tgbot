export function renderCameraPage(code: string): string {
  const safeCode = String(code).replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>MoriLens</title>
    <style>
      :root { --glass: rgba(0,0,0,.45); --border: rgba(255,255,255,.2); --hint-h: 52px; }
      html, body { margin:0; padding:0; height:100%; background:#000; color:#fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial; }
      .wrap { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
      video, canvas { max-width:100vw; max-height:100vh; width:100vw; height:100vh; object-fit:cover; background:#000; }
      .toast { position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,.75); padding:12px 16px; border-radius:8px; font-size:14px; display:none; }
      .topbar { position:fixed; left:0; right:0; top:0; display:flex; align-items:center; justify-content:space-between; padding:8px; pointer-events:auto; z-index:10; }
      .topbar.bottom { top:auto; bottom: calc(var(--hint-h) + 8px); }
      .btn { background:var(--glass); color:#fff; border:1px solid var(--border); border-radius:50%; width:48px; height:48px; display:flex; align-items:center; justify-content:center; padding:0; font-size:22px; line-height:1; cursor:pointer; backdrop-filter: blur(6px); }
      .btn:active { transform: scale(0.98); }
      .cluster { display:flex; gap:8px; align-items:center; }
      .center { text-align:center; flex:1; font-size:12px; opacity:.85; }
      .hint { position:fixed; left:0; right:0; bottom:0; height:var(--hint-h); display:flex; align-items:center; justify-content:center; padding:0 16px; background:rgba(0,0,0,.5); font-size:14px; text-align:center; z-index:1; }
      .expired { position:fixed; inset:0; display:none; align-items:center; justify-content:center; text-align:center; padding:24px; background:rgba(0,0,0,.6); font-size:clamp(22px,6vw,48px); z-index:20; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <video id="v" autoplay playsinline muted></video>
      <canvas id="c" style="display:none"></canvas>
    </div>
    <div class="topbar" id="topbar">
      <div class="cluster left">
        <button class="btn" id="posBtn" title="Move toolbar">⇅</button>
      </div>
      <div class="center" id="expiry">Expires: --</div>
      <div class="cluster right">
        <button class="btn" id="flipBtn" title="Flip camera">⟳</button>
      </div>
    </div>
    <div class="hint">Tap anywhere to capture and send a frame to your group.</div>
    <div class="expired" id="expired">Link expired :(</div>
    <div class="toast" id="toast">Sent</div>
    <script>
      const code = ${JSON.stringify(safeCode)};
      const video = document.getElementById('v');
      const canvas = document.getElementById('c');
      const toast = document.getElementById('toast');
      const flipBtn = document.getElementById('flipBtn');
      const posBtn = document.getElementById('posBtn');
      const topbar = document.getElementById('topbar');
      const expiryEl = document.getElementById('expiry');
      const expiredEl = document.getElementById('expired');

      let facing = 'environment';
      let streamRef = null;

      function getExpiryMs() {
        const p = new URLSearchParams(location.search);
        const exp = Number(p.get('exp'));
        return Number.isFinite(exp) ? exp : undefined;
      }

      let isExpired = false;

      function renderExpiry() {
        const exp = getExpiryMs();
        if (!exp) { expiryEl.textContent = 'Expires: --'; return; }
        const ms = exp - Date.now();
        if (ms <= 0) {
          expiryEl.textContent = 'Expired';
          if (!isExpired) {
            isExpired = true;
            try { if (streamRef) streamRef.getTracks().forEach(function(t){ t.stop(); }); } catch (e) {}
            expiredEl.style.display = 'flex';
          }
          return;
        }
        if (isExpired) {
          isExpired = false;
          expiredEl.style.display = 'none';
        }
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        expiryEl.textContent = 'Expires in ' + h + 'h ' + m + 'm ' + s + 's';
      }

      setInterval(renderExpiry, 1000);
      renderExpiry();

      async function startCamera() {
        try {
          if (streamRef) {
            try { streamRef.getTracks().forEach(function(t){ t.stop(); }); } catch (e) {}
          }
          if (isExpired) return;
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          streamRef = stream;
          video.srcObject = stream;
          try { await video.play(); } catch (e) {}
        } catch (e) {
          alert('Camera access denied. Please allow camera permission.');
        }
      }

      flipBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        facing = facing === 'environment' ? 'user' : 'environment';
        startCamera();
      });

      posBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        topbar.classList.toggle('bottom');
      });

      function showToast() {
        toast.style.display = 'block';
        setTimeout(function(){ toast.style.display = 'none'; }, 1200);
      }

      async function sendFrame() {
        const vw = video.videoWidth || window.innerWidth;
        const vh = video.videoHeight || window.innerHeight;
        canvas.width = vw; canvas.height = vh;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, vw, vh);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        try {
          const res = await fetch('/api/lens/' + encodeURIComponent(code) + '/shoot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: data })
          });
          if (res.ok) {
            showToast();
          } else {
            const t = await res.text();
            alert('Failed to send: ' + t);
          }
        } catch (err) {
          alert('Network error. Please try again.');
        }
      }

      window.addEventListener('click', function(e) {
        // avoid clicks on UI controls triggering capture
        if (isExpired) return;
        var path = e.composedPath ? e.composedPath() : [];
        if ((path && (path.indexOf(flipBtn) >= 0 || path.indexOf(posBtn) >= 0 || path.indexOf(topbar) >= 0)) || (topbar.contains && topbar.contains(e.target))) {
          return;
        }
        sendFrame();
      });
      window.addEventListener('touchend', function(e) {
        if (isExpired) return;
        var target = e.target;
        if (target === flipBtn || target === posBtn || (topbar.contains && topbar.contains(target))) return;
        e.preventDefault(); sendFrame();
      }, { passive: false });

      startCamera();
    </script>
  </body>
  </html>`;
}
