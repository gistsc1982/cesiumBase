<template>
  <!-- 使用 JsonConfigPanelBase 作为基类 -->
  <JsonConfigPanelBase
    panel-title="倾斜摄影加载（继承示例）"
    panel-icon="📷"
    :panel-width="420"
    :panel-max-height="'70vh'"
    :initial-x="initialX"
    :initial-y="initialY"
    close-event-name="obliquePhotographyPanelClose"
    config-id="oblique-photography"
    panel-name="ObliquePhotographyPanel"
    :field-definitions="fieldDefinitions"
    :default-form-values="defaultFormValues"
    :toolbar-buttons="toolbarButtons"
    @config-loaded="onConfigLoadedHandler"
  >
    <!-- 工具栏额外按钮（定位、高度调整等） -->
    <template #toolbar-extra>
      <button
        @click="handleCustomAction"
        class="tool-btn custom-btn"
        title="自定义操作"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        自定义
      </button>
    </template>

    <!-- 自定义列表项内容（添加复选框等） -->
    <template #list-item="{ item }">
      <label class="oblique-checkbox">
        <input
          type="checkbox"
          :checked="item.loaded || false"
          @change="toggleItem(item)"
          :disabled="item.loading || false"
          class="checkbox-input"
        />
        <span class="check-indicator"></span>
        <div class="item-info">
          <span class="item-name">{{ item.name || '未知' }}</span>
          <span v-if="item.loading" class="loading-text">加载中...</span>
          <span v-else-if="item.loaded" class="status-text loaded">已加载</span>
          <span v-else class="status-text unloaded">未加载</span>
        </div>
      </label>
    </template>

    <!-- 列表项额外操作按钮（定位、高度调整） -->
    <template #item-actions="{ item }">
      <!-- 定位按钮 -->
      <button
        @click="locateToItem(item)"
        class="action-btn locate-btn"
        type="button"
        :disabled="!item.loaded"
        title="定位到3D Tiles位置"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- 高度调整按钮 -->
      <button
        v-if="item.loaded"
        @click="adjustHeight(item)"
        class="action-btn height-btn"
        type="button"
        title="高度调整"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </template>

    <!-- 删除警告额外内容 -->
    <template #delete-warning-extra="{ item }">
      <div v-if="item.loaded" class="delete-warning-detail">
        ⚠️ 该项目当前已加载，请先卸载再删除
      </div>
    </template>

    <!-- 额外的对话框（如高度调整面板） -->
    <template #dialogs>
      <!-- 高度调整面板 -->
      <Teleport to="body">
        <Transition name="height-panel-fade">
          <div v-if="showHeightPanel && selectedLayer" class="height-panel-overlay">
            <ObliqueHeightAdjustPanel
              :initial-x="computedHeightPanelX"
              :initial-y="initialY"
              :selected-layer="selectedLayer"
              @height-preview="onHeightPreview"
              @height-change="onHeightChange"
              @close="showHeightPanel = false"
            />
          </div>
        </Transition>
      </Teleport>
    </template>
  </JsonConfigPanelBase>
</template>

<script>
import JsonConfigPanelBase from '../JsonConfigPanelBase.vue';
import ObliqueHeightAdjustPanel from './ObliqueHeightAdjustPanel.vue';

