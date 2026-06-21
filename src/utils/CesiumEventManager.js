/**
 * CesiumEventManager - Cesium 事件管理器
 *
 * 提供 Cesium 就绪状态的事件驱动机制
 * 替代轮询检查，提升性能
 */

class CesiumEventManager {
  constructor() {
    // Cesium 就绪状态
    this.isReady = false;

    // 事件监听器列表
    this.listeners = new Set();

    // Cesium 实例
    this.cesiumInstance = null;

    // Viewer 实例
    this.viewerInstance = null;

    // 检查间隔（用于降级方案）
    this.checkInterval = null;
    this.checkAttempts = 0;
    this.maxAttempts = 50; // 最多 5 秒 (50 * 100ms)
  }

  /**
   * 初始化事件管理器
   */
  init() {
    if (typeof window === 'undefined') return;

    // 检查是否已经就绪
    if (this.checkCesiumReady()) {
      this.setReady();
      return;
    }

    // 设置全局监听
    this.setupGlobalListener();

    // 开始轮询检查（降级方案）
    this.startPolling();
  }

  /**
   * 检查 Cesium 是否就绪
   * @returns {boolean}
   */
  checkCesiumReady() {
    if (typeof window === 'undefined') return false;

    const cesiumReady = typeof window.Cesium !== 'undefined';
    const viewerReady = typeof window.__cesiumViewer__ !== 'undefined';

    return cesiumReady && viewerReady;
  }

  /**
   * 设置全局监听器
   */
  setupGlobalListener() {
    // 监听自定义事件
    window.addEventListener('cesium-ready', this.handleCesiumReady);
    window.addEventListener('cesium-viewer-ready', this.handleViewerReady);
  }

  /**
   * 移除全局监听器
   */
  removeGlobalListener() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('cesium-ready', this.handleCesiumReady);
    window.removeEventListener('cesium-viewer-ready', this.handleViewerReady);
  }

  /**
   * 处理 Cesium 就绪事件
   */
  handleCesiumReady = () => {
    console.log('[CesiumEventManager] 📡 收到 cesium-ready 事件');
    this.cesiumInstance = window.Cesium;

    // 如果 viewer 也准备好了，设置就绪状态
    if (window.__cesiumViewer__) {
      this.setReady();
    }
  };

  /**
   * 处理 Viewer 就绪事件
   */
  handleViewerReady = () => {
    console.log('[CesiumEventManager] 📡 收到 cesium-viewer-ready 事件');
    this.viewerInstance = window.__cesiumViewer__;

    // 如果 cesium 也准备好了，设置就绪状态
    if (window.Cesium) {
      this.setReady();
    }
  };

  /**
   * 开始轮询检查（降级方案）
   */
  startPolling() {
    if (this.checkInterval) return;

    this.checkAttempts = 0;
    this.checkInterval = setInterval(() => {
      this.checkAttempts++;

      if (this.checkCesiumReady()) {
        this.setReady();
        this.stopPolling();
      } else if (this.checkAttempts >= this.maxAttempts) {
        console.warn('[CesiumEventManager] ⏰ Cesium 初始化检查超时');
        this.stopPolling();
      }
    }, 100);
  }

  /**
   * 停止轮询检查
   */
  stopPolling() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 设置就绪状态
   */
  setReady() {
    if (this.isReady) return;

    this.isReady = true;
    this.cesiumInstance = window.Cesium;
    this.viewerInstance = window.__cesiumViewer__;

    console.log('[CesiumEventManager] ✅ Cesium 已就绪');

    // 停止轮询
    this.stopPolling();

    // 触发所有监听器
    this.notifyListeners();

    // 触发全局事件
    this.dispatchGlobalEvent();
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.cesiumInstance, this.viewerInstance);
      } catch (error) {
        console.error('[CesiumEventManager] ❌ 监听器执行失败:', error);
      }
    });
  }

  /**
   * 触发全局事件
   */
  dispatchGlobalEvent() {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('cesium-all-ready', {
      detail: {
        cesium: this.cesiumInstance,
        viewer: this.viewerInstance
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * 添加监听器
   * @param {Function} listener - 监听器函数
   * @returns {Function} 取消监听函数
   */
  onReady(listener) {
    if (typeof listener !== 'function') {
      console.warn('[CesiumEventManager] ⚠️ 监听器必须是函数');
      return () => {};
    }

    // 如果已经就绪，立即执行
    if (this.isReady) {
      try {
        listener(this.cesiumInstance, this.viewerInstance);
      } catch (error) {
        console.error('[CesiumEventManager] ❌ 监听器执行失败:', error);
      }
    } else {
      // 添加到监听器列表
      this.listeners.add(listener);
    }

    // 返回取消监听函数
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Promise 方式等待就绪
   * @returns {Promise<{cesium: Object, viewer: Object}>}
   */
  async ready() {
    return new Promise((resolve) => {
      const unsubscribe = this.onReady((cesium, viewer) => {
        unsubscribe();
        resolve({ cesium, viewer });
      });
    });
  }

  /**
   * 获取 Cesium 实例
   * @returns {Object|null}
   */
  getCesium() {
    return this.cesiumInstance;
  }

  /**
   * 获取 Viewer 实例
   * @returns {Object|null}
   */
  getViewer() {
    return this.viewerInstance;
  }

  /**
   * 重置状态（用于测试）
   */
  reset() {
    this.isReady = false;
    this.cesiumInstance = null;
    this.viewerInstance = null;
    this.listeners.clear();
    this.stopPolling();
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.stopPolling();
    this.removeGlobalListener();
    this.listeners.clear();
    this.isReady = false;
    this.cesiumInstance = null;
    this.viewerInstance = null;
  }
}

// 创建全局单例（优先使用已存在的全局实例，确保只有一个实例）
const existingManager = typeof window !== 'undefined' && window.__cesiumEventManager__;
const eventManager = existingManager || new CesiumEventManager();

// 如果是新创建的实例，注册到全局并初始化
if (!existingManager && typeof window !== 'undefined') {
  window.__cesiumEventManager__ = eventManager;

  // 自动初始化
  // 延迟初始化，确保 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      eventManager.init();
    });
  } else {
    eventManager.init();
  }
}

export default eventManager;
