<template>
  <button
    class="toolbar-button"
    :class="buttonClasses"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :aria-pressed="active ? 'true' : 'false'"
    @click="handleClick"
  >
    <!-- 图标 -->
    <span class="button-icon" aria-hidden="true">{{ icon }}</span>

    <!-- 标签文本 -->
    <span class="button-label">{{ label }}</span>

    <!-- Tooltip -->
    <span class="button-tooltip" role="tooltip" aria-hidden="true">
      {{ computedTooltip }}
    </span>
  </button>
</template>

<script>
/**
 * CesiumToolbarButton - 工具条按钮组件
 *
 * @description
 * 工具条中的单个按钮，支持图标、标签、状态指示和提示信息。
 *
 * @features
 * - 支持 active 状态（高亮显示）
 * - 支持 disabled 状态（置灰且禁用）
 * - 支持 lazyLoad 状态（懒加载面板，禁用但可点击触发加载）
 * - 内置 tooltip 提示
 * - 完整的可访问性支持
 * - 流畅的过渡动画
 *
 * @accessibility
 * - icon-only 按钮必须有 aria-label
 * - active 状态使用 aria-pressed
 * - 支持 keyboard 焦点状态
 * - 遵循 WCAG 2.1 AA 标准
 *
 * @example
 * <CesiumToolbarButton
 *   icon="🖥️"
 *   label="多实例"
 *   tooltip="创建 DualCanvasViewer 实例"
 *   :active="false"
 *   @click="handleClick"
 * />
 */
export default {
  name: 'CesiumToolbarButton',

  props: {
    /**
     * 按钮图标（emoji 或 SVG）
     * @type {string}
     * @required
     */
    icon: {
      type: String,
      required: true
    },

    /**
     * 按钮标签
     * @type {string}
     * @default ''
     */
    label: {
      type: String,
      default: ''
    },

    /**
     * Tooltip 提示文本
     * @type {string}
     * @default ''
     */
    tooltip: {
      type: String,
      default: ''
    },

    /**
     * 是否激活状态
     * @type {boolean}
     * @default false
     */
    active: {
      type: Boolean,
      default: false
    },

    /**
     * 是否禁用
     * @type {boolean}
     * @default false
     */
    disabled: {
      type: Boolean,
      default: false
    },

    /**
     * 是否懒加载（禁用但可点击触发加载）
     * @type {boolean}
     * @default false
     */
    lazyLoad: {
      type: Boolean,
      default: false
    },

    /**
     * ARIA 标签（用于可访问性）
     * @type {string}
     * @default ''
     */
    ariaLabel: {
      type: String,
      default: ''
    }
  },

  emits: ['click'],

  computed: {
    /**
     * 按钮的 CSS 类
     */
    buttonClasses() {
      return [
        'toolbar-button',
        {
          'toolbar-button--active': this.active,
          'toolbar-button--disabled': this.disabled && !this.lazyLoad,
          'toolbar-button--lazy': this.lazyLoad
        }
      ]
    },

    /**
     * 计算可访问的 aria-label
     */
    computedAriaLabel() {
      if (this.ariaLabel) {
        return this.ariaLabel
      }
      // 如果有标签，使用标签；否则使用 tooltip
      return this.label || this.tooltip || '工具按钮'
    },

    /**
     * 计算显示的 tooltip 文本
     */
    computedTooltip() {
      return this.tooltip
    }
  },

  methods: {
    /**
     * 处理点击事件
     */
    handleClick(event) {
      // ⭐ 懒加载按钮：虽然 disabled=true，但允许点击触发加载
      if (this.lazyLoad) {
        console.log(`[CesiumToolbarButton] 懒加载按钮被点击: ${this.label}`)
        this.$emit('click', event)
        return
      }

      if (this.disabled) {
        event.preventDefault()
        return
      }

      this.$emit('click', event)
    }
  }
}
</script>

<style scoped>
.toolbar-button {
  /* 基础样式 */
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 44px; /* 触摸目标最小尺寸 */
  height: 44px;
  padding: 0;

  /* 移除默认样式 */
  background: transparent;
  border: none;
  cursor: pointer;

  /* 圆形 */
  border-radius: 50%;

  /* 过渡动画 */
  transition: all 0.2s ease-out;

  /* 文本不可选 */
  user-select: none;
  -webkit-user-select: none;

  /* 防止文本被选中 */
  -webkit-tap-highlight-color: transparent;
}

/* 图标样式 */
.button-icon {
  font-size: 20px;
  line-height: 1;
  pointer-events: none;
}

/* 标签文本 - 默认隐藏，只在展开时显示 */
.button-label {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 500;
  color: #94A3B8;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease-out;
}

/* Tooltip - 默认隐藏 */
.button-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  margin-top: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  color: #F8FAFC;
  background: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;

  /* 透明度和可见性 */
  opacity: 0;
  pointer-events: none;
  visibility: hidden;

  /* 过渡动画 */
  transition: all 0.2s ease-out;

  /* 箭头 */
  z-index: 1;
}

/* 箭头 */
.button-tooltip::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgba(15, 23, 42, 0.95);
}

/* 悬停状态 */
.toolbar-button:hover {
  background: rgba(34, 197, 94, 0.1); /* CTA 绿色 10% 透明度 */
  transform: translateY(-1px);
}

.toolbar-button:hover .button-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

/* 激活状态 */
.toolbar-button--active {
  background: rgba(34, 197, 94, 0.2); /* CTA 绿色 20% 透明度 */
  border-color: #22C55E;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}

.toolbar-button--active .button-icon {
  color: #22C55E; /* CTA 绿色 */
}

/* 禁用状态 */
.toolbar-button--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-button--disabled:hover {
  background: transparent;
  transform: none;
}

.toolbar-button--disabled .button-tooltip {
  opacity: 0;
  visibility: hidden;
}

/* ⭐ 懒加载状态 - 禁用但可点击 */
.toolbar-button--lazy {
  opacity: 0.6;
  cursor: pointer;
}

.toolbar-button--lazy:hover {
  opacity: 0.8;
  background: rgba(59, 130, 246, 0.15); /* 蓝色提示 */
  transform: translateY(-1px);
}

.toolbar-button--lazy .button-tooltip {
  opacity: 1;
  visibility: visible;
  color: #60A5FA; /* 浅蓝色 */
}

/* ⭐ 懒加载按钮的加载指示器 */
.toolbar-button--lazy::after {
  content: '⏳';
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  opacity: 0.8;
}

/* 焦点状态 - 键盘导航 */
.toolbar-button:focus {
  outline: 2px solid #22C55E;
  outline-offset: 2px;
}

/* 展开状态的标签显示（可选） */
.toolbar-button--show-label .button-label {
  opacity: 1;
  pointer-events: auto;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar-button {
    width: 40px;
    height: 40px;
  }

  .button-icon {
    font-size: 18px;
  }

  .button-tooltip {
    font-size: 11px;
    padding: 5px 10px;
  }
}

/* 减少动画效果 */
@media (prefers-reduced-motion: reduce) {
  .toolbar-button,
  .button-label,
  .button-tooltip {
    transition: none;
  }
}
</style>
