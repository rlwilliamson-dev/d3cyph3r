// D3CYPH3R requires a physical keyboard for the terminal-input model to
// work, so we hard-block mobile devices with a fake boot-fail screen
// rather than serving a broken UI.

export function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      || window.innerWidth < 900;
}

const LINES = [
  "[ 0.000 ] Booting D3CYPH3R kernel...",
  "[ 0.142 ] Initializing terminal interface...",
  "[ 0.287 ] Checking input devices...",
  "[ 0.391 ] Keyboard: NOT DETECTED",
  "[ 0.472 ] Verifying display resolution...",
  "[ 0.558 ] Resolution: UNSUPPORTED",
  "[ 0.663 ] Device classification: MOBILE",
  "[ 0.801 ] Applying compatibility layer...",
  "[ 0.944 ] ERROR: Compatibility layer failed",
  "",
  ">> ACCESS DENIED",
  ">> DEVICE NOT SUPPORTED",
  ">> KEYBOARD REQUIRED",
  "",
  ">> ⚠ D3CYPH3R is desktop-only.",
  ">> Use a laptop/PC for the full experience.",
];

export function renderMobileGate() {
  document.body.innerHTML = `
    <div id="boot-screen" style="
      background:#020f09;
      color:#00ff9c;
      font-family: 'Share Tech Mono', monospace;
      padding: 24px;
      padding-top: 30vh;
      height:100vh;
      display:flex;
      flex-direction:column;
      justify-content:flex-start;
    "></div>`;

  const container = document.getElementById("boot-screen");
  let i = 0;
  (function typeLine() {
    if (i >= LINES.length) return;
    const line = document.createElement("div");
    line.style.opacity = "0";
    line.style.transition = "opacity 0.2s ease";
    line.textContent = LINES[i++];
    container.appendChild(line);
    setTimeout(() => { line.style.opacity = "1"; }, 20);
    setTimeout(typeLine, 120);
  })();
}
