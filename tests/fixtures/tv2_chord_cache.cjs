const fs = require('fs');
const path = require('path');
const vm = require('vm');
const calls = [];
const context = vm.createContext({
  window: { __APP_BASE__: '/fixture' }, URLSearchParams,
  fetch: async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });
    return { ok: true, json: async () => ({ success: true, sets: ['HD', 'default'] }) };
  },
});
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../assets/js/core/ApiService.js'), 'utf8'), context);
(async () => {
  const api = context.window.ApiService.chordSets;
  const lists = () => calls.filter(call => call.url.includes('action=list')).length;
  await Promise.all([api.list('one'), api.list('one'), api.list('one')]);
  await api.list('one');
  const deduplicated = lists() === 1;
  api.clearCache('one'); await api.list('one');
  const cleared = lists() === 2;
  await api.save('one', 'CUSTOM', []); await api.list('one');
  const saved = lists() === 3;
  await api.clone('one', 'HD', 'CUSTOM'); await api.list('one');
  const cloned = lists() === 4;
  await api.delete('one', 'CUSTOM'); await api.list('one');
  console.log(JSON.stringify({ deduplicated, cleared, saved, cloned, deleted: lists() === 5 }));
})().catch(error => { console.error(error); process.exitCode = 1; });
