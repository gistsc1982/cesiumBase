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
    <template v-for="item in obliquePhotographyList" :key="'recommend-' + item.id">
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
            @click="applyRecommendedOffset(item)"
            class="apply-recommended-btn"
            :disabled="Math.abs(item.heightOffset - item.recommendedOffset) < 0.1"
          >
            {{ Math.abs(item.heightOffset - item.recommendedOffset) < 0.1 ? '✓ 已应用' : '应用推荐值' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 地形高度调整控件 -->
    <template v-for="item in obliquePhotographyList" :key="'height-' + item.id">
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
            @input="onHeightOffsetChange(item, $event)"
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
            @change="onHeightInputChange(item, $event)"
            class="number-input"
            step="0.1"
          />
        </div>
      </div>
    </template>

    <!-- 无加载提示 -->
    <div
      v-if="obliquePhotographyList && obliquePhotographyList.length > 0 && !obliquePhotographyList.some(i => i && i.loaded)"
      class="no-loaded-hint"
    >
      请先加载倾斜摄影数据
    </div>

    <!-- 倾斜摄影列表 -->
    <div class="oblique-list">
      <template v-for="item in obliquePhotographyList" :key="item && item.id">
        <div class="oblique-item" v-if="item">
          <label class="oblique-checkbox">
            <input
              type="checkbox"
              :checked="item.loaded || false"
              @change="toggleObliquePhotography(item)"
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
import SfcBase from '../SfcBase.vue';

/**
 * ObliquePhotographyPanel - 倾斜摄影功能面板
 *
 * 使用 FunctionPanelUIBase 作为容器，实现完整的倾斜摄影加载和管理功能：
 * - 列表展示
 * - 加载/卸载倾斜摄影
 * - 高度偏移调整
 * - 推荐偏移值应用
 */
export default {
  name: 'ObliquePhotographyPanel',
  components: {
    FunctionPanelUIBase
  },
  mixins: [SfcBase],  // 继承 SfcBase 以获得 initCesium、getCesiumViewer 等方法
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
      componentName: 'ObliquePhotographyPanel',
      // 倾斜摄影列表配置
      obliquePhotographyList: [
        {
          id: 'bridge3d',
          name: '桥梁3D',
          url: 'https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json',
          loaded: false,
          tileset: null,
          heightOffset: 0.0,  // 高度偏移量（米），正值向上，负值向下
          initialTransform: null,  // 保存初始变换矩阵，用于计算相对偏移
          recommendedOffset: null,  // 推荐的高度偏移值（基于地形高度计算）
          loading: false  // 加载状态
        },
        {
          id: 'jian1',
          name: '吉安1号',
          url: 'https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.json',
          loaded: false,
          tileset: null,
          heightOffset: 0.0,
          initialTransform: null,
          recommendedOffset: null,
          loading: false
        }
      ],
      // Cesium 对象引用
      cesiumViewer: null,
      Cesium: null
    };
  },
  mounted() {
    // 在面板挂载后初始化 Cesium
    this.initCesium(() => {
      console.log(`[${this.componentName}] Cesium 已就绪，面板初始化完成`);
    });
  },
  beforeUnmount() {
    // 清理：卸载所有倾斜摄影
    this.obliquePhotographyList.forEach(item => {
      if (item.loaded && item.tileset) {
        this.unloadObliquePhotography(item);
      }
    });
  },
  methods: {
    // ==================== 面板事件处理 ====================

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
      console.log(`[${this.componentName}] 面板关闭`);
      // 只触发 Vue close 事件，避免 window 事件循环
      this.$emit('close');
    },

    // ==================== 倾斜摄影加载/卸载 ====================

    /**
     * 切换倾斜摄影加载状态
     * @param {Object} item - 倾斜摄影项目配置
     */
    async toggleObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      if (item.loaded) {
        // 卸载倾斜摄影
        await this.unloadObliquePhotography(item);
      } else {
        // 加载倾斜摄影
        await this.loadObliquePhotography(item);
      }
    },

    /**
     * 加载倾斜摄影
     * @param {Object} item - 倾斜摄影项目配置
     */
    async loadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 🏗️ 加载倾斜摄影: ${item.name}`);
      console.log(`[${this.componentName}] 📍 URL: ${item.url}`);

      // 设置加载状态
      this.$set(item, 'loading', true);

      try {
        // 创建 3D Tileset
        const tileset = new Cesium.Cesium3DTileset({
          url: item.url,
          show: true,
          // 细节层次优化配置
          maximumScreenSpaceError: 2,  // 降低SSE值，提高模型清晰度
          skipLevelOfDetail: true,
          baseScreenSpaceError: 1024,
          skipScreenSpaceErrorFactor: 16,
          skipLevels: 1,
          immediatelyLoadDesiredLevelOfDetail: true,
          loadSiblings: false
        });

        // 添加到场景
        viewer.scene.primitives.add(tileset);

        // 监听加载完成
        const handleReady = () => {
          console.log(`[${this.componentName}] ✅ 倾斜摄影加载完成: ${item.name}`);

          // 获取边界球信息
          if (tileset.boundingSphere) {
            const sphere = tileset.boundingSphere;
            console.log(`[${this.componentName}] 📊 ${item.name} 边界球:`, {
              中心X: sphere.center.x.toFixed(2),
              中心Y: sphere.center.y.toFixed(2),
              中心Z: sphere.center.z.toFixed(2),
              半径: sphere.radius.toFixed(2) + '米'
            });
          }

          // 更新状态
          this.$set(item, 'loading', false);
          this.$set(item, 'loaded', true);
          this.$set(item, 'tileset', tileset);

          // 保存初始变换矩阵
          if (tileset.root && tileset.root.transform) {
            this.$set(item, 'initialTransform', Cesium.Matrix4.clone(tileset.root.transform));
            console.log(`[${this.componentName}] 💾 已保存初始变换矩阵: ${item.name}`);
          }

          // 自动定位到倾斜摄影位置（如果是第一个加载的）
          const hasOtherLoaded = this.obliquePhotographyList.some(i => i.id !== item.id && i.loaded);
          if (!hasOtherLoaded && tileset.boundingSphere) {
            viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
              duration: 2,
              offset: new Cesium.HeadingPitchRange(
                0,
                -45,
                tileset.boundingSphere.radius * 2.0
              )
            });
            console.log(`[${this.componentName}] ✅ 自动定位到倾斜摄影位置: ${item.name}`);
          }
        };

        const handleError = (error) => {
          console.error(`[${this.componentName}] ❌ 倾斜摄影加载失败: ${item.name}`, error);
          this.$set(item, 'loading', false);
          this.$set(item, 'loaded', false);
        };

        // 监听 readyPromise
        if (tileset.readyPromise) {
          if (typeof Promise !== 'undefined' && tileset.readyPromise instanceof Promise) {
            tileset.readyPromise.then(handleReady).catch(handleError);
          } else if (typeof tileset.readyPromise.then === 'function') {
            tileset.readyPromise.then(handleReady);
            if (typeof tileset.readyPromise.otherwise === 'function') {
              tileset.readyPromise.otherwise(handleError);
            }
          }
        }

        // 监听 tileFailed 事件
        if (tileset.tileFailed) {
          tileset.tileFailed.addEventListener(handleError);
        }

      } catch (error) {
        console.error(`[${this.componentName}] ❌ 倾斜摄影加载失败: ${item.name}`, error);
        this.$set(item, 'loading', false);
        this.$set(item, 'loaded', false);
      }
    },

    /**
     * 卸载倾斜摄影
     * @param {Object} item - 倾斜摄影项目配置
     */
    unloadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      console.log(`[${this.componentName}] 🗑️ 卸载倾斜摄影: ${item.name}`);

      if (item.tileset) {
        try {
          // 从场景中移除
          viewer.scene.primitives.remove(item.tileset);

          // 清空引用
          this.$set(item, 'tileset', null);
          this.$set(item, 'loaded', false);

          console.log(`[${this.componentName}] ✅ 倾斜摄影已卸载: ${item.name}`);
        } catch (error) {
          console.error(`[${this.componentName}] ❌ 倾斜摄影卸载失败: ${item.name}`, error);
        }
      }
    },

    // ==================== 高度偏移调整 ====================

    /**
     * 处理高度偏移滑块变化
     * @param {Object} item - 倾斜摄影项目配置
     * @param {Event} event - 输入事件
     */
    onHeightOffsetChange(item, event) {
      const newValue = parseFloat(event.target.value);
      this.$set(item, 'heightOffset', newValue);
      console.log(`[${this.componentName}] 📏 ${item.name} 高度偏移调整为: ${newValue.toFixed(1)} 米`);
      // 实时应用高度偏移
      this.applyObliqueHeightOffset(item);
    },

    /**
     * 处理高度输入框变化
     * @param {Object} item - 倾斜摄影项目配置
     * @param {Event} event - 输入事件
     */
    onHeightInputChange(item, event) {
      const newValue = parseFloat(event.target.value);
      if (isNaN(newValue)) return;

      this.$set(item, 'heightOffset', newValue);
      console.log(`[${this.componentName}] 📏 ${item.name} 高度偏移设置为: ${newValue.toFixed(1)} 米`);
      this.applyObliqueHeightOffset(item);
    },

    /**
     * 应用高度偏移到倾斜摄影
     * @param {Object} item - 倾斜摄影项目配置
     */
    applyObliqueHeightOffset(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium || !item.tileset || !item.loaded) {
        console.warn(`[${this.componentName}] ⚠️ 倾斜摄影未加载，无法应用高度偏移: ${item.name}`);
        return;
      }

      if (!item.initialTransform) {
        console.warn(`[${this.componentName}] ⚠️ 未找到初始变换矩阵，无法应用相对偏移: ${item.name}`);
        return;
      }

      console.log(`[${this.componentName}] 🔧 应用高度偏移到 ${item.name}: ${item.heightOffset.toFixed(1)} 米`);

      try {
        const tileset = item.tileset;

        // 基于初始变换矩阵计算新的变换（不累加）
        if (tileset.root) {
          const root = tileset.root;

          // 克隆初始变换矩阵
          const transform = Cesium.Matrix4.clone(item.initialTransform);

          // 从变换矩阵中提取平移部分
          const position = new Cesium.Cartesian3();
          Cesium.Matrix4.getTranslation(item.initialTransform, position);

          // 检查位置是否有效
          const magnitude = Cesium.Cartesian3.magnitude(position);
          if (!isFinite(magnitude) || magnitude === 0) {
            console.warn(`[${this.componentName}] ⚠️ 从变换矩阵提取的位置无效: ${item.name}`);
            return;
          }

          // 计算新的位置（在局部坐标系中应用高度偏移）
          // 注意：这里使用简化的处理方式，直接在 Z 轴方向偏移
          const offset = new Cesium.Cartesian3(0, 0, item.heightOffset);
          const translation = Cesium.Matrix4.fromTranslation(offset);
          Cesium.Matrix4.multiply(transform, translation, transform);
          root.transform = transform;

          console.log(`[${this.componentName}] ✅ ${item.name} 高度偏移已应用`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] ❌ 应用高度偏移失败: ${item.name}`, error);
      }
    },

    /**
     * 应用推荐偏移值
     * @param {Object} item - 倾斜摄影项目配置
     */
    applyRecommendedOffset(item) {
      if (item.recommendedOffset === null || item.recommendedOffset === undefined) {
        console.warn(`[${this.componentName}] ⚠️ ${item.name} 没有推荐偏移值`);
        return;
      }

      console.log(`[${this.componentName}] 🎯 应用推荐偏移值: ${item.name} = ${item.recommendedOffset.toFixed(1)} 米`);
      this.$set(item, 'heightOffset', item.recommendedOffset);
      this.applyObliqueHeightOffset(item);
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
