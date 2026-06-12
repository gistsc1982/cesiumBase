<template>
  <nav
    class="cesium-toolbar"
    role="navigation"
    :class="{ 'cesium-toolbar--collapsed': isCollapsed }"
    :aria-label="toolbarLabel"
  >
    <!-- 工具条指示器 -->
    <div class="toolbar-indicator" aria-hidden="true"></div>

    <!-- 按钮组 -->
    <div class="toolbar-buttons" role="group" aria-label="工具按钮">
      <CesiumToolbarButton
        v-for="button in buttons"
        :key="button.id"
        :icon="button.icon"
        :label="button.label"
        :tooltip="button.tooltip"
        :active="button.active"
        :disabled="button.disabled"
        :aria-label="button.ariaLabel || button.label"
        @click="handleButtonClick(button)"
      />
    </div>

    <!-- 折叠/展开按钮（可选） -->
    <button
      v-if="collapsible"
      class="toolbar-toggle"
      :aria-label="isCollapsed ? '展开工具条' : '折叠工具条'"
      @click="toggleCollapse"
      aria-expanded="!isCollapsed"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
        <path v-if="!isCollapsed" d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M15 3h6v6M9 21h6M12 3v18M3 9h6m6 0h6M9 15h6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </nav>
</template>

<script>
import CesiumToolbarButton from './CesiumToolbarButton.vue'

/**
 * CesiumToolbar - Cesium 工具条组件
 *
 * @description
 * 专为 Cesium 应用设计的现代化工具条，采用 Glassmorphism 设计风格。
 * 高 z-index 确保工具条始终位于所有内容之上，包括多实例容器。
 *
 * @features
 * - Glassmorphism 视觉效果（毛玻璃、模糊背景）
 * - 超高 z-index (200000) 确保不被遮挡
 * - 响应式设计，支持移动端和桌面端
 * - 完整的可访问性支持
 * - 支持折叠/展开（可选）
 *
 * @design-system
 * - Pattern: Real-Time Monitoring
 * - Style: Glassmorphism
 * - Colors: Primary #1E293B, CTA #22C55E, Background #0F172A
 * - Typography: Fira Code
 *
 * @accessibility
 * - 所有按钮都有 aria-label
 * - 支持 keyboard 导航
 * - 遵循 WCAG 2.1 AA 标准
 * - 支持 prefers-reduced-motion
 *
 * @z-index
 * - 工具条: 200000（高于所有实例容器）
 * - 多实例容器: 100000 + instanceId * 100
 * - 单实例容器: 99995
 *
 * @example
 * <CesiumToolbar :buttons="toolbarButtons" @button-click="handleButtonClick" />
 */
export default {
  name: 'CesiumToolbar',

  components: {
    CesiumToolbarButton
  },

  props: {
    /**
     * 按钮配置数组
     * @type {Array<{id: string, icon: string, label: string, tooltip: string, active?: boolean, disabled?: boolean, ariaLabel?: string}>}
     * @default []
     */
    buttons: {
      type: Array,
      default: () => []
    },

    /**
     * 工具条标签（用于可访问性）
     * @type {string}
     * @default 'Cesium 工具栏'
     */
    toolbarLabel: {
      type: String,
      default: 'Cesium 工具栏'
    },

    /**
     * 是否可折叠
     * @type {boolean}
     * @default false
     */
    collapsible: {
      type: Boolean,
      default: false
    },

    /**
     * 初始折叠状态
     * @type {boolean}
     * @default false
     */
    initiallyCollapsed: {
      type: Boolean,
      default: false
    }
  },

  emits: ['button-click', 'toggle-collapse'],

  data() {
    return {
      isCollapsed: this.initiallyCollapsed
    }
  },

  computed: {
    /**
     * 工具条容器的 CSS 类
     */
    toolbarClasses() {
      return [
        'cesium-toolbar',
        {
          'cesium-toolbar--collapsed': this.isCollapsed
        }
      ]
    }
  },

  methods: {
    /**
     * 处理按钮点击事件
     * @param {Object} button - 按钮配置
     */
    handleButtonClick(button) {
      if (button.disabled) return

      this.$emit('button-click', button)
    },

    /**
     * 切换折叠状态
     */
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      this.$emit('toggle-collapse', this.isCollapsed)
    }
  }
}
</script>

<style scoped>
.cesium-toolbar {
  /* 定位 */
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);

  /* 尺寸 */
  min-height: 52px;
  padding: 10px 16px;

  /* Z-index - 确保高于多实例容器（100000+）和单实例（99995） */
  z-index: 200000;

  /* Glassmorphism 效果 */
  background: rgba(15, 23, 42, 0.85); /* #0F172A with 85% opacity */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);

  /* 边框 */
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50px;

  /* 阴影 */
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);

  /* 布局 */
  display: flex;
  align-items: center;
  gap: 12px;

  /* 过渡动画 */
  transition: all 0.3s ease-out;

  /* 防止文本选择 */
  user-select: none;
  -webkit-user-select: none;
}

/* 工具条悬停效果 */
.cesium-toolbar:hover {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* 折叠状态 */
.cesium-toolbar--collapsed {
  padding: 10px 12px;
}

.cesium-toolbar--collapsed .toolbar-buttons {
  opacity: 0;
  pointer-events: none;
  max-width: 0;
  max-height: 0;
  overflow: hidden;
  margin: 0;
}

/* 工具条指示器 */
.toolbar-indicator {
  position: absolute;
  left: 16px;
  width: 3px;
  height: 3px;
  border-radius: 50%;

  /* 状态指示色 */
  background: #22C55E; /* CTA 绿色 */
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);

  /* 动画 */
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
   0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 按钮容器 */
.toolbar-buttons {
  display: flex;
  align-items: center;
  gap: 8px;

  /* 过渡动画 */
  transition: all 0.3s ease-out;
}

/* 折叠按钮 */
.toolbar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;

  /* 移除默认样式 */
  background: transparent;
  border: none;
  cursor: pointer;

  /* 圆形 */
  border-radius: 50%;

  /* 过渡 */
  transition: all 0.2s ease-out;

  /* 可访问性 */
  color: #F8FAFC;
}

.toolbar-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.toolbar-toggle:focus {
  outline: 2px solid #22C55E;
  outline-offset: 2px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .cesium-toolbar {
    top: auto;
    bottom: 20px;
    padding: 8px 12px;
    gap: 8px;
  }

  .toolbar-indicator {
    left: 12px;
    width: 2px;
    height: 2px;
  }
}

/* 减少动画效果 - 遵循 prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .cesium-toolbar,
  .toolbar-button,
  .toolbar-toggle {
    transition: none;
  }

  .toolbar-indicator {
    animation: none;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .cesium-toolbar {
    background: rgba(15, 23, 42, 0.95);
    border: 2px solid rgba(255, 255, 255, 0.3);
  }
}
</style>
