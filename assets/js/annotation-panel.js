/* Shared controls, detail list and native accessible editor dialog. No network here. */
window.AnnotationPanel = (() => {
  'use strict';
  let root, body, actions, state, dialog, opener;
  let open = false;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, parent) {
    const node = element('button', text, 'ano-control'); node.type = 'button';
    node.addEventListener('click', action); parent.append(node); return node;
  }
  function init(callbacks) {
    if (root) return;
    actions = callbacks;
    root = element('section', undefined, 'instrument-annotations'); root.id = 'instrument-annotations';
    const toggle = button('Ghi chú nhạc cụ', () => {
      open = !open; toggle.setAttribute('aria-expanded', String(open)); body.hidden = !open;
      if (open) actions.activate();
    }, root);
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'annotation-panel-body');
    body = element('div'); body.id = 'annotation-panel-body'; body.hidden = true; root.append(body);
    document.getElementById('sheet-area')?.before(root);
  }
  function show(noteId) {
    open = true; body.hidden = false;
    root.firstElementChild.setAttribute('aria-expanded', 'true'); actions.activate();
    if (noteId) window.requestAnimationFrame(() => {
      const item = Array.from(body.querySelectorAll('[data-annotation-id]')).find(node => node.dataset.annotationId === noteId);
      if (item) { item.tabIndex = -1; item.scrollIntoView({ block: 'center' }); item.focus({ preventScroll: true }); }
    });
  }
  function render(next) {
    if (!root) return;
    state = next; root.hidden = !state.songId;
    const focusKey = body.contains(document.activeElement) ? document.activeElement.dataset.focusKey : '';
    body.replaceChildren();
    const status = element('p', state.error || (state.loading ? 'Đang tải ghi chú…' : 'Chọn lớp ghi chú muốn xem. Khi thiếu chỗ, nhãn trên sheet thu gọn thành ✎; chạm để đọc đầy đủ.'));
    status.setAttribute('role', state.error ? 'alert' : 'status'); body.append(status);
    button(state.error ? 'Thử tải lại' : 'Tải lại ghi chú', () => actions.reload(), body);
    if (!state.loaded) return;
    const filters = element('fieldset'); filters.append(element('legend', 'Nhạc cụ hiển thị'));
    state.instruments.forEach(instrument => {
      const label = element('label'), input = element('input'); input.type = 'checkbox';
      input.checked = state.selected === null || state.selected.includes(instrument.id);
      input.dataset.focusKey = instrument.id;
      input.addEventListener('change', () => actions.filter(instrument.id, input.checked));
      const count = state.notes.filter(note => note.instrumentId === instrument.id).length;
      label.append(input, document.createTextNode(`${instrument.name} (${count})`)); filters.append(label);
    });
    body.append(filters);
    const controls = element('div', undefined, 'ano-controls'); body.append(controls);
    button('Chọn tất cả', () => actions.filterAll(true), controls);
    button('Ẩn tất cả', () => actions.filterAll(false), controls);
    if (state.admin) renderAdmin(controls);
    const list = element('ul', undefined, 'ano-detail-list'); body.append(list);
    const visible = state.notes.filter(note => state.selected === null || state.selected.includes(note.instrumentId));
    if (!visible.length) list.append(element('li', state.notes.length ? 'Các lớp đang chọn chưa có ghi chú.' : 'Bài này chưa có ghi chú.'));
    visible.forEach(note => renderNote(note, list));
    if (focusKey) Array.from(body.querySelectorAll('[data-focus-key]')).find(node => node.dataset.focusKey === focusKey)?.focus({ preventScroll: true });
  }
  function selectInstrument(value, labelText) {
    const label = element('label', labelText), select = element('select');
    state.instruments.forEach(item => { const option = element('option', item.name); option.value = item.id; select.append(option); });
    select.value = value; label.append(select); return { label, select };
  }
  function renderAdmin(controls) {
    button(state.editing ? 'Kết thúc soạn' : 'Soạn ghi chú', () => actions.edit(!state.editing), controls);
    const { label, select } = selectInstrument(state.instrumentId, 'Nhạc cụ đang soạn');
    select.disabled = state.saving;
    select.addEventListener('change', () => actions.instrument(select.value)); body.append(label);
    if (state.editing) body.append(element('p', state.relocating ? 'Chọn dấu + để đặt lại ghi chú đang chọn.' : 'Chạm dấu + tại nốt để thêm ghi chú. Có thể thêm nhiều ghi chú cùng vị trí.'));
    const form = element('form', undefined, 'ano-controls');
    const nameLabel = element('label', 'Nhạc cụ mới'), input = element('input'); input.maxLength = 40; input.required = true;
    nameLabel.append(input); form.append(nameLabel);
    const submit = button('Thêm nhạc cụ', () => {}, form); submit.type = 'submit';
    const error = element('span'); error.setAttribute('role', 'alert'); form.append(error);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { await actions.createInstrument(input.value); } catch (e) { error.textContent = e.message; }
      finally { submit.disabled = false; }
    }); body.append(form);
  }
  function renderNote(note, list) {
    const item = element('li'); item.dataset.annotationId = note.id;
    const name = state.instruments.find(instrument => instrument.id === note.instrumentId)?.name || note.instrumentId;
    item.append(element('strong', `${name} · Ô ${note.measureIdx + 1} · Khuông ${(note.staffIdx || 0) + 1}`), element('p', `${note.icon || ''} ${note.text}`.trim()));
    if (state.unplaced.includes(note.id)) item.append(element('p', 'Cần kiểm tra vị trí: bản nhạc đã thay đổi hoặc chưa tìm thấy điểm gắn.', 'ano-warning'));
    if (state.admin) {
      button('Sửa', () => actions.openEditor(note), item).dataset.action = 'edit';
      button('Đặt lại vị trí', () => actions.relocate(note), item);
    }
    list.append(item);
  }
  function closeEditor() {
    if (!dialog) return;
    dialog.close(); dialog.remove(); dialog = null;
    (opener?.isConnected ? opener : root?.firstElementChild)?.focus({ preventScroll: true });
  }
  function editor(note) {
    closeEditor(); opener = document.activeElement;
    const pop = element('dialog', undefined, 'ano-editor'); dialog = pop;
    const title = element('h2', note.id ? 'Sửa ghi chú' : 'Thêm ghi chú'); title.id = 'ano-editor-title';
    pop.setAttribute('aria-labelledby', title.id); pop.append(title);
    const { label, select } = selectInstrument(note.instrumentId, 'Nhạc cụ'); pop.append(label);
    const textLabel = element('label', 'Nội dung ghi chú'), text = element('textarea'); text.maxLength = 500; text.rows = 4;
    text.value = note.text || ''; textLabel.append(text); pop.append(textLabel);
    const error = element('p'); error.setAttribute('role', 'alert'); pop.append(error);
    const controls = element('div', undefined, 'ano-controls'); pop.append(controls);
    const submit = async remove => {
      if (!remove && !text.value.trim()) { error.textContent = 'Hãy nhập nội dung ghi chú.'; text.focus(); return; }
      pop.querySelectorAll('button,select,textarea').forEach(node => { node.disabled = true; });
      try {
        await actions.save({ ...note, instrumentId: select.value, text: text.value.trim() }, remove);
        if (dialog === pop) closeEditor();
      } catch (e) { error.textContent = e.message; }
      finally { pop.querySelectorAll('button,select,textarea').forEach(node => { node.disabled = false; }); }
    };
    button('Lưu ghi chú', () => submit(false), controls);
    if (note.id) button('Xóa ghi chú', () => submit(true), controls);
    button('Hủy', closeEditor, controls);
    button('Tải lại dữ liệu', () => actions.reload(), controls);
    pop.addEventListener('cancel', event => { if (state.saving) event.preventDefault(); });
    pop.addEventListener('close', () => { if (dialog === pop) closeEditor(); });
    document.body.append(pop); pop.showModal(); text.focus();
  }
  return { init, render, show, editor, closeEditor, isOpen: () => open };
})();
