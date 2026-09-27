// Drifting dust and ash motes, lit by unseen torchlight.

export function startMotes(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let width = 0;
  let height = 0;
  let motes = [];

  const spawn = (anywhere) => ({
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : height + 8,
    r: 0.4 + Math.random() * 1.5,
    vx: (Math.random() - 0.5) * 0.12,
    vy: -(0.04 + Math.random() * 0.22),
    phase: Math.random() * Math.PI * 2,
    alpha: 0.12 + Math.random() * 0.45,
  });

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(24, Math.min(110, Math.round((width * height) / 16000)));
    motes = Array.from({ length: count }, () => spawn(true));
  };

  const tick = () => {
    if (!document.hidden) {
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        m.phase += 0.012;
        m.x += m.vx + Math.sin(m.phase) * 0.12;
        m.y += m.vy;
        if (m.y < -8 || m.x < -8 || m.x > width + 8) Object.assign(m, spawn(false));
        // Brighter near the bottom, where the torchlight is.
        const light = 0.35 + 0.65 * (m.y / height);
        ctx.fillStyle = `rgba(255, 186, 118, ${m.alpha * light * (0.75 + 0.25 * Math.sin(m.phase * 3))})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  };

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(tick);
}
