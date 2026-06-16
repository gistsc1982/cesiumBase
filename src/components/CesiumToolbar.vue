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
        v-for="button in managedButtons"
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
 * CesiumToolbar - Cesium 自包含工具条组件
 *
 * @description
 * 专为 Cesium 应用设计的现代化工具条，采用 Glassmorphism 设计风格。
 * 自己管理工具栏按钮和面板状态，无需外部传入按钮配置。
 *
 * @features
 * - Glassmorphism 视觉效果（毛玻璃、模糊背景）
 * - 超高 z-index (200000) 确保不被遮挡
 * - 响应式设计，支持移动端和桌面端
 * - 完整的可访问性支持
 * - 支持折叠/展开（可选）
 * - 自动管理面板注册和状态
 *
 * @design-system
 * - Pattern: Real-Time Monitoring
 * - Style: Glassmorphism
 * - Colors: Primary #1E293B, CTA #22C55E, Background #0F172A
 * - Typography: Fira Code
 *
 * @panel-management
 * - 支持面板注册：自动发现和注册功能面板
 * - 支持面板状态同步：自动更新按钮 active 状态
 * - 支持单例模式：特殊面板只允许一个实例
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
 * <CesiumToolbar @panel-toggle="handlePanelToggle" />
 */
export default {
  name: 'CesiumToolbar',

  components: {
    CesiumToolbarButton
  },

  props: {
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
    },

    /**
     * 可选的自定义按钮（用于扩展默认按钮列表）
     * @type {Array<Object>}
     * @default []
     */
    customButtons: {
      type: Array,
      default: () => []
    },

    /**
     * 面板配置列表（从 functionPanels.config.json 读取）
     * @type {Array<Object>}
     * @default []
     */
    panelConfigs: {
      type: Array,
      default: () => []
    }
  },

  emits: [
    'button-click',           // 按钮被点击
    'panel-toggle',          // 面板切换请求
    'panel-registered',       // 新面板注册
    'panel-unregistered'      // 面板注销
  ],

  data() {
    return {
      isCollapsed: this.initiallyCollapsed,

      // ==================== 面板注册表 ====================
      // 存储已注册的面板信息
      // Map<panelId, { component, props, visible, singleton, instance }>
      registeredPanels: new Map(),

      // ==================== 默认工具栏按钮 ====================
      defaultButtons: [
        {
          id: 'multi-instance',
          icon: '🖥️',
          label: '多实例',
          tooltip: '创建 DualCanvasViewer 实例',
          disabled: false,
          ariaLabel: '多实例',
          action: 'multi-instance'
        },
        {
          id: 'oblique-photo',
          icon: '📷',
          label: '倾斜摄影',
          tooltip: '倾斜摄影面板（单例模式）',
          disabled: false,
          ariaLabel: '倾斜摄影面板',
          action: 'toggle-panel',
          panelId: 'ObliquePhotographyPanel',
          singleton: true
        },
        {
          id: 'oblique-photo-example',
          icon: '🧪',
          label: '测试面板',
          tooltip: '测试 JsonConfigPanelBase（单例模式）',
          disabled: false,
          ariaLabel: '测试面板',
          action: 'toggle-panel',
          panelId: 'ObliquePhotographyPanelExample',
          singleton: true
        },
        {
          id: 'multi-instance-panel',
          icon: '🧬',
          label: '多实例',
          tooltip: '测试 JsonConfigPanelBase 多实例模式',
          disabled: false,
          ariaLabel: '多实例测试面板',
          action: 'toggle-panel',
          panelId: 'ObliquePhotographyPanelExample',
          singleton: false
        },
        {
          id: 'testsfc-modal',
          icon: '🧪',
          label: 'TestSfc',
          tooltip: 'TestSfc 经纬度定位组件',
          disabled: false,
          ariaLabel: 'TestSfc测试',
          action: 'modal-toggle',
          modalId: 'testSfc'
        },
        {
          id: 'sfc-test',
          icon: '🌐',
          label: 'SFC',
          tooltip: 'SfcDualCanvasViewer 双画布组件',
          disabled: false,
          ariaLabel: 'SFC测试',
          action: 'sfc-toggle'
        },
        {
          id: 'loading-mode',
          icon: 'IIFE',
          label: '模式',
          tooltip: '切换加载模式',
          disabled: false,
          ariaLabel: '加载模式',
          action: 'loading-mode-toggle'
        }
      ]
    };
  },

  computed: {
    /**
     * 合并默认按钮和自定义按钮
     * ⭐ 从 panelConfigs 动态生成按钮（如果提供）
     */
    managedButtons() {
      let buttons = [];

      // 如果提供了 panelConfigs，从配置动态生成按钮
      if (this.panelConfigs && this.panelConfigs.length > 0) {
        buttons = this.panelConfigs
          .filter(config => config.enabled !== false)
          .map(config => ({
            id: config.name,
            icon: config.icon || '📄',
            label: config.title || config.name,
            tooltip: config.description || config.title,
            disabled: false,
            ariaLabel: config.title || config.name,
            action: 'toggle-panel',
            panelId: config.name,
            singleton: config.singleton !== false
          }));

        console.log('[CesiumToolbar] 📋 从配置生成按钮:', buttons.map(b => ({ id: b.id, singleton: b.singleton })));
      } else {
        // 回退到默认按钮和自定义按钮
        buttons = [...this.defaultButtons, ...this.customButtons];
      }

      // 自动更新面板按钮的 active 状态
      return buttons.map(button => {
        if (button.action === 'toggle-panel' && button.panelId) {
          const panel = this.registeredPanels.get(button.panelId);
          return {
            ...button,
            active: panel?.visible || false
          };
        }
        return button;
      });
    },

    /**
     * 工具条容器的 CSS 类
     */
    toolbarClasses() {
      return [
        'cesium-toolbar',
        {
          'cesium-toolbar--collapsed': this.isCollapsed
        }
      ];
    },

    /**
     * 获取所有可见面板
     */
    visiblePanels() {
      const panels = [];
      this.registeredPanels.forEach((panel, panelId) => {
        if (panel.visible) {
          panels.push({ key: panelId, ...panel });
        }
      });
      return panels;
    }
  },

  methods: {
    /**
     * 处理按钮点击事件
     * @param {Object} button - 按钮配置
     */
    handleButtonClick(button) {
      if (button.disabled) return;

      console.log(`[CesiumToolbar] 按钮被点击: ${button.id}`);

      switch (button.action) {
        case 'toggle-panel':
          this.handlePanelToggle(button);
          break;
        case 'modal-toggle':
          this.$emit('button-click', button);
          break;
        default:
          // 其他按钮直接转发事件
          this.$emit('button-click', button);
      }
    },

    /**
     * 处理面板切换
     * @param {Object} button - 按钮配置
     */
    handlePanelToggle(button) {
      const panelId = button.panelId;
      const panel = this.registeredPanels.get(panelId);

      if (panel) {
        // 面板已注册：切换可见性
        const newVisible = !panel.visible;

        // 单例模式：如果面板已加载，不销毁组件，只隐藏/显示
        if (button.singleton) {
          panel.visible = newVisible;
          this.registeredPanels.set(panelId, panel);

          console.log(`[CesiumToolbar] 🔄 ${panelId} 可见性: ${newVisible ? '显示' : '隐藏'}（单例模式）`);

          this.$emit('panel-toggle', {
            panelId,
            visible: newVisible,
            singleton: true
          });
        } else {
          // 多实例模式：完全销毁/创建
          this.$emit('panel-toggle', {
            panelId,
            visible: newVisible,
            singleton: false
          });
        }
      } else {
        // 面板未注册：请求加载面板
        console.log(`[CesiumToolbar] 📦 首次加载面板: ${panelId}`);

        this.$emit('panel-toggle', {
          panelId,
          visible: true,
          singleton: button.singleton || false,
          action: 'load'
        });
      }
    },

    /**
     * 注册面板
     * @param {string} panelId - 面板唯一标识
     * @param {Object} config - 面板配置
     */
    registerPanel(panelId, config) {
      console.log(`[CesiumToolbar] 注册面板: ${panelId}`, config);

      this.registeredPanels.set(panelId, {
        ...config,
        visible: false
      });

      this.$emit('panel-registered', { panelId, config });
    },

    /**
     * 注销面板
     * @param {string} panelId - 面板唯一标识
     */
    unregisterPanel(panelId) {
      console.log(`[CesiumToolbar] 注销面板: ${panelId}`);

      this.registeredPanels.delete(panelId);

      this.$emit('panel-unregistered', { panelId });
    },

    /**
     * 更新面板可见性
     * @param {string} panelId - 面板唯一标识
     * @param {boolean} visible - 是否可见
     */
    updatePanelVisibility(panelId, visible) {
      const panel = this.registeredPanels.get(panelId);
      if (panel) {
        panel.visible = visible;
        this.registeredPanels.set(panelId, panel);
      }
    },

    /**
     * 获取面板信息
     * @param {string} panelId - 面板唯一标识
     * @returns {Object|null} 面板配置
     */
    getPanel(panelId) {
      return this.registeredPanels.get(panelId) || null;
    },

    /**
     * 获取所有已注册面板
     * @returns {Array} 面板列表
     */
    getAllPanels() {
      const panels = [];
      this.registeredPanels.forEach((panel, panelId) => {
        panels.push({ id: panelId, ...panel });
      });
      return panels;
    },

    /**
     * 切换折叠状态
     */
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed;
      this.$emit('toggle-collapse', this.isCollapsed);
    }
  }
};
</script>

<style scoped>
/* 定位 */
.cesium-toolbar {
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
  background: rgba(15, 23, 42, 0.85);
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
  background: #22C55E;
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
