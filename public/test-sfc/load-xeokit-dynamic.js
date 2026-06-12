// 动态加载 xeokit SDK - 仅在需要时加载
(function() {
  let loadPromise = null;

  window.loadXeokitSDK = function() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './xeokit-sdk.min.es.js';
      script.type = 'module';
      script.onload = () => {
        console.log('[Dynamic Loader] xeokit SDK loaded');
        resolve();
      };
      script.onerror = () => {
        console.error('[Dynamic Loader] Failed to load xeokit SDK');
        reject(new Error('Failed to load xeokit SDK'));
      };
      document.head.appendChild(script);
    });

    return loadPromise;
  };

  console.log('[Dynamic Loader] xeokit SDK dynamic loader ready');
})();