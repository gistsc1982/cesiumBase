/**
 * SyncManager Bridge
 * 确保打包后的 DualCanvasViewer 插件使用全局 SyncManager 的配置
 */

(function() {
  'use strict';

  console.log('[SyncManagerBridge] 桥接脚本已加载');

  // 等待全局 SyncManager 可用
  function waitForGlobalSyncManager(callback) {
    if (window.__syncManager__) {
      callback(window.__syncManager__);
    } else {
      setTimeout(() => waitForGlobalSyncManager(callback), 100);
    }
  }

  // 初始化桥接
  function initBridge() {
    waitForGlobalSyncManager((globalSyncManager) => {
      console.log('[SyncManagerBridge] 全局 SyncManager 已就绪，插件将自动使用全局实例');

      // 由于现在通过 sync-manager-global.js 设置了全局 window.syncManager 代理
      // 插件会自动使用全局实例，无需手动设置
    });
  }

  // 启动桥接
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
  } else {
    initBridge();
  }
})();
