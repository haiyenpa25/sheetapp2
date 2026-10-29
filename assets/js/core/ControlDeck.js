/**
 * assets/js/core/ControlDeck.js — Nút "ủy quyền" cho Dải điều khiển luôn hiện (Modern + Classic, mọi cỡ màn hình)
 *
 * Dải điều khiển phải luôn có: Tông, Gốc, Hợp âm, Zoom + Khóa, Lời/Sheet, BPM, Ký hiệu, Gọn nhẹ, Cuộn, Soạn hợp âm.
 * Phần lớn đã có sẵn nhưng nằm trong menu ⋮; thay vì viết lại logic, nút trên dải khai báo
 * `data-deck-target="<selector nút gốc>"` và module này:
 *   1. bấm nút ủy quyền → bấm nút gốc (không bấm khi gốc đang disabled);
 *   2. phản chiếu trạng thái của nút gốc: class `active` (+ aria-pressed), `disabled`;
 *   3. đích bị ẩn (class hidden/deck-hidden, ví dụ nút Soạn khi tài khoản không được sửa) → nút ủy quyền cũng ẩn
 *      bằng class `deck-hidden`;
 *   4. `data-deck-label="<selector>"`: chép chữ nhãn của đích vào phần tử con `[data-deck-text]`.
 *
 * Phụ thuộc: không (DOM thuần). Public API: { init, refresh }
 */
const ControlDeck = (() => {
  'use strict';

  const PROXY_SELECTOR = '[data-deck-target]';
  const OBSERVED_ATTRIBUTES = ['class', 'disabled', 'aria-pressed', 'style', 'hidden'];
  const HIDDEN_CLASS = 'deck-hidden';
  const _bound = new WeakSet();

  function _target(proxy) {
    return document.querySelector(proxy.dataset.deckTarget);
  }

  function _isTargetHidden(target) {
    return target.classList.contains('hidden') || target.classList.contains(HIDDEN_CLASS) || target.hidden;
  }

  function _sync(proxy) {
    const target = _target(proxy);
    if (!target) return;
    const active = target.classList.contains('active');
    proxy.classList.toggle('active', active);
    if (proxy.dataset.deckToggle !== undefined) proxy.setAttribute('aria-pressed', String(active));
    proxy.disabled = Boolean(target.disabled);
    proxy.classList.toggle(HIDDEN_CLASS, _isTargetHidden(target));

    const labelSelector = proxy.dataset.deckLabel;
    const textEl = proxy.querySelector('[data-deck-text]');
    const source = labelSelector ? document.querySelector(labelSelector) : null;
    if (textEl && source) textEl.textContent = (source.textContent || '').trim();
  }

  function _bind(proxy) {
    if (_bound.has(proxy)) return;
    const target = _target(proxy);
    if (!target) return; // đích chưa có: refresh() sẽ thử lại sau
    _bound.add(proxy);

    proxy.addEventListener('click', (event) => {
      event.preventDefault();
      const current = _target(proxy);
      if (current && !current.disabled) current.click();
      _sync(proxy);
    });
    new MutationObserver(() => _sync(proxy)).observe(target, {
      attributes: true, attributeFilter: OBSERVED_ATTRIBUTES, childList: true, subtree: true, characterData: true,
    });
    _sync(proxy);
  }

  /** Quét lại mọi nút ủy quyền (gọi khi DOM đổi hoặc bài mới nạp xong). */
  function refresh() {
    document.querySelectorAll(PROXY_SELECTOR).forEach((proxy) => { _bind(proxy); _sync(proxy); });
  }

  function init() {
    refresh();
    window.EventBus?.on?.('song:loaded', refresh);
    window.EventBus?.on?.('state:changed', refresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { init, refresh };
})();

window.ControlDeck = ControlDeck;
