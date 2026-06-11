/* ============================================================
   Axiom — interaction engine
   Scroll-driven animations, canvas hero background, SVG track,
   pricing toggle, magnetic buttons, spotlight cards, lazy images.
   No dependencies. Honors prefers-reduced-motion.
   ============================================================ */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ============================================================
   1. Unified scroll loop
   One rAF loop reads scroll position once per frame and fans it
   out to subscribers — no layout thrash, no per-listener jank.
   ============================================================ */
const scrollSubscribers = [];
let lastY = -1;
let ticking = false;

function onFrame() {
  ticking = false;
  const y = window.scrollY;
  for (const fn of scrollSubscribers) fn(y);
  lastY = y;
}

function requestTick() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(onFrame);
  }
}

window.addEventListener('scroll', requestTick, { passive: true });
window.addEventListener('resize', requestTick, { passive: true });

/* ============================================================
   2. Scroll progress bar
   ============================================================ */
const progressBar = document.getElementById('scroll-progress-bar');
scrollSubscribers.push((y) => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
});

/* ============================================================
   3. Navigation — shrink on scroll, hide on scroll-down,
      mobile menu, scrollspy
   ============================================================ */
const nav = document.getElementById('site-nav');
const navLinks = document.getElementById('nav-links');
const burger = document.getElementById('nav-burger');

scrollSubscribers.push((y) => {
  nav.classList.toggle('is-scrolled', y > 24);
  // Hide when scrolling down past the hero, reveal on any upward scroll
  const goingDown = y > lastY && lastY >= 0;
  nav.classList.toggle('is-hidden', goingDown && y > window.innerHeight * 0.8 && !navLinks.classList.contains('is-open'));
});

burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('is-open');
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});

navLinks.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    navLinks.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
});

// Scrollspy: highlight the nav link of the section in view
const spyTargets = [...document.querySelectorAll('.nav-link[href^="#"]')]
  .map((link) => ({ link, section: document.querySelector(link.getAttribute('href')) }))
  .filter((x) => x.section);

const spy = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const { link, section } of spyTargets) {
      link.classList.toggle('is-active', section === entry.target);
    }
  }
}, { rootMargin: '-40% 0px -55% 0px' });
spyTargets.forEach(({ section }) => spy.observe(section));

/* ============================================================
   4. Hero — scroll progress custom property + aurora parallax
   The CSS consumes --hero-progress for content drift/fade and
   the grid shift; the aurora blobs get per-depth transforms.
   ============================================================ */
const hero = document.getElementById('hero');
const auroraBlobs = [...document.querySelectorAll('.aurora-blob')];

scrollSubscribers.push((y) => {
  const progress = clamp(y / (hero.offsetHeight * 0.9), 0, 1);
  document.documentElement.style.setProperty('--hero-progress', progress.toFixed(4));
  if (reducedMotion) return;
  for (const blob of auroraBlobs) {
    const depth = parseFloat(blob.dataset.depth || '0.2');
    // Parallax drift + slow hue rotation as the page scrolls
    blob.style.transform = `translateY(${y * depth}px)`;
    blob.style.filter = `hue-rotate(${progress * 55}deg)`;
  }
});

/* ============================================================
   5. Hero canvas — particle constellation
   Particles drift, link when close, react to the pointer, and
   the whole field tints + slows as you scroll away. Pauses
   entirely when the hero leaves the viewport.
   ============================================================ */
(function heroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || reducedMotion) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, h = 0;
  let particles = [];
  let running = false;
  let rafId = 0;
  const pointer = { x: -9999, y: -9999 };

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = clamp(Math.round((w * h) / 16000), 36, 110);
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 0.8 + Math.random() * 1.6,
    }));
  }

  function frame() {
    if (!running) return;
    const heroProgress = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--hero-progress')
    ) || 0;
    // Field slows down and dims as the user scrolls past the hero
    const energy = 1 - heroProgress * 0.7;
    const hueShift = heroProgress * 60;

    ctx.clearRect(0, 0, w, h);

    const LINK = 120;
    for (const p of particles) {
      p.x += p.vx * energy;
      p.y += p.vy * energy;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;

      // Gentle pointer attraction
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 32400 && d2 > 1) {
        const d = Math.sqrt(d2);
        p.x += (dx / d) * 0.45 * energy;
        p.y += (dy / d) * 0.45 * energy;
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < LINK) {
          const alpha = (1 - dist / LINK) * 0.32 * energy;
          ctx.strokeStyle = `hsla(${252 + hueShift}, 90%, 72%, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    for (const p of particles) {
      ctx.fillStyle = `hsla(${200 + hueShift}, 95%, 78%, ${0.8 * energy})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  new IntersectionObserver(([entry]) => {
    entry.isIntersecting ? start() : stop();
  }).observe(canvas);

  window.addEventListener('resize', resize, { passive: true });
  if (finePointer) {
    hero.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    });
    hero.addEventListener('pointerleave', () => {
      pointer.x = -9999;
      pointer.y = -9999;
    });
  }

  resize();
  start();
})();

