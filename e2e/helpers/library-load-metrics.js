// Count network transfers, including query-string scripts and dynamically loaded modules.
// Playwright's responseBodySize is encoded bytes; headers are included in transferBytes.
function collectLibraryLoad(page) {
  const requests = [];
  const transfers = [];
  const failures = [];
  const warnings = [];
  page.on('request', request => requests.push(request));
  page.on('requestfinished', request => transfers.push(request.sizes().catch(error => {
    failures.push(`${request.url()}: ${error.message}`);
    return null;
  })));
  page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('console', message => {
    if (/AudioContext/i.test(message.text()) && ['warning', 'error'].includes(message.type())) warnings.push(message.text());
  });
  return async firstSvgMs => {
    await page.waitForLoadState('networkidle');
    const sizes = await Promise.all(transfers);
    return {
      firstSvgMs,
      scripts: requests.filter(request => request.resourceType() === 'script').length,
      requests: requests.length,
      transferBytes: sizes.reduce((sum, size) => sum + (size ? size.responseHeadersSize + size.responseBodySize : 0), 0),
      api: requests.filter(request => new URL(request.url()).pathname.endsWith('/api/index.php')).map(request => request.url()),
      audioWarnings: warnings,
      failures,
    };
  };
}

async function throttle4G(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 1600000 / 8,
    uploadThroughput: 750000 / 8, connectionType: 'cellular4g',
  });
}
module.exports = { collectLibraryLoad, throttle4G };
