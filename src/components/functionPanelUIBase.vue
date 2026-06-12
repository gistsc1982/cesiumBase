<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div
        v-if="!isClosed"
        class="function-panel"
        :class="{
          'is-dragging': isDragging,
          'is-minimized': isMinimized,
          'blur-enabled': enableBackdropFilter && enableBlur
        }"
        :style="panelStyles"
        ref="panelRef"
        @mousedown="onPanelMouseDown"
      >
        <!-- 面板头部 -->
        <div class="panel-header" @mousedown="onHeaderMouseDown">
          <div class="header-left">
            <div class="drag-indicator">
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
            </div>
            <slot name="header">
              <h3 class="panel-title">{{ title }}</h3>
            </slot>
          </div>
          <div class="header-controls">
            <button
              v-if="allowMinimize"
              @click.stop="toggleMinimize"
              class="icon-btn minimize-btn"
              type="button"
              :aria-label="isMinimized ? '展开' : '最小化'"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path v-if="!isMinimized" d="M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path v-else d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button
              @click.stop="close"
              class="icon-btn close-btn"
              type="button"
              :aria-label="closeTooltip"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 面板内容 -->
        <Transition name="content-slide">
          <div v-show="!isMinimized" class="panel-body" :style="bodyStyles">
            <slot></slot>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- 最小化时的浮动按钮 -->
    <Transition name="fab-fade">
      <button
        v-if="!isClosed && isMinimized"
        class="panel-fab"
        type="button"
        :style="fabStyles"
        @click="toggleMinimize"
        :title="title"
      >
        <span class="fab-icon">{{ titleIcon || '⚙️' }}</span>
        <span class="fab-text">{{ title }}</span>
      </button>
    </Transition>
  </Teleport>
</template>

<script>
import SfcBase from './SfcBase.vue';

// 导入注册相关的工具（可选，如果子组件需要全局注册）
// import { getRegistry, createRegistrationMixin } from '../utils/ComponentRegistry.js';

