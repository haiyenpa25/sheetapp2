/**
 * assets/js/modals/HelpModal.js
 * Quản lý Hộp Thoại Hướng Dẫn Sử Dụng (Help Modal - F9 / ? shortcut).
 */

(function() {
  'use strict';

  function initHelpModal() {
    var modal   = document.getElementById('help-modal');
    var btnOpen = document.getElementById('btn-help');
    var btnClose  = document.getElementById('btn-close-help');
    var btnCloseF = document.getElementById('btn-close-help-footer');

    function openHelp(tabId, triggerEl) {
      if (!modal) return;
      if (window.ModalManager) {
        window.ModalManager.open(modal, triggerEl || btnOpen);
      } else {
        modal.classList.remove('hidden');
      }
      if (tabId) {
        document.querySelectorAll('.help-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.help-pane').forEach(function(p) { p.classList.remove('active'); p.classList.add('hidden'); });
        var tab = document.querySelector('.help-tab[data-tab="' + tabId + '"]');
        var pane = document.getElementById('help-tab-' + tabId);
        if (tab) tab.classList.add('active');
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      }
    }

    function closeHelp() {
      if (!modal) return;
      if (window.ModalManager) {
        window.ModalManager.close(modal);
      } else {
        modal.classList.add('hidden');
      }
    }

    if (btnOpen)   btnOpen.addEventListener('click', function(e) { openHelp(null, e.currentTarget || btnOpen); });
    if (btnClose)  btnClose.addEventListener('click', closeHelp);
    if (btnCloseF) btnCloseF.addEventListener('click', closeHelp);
    if (modal)     modal.addEventListener('click', function(e) { if (e.target === modal) closeHelp(); });

    document.querySelectorAll('.help-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.help-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.help-pane').forEach(function(p) { p.classList.remove('active'); p.classList.add('hidden'); });
        tab.classList.add('active');
        var pane = document.getElementById('help-tab-' + tab.dataset.tab);
        if (pane) { pane.classList.remove('hidden'); pane.classList.add('active'); }
      });
    });

    document.addEventListener('keydown', function(e) {
      var tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (['input','textarea','select'].includes(tag)) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        if (modal && modal.classList.contains('hidden')) openHelp('shortcuts');
        else closeHelp();
      }
    });

    window._helpModalOpen = openHelp;
    window.HelpModal = {
      open: openHelp,
      close: closeHelp
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpModal);
  } else {
    initHelpModal();
  }
})();