/* ============================================================
   6. Hero title — split into words for staggered entrance
   ============================================================ */
(function splitTitle() {
  const title = document.getElementById('hero-title');
  if (!title || reducedMotion) return;
  let wordIndex = 0;
  const wrap = (node) => {
    const outer = document.createElement('span');
    outer.className = 'w';
    const inner = document.createElement('span');
    inner.style.setProperty('--wd', `${0.08 + wordIndex * 0.07}s`);
    inner.appendChild(node);
    outer.appendChild(inner);
    wordIndex++;
    return outer;
  };
  [...title.childNodes].forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(' '));
        else if (part) frag.appendChild(wrap(document.createTextNode(part)));
      }
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Keep gradient phrases (<em>) intact — splitting them into
      // inline-block words breaks background-clip: text.
      const outer = wrap(document.createTextNode(''));
      node.replaceWith(outer);
      outer.firstChild.appendChild(node);
    }
  });
})();

/* ============================================================
   7. Reveal-on-scroll
   Single IntersectionObserver; [data-reveal-stagger] containers
   hand their children sequential delays automatically.
   ============================================================ */
(function reveals() {
  // Assign stagger delays before observing
  document.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
    [...group.querySelectorAll(':scope > [data-reveal], :scope > * > [data-reveal]')]
      .forEach((el, i) => el.style.setProperty('--reveal-delay', `${i * 0.09}s`));
  });

  const targets = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el) => io.observe(el));
})();

/* ============================================================
   8. Journey — SVG path drawn by scroll, dot rides the path,
      step cards light up as the line reaches them
   ============================================================ */
(function journey() {
  const track = document.getElementById('journey-track');
  const path = document.getElementById('journey-path');
  const dot = document.getElementById('journey-dot');
  const dotGlow = document.getElementById('journey-dot-glow');
  if (!track || !path) return;

  const steps = [...track.querySelectorAll('.journey-step')];
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;

  let progress = 0;        // eased value actually rendered
  let target = 0;          // raw value from scroll
  let animating = false;

  function render() {
    // Smooth chase so fast scrolling still draws fluidly
    progress = Math.abs(target - progress) < 0.0005 ? target : lerp(progress, target, 0.12);

    path.style.strokeDashoffset = `${length * (1 - progress)}`;
    const pt = path.getPointAtLength(length * progress);
    dot.setAttribute('cx', pt.x);
    dot.setAttribute('cy', pt.y);
    dotGlow.setAttribute('cx', pt.x);
    dotGlow.setAttribute('cy', pt.y);

    let current = null;
    for (const step of steps) {
      const at = parseFloat(step.dataset.stepAt || '0');
      const passed = progress >= at;
      step.classList.toggle('is-passed', passed);
      if (passed) current = step;
    }
    steps.forEach((s) => s.classList.toggle('is-current', s === current));

    if (progress !== target) {
      requestAnimationFrame(render);
    } else {
      animating = false;
    }
  }

  scrollSubscribers.push(() => {
    const rect = track.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 when the track top hits 75% of the viewport, 1 when its bottom passes 35%
    const total = rect.height - vh * 0.4;
    target = clamp((vh * 0.75 - rect.top) / Math.max(total, 1), 0, 1);

    if (reducedMotion) {
      progress = target;
      path.style.strokeDashoffset = `${length * (1 - progress)}`;
      steps.forEach((s) => s.classList.toggle('is-passed', progress >= parseFloat(s.dataset.stepAt || '0')));
      return;
    }
    if (!animating) {
      animating = true;
      requestAnimationFrame(render);
    }
  });
})();

