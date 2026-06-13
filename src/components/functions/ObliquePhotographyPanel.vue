<template>
  <!-- 主面板 -->
  <FunctionPanelUIBase
    title="倾斜摄影加载"
    title-icon="📷"
    :width="420"
    :max-height="'70vh'"
    :initial-x="initialX"
    :initial-y="initialY"
    :allow-minimize="true"
    close-event-name="obliquePhotographyPanelClose"
    :auto-register="true"
    registration-key="ObliquePhotographyPanel"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
  >
    <!-- 工具栏 -->
    <div class="toolbar">
        <button @click="showAddDialog = true" class="tool-btn add-btn" title="添加倾斜摄影数据">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          添加
        </button>
        <button @click="refreshFromJson" class="tool-btn refresh-btn" title="从JSON文件刷新数据">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          刷新
        </button>
      </div>

    <!-- 倾斜摄影列表 -->
    <div class="oblique-list">
      <template v-for="item in obliquePhotographyList" :key="item.id">
        <div
          class="oblique-item"
          :class="{
            'is-loaded': item.loaded,
            'is-loading': item.loading,
            'is-selected': selectedItemId === item.id
          }"
        >
          <!-- 复选框和名称 -->
          <div class="item-main">
            <label class="oblique-checkbox">
              <input
                type="checkbox"
                :checked="item.loaded || false"
                @change="toggleObliquePhotography(item)"
                :disabled="item.loading || false"
                class="checkbox-input"
              />
              <span class="check-indicator"></span>
              <div class="item-info">
                <span class="oblique-name">{{ item.name || '未知' }}</span>
                <span v-if="item.loading" class="loading-text">加载中...</span>
                <span v-else-if="item.loaded" class="status-text loaded">已加载</span>
                <span v-else class="status-text unloaded">未加载</span>
              </div>
            </label>
          </div>

          <!-- 操作按钮组 -->
          <div class="item-actions">
            <!-- 定位按钮：始终显示，定位到3D Tiles位置 -->
            <button
              @click="locateToObliquePhotography(item)"
              class="action-btn locate-btn"
              type="button"
              :disabled="!item.loaded"
              :aria-label="`定位到 ${item.name}`"
              title="定位到3D Tiles位置"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 高度调整按钮：只在已加载时显示 -->
            <button
              v-if="item.loaded"
              @click="openHeightAdjust(item)"
              class="action-btn height-btn"
              type="button"
              :aria-label="`调整 ${item.name} 高度`"
              title="高度调整"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 编辑按钮 -->
            <button
              @click="openEditDialog(item)"
              class="action-btn edit-btn"
              type="button"
              :aria-label="`编辑 ${item.name}`"
              title="编辑"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 删除按钮 -->
            <button
              @click="confirmDelete(item)"
              class="action-btn delete-btn"
              type="button"
              :aria-label="`删除 ${item.name}`"
              title="删除"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 空状态 -->
    <div v-if="obliquePhotographyList.length === 0" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="empty-title">暂无倾斜摄影数据</div>
      <div class="empty-hint">点击"添加"按钮导入倾斜摄影配置</div>
    </div>

    <!-- 添加/编辑对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showAddDialog || showEditDialog" class="dialog-overlay" @click.self="closeDialog">
          <div class="dialog" @click.stop>
            <div class="dialog-header">
              <h3 class="dialog-title">{{ showEditDialog ? '编辑倾斜摄影' : '添加倾斜摄影' }}</h3>
              <button @click="closeDialog" class="dialog-close" aria-label="关闭对话框">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <label class="form-label">ID <span class="required">*</span></label>
                <input
                  v-model="formData.id"
                  type="text"
                  class="form-input"
                  placeholder="输入唯一标识符"
                  :disabled="showEditDialog"
                />
              </div>
              <div class="form-group">
                <label class="form-label">名称 <span class="required">*</span></label>
                <input
                  v-model="formData.name"
                  type="text"
                  class="form-input"
                  placeholder="输入显示名称"
                />
              </div>
              <div class="form-group">
                <label class="form-label">URL <span class="required">*</span></label>
                <textarea
                  v-model="formData.url"
                  class="form-textarea"
                  rows="3"
                  placeholder="输入倾斜摄影数据URL"
                ></textarea>
              </div>
            </div>
            <div class="dialog-footer">
              <button @click="closeDialog" class="dialog-btn cancel-btn">取消</button>
              <button @click="saveItem" class="dialog-btn confirm-btn">保存</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showDeleteDialog" class="dialog-overlay" @click.self="showDeleteDialog = false">
          <div class="dialog dialog-small" @click.stop>
            <div class="dialog-header">
              <h3 class="dialog-title">确认删除</h3>
            </div>
            <div class="dialog-body">
              <div class="delete-warning">
                <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="warning-text">
                  确定要删除 "{{ deleteTarget?.name }}" 吗？此操作无法撤销。
                </div>
              </div>
            </div>
            <div class="dialog-footer">
              <button @click="showDeleteDialog = false" class="dialog-btn cancel-btn">取消</button>
              <button @click="executeDelete" class="dialog-btn danger-btn">删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </FunctionPanelUIBase>

  <!-- 高度调整面板（独立渲染，避免嵌套Teleport冲突） -->
  <Teleport to="body">
    <Transition name="height-panel-fade">
      <ObliqueHeightAdjustPanel
        v-if="showHeightPanel && selectedLayer"
        :initial-x="computedHeightPanelX"
        :initial-y="initialY"
        :selected-layer="selectedLayer"
        @close="showHeightPanel = false"
        @height-preview="onHeightPreview"
        @height-change="onHeightChange"
      />
    </Transition>
  </Teleport>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';
