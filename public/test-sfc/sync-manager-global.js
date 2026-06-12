/**
 * SyncManager 全局暴露脚本
 * 为打包后的 dual-canvas-viewer-plugin.iife.js 提供全局 syncManager 变量
 */

(function() {
  'use strict';

  // 创建一个更完整的代理对象
  const createSyncManagerProxy = () => {
    const getActualManager = () => window.__syncManager__;

    return new Proxy({}, {
      get: function(target, prop) {
        const manager = getActualManager();
        if (manager && prop in manager) {
          const value = manager[prop];
          // 如果是方法，绑定正确的 this
          if (typeof value === 'function') {
            return value.bind(manager);
          }
          return value;
        }
        // 返回一个空函数以防止错误
        if (prop === 'then') {
          return undefined;
        }
        return function() {
          console.warn('[SyncManagerGlobal] 方法', prop, '被调用但 SyncManager 尚未初始化');
        };
      },
      set: function(target, prop, value) {
        const manager = getActualManager();
        if (manager) {
          manager[prop] = value;
          return true;
        }
        console.warn('[SyncManagerGlobal] 尝试设置属性', prop, '但 SyncManager 尚未初始化');
        return false;
      }
    });
  };

  // 将 syncManager 暴露到全局作用域
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'syncManager', {
      value: createSyncManagerProxy(),
      writable: false,
      configurable: false
    });
    console.log('[SyncManagerGlobal] 全局 syncManager 代理已设置');
  }
})();
