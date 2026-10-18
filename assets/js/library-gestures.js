// Click remains the sole activation event, including keyboard/assistive clicks.
const LibraryGestures = (() => {
  'use strict';
  const MAX_DISTANCE = 10;
  const MAX_DURATION = 500;

  function bind(element, activate) {
    if (!element) return;
    let gesture = null;
    element.addEventListener('pointerdown', event => {
      if (gesture && !event.isPrimary) { gesture.cancelled = true; return; }
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
        started: performance.now(), cancelled: event.isPrimary === false || event.button > 0,
        target: event.target };
    }, { passive: true });
    const track = event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MAX_DISTANCE) gesture.cancelled = true;
    };
    element.addEventListener('pointermove', track, { passive: true });
    element.addEventListener('pointerup', event => {
      track(event);
      if (gesture && event.pointerId === gesture.id) gesture.duration = performance.now() - gesture.started;
    }, { passive: true });
    element.addEventListener('pointercancel', () => { if (gesture) gesture.cancelled = true; }, { passive: true });
    element.addEventListener('click', event => {
      const previous = gesture;
      gesture = null;
      // detail=0 is a keyboard/programmatic activation and has no touch duration.
      if (event.detail !== 0 && previous && (previous.cancelled ||
          (previous.duration ?? performance.now() - previous.started) > MAX_DURATION ||
          !element.contains(previous.target))) return;
      activate(event);
    });
  }

  return { bind };
})();
window.LibraryGestures = LibraryGestures;
