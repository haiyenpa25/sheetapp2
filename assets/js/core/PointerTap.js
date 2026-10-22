/** Activate on a stationary release, leaving native scrolling and pinch gestures intact. */
window.PointerTap = {
  bind(element, activate) {
    let start = null, moved = false, suppressClick = false;
    element.addEventListener('pointerdown', event => {
      event.stopPropagation();
      if (event.button !== 0 || event.isPrimary === false) { start = null; return; }
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
      moved = false; suppressClick = false;
    });
    element.addEventListener('pointermove', event => {
      if (start && event.pointerId === start.id && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) moved = true;
    });
    element.addEventListener('pointercancel', () => { start = null; suppressClick = true; });
    element.addEventListener('pointerup', event => {
      event.stopPropagation();
      const tap = start && event.pointerId === start.id && !moved
        && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 8;
      start = null; suppressClick = true;
      if (tap) activate(event);
    });
    element.addEventListener('click', event => {
      event.stopPropagation();
      if (event.detail === 0 || !suppressClick) activate(event);
      suppressClick = false;
    });
  }
};
