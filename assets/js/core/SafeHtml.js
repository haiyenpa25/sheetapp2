/** Shared output encoding for values interpolated into HTML templates. */
const SafeHtml = (() => {
  'use strict';

  function escape(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function inlineJsString(value) {
    const escapedForJavaScript = String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    return escape(escapedForJavaScript);
  }

  return { escape, inlineJsString };
})();

window.SafeHtml = SafeHtml;