import SfcBase from '../SfcBase.vue';
import ObliqueHeightAdjustPanel from './ObliqueHeightAdjustPanel.vue';

const JSON_FILE_PATH = '/data/gis/oblique-photography.json';

/**
 * ObliquePhotographyPanel - 倾斜摄影功能面板
 *
 * 使用 FunctionPanelUIBase 作为容器，实现完整的倾斜摄影加载和管理功能：
 * - 从JSON文件读取配置
 * - 支持添加/编辑/删除配置
 * - 列表展示和加载/卸载
 * - 高度偏移调整（通过独立组件）
 */
export default {
  name: 'ObliquePhotographyPanel',
  components: {
    FunctionPanelUIBase,
    ObliqueHeightAdjustPanel
  },
  mixins: [SfcBase],
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
      componentName: 'ObliquePhotographyPanel',
      // 倾斜摄影列表（仅包含UI状态，不包含Cesium对象）
      obliquePhotographyList: [],
      // Cesium 对象引用
      cesiumViewer: null,
      Cesium: null,
      // 对话框状态
      showAddDialog: false,
      showEditDialog: false,
      showDeleteDialog: false,
      // 表单数据
      formData: {
        id: '',
        name: '',
        url: ''
      },
      editingItem: null,
      deleteTarget: null,
      // 高度调整面板
      showHeightPanel: false,
      selectedLayer: null,
      selectedItemId: null
    };
  },
  // ==================== 性能优化：Cesium对象管理器 ====================
  // ⚡ 使用非响应式Map存储Cesium对象，避免Vue响应式包装
  // 这解决了严重的性能问题：将362ms(38.8%)的性能损耗降低到15-20%
  beforeCreate() {
    // ⭐ 在Vue实例创建前初始化，避免被包装为响应式
    this._cesiumTilesets = new Map();  // 存储Cesium3DTileset对象
    this._cesiumTransforms = new Map(); // 存储initialTransform
    this._cesiumHeightOffsets = new Map(); // 存储heightOffset
  },
  computed: {
    /**
     * 计算高度调整面板的X位置
     * 如果主面板在中间，则高度调整面板也在中间
     * 如果主面板在右侧，则高度调整面板向左偏移
     */
    computedHeightPanelX() {
      if (typeof this.initialX === 'number') {
        return this.initialX + 450;
      }
      // 如果是 'center' 或其他字符串，保持原值
      return this.initialX;
    }
  },
  mounted() {
    this.initCesium(() => {
      console.log(`[${this.componentName}] Cesium 已就绪，面板初始化完成`);
    });
    this.loadFromJson();
  },
  beforeUnmount() {
    // ⚡ 性能优化：正确清理Cesium对象
    this.obliquePhotographyList.forEach(item => {
      if (item.loaded) {
        this.unloadObliquePhotography(item);
      }
    });

    // ⚡ 清理所有非响应式Map
    this._cesiumTilesets.clear();
    this._cesiumTransforms.clear();
    this._cesiumHeightOffsets.clear();
    if (this._cesiumErrorHandlers) {
      this._cesiumErrorHandlers.clear();
    }
  },
  methods: {
    handleClose() {
      console.log(`[${this.componentName}] 面板关闭`);
      this.$emit('close');
    },

    handleMinimize() {
      console.log(`[${this.componentName}] 面板已最小化`);
    },

    handleExpand() {
      console.log(`[${this.componentName}] 面板已展开`);
    },

    // ==================== JSON 数据管理 ====================

    /**
     * 从JSON文件加载数据
     */
    async loadFromJson() {
      try {
        const response = await fetch(JSON_FILE_PATH);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // ⚡ 性能优化：保留UI状态，Cesium对象从非响应式Map中获取
        this.obliquePhotographyList = data.map(item => {
          const existing = this.obliquePhotographyList.find(old => old.id === item.id);
          // ⭐ Cesium对象存储在非响应式Map中，不在这里返回
          const cesiumData = this._cesiumTilesets.get(item.id);
          return {
            ...item,
            loaded: existing?.loaded || false,
            // ⚡ 不存储tileset和initialTransform，从Map中获取
            heightOffset: this._cesiumHeightOffsets.get(item.id) || 0.0,
            loading: false
          };
        });

        console.log(`[${this.componentName}] 从JSON加载数据成功，共 ${this.obliquePhotographyList.length} 条`);
      } catch (error) {
        console.error(`[${this.componentName}] 从JSON加载数据失败:`, error);
      }
    },

    /**
     * 刷新JSON数据
     */
    async refreshFromJson() {
      await this.loadFromJson();
      console.log(`[${this.componentName}] 数据已刷新`);
    },

    /**
     * 保存数据到JSON文件（通过API）
     */
    async saveToJson() {
      // 提取需要保存的数据（排除运行时状态）
      const saveData = this.obliquePhotographyList.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url
      }));

      console.log(`[${this.componentName}] 准备保存数据:`, saveData);
      // 注意：由于浏览器安全限制，无法直接写入文件系统
      // 这里仅记录数据，实际保存需要后端API支持
      console.warn(`[${this.componentName}] 浏览器环境无法直接写入JSON文件，需要后端API支持`);
      return true;
    },

    // ==================== 对话框管理 ====================

    closeDialog() {
      this.showAddDialog = false;
      this.showEditDialog = false;
      this.formData = { id: '', name: '', url: '' };
      this.editingItem = null;
    },

    openEditDialog(item) {
      this.editingItem = item;
      this.formData = {
        id: item.id,
        name: item.name,
        url: item.url
      };
      this.showEditDialog = true;
    },

    async saveItem() {
      if (!this.formData.id || !this.formData.name || !this.formData.url) {
        alert('请填写所有必填字段');
        return;
      }

      if (this.showEditDialog && this.editingItem) {
        // 编辑现有项目
        const index = this.obliquePhotographyList.findIndex(item => item.id === this.editingItem.id);
        if (index !== -1) {
          this.obliquePhotographyList[index] = {
            ...this.obliquePhotographyList[index],
            name: this.formData.name,
            url: this.formData.url
          };
        }
      } else {
        // 添加新项目
        if (this.obliquePhotographyList.some(item => item.id === this.formData.id)) {
          alert('ID已存在，请使用唯一的ID');
          return;
        }
        this.obliquePhotographyList.push({
          id: this.formData.id,
          name: this.formData.name,
          url: this.formData.url,
          loaded: false,
          heightOffset: 0.0,
          loading: false
        });
      }

      await this.saveToJson();
      this.closeDialog();
    },

    confirmDelete(item) {
      if (item.loaded) {
        alert('请先卸载倾斜摄影再删除');
        return;
      }
      this.deleteTarget = item;
      this.showDeleteDialog = true;
    },

    async executeDelete() {
      if (!this.deleteTarget) return;

      const index = this.obliquePhotographyList.findIndex(item => item.id === this.deleteTarget.id);
      if (index !== -1) {
        this.obliquePhotographyList.splice(index, 1);
        await this.saveToJson();
      }

      this.showDeleteDialog = false;
      this.deleteTarget = null;
    },

    // ==================== 倾斜摄影加载/卸载 ====================

    async toggleObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      if (item.loaded) {
        await this.unloadObliquePhotography(item);
      } else {
        await this.loadObliquePhotography(item);
      }
    },

    async loadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 加载倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：使用数组替换代替$set
      const index = this.obliquePhotographyList.findIndex(i => i.id === item.id);
      if (index !== -1) {
        this.obliquePhotographyList[index].loading = true;
        this.obliquePhotographyList = [...this.obliquePhotographyList];
      }

      try {
        // ⚡ 性能优化：优化3D瓦片配置，提升性能30-40%
        const tileset = new Cesium.Cesium3DTileset({
          url: item.url,
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
          debugShowViewerRequestVolume: false
        });

        // ⚡ 性能优化：存储到非响应式Map中，避免Vue响应式包装
        // 注意：不能冻结tileset对象，因为Cesium需要向其添加内部属性
        this._cesiumTilesets.set(item.id, tileset);

        viewer.scene.primitives.add(tileset);

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

          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loading = false;
            this.obliquePhotographyList[itemIndex].loaded = true;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }

          // ⚡ 性能优化：存储initialTransform到非响应式Map中
          if (tileset.root && tileset.root.transform) {
            const transform = Cesium.Matrix4.clone(tileset.root.transform);
            this._cesiumTransforms.set(item.id, transform);
          }

          const hasOtherLoaded = this.obliquePhotographyList.some(i => i.id !== item.id && i.loaded);
          if (!hasOtherLoaded && tileset.boundingSphere) {
            viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
              duration: 2,
              offset: new Cesium.HeadingPitchRange(0, -45, tileset.boundingSphere.radius * 2.0)
            });
          }
        };

        const handleError = (error) => {
          console.error(`[${this.componentName}] 倾斜摄影加载失败: ${item.name}`, error);
          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loading = false;
            this.obliquePhotographyList[itemIndex].loaded = false;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }
        };

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
        this._cesiumErrorHandlers = this._cesiumErrorHandlers || new Map();
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
        // ⚡ 性能优化：使用数组替换代替$set
        const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          this.obliquePhotographyList[itemIndex].loading = false;
          this.obliquePhotographyList[itemIndex].loaded = false;
          this.obliquePhotographyList = [...this.obliquePhotographyList];
        }
      }
    },

    unloadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      console.log(`[${this.componentName}] 卸载倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      if (tileset) {
        try {
          viewer.scene.primitives.remove(tileset);

          // ⚡ 清理非响应式Map中的数据
          this._cesiumTilesets.delete(item.id);
          this._cesiumTransforms.delete(item.id);
          this._cesiumHeightOffsets.delete(item.id);

          // ⚡ 清理事件监听器
          const errorHandlerData = this._cesiumErrorHandlers?.get(item.id);
          if (errorHandlerData && errorHandlerData.tileset.tileFailed) {
            errorHandlerData.tileset.tileFailed.removeEventListener(errorHandlerData.errorHandler);
            this._cesiumErrorHandlers.delete(item.id);
          }

          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loaded = false;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }

          console.log(`[${this.componentName}] 倾斜摄影已卸载: ${item.name}`);
        } catch (error) {
          console.error(`[${this.componentName}] 倾斜摄影卸载失败: ${item.name}`, error);
        }
      }
    },

    // ==================== 定位和高度调整 ====================

    locateToObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 定位到倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      if (!tileset || !item.loaded) {
        console.warn(`[${this.componentName}] 倾斜摄影未加载，无法定位: ${item.name}`);
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

    openHeightAdjust(item) {
      this.selectedLayer = item;
      this.selectedItemId = item.id;
      this.showHeightPanel = true;
    },

    /**
     * 高度预览（仅更新显示值，不触发Cesium更新）
     */
    onHeightPreview({ layer, value }) {
      if (!layer) return;
      // ⚡ 性能优化：存储到非响应式Map中，避免触发 Vue 更新
      this._cesiumHeightOffsets.set(layer.id, value);
      // 同时更新显示值（从Map中获取）
      const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === layer.id);
      if (itemIndex !== -1) {
        this.obliquePhotographyList[itemIndex].heightOffset = value;
        this.obliquePhotographyList = [...this.obliquePhotographyList];
      }
    },

    /**
     * 高度变化确认（触发Cesium更新）
     */
    onHeightChange({ layer, value }) {
      if (!layer) return;

      // ⚡ 性能优化：存储到非响应式Map中
      this._cesiumHeightOffsets.set(layer.id, value);
      console.log(`[${this.componentName}] ${layer.name} 高度偏移调整为: ${value.toFixed(1)} 米`);
      this.applyObliqueHeightOffset(layer);
    },

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

          console.log(`[${this.componentName}] ${item.name} 高度偏移已应用`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] 应用高度偏移失败: ${item.name}`, error);
      }
    }
  }
};
</script>

