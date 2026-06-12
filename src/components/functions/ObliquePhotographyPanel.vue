<template>
  <FunctionPanelUIBase
    title="倾斜摄影加载"
    title-icon="📷"
    :width="380"
    :max-height="'65vh'"
    initial-x="center"
    :initial-y="120"
    :allow-minimize="true"
    close-event-name="obliquePhotographyPanelClose"
    :auto-register="true"
    registration-key="ObliquePhotographyPanel"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
  >
    <!-- 推荐偏移值提示 -->
    <template v-for="item in list" :key="'recommend-' + item.id">
      <div
        v-if="item && item.loaded && item.recommendedOffset !== undefined && item.recommendedOffset !== null"
        class="recommended-offset-banner"
      >
        <div class="banner-content">
          <span class="banner-icon">💡</span>
          <span class="banner-text">
            检测到倾斜摄影地形高度较低
            <span class="banner-suggestion">
              ，建议向上偏移 <strong class="highlight">{{ item.recommendedOffset.toFixed(1) }} 米</strong> 以与大坐标模型底部对齐
            </span>
          </span>
          <button
            @click="$emit('applyRecommendedOffset', item)"
            class="apply-recommended-btn"
            :disabled="Math.abs(item.heightOffset - item.recommendedOffset) < 0.1"
          >
            {{ Math.abs(item.heightOffset - item.recommendedOffset) < 0.1 ? '✓ 已应用' : '应用推荐值' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 地形高度调整控件 -->
    <template v-for="item in list" :key="'height-' + item.id">
      <div v-if="item && item.loaded" class="oblique-height-control-panel">
        <div class="height-control-title">🌏 {{ item.name }} 地形高度调整</div>

        <!-- 当前高度偏移显示 -->
        <div class="current-height">
          <span class="label">倾斜摄影地形向上偏移：</span>
          <span class="value">{{ (item.heightOffset || 0).toFixed(2) }} 米</span>
          <span class="hint" title="调整倾斜摄影的整体高度，正值向上，负值向下">💡</span>
        </div>

        <!-- 高度调整滑块 -->
        <div class="height-control">
          <label>调整偏移：</label>
          <input
            type="range"
            min="-2000"
            max="2000"
            step="1"
            :value="item.heightOffset || 0"
            @input="$emit('heightOffsetChange', { item, value: $event.target.value })"
            class="height-slider"
          />
          <div class="height-usage-info">
            <span>调整后使倾斜摄影与大坐标模型高度对齐</span>
          </div>
        </div>

        <!-- 精确输入 -->
        <div class="height-input">
          <label>精确设置偏移（米）：</label>
          <input
            type="number"
            :value="item.heightOffset || 0"
            @change="$emit('heightInputChange', { item, value: $event.target.value })"
            class="number-input"
            step="0.1"
          />
        </div>
      </div>
    </template>

    <!-- 无加载提示 -->
    <div
      v-if="list && list.length > 0 && !list.some(i => i && i.loaded)"
      class="no-loaded-hint"
    >
      请先加载倾斜摄影数据
    </div>

    <!-- 倾斜摄影列表 -->
    <div class="oblique-list">
      <template v-for="item in list" :key="item && item.id">
        <div class="oblique-item" v-if="item">
          <label class="oblique-checkbox">
            <input
              type="checkbox"
              :checked="item.loaded || false"
              @change="$emit('toggle', item)"
              :disabled="item.loading || false"
            />
            <span class="oblique-name">{{ item.name || '未知' }}</span>
            <span v-if="item.loading" class="loading-indicator">加载中...</span>
            <span v-else-if="item.loaded" class="status-indicator loaded">✓</span>
            <span v-else class="status-indicator unloaded">○</span>
          </label>
          <div class="oblique-url" v-if="item.loaded">{{ item.url }}</div>
        </div>
      </template>
    </div>
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';

/**
 * ObliquePhotographyPanel - 倾斜摄影功能面板
 *
 * 使用 FunctionPanelUIBase 作为容器，只实现业务逻辑：
 * - 列表展示
 * - 高度偏移调整
 * - 推荐偏移值应用
 */
export default {
  name: 'ObliquePhotographyPanel',
  components: {
    FunctionPanelUIBase
  },
  props: {
    list: {
      type: Array,
      default: () => []
    },
    onClose: {
      type: Function,
      default: null
    }
  },
  inject: {
    closeEventName: {
      default: 'obliquePhotographyPanelClose'
    },
    instanceId: {
      default: 1
    }
  },
  data() {
    return {
      componentName: 'ObliquePhotographyPanel'
    };
  },
  methods: {
    /**
     * 处理最小化事件
     */
    handleMinimize() {
      console.log(`[${this.componentName}] 面板已最小化`);
    },

    /**
     * 处理展开事件
     */
    handleExpand() {
      console.log(`[${this.componentName}] 面板已展开`);
    },

    /**
     * 处理关闭事件
     */
    handleClose() {
      // 触发 Vue 事件（父组件通过 @close 监听）
      this.$emit('close');

      // 触发 window 自定义事件
      if (typeof window !== 'undefined') {
        const closeEvent = new CustomEvent(this.closeEventName, {
          detail: {
            componentName: this.componentName,
            instanceId: this.instanceId
          }
        });
        window.dispatchEvent(closeEvent);

        if (this.onClose && typeof this.onClose === 'function') {
          this.onClose();
        }

        console.log(`[${this.componentName}] 关闭事件已触发`);
      }
    }
  }
};
</script>

<style scoped>
/* 推荐偏移横幅样式 */
.recommended-offset-banner {
  margin-bottom: 12px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 8px;
  animation: slideIn 0.3s ease-out;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.banner-icon {
  font-size: 16px;
  line-height: 1;
}

.banner-text {
  flex: 1;
  font-size: 13px;
  color: #b0b0b0;
  line-height: 1.4;
}

.banner-suggestion {
  color: #e0e0e0;
}

.highlight {
  color: #FFC107;
  font-weight: 700;
  font-size: 14px;
}

.apply-recommended-btn {
  padding: 6px 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.apply-recommended-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-1px);
}

.apply-recommended-btn:disabled {
  background: rgba(255, 255, 255, 0.1);
  color: #666;
  cursor: not-allowed;
}

/* 地形高度调整面板 */
.oblique-height-control-panel {
  margin-bottom: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.height-control-title {
  font-size: 13px;
  font-weight: 600;
  color: #4CAF50;
  margin-bottom: 10px;
}

.current-height {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.current-height .label {
  font-size: 12px;
  color: #b0b0b0;
  flex: 1;
}

.current-height .value {
  font-size: 14px;
  font-weight: 600;
  color: #4CAF50;
}

.current-height .hint {
  font-size: 14px;
  cursor: help;
  opacity: 0.7;
}

.height-control {
  margin-bottom: 12px;
}

.height-control label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #b0b0b0;
}

.height-slider {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.height-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
}

.height-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.height-usage-info {
  margin-top: 4px;
  font-size: 11px;
  color: #808090;
}

.height-input {
  margin-bottom: 0;
}

.height-input label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #b0b0b0;
}

.number-input {
  width: 100%;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  transition: all 0.2s;
}

.number-input:focus {
  outline: none;
  border-color: #4CAF50;
  background: rgba(255, 255, 255, 0.08);
}

.no-loaded-hint {
  padding: 16px;
  text-align: center;
  color: #808090;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
}

/* 倾斜摄影列表样式 */
.oblique-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oblique-item {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.2s;
}

.oblique-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(76, 175, 80, 0.2);
}

.oblique-checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 0;
}

.oblique-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4CAF50;
  cursor: pointer;
}

.oblique-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
  flex: 1;
}

.loading-indicator {
  font-size: 12px;
  color: #FFC107;
}

.status-indicator {
  font-size: 16px;
  font-weight: bold;
}

.status-indicator.loaded {
  color: #4CAF50;
}

.status-indicator.unloaded {
  color: #808090;
}

.oblique-url {
  margin-top: 6px;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  font-size: 11px;
  color: #808090;
  word-break: break-all;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
