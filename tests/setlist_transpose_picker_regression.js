const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const handlers = new Map();
const elements = new Map();
const classList = () => ({ add() {}, remove() {}, toggle() {} });
const element = id => {
  const el = {
    id, value: '', textContent: '', dataset: {}, classList: classList(),
    addEventListener(name, fn) { this.listeners[name] = fn; },
    listeners: {}, select() {}
  };
  elements.set(id, el);
  return el;
};
[
  'transpose-pick-modal', 'transpose-pick-custom', 'transpose-pick-bpm',
  'btn-transpose-pick-ok', 'btn-transpose-pick-cancel', 'btn-close-transpose-pick',
  'transpose-pick-song-name', 'tp-orig-key-display', 'tp-target-key-display', 'tp-diff-display'
].forEach(element);

const window = {
  EventBus: {
    on(name, fn) { handlers.set(name, fn); },
    emit(name, data) { handlers.get(name)?.(data); }
  },
  ModalManager: {
    open() {},
    close(modal) { window.EventBus.emit('modal:closed', { modalId: modal.id }); }
  }
};
const document = {
  readyState: 'complete',
  getElementById: id => elements.get(id) || null,
  querySelectorAll: () => []
};
let submitted = null;
window.ApiService = { setlists: { addItem: async payload => {
  submitted = payload;
  return { success: false, error: 'Test stops before writing data' };
} } };
window.App = { showToast() {} };
window.Store = { get: () => 2 };
window.Metronome = { getBpm: () => 96 };
window.ChordCanvas = { getCurrentSet: () => 'HD' };
const source = fs.readFileSync(path.join(__dirname, '../assets/js/modals/TransposePickerModal.js'), 'utf8');
const context = vm.createContext({ window, document, setTimeout() {}, console });
vm.runInContext(source, context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/setlist-detail.js'), 'utf8'), context);
window.SetlistDetail.setContext({
  ensureSongsLoaded: async () => {},
  getCurrentSetlist: () => ({ id: 7, items: [] }),
  getAllSongsCache: () => [{ id: 'thanh-ca-001', title: 'Bài thử', defaultKey: 'G', bpm: 96 }]
});

(async () => {
  const selected = window.TransposePick.show('Bài thử', 2, 'G', 96);
  elements.get('btn-transpose-pick-ok').listeners.click();
  const result = await selected;
  assert.equal(result.transpose_key, 2);
  assert.equal(result.bpm, 96);
  console.log('PASS: Xác nhận tông và BPM trả lựa chọn để thêm bài');

  const cancelled = window.TransposePick.show('Bài thử', 0, 'G', 80);
  window.ModalManager.close(elements.get('transpose-pick-modal'));
  assert.equal(await cancelled, null);
  console.log('PASS: Đóng hộp thoại bên ngoài vẫn trả Hủy');

  const adding = window.SetlistDetail.addSongToSetlist(7, 'thanh-ca-001');
  await new Promise(setImmediate);
  elements.get('btn-transpose-pick-ok').listeners.click();
  await adding;
  assert.equal(submitted.setlist_id, 7);
  assert.equal(submitted.song_id, 'thanh-ca-001');
  assert.equal(submitted.transpose_key, 2);
  assert.equal(submitted.bpm, 96);
  console.log('PASS: Thêm bài gửi đúng tông và BPM tới API');
})().catch(error => { console.error(error); process.exitCode = 1; });