export default {
  name: 'FunctionPanelUIBase',
  mixins: [SfcBase],
  inject: {
    // 父组件提供的注册方法（可选）
    registerPanelComponent: {
      type: Function,
      default: null
    },
    unregisterPanelComponent: {
      type: Function,
      default: null
    },
    // 父组件提供的获取已注册面板的方法（可选）
    getRegisteredPanels: {
      type: Function,
      default: null
    },
    // ⭐ 获取当前实例ID的函数（多实例支持）
    getInstanceId: {
      type: Function,
      default: () => 1
    },
    // ⭐ 覆盖 SfcBase 的 instanceId inject，避免与 computed 冲突
    instanceId: {
      default: 1
    }
  },
  props: {
    // 自注册配置
    autoRegister: { type: Boolean, default: false },
    registrationKey: { type: String, default: null },
    title: { type: String, default: '面板' },
    titleIcon: { type: String, default: '⚙️' },
    closeTooltip: { type: String, default: '关闭 (ESC)' },
    width: { type: Number, default: 360 },
    height: { type: [Number, String], default: 'auto' },
    maxHeight: { type: [Number, String], default: '70vh' },
    initialX: { type: [Number, String], default: 'center' },
    initialY: { type: Number, default: 80 },
    bodyPadding: { type: String, default: '20px' },
    allowMinimize: { type: Boolean, default: true },
    closeEventName: { type: String, default: 'functionPanelClose' },
    // 性能优化相关配置
    enableBlur: { type: Boolean, default: false }, // 默认禁用模糊效果
    blurAmount: { type: String, default: '8px' }, // 降低默认模糊值
    enableBackdropFilter: { type: Boolean, default: false } // 是否启用 backdrop-filter（性能敏感）
  },
  data() {
    return {
      componentName: 'FunctionPanelUIBase',
      // 自注册状态
      _registryRegistered: false,
      // 位置状态 - 使用响应式数字
      x: 0,
      y: 0,
      // 拖动状态
      isDragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      // 面板状态
      isMinimized: false,
      isClosed: false,
      // 事件处理器引用
      boundMouseMove: null,
      boundMouseUp: null,
      // 性能优化：缓存面板尺寸
      cachedPanelWidth: null,
      cachedPanelHeight: null
    };
  },
  computed: {
    panelStyles() {
      return {
        width: typeof this.width === 'number' ? `${this.width}px` : this.width,
        height: typeof this.height === 'number' ? `${this.height}px` : this.height,
        maxHeight: typeof this.maxHeight === 'number' ? `${this.maxHeight}px` : this.maxHeight,
        transform: `translate(${this.x}px, ${this.y}px)`,
        transition: this.isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.3s ease'
      };
    },
    bodyStyles() {
      return {
        padding: this.bodyPadding
      };
    },
    fabStyles() {
      return {
        transform: `translate(${this.x + this.width / 2 - 40}px, ${this.y}px)`
      };
    }
  },
  mounted() {
    // 自注册逻辑
    if (this.autoRegister && this.registrationKey) {
      this.registerToParent();
    }

    this.initCesium(() => {
      this.$nextTick(() => {
        this.initPosition();
      });
    });

    // ESC 键关闭
    this.boundHandleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.boundHandleKeydown);
  },
  beforeUnmount() {
    // 自注销逻辑
    if (this.autoRegister && this.registrationKey) {
      this.unregisterFromParent();
    }

    // 清理事件监听
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }
    if (this.boundHandleKeydown) {
      document.removeEventListener('keydown', this.boundHandleKeydown);
    }
    this.cleanup();
  },
  methods: {
    /**
     * 获取实例特定的配置
     * @returns {Object|null} 实例配置
     */
    getInstanceConfig() {
      // 从多实例配置管理器获取实例特定的配置
      if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__) {
        return window.__multiInstancePanelConfigManager__.getPanelConfig(
          this.instanceId,
          this.registrationKey
        );
      }
      return null;
    },

    /**
     * 注册到父组件（自注册方法）
     */
    registerToParent() {
      if (!this.registrationKey) {
        console.warn('[FunctionPanelUIBase] 缺少 registrationKey，无法自动注册');
        return;
      }

      // 方式1: 通过 inject 的注册方法（优先）
      if (this.registerPanelComponent && typeof this.registerPanelComponent === 'function') {
        // ⭐ 获取实例特定的配置
        const instanceConfig = this.getInstanceConfig();

        // 合并props：实例配置优先，然后是组件自身的props
        const mergedProps = {
          ...this.$props,
          ...(instanceConfig?.position || {})
        };

        // 使用实例配置的可见性，如果没有则默认为true
        const visible = instanceConfig ? instanceConfig.visible : true;

        this.registerPanelComponent(this.registrationKey, {
          component: this,
          props: mergedProps,
          visible: visible
        });
        this._registryRegistered = true;
        console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.registrationKey} 已注册, visible: ${visible}, position:`, mergedProps);
        return;
      }

      // 方式2: 触发自定义事件，通知父组件
      this.$emit('register-panel', {
        key: this.registrationKey,
        component: this,
        props: this.$props
      });
      this._registryRegistered = true;
      console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.registrationKey} 已通过事件注册`);
    },

    /**
     * 从父组件注销（自注销方法）
     */
    unregisterFromParent() {
      if (!this.registrationKey) return;

      // 方式1: 通过 inject 的注销方法（优先）
      if (this.unregisterPanelComponent && typeof this.unregisterPanelComponent === 'function') {
        this.unregisterPanelComponent(this.registrationKey);
        console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过 inject 注销`);
        return;
      }

      // 方式2: 触发自定义事件，通知父组件
      this.$emit('unregister-panel', {
        key: this.registrationKey
      });
      console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过事件注销`);
    },

    /**
     * 初始化面板位置
     */
    initPosition() {
      let x = this.initialX;

      if (x === 'center') {
        const panel = this.$refs.panelRef;
        const panelWidth = panel ? panel.offsetWidth : this.width;
        x = Math.round((window.innerWidth - panelWidth) / 2);
      } else if (x === 'right') {
        const panel = this.$refs.panelRef;
        const panelWidth = panel ? panel.offsetWidth : this.width;
        x = Math.round(window.innerWidth - panelWidth - 20);
      } else if (typeof x !== 'number') {
        x = 20;
      }

      // 确保 x 在可见范围内
      x = Math.max(20, Math.min(x, window.innerWidth - this.width - 20));

      this.x = x;
      this.y = Math.max(20, Math.min(this.initialY, window.innerHeight - 100));
    },

    /**
     * 头部 mousedown - 开始拖动
     */
    onHeaderMouseDown(event) {
      // 只响应左键
      if (event.button !== 0) return;
      // 忽略按钮点击
      if (event.target.closest('.icon-btn')) return;

      event.preventDefault();
      this.startDrag(event);
    },

    /**
     * 面板 mousedown - 阻止默认拖动行为
     */
    onPanelMouseDown(event) {
      // 只在头部区域允许拖动
    },

    /**
     * 开始拖动
     */
    startDrag(event) {
      this.isDragging = true;

      // 计算鼠标点击位置相对于面板左上角的偏移
      const rect = this.$refs.panelRef.getBoundingClientRect();
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;

      // 性能优化：缓存面板尺寸
      this.cachedPanelWidth = rect.width;
      this.cachedPanelHeight = rect.height;

      // 绑定拖动事件
      this.boundMouseMove = this.onMouseMove.bind(this);
      this.boundHandleMouseUp = this.onMouseUp.bind(this);

      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundHandleMouseUp);

      // 添加全局样式
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },

    /**
     * 鼠标移动 - 拖动中
     */
    onMouseMove(event) {
      if (!this.isDragging) return;

      // 计算新位置
      let newX = event.clientX - this.dragOffsetX;
      let newY = event.clientY - this.dragOffsetY;

      // 边界限制 - 保持至少部分可见
      // 性能优化：使用缓存的尺寸，避免频繁 DOM 查询
      const panelWidth = this.cachedPanelWidth || this.width;
      const panelHeight = this.cachedPanelHeight || 200;
      const minVisible = 40; // 至少保留40像素可见

      // X 方向边界
      const minX = -panelWidth + minVisible;
      const maxX = window.innerWidth - minVisible;
      newX = Math.max(minX, Math.min(newX, maxX));

      // Y 方向边界
      const minY = 0;
      const maxY = window.innerHeight - 60;
      newY = Math.max(minY, Math.min(newY, maxY));

      // 更新位置
      this.x = Math.round(newX);
      this.y = Math.round(newY);
    },

    /**
     * 鼠标释放 - 结束拖动
     */
    onMouseUp() {
      if (!this.isDragging) return;

      this.isDragging = false;

      // 移除事件监听
      if (this.boundMouseMove) {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
        this.boundMouseMove = null;
        this.boundHandleMouseUp = null;
      }

      // 恢复全局样式
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // 边缘吸附（可选）
      this.snapToEdge();
    },

    /**
     * 边缘吸附
     */
    snapToEdge() {
      const threshold = 30;
      const panel = this.$refs.panelRef;
      if (!panel) return;

      // 性能优化：使用缓存的尺寸
      const rect = panel.getBoundingClientRect();
      let snapped = false;

      // 左边缘
      if (Math.abs(rect.left) < threshold && rect.left >= -20) {
        this.x = 0;
        snapped = true;
      }
      // 右边缘
      else if (Math.abs(rect.right - window.innerWidth) < threshold) {
        this.x = window.innerWidth - (this.cachedPanelWidth || rect.width);
        snapped = true;
      }
      // 顶部边缘
      if (rect.top < threshold && rect.top >= -20) {
        this.y = 0;
        snapped = true;
      }

      if (snapped) {
        // 添加吸附动画
        setTimeout(() => {
          this.$el?.classList.add('snapped');
          setTimeout(() => {
            this.$el?.classList.remove('snapped');
          }, 300);
        }, 0);
      }

      // 清除缓存
      this.cachedPanelWidth = null;
      this.cachedPanelHeight = null;
    },

    /**
     * 切换最小化
     */
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      this.$emit(this.isMinimized ? 'minimize' : 'expand');
    },

    /**
     * 关闭面板
     */
    close() {
      this.isClosed = true;

      // 等待关闭动画完成
      setTimeout(() => {
        this.$emit('close');

        if (typeof window !== 'undefined') {
          const event = new CustomEvent(this.closeEventName, {
            detail: { componentName: this.componentName }
          });
          window.dispatchEvent(event);
        }

        if (this.onClose && typeof this.onClose === 'function') {
          this.onClose();
        }
      }, 300);
    },

    /**
     * 键盘事件处理
     */
    handleKeydown(event) {
      if (event.key === 'Escape') {
        this.close();
      }
    }
  }
};
</script>

