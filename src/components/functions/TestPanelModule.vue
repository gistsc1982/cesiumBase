<template>
  <FunctionPanelUIBase
    v-bind="$attrs"
    :title="effectiveTitle"
    :title-icon="effectiveTitleIcon"
    :width="width"
    :max-height="maxHeight"
    :initial-x="initialX"
    :initial-y="initialY"
    :allow-minimize="allowMinimize"
    :close-event-name="closeEventName"
    :auto-register="autoRegister === true"
    :registration-key="registrationKey || 'TestPanelModule'"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
  >
    <!-- 动态内容渲染 -->
    <template v-if="dynamicContent.component">
      <component
        :is="dynamicContent.component"
        v-bind="dynamicContent.props"
        v-on="dynamicContent.events"
      />
    </template>

    <!-- 静态插槽内容 - 默认显示原测试内容 -->
    <slot v-else name="content">
      <!-- 原有默认内容保持不变 -->
      <div class="test-panel-content">
        <div class="section-title">🎉 自动加载测试</div>
        <p class="hint-text">
          这个面板是通过以下方式自动加载的：
        </p>
        <ul class="feature-list">
          <li>✅ 放置在 functions 目录下</li>
          <li>✅ 启用 auto-register="true"</li>
          <li>✅ 设置 registration-key="TestPanelModule"</li>
          <li>✅ CesiumMain 自动导入并渲染</li>
        </ul>

        <div class="demo-section">
          <div class="section-label">演示功能</div>
          <button @click="showAlert" class="demo-btn">
            🔔 测试事件
          </button>
          <button @click="increment" class="demo-btn">
            📊 计数器: {{ count }}
          </button>
        </div>

        <div class="status-info">
          <div class="status-item">
            <span class="label">组件名称:</span>
            <span class="value">{{ componentName }}</span>
          </div>
          <div class="status-item">
            <span class="label">注册状态:</span>
            <span class="value success">已注册 ✓</span>
          </div>
          <div class="status-item">
            <span class="label">渲染方式:</span>
            <span class="value">动态组件</span>
          </div>
        </div>
      </div>
    </slot>
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from '../FunctionPanelUIBase.vue';
import { markRaw } from 'vue';

/**
 * TestPanelModule - 可复用的面板模板
 *
 * 支持三种使用方式：
 * 1. 使用 setContent() 方法动态设置内容
 * 2. 使用 #content 插槽静态替换内容
 * 3. 保持默认测试内容
 */
export default {
  name: 'TestPanelModule',
  components: {
    FunctionPanelUIBase
  },
  inheritAttrs: false,
  props: {
    // 初始位置配置（由配置文件提供）
    initialX: {
      type: [Number, String],
      default: 'right'  // 默认靠右
    },
    initialY: {
      type: Number,
      default: 100  // 默认顶部偏移 100px
    },
    // 面板配置
    title: {
      type: String,
      default: '测试面板'
    },
    titleIcon: {
      type: String,
      default: '🧪'
    },
    width: {
      type: [Number, String],
      default: 320
    },
    maxHeight: {
      type: [Number, String],
      default: '60vh'
    },
    allowMinimize: {
      type: Boolean,
      default: true
    },
    closeEventName: {
      type: String,
      default: 'TestPanelModuleClose'
    },
    // ⭐ 多实例面板相关 props（必须显式定义，因为 FunctionPanelUIBase 使用了 Teleport）
    registrationKey: {
      type: String,
      default: null
    },
    autoRegister: {
      type: Boolean,
      default: true
    },
    panelInstanceId: {
      type: Number,
      default: null
    }
  },
  data() {
    return {
      componentName: 'TestPanelModule',
      count: 0,
      // 动态内容配置
      dynamicContent: {
        component: null,
        props: {},
        events: {},
        title: null,
        titleIcon: null
      }
    };
  },
  computed: {
    // 支持动态标题
    effectiveTitle() {
      return this.dynamicContent.title || this.title;
    },
    effectiveTitleIcon() {
      return this.dynamicContent.titleIcon || this.titleIcon;
    }
  },
  methods: {
    /**
     * 设置面板内容（核心方法）
     * @param {Object|String} component - 组件对象或组件路径
     * @param {Object} options - 配置选项
     * @param {Object} options.props - 传递给组件的 props
     * @param {Object} options.events - 事件监听配置 { eventName: handler }
     * @param {String} options.title - 覆盖面板标题
     * @param {String} options.titleIcon - 覆盖面板图标
     */
    setContent(component, options = {}) {
      const {
        props = {},
        events = {},
        title = null,
        titleIcon = null
      } = options;

      // 处理组件（支持字符串路径或组件对象）
      if (typeof component === 'string') {
        // 字符串路径：异步导入组件
        import(/* webpackChunkName: "[request]" */ `../${component}`)
          .then(module => {
            this.dynamicContent.component = markRaw(module.default || module);
            this.dynamicContent.props = props;
            this.dynamicContent.events = events;
            this.dynamicContent.title = title;
            this.dynamicContent.titleIcon = titleIcon;
          })
          .catch(error => {
            console.error(`[TestPanelModule] 组件加载失败:`, component, error);
          });
      } else {
        // 组件对象：直接使用
        this.dynamicContent.component = markRaw(component);
        this.dynamicContent.props = props;
        this.dynamicContent.events = events;
        this.dynamicContent.title = title;
        this.dynamicContent.titleIcon = titleIcon;
      }
    },

    /**
     * 清除动态内容，恢复默认插槽
     */
    clearContent() {
      this.dynamicContent = {
        component: null,
        props: {},
        events: {},
        title: null,
        titleIcon: null
      };
    },

    /**
     * 获取当前内容配置
     */
    getContentConfig() {
      return {
        ...this.dynamicContent
      };
    },

    // 可重写的方法：子类可以覆盖以自定义关闭行为
    handleClose() {
      console.log(`[${this.$options.name}] 面板关闭`);
      this.$emit('close');
    },

    handleMinimize() {
      console.log(`[${this.$options.name}] 面板最小化`);
    },

    handleExpand() {
      console.log(`[${this.$options.name}] 面板展开`);
    },

    showAlert() {
      alert(`[${this.componentName}] 事件测试成功！`);
    },

    increment() {
      this.count++;
    }
  }
};
</script>

<style scoped>
.test-panel-content {
  padding: 8px 0;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #4CAF50;
  margin-bottom: 12px;
  text-align: center;
}

.hint-text {
  font-size: 13px;
  color: #b0b0b0;
  margin-bottom: 12px;
  line-height: 1.5;
}

.feature-list {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  background: rgba(76, 175, 80, 0.05);
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.feature-list li {
  font-size: 13px;
  color: #e0e0e0;
  padding: 4px 0;
}

.demo-section {
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #b0b0b0;
  margin-bottom: 10px;
}

.demo-btn {
  width: 100%;
  padding: 10px 16px;
  margin-bottom: 8px;
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  border-radius: 6px;
  color: #4CAF50;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.demo-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.6);
  transform: translateY(-1px);
}

.demo-btn:active {
  transform: translateY(0);
}

.status-info {
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 12px;
}

.status-item .label {
  color: #808090;
}

.status-item .value {
  color: #e0e0e0;
  font-weight: 500;
}

.status-item .value.success {
  color: #4CAF50;
}
</style>
