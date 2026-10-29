// One description for the selected set across Classic, Modern, mobile and HUD.
const ChordSetNames = (() => {
  'use strict';
  const HD = 'HD';
  const TLH = 'default';

  function readStatus() {
    const canvas = window.ChordCanvas;
    const currentSet = canvas?.getCurrentSet?.() || HD;
    const customCount = Object.keys(canvas?.getCustomChords?.() || {}).length;
    const xmlCount = canvas?.getXmlChordCount?.() ?? Object.keys(window.ChordCanvasXML?.readXmlChords?.() || {}).length;
    return { currentSet, customCount, xmlCount };
  }

  function describe(status = readStatus()) {
    if (status.currentSet === TLH) return 'TLH (gốc)';
    if (status.customCount > 0) return `${status.currentSet} · ${status.customCount} hợp âm`;
    return `${status.currentSet} (chưa có)` + (window.AppRules?.HD_EMPTY_SHOWS_TLH === true && status.currentSet === HD && status.xmlCount > 0 ? ' · đang hiện TLH' : '');
  }

  function short(status = readStatus()) {
    if (status.currentSet === TLH) return 'TLH';
    if (status.currentSet === HD) return window.AppRules?.HD_EMPTY_SHOWS_TLH === true && status.customCount === 0 && status.xmlCount > 0 ? 'HD→TLH' : HD;
    return status.currentSet.length > 4 ? status.currentSet.slice(0, 3) + '…' : status.currentSet;
  }

  // Set data can finish before XML. Refresh the selected label once both exist,
  // without fetching the set list again.
  window.EventBus?.on('song:loaded', () => {
    const selected = document.querySelector('#chord-set-selector option:checked');
    if (selected) selected.textContent = describe();
  });

  return { HD, TLH, readStatus, describe, short };
})();
window.ChordSetNames = ChordSetNames;
