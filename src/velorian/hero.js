/**
 * Hero de arranque — adaptado (no copiado) de Awwwards Pack › Hero
 * Animations #9 (Kingston, Components 2). Cambios respecto al original:
 *  - El fondo que se "abre" con clip-path no es una foto: es el globo Cesium
 *    vivo (#world), así que el reveal aterriza sobre el planeta girando.
 *  - Sin SplitText ni CustomEase (plugins): partidor de letras propio y el
 *    ease "hop" (0.9,0,0.1,1) aproximado con expo.inOut del núcleo de GSAP.
 *  - El contador no es decorativo: avanza con el arranque real del motor y
 *    solo cierra al 100 cuando Cesium ya está listo.
 *
 * Uso: const hero = createHero(); hero.markEngineReady(); hero.reveal();
 */
const gsap = window.gsap;

function splitChars(el) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  for (const ch of text) {
    const wrap = document.createElement('span');
    wrap.className = 'v-char-mask';
    const inner = document.createElement('span');
    inner.className = 'v-char';
    inner.textContent = ch === ' ' ? ' ' : ch;
    wrap.appendChild(inner);
    el.appendChild(wrap);
    chars.push(inner);
  }
  return chars;
}

function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  const out = [];
  words.forEach((w, i) => {
    const wrap = document.createElement('span');
    wrap.className = 'v-word-mask';
    const inner = document.createElement('span');
    inner.className = 'v-word';
    inner.textContent = w;
    wrap.appendChild(inner);
    el.appendChild(wrap);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    out.push(inner);
  });
  return out;
}

export function createHero() {
  const root = document.getElementById('v-hero');
  const counterEl = root.querySelector('.v-counter');
  const progressEl = root.querySelector('.v-progress');
  const titleEl = document.querySelector('.v-title');
  const tagEls = document.querySelectorAll('.v-tag');
  const world = document.getElementById('world');

  const titleChars = splitChars(titleEl);
  const tagWords = [...tagEls].flatMap(splitWords);

  const counter = { value: 0 };
  let engineReady = false;
  let resolveReady;
  const readyPromise = new Promise((r) => { resolveReady = r; });
  const paint = () => { counterEl.textContent = String(Math.floor(counter.value)).padStart(3, '0'); };

  // Fase 1 — el contador sube con calma hasta 92 y ahí espera al motor.
  const tl = gsap.timeline();
  tl.to(counter, { value: 92, duration: 2.6, ease: 'power3.out', onUpdate: paint });
  tl.to(root.querySelector('.v-counter-wrap'), { scale: 1, duration: 2.6, ease: 'power3.out' }, '<');
  tl.to(progressEl, { scaleX: 0.92, duration: 2.6, ease: 'power3.out' }, '<');
  tl.add(() => { if (engineReady) resolveReady(); });

  function markEngineReady() {
    engineReady = true;
    if (tl.progress() === 1) resolveReady();
  }

  async function reveal() {
    await readyPromise;
    const out = gsap.timeline();
    out.to(counter, { value: 100, duration: 0.5, ease: 'power2.out', onUpdate: paint });
    out.to(progressEl, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, '<');
    // Apertura: cuadro chico al centro → pantalla completa, con zoom-out.
    out.to(world, {
      clipPath: 'polygon(38% 38%, 62% 38%, 62% 62%, 38% 62%)',
      duration: 1.2, ease: 'expo.inOut',
    }, '+=0.35');
    out.fromTo(world, { scale: 1.35 }, { scale: 1.18, duration: 1.2, ease: 'expo.inOut' }, '<');
    out.to(root.querySelector('.v-counter-wrap'), { opacity: 0, y: -20, duration: 0.6, ease: 'power2.in' }, '<0.3');
    out.to(world, {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      duration: 1.6, ease: 'expo.inOut',
    }, '+=0.1');
    out.to(world, { scale: 1, duration: 1.6, ease: 'expo.inOut' }, '<');
    out.to(root, { opacity: 0, duration: 0.5, ease: 'power2.out' }, '<0.9');
    out.to(titleChars, { x: '0%', duration: 1, ease: 'power4.out', stagger: 0.05 }, '<0.2');
    out.to(tagWords, { y: '0%', duration: 0.9, ease: 'power4.out', stagger: 0.06 }, '<0.35');
    out.to('.v-hud', { opacity: 1, duration: 1.2, ease: 'power2.out', stagger: 0.08 }, '<0.2');
    out.add(() => {
      root.remove();
      world.style.clipPath = '';
      world.style.transform = '';
      document.body.classList.add('v-ready');
    });
    return out;
  }

  function fail(message) {
    tl.kill();
    root.classList.add('v-failed');
    counterEl.textContent = 'ERR';
    root.querySelector('.loader-status').textContent = message;
  }

  return { markEngineReady, reveal, fail, ready: () => readyPromise };
}
