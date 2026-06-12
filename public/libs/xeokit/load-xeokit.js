/**
 * xeokit SDK 包装脚本
 * 将 ES 模块格式的 xeokit SDK 加载并挂载到 window.xeokitSDK
 */
(function() {
  // 使用动态 import 加载 xeokit SDK
  import('./xeokit-sdk.min.es.js')
    .then(xeokitModule => {
      // 将 xeokit 模块的所有导出挂载到 window.xeokitSDK
      window.xeokitSDK = xeokitModule;

      // 触发自定义事件，通知 xeokit 已加载
      const event = new CustomEvent('xeokit-ready');
      window.dispatchEvent(event);

      console.log('[xeokit] SDK 已加载并挂载到 window.xeokitSDK');
      console.log('[xeokit] 可用的类:', Object.keys(xeokitModule));
    })
    .catch(error => {
      console.error('[xeokit] SDK 加载失败:', error);
    });
})();
