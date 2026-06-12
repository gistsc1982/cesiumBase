// 动态加载 DualCanvasViewer Plugin - 仅在需要时加载
(function() {
  let loadPromise = null;

  window.loadDualCanvasViewerPlugin = function() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
      // 首先确保 Vue 已加载
      if (typeof window.Vue === 'undefined') {
        const vueScript = document.createElement('script');
        vueScript.src = './vue.global.prod.js';
        vueScript.onload = loadPlugin;
        vueScript.onerror = () => reject(new Error('Failed to load Vue'));
        document.head.appendChild(vueScript);
      } else {
        loadPlugin();
      }

      function loadPlugin() {
        const script = document.createElement('script');
        script.src = './dual-canvas-viewer-plugin.iife.js';
        script.onload = () => {
          console.log('[Dynamic Loader] DualCanvasViewer Plugin loaded');
          resolve();
        };
        script.onerror = () => {
          console.error('[Dynamic Loader] Failed to load DualCanvasViewer Plugin');
          reject(new Error('Failed to load DualCanvasViewer Plugin'));
        };
        document.head.appendChild(script);
      }
    });

    return loadPromise;
  };

  console.log('[Dynamic Loader] DualCanvasViewer Plugin dynamic loader ready');
})();