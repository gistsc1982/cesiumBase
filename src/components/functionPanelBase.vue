<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div
        v-if="!isClosed"
        class="function-panel"
        :class="[
          panelClass,
          {
            'is-dragging': isDragging,
            'is-minimized': isMinimized,
            'is-maximized': isMaximized,
            'has-shadow': !isDragging
          }
        ]"
        :style="panelStyle"
        ref="panelRef"
      >
        <!-- 面板头部 -->
        <div
          class="function-panel-header"
          :class="{ dragging: isDragging }"
          @mousedown="startDrag"
        >
          <!-- 拖动手柄指示器 -->
          <div class="drag-handle">
            <span class="handle-dots"></span>
          </div>

          <!-- 标题区域 -->
          <div class="header-content">
            <slot name="header">
              <h3>{{ title }}</h3>
            </slot>
          </div>

          <!-- 控制按钮组 -->
          <div class="header-controls">
            <!-- 最小化/展开按钮 -->
            <button
              v-if="allowMinimize"
              @click.stop="toggleMinimize"
              class="control-btn minimize-btn"
              :title="isMinimized ? '展开' : '最小化'"
            >
              <svg v-if="!isMinimized" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>

            <!-- 关闭按钮 -->
            <button
              @click.stop="handleClose"
              class="control-btn close-btn"
              :title="closeTooltip"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 面板主体内容（带折叠动画） -->
        <Transition name="panel-slide">
          <div v-show="!isMinimized" class="function-panel-body" :style="bodyStyle">
            <slot></slot>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- 最小化后的浮动按钮 -->
    <Transition name="fab-fade">
      <div
        v-if="!isClosed && isMinimized"
        class="panel-fab"
        :style="fabStyle"
        @click="toggleMinimize"
        :title="title"
      >
        <span class="fab-icon">{{ titleIcon || '🔧' }}</span>
        <span class="fab-label">{{ title }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import SfcBase from './SfcBase.vue';

/**
 * functionPanelBase - 可移动、可关闭的功能面板基类
 *
 * 功能：
 * - 提供可拖动的面板容器
 * - 支持最小化/最大化
 * - 智能边缘吸附
 * - 平滑动画过渡
 * - 现代玻璃态设计
 */
export default {
  name: 'FunctionPanelBase',
  mixins: [SfcBase],
  props: {
    // 面板标题
    title: {
      type: String,
      default: '功能面板'
    },
    // 标题图标（用于最小化时的 FAB 显示）
    titleIcon: {
      type: String,
      default: '🔧'
    },
    // 关闭按钮提示文字
    closeTooltip: {
      type: String,
      default: '关闭 (Esc)'
    },
    // 面板宽度
    width: {
      type: Number,
      default: 360
    },
    // 面板最大高度
    maxHeight: {
      type: [String, Number],
      default: 'calc(100vh - 180px)'
    },
    // 初始位置 { x, y }
    initialPosition: {
      type: Object,
      default: () => ({ x: 'auto', y: 0 })
    },
    // 当x为'auto'时的right值
    initialRight: {
      type: Number,
      default: 20
    },
    // 面板主体的额外样式
    bodyStyle: {
      type: Object,
      default: () => ({})
    },
    // 面板的额外类名
    panelClass: {
      type: String,
      default: ''
    },
    // 是否允许最小化
    allowMinimize: {
      type: Boolean,
      default: true
    },
    // 是否允许边缘吸附
    allowSnap: {
      type: Boolean,
      default: true
    },
    // 吸附阈值（像素）
    snapThreshold: {
      type: Number,
      default: 20
    },
    // 关闭事件名称
    closeEventName: {
      type: String,
      default: 'functionPanelClose'
    }
  },
  inject: {
    instanceId: {
      default: 1
    }
  },
  data() {
    return {
      componentName: 'FunctionPanelBase',
      // 位置状态
      position: { ...this.initialPosition },
      right: this.initialRight,
      // 拖动状态
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      initialPosition: { x: 0, y: 0 },
      // 面板状态
      isMinimized: false,
      isMaximized: false,
      isClosed: false,
      // 事件处理器
      boundOnDrag: null,
      boundStopDrag: null,
      // 吸附状态
      snappedEdge: null // 'left' | 'right' | 'top' | 'bottom' | null
    };
  },
  computed: {
    panelStyle() {
      const baseStyle = {
        width: this.width + 'px',
        maxHeight: typeof this.maxHeight === 'number' ? this.maxHeight + 'px' : this.maxHeight,
        left: this.position.x === 'auto' ? 'auto' : this.position.x + 'px',
        top: this.position.y + 'px',
        right: this.position.x === 'auto' ? this.right + 'px' : 'auto'
      };

      // 拖动时禁用过渡以获得即时响应
      if (this.isDragging) {
        baseStyle.transition = 'none';
      }

      return baseStyle;
    },
    fabStyle() {
      return {
        left: this.position.x === 'auto' ? 'auto' : (this.position.x + this.width / 2 - 28) + 'px',
        top: this.position.y + 'px',
        right: this.position.x === 'auto' ? (this.right + this.width / 2 - 28) + 'px' : 'auto'
      };
    }
  },
  methods: {
    /**
     * 初始化面板位置
     */
    initPosition(customPosition = null) {
      if (customPosition) {
        this.position = { ...customPosition };
      } else if (this.position.x === 'auto') {
        // 计算底部中间位置，考虑安全边距
        const safeBottom = 100;
        const x = Math.max(20, Math.min((window.innerWidth - this.width) / 2, window.innerWidth - this.width - 20));
        const y = Math.max(safeBottom, window.innerHeight - 450);
        this.position = { x, y };
      }
    },

    /**
     * 开始拖动
     */
    startDrag(event) {
      if (event.button !== 0) return;
      if (event.target.closest('.control-btn')) return;

      event.stopPropagation();
      event.preventDefault();

      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };

      const rect = this.$refs.panelRef.getBoundingClientRect();
      this.initialPosition = { x: rect.left, y: rect.top };

      // 转换定位方式
      if (this.position.x === 'auto' || typeof this.position.x !== 'number') {
        this.position = { x: rect.left, y: rect.top };
        this.right = 'auto';
      }

      // 清除吸附状态
      this.snappedEdge = null;

      this.boundOnDrag = this.bindEventHandler('onDrag', this.onDrag);
      this.boundStopDrag = this.bindEventHandler('stopDrag', this.stopDrag);

      document.addEventListener('mousemove', this.boundOnDrag);
      document.addEventListener('mouseup', this.boundStopDrag);
    },

    /**
     * 拖动中
     */
    onDrag(event) {
      if (!this.isDragging) return;

      const deltaX = event.clientX - this.dragStart.x;
      const deltaY = event.clientY - this.dragStart.y;

      let newX = this.initialPosition.x + deltaX;
      let newY = this.initialPosition.y + deltaY;

      // 边界限制
      const minVisible = 30;
      newX = Math.max(-this.width + minVisible, Math.min(newX, window.innerWidth - minVisible));
      newY = Math.max(0, Math.min(newY, window.innerHeight - 80));

      this.position.x = newX;
      this.position.y = newY;
    },

    /**
     * 停止拖动
     */
    stopDrag() {
      if (!this.isDragging) return;

      this.isDragging = false;

      if (this.boundOnDrag) {
        document.removeEventListener('mousemove', this.boundOnDrag);
      }
      if (this.boundStopDrag) {
        document.removeEventListener('mouseup', this.boundStopDrag);
      }

      // 边缘吸附
      if (this.allowSnap) {
        this.snapToEdge();
      }
    },

    /**
     * 边缘吸附
     */
    snapToEdge() {
      if (!this.$refs.panelRef) return;

      const rect = this.$refs.panelRef.getBoundingClientRect();
      const threshold = this.snapThreshold;
      let snapped = false;

      // 左边缘
      if (rect.left < threshold) {
        this.position.x = 0;
        snapped = true;
      }
      // 右边缘
      else if (rect.right > window.innerWidth - threshold) {
        this.position.x = window.innerWidth - rect.width;
        snapped = true;
      }
      // 顶部边缘
      if (rect.top < threshold) {
        this.position.y = 0;
        snapped = true;
      }

      if (snapped) {
        this.snappedEdge = 'edge';
      }
    },

    /**
     * 切换最小化状态
     */
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      this.$emit(this.isMinimized ? 'minimize' : 'expand');
    },

    /**
     * 处理关闭事件
     */
    handleClose() {
      // 播放关闭动画
      this.isClosed = true;

      // 延迟触发关闭事件，等待动画完成
      setTimeout(() => {
        this.$emit('close');

        if (typeof window !== 'undefined') {
          const closeEvent = new CustomEvent(this.closeEventName, {
            detail: {
              componentName: this.componentName,
              instanceId: this.instanceId
            }
          });
          window.dispatchEvent(closeEvent);
        }

        if (this.onClose && typeof this.onClose === 'function') {
          this.onClose();
        }

        this.$logger?.info?.(`[${this.componentName}] 关闭事件已触发`);
      }, 300);
    },

    /**
     * 键盘事件处理
     */
    handleKeydown(event) {
      // ESC 关闭
      if (event.key === 'Escape') {
        this.handleClose();
      }
    }
  },
  mounted() {
    this.initCesium(() => {
      this.$nextTick(() => {
        this.initPosition();
      });
    });

    // 添加键盘事件监听
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    // 移除键盘事件
    document.removeEventListener('keydown', this.handleKeydown);

    // 清理拖动事件
    if (this.isDragging) {
      if (this.boundOnDrag) {
        document.removeEventListener('mousemove', this.boundOnDrag);
      }
      if (this.boundStopDrag) {
        document.removeEventListener('mouseup', this.boundStopDrag);
      }
    }

    this.cleanup();
  }
};
</script>

<style scoped>
/* ==================== 主面板样式 ==================== */
.function-panel {
  position: fixed;
  max-height: calc(100vh - 180px);
  background: rgba(18, 18, 28, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  z-index: 100020;
  overflow: hidden;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  pointer-events: auto;
  transition: box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.3s ease,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 1px 2px rgba(0, 0, 0, 0.3) inset,
    0 8px 40px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(0, 0, 0, 0.2);
  transform-origin: center center;
}

.function-panel.has-shadow {
  box-shadow:
    0 0 0 1px rgba(76, 175, 80, 0.15) inset,
    0 1px 2px rgba(76, 175, 80, 0.1) inset,
    0 12px 48px rgba(0, 0, 0, 0.5),
    0 0 80px rgba(76, 175, 80, 0.1);
}

.function-panel.is-dragging {
  box-shadow:
    0 0 0 1px rgba(76, 175, 80, 0.3) inset,
    0 1px 3px rgba(76, 175, 80, 0.2) inset,
    0 20px 60px rgba(0, 0, 0, 0.6),
    0 0 100px rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  transform: scale(1.02);
}

.function-panel.is-minimized {
  max-height: 60px;
}

/* ==================== 面板头部 ==================== */
.function-panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  height: 56px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.02) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: move;
  user-select: none;
  transition: background 0.3s ease;
  position: relative;
  overflow: hidden;
}

