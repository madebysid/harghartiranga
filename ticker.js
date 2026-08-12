/* ============================================================================
   Ticker — one requestAnimationFrame loop shared by everything that animates.

   The cloth and the confetti both need a frame callback. Giving each its own
   rAF loop means two callbacks competing in the same frame and two independent
   clocks; one loop keeps them on the same timestamp and lets the browser idle
   completely when nothing is moving.
   ========================================================================== */

window.Ticker = (() => {
  const jobs = new Set();
  let running = false;
  let last = 0;

  function frame(now) {
    if (!jobs.size) { running = false; return; }
    /* First frame after a pause has no meaningful delta, and a backgrounded tab
       can return a delta of many seconds. Clamp so physics never explodes. */
    const dt = last ? Math.min(now - last, 50) : 16.7;
    last = now;
    for (const job of jobs) job(now, dt);
    requestAnimationFrame(frame);
  }

  return {
    add(job) {
      jobs.add(job);
      if (!running) {
        running = true;
        last = 0;
        requestAnimationFrame(frame);
      }
    },
    remove(job) { jobs.delete(job); },
  };
})();
