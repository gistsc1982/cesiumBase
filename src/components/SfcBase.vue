<template>
  <!-- 基础组件无界面元素，仅作为逻辑基类 -->
  <div class="sfc-base" style="display: none;"></div>
</template>

<script>
/**
 * SfcBase - 动态加载组件的基础类
 *
 * 功能：
 * - 提供 Cesium 就绪检查和等待机制（事件驱动）
 * - 提供通用的工具方法（坐标验证、消息显示等）
 * - 提供基础事件处理框架
 * - 不包含任何界面元素（按钮、输入框等）
 *
 * 使用方式：
 * 在子组件中通过 mixins 或 extends 继承
 */
import cesiumEventManager from '../utils/CesiumEventManager.js';

export default {
  name: 'SfcBase',
  props: {
    onClose: {
      type: Function,
      default: null
    },
    // ⭐ 面板实例ID（多实例面板使用）
    // 通过此 prop 区分单例和多实例模式
    panelInstanceId: {
      type: Number,
      default: null
    }
  },
  inject: {
    instanceId: {
      default: 1
    }
  },
  data() {
    return {
      // Cesium 相关状态
      cesiumReady: false,
      // 通用状态
      componentName: 'SfcBase',
      // 事件绑定存储
      boundEventHandlers: {},
      // Cesium 事件监听器取消函数
      cesiumUnsubscribe: null
    };
  },
  computed: {
    /**
     * ⭐ 判断当前是否为单例模式
     * @returns {boolean} true 表示单例模式，false 表示多实例模式
     */
    isSingleton() {
      return this.panelInstanceId === null || this.panelInstanceId === undefined;
    },
    /**
     * ⭐ 判断当前是否为多实例模式
     * @returns {boolean} true 表示多实例模式，false 表示单例模式
     */
    isMultiInstance() {
      return !this.isSingleton;
    },
    /**
     * ⭐ 获取面板实例的唯一标识
     * 单例模式：返回 effectiveRegistrationKey
     * 多实例模式：返回 effectiveRegistrationKey_panelInstanceId
     */
    panelInstanceKey() {
      if (this.isSingleton) {
        return this.effectiveRegistrationKey || this.componentName;
      } else {
        return `${this.effectiveRegistrationKey || this.componentName}_${this.panelInstanceId}`;
      }
    }
  },
  methods: {
    // ==================== Cesium 检查方法 ====================

    /**
     * 检查 Cesium 是否已就绪
     * @returns {boolean} Cesium 是否就绪
     */
    checkCesiumReady() {
      if (typeof window !== 'undefined' &&
          typeof window.Cesium !== 'undefined' &&
          window.__cesiumViewer__) {
        this.cesiumReady = true;
        this.$logger?.info?.('[SfcBase] Cesium 已就绪');
        return true;
      }
      return false;
    },

    /**
     * 等待 Cesium 初始化完成（事件驱动方式）
     * @param {Function} callback - Cesium 就绪后的回调
     * @param {number} timeout - 超时时间（毫秒，默认5000ms）
     */
    waitForCesium(callback, timeout = 5000) {
      // 取消之前的监听
      if (this.cesiumUnsubscribe) {
        this.cesiumUnsubscribe();
        this.cesiumUnsubscribe = null;
      }

      // 如果已经就绪，立即执行回调
      if (this.checkCesiumReady()) {
        if (callback && typeof callback === 'function') {
          callback();
        }
        return;
      }

      // 设置超时
      let timeoutId = null;
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (this.cesiumUnsubscribe) {
            this.cesiumUnsubscribe();
            this.cesiumUnsubscribe = null;
          }
          this.$logger?.warn?.(`[${this.componentName}] Cesium 初始化超时 (${timeout}ms)`);
        }, timeout);
      }

      // 使用事件管理器监听就绪事件
      this.cesiumUnsubscribe = cesiumEventManager.onReady((cesium, viewer) => {
        // 清除超时
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        this.cesiumReady = true;
        this.$logger?.info?.(`[${this.componentName}] Cesium 已就绪（事件驱动）`);

        if (callback && typeof callback === 'function') {
          callback(cesium, viewer);
        }
      });
    },

    /**
     * 获取 Cesium Viewer 实例
     * @returns {Object|null} Cesium Viewer 实例
     */
    getCesiumViewer() {
      if (this.checkCesiumReady()) {
        return window.__cesiumViewer__;
      }
      this.$logger?.warn?.(`[${this.componentName}] Cesium 未就绪，无法获取 Viewer`);
      return null;
    },

    /**
     * 获取 Cesium 全局对象
     * @returns {Object|null} Cesium 全局对象
     */
    getCesium() {
      if (typeof window !== 'undefined' && typeof window.Cesium !== 'undefined') {
        return window.Cesium;
      }
      this.$logger?.warn?.(`[${this.componentName}] Cesium 全局对象不存在`);
      return null;
    },

    // ==================== 坐标验证方法 ====================

    /**
     * 验证坐标值是否在有效范围内
     * @param {number} value - 坐标值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {boolean} 是否有效
     */
    isValidCoordinate(value, min, max) {
      return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
    },

    /**
     * 验证经纬度坐标
     * @param {number} longitude - 经度
     * @param {number} latitude - 纬度
     * @param {number} height - 高度（可选）
     * @returns {Object} 验证结果 { valid: boolean, message: string }
     */
    validateLonLat(longitude, latitude, height = null) {
      if (!this.isValidCoordinate(longitude, -180, 180)) {
        return { valid: false, message: '经度必须在 -180 到 180 之间' };
      }
      if (!this.isValidCoordinate(latitude, -90, 90)) {
        return { valid: false, message: '纬度必须在 -90 到 90 之间' };
      }
      if (height !== null && !this.isValidCoordinate(height, -1000, 100000)) {
        return { valid: false, message: '高度必须在合理范围内' };
      }
      return { valid: true, message: '坐标有效' };
    },

    // ==================== 消息显示方法 ====================

    /**
     * 显示临时消息（需子类实现具体显示逻辑）
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型（info, success, error, warning）
     * @param {number} duration - 显示时长（毫秒）
     */
    showMessage(message, type = 'info', duration = 3000) {
      // 基类提供默认实现（子类可覆盖）
      this.$logger?.info?.(`[${this.componentName}] ${type.toUpperCase()}: ${message}`);

      // 如果子类有 data 属性用于显示消息，则设置
      if (typeof this.messageContent !== 'undefined') {
        this.messageContent = message;
      }
      if (typeof this.messageType !== 'undefined') {
        this.messageType = type;
      }

      // 自动清除
      if (duration > 0 && typeof this.clearMessage === 'function') {
        setTimeout(() => this.clearMessage(), duration);
      }
    },

    /**
     * 清除消息（子类可覆盖）
     */
    clearMessage() {
      if (typeof this.messageContent !== 'undefined') {
        this.messageContent = '';
      }
    },

    // ==================== 事件处理方法 ====================

    /**
     * 触发关闭事件
     */
    handleClose() {
      if (typeof window !== 'undefined') {
        // 触发自定义事件
        const closeEvent = new CustomEvent(this.closeEventName, {
          detail: {
            componentName: this.componentName,
            instanceId: this.instanceId
          }
        });
        window.dispatchEvent(closeEvent);

        // 调用关闭回调
        if (this.onClose && typeof this.onClose === 'function') {
          this.onClose();
        }

        this.$logger?.info?.(`[${this.componentName}] 关闭事件已触发`);
      }
    },

    /**
     * 绑定事件处理器（自动管理绑定和解绑）
     * @param {string} key - 处理器键名
     * @param {Function} handler - 处理器函数
     * @returns {Function} 绑定后的处理器
     */
    bindEventHandler(key, handler) {
      if (typeof handler !== 'function') {
        this.$logger?.warn?.(`[${this.componentName}] 事件处理器必须是函数`);
        return null;
      }

      const boundHandler = handler.bind(this);
      this.boundEventHandlers[key] = boundHandler;
      return boundHandler;
    },

    /**
     * 获取绑定的事件处理器
     * @param {string} key - 处理器键名
     * @returns {Function|null} 绑定的处理器
     */
    getBoundHandler(key) {
      return this.boundEventHandlers[key] || null;
    },

    /**
     * 清除所有绑定的事件处理器
     */
    clearBoundHandlers() {
      this.boundEventHandlers = {};
    },

    // ==================== 相机操作方法 ====================

    /**
     * 飞行到指定位置
     * @param {number} longitude - 经度
     * @param {number} latitude - 纬度
     * @param {number} height - 高度
     * @param {Object} orientation - 相机方向 { heading, pitch, roll }
     * @param {number} duration - 飞行时长（秒）
     * @returns {Promise} 飞行完成的 Promise
     */
    flyToPosition(longitude, latitude, height, orientation = {}, duration = 2.0) {
      return new Promise((resolve, reject) => {
        const viewer = this.getCesiumViewer();
        if (!viewer) {
          reject(new Error('Cesium Viewer 不可用'));
          return;
        }

        const Cesium = this.getCesium();
        if (!Cesium) {
          reject(new Error('Cesium 全局对象不可用'));
          return;
        }

        try {
          const destination = Cesium.Cartesian3.fromDegrees(
            longitude,
            latitude,
            height
          );

          const defaultOrientation = {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
          };

          viewer.camera.flyTo({
            destination: destination,
            orientation: { ...defaultOrientation, ...orientation },
            duration: duration,
            complete: () => resolve(),
            cancel: () => reject(new Error('飞行操作被取消'))
          });
        } catch (error) {
          reject(error);
        }
      });
    },

    /**
     * 相机看地
     * @param {number} longitude - 经度
     * @param {number} latitude - 纬度
     * @param {number} height - 高度
     * @returns {Promise} 看地完成的 Promise
     */
    viewGround(longitude, latitude, height = 0) {
      return this.flyToPosition(longitude, latitude, height, {
        heading: 0,
        pitch: -90,
        roll: 0
      }, 1.5);
    },

    // ==================== 日志工具 ====================

    /**
     * 创建日志对象（子类可覆盖）
     * @returns {Object} 日志对象
     */
    createLogger() {
      const prefix = `[${this.componentName}]`;
      return {
        info: (msg) => console.log(`${prefix} ${msg}`),
        warn: (msg) => console.warn(`${prefix} ⚠️ ${msg}`),
        error: (msg) => console.error(`${prefix} ❌ ${msg}`),
        debug: (msg) => console.debug(`${prefix} 🔍 ${msg}`)
      };
    },

    // ==================== 生命周期钩子辅助方法 ====================

    /**
     * 初始化 Cesium（在 mounted 中调用）
     * @param {Function} onReady - Cesium 就绪后的回调
     */
    initCesium(onReady) {
      this.$logger = this.createLogger();
      this.$logger?.info?.('组件初始化');

      if (this.checkCesiumReady()) {
        this.cesiumReady = true;
        if (onReady) onReady();
      } else {
        this.$logger?.info?.('等待 Cesium 初始化（事件驱动）...');
        this.waitForCesium((cesium, viewer) => {
          this.$logger?.info?.('Cesium 已就绪');
          if (onReady) onReady(cesium, viewer);
        });
      }
    },

    /**
     * 清理资源（在 beforeUnmount 中调用）
     */
    cleanup() {
      // 取消 Cesium 事件监听
      if (this.cesiumUnsubscribe) {
        this.cesiumUnsubscribe();
        this.cesiumUnsubscribe = null;
      }

      // 清除事件处理器绑定
      this.clearBoundHandlers();

      this.$logger?.info?.('资源已清理');
    }
  },
  mounted() {
    // 基类 mounted 不做任何事，由子类决定是否调用 initCesium
  },
  beforeUnmount() {
    // 基类 beforeUnmount 只做基本清理
    this.cleanup();
  }
};
</script>

<style>
/* SfcBase 无样式，仅作为逻辑基类 */
.sfc-base {
  display: none;
}
</style>
