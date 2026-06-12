<template>
  <FunctionPanelUIBase
    title="测试面板"
    title-icon="🧪"
    :width="320"
    :max-height="'60vh'"
    :initial-x="initialX"
    :initial-y="initialY"
    :allow-minimize="true"
    close-event-name="testPanelClose"
    :auto-register="true"
    registration-key="TestPanel"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
  >
    <div class="test-panel-content">
      <div class="section-title">🎉 自动加载测试</div>
      <p class="hint-text">
        这个面板是通过以下方式自动加载的：
      </p>
      <ul class="feature-list">
        <li>✅ 放置在 functions 目录下</li>
        <li>✅ 启用 auto-register="true"</li>
        <li>✅ 设置 registration-key="TestPanel"</li>
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
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';

/**
 * TestPanel - 测试自动加载功能的面板
 *
 * 此面板用于验证 CesiumMain 的自动组件发现和渲染功能
 */
export default {
  name: 'TestPanel',
  components: {
    FunctionPanelUIBase
  },
  props: {
    // 初始位置配置（由配置文件提供）
    initialX: {
      type: [Number, String],
      default: 'right'  // 默认靠右
    },
    initialY: {
      type: Number,
      default: 100  // 默认顶部偏移 100px
    }
  },
  data() {
    return {
      componentName: 'TestPanel',
      count: 0
    };
  },
  methods: {
    handleClose() {
      console.log(`[${this.componentName}] 面板关闭`);
      // 只触发 close 事件，不再触发 window 事件（避免循环）
      this.$emit('close');
    },

    handleMinimize() {
      console.log(`[${this.componentName}] 面板最小化`);
    },

    handleExpand() {
      console.log(`[${this.componentName}] 面板展开`);
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