/* ============================================================
   9. Animated counters
   ============================================================ */
(function counters() {
  const els = document.querySelectorAll('.counter');
  if (!els.length) return;

  const compactFmt = new Intl.NumberFormat('en', { notation: 'compact' });
  const intFmt = new Intl.NumberFormat('en');

  function format(value, kind) {
    if (kind === 'compact') return compactFmt.format(Math.round(value));
    if (kind === 'decimal2') return value.toFixed(2);
    return intFmt.format(Math.round(value));
  }

  function animate(el) {
    const end = parseFloat(el.dataset.count);
    const kind = el.dataset.format || 'int';
    if (reducedMotion) {
      el.textContent = format(end, kind);
      return;
    }
    const dur = 1600;
    const t0 = performance.now();
    (function tick(now) {
      const t = clamp((now - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = format(end * eased, kind);
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        animate(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
})();

/* ============================================================
   10. Pricing toggle — monthly / annual
   ============================================================ */
(function pricing() {
  const switchEl = document.getElementById('billing-switch');
  if (!switchEl) return;
  const labels = {
    monthly: document.getElementById('label-monthly'),
    annual: document.getElementById('label-annual'),
  };
  const amounts = [...document.querySelectorAll('.plan-amount')];
  const notes = [...document.querySelectorAll('.plan-billnote')];
  let billing = 'monthly';

  function apply(next) {
    if (next === billing) return;
    billing = next;
    const annual = billing === 'annual';

    switchEl.setAttribute('aria-checked', String(annual));
    switchEl.setAttribute('aria-label', `Switch to ${annual ? 'monthly' : 'annual'} billing`);
    labels.monthly.classList.toggle('is-active', !annual);
    labels.annual.classList.toggle('is-active', annual);

    for (const el of amounts) {
      const value = el.dataset[billing];
      if (reducedMotion) {
        el.textContent = value;
        continue;
      }
      el.classList.remove('is-flipping');
      // restart the flip animation, swapping the number mid-flight
      void el.offsetWidth;
      el.classList.add('is-flipping');
      setTimeout(() => { el.textContent = value; }, 240);
    }
    for (const note of notes) {
      note.textContent = annual ? note.dataset.annualText : note.dataset.monthlyText;
      note.classList.toggle('is-annual', annual);
    }
  }

  switchEl.addEventListener('click', () => apply(billing === 'monthly' ? 'annual' : 'monthly'));
  labels.monthly.addEventListener('click', () => apply('monthly'));
  labels.annual.addEventListener('click', () => apply('annual'));
})();

/* ============================================================
   11. Magnetic buttons — pull gently toward the cursor
   ============================================================ */
(function magnetic() {
  if (!finePointer || reducedMotion) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = 0.22;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1)';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 500);
    });
  });
})();

/* ============================================================
   12. Spotlight cards — gradient follows the cursor
   ============================================================ */
(function spotlight() {
  if (!finePointer) return;
  document.querySelectorAll('.spotlight').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
})();

/* ============================================================
   13. Hero visual 3D tilt + glare
   ============================================================ */
(function tilt() {
  const el = document.getElementById('hero-tilt');
  if (!el || !finePointer || reducedMotion) return;
  const MAX = 7; // degrees

  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transform =
      `rotateX(${((0.5 - py) * MAX).toFixed(2)}deg) rotateY(${((px - 0.5) * MAX).toFixed(2)}deg)`;
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
  });
  el.addEventListener('pointerleave', () => {
    el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
    el.style.transform = '';
    setTimeout(() => { el.style.transition = ''; }, 600);
  });
})();

/* ============================================================
   14. Lazy images — swap data-src in as they approach
   ============================================================ */
(function lazyImages() {
  const imgs = document.querySelectorAll('img[data-src]');
  if (!imgs.length) return;

  function load(img) {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    if (img.complete) {
      img.classList.add('is-loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    }
  }

  if (!('IntersectionObserver' in window)) {
    imgs.forEach(load);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        load(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, { rootMargin: '300px 0px' });
  imgs.forEach((img) => io.observe(img));
})();

/* ============================================================
   Kick everything once on load so the page renders correctly
   at any initial scroll position (e.g. after a refresh).
   ============================================================ */
requestTick();
