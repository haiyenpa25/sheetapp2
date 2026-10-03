const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function attempt(error) {
  const errorElement = { textContent: '', classList: { remove() {} } };
  const context = {
    window: { ApiService: { auth: { login: async () => { throw error; } } } },
    document: { getElementById: () => errorElement },
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/auth.js'), 'utf8'), context);
  await context.window.Auth.login('example', 'invalid');
  return errorElement.textContent;
}

(async () => {
  const denied = Object.assign(new Error('Sai tài khoản hoặc mật khẩu'), { status: 401 });
  assert.equal(await attempt(denied), 'Sai tài khoản hoặc mật khẩu');
  assert.equal(await attempt(new TypeError('Failed to fetch')), 'Lỗi mạng');
  console.log('PASS: login displays authentication errors separately from network errors');
})().catch(error => { console.error('FAIL:', error); process.exitCode = 1; });