<style scoped>
/* ==================== 主面板 ==================== */
.function-panel {
  position: fixed;
  top: 0;
  left: 0;
  /* 优化：使用更高效的纯色背景，避免 backdrop-filter 性能消耗 */
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  /* 优化：简化阴影层数，减少 GPU 负担 */
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(0, 0, 0, 0.2);
  z-index: 100000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  will-change: transform;
  /* 优化：移除硬件加速以减少合成层创建 */
  /* will-change: transform; */
}

/* 仅在启用 backdrop-filter 时应用（可选） */
.function-panel.blur-enabled {
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
}

.function-panel.is-dragging {
  box-shadow:
    0 0 0 1px rgba(76, 175, 80, 0.3) inset,
    0 1px 3px rgba(76, 175, 80, 0.2) inset,
    0 30px 80px rgba(0, 0, 0, 0.6),
    0 0 120px rgba(76, 175, 80, 0.25);
  border-color: rgba(76, 175, 80, 0.4);
  cursor: grabbing;
}

.function-panel.snapped {
  transition: transform 0.2s ease-out !important;
}

/* ==================== 面板头部 ==================== */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  /* 优化：使用纯色背景替代渐变，减少渲染开销 */
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  position: relative;
}

.panel-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4CAF50, #2E7D32);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);
}