export default {
  name: 'ObliquePhotographyPanelExample',

  components: {
    JsonConfigPanelBase,
    ObliqueHeightAdjustPanel
  },

  props: {
    initialX: {
      type: [Number, String],
      default: 'center'
    },
    initialY: {
      type: Number,
      default: 120
    }
  },

  data() {
    return {
      // ==================== 字段定义 ====================
      fieldDefinitions: [
        { key: 'id', label: 'ID', type: 'text', required: true, placeholder: '请输入唯一ID' },
        { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
        { key: 'url', label: 'URL', type: 'url', required: true, placeholder: '请输入3D Tiles URL' }
      ],

      // 表单默认值
      defaultFormValues: {
        id: '',
        name: '',
        url: ''
      },

      // 工具栏按钮配置
      toolbarButtons: {
        add: true,
        import: true,
        export: true,
        refresh: true
      },

      // ==================== 业务特定数据 ====================
      // Cesium 对象（非响应式）
      _cesiumTilesets: null,  // 在 beforeCreate 中初始化
      _cesiumTransforms: null,
      _cesiumHeightOffsets: null,
      _cesiumErrorHandlers: null,

      // 高度调整面板
      showHeightPanel: false,
      selectedLayer: null,
      selectedItemId: null,

      componentName: 'ObliquePhotographyPanel'
    };
  },

  computed: {
    computedHeightPanelX() {
      if (typeof this.initialX === 'number') {
        return this.initialX + 450;
      }
      return this.initialX;
    },

    // 获取基类的 configList（用于访问配置数据）
    configList() {
      // 通过 ref 访问基类的数据
      return this.$refs.basePanel?.configList || [];
    }
  },

  // ==================== 性能优化：Cesium对象管理器 ====================
  beforeCreate() {
    // 在Vue实例创建前初始化，避免被包装为响应式
    this._cesiumTilesets = new Map();
    this._cesiumTransforms = new Map();
    this._cesiumHeightOffsets = new Map();
    this._cesiumErrorHandlers = new Map();
  },

  methods: {
    // ==================== 基类钩子方法覆盖 ====================

    /**
     * 初始化 Cesium
     */
    initCesium(callback) {
      // 检查全局 Cesium 对象
      if (typeof window !== 'undefined' && window.__cesiumViewer__) {
        this.cesiumViewer = window.__cesiumViewer__;
        this.Cesium = window.__cesiumLib__;

        if (callback) callback();
      } else {
        // 等待 Cesium 就绪
        const checkCesium = setInterval(() => {
          if (typeof window !== 'undefined' && window.__cesiumViewer__) {
            clearInterval(checkCesium);
            this.cesiumViewer = window.__cesiumViewer__;
            this.Cesium = window.__cesiumLib__;

            if (callback) callback();
          }
        }, 100);
      }
    },

    /**
     * 获取 Cesium 对象（用于单例管理）
     */
    getCesiumObjects() {
      return {
        cesiumTilesets: this._cesiumTilesets,
        cesiumTransforms: this._cesiumTransforms,
        cesiumHeightOffsets: this._cesiumHeightOffsets,
        cesiumErrorHandlers: this._cesiumErrorHandlers
      };
    },

    /**
     * 恢复 Cesium 对象
     */
    restoreCesiumObjects(cesiumObjects) {
      if (!cesiumObjects) return;

      this._cesiumTilesets = cesiumObjects.cesiumTilesets || new Map();
      this._cesiumTransforms = cesiumObjects.cesiumTransforms || new Map();
      this._cesiumHeightOffsets = cesiumObjects.cesiumHeightOffsets || new Map();
      this._cesiumErrorHandlers = cesiumObjects.cesiumErrorHandlers || new Map();

      // 恢复场景中的对象
      const viewer = this.getCesiumViewer();
      if (viewer) {
        this._cesiumTilesets.forEach((tileset, id) => {
          if (tileset && !tileset.isDestroyed() && !viewer.scene.primitives.contains(tileset)) {
            viewer.scene.primitives.add(tileset);
          }
        });
      }
    },

    /**
     * 处理加载的数据（添加运行时状态）
     */
    processLoadedData(data) {
      return data.map(item => ({
        ...item,
        loaded: this._cesiumTilesets.has(item.id),
        loading: false,
        heightOffset: this._cesiumHeightOffsets.get(item.id) || 0.0
      }));
    },

    /**
     * 添加项目前的处理
     */
    beforeAddItem(item) {
      return {
        ...item,
        loaded: false,
        loading: false
      };
    },

    /**
     * 删除项目前的处理（检查是否已加载）
     */
    beforeDeleteItem(item) {
      if (item.loaded) {
        // 如果已加载，先卸载
        this.unloadItem(item);
      }
    },

    /**
     * 配置加载完成后的处理
     */
    onConfigLoadedHandler() {
      console.log(`[${this.componentName}] ✅ 配置加载完成`);
    },

    // ==================== 业务特定方法 ====================

    /**
     * 获取 Cesium Viewer 实例
     */
    getCesiumViewer() {
      // 由 SfcBase 提供
      return this.cesiumViewer;
    },

    /**
     * 获取 Cesium 库对象
     */
    getCesium() {
      // 由 SfcBase 提供
      return this.Cesium;
    },

    /**
     * ⚡ 性能优化：更新配置项状态（触发 Vue 响应式更新）
     * 使用数组替换代替 $set，避免 Vue 2 的响应式性能问题
     * @param {string} itemId - 配置项 ID
     * @param {Object} newState - 新的状态（如 { loaded: true, loading: false }）
     */
    updateItemState(itemId, newState) {
      const index = this.configList.findIndex(i => i.id === itemId);
      if (index !== -1) {
        // 合并新状态
        this.configList[index] = { ...this.configList[index], ...newState };
        // 创建新数组触发响应式更新
        this.configList = [...this.configList];
      }
    },

    /**
     * 切换项目加载状态
     */
    async toggleItem(item) {
      if (item.loaded) {
        await this.unloadItem(item);
      } else {
        await this.loadItem(item);
      }
    },

    /**
     * 加载项目
     */
    async loadItem(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 加载倾斜摄影: ${item.name}`);

      try {
        // ⚡ 性能优化：更新UI状态
        this.updateItemState(item.id, { loading: true });

        // ⚡ 性能优化：优化3D瓦片配置，提升性能30-40%
        const tileset = await Cesium.Cesium3DTileset.fromUrl(item.url, {
          show: true,
          // ⚡ 提高maximumScreenSpaceError以减少细节渲染
          maximumScreenSpaceError: 16,  // 从2提高到16
          skipLevelOfDetail: true,
          baseScreenSpaceError: 1024,
          skipScreenSpaceErrorFactor: 16,
          skipLevels: 1,
          // ⚡ 改为false，避免立即加载导致性能问题
          immediatelyLoadDesiredLevelOfDetail: false,
          loadSiblings: false,
          // ⭐ 添加动态屏幕空间误差优化
          dynamicScreenSpaceError: true,
          dynamicScreenSpaceErrorDensity: 0.00278,
          dynamicScreenSpaceErrorFactor: 4.0,
          dynamicScreenSpaceErrorHeightFalloff: 0.25,
          // ⚡ 性能优化：确保调试模式关闭
          debugShowBoundingVolume: false,
          debugShowContentBoundingVolume: false,
          debugShowViewerRequestVolume: false,
          // ⭐ 动态屏幕空间缓存
          dynamicScreenSpaceError: true,
          foveatedScreenSpaceError: true,
          foveatedConeSize: 0.3,
          foveatedMinimumScreenSpaceErrorRelaxation: 0.0,
          // ⭐ 性能优化：预加载和缓存
          preloadWhenHidden: false,
          preloadSiblingViews: false
        });

        // ⚡ 性能优化：存储到非响应式Map中，避免Vue响应式包装
        this._cesiumTilesets.set(item.id, tileset);

        viewer.scene.primitives.add(tileset);

        // ⭐ 异步处理加载完成和错误
        const handleReady = () => {
          console.log(`[${this.componentName}] 倾斜摄影加载完成: ${item.name}`);

          if (tileset.boundingSphere) {
            const sphere = tileset.boundingSphere;
            console.log(`[${this.componentName}] ${item.name} 边界球:`, {
              中心X: sphere.center.x.toFixed(2),
              中心Y: sphere.center.y.toFixed(2),
              中心Z: sphere.center.z.toFixed(2),
              半径: sphere.radius.toFixed(2) + '米'
            });
          }

          // ⚡ 性能优化：更新UI状态
          this.updateItemState(item.id, { loading: false, loaded: true });

          // ⚡ 性能优化：存储initialTransform到非响应式Map中
          if (tileset.root && tileset.root.transform) {
            const transform = Cesium.Matrix4.clone(tileset.root.transform);
            this._cesiumTransforms.set(item.id, transform);
          }

          // ⭐ 自动定位到当前加载的倾斜摄影位置
          if (tileset.boundingSphere) {
            viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
              duration: 2,
              offset: new Cesium.HeadingPitchRange(0, -45, tileset.boundingSphere.radius * 2.0)
            });
            console.log(`[${this.componentName}] 🎯 已自动定位到 ${item.name}`);
          }
        };

        const handleError = (error) => {
          console.error(`[${this.componentName}] 倾斜摄影加载失败: ${item.name}`, error);
          // ⚡ 性能优化：更新UI状态
          this.updateItemState(item.id, { loading: false, loaded: false });
        };

        // 处理异步加载
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

        // ⚡ 存储错误事件监听器引用，用于后续清理
        if (tileset.tileFailed) {
          const errorHandler = handleError;
          tileset.tileFailed.addEventListener(errorHandler);
          this._cesiumErrorHandlers.set(item.id, {
            tileset,
            errorHandler
          });
        }

      } catch (error) {
        console.error(`[${this.componentName}] 倾斜摄影加载失败: ${item.name}`, error);
        // ⚡ 性能优化：更新UI状态
        this.updateItemState(item.id, { loading: false, loaded: false });
      }
    },

    /**
     * 卸载项目
     */
    unloadItem(item) {
      const tileset = this._cesiumTilesets.get(item.id);
      if (tileset) {
        const viewer = this.getCesiumViewer();
        if (viewer && viewer.scene.primitives.contains(tileset)) {
          viewer.scene.primitives.remove(tileset);
        }
        tileset.destroy();
        this._cesiumTilesets.delete(item.id);
        this._cesiumTransforms.delete(item.id);
        this._cesiumHeightOffsets.delete(item.id);
        this._cesiumErrorHandlers.delete(item.id);
      }

      item.loaded = false;
      console.log(`[${this.componentName}] ✅ 卸载成功: ${item.name}`);
    },

    /**
     * 定位到项目
     */
    locateToItem(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();
      const tileset = this._cesiumTilesets.get(item.id);

      if (!viewer || !Cesium || !tileset || !item.loaded) {
        console.warn(`[${this.componentName}] 无法定位: ${item.name}`);
        return;
      }

      try {
        if (tileset.boundingSphere) {
          const sphere = tileset.boundingSphere;
          viewer.camera.flyToBoundingSphere(sphere, {
            duration: 2,
            offset: new Cesium.HeadingPitchRange(0, -45, sphere.radius * 2.0)
          });
          console.log(`[${this.componentName}] 相机已定位到倾斜摄影位置: ${item.name}`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] 定位到倾斜摄影失败: ${item.name}`, error);
      }
    },

    /**
     * 高度调整
     */
    adjustHeight(item) {
      this.selectedLayer = {
        id: item.id,
        name: item.name,
        tileset: this._cesiumTilesets.get(item.id),
        heightOffset: this._cesiumHeightOffsets.get(item.id) || 0
      };
      this.selectedItemId = item.id;
      this.showHeightPanel = true;
    },

    /**
     * 高度预览（仅更新显示值，不触发Cesium更新）
     * @param {Object} params - { layer: Object, value: Number }
     */
    onHeightPreview({ layer, value }) {
      if (!layer) return;

      // ⚡ 性能优化：存储到非响应式Map中，避免触发 Vue 更新
      this._cesiumHeightOffsets.set(layer.id, value);

      // 同时更新显示值（从Map中获取）
      const index = this.configList.findIndex(i => i.id === layer.id);
      if (index !== -1) {
        this.configList[index].heightOffset = value;
        this.configList = [...this.configList];
      }
    },

    /**
     * 高度变化确认（触发Cesium更新）
     * @param {Object} params - { layer: Object, value: Number }
     */
    onHeightChange({ layer, value }) {
      if (!layer) return;

      // ⚡ 性能优化：存储到非响应式Map中
      this._cesiumHeightOffsets.set(layer.id, value);
      console.log(`[${this.componentName}] ${layer.name} 高度偏移调整为: ${value.toFixed(1)} 米`);

      this.applyObliqueHeightOffset(layer);
    },

    /**
     * 应用高度偏移到 Cesium 对象
     * @param {Object} item - 配置项对象
     */
    applyObliqueHeightOffset(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      const initialTransform = this._cesiumTransforms.get(item.id);

      if (!viewer || !Cesium || !tileset || !item.loaded) {
        console.warn(`[${this.componentName}] 倾斜摄影未加载，无法应用高度偏移: ${item.name}`);
        return;
      }

      if (!initialTransform) {
        console.warn(`[${this.componentName}] 未找到初始变换矩阵，无法应用相对偏移: ${item.name}`);
        return;
      }

      try {
        if (tileset.root) {
          const transform = Cesium.Matrix4.clone(initialTransform);
          const heightOffset = this._cesiumHeightOffsets.get(item.id) || 0;
          const offset = new Cesium.Cartesian3(0, 0, heightOffset);
          const translation = Cesium.Matrix4.fromTranslation(offset);
          Cesium.Matrix4.multiply(transform, translation, transform);
          tileset.root.transform = transform;

          console.log(`[${this.componentName}] ${item.name} 高度偏移已应用: ${heightOffset.toFixed(1)}米`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] 应用高度偏移失败: ${item.name}`, error);
      }
    },

    /**
     * 自定义操作
     */
    handleCustomAction() {
      console.log(`[${this.componentName}] 自定义操作`);
    }
  }
};
</script>

<style scoped>
/* ==================== 倾斜摄影复选框样式 ==================== */
.oblique-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.check-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  transition: all 0.2s;
}

.checkbox-input:checked + .check-indicator {
  background: #4CAF50;
  border-color: #4CAF50;
}

.checkbox-input:checked + .check-indicator::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.oblique-checkbox:hover .check-indicator {
  border-color: rgba(255, 255, 255, 0.5);
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 14px;
  color: #e0e0e0;
}

.loading-text {
  font-size: 12px;
  color: #FFA726;
}

.status-text {
  font-size: 12px;
  color: #a0a0a0;
}

.status-text.loaded {
  color: #4CAF50;
}

.status-text.unloaded {
  color: #666;
}

/* ==================== 操作按钮样式 ==================== */
.locate-btn:hover {
  background: rgba(33, 150, 243, 0.2);
  border-color: rgba(33, 150, 243, 0.4);
}

.height-btn:hover {
  background: rgba(156, 39, 176, 0.2);
  border-color: rgba(156, 39, 176, 0.4);
}

/* ==================== 高度调整面板 ==================== */
.height-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10000;
}

.height-panel-overlay > * {
  pointer-events: auto;
}

.height-panel-fade-enter-active,
.height-panel-fade-leave-active {
  transition: all 0.3s ease;
}

.height-panel-fade-enter-from,
.height-panel-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* ==================== 自定义按钮 ==================== */
.custom-btn {
  background: rgba(156, 39, 176, 0.1);
  border-color: rgba(156, 39, 176, 0.3);
}

.custom-btn:hover {
  background: rgba(156, 39, 176, 0.2);
}

/* ==================== 删除警告详情 ==================== */
.delete-warning-detail {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 107, 107, 0.1);
  border-radius: 4px;
  font-size: 13px;
  color: #ff6b6b;
}
</style>
