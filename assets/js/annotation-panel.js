/* Shared controls, detail list and native accessible editor dialog. No network here. */
window.AnnotationPanel = (() => {
  'use strict';
  let root, body, actions, state, dialog, opener;
  let open = false;
  const colorDrafts = new Map();
  let instrumentNameDraft = '';
  const COLORS = { general: '#64748b', guitar: '#15803d', keyboard: '#1d4ed8', bass: '#7e22ce', drums: '#c2410c', vocals: '#be185d' };
  const PRESETS = {
    general: ['Nhẹ', 'Tăng dần', 'Ngắt', 'Vào lại'], drums: ['Fill', 'Vào điệu', 'Ngắt', 'Crash', 'Nhẹ', 'Tăng dần'],
    guitar: ['Quạt', 'Rải', 'Palm mute', 'Ngắt', 'Vào mạnh'], keyboard: ['Đệm nền', 'Rải', 'Giữ hợp âm', 'Dạo', 'Ngưng'],
    bass: ['Nốt gốc', 'Đi đều', 'Chạy nối', 'Ngắt', 'Vào lại'], vocals: ['Vào hát', 'Nhẹ', 'Mạnh', 'Lấy hơi', 'Ngắt']
  };
  function colorFor(id) {
    const color = state?.instruments.find(item => item.id === id)?.color;
    return /^#[0-9a-f]{6}$/i.test(color || '') ? color : COLORS[id] || '#0e7490';
  }
  function decorate(node, id, customColor) {
    node.style.setProperty('--instrument-color', colorFor(id));
    node.style.setProperty('--annotation-color', /^#[0-9a-f]{6}$/i.test(customColor || '') ? customColor : colorFor(id));
  }
  // Classic ẩn nút gốc trong thanh công cụ và mở bằng #btn-toolbar-notes: neo menu theo nút đang hiện.
  const anchor = () => (root.offsetParent ? root : document.getElementById('btn-toolbar-notes')) || root;
  function placeMenu() {
    const rect = anchor().getBoundingClientRect();
    body.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(420, window.innerWidth - 16) - 8))}px`;
    body.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 180))}px`;
    body.style.maxHeight = `${Math.max(160, window.innerHeight - parseFloat(body.style.top) - 12)}px`;
  }
  function setOpen(on) {
    open = on; root.firstElementChild.setAttribute('aria-expanded', String(on));
    body.hidden = !on;
    if (on) { placeMenu(); if (body.showPopover && !body.matches(':popover-open')) body.showPopover(); actions.activate(); }
    else if (body.hidePopover && body.matches(':popover-open')) body.hidePopover();
  }
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
    const toggle = button('Ghi chú', () => setOpen(!open), root);
    toggle.id = 'btn-instrument-annotations';
    toggle.textContent = '';
    toggle.setAttribute('aria-label', 'Ghi chú ban nhạc và nhạc cụ');
    toggle.insertAdjacentHTML('afterbegin', '<svg class="icon icon-xs ano-icon" aria-hidden="true"><use href="#icon-clipboard-list"/></svg><span class="ano-label">Ghi chú</span>');
    toggle.title = 'Ghi chú bài cho ban nhạc · ghi chú theo nhạc cụ trên bản nhạc';
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'annotation-panel-body');
    body = element('div', undefined, 'ano-menu'); body.id = 'annotation-panel-body'; body.hidden = true;
    body.setAttribute('popover', 'auto'); root.append(body);
    body.addEventListener('toggle', event => {
      if (event.newState === 'closed') { open = false; body.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
    });
    const toolbar = document.getElementById('toolbar');
    if (toolbar) toolbar.insertBefore(root, document.getElementById('toolbar-controls'));  else document.getElementById('sheet-area')?.before(root);
    window.addEventListener('resize', () => { if (open) placeMenu(); });
  }
  function show(noteId) {
    setOpen(true);
    if (noteId) window.requestAnimationFrame(() => {
      const item = Array.from(body.querySelectorAll('[data-annotation-id]')).find(node => node.dataset.annotationId === noteId);
      if (item) { item.tabIndex = -1; item.scrollIntoView({ block: 'center' }); item.focus({ preventScroll: true }); }
    });
  }
  const BAND_STYLES = ['Ballad', 'Slow', 'Slow rock', 'Pop', 'Valse', 'Boston', 'Bolero', 'Rumba', 'Chachacha', '6/8', 'Worship'];
  let bandEditing = false;
  function render(next) {
    if (!root) return;
    state = next; root.firstElementChild.disabled = !state.songId;
    root.firstElementChild.classList.toggle('active', state.editing); decorate(root.firstElementChild, state.instrumentId);
    // Chấm báo trên nút: bài có ghi chú chung/ghi chú nhạc cụ mà không tốn chỗ hiển thị
    const hasNotes = !!(state.bandNote || state.notes.length), proxy = document.getElementById('btn-toolbar-notes');
    root.firstElementChild.classList.toggle('ano-has-notes', hasNotes);
    proxy?.classList.toggle('ano-has-notes', hasNotes); proxy?.classList.toggle('active', !!state.editing);
    renderEditingBar();
    const focusKey = body.contains(document.activeElement) ? document.activeElement.dataset.focusKey : '';
    if (bandEditing && body.querySelector('.ano-band-form')) return; // không xóa form đang gõ
    body.replaceChildren();
    if (state.error || state.loading) {
      const status = element('p', state.error || 'Đang tải ghi chú…');
      status.setAttribute('role', state.error ? 'alert' : 'status'); body.append(status);
      if (state.error) button('Thử tải lại', () => actions.reload(), body);
    }
    if (!state.loaded) return;
    renderBand();
    renderLayers();
    if (state.admin) renderAdmin();
    const list = element('ul', undefined, 'ano-detail-list'); body.append(list);
    const visible = state.notes.filter(note => state.selected === null || state.selected.includes(note.instrumentId));
    if (!visible.length) list.append(element('li', state.notes.length ? 'Các nhạc cụ đang chọn chưa có ghi chú.' : 'Bài này chưa có ghi chú theo nhạc cụ.', 'ano-empty'));
    visible.forEach(note => renderNote(note, list));
    if (focusKey) Array.from(body.querySelectorAll('[data-focus-key]')).find(node => node.dataset.focusKey === focusKey)?.focus({ preventScroll: true });
  }
  let editingBar = null;
  /* Thanh nổi khi đang đặt dấu +: biết đang ghi cho nhạc cụ nào và thoát nhanh, không cần mở lại panel */
  function renderEditingBar() {
    if (!state.editing) { editingBar?.remove(); editingBar = null; return; }
    if (!editingBar) {
      editingBar = element('div', undefined, 'ano-editing-bar'); editingBar.id = 'ano-editing-bar'; editingBar.setAttribute('role', 'status');
      document.body.append(editingBar);
    }
    editingBar.replaceChildren();
    const name = state.instruments.find(item => item.id === state.instrumentId)?.name || state.instrumentId;
    editingBar.append(element('span', `Đang ghi: ${name}`, 'ano-editing-name'));
    button('Đổi', () => setOpen(true), editingBar);
    button('✓ Xong', () => actions.edit(false), editingBar).classList.add('ano-primary');
    decorate(editingBar, state.instrumentId);
  }
  function section(title) {
    const box = element('section', undefined, 'ano-section'); box.append(element('h3', title, 'ano-section-title'));
    body.append(box); return box;
  }
  /* ① Ghi chú chung của bài cho cả ban nhạc */
  function renderBand() {
    const box = section('Ghi chú bài cho ban nhạc'), band = state.bandNote;
    if (bandEditing && state.member) { bandForm(box, band || {}); return; }
    if (band) {
      const meta = element('div', undefined, 'ano-band-meta');
      if (band.style) meta.append(element('span', band.style, 'ano-band-chip'));
      if (band.tempo) meta.append(element('span', `♩ = ${band.tempo}`, 'ano-band-chip'));
      if (meta.childElementCount) box.append(meta);
      if (band.text) box.append(element('p', band.text, 'ano-band-text'));
      if (band.updatedBy) box.append(element('p', `— ${band.updatedBy}`, 'ano-muted'));
    } else box.append(element('p', state.member ? 'Chưa có. Ghi điệu, tempo, lời dặn chung cho cả ban.' : 'Chưa có ghi chú chung.', 'ano-muted'));
    if (state.member) button(band ? 'Sửa ghi chú chung' : 'Thêm ghi chú chung', () => { bandEditing = true; render(state); body.querySelector('.ano-band-form input')?.focus(); }, box).classList.add('ano-small');
  }
  function bandForm(box, band) {
    const form = element('form', undefined, 'ano-band-form');
    const styleLabel = element('label', 'Điệu'), style = element('input'); style.maxLength = 40; style.value = band.style || '';
    style.setAttribute('list', 'ano-band-styles'); style.placeholder = 'Ballad, Slow rock…';
    const list = element('datalist'); list.id = 'ano-band-styles';
    BAND_STYLES.forEach(value => { const option = element('option'); option.value = value; list.append(option); });
    styleLabel.append(style, list);
    const tempoLabel = element('label', 'Tempo'), tempo = element('input'); tempo.type = 'number'; tempo.min = '20'; tempo.max = '300';
    tempo.inputMode = 'numeric'; tempo.placeholder = 'vd 72'; tempo.value = band.tempo || ''; tempoLabel.append(tempo);
    const row = element('div', undefined, 'ano-band-row'); row.append(styleLabel, tempoLabel); form.append(row);
    const textLabel = element('label', 'Lời dặn'), text = element('textarea'); text.maxLength = 1000; text.rows = 3;
    text.placeholder = 'vd: Intro piano 4 ô, điệp khúc vào trống, kết chậm dần'; text.value = band.text || '';
    textLabel.append(text); form.append(textLabel);
    const error = element('p'); error.setAttribute('role', 'alert'); form.append(error);
    const controls = element('div', undefined, 'ano-controls'); form.append(controls);
    const submit = button('Lưu', () => {}, controls); submit.type = 'submit'; submit.classList.add('ano-primary');
    button('Hủy', () => { bandEditing = false; render(state); }, controls);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const bpm = tempo.value.trim() ? parseInt(tempo.value, 10) : null;
      if (bpm !== null && (!(bpm >= 20) || bpm > 300)) { error.textContent = 'Tempo cần từ 20 đến 300.'; tempo.focus(); return; }
      submit.disabled = true;
      try { await actions.saveBand({ style: style.value.trim(), tempo: bpm, text: text.value.trim() }); bandEditing = false; render(state); }
      catch (e) { error.textContent = e.message; submit.disabled = false; }
    });
    box.append(form);
  }
  /* ② Ghi chú theo nhạc cụ: bật/tắt lớp hiển thị + ghi dấu + trên bản nhạc */
  function renderLayers() {
    const box = section('Ghi chú theo nhạc cụ');
    if (state.member) {
      const row = element('div', undefined, 'ano-write-row');
      const { label, select } = selectInstrument(state.instrumentId, 'Tôi ghi cho');
      select.disabled = state.saving; select.dataset.focusKey = 'instrument-select';
      select.addEventListener('change', () => actions.instrument(select.value)); row.append(label);
      const edit = button(state.editing ? '✓ Xong' : '＋ Ghi chú', () => { actions.edit(!state.editing); if (state.editing) setOpen(false); }, row);
      edit.classList.add('ano-primary'); edit.setAttribute('aria-pressed', String(state.editing));
      decorate(edit, state.instrumentId); box.append(row);
      box.append(element('p', state.editing ? (state.relocating ? 'Chạm dấu + để đặt lại ghi chú đang chọn.' : 'Chạm dấu + vàng trên bản nhạc để ghi tại chỗ đó.')
        : 'Chọn nhạc cụ → bấm Ghi chú → chạm dấu + trên bản nhạc.', 'ano-muted'));
    }
    const filters = element('div', undefined, 'ano-layer-chips'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Nhạc cụ hiển thị');
    const all = state.selected === null;
    const allChip = button('Tất cả', () => actions.filterAll(!all), filters);
    allChip.classList.add('ano-layer-chip'); allChip.setAttribute('aria-pressed', String(all)); allChip.dataset.focusKey = 'layer-all';
    state.instruments.forEach(instrument => {
      const on = all || state.selected.includes(instrument.id);
      const count = state.notes.filter(note => note.instrumentId === instrument.id).length;
      const chip = button(`${instrument.name}${count ? ` · ${count}` : ''}`, () => actions.filter(instrument.id, !on), filters);
      chip.classList.add('ano-layer-chip'); chip.setAttribute('aria-pressed', String(on)); chip.dataset.focusKey = instrument.id;
      chip.title = on ? `Ẩn ghi chú ${instrument.name}` : `Hiện ghi chú ${instrument.name}`;
      decorate(chip, instrument.id);
    });
    const none = button('Ẩn hết', () => actions.filterAll(false), filters);
    none.classList.add('ano-layer-chip', 'ano-layer-none'); none.setAttribute('aria-pressed', String(state.selected?.length === 0));
    box.append(filters);
  }
  function selectInstrument(value, labelText) {
    return choices(labelText, value, state.instruments);
  }
  function choices(labelText, value, options) {
    const label = element('label', labelText), select = element('select');
    select.setAttribute('aria-label', labelText);
    options.forEach(item => { const option = element('option', item.name); option.value = item.id; select.append(option); });
    select.value = value; label.append(select); return { label, select };
  }
  function noteColors(note, instrument, parent) {
    let customColor = note.customColor || '';
    const field = element('fieldset', undefined, 'ano-note-colors'); field.append(element('legend', 'Màu ghi chú'));
    const label = element('label', 'Màu tùy chọn'), input = element('input'); input.type = 'color';
    input.setAttribute('aria-label', 'Màu ghi chú'); label.append(input); field.append(label);
    const options = element('div', undefined, 'ano-color-options'); field.append(options);
    const status = element('p'); status.setAttribute('role', 'status'); field.append(status);
    const refresh = () => {
      input.value = customColor || colorFor(instrument.value); decorate(parent, instrument.value, customColor);
      status.textContent = customColor ? 'Màu riêng cho ghi chú này' : 'Đang dùng màu nhạc cụ';
      options.querySelectorAll('[data-swatch]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.swatch === customColor)));
    };
    const palette = [['#e11d48', 'đỏ'], ['#c2410c', 'cam'], ['#ca8a04', 'vàng'], ['#15803d', 'xanh lá'], ['#1d4ed8', 'xanh dương'], ['#7e22ce', 'tím']];
    palette.forEach(([color, name]) => {
      const swatch = button(`Màu ${name}`, () => { customColor = color; refresh(); }, options);
      swatch.dataset.swatch = color; swatch.classList.add('ano-color-swatch'); swatch.style.setProperty('--swatch-color', color);
    });
    button('Theo màu nhạc cụ', () => { customColor = ''; refresh(); }, field);
    input.addEventListener('input', () => { customColor = input.value.toLowerCase(); refresh(); });
    instrument.addEventListener('change', refresh); parent.append(field); refresh();
    return { value: () => customColor, refresh };
  }
  function renderAdmin() {
    const box = element('details', undefined, 'ano-section ano-admin'); box.append(element('summary', 'Quản lý nhạc cụ (Admin)'));
    body.append(box);
    const colorLabel = element('label', `Màu ${state.instruments.find(item => item.id === state.instrumentId)?.name || ''}`), color = element('input'); color.type = 'color'; color.dataset.focusKey = 'instrument-color'; color.disabled = state.saving; color.value = colorDrafts.get(state.instrumentId) || colorFor(state.instrumentId);
    const colorInstrumentId = state.instrumentId;
    color.addEventListener('input', () => colorDrafts.set(colorInstrumentId, color.value));
    color.setAttribute('aria-label', 'Màu nhạc cụ'); colorLabel.append(color); box.append(colorLabel);
    const colorError = element('span'); colorError.setAttribute('role', 'alert'); box.append(colorError);
    button('Lưu màu nhạc cụ', async () => {
      try { await actions.color(colorInstrumentId, colorDrafts.get(colorInstrumentId) || color.value); colorDrafts.delete(colorInstrumentId); } catch (e) { colorError.textContent = e.message; }
    }, box).disabled = state.saving;
    const form = element('form', undefined, 'ano-controls');
    const nameLabel = element('label', 'Nhạc cụ mới'), input = element('input'); input.maxLength = 40; input.required = true; input.value = instrumentNameDraft;
    input.addEventListener('input', () => { instrumentNameDraft = input.value; });
    nameLabel.append(input); form.append(nameLabel);
    const submit = button('Thêm nhạc cụ', () => {}, form); submit.type = 'submit';
    const error = element('span'); error.setAttribute('role', 'alert'); form.append(error);
    form.addEventListener('submit', async event => {
      event.preventDefault(); submit.disabled = true;
      try { await actions.createInstrument(input.value); instrumentNameDraft = ''; render(state); } catch (e) { error.textContent = e.message; }
      finally { submit.disabled = false; }
    }); box.append(form);
  }
  function renderNote(note, list) {
    const item = element('li'); item.dataset.annotationId = note.id;
    item.dataset.focusKey = `note:${note.id}`; item.tabIndex = -1;
    decorate(item, note.instrumentId, note.customColor);
    const name = state.instruments.find(instrument => instrument.id === note.instrumentId)?.name || note.instrumentId;
    item.append(element('strong', `${name} · Ô ${note.measureIdx + 1}${note.author ? ` · ${note.author}` : ''}`), element('p', `${note.icon || ''} ${note.text}`.trim()));
    if (state.unplaced.includes(note.id)) item.append(element('p', 'Cần kiểm tra vị trí: bản nhạc đã thay đổi hoặc chưa tìm thấy điểm gắn.', 'ano-warning'));
    if (state.canEditNote?.(note)) {
      const row = element('div', undefined, 'ano-controls'); item.append(row);
      button('Sửa', () => actions.openEditor(note), row).dataset.action = 'edit';
      button('Đổi vị trí', () => actions.relocate(note), row);
    }
    list.append(item);
  }
  function closeEditor() {
    if (!dialog) return;
    dialog.close(); dialog.remove(); dialog = null;
    (opener?.isConnected ? opener : root?.firstElementChild)?.focus({ preventScroll: true });
  }
  function editor(note, target) {
    closeEditor(); opener = document.activeElement;
    const pop = element('dialog', undefined, 'ano-editor'); dialog = pop;
    const title = element('h2', note.id ? 'Sửa ghi chú' : 'Thêm ghi chú'); title.id = 'ano-editor-title';
    pop.setAttribute('aria-labelledby', title.id); pop.append(title);
    const { label, select } = selectInstrument(note.instrumentId, 'Nhạc cụ'); pop.append(label);
    const icons = ['', '🎹', '🎵', '⚡', '🐢', '⚠️', '🔄'];
    if (note.icon && !icons.includes(note.icon)) icons.push(note.icon);
    const icon = choices('Biểu tượng ghi chú', note.icon || '', icons.map(id => ({ id, name: id || 'Không biểu tượng' })));
    pop.append(icon.label);
    const colors = noteColors(note, select, pop);
    const textLabel = element('label', 'Nội dung ghi chú'), text = element('textarea'); text.maxLength = 500; text.rows = 4;
    text.value = note.text || ''; textLabel.append(text); pop.append(textLabel);
    const presets = element('div', undefined, 'ano-presets'); presets.setAttribute('role', 'group'); presets.setAttribute('aria-label', 'Mẫu ghi chú');
    textLabel.before(presets);
    const renderPresets = () => {
      decorate(pop, select.value, colors.value()); presets.replaceChildren();
      (PRESETS[select.value] || PRESETS.general).forEach(value => button(value, () => {
        text.value = text.value.trim() ? `${text.value.trim()} · ${value}`.slice(0, 500) : value; text.focus();
      }, presets));
    };
    select.addEventListener('change', renderPresets); renderPresets();
    const error = element('p'); error.setAttribute('role', 'alert'); pop.append(error);
    const controls = element('div', undefined, 'ano-controls'); pop.append(controls);
    const submit = async remove => {
      if (!remove && !text.value.trim()) { error.textContent = 'Hãy nhập nội dung ghi chú.'; text.focus(); return; }
      pop.querySelectorAll('button,select,textarea,input').forEach(node => { node.disabled = true; });
      try {
        await actions.save({ ...note, instrumentId: select.value, text: text.value.trim(), color: note.color || 'yellow', customColor: colors.value() || undefined, icon: icon.select.value }, remove);
        if (dialog === pop) closeEditor();
      } catch (e) { error.textContent = e.message; }
      finally { pop.querySelectorAll('button,select,textarea,input').forEach(node => { node.disabled = false; }); }
    };
    button('Lưu ghi chú', () => submit(false), controls);
    if (note.id) button('Xóa ghi chú', () => submit(true), controls);
    button('Hủy', closeEditor, controls);
    button('Tải lại dữ liệu', async () => { await actions.reload(); colors.refresh(); }, controls);
    pop.addEventListener('cancel', event => { if (state.saving) event.preventDefault(); });
    pop.addEventListener('close', () => { if (dialog === pop) closeEditor(); });
    document.body.append(pop); pop.showModal();
    if (target?.isConnected && window.innerWidth > 600) {
      const rect = target.getBoundingClientRect(), width = pop.offsetWidth, height = pop.offsetHeight;
      pop.style.margin = '0'; pop.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
      pop.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12))}px`;
    }
    text.focus();
  }
  return { init, render, show, toggle: () => setOpen(!open), editor, closeEditor, colorFor, decorate, hide: () => setOpen(false), isOpen: () => open };
})();
