/**
 * CesiumHelper - Cesium 辅助工具
 *
 * 提供便捷的 Cesium 事件监听和操作方法
 */

import cesiumEventManager from './CesiumEventManager.js';

class CesiumHelper {
  /**
   * 等待 Cesium 就绪
   * @returns {Promise<{cesium: Object, viewer: Object}>}
   */
  static async ready() {
    return cesiumEventManager.ready();
  }

  /**
   * 监听 Cesium 就绪事件
   * @param {Function} callback - 回调函数 (cesium, viewer) => {}
   * @returns {Function} 取消监听函数
   */
  static onReady(callback) {
    return cesiumEventManager.onReady(callback);
  }

  /**
   * 检查 Cesium 是否就绪
   * @returns {boolean}
   */
  static isReady() {
    return cesiumEventManager.isReady;
  }

  /**
   * 获取 Cesium 实例
   * @returns {Object|null}
   */
  static getCesium() {
    return cesiumEventManager.getCesium();
  }

  /**
   * 获取 Viewer 实例
   * @returns {Object|null}
   */
  static getViewer() {
    return cesiumEventManager.getViewer();
  }

  /**
   * 在 Cesium 就绪后执行函数
   * @param {Function} fn - 要执行的函数
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise}
   */
  static async execute(fn, timeout = 5000) {
    const { cesium, viewer } = await this.ready(timeout);
    return fn(cesium, viewer);
  }

  /**
   * Vue Mixin - 在组件中使用 Cesium
   *
   * 使用示例：
   * import { CesiumMixin } from '@/utils/CesiumHelper.js';
   * export default {
   *   mixins: [CesiumMixin],
   *   mounted() {
   *     this.whenCesiumReady((cesium, viewer) => {
   *       // 使用 Cesium
   *     });
   *   }
   * }
   */
  static get CesiumMixin() {
    return {
      data() {
        return {
          cesiumReady: false,
          cesiumUnsubscribe: null
        };
      },

      mounted() {
        // 检查是否已经就绪
        if (CesiumHelper.isReady()) {
          this.cesiumReady = true;
          this.onCesiumReady && this.onCesiumReady(CesiumHelper.getCesium(), CesiumHelper.getViewer());
        } else {
          // 监听就绪事件
          this.cesiumUnsubscribe = CesiumHelper.onReady((cesium, viewer) => {
            this.cesiumReady = true;
            this.onCesiumReady && this.onCesiumReady(cesium, viewer);
          });
        }
      },

      beforeUnmount() {
        // 取消监听
        if (this.cesiumUnsubscribe) {
          this.cesiumUnsubscribe();
          this.cesiumUnsubscribe = null;
        }
      },

      computed: {
        cesium() {
          return CesiumHelper.getCesium();
        },
        cesiumViewer() {
          return CesiumHelper.getViewer();
        }
      }
    };
  }
}

// 暴露到全局（用于调试）
if (typeof window !== 'undefined') {
  window.__CesiumHelper__ = CesiumHelper;
}

export default CesiumHelper;