.panel-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.drag-indicator {
  display: flex;
  gap: 3px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.panel-header:hover .drag-indicator {
  opacity: 0.7;
}

.grip-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  transform: scale(1.08);
}

.icon-btn:active {
  transform: scale(0.95);
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
  box-shadow: 0 0 16px rgba(255, 59, 48, 0.4);
}

.minimize-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

/* ==================== 面板内容 ==================== */
.panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* 优化：使用纯色背景替代渐变 */
  background: rgba(0, 0, 0, 0.25);
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.6), rgba(76, 175, 80, 0.3));
  border-radius: 3px;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.5));
}

/* ==================== 浮动按钮 ==================== */
.panel-fab {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  /* 优化：使用纯色背景替代 backdrop-filter */
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(76, 175, 80, 0.5);
  border-radius: 50px;
  /* 优化：简化阴影 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 12px rgba(76, 175, 80, 0.15);
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  z-index: 99999;
  transition: all 0.2s ease;
}

.panel-fab:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(76, 175, 80, 0.35);
  border-color: rgba(76, 175, 80, 0.7);
}

.panel-fab:active {
  transform: scale(0.98);
}

.fab-icon {
  font-size: 16px;
  line-height: 1;
}

.fab-text {
  white-space: nowrap;
}

/* ==================== 过渡动画 ==================== */
.panel-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.panel-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translate(var(--x, 0), calc(var(--y, 0) + 20px)) scale(0.95);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: translate(var(--x, 0), calc(var(--y, 0) - 10px)) scale(0.98);
}

.content-slide-enter-active,
.content-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.content-slide-enter-from,
.content-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: translate(var(--x, 0), var(--y, 0)) scale(0.8);
}

/* ==================== 响应式 ==================== */
@media (max-width: 480px) {
  .function-panel {
    width: calc(100vw - 16px) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .function-panel,
  .panel-fab,
  .icon-btn,
  * {
    transition-duration: 0.01ms !important;
  }
}
</style>
