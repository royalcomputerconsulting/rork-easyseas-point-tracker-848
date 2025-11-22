export const injectionScript = `
(function() {
  console.log('[RN Scraper] Installing hooks...');
  
  window.__rn_packets = window.__rn_packets || [];
  
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      const cloned = response.clone();
      
      cloned.json().then(data => {
        const jsonStr = JSON.stringify(data);
        if (
          jsonStr.includes('campaignOffer') ||
          jsonStr.includes('campaignOffers') ||
          jsonStr.includes('offers') ||
          jsonStr.includes('sailings') ||
          jsonStr.includes('offerCode')
        ) {
          console.log('[RN Scraper] Captured fetch:', args[0]);
          window.__rn_packets.push({
            src: 'fetch',
            url: args[0],
            data: data
          });
        }
      }).catch(() => {});
      
      return response;
    });
  };
  
  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url) {
    this._url = url;
    return XHROpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        const data = JSON.parse(this.responseText);
        const jsonStr = JSON.stringify(data);
        
        if (
          jsonStr.includes('campaignOffer') ||
          jsonStr.includes('campaignOffers') ||
          jsonStr.includes('offers') ||
          jsonStr.includes('sailings') ||
          jsonStr.includes('offerCode')
        ) {
          console.log('[RN Scraper] Captured XHR:', this._url);
          window.__rn_packets.push({
            src: 'xhr',
            url: this._url,
            data: data
          });
        }
      } catch (e) {}
    });
    
    return XHRSend.apply(this, arguments);
  };
  
  window.__rn_scrape = function() {
    console.log('[RN Scraper] Scraping ' + window.__rn_packets.length + ' packets');
    return JSON.stringify(window.__rn_packets);
  };
  
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HOOK_READY' }));
  }
  
  console.log('[RN Scraper] Hooks installed successfully');
})();
`;
