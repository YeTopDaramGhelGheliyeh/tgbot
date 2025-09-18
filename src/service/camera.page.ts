export function renderCameraPage(code: string): string {
  const safeCode = String(code).replace(/[^A-Za-z0-9_-]/g, '');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>MoriLens</title>
    <style>
      html, body { margin:0; padding:0; height:100%; background:#000; color:#fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; }
      .wrap { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
      video, canvas { max-width:100vw; max-height:100vh; width:100vw; height:100vh; object-fit:cover; background:#000; }
      .hint { position:fixed; left:0; right:0; bottom:0; padding:12px 16px; background:rgba(0,0,0,.5); font-size:14px; text-align:center; }
      .badge { position:fixed; top:10px; right:10px; background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.2); border-radius:8px; padding:6px 10px; font-size:12px; }
      .toast { position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:rgba(0,0,0,.75); padding:12px 16px; border-radius:8px; font-size:14px; display:none; }
    </style>
  </head>
  <body>
    <div class="badge">MoriLens — ${safeCode}</div>
    <div class="wrap">
      <video id="v" autoplay playsinline muted></video>
      <canvas id="c" style="display:none"></canvas>
    </div>
    <div class="hint">Tap anywhere to capture and send a frame to your group.</div>
    <div class="toast" id="toast">Sent ✔</div>
    <script>
      const code = ${JSON.stringify(safeCode)};
      const video = document.getElementById('v');
      const canvas = document.getElementById('c');
      const toast = document.getElementById('toast');

      async function init() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
          video.srcObject = stream;
          try { await video.play(); } catch {}
        } catch (e) {
          alert('Camera access denied. Please allow camera permission.');
        }
      }

      function showToast() {
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 1200);
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

      window.addEventListener('click', sendFrame);
      window.addEventListener('touchend', (e) => { e.preventDefault(); sendFrame(); }, { passive: false });
      init();
    </script>
  </body>
  </html>`;
}
