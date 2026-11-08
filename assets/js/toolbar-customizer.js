/**
 * assets/js/toolbar-customizer.js
 * Cho người dùng ẩn các nút toolbar ít dùng (giao diện Modern và Classic dùng chung file này).
 * - Ẩn bằng CSS (display:none) nên nút vẫn nằm trong DOM: phím tắt và module khác không bị hỏng.
 * - Lưu theo thiết bị (localStorage). Chỉ liệt kê nút thật sự có trong giao diện đang mở.
 * - Tự chèn mục "Tùy chỉnh thanh công cụ" vào menu ⋮ (#main-dropdown-menu), trước nút Trợ giúp.
 * Nút KHÔNG cho ẩn: Tuỳ Chọn ⋮ (cổng vào menu này) và nút mở danh sách bài.
 *
 * Phụ thuộc: không (độc lập, nạp sau toolbar). Public API: { init, getHidden, setHidden, reset, open, close }
 */
const ToolbarCustomizer = (() => {
  'use strict';

  const STORAGE_KEY = 'sheetapp.toolbar.hidden.v1';
  const STYLE_ID = 'toolbar-customizer-css';
  const MENU_ID = 'main-dropdown-menu';
  const MENU_ITEM_ID = 'btn-toolbar-customize';
  const DIALOG_ID = 'toolbar-customizer-dialog';

  // Mỗi mục: key ổn định (đã lưu trên máy người dùng, đừng đổi tên), nhãn, các selector (Modern + Classic + thanh ngón cái điện thoại).
  // Nút trùng id trong menu ⋮ được loại ra bằng selector có phạm vi (#toolbar-controls ...).
  const ITEMS = [
    { key: 'tone', label: 'Chỉnh tông (− / + / Gốc)', selectors: ['#btn-transpose-down', '#btn-transpose-up', '#btn-transpose-reset', '#btn-mobile-transpose-down', '#btn-mobile-transpose-up', '#btn-mobile-transpose-reset', '#mobile-transpose-display'] },
    { key: 'zoom', label: 'Phóng to / Thu nhỏ / Khóa zoom', selectors: ['#btn-zoom-out', '#btn-zoom-in', '#btn-lock-zoom', '#btn-mobile-lock-zoom'] },
    { key: 'tempo', label: 'Nhịp độ (BPM)', selectors: ['#btn-toolbar-tempo', '#toolbar-controls > #btn-toolbar-metronome', '#btn-mobile-tempo'] },
    { key: 'view', label: 'Chuyển Bản nhạc ↔ Lời', selectors: ['#btn-view-sheet', '#btn-view-lyrics', '#toolbar-controls #btn-lyric-view', '#btn-mobile-view-toggle'] },
    { key: 'notes', label: 'Ghi chú ban nhạc', selectors: ['#btn-toolbar-notes'] },
    { key: 'edit', label: 'Soạn hợp âm', selectors: ['#btn-add-chord-mode-bar', '#btn-toolbar-edit', '#btn-mobile-edit'] },
    { key: 'notation', label: 'Ký hiệu hợp âm', selectors: ['#btn-chord-notation', '#btn-toolbar-notation', '#btn-mobile-notation'] },
    { key: 'compact', label: 'Chế độ Gọn nhẹ', selectors: ['#btn-toolbar-compact', '#btn-mobile-compact'] },
    { key: 'scroll', label: 'Cuộn tự động', selectors: ['.scroll-pill', '#btn-toolbar-scroll', '#btn-mobile-scroll'] },
    { key: 'songnav', label: 'Bài trước / Bài sau', selectors: ['#btn-prev-song', '#btn-next-song'] },
    { key: 'fullscreen', label: 'Toàn màn hình', selectors: ['#btn-fullscreen'] },
    { key: 'follow', label: 'Theo ca trưởng', selectors: ['#btn-follow-leader'] },
  ];

  let _hidden = _load();
  let _lastFocus = null;

  // --- STORAGE ---
  function _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw.filter(k => ITEMS.some(i => i.key === k)) : []);
    } catch (e) { return new Set(); }
  }

  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([..._hidden])); } catch (e) { /* chế độ riêng tư: chỉ mất ghi nhớ */ }
  }

  // --- ÁP DỤNG ---
  function _applyCss() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    // Classic có luật `body #toolbar#toolbar #id { display: ... !important }` (control-deck.css) nên cần độ ưu tiên cao hơn:
    // mỗi :not(#x) cộng 1 bậc ID mà không đổi phạm vi khớp (các id giả này không tồn tại).
    const boost = ':not(#tc-x1):not(#tc-x2):not(#tc-x3):not(#tc-x4)';
    const rules = ITEMS.filter(i => _hidden.has(i.key)).map(i => i.selectors.map(s => s + boost).join(',\n') + ' { display: none !important; }');
    el.textContent = rules.join('\n');
  }

  function _isPresent(item) {
    return item.selectors.some(sel => document.querySelector(sel));
  }

  function getHidden() { return [..._hidden]; }

  function setHidden(key, hide) {
    if (!ITEMS.some(i => i.key === key)) return;
    if (hide) _hidden.add(key); else _hidden.delete(key);
    _save();
    _applyCss();
  }

  function reset() {
    _hidden = new Set();
    _save();
    _applyCss();
  }

  // --- HỘP THOẠI ---
  function _injectDialogStyle() {
    if (document.getElementById(DIALOG_ID + '-css')) return;
    const css = document.createElement('style');
    css.id = DIALOG_ID + '-css';
    css.textContent = `
      #${DIALOG_ID}{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.5)}
      #${DIALOG_ID} .tc-card{background:var(--bg-surface,var(--bg-card,#fff));color:var(--text-primary,#111);border:1px solid var(--border,rgba(128,128,128,.35));border-radius:14px;width:100%;max-width:420px;max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.4)}
      #${DIALOG_ID} .tc-head{padding:14px 16px 6px;font-weight:700;font-size:1rem}
      #${DIALOG_ID} .tc-hint{padding:0 16px 8px;font-size:.8rem;opacity:.75;line-height:1.4}
      #${DIALOG_ID} .tc-list{overflow:auto;padding:4px 8px;flex:1}
      #${DIALOG_ID} .tc-row{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 8px;border-radius:8px;cursor:pointer;touch-action:manipulation}
      #${DIALOG_ID} .tc-row:hover{background:rgba(128,128,128,.12)}
      #${DIALOG_ID} .tc-row input{width:20px;height:20px;flex:none}
      #${DIALOG_ID} .tc-foot{display:flex;gap:8px;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border,rgba(128,128,128,.35))}
      #${DIALOG_ID} .tc-foot button{min-height:40px;padding:0 14px;touch-action:manipulation}`;
    document.head.appendChild(css);
  }

  function _row(item) {
    const label = document.createElement('label');
    label.className = 'tc-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = !_hidden.has(item.key); // tick = đang HIỆN
    box.dataset.key = item.key;
    box.addEventListener('change', () => setHidden(item.key, !box.checked));
    label.append(box, document.createTextNode(item.label));
    return label;
  }

  function _button(text, className, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function close() {
    document.getElementById(DIALOG_ID)?.remove();
    document.removeEventListener('keydown', _onKey, true);
    _lastFocus?.focus?.();
  }

  function _onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  function open() {
    if (document.getElementById(DIALOG_ID)) return;
    _injectDialogStyle();
    _lastFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.id = DIALOG_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Tùy chỉnh thanh công cụ');
    const card = document.createElement('div');
    card.className = 'tc-card';
    const head = Object.assign(document.createElement('div'), { className: 'tc-head', textContent: 'Tùy chỉnh thanh công cụ' });
    const hint = Object.assign(document.createElement('div'), { className: 'tc-hint', textContent: 'Bỏ tick để ẩn nút không dùng. Cài đặt lưu riêng trên thiết bị này; phím tắt vẫn hoạt động.' });
    const list = Object.assign(document.createElement('div'), { className: 'tc-list' });
    ITEMS.filter(_isPresent).forEach(item => list.appendChild(_row(item)));
    const foot = document.createElement('div');
    foot.className = 'tc-foot';
    foot.append(
      _button('Khôi phục mặc định', 'btn btn-ghost btn-sm', () => { reset(); list.querySelectorAll('input').forEach(b => { b.checked = true; }); }),
      _button('Xong', 'btn btn-primary btn-sm', close)
    );
    card.append(head, hint, list, foot);
    wrap.appendChild(card);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    document.addEventListener('keydown', _onKey, true);
    list.querySelector('input')?.focus();
  }

  // --- MỤC MENU ---
  function _injectMenuItem() {
    if (document.getElementById(MENU_ITEM_ID)) return;
    const menu = document.getElementById(MENU_ID);
    const anchor = document.getElementById('btn-help');
    if (!menu || !anchor?.parentNode) return;
    const item = document.createElement('button');
    item.id = MENU_ITEM_ID;
    item.type = 'button';
    item.className = 'btn btn-ghost btn-sm btn-menu-item';
    item.title = 'Ẩn bớt các nút toolbar ít dùng';
    item.textContent = '⚙ Tùy chỉnh thanh công cụ';
    item.addEventListener('click', () => { menu.classList.add('hidden'); open(); });
    anchor.parentNode.insertBefore(item, anchor);
  }

  function init() {
    _applyCss();
    _injectMenuItem();
  }

  // Script nạp bằng `defer` (xem index.php) nên DOM đã dựng xong: áp CSS và chèn mục menu ngay, không cần chờ sự kiện
  // (chỉ app.js được phép lắng nghe sự kiện nạp tài liệu — luật M1-3).
  init();

  return { init, getHidden, setHidden, reset, open, close };
})();

window.ToolbarCustomizer = ToolbarCustomizer;
