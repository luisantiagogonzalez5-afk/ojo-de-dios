/**
 * Cursor-retícula + paralaje del HUD — adaptado (no copiado) de Awwwards
 * Pack › Mouse Effects #10 (Kingston, Components): la misma técnica de
 * `lerp` por capa con distinto factor de suavizado, pero aplicada a las
 * tarjetas del HUD (profundidad sutil) y a una retícula de puntería propia,
 * en vez de a una estela de imágenes. Todo con pointer-events:none — el
 * globo Cesium sigue recibiendo el ratón sin estorbo.
 */
const lerp = (a, b, n) => (1 - n) * a + n * b;
const map = (x, a, b, c, d) => ((x - a) * (d - c)) / (b - a) + c;

export function installCursor() {
  const ret = document.getElementById('v-reticle');
  const layers = [...document.querySelectorAll('[data-parallax]')];
  if (!ret) return () => {};

  let win = { w: window.innerWidth, h: window.innerHeight };
  let cur = { x: win.w / 2, y: win.h / 2 };
  const ring = { x: cur.x, y: cur.y };
  const dot = { x: cur.x, y: cur.y };
  const depth = layers.map(() => ({ x: 0, y: 0 }));
  let raf = 0;
  let hot = false;

  const onResize = () => { win = { w: window.innerWidth, h: window.innerHeight }; };
  const onMove = (e) => { cur = { x: e.clientX, y: e.clientY }; };
  const onOver = (e) => { hot = Boolean(e.target.closest('button, a, [role="button"], .v-lp-row')); };
  const onDown = () => ret.classList.add('is-down');
  const onUp = () => ret.classList.remove('is-down');

  function render() {
    // Punto rápido, anillo perezoso — la retícula "persigue" al cursor.
    dot.x = lerp(dot.x, cur.x, 0.35); dot.y = lerp(dot.y, cur.y, 0.35);
    ring.x = lerp(ring.x, cur.x, 0.14); ring.y = lerp(ring.y, cur.y, 0.14);
    ret.style.setProperty('--dx', `${dot.x}px`);
    ret.style.setProperty('--dy', `${dot.y}px`);
    ret.style.setProperty('--rx', `${ring.x}px`);
    ret.style.setProperty('--ry', `${ring.y}px`);
    ret.classList.toggle('is-hot', hot);

    layers.forEach((el, i) => {
      const amt = Number(el.dataset.parallax) || 6;
      const ease = 0.05 + i * 0.012;
      depth[i].x = lerp(depth[i].x, map(cur.x, 0, win.w, -amt, amt), ease);
      depth[i].y = lerp(depth[i].y, map(cur.y, 0, win.h, -amt, amt), ease);
      el.style.transform = `translate3d(${depth[i].x.toFixed(2)}px, ${depth[i].y.toFixed(2)}px, 0)`;
    });
    raf = requestAnimationFrame(render);
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseover', onOver, { passive: true });
  window.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  raf = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseover', onOver);
    window.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
  };
}
