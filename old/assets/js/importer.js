/**
 * importer.js
 * Xử lý import MusicXML từ 3 nguồn:
 *  1. URL thánh ca (thanhca.httlvn.org) — scrape qua PHP proxy
 *  2. Upload file .xml/.mxl từ máy tính
 *  3. URL trực tiếp đến file XML
 */
const Importer = (() => {
  'use strict';

  let selectedFile  = null;
  let onSuccessCb   = null;

  const modal      = () => document.getElementById('admin-modal');
  const progressEl = () => document.getElementById('import-progress');
  const progressBar = () => document.getElementById('import-progress-bar');
  const progressTxt = () => document.getElementById('import-progress-text');
  const resultEl   = () => document.getElementById('import-result');

  /**
   * Khởi tạo module — gắn tất cả event listeners.
   */
  function init() {
    // Open / close modal
    document.getElementById('btn-import')?.addEventListener('click', openModal);
    document.getElementById('btn-import-welcome')?.addEventListener('click', openModal);
    document.getElementById('btn-close-import')?.addEventListener('click', closeModal);
    document.getElementById('btn-omr-upload')?.addEventListener('click', () => {
      openModal();
      switchTab('omr');
    });
    modal()?.addEventListener('click', e => { if (e.target === modal()) closeModal(); });

    // Tabs
    document.querySelectorAll('#import-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Tab URL thánh ca
    document.getElementById('btn-fetch-url')?.addEventListener('click', _importFromThanhca);

    // Tab Upload
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) _setSelectedFile(f);
    });
    dropZone?.addEventListener('click', e => {
      if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
        fileInput?.click();
      }
    });
    fileInput?.addEventListener('change', () => {
      if (fileInput.files[0]) _setSelectedFile(fileInput.files[0]);
    });
    document.getElementById('btn-clear-file')?.addEventListener('click', () => {
      selectedFile = null;
      document.getElementById('file-selected')?.classList.add('hidden');
      document.getElementById('drop-zone')?.classList.remove('hidden');
      document.getElementById('btn-do-upload').disabled = true;
    });
    document.getElementById('btn-do-upload')?.addEventListener('click', _importFromUpload);

    // Tab Direct URL
    document.getElementById('btn-fetch-direct')?.addEventListener('click', _importFromDirectUrl);

    // Enter key on inputs
    ['import-url-input','import-direct-input'].forEach(id => {
      document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') e.target.nextElementSibling?.click();
      });
    });

    // OMR Station events
    const omrDropZone = document.getElementById('omr-drop-zone');
    const omrFileInput = document.getElementById('omr-file-input');
    
    omrDropZone?.addEventListener('dragover', e => { e.preventDefault(); omrDropZone.classList.add('drag-over'); });
    omrDropZone?.addEventListener('dragleave', () => omrDropZone.classList.remove('drag-over'));
    omrDropZone?.addEventListener('drop', e => {
      e.preventDefault();
      omrDropZone.classList.remove('drag-over');
      const f = e.dataTransfer.files[0];
      if (f) _uploadOmrFile(f);
    });
    omrDropZone?.addEventListener('click', e => {
      if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
        omrFileInput?.click();
      }
    });
    omrFileInput?.addEventListener('change', () => {
      if (omrFileInput.files[0]) _uploadOmrFile(omrFileInput.files[0]);
    });

    document.getElementById('btn-omr-refresh')?.addEventListener('click', _fetchOmrQueue);
    document.getElementById('btn-omr-publish')?.addEventListener('click', _publishOmrResult);
    document.getElementById('btn-omr-preview')?.addEventListener('click', _previewOmrResult);
  }

  function openModal() {
    modal()?.classList.remove('hidden');
    _resetUI();
  }

  function closeModal() {
    modal()?.classList.add('hidden');
    _resetUI();
  }

  function switchTab(tabName) {
    document.querySelectorAll('#import-tabs .tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tabName)
    );
    document.querySelectorAll('.tab-content').forEach(c => {
      const isActive = (c.id === `tab-${tabName}`);
      c.classList.toggle('active', isActive);
      if (isActive) {
        c.classList.remove('hidden');
        c.style.display = 'flex';
      } else {
        c.classList.add('hidden');
        c.style.display = 'none';
      }
    });
    _resetUI(false);
    
    if (tabName === 'omr') {
      _fetchOmrQueue();
      _loadCategoriesForOmr();
    }
  }

  function onSuccess(cb) { onSuccessCb = cb; }

  // ---- IMPORT METHODS ----

  /**
   * 1. Import từ URL thánh ca (OSMD site) — dùng PHP proxy để scrape XML
   */
  async function _importFromThanhca() {
    const url   = document.getElementById('import-url-input')?.value.trim();
    const title = document.getElementById('import-url-title')?.value.trim() || '';

    if (!url) { _showResult('Vui lòng nhập URL bài hát', 'error'); return; }
    if (!url.includes('thanhca.httlvn.org') && !url.includes('httlvn')) {
      if (!confirm('URL không phải từ thanhca.httlvn.org. Vẫn thử tải?')) return;
    }

    _showProgress('Đang truy cập trang bài hát...');

    try {
      const data = await window.ApiService.importer.search(url);

      if (!data.success) throw new Error(data.message || 'Scrape thất bại');

      _showProgress('Đã tìm thấy nhạc, đang lưu...', 80);
      await _delay(300);
      _showResult(`✅ Import thành công: <strong>${_esc(data.title)}</strong>`, 'success');
      _triggerSuccess(data.song);

    } catch (err) {
      _showResult(`❌ ${err.message}`, 'error');
    }
  }

  /**
   * 2. Import từ file upload
   */
  async function _importFromUpload() {
    if (!selectedFile) return;
    const title = document.getElementById('import-upload-title')?.value.trim()
                  || selectedFile.name.replace(/\.(xml|mxl|musicxml)$/i, '');

    _showProgress('Đang upload file...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title);

      const data = await window.ApiService.importer.upload(formData);

      if (!data.success) throw new Error(data.message || 'Upload thất bại');

      _showResult(`✅ Upload thành công: <strong>${_esc(data.title)}</strong>`, 'success');
      _triggerSuccess(data.song);

    } catch (err) {
      _showResult(`❌ ${err.message}`, 'error');
    }
  }

  /**
   * 3. Import từ URL trực tiếp đến file XML
   */
  async function _importFromDirectUrl() {
    const url   = document.getElementById('import-direct-input')?.value.trim();
    const title = document.getElementById('import-direct-title')?.value.trim() || '';

    if (!url) { _showResult('Vui lòng nhập URL file XML', 'error'); return; }
    if (!/\.(xml|mxl|musicxml)(\?|$)/i.test(url) && !confirm('URL không kết thúc bằng .xml/.mxl. Vẫn thử?')) return;

    _showProgress('Đang tải file XML...');

    try {
      const data = await window.ApiService.importer.fetch(url);

      if (!data.success) throw new Error(data.message || 'Tải file thất bại');

      _showResult(`✅ Import thành công: <strong>${_esc(data.title)}</strong>`, 'success');
      _triggerSuccess(data.song);

    } catch (err) {
      _showResult(`❌ ${err.message}`, 'error');
    }
  }

  // ---- OMR METHODS ----

  async function _fetchOmrQueue() {
    try {
      const data = await window.ApiService.omr.list();
      const container = document.getElementById('omr-queue-container');
      const list = document.getElementById('omr-queue-list');
      if (data && data.length > 0) {
        container.classList.remove('hidden');
        list.innerHTML = data.map(job => 
          `<div class="job-item flex justify-between align-center p-half border-b" style="cursor:pointer;" onclick="Importer.selectOmrJob('${job.id}', '${job.status}', '${_esc(job.original_filename)}', '${job.musicxml_path}')">
            <div>
              <strong>${_esc(job.original_filename)}</strong><br>
              <span class="text-xs text-muted">${job.created_at}</span>
            </div>
            <div>
              <span class="tag ${job.status === 'completed' ? 'tag-purple' : 'tag-muted'}">${job.status}</span>
              <button class="icon-btn-xs text-danger ml-half" onclick="event.stopPropagation(); Importer.deleteOmrJob('${job.id}')">✕</button>
            </div>
          </div>`
        ).join('');
      } else {
        container.classList.add('hidden');
        list.innerHTML = '';
      }
    } catch(err) {
      console.error(err);
    }
  }

  async function _uploadOmrFile(file) {
    if (!file) return;
    document.getElementById('import-progress')?.classList.remove('hidden');
    document.getElementById('import-progress-text').textContent = 'Đang tải file lên Trạm xử lý...';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await window.ApiService.omr.create(fd);
      if (!data.success) throw new Error(data.error);
      _fetchOmrQueue();
      document.getElementById('import-progress')?.classList.add('hidden');
      App?.showToast('Tải lên thành công! File đang chờ xử lý.', 'success');
    } catch(err) {
      document.getElementById('import-progress')?.classList.add('hidden');
      App?.showToast('Upload lỗi: ' + err.message, 'error');
    }
  }

  window.Importer = window.Importer || {};
  window.Importer.selectOmrJob = function(id, status, filename, xmlPath) {
    if (status !== 'completed') {
      App?.showToast('File đang xử lý, vui lòng chờ!', 'info');
      return;
    }
    const title = filename.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
    document.getElementById('omr-review-container').classList.remove('hidden');
    document.getElementById('omr-review-id').value = id;
    document.getElementById('omr-review-title').value = title;
  };
  
  window.Importer.deleteOmrJob = async function(id) {
    if(!confirm('Xoá bản nhận diện này?')) return;
    await window.ApiService.omr.delete(id);
    _fetchOmrQueue();
  };

  async function _loadCategoriesForOmr() {
    try {
      const cats = await window.ApiService.categories.list();
      const sel = document.getElementById('omr-review-category');
      if (sel && Array.isArray(cats)) {
        sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      }
    } catch(err){}
  }

  async function _publishOmrResult() {
    const id = document.getElementById('omr-review-id').value;
    const title = document.getElementById('omr-review-title').value;
    const catId = document.getElementById('omr-review-category')?.value || 1;
    
    _showProgress('Đang lấy MusicXML từ hệ thống OMR...');
    try {
      // Vì file XML đang nằm thư mục storage/omr_workspace, ta trick dùng "Direct URL" load vào library
      // URL có thể là file tĩnh hoặc API
      const xmlUrl = window.location.origin + window.location.pathname.replace(/\/index\.php$/, '') + '/storage/omr_workspace/' + id + '.mxl';
      
      const data = await window.ApiService.importer.fetch(xmlUrl);
      if (!data.success) throw new Error(data.message || 'Lưu kho thất bại');
      
      // Update Category manually vì API url mặc định cat 1.
      await window.ApiService.songs.update(data.song.id, { categoryId: catId });
      data.song.category_id = catId; // force local update

      _showResult(`✅ Đã đưa vào kho: <strong>${_esc(data.title)}</strong>`, 'success');
      // Delete OMR Queue job
      await window.ApiService.omr.delete(id);
      
      _triggerSuccess(data.song);
    } catch (err) {
      _showResult(`❌ ${err.message}`, 'error');
    }
  }

  function _previewOmrResult() {
    const id = document.getElementById('omr-review-id').value;
    const xmlUrl = window.location.origin + window.location.pathname.replace(/\/index\.php$/, '') + '/storage/omr_workspace/' + id + '.mxl';
    window.open(xmlUrl, '_blank');
  }

  // ---- INTERNAL HELPERS ----

  function _setSelectedFile(file) {
    if (!/\.(xml|mxl|musicxml)$/i.test(file.name)) {
      _showResult('Chỉ chấp nhận file .xml, .mxl, hoặc .musicxml', 'error');
      return;
    }
    selectedFile = file;
    document.getElementById('file-selected')?.classList.remove('hidden');
    document.getElementById('drop-zone')?.classList.add('hidden');
    const nameEl = document.getElementById('file-name-display');
    if (nameEl) nameEl.textContent = file.name;

    // Auto-fill title
    const titleInput = document.getElementById('import-upload-title');
    if (titleInput && !titleInput.value) {
      titleInput.value = file.name.replace(/\.(xml|mxl|musicxml)$/i, '').replace(/_/g, ' ');
    }

    document.getElementById('btn-do-upload').disabled = false;
  }

  function _triggerSuccess(song) {
    setTimeout(() => {
      closeModal();
      if (onSuccessCb) onSuccessCb(song);
    }, 1200);
  }

  function _showProgress(text, percent = 40) {
    progressEl()?.classList.remove('hidden');
    resultEl()?.classList.add('hidden');
    if (progressTxt()) progressTxt().textContent = text;
    if (progressBar()) progressBar().style.width = percent + '%';
  }

  function _showResult(html, type) {
    progressEl()?.classList.add('hidden');
    if (progressBar()) progressBar().style.width = '0%';
    const el = resultEl();
    if (!el) return;
    el.innerHTML  = html;
    el.className  = `import-result ${type}`;
    el.classList.remove('hidden');
  }

  function _resetUI(clearInputs = true) {
    progressEl()?.classList.add('hidden');
    resultEl()?.classList.add('hidden');
    if (progressBar()) progressBar().style.width = '0%';
    if (clearInputs) {
      ['import-url-input','import-url-title','import-direct-input','import-direct-title','import-upload-title']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      selectedFile = null;
      document.getElementById('file-selected')?.classList.add('hidden');
      document.getElementById('drop-zone')?.classList.remove('hidden');
      const uploadBtn = document.getElementById('btn-do-upload');
      if (uploadBtn) uploadBtn.disabled = true;
    }
  }

  function _esc(str) {
    return String(str||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { init, openModal, closeModal, switchTab, onSuccess };
})();
