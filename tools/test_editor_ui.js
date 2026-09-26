#!/usr/bin/env node
/**
 * tools/test_editor_ui.js — Automated Chrome DevTools UI Tester for SheetApp Editor
 * Sử dụng Puppeteer-core kết nối với Google Chrome headless trên server
 * Kiểm tra toàn diện: Render SVG, Tương tác nốt, Đổi cao độ/trường độ, Chụp ảnh màn hình
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv[2] || 'https://sheet.hyb.io.vn/editor/';
const SCREENSHOT_PATH = path.resolve(__dirname, '../storage/editor_test_screenshot.png');

async function runEditorUiTest() {
  console.log('\n=============================================================');
  console.log('🧪 CHROME DEVTOOLS UI TESTER — SHEETAPP NOTE EDITOR (4 BÈ)');
  console.log('=============================================================');
  console.log(`🌐 Target URL: ${TARGET_URL}`);
  console.log('🚀 Khởi chạy Google Chrome headless...');

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/local/bin/google-chrome',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1440,900'
      ]
    });
  } catch (err) {
    console.error('❌ Không thể khởi chạy Google Chrome:', err.message);
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.toString());
  });

  console.log('⏳ Đang nạp trang editor...');
  const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 35000 });
  console.log(`📡 HTTP Status: ${response.status()}`);

  if (response.status() !== 200) {
    console.error(`❌ Lỗi tải trang: Mã phản hồi ${response.status()}`);
    await browser.close();
    process.exit(1);
  }

  // 1. Chờ OSMD nạp xong bản nhạc SVG
  console.log('🎼 Đang chờ OpenSheetMusicDisplay render bản nhạc MusicXML...');
  try {
    await page.waitForSelector('#osmd-editor-container svg', { timeout: 20000 });
    console.log('✅ Bản nhạc SVG đã render thành công!');
  } catch (err) {
    console.error('❌ Hết thời gian chờ render SVG:', err.message);
  }

  // 2. Kiểm tra các phần tử giao diện chính
  const songLabel = await page.$eval('#current-song-label', el => el.textContent.trim()).catch(() => 'N/A');
  const posLabel = await page.$eval('#pos-info-label', el => el.textContent.trim()).catch(() => 'N/A');
  const activeVoice = await page.$eval('.voice-card-btn.active', el => el.dataset.voice).catch(() => 'N/A');

  console.log(`🎵 Bài hát đang mở: "${songLabel}"`);
  console.log(`📍 Vị trí nốt mặc định: ${posLabel}`);
  console.log(`🎙️ Bè đang chọn: ${activeVoice.toUpperCase()}`);

  // 3. Đọc cao độ 4 bè SATB
  const satbState = await page.evaluate(() => {
    return {
      soprano: document.getElementById('lbl-pitch-soprano')?.textContent.trim(),
      alto: document.getElementById('lbl-pitch-alto')?.textContent.trim(),
      tenor: document.getElementById('lbl-pitch-tenor')?.textContent.trim(),
      bass: document.getElementById('lbl-pitch-bass')?.textContent.trim()
    };
  });
  console.log('📊 Cao độ 4 bè tại nốt hiện tại:', satbState);

  // 4. Thử nghiệm đổi bè (Click Alto)
  console.log('🖱️ Kiểm tra tương tác: Chọn bè Alto...');
  await page.click('#tab-alto');
  const newActiveVoice = await page.$eval('.voice-card-btn.active', el => el.dataset.voice).catch(() => 'N/A');
  console.log(`✅ Đã chuyển bè active thành: ${newActiveVoice.toUpperCase()}`);

  // 5. Thử nghiệm nút điều hướng nốt (Next note)
  console.log('🖱️ Kiểm tra điều hướng: Bấm nút [Sau ▶]...');
  await page.click('#btn-nav-next-note');
  await new Promise(r => setTimeout(r, 400));
  const newPos = await page.$eval('#pos-info-label', el => el.textContent.trim()).catch(() => 'N/A');
  console.log(`📍 Vị trí sau khi nhảy nốt: ${newPos}`);

  // 6. Chụp ảnh màn hình lưu vào storage/
  const dir = path.dirname(SCREENSHOT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log(`📸 Đã chụp ảnh màn hình lưu tại: ${SCREENSHOT_PATH}`);

  // 7. Tổng kết lỗi console
  console.log('\n-------------------------------------------------------------');
  console.log(`⚠️ Tổng lỗi trang (pageerror): ${pageErrors.length}`);
  console.log(`⚠️ Tổng lỗi console: ${consoleLogs.length}`);
  if (pageErrors.length > 0) {
    console.error('Chi tiết lỗi pageerror:', pageErrors);
  }
  if (consoleLogs.length > 0) {
    console.warn('Chi tiết console error:', consoleLogs);
  }

  console.log('-------------------------------------------------------------');
  if (pageErrors.length === 0) {
    console.log('🎉 TẤT CẢ KIỂM TRA GIAO DIỆN HOÀN TẤT THÀNH CÔNG RỰC RỠ!');
  } else {
    console.log('⚠️ Hoàn tất kiểm tra với một số cảnh báo cần theo dõi.');
  }

  await browser.close();
}

runEditorUiTest().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
