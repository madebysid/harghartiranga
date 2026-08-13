/* ============================================================================
   Coach — the walkthrough. One bubble at a time, anchored to the actual element
   it is talking about, with a tail pointing at it and a pulsing ring around the
   thing to press.

   Why this rather than a line of text under each control: a static hint has to
   be read and then matched to a control, and people skip that. A ring drawn on
   the target does the matching for them, and it moves with the page.

   The whole overlay is pointer-events: none apart from the dismiss button, so it
   can never sit between somebody and the button they are trying to press — which
   is the usual way a product tour breaks the product.
   ========================================================================== */

window.Coach = (() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const GAP = 14;      // between the target and the bubble's near edge
  const EDGE = 10;     // keep the bubble this far off the viewport sides
  const RING_PAD = 6;  // how far the ring stands off the target

  let root, bubble, chip, textEl, subEl, tail, ring;
  let step = null;     // { target, on, handler, place }
  let built = false;

  function build() {
    if (built) return;
    built = true;

    root = document.createElement('div');
    root.className = 'coach';
    root.hidden = true;

    ring = document.createElement('div');
    ring.className = 'coach__ring';

    bubble = document.createElement('div');
    bubble.className = 'coach__bubble';
    /* Announced as a live region: the sighted cue is a ring somewhere on screen,
       which is worth nothing to a screen reader, and the app already narrates
       phases through #announce. */
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-live', 'polite');

    tail = document.createElement('span');
    tail.className = 'coach__tail';

    chip = document.createElement('span');
    chip.className = 'coach__chip';

    textEl = document.createElement('p');
    textEl.className = 'coach__text';

    subEl = document.createElement('p');
    subEl.className = 'coach__sub';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'coach__close';
    close.setAttribute('aria-label', 'Hide the walkthrough');
    close.textContent = '×';
    close.addEventListener('click', () => hide({ done: true }));

    bubble.append(tail, chip, textEl, subEl, close);
    root.append(ring, bubble);
    document.body.appendChild(root);
  }

  /** Lay the ring over the target and hang the bubble off it. */
  function place() {
    if (!step) return;

    const r = step.target.getBoundingClientRect();
    if (!r.width && !r.height) { root.dataset.off = ''; return; }

    /* Scrolled past: keep tracking, but do not point at something nobody can
       see — a bubble clamped to the edge with a tail aimed at nothing reads as
       a bug. */
    const off = r.bottom < 8 || r.top > innerHeight - 8;
    if (off) { root.dataset.off = ''; return; }
    delete root.dataset.off;

    const radius = getComputedStyle(step.target).borderRadius;
    ring.style.left = `${r.left - RING_PAD}px`;
    ring.style.top = `${r.top - RING_PAD}px`;
    ring.style.width = `${r.width + RING_PAD * 2}px`;
    ring.style.height = `${r.height + RING_PAD * 2}px`;
    ring.style.borderRadius = radius && radius !== '0px' ? `calc(${radius} + ${RING_PAD}px)` : '999px';

    const bw = bubble.offsetWidth;
    const bh = bubble.offsetHeight;

    /* Preferred side first, then beside the target, then the other side. Beside
       comes before the flip because on a desktop the button sits at the left of
       a wide column with nothing to its right, while flipping upward there lands
       the bubble across the headline. */
    const order = step.place === 'above'
      ? ['above', 'right', 'below']
      : ['below', 'right', 'above'];
    const fits = {
      below: r.bottom + GAP + bh <= innerHeight - EDGE,
      above: r.top - GAP - bh >= EDGE,
      right: r.right + GAP + bw <= innerWidth - EDGE,
    };
    const mode = order.find((m) => fits[m]) || order[0];
    bubble.dataset.place = mode;

    if (mode === 'right') {
      const y = Math.max(EDGE, Math.min(r.top + r.height / 2 - bh / 2, innerHeight - bh - EDGE));
      bubble.style.left = `${r.right + GAP}px`;
      bubble.style.top = `${y}px`;
      tail.style.left = '-5px';
      tail.style.top = `${Math.max(16, Math.min(r.top + r.height / 2 - y, bh - 16))}px`;
      return;
    }

    const x = Math.max(EDGE, Math.min(r.left + r.width / 2 - bw / 2, innerWidth - bw - EDGE));
    bubble.style.left = `${x}px`;
    bubble.style.top = `${mode === 'below' ? r.bottom + GAP : r.top - GAP - bh}px`;

    /* The tail tracks the target's centre even when the bubble has been clamped
       sideways, so it still points at the button rather than at the middle of
       itself. */
    tail.style.top = '';
    tail.style.left = `${Math.max(16, Math.min(r.left + r.width / 2 - x, bw - 16))}px`;
  }

  /* One rAF per burst of scroll/resize events rather than one per event. */
  let queued = false;
  function reflow() {
    if (queued || !step) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; place(); });
  }

  function detach() {
    if (step?.handler) step.target.removeEventListener(step.on, step.handler);
    step = null;
  }

  function hide({ done = false } = {}) {
    if (!built || !step) return;
    detach();
    root.hidden = true;
    if (done) dismissed = true;
  }

  /* Pressing the × means "stop telling me what to do", so nothing points again
     for the rest of the visit. */
  let dismissed = false;

  /**
   * Point at one element.
   *
   * @param {{target:HTMLElement, text:string, sub?:string, chip?:string,
   *          place?:'above'|'below', on?:string}} spec
   *        `on` is the event on the target that means the step is finished —
   *        'click' for a button, 'input' for the name box, so the bubble clears
   *        itself the moment somebody starts doing the thing.
   */
  function point(spec) {
    if (dismissed || !spec?.target) return;
    build();

    detach();
    step = { target: spec.target, place: spec.place || 'below', on: spec.on || 'click' };

    chip.textContent = spec.chip || '';
    chip.hidden = !spec.chip;
    textEl.textContent = spec.text;
    subEl.textContent = spec.sub || '';
    subEl.hidden = !spec.sub;

    step.handler = () => hide();
    step.target.addEventListener(step.on, step.handler, { once: true });

    root.hidden = false;
    /* Restart the pop-in on every new step, otherwise the second bubble simply
       appears where the first one left off. */
    bubble.classList.remove('is-in');
    void bubble.offsetWidth;
    bubble.classList.add('is-in');

    place();
    /* Fonts and the certificate landing can change the target's box after the
       first measure, so measure again on the next frame. */
    requestAnimationFrame(place);
  }

  addEventListener('scroll', reflow, { passive: true });
  addEventListener('resize', reflow);
  /* The bubble sits over animated UI; anything that moves its target — the
     certificate appearing, a step being revealed — settles within a frame or
     two of a transition ending. */
  addEventListener('transitionend', reflow, true);

  if (!reduced.matches) document.fonts?.ready.then(reflow);

  return { point, hide, get dismissed() { return dismissed; } };
})();
