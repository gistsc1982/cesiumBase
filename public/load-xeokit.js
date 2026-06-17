/**
 * xeokit SDK 包装脚本
 * 将 ES 模块格式的 xeokit SDK 加载并挂载到 window.xeokitSDK
 */
(async function() {
  // ⭐ 检查是否已经加载过
  if (typeof window !== 'undefined' && window.xeokitSDK) {
    console.log('[xeokit] ℹ️ SDK 已经加载，跳过');
    return;
  }

  console.log('[xeokit] 🚀 开始加载 xeokit SDK...');

  try {
    // 使用动态 import 加载 xeokit SDK
    const xeokitModule = await import('./xeokit-sdk.min.es.js');

    // 将 xeokit 模块的所有导出挂载到 window.xeokitSDK
    window.xeokitSDK = xeokitModule;

    // 触发自定义事件，通知 xeokit 已加载
    const event = new CustomEvent('xeokit-ready');
    window.dispatchEvent(event);

    console.log('[xeokit] ✅ SDK 已加载并挂载到 window.xeokitSDK');
    console.log('[xeokit] 可用的类:', Object.keys(xeokitModule));
  } catch (error) {
    console.error('[xeokit] ❌ SDK 加载失败:', error);
  }
})();
