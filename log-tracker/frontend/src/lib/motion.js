// Thin GSAP wrappers so components don't import gsap directly and the
// motion vocabulary stays consistent (calm: short, power-ease, no bounce).
import { gsap } from 'gsap';

export const enter = (el, { y = 10, delay = 0, duration = 0.42 } = {}) =>
  el && gsap.from(el, { opacity: 0, y, duration, delay, ease: 'power2.out', clearProps: 'opacity,transform' });

export const stagger = (els, { y = 10, delay = 0 } = {}) =>
  els && els.length &&
  gsap.from(els, {
    opacity: 0, y, duration: 0.42, ease: 'power2.out', stagger: 0.055, delay,
    clearProps: 'opacity,transform',
  });

// height 0 <-> natural, opacity fade. Used by the History panel.
export function collapse(el, open) {
  if (!el) return;
  gsap.killTweensOf(el);
  if (open) {
    gsap.set(el, { display: '', height: 'auto' });
    const h = el.offsetHeight;
    gsap.set(el, { overflow: 'hidden' });
    gsap.fromTo(
      el,
      { height: 0, opacity: 0 },
      {
        height: h, opacity: 1, duration: 0.3, ease: 'power2.inOut',
        onComplete: () => gsap.set(el, { height: 'auto', overflow: 'visible' }),
      },
    );
  } else {
    gsap.set(el, { overflow: 'hidden' });
    gsap.to(el, {
      height: 0, opacity: 0, duration: 0.3, ease: 'power2.inOut',
      onComplete: () => gsap.set(el, { display: 'none' }),
    });
  }
}

export function countTo(node, to) {
  if (!node) return;
  const from = node.__cv ?? (parseInt(String(node.textContent).replace(/\D/g, ''), 10) || 0);
  if (from === to) {
    node.__cv = to;
    node.textContent = String(to);
    return;
  }
  const o = node.__cvo || (node.__cvo = { v: from });
  o.v = from;
  gsap.killTweensOf(o);
  gsap.to(o, {
    v: to,
    duration: 0.34,
    ease: 'power1.out',
    onUpdate: () => {
      node.__cv = o.v;
      node.textContent = String(Math.round(o.v));
    },
    onComplete: () => {
      node.__cv = to;
    },
  });
}

// Slide the highlight pill inside a <Segmented>.
export function movePill(seg) {
  if (!seg) return;
  const pill = seg.querySelector('[data-pill]');
  const on = seg.querySelector('[aria-selected="true"]');
  if (!pill) return;
  if (!on) {
    gsap.set(pill, { opacity: 0 });
    return;
  }
  const sr = seg.getBoundingClientRect();
  const br = on.getBoundingClientRect();
  const x = br.left - sr.left - 3;
  const w = br.width;
  const cur = Number(gsap.getProperty(pill, 'opacity'));
  if (!cur) {
    gsap.set(pill, { x, width: w, opacity: 1 });
  } else {
    gsap.to(pill, { x, width: w, opacity: 1, duration: 0.24, ease: 'power3.out' });
  }
}