.function-panel-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, #4CAF50 0%, #388E3C 50%, #2E7D32 100%);
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.5);
}

.function-panel-header:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
}

.function-panel-header.dragging {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%);
  cursor: grabbing;
}

/* 拖动手柄 */
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.3s;
}

.function-panel-header:hover .drag-handle {
  opacity: 0.8;
}

.handle-dots {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.handle-dots::before,
.handle-dots::after {
  content: '';
  display: block;
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.handle-dots::after {
  width: 3px;
  margin-left: 0.5px;
}

/* 头部内容 */
.header-content {
  flex: 1;
  min-width: 0;
  padding: 0 8px;
}

.header-content h3 {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.02em;
}

/* 控制按钮组 */
.header-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
}

.control-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  transform: scale(1.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.control-btn:active {
  transform: scale(0.95);
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  color: #ff6b6b;
  border-color: rgba(255, 59, 48, 0.3);
  box-shadow: 0 0 16px rgba(255, 59, 48, 0.3);
}

.minimize-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border-color: rgba(76, 175, 80, 0.3);
}

/* ==================== 面板主体 ==================== */
.function-panel-body {
  padding: 20px;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  overflow-x: visible;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.25) 100%);
}

/* 滚动条样式 */
.function-panel-body::-webkit-scrollbar {
  width: 6px;
}

.function-panel-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
  margin: 4px;
}

.function-panel-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.5), rgba(76, 175, 80, 0.3));
  border-radius: 3px;
  border: 1px solid rgba(76, 175, 80, 0.2);
  transition: background 0.3s;
}

.function-panel-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.7), rgba(76, 175, 80, 0.5));
}

/* ==================== 浮动按钮（最小化时显示） ==================== */
.panel-fab {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(18, 18, 28, 0.9);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(76, 175, 80, 0.4);
  border-radius: 50px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(76, 175, 80, 0.1);
  cursor: pointer;
  z-index: 100019;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.panel-fab:hover {
  transform: scale(1.05) translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.6);
}

.panel-fab:active {
  transform: scale(0.98);
}

.fab-icon {
  font-size: 18px;
  line-height: 1;
}

.fab-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

/* ==================== 过渡动画 ==================== */
.panel-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.panel-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 1, 1);
}

.panel-fade-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 480px) {
  .function-panel {
    width: calc(100vw - 32px) !important;
    left: 16px !important;
    right: 16px !important;
  }

  .panel-fab {
    max-width: calc(100vw - 32px);
  }
}

/* ==================== 深色模式优化 ==================== */
@media (prefers-color-scheme: dark) {
  .function-panel {
    background: rgba(12, 12, 20, 0.9);
  }

  .function-panel-header {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);
  }
}

/* ==================== 高对比度模式 ==================== */
@media (prefers-contrast: high) {
  .function-panel {
    border-width: 2px;
    border-color: rgba(76, 175, 80, 0.6);
  }

  .control-btn {
    border-width: 2px;
  }
}

/* ==================== 减少动画模式 ==================== */
@media (prefers-reduced-motion: reduce) {
  .function-panel,
  .control-btn,
  .panel-fab,
  .panel-fade-enter-active,
  .panel-fade-leave-active,
  .panel-slide-enter-active,
  .panel-slide-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