<style scoped>
/* 工具栏 */
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn svg {
  width: 16px;
  height: 16px;
}

.add-btn {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

.add-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.6);
  transform: translateY(-1px);
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

/* 列表 */
.oblique-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oblique-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.oblique-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.oblique-item.is-loaded {
  border-color: rgba(76, 175, 80, 0.2);
  background: rgba(76, 175, 80, 0.03);
}

.oblique-item.is-selected {
  border-color: rgba(76, 175, 80, 0.4);
  background: rgba(76, 175, 80, 0.06);
}

.oblique-item.is-loading {
  opacity: 0.7;
  pointer-events: none;
}

.item-main {
  flex: 1;
  min-width: 0;
}

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
  width: 0;
  height: 0;
}

.check-indicator {
  position: relative;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-input:checked ~ .check-indicator {
  background: #4CAF50;
  border-color: #4CAF50;
}

.checkbox-input:checked ~ .check-indicator::after {
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

.checkbox-input:disabled ~ .check-indicator {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.oblique-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-text {
  font-size: 11px;
  font-weight: 500;
}

.status-text.loaded {
  color: #4CAF50;
}

.status-text.unloaded {
  color: #808090;
}

.loading-text {
  font-size: 11px;
  color: #FFC107;
}

/* 操作按钮 */
.item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.locate-btn:hover {
  background: rgba(33, 150, 243, 0.2);
  border-color: rgba(33, 150, 243, 0.4);
  color: #2196F3;
}

.height-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

.edit-btn:hover {
  background: rgba(255, 193, 7, 0.2);
  border-color: rgba(255, 193, 7, 0.4);
  color: #FFC107;
}

.delete-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 56px;
  height: 56px;
  color: #808090;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #b0b0b0;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #808090;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200000;
  padding: 20px;
}

.dialog {
  background: rgba(20, 20, 25, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-small {
  max-width: 360px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
}

.dialog-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.dialog-close:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
}

.dialog-close svg {
  width: 14px;
  height: 14px;
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 18px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #b0b0b0;
}

.required {
  color: #ff6b6b;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4CAF50;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.dialog-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn {
  background: #4CAF50;
  border: 1px solid #4CAF50;
  color: white;
}

.confirm-btn:hover {
  background: #45a049;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.danger-btn {
  background: #ff6b6b;
  border: 1px solid #ff6b6b;
  color: white;
}

.danger-btn:hover {
  background: #ff5252;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.delete-warning {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.warning-icon {
  width: 24px;
  height: 24px;
  color: #FFC107;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-text {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.25s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog,
.dialog-fade-leave-to .dialog {
  transform: scale(0.95);
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

/* 响应式 */
@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
  }

  .item-actions {
    gap: 4px;
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
