<!--
 * @Author: Lin Qi Ping
 * @Date: 2021-12-07 16:25:15
 * @LastEditors: Zhang Yuling
 * @LastEditTime: 2021-12-21 13:50:13
 * @Description: Cesium与DualCanvasViewer双画布查看器组件
-->
<template>
  <div id="container" class="box">
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    <!-- 缩放比例显示面板 -->
    <div class="scale-panel">
      <div class="scale-title">地图比例</div>
      <div class="scale-value">{{ mapScale }}</div>
    </div>
    <!-- Cesium 坐标显示面板 - 底部状态栏（两行显示） -->
    <div class="cesium-coordinate-panel">
      <!-- 第一行：Cesium 坐标 -->
      <div class="cesium-coordinate-row">
        <span class="coord-item">经度: {{ cesiumCoordinates.longitude }}</span>
        <span class="coord-separator">|</span>
        <span class="coord-item">纬度: {{ cesiumCoordinates.latitude }}</span>
        <span class="coord-separator">|</span>
        <span class="coord-item">高度: {{ cesiumCoordinates.height }}</span>
        <span class="coord-separator">|</span>
        <span class="coord-item">墨卡托: {{ cesiumCoordinates.mercatorX }}, {{ cesiumCoordinates.mercatorY }}</span>
      </div>
      <!-- 第二行：Three.js 坐标 -->
      <div class="cesium-coordinate-row">
        <span class="coord-item">Three.js: {{ cesiumCoordinates.threeWorld }}</span>
      </div>
    </div>
    <!-- 屏幕中心点经纬度面板 - 左下角 -->
    <div class="screen-center-panel">
      <div class="panel-title">屏幕中心</div>
      <div class="panel-content">
        <div class="center-coord-item">
          <span class="center-coord-label">经度:</span>
          <span class="center-coord-value">{{ screenCenterCoords.longitude }}</span>
        </div>
        <div class="center-coord-item">
          <span class="center-coord-label">纬度:</span>
          <span class="center-coord-value">{{ screenCenterCoords.latitude }}</span>
        </div>
        <div class="center-coord-item">
          <span class="center-coord-label">高度:</span>
          <span class="center-coord-value">{{ screenCenterCoords.height }}</span>
        </div>
      </div>
    </div>
    <!-- dual-canvas-viewer 覆盖层容器 - 独立 Vue 应用挂载点 -->
    <div
      id="dualCanvasContainer"
      ref="dualCanvasContainer"
      class="dual-canvas-overlay"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @wheel="handleWheel"
      @contextmenu.prevent
    >
      <!-- dual-canvas-viewer-plugin 将被动态挂载到这里 -->
    </div>

    <!-- ⭐ Cesium 工具条 -->
    <CesiumToolbar
      ref="toolbar"
      @button-click="handleToolbarButtonClick"
      @panel-toggle="handleToolPanelToggle"
    />

    <!-- ⭐ 动态渲染自注册的功能面板 -->
    <template v-for="panel in visibleFunctionPanels" :key="panel.key">
      <component
        :is="getFunctionPanelComponent(panel.key)"
        v-bind="panel.props"
        @close="handlePanelClose(panel.key)"
      />
    </template>

    <!-- ⭐ TestSfc 组件容器 -->

    <!-- 地板高度控制面板 -->
    <div class="floor-height-adjuster" v-if="floorHeightPanel.visible">
      <div class="panel-header">
        <h4>地板高度控制</h4>
        <button @click="toggleFloorHeightPanel" class="close-btn">×</button>
      </div>

      <div class="panel-body-scroll">
        <!-- 双画布控制面板开关 -->
        <div class="control-panel-toggle">
          <label class="toggle-checkbox">
            <input
              type="checkbox"
              v-model="showDualControlPanel"
              @change="onDualControlPanelToggle"
            />
            <span class="toggle-label">🎛️ 双画布控制面板</span>
            <span class="toggle-hint" title="显示/隐藏右侧控制面板">💡</span>
          </label>
        </div>

        <!-- ⭐ 高度对齐模式选择 -->
        <div v-if="heightAlignmentManager" class="alignment-mode-section">
          <div class="section-title">🎯 高度对齐模式</div>
          <div class="alignment-mode-list">
            <label class="alignment-mode-item">
              <input
                type="radio"
                name="alignmentMode"
                value="terrain"
                :checked="alignmentMode === 'terrain'"
                @change="setAlignmentMode('terrain')"
              />
              <span class="mode-name">地形对齐（推荐）</span>
              <span class="mode-desc">模型贴合倾斜摄影地面</span>
            </label>
            <label class="alignment-mode-item">
              <input
                type="radio"
                name="alignmentMode"
                value="model"
                :checked="alignmentMode === 'model'"
                @change="setAlignmentMode('model')"
              />
              <span class="mode-name">模型对齐</span>
              <span class="mode-desc">模型保持在原始海拔</span>
            </label>
            <label class="alignment-mode-item">
              <input
                type="radio"
                name="alignmentMode"
                value="smart"
                :checked="alignmentMode === 'smart'"
                @change="setAlignmentMode('smart')"
              />
              <span class="mode-name">智能对齐</span>
              <span class="mode-desc">自动选择最佳对齐方案</span>
            </label>
          </div>
          <div class="alignment-info">
            <span>当前对齐高度: {{ heightAlignmentManager ? heightAlignmentManager.calculateAlignmentHeight().toFixed(2) : 0 }} 米</span>
          </div>
        </div>

        <hr class="section-divider" />
        <!-- 当前高度显示 -->
        <div class="current-height">
          <span class="label">模型海拔调整：</span>
          <span class="value">{{ floorHeightPanel.currentHeight.toFixed(2) }} 米</span>
          <span class="hint" title="相对于模型海拔位置的高度偏移量，0 表示与模型位置对齐">💡</span>
        </div>

        <!-- 高度调整滑块 -->
        <div class="height-control">
          <label>调整偏移：</label>
          <input
            type="range"
            min="-2000"
            max="2000"
            step="1"
            :value="floorHeightPanel.currentHeight"
            @input="onFloorHeightChange"
            class="height-slider"
          />
          <div class="height-usage-info">
            <span>0米 = 与地面叠合（可同步翻转）</span>
          </div>
        </div>

        <!-- 精确输入 -->
        <div class="height-input">
          <label>精确设置偏移（米）：</label>
          <input
            type="number"
            :value="floorHeightPanel.currentHeight"
            @change="onFloorHeightInputChange"
            class="number-input"
            step="0.1"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <button @click="resetFloorHeightToTerrain" class="btn btn-primary">
            重置到地形高度
          </button>
          <button @click="resetFloorHeightToDefault" class="btn btn-secondary">
            重置到默认（{{ floorHeightPanel.defaultHeight }}米）
          </button>
        </div>

        <!-- 相机同步按钮 -->
        <div class="actions">
          <button @click="syncDualCamera" class="btn btn-accent">
            🎥 同步 Cesium 和 Dual 相机
          </button>
        </div>

        <!-- 模型诊断按钮（包含高度和倒置诊断） -->
        <div class="actions">
          <button @click="diagnoseModels" class="btn btn-diagnose">
            🔍 诊断模型
          </button>
          <button @click="fixModel" class="btn btn-fix">
            🔧 修复模型
          </button>
          <button @click="flipScene" class="btn btn-flip">
            🔃 翻转场景
          </button>
          <button @click="testModelRotations" class="btn btn-rotate">
            🔄 测试模型旋转
          </button>
        </div>

        <!-- 圆柱体高度控制 -->
        <div class="cylinder-height-control">
          <div class="control-section">
            <label class="section-label">圆柱体高度控制：</label>
            <div class="cylinder-input-group">
              <input
                type="number"
                :value="cylinderHeight"
                @change="onCylinderHeightChange"
                class="number-input"
                step="1"
                min="1"
                max="10000"
              />
              <span class="unit-label">米</span>
            </div>
          </div>
          <div class="actions">
            <button @click="refreshCylinderMarker" class="btn btn-cylinder">
              🔄 刷新圆柱体
            </button>
          </div>
          <div class="cylinder-info">
            <p>当前圆柱体高度: {{ cylinderHeight }} 米</p>
            <p>调整后点击"刷新圆柱体"应用</p>
          </div>
        </div>

        <!-- 快捷键提示 -->
        <div class="shortcuts-hint">
          <p>快捷键：</p>
          <p>↑ / ↓ : 调整高度（±1米）</p>
          <p>Shift + ↑ / ↓ : 调整高度（±10米）</p>
          <p>H : 切换面板显示</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// import CesiumNavigation from "cesium-navigation-es6/viewerCesiumNavigationMixin"; // 临时注释掉以解决编译错误
import * as THREE from 'three';
// ⭐ 使用 dual-canvas-viewer-plugin.iife.js 新暴露的工具类
// import { CesiumLayerRegister } from '../utils/CesiumLayerAdapter.js';
// import { HeightAlignmentManager } from '../utils/HeightAlignmentManager.js';
// import TiandituTerrainProvider from '../utils/TiandituTerrainProvider.js'; // ⚠️ 文件已删除，暂时注释
import CesiumToolbar from './CesiumToolbar.vue';

// ⭐ Vue 3 工具
import { markRaw } from 'vue';

// ⭐ 导入功能面板配置文件
import functionPanelsConfig from './functions/functionPanels.config.json';

// ⭐ 导入多实例面板配置管理器
import { multiInstancePanelConfigManager } from './utils/MultiInstancePanelConfigManager.js';

// ⭐ 动态加载器配置
const FUNCTION_PANELS_DIR = './functions/';
const COMPONENT_CACHE = new Map(); // 组件缓存
const LOADING_PROMISES = new Map(); // 加载中的 Promise，防止重复加载

/**
 * 动态加载单个功能面板组件
 * @param {string} componentName - 组件名称
 * @returns {Promise<Component>} 组件 Promise
 */
async function loadFunctionPanel(componentName) {
  // 检查配置中是否存在该组件
  const panelConfig = getPanelConfig(componentName);
  if (!panelConfig) {
    console.warn(`[CesiumMain] ⚠️ 面板组件未在配置中: ${componentName}`);
    throw new Error(`Panel component not found in config: ${componentName}`);
  }

  // 检查是否启用
  if (panelConfig.enabled === false) {
    console.warn(`[CesiumMain] ⚠️ 面板组件已禁用: ${componentName}`);
    throw new Error(`Panel component is disabled: ${componentName}`);
  }

  // 检查缓存
  if (COMPONENT_CACHE.has(componentName)) {
    console.log(`[CesiumMain] 📦 从缓存加载面板组件: ${componentName}`);
    return COMPONENT_CACHE.get(componentName);
  }

  // 检查是否正在加载
  if (LOADING_PROMISES.has(componentName)) {
    console.log(`[CesiumMain] ⏳ 等待面板组件加载: ${componentName}`);
    return LOADING_PROMISES.get(componentName);
  }

  // 创建加载 Promise
  const loadPromise = (async () => {
    try {
      console.log(`[CesiumMain] 📦 动态加载面板组件: ${componentName} (${panelConfig.file})`);

      // 动态导入组件（使用配置中的文件名）
      const module = await import(
        /* webpackChunkName: "function-panel-[request]" */
        `${FUNCTION_PANELS_DIR}${panelConfig.file}`
      );

      // 获取组件
      const component = module.default || module;

      // 缓存组件
      COMPONENT_CACHE.set(componentName, component);

      console.log(`[CesiumMain] ✅ 面板组件加载成功: ${componentName} - ${panelConfig.title}`);
      return component;
    } catch (error) {
      console.error(`[CesiumMain] ❌ 面板组件加载失败: ${componentName}`, error);
      throw error;
    } finally {
      // 清除加载中的 Promise
      LOADING_PROMISES.delete(componentName);
    }
  })();

  // 记录加载中的 Promise
  LOADING_PROMISES.set(componentName, loadPromise);

  return loadPromise;
}

/**
 * 获取可用的功能面板列表（从配置文件读取）
 * @returns {Array<{name: string, file: string, title: string, enabled: boolean}>} 组件配置列表
 */
function getAvailablePanelConfigs() {
  try {
    const panels = functionPanelsConfig.panels || [];
    console.log(`[CesiumMain] 📋 从配置文件读取到 ${panels.length} 个面板配置`);
    return panels;
  } catch (error) {
    console.error('[CesiumMain] ❌ 读取面板配置文件失败:', error);
    return [];
  }
}

/**
 * 获取启用的功能面板名称列表
 * @returns {string[]>} 组件名称列表
 */
function getEnabledPanelNames() {
  const configs = getAvailablePanelConfigs();
  return configs
    .filter(panel => panel.enabled !== false)
    .map(panel => panel.name);
}

/**
 * 根据名称获取面板配置
 * @param {string} componentName - 组件名称
 * @returns {Object|null} 面板配置
 */
function getPanelConfig(componentName) {
  const configs = getAvailablePanelConfigs();
  return configs.find(panel => panel.name === componentName) || null;
}

export default {
  name: "CesiumMain",
  provide() {
    // 使用箭头函数来避免绑定 this，防止递归更新
    const self = this;
    return {
      // 提供注册相关方法给子组件
      registerPanelComponent: (key, config) => self.registerPanelComponent(key, config),
      unregisterPanelComponent: (key) => self.unregisterPanelComponent(key),
      // 提供获取已注册面板的方法
      getRegisteredPanels: () => self.registeredPanels,
      // ⭐ 提供获取实例ID的函数
      getInstanceId: () => self.instanceId || 1
    };
  },
  beforeCreate() {
    // ⚡ 性能优化：使用非响应式Map存储Cesium对象，避免Vue响应式包装
    this._cesiumEntities = new Map();  // 存储Cesium Entity对象

    // ⚠️ 重要：SyncManager 现在由 DualCanvasViewer 插件管理
    // 使用 getter 方法动态获取，避免初始化顺序问题
    Object.defineProperty(this, 'syncManager', {
      get() {
        if (typeof window !== 'undefined' && window.__syncManager__) {
          return window.__syncManager__;
        }
        // 不再输出警告，避免初始化期间的大量日志
        return null;
      },
      enumerable: false,
      configurable: false
    });
    console.log('[HelloWorld] SyncManager getter 已设置');

    // ⭐ 添加 mercatorProj getter，按优先级从多个源获取
    Object.defineProperty(this, 'mercatorProj', {
      get() {
        if (typeof window !== 'undefined') {
          // 优先级 1: 全局 mercatorProjectionManager（从 DualCanvasViewer 导入）
          if (window.__mercatorProjectionManager__) {
            return window.__mercatorProjectionManager__;
          }
          // 优先级 2: syncManager 的 mercatorProjection
          if (this.syncManager?.mercatorProjection) {
            return this.syncManager.mercatorProjection;
          }
          // 优先级 3: window.syncManager 的 mercatorProjection
          if (window.__syncManager__?.mercatorProjection) {
            return window.__syncManager__.mercatorProjection;
          }
          // 优先级 4: DualCanvasViewer 实例的 mercatorProjectionManager
          if (window.__dualCanvasViewerInstances?.length > 0) {
            const dualViewer = window.__dualCanvasViewerInstances[0];
            if (dualViewer?.mercatorProjectionManager) {
              return dualViewer.mercatorProjectionManager;
            }
          }
        }
        return null;
      },
      enumerable: false,
      configurable: false
    });
    console.log('[HelloWorld] mercatorProj getter 已设置');
  },
  data() {
    return {
      dualCanvasApp: null,
      dualCanvasObserver: null,
      // ⭐ 多实例支持
      dualCanvasInstances: [],
      dualCanvasInstanceCounter: 0,
      instanceStatuses: {},  // ⭐ 实例状态跟踪
      // ⭐ 加载方式配置：是否使用 IIFE 方式加载（默认 true 以避免 SFC 加载问题）
      useIIFELoading: true,
      // ⭐ 测试 SFC 组件显示状态
      testSfcVisible: false,
      sfcDualCanvasVisible: false,  // ⭐ SfcDualCanvas 显示状态
      testSfcApp: null,
      testSfcAppInstance: null,  // Vue 应用实例（用于 unmount）
      testSfcInstances: [],  // 所有 TestSfc 实例数组
      sfcDualCanvasInstances: [],  // 所有 SfcDualCanvas 实例数组
      // ⭐ TestSfc Modal 组件显示状态
      testSfcModalVisible: false,
      testSfcModalInstances: [],  // 所有 TestSfc Modal 实例数组
      testSfcModalInstanceCounter: 0,  // TestSfc Modal 实例计数器
      sfcDualCanvasInstanceCounter: 0,  // SfcDualCanvas 实例计数器
      testSfcInstanceCounter: 0,  // 实例计数器
      cesiumViewer: null,
      // syncManager 现在通过 beforeCreate 中的 getter 获取
      mapScale: '1:5000',
      cesiumCoordinates: {
        longitude: '0.0000°',
        latitude: '0.0004°',
        height: '0 m',
        mercatorX: '0',
        mercatorY: '0',
        threeWorld: 'N/A'
      },
      // 屏幕中心点的Cesium经纬度
      screenCenterCoords: {
        longitude: '0.0000°',
        latitude: '0.0000°',
        height: '0 m'
      },
      // 鼠标状态
      mouseState: {
        isDown: false,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0,
        mappedButton: null
      },
      // 统一平面投影坐标系状态
      unifiedProjectionInitialized: false,
      currentOperation: null,
      // 滚轮操作状态标志
      isWheeling: false,
      // ⭐ 左键翻转状态管理
      leftFlipState: {
        isActive: false,
        startTime: 0,
        cesiumInitial: {
          cameraMercator: null,
          targetMercator: null
        },
        dualInitial: null
      },
      // 地下状态追踪
      _isUnderground: undefined,
      // 地板高度控制面板
      floorHeightPanel: {
        visible: true,
        currentHeight: 0,
        defaultHeight: 0  // ⭐ 新增：动态默认高度，从模型海拔获取
        // mercatorProj 已移除 - 通过 getter 访问，避免 Vue 3 响应式代理问题
      },
      // ⚡ 性能优化：Cesium Entity存储在非响应式Map中，不再定义groundMarkerCylinder
      // 圆柱体高度控制
      cylinderHeight: 569,  // 默认圆柱体高度（米）
      groundMarkerInfo: null,  // 存储地面标记的经纬度信息，用于刷新
      // ⭐ 新增：统一高度对齐管理器
      heightAlignmentManager: null,
      // 高度对齐模式选择
      alignmentMode: 'terrain',  // 'terrain' | 'model' | 'smart'
      // ⭐ 新增：双画布控制面板显示控制
      showDualControlPanel: false,
      // ⭐ 当前实例ID（多实例支持）
      instanceId: null,
      // ⭐ 自注册面板组件注册表
      registeredPanels: {}, // key -> { component, props, visible }
      // ⭐ 动态加载的功能面板组件缓存
      functionPanelComponents: {}, // 运行时动态加载的组件缓存
      // ⭐ 正在加载中的组件
      loadingComponents: {} // componentName -> Promise
    };
  },
  computed: {
    /**
     * 获取所有可见的功能面板（包括预注册的）
     */
    visibleFunctionPanels() {
      const panels = [];

      // 1. 获取已注册且可见的面板
      for (const [key, config] of Object.entries(this.registeredPanels)) {
        if (config.visible) {
          panels.push({
            key,
            component: config.component,
            props: config.props
          });
        }
      }

      // 2. 获取已加载但从未注册过的面板（只在首次显示）
      for (const [name, component] of Object.entries(this.functionPanelComponents)) {
        const isRegistered = !!this.registeredPanels[name];
        // 只有从未注册过的才显示（一旦注册过，就由 registeredPanels 控制可见性）
        if (!isRegistered) {
          panels.push({
            key: name,
            component,
            props: {}
          });
        }
      }

      return panels;
    },
    Cesium() {
      return this.cesium;
    }
  },
  provide: {
    // 向子组件提供注册方法（注意：在 Vue 2 中，provide 不能访问 this，所以这些方法将在 data 中定义）
    registerPanelComponent: null,
    unregisterPanelComponent: null,
    getInstanceId: null
  },
  components: {
    CesiumToolbar,
    // 动态组件不再需要在这里声明，由 loadFunctionPanels() 自动加载
  },
  methods: {
    // ==================== 多实例配置管理 ====================

    /**
     * 初始化多实例配置管理器
     */
    initMultiInstanceConfig() {
      try {
        // 先设置默认值，避免递归更新
        this.instanceId = 1;

        // 初始化全局配置（仅首次）
        // 使用 hasOwnProperty 检查来避免访问可能触发响应式的属性
        if (Object.prototype.hasOwnProperty.call(multiInstancePanelConfigManager, 'globalConfig') &&
            !multiInstancePanelConfigManager.globalConfig) {
          multiInstancePanelConfigManager.initGlobalConfig(functionPanelsConfig);
        }

        // 创建当前实例的配置
        this.instanceId = multiInstancePanelConfigManager.createInstance();

        // 暴露到全局（用于调试）
        if (typeof window !== 'undefined') {
          window.__cesiumMainInstanceId__ = this.instanceId;
        }

        console.log(`[CesiumMain] ✅ 多实例配置已初始化，实例 ID: ${this.instanceId}`);
      } catch (error) {
        console.error('[CesiumMain] ❌ 初始化多实例配置失败:', error);
        // 回退到默认实例ID
        this.instanceId = 1;
      }
    },

    // ==================== 功能面板自动加载 ====================

    /**
     * 动态加载指定的功能面板组件
     * @param {string} componentName - 组件名称
     * @returns {Promise<Component>} 组件 Promise
     */
    async loadFunctionPanel(componentName) {
      try {
        const component = await loadFunctionPanel(componentName);
        // 缓存到组件实例（使用 markRaw 避免响应式包装）
        this.functionPanelComponents[componentName] = markRaw(component);
        return component;
      } catch (error) {
        console.error(`[CesiumMain] ❌ 加载面板组件失败: ${componentName}`, error);
        throw error;
      }
    },

    /**
     * 批量加载启用的功能面板组件
     * @returns {Promise<Object>} 组件映射表
     */
    async loadEnabledPanels() {
      const enabledNames = getEnabledPanelNames();
      console.log(`[CesiumMain] 📦 开始批量加载 ${enabledNames.length} 个启用的面板组件`);

      const components = {};
      for (const name of enabledNames) {
        try {
          const component = await this.loadFunctionPanel(name);
          components[name] = component;
        } catch (error) {
          console.error(`[CesiumMain] ❌ 加载面板组件失败: ${name}`, error);
        }
      }

      console.log(`[CesiumMain] ✅ 批量加载完成，成功加载 ${Object.keys(components).length} 个面板组件`);
      return components;
    },

    /**
     * 获取面板组件（用于模板中的动态组件）
     * @param {string} componentName - 组件名称
     * @returns {Component|null}
     */
    /**
     * 获取面板组件（用于模板中的动态组件）
     * @param {string} componentName - 组件名称
     * @returns {Component|null}
     */
    getFunctionPanelComponent(componentName) {
      // 优先从已加载的组件中查找
      if (this.functionPanelComponents[componentName]) {
        return this.functionPanelComponents[componentName];
      }

      // 尝试从已注册的面板中查找
      const registered = this.registeredPanels[componentName];
      if (registered?.component) {
        return registered.component;
      }

      // 如果找不到，尝试异步加载（但不阻塞渲染）
      this.loadFunctionPanel(componentName).catch(() => {
        // 加载失败，忽略错误
      });

      console.warn(`[CesiumMain] ⚠️ 面板组件正在加载中: ${componentName}`);
      return null;
    },

    /**
     * 获取可用的面板配置列表
     * @returns {Array} 面板配置列表
     */
    getAvailablePanelConfigs() {
      return getAvailablePanelConfigs();
    },

    /**
     * 获取启用的面板名称列表
     * @returns {Array<string>} 面板名称列表
     */
    getEnabledPanelNames() {
      return getEnabledPanelNames();
    },

    // ==================== 面板自注册方法 ====================

    /**
     * 注册面板组件（由子组件调用）
     * @param {string} key - 面板唯一标识
     * @param {Object} config - 组件配置 { component, props, visible }
     */
    registerPanelComponent(key, config) {
      // 缓存 instanceId 避免重复访问
      const instanceId = this.instanceId || 1;
      console.log(`[CesiumMain #${instanceId}] 注册面板组件: ${key}`, config);

      // ⭐ ObliquePhotographyPanel 单实例模式检查
      if (key === 'ObliquePhotographyPanel' && this.registeredPanels[key]) {
        console.log(`[CesiumMain #${instanceId}] ⭐ ObliquePhotographyPanel 已存在，使用单实例模式（仅显示面板）`);

        // ⚡ 清理旧的组件实例引用（已被销毁）
        // 这样可以避免内存泄漏，并且确保使用新的组件实例
        const oldComponent = this.registeredPanels[key].component;
        if (oldComponent && oldComponent !== config.component) {
          console.log(`[CesiumMain #${instanceId}] 🔄 清理旧的 ObliquePhotographyPanel 实例引用`);
        }

        // 更新为新的组件实例
        this.registeredPanels[key].component = markRaw(config.component);

        // 设置可见性
        this.registeredPanels[key].visible = true;

        // 更新位置配置（如果需要）
        const instancePanelConfig = multiInstancePanelConfigManager.getPanelConfig(instanceId, key);
        if (instancePanelConfig?.position) {
          this.registeredPanels[key].props = {
            ...this.registeredPanels[key].props,
            ...instancePanelConfig.position
          };
        }

        console.log(`[CesiumMain #${instanceId}] ✅ ObliquePhotographyPanel 已显示（保留已加载的倾斜摄影数据）`);
        return;
      }

      // ⭐ 从多实例配置管理器获取实例特定的配置
      const instancePanelConfig = multiInstancePanelConfigManager.getPanelConfig(instanceId, key);

      // 合并配置：实例配置优先，然后是传入的配置
      const mergedProps = {
        ...(instancePanelConfig?.position || {}),
        ...(config.props || {})
      };

      const mergedVisible = instancePanelConfig ? instancePanelConfig.visible : (config.visible !== false);

      this.registeredPanels[key] = {
        component: markRaw(config.component), // 使用 markRaw 避免响应式包装
        props: mergedProps,
        visible: mergedVisible
      };

      console.log(`[CesiumMain #${instanceId}] ✅ 面板 ${key} 已注册（使用实例配置）:`, {
        visible: mergedVisible,
        position: mergedProps
      });
    },

    /**
     * 注销面板组件（由子组件调用）
     * @param {string} key - 面板唯一标识
     */
    unregisterPanelComponent(key) {
      console.log(`[CesiumMain] 注销面板组件: ${key}`);

      if (this.registeredPanels[key]) {
        delete this.registeredPanels[key];
      }
    },

    /**
     * 设置面板显示状态
     * @param {string} key - 面板唯一标识
     * @param {boolean} visible - 是否可见
     */
    setPanelVisible(key, visible) {
      if (this.registeredPanels[key]) {
        this.registeredPanels[key].visible = visible;
      }
    },

    /**
     * 切换面板显示状态
     * @param {string} key - 面板唯一标识
     */
    togglePanel(key) {
      if (this.registeredPanels[key]) {
        this.registeredPanels[key].visible = !this.registeredPanels[key].visible;
      }
    },

    /**
     * 处理面板关闭事件（动态面板）
     * @param {string} panelKey - 面板唯一标识
     */
    handlePanelClose(panelKey) {
      console.log(`[CesiumMain] 面板关闭: ${panelKey}`);

      // ⭐ ObliquePhotographyPanel 特殊处理：假关闭模式
      if (panelKey === 'ObliquePhotographyPanel') {
        console.log(`[CesiumMain] ObliquePhotographyPanel 假关闭，保留实例状态`);
        // 只设置 visible 为 false，不销毁组件
        if (this.registeredPanels[panelKey]) {
          this.registeredPanels[panelKey].visible = false;
        }
        return;
      }

      // 其他面板：正常关闭
      // 隐藏面板
      if (this.registeredPanels[panelKey]) {
        this.registeredPanels[panelKey].visible = false;
      }
    },

    // ==================== 工具条按钮处理方法 ====================

    /**
     * 处理工具条按钮点击事件
     * @param {Object} button - 按钮配置对象
     */
    handleToolbarButtonClick(button) {
      console.log('[HelloWorld] 工具条按钮被点击:', button.id);

      switch (button.id) {
        case 'multi-instance':
          this.createDualCanvasInstance();
          break;
        case 'testsfc-modal':
          this.toggleTestSfcModal();
          break;
        case 'sfc-test':
          this.toggleTestSfc();
          break;
        case 'loading-mode':
          this.toggleLoadingMode();
          break;
        default:
          console.warn('[HelloWorld] 未知的工具条按钮:', button.id);
      }
    },

    /**
     * 处理工具栏面板切换事件（由 CesiumToolbar 发出）
     * @param {Object} event - 面板切换事件
     * @param {string} event.panelId - 面板ID
     * @param {boolean} event.visible - 目标可见性
     * @param {boolean} event.singleton - 是否单例模式
     * @param {string} event.action - 操作类型（'toggle' | 'load'）
     */
    handleToolPanelToggle(event) {
      const { panelId, visible, singleton, action } = event;
      console.log(`[CesiumMain] 🔧 工具栏面板切换: ${panelId}, 可见性: ${visible}, 单例: ${singleton}`);

      // 检查面板是否已注册
      if (this.registeredPanels[panelId]) {
        // 已注册：更新可见性
        this.registeredPanels[panelId].visible = visible;
        console.log(`[CesiumMain] 🔄 ${panelId} 可见性: ${visible ? '显示' : '隐藏'}`);
      } else {
        // 未注册：动态加载组件
        console.log(`[CesiumMain] 📦 首次加载面板组件: ${panelId}`);
        this.loadFunctionPanel(panelId)
          .then(() => {
            console.log(`[CesiumMain] ✅ ${panelId} 组件加载完成`);
          })
          .catch((error) => {
            console.error(`[CesiumMain] ❌ ${panelId} 组件加载失败:`, error);
          });
      }
    },

    // ==================== 双画布控制面板方法 ====================

    /**
     * 切换双画布控制面板显示状态
     */
    onDualControlPanelToggle() {
      console.log('[HelloWorld] 双画布控制面板:', this.showDualControlPanel ? '显示' : '隐藏');

      // 调用 DualCanvasViewer 的方法
      window.__dualCanvasViewer__?.toggleControlPanel(this.showDualControlPanel);
    },

    // ==================== 倾斜摄影加载方法 ====================

    /**
     * 采样倾斜摄影区域的地形高度
     * @param {Object} tileset - Cesium3DTileset对象
     */
    async sampleObliqueTerrainHeight(tileset) {
      if (!tileset.boundingSphere) {
        console.warn('[HelloWorld] ⚠️ 无法采样地形高度：缺少边界球信息');
        return;
      }

      try {
        // 获取倾斜摄影中心位置
        const sphere = tileset.boundingSphere;
        const center = sphere.center;

        // 转换为经纬度坐标
        const cartographic = this.Cesium.Cartographic.fromCartesian(center);
        const longitude = this.Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = this.Cesium.Math.toDegrees(cartographic.latitude);

        console.log('[HelloWorld] 📍 采样倾斜摄影地形高度:', {
          经度: longitude.toFixed(6),
          纬度: latitude.toFixed(6)
        });

        // 使用sampleHeightMostDetailed采样地形高度
        const heights = await this.cesiumViewer.scene.sampleHeightMostDetailed([center]);
        const terrainHeight = heights[0] || 0;

        console.log('[HelloWorld] 🌍 采样结果: 地形高度 =', terrainHeight.toFixed(2) + '米');

        // 更新HeightAlignmentManager
        if (this.heightAlignmentManager) {
          this.heightAlignmentManager.setTerrainHeight(terrainHeight);
        }

        return terrainHeight;
      } catch (error) {
        console.error('[HelloWorld] ❌ 采样地形高度失败:', error);
        return 0;
      }
    },

    /**
     * 更新Dual模型的对齐高度
     */
    updateDualModelAlignment() {
      if (!this.heightAlignmentManager) {
        console.warn('[HelloWorld] ⚠️ HeightAlignmentManager 未初始化');
        return;
      }

      console.log('[HelloWorld] 🔄 更新Dual模型对齐高度...');

      // 获取当前对齐高度
      const alignmentHeight = this.heightAlignmentManager.calculateAlignmentHeight();
      console.log('[HelloWorld] 📊 统一对齐高度:', alignmentHeight.toFixed(2) + '米');

      // 触发Dual模型位置更新
      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (dualViewer) {
        // ⭐ 首先更新HeightAlignmentManager的状态（传递所有参数）
        if (dualViewer.updateHeightAlignmentManager) {
          dualViewer.updateHeightAlignmentManager({
            terrainHeight: this.heightAlignmentManager.terrainHeight,
            obliqueOffset: this.heightAlignmentManager.obliqueOffset,
            modelAltitude: this.heightAlignmentManager.modelAltitude,
            dualFloorHeight: this.heightAlignmentManager.dualFloorHeight
          });
          console.log('[HelloWorld] ✅ HeightAlignmentManager参数已更新');
        }

        // 设置对齐模式
        if (dualViewer.setAlignmentMode) {
          dualViewer.setAlignmentMode(this.alignmentMode);
        }

        // 更新anchorContainer位置
        if (dualViewer.updateAnchorContainerPosition) {
          dualViewer.updateAnchorContainerPosition();
        }

        console.log('[HelloWorld] ✅ Dual模型位置已更新');
      } else {
        console.warn('[HelloWorld] ⚠️ DualCanvasViewer 未就绪');
      }
    },

    /**
     * 设置高度对齐模式
     * @param {string} mode - 对齐模式 ('terrain' | 'model' | 'smart')
     */
    setAlignmentMode(mode) {
      if (!this.heightAlignmentManager) {
        console.warn('[HelloWorld] ⚠️ HeightAlignmentManager 未初始化');
        return;
      }

      this.alignmentMode = mode;
      this.heightAlignmentManager.setAlignmentMode(mode);
      console.log('[HelloWorld] 🎯 对齐模式已设置为:', mode);

      // 触发Dual模型位置更新
      this.updateDualModelAlignment();
    },

    /**
     * 手动定位到倾斜摄影位置
     * @param {Object} item - 倾斜摄影项目配置
     */
    locateToObliquePhotography(item) {
      console.log(`[HelloWorld] 🎯 手动定位到倾斜摄影: ${item.name}`);

      if (!item.tileset || !item.loaded) {
        console.warn(`[HelloWorld] ⚠️ 倾斜摄影未加载，无法定位: ${item.name}`);
        return;
      }

      try {
        if (item.tileset.boundingSphere) {
          const sphere = item.tileset.boundingSphere;
          console.log('[HelloWorld] 📊 倾斜摄影边界球:', {
            中心X: sphere.center.x.toFixed(2),
            中心Y: sphere.center.y.toFixed(2),
            中心Z: sphere.center.z.toFixed(2),
            半径: sphere.radius.toFixed(2) + '米'
          });

          // 设置当前选中的倾斜摄影
          this.obliquePhotography.currentId = item.id;

          // 将相机飞行到倾斜摄影位置
          this.cesiumViewer.camera.flyToBoundingSphere(sphere, {
            duration: 2,
            offset: new this.Cesium.HeadingPitchRange(
              0,
              -45,  // 俯仰角
              sphere.radius * 2.0  // 距离
            )
          });

          console.log('[HelloWorld] ✅ 相机已定位到倾斜摄影位置:', item.name);
        } else {
          console.warn(`[HelloWorld] ⚠️ 倾斜摄影边界球信息不可用: ${item.name}`);
        }
      } catch (error) {
        console.error(`[HelloWorld] ❌ 定位到倾斜摄影失败: ${item.name}`, error);
      }
    },

    // ==================== 初始化方法 ====================

    /**
     * 获取 Draco 解码器路径
     * 支持多种部署场景：开发环境、生产环境、CDN
     */
    getDracoDecoderPath() {
      // 使用 CDN 路径（推荐）- 包含完整的 JS 和 WASM 文件
      const cdnPath = './cdn/jsm/libs/draco/draco_decoder.js';

      // 检测当前环境并返回合适的路径
      if (typeof window !== 'undefined') {
        // 所有环境都使用 CDN Draco 解码器（因为包含完整的 WASM 支持）
        console.log('[HelloWorld] 🌐 使用 CDN Draco 解码器 (完整 WASM 支持)');
        return cdnPath;
      }

      // 默认返回 CDN 路径
      return cdnPath;
    },

    init() {
      const Cesium = this.Cesium;

      // 根据环境选择影像服务 URL
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const imageryUrl = isDev
        ? "http://webst01.is.autonavi.com/appmaptile?lang=zh_cn&style=7&x={x}&y={y}&z={z}"  // 开发环境
        : "https://webst01.is.autonavi.com/appmaptile?lang=zh_cn&style=7&x={x}&y={y}&z={z}"; // 生产环境 HTTPS

      const imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: imageryUrl,
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        fileExtension: 'png',
        minimumLevel: 0,
        maximumLevel: 20
      });

      const config = {
        imageryProvider: imageryProvider,
        infoBox: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
      };

      this.cesiumViewer = new Cesium.Viewer("cesiumContainer", config);

      // ✅ 配置 Draco 解码器 - 支持 Draco 压缩的 GLB/GLTF 模型
      try {
        // 获取当前 CDN 路径（从 public/cdn 或 Workers 目录）
        const dracoDecoderPath = this.getDracoDecoderPath();

        // 配置 Cesium 使用 Draco 解码器
        this.cesiumViewer.scene.dracoDecoder = {
          // Draco 解码器路径
          url: dracoDecoderPath,
          // Draco WASM 解码器路径
          wasmUrl: dracoDecoderPath.replace('.js', '.wasm'),
          // Draco Web Worker 解码器路径
          workerUrl: dracoDecoderPath.replace('draco_decoder.js', 'draco_wasm_wrapper.js')
        };

        console.log('[HelloWorld] ✅ Draco 解码器已配置:', dracoDecoderPath);
      } catch (error) {
        console.warn('[HelloWorld] ⚠️ Draco 解码器配置失败，将无法加载 Draco 压缩的模型:', error);
      }

      // 将 Cesium 对象设置到全局
      if (typeof window !== 'undefined') {
        window.Cesium = Cesium;
        window.viewer = this.cesiumViewer; // 暴露到全局以便调试

        // ⭐ 触发 Cesium 就绪事件
        const cesiumReadyEvent = new CustomEvent('cesium-ready', {
          detail: { cesium: Cesium }
        });
        window.dispatchEvent(cesiumReadyEvent);
        console.log('[HelloWorld] 📡 触发 cesium-ready 事件');

        // ⭐ 天地图扩展插件说明
        // 天地图扩展插件需要 Cesium 1.108，项目使用 1.81，版本不兼容
        // 使用自定义 TiandituTerrainProvider 实现天地图地形加载
        console.log('[HelloWorld] 📌 Cesium 版本: 1.81（天地图扩展插件需要 1.108）');
        console.log('[HelloWorld] 💡 使用自定义 TiandituTerrainProvider 替代官方扩展');
      }

      // ⭐ 关键新增：将 Cesium 注册到虚拟视口（使用 dual-canvas-viewer-plugin.iife.js 暴露的工具类）
      // 这使 Cesium 可以与 DualCanvasViewer 的层1、层2共享统一的坐标系
      // 适配器模式：不影响 DualCanvasViewer 的内部构造
      try {
        const CesiumLayerRegister = typeof window !== 'undefined' ? window.CesiumLayerRegister : null;
        if (CesiumLayerRegister) {
          this._cesiumLayerRegistration = CesiumLayerRegister.registerToViewport(
            this.cesiumViewer,
            this.$refs.cesiumContainer,
            {
              layerId: 'cesium',
              autoSync: true
            }
          );

          if (this._cesiumLayerRegistration) {
            console.log('[HelloWorld] ✅ Cesium 已成功注册到虚拟视口（使用 window.CesiumLayerRegister），可与其他层共享坐标系统');
          }
        } else {
          console.warn('[HelloWorld] ⚠️ window.CesiumLayerRegister 不可用，等待 dual-canvas-viewer-plugin 加载...');
        }
      } catch (error) {
        console.warn('[HelloWorld] ⚠️ Cesium 注册到虚拟视口失败（不影响基本功能）:', error);
      }

      // 隐藏版权
      this.cesiumViewer._cesiumWidget._creditContainer.style.display = "none";

      // 🔧 关键修复：启用自由相机模式，允许完全翻转
      // 确保 screenSpaceCameraController 允许所有类型的旋转
      const sscController = this.cesiumViewer.scene.screenSpaceCameraController;
      if (sscController) {
        sscController.enableTilt = true;
        sscController.enableLook = true;
        sscController.enableRotate = true;
        sscController.enableTranslate = true;
        sscController.minimumZoomDistance = 0;  // 允许无限接近
        sscController.maximumZoomDistance = Infinity;  // 允许无限远离
        console.log('[HelloWorld] ✅ Cesium 相机控制器已配置为自由模式');
      }

      // 🔧 关键修复：修改 Cesium 的 WebGL 设置，使其透明并与 Three.js 兼容
      try {
        const cesiumCanvas = this.cesiumViewer.canvas;
        const cesiumGL = cesiumCanvas.getContext('webgl2') || cesiumCanvas.getContext('webgl');

        if (cesiumGL) {
          // 启用深度测试
          cesiumGL.enable(cesiumGL.DEPTH_TEST);
          cesiumGL.depthMask(true);

          // 设置透明清除色（关键！）
          cesiumGL.clearColor(0, 0, 0, 0); // alpha = 0，透明

          // 注意：Cesium 使用 GREATER (515) depthFunc，这是正常的
          // 不要修改它，否则会影响 Cesium 的渲染

          console.log('[HelloWorld] ✅ Cesium WebGL 设置已修复:', {
            depthFunc: cesiumGL.getParameter(cesiumGL.DEPTH_FUNC),
            depthTest: cesiumGL.getParameter(cesiumGL.DEPTH_TEST),
            depthMask: cesiumGL.getParameter(cesiumGL.DEPTH_WRITEMASK),
            clearColor: cesiumGL.getParameter(cesiumGL.COLOR_CLEAR_VALUE)
          });
        }

        // 设置 Cesium canvas 的 pointerEvents，确保不阻止交互
        cesiumCanvas.style.pointerEvents = 'auto'; // Cesium 需要接收鼠标事件

      } catch (error) {
        console.warn('[HelloWorld] ⚠️ 修复 Cesium WebGL 设置时出错:', error);
      }

      // 设置初始相机位置为垂直俯瞰
      this.cesiumViewer.camera.flyTo({
        destination: this.cesium.Cartesian3.fromDegrees(114.927919, 27.12451, 500.0),
        orientation: {
          heading: 0,           // 航向角（绕 Z 轴）
          pitch: -Cesium.Math.PI_OVER_TWO,  // 俯仰角：-90度，完全垂直向下
          roll: 0             // 翻滚角（绕 X 轴）
        },
        duration: 0  // 立即完成，不使用动画
      });

      // 获取相机控制器引用 - 用于旋转同步控制
      this.screenSpaceCameraController = this.cesiumViewer.scene.screenSpaceCameraController;
      console.log('[HelloWorld] 获取 ScreenSpaceCameraController:', !!this.screenSpaceCameraController);

      // 监听 DualCanvasViewer 挂载完成事件
      // ⭐ 关键修复：检查 DualCanvasViewer 是否已经挂载完成
      const checkDualCanvasReady = () => {
        if (typeof window !== 'undefined' && window.__dualCanvasViewerReady__) {
          console.log('[HelloWorld] 检测到 DualCanvasViewer 已就绪，直接初始化同步管理器');
          setTimeout(() => {
            this.initSyncManager();
            // ⭐ 添加 null 检查，避免 syncManager 未就绪时调用
            if (this.syncManager && typeof this.syncManager.syncCesiumToThree === 'function') {
              this.syncManager.syncCesiumToThree(this.cesiumViewer.camera, this.cesiumViewer.scene);
            } else {
              console.warn('[HelloWorld] ⚠️ syncManager 未就绪，跳过 syncCesiumToThree 调用');
            }
          }, 500);
        } else {
          console.log('[HelloWorld] 等待 DualCanvasViewer 挂载完成...');
          document.addEventListener('DualCanvasViewerMounted', () => {
            console.log('[HelloWorld] 收到 DualCanvasViewerMounted 事件，初始化同步管理器');
            setTimeout(() => {
              this.initSyncManager();
              // ⭐ 添加 null 检查，避免 syncManager 未就绪时调用
              if (this.syncManager && typeof this.syncManager.syncCesiumToThree === 'function') {
                this.syncManager.syncCesiumToThree(this.cesiumViewer.camera, this.cesiumViewer.scene);
              } else {
                console.warn('[HelloWorld] ⚠️ syncManager 未就绪，跳过 syncCesiumToThree 调用');
              }
            }, 500);
          }, { once: true });
        }
      };

      // ⭐ 标志位：确保只处理一次模型加载事件
      this._modelLoadProcessed = false;

      // ⭐ 监听模型加载完成事件
      document.addEventListener('DualCanvasModelsLoaded', (event) => {
        console.log('[HelloWorld] 收到 DualCanvasModelsLoaded 事件:', event.detail);

        if (this.syncManager && this.syncManager.mercatorProjection) {
          const mercatorProj = this.syncManager.mercatorProjection;
          const useLocalCoordSystem = mercatorProj.isUsingLocalCoordinateSystem &&
                                      mercatorProj.isUsingLocalCoordinateSystem();

          if (useLocalCoordSystem) {
            console.log('[HelloWorld] ✅ 检测到局部坐标系模式，floorCenterMercator 应为 (0, 0, 0)');

            // ⭐ 注意：倾斜摄影加载功能已迁移到 ObliquePhotographyPanel 组件
            // 不再在此处加载倾斜摄影数据

            // ⭐ 等待倾斜摄影加载完成并采样实际地形高度
            setTimeout(async () => {
              try {
                const dualViewer = window.__dualCanvasViewerInstances?.[0];
                if (!dualViewer) {
                  console.warn('[HelloWorld] ⚠️ DualCanvasViewer 不可用，跳过地形高度采样');
                  return;
                }

                // 获取大坐标模型的地理位置
                const largeModel = dualViewer.modelGroup1?.children.find(m =>
                  m.userData?.originalLocation?.cartographic
                );

                if (!largeModel) {
                  console.warn('[HelloWorld] ⚠️ 找不到大坐标模型，跳过地形高度采样');
                  return;
                }

                const cartographic = largeModel.userData.originalLocation.cartographic;
                const modelAltitude = cartographic.height;

                console.log('[HelloWorld] 🔄 多次尝试采样地形高度...');

                let actualTerrainHeight = 0;
                let sampleSuccess = false;

                // 方法1：直接采样模型位置的地形高度
                const position = this.Cesium.Cartographic.fromRadians(
                  cartographic.longitude,
                  cartographic.latitude,
                  0
                );

                const heights = await this.cesiumViewer.scene.sampleHeightMostDetailed([position]);
                if (heights && heights[0] !== undefined && !isNaN(heights[0])) {
                  const sampledHeight = heights[0];
                  if (sampledHeight >= -500 && sampledHeight <= 9000) {
                    actualTerrainHeight = sampledHeight;
                    sampleSuccess = true;
                    console.log('[HelloWorld] ✅ 方法1成功：直接采样地形高度 =', actualTerrainHeight.toFixed(2) + '米');
                  }
                }

                // 方法2：如果直接采样失败，尝试采样多个点
                if (!sampleSuccess) {
                  console.log('[HelloWorld] 🔄 方法1失败，尝试多区域采样...');
                  const samplePoints = [
                    [cartographic.longitude, cartographic.latitude],
                    [cartographic.longitude + 0.0001, cartographic.latitude],
                    [cartographic.longitude, cartographic.latitude + 0.0001],
                    [cartographic.longitude - 0.0001, cartographic.latitude],
                    [cartographic.longitude, cartographic.latitude - 0.0001]
                  ];

                  for (let i = 0; i < samplePoints.length; i++) {
                    const pos = this.Cesium.Cartographic.fromRadians(
                      samplePoints[i][0],
                      samplePoints[i][1],
                      0
                    );

                    const h = await this.cesiumViewer.scene.sampleHeightMostDetailed([pos]);
                    if (h && h[0] !== undefined && !isNaN(h[0]) && h[0] > 0 && h[0] < 9000) {
                      actualTerrainHeight = h[0];
                      sampleSuccess = true;
                      console.log('[HelloWorld] ✅ 方法2成功：多区域采样成功 =', actualTerrainHeight.toFixed(2) + '米');
                      break;
                    }
                  }
                }

                if (sampleSuccess && actualTerrainHeight !== 0) {
                  console.log('[HelloWorld] 🎯 获取到实际地形高度:', actualTerrainHeight.toFixed(2) + '米', {
                    模型海拔: modelAltitude.toFixed(2) + '米',
                    高度差: (modelAltitude - actualTerrainHeight).toFixed(2) + '米'
                  });

                  // 获取 mercatorProjectionManager 实例
                  const mercatorProj = window.__mercatorProjectionManager__ || dualViewer.mercatorProj;
                  if (mercatorProj && mercatorProj.setDualFloorHeightToTerrain) {
                    // 更新dual地板高度到实际地形高度
                    mercatorProj.setDualFloorHeightToTerrain(actualTerrainHeight);

                    // 更新地板控制面板
                    if (this.floorHeight !== actualTerrainHeight) {
                      this.floorHeight = actualTerrainHeight;
                    }

                    // 触发dual地板更新
                    dualViewer.updateAnchorContainerPosition?.();
                    dualViewer.$forceUpdate?.();

                    console.log('[HelloWorld] ✅ 模型已对齐到实际地形');
                  }
                } else {
                  console.log('[HelloWorld] ℹ️ 所有采样方法失败，保持椭球体表面（height=0）');
                }
              } catch (error) {
                console.error('[HelloWorld] ❌ 地形采样失败:', error.message);
              }
            }, 2000); // 延迟2秒等待倾斜摄影完全加载

            // ⭐ 关键修复：局部坐标系模式下，使用dual同步更新Cesium相机，而不是独立定位
            // 原因：独立定位到大坐标模型位置会导致高德地图返回空白图片
            // 解决方案：让Cesium相机跟随Three.js相机，保持同步
            console.log('[HelloWorld] 局部坐标系模式：使用dual同步方式更新Cesium相机（避免高德地图空白）');

            // ⭐ 不再独立定位Cesium相机，而是依赖SyncManager在focusOnModels后自动同步
            // 这样Cesium相机会跟随Three.js相机的 unifiedCameraState，避免大坐标定位问题

            // ⭐ 获取模型位置信息（用于地面标记和地板高度）
            const modelLocation = event.detail.modelLocation;
            if (modelLocation && modelLocation.longitude && modelLocation.latitude) {
              // ⭐ 新增：局部坐标系模式下，在地面添加黄色标记点
              // 使用模型的海拔高度创建圆柱体，使圆柱体底部与模型底部对齐

              // ⭐ 关键修复：局部坐标系模式下，modelLocation.height 为 0
              // 需要从模型的 userData.originalLocation.cartographic.height 获取实际海拔
              let modelAltitude = modelLocation.height || 0;

              // 尝试从 DualCanvasViewer 获取模型的实际海拔
              const dualViewer = window.__dualCanvasViewerInstances?.[0];
              if (dualViewer && dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
                const firstModel = dualViewer.modelGroup1.children[0];
                const actualAltitude = firstModel.userData?.originalLocation?.cartographic?.height;
                if (actualAltitude !== undefined && actualAltitude !== 0) {
                  modelAltitude = actualAltitude;
                  console.log('[HelloWorld] ✅ 从模型 userData 获取实际海拔:', {
                    modelLocation_height: modelLocation.height.toFixed(2) + '米',
                    actualAltitude: actualAltitude.toFixed(2) + '米'
                  });
                }
              }

              // ⭐ 关键修复：更新地板高度控制面板
              // 区分两个概念：
              // 1. defaultHeight: 模型海拔（作为参考值，显示"重置到默认"按钮中的值）
              // 2. currentHeight: 地板偏移高度（用户当前设置的偏移量，从 dualFloorHeight 获取）
              console.log('[HelloWorld] 🔄 检查模型海拔，准备更新默认值:', {
                模型海拔: modelAltitude.toFixed(2) + '米',
                当前默认高度: this.floorHeightPanel.defaultHeight.toFixed(2) + '米',
                当前偏移: this.floorHeightPanel.currentHeight.toFixed(2) + '米'
              });

              if (modelAltitude !== 0) {
                // 只更新默认高度（模型海拔参考值）
                this.floorHeightPanel.defaultHeight = modelAltitude;

                // ⭐ 关键修复：currentHeight 应该从 dualFloorHeight 获取，而不是模型海拔
                // dualFloorHeight 才是用户可调整的地板偏移高度
                const actualFloorHeight = this.mercatorProj?.getCurrentFloorHeight?.() ?? 0;
                this.floorHeightPanel.currentHeight = actualFloorHeight;

                // ⭐ 关键修复：设置 HeightAlignmentManager 的模型海拔
                // 这样在模型对齐模式下才能使用正确的海拔值
                if (this.heightAlignmentManager) {
                  this.heightAlignmentManager.setModelAltitude(modelAltitude);
                  console.log('[HelloWorld] ✅ 已设置 HeightAlignmentManager 模型海拔:', modelAltitude.toFixed(2) + '米');
                }

                console.log('[HelloWorld] ✅ 已更新地板高度控制面板:', {
                  '模型海拔(默认值)': modelAltitude.toFixed(2) + '米',
                  '地板偏移(当前值)': actualFloorHeight.toFixed(2) + '米',
                  说明: '默认值用于"重置到默认"，当前值是用户可调整的偏移'
                });
              } else {
                console.warn('[HelloWorld] ⚠️ 模型海拔为0，不更新默认值');
              }

              console.log('[HelloWorld] 🎯 准备创建圆柱体，参数:', {
                模型海拔: modelAltitude.toFixed(2) + '米',
                经度: modelLocation.longitude.toFixed(6) + '°',
                纬度: modelLocation.latitude.toFixed(6) + '°'
              });

              // ⭐ 关键修复：延迟创建地面标记，直到相机定位完成
              // 原因：相机定位是异步的（在requestAnimationFrame中），必须等待相机定位完成后再创建标记
              // 这样标记才能在正确的位置被看到
              console.log('[HelloWorld] 📍 地面标记将在相机定位后创建（避免标记不可见）');

              // ⭐ 自动执行修复模型功能和大坐标模型定位（使用下一帧方式）
              console.log('[HelloWorld] 🤖 局部坐标系模式：将在下一帧自动执行修复模型和定位功能...');
              requestAnimationFrame(async () => {
                // 1. 执行修复模型（现在是异步的，需要等待倾斜摄影采样）
                console.log('[HelloWorld] 🤖 步骤1: 执行自动修复模型...');
                await this.fixModel();

                // 2. 查找并定位到大坐标模型
                console.log('[HelloWorld] 🤖 步骤2: 查找大坐标模型并自动定位...');
                requestAnimationFrame(() => {
                  this.autoFocusOnLargeCoordModel();

                  // 2.2 强制设置垂直俯瞰（在autoFocusOnLargeCoordModel之后）
                  setTimeout(() => {
                    this.forceVerticalOverheadView();
                  }, 100);

                  // 2.5 打印最终状态调试信息
                  setTimeout(() => {
                    const dualViewer = window.__dualCanvasViewerInstances?.[0];
                    if (dualViewer && dualViewer.camera1 && dualViewer.anchorContainer1) {
                      console.log('[HelloWorld] 📊 相机定位完成后的最终状态:', {
                        '=== 坐标系状态 ===': '===',
                        '相机 Y': dualViewer.camera1.position.y.toFixed(2) + '米',
                        'anchorContainer Y': dualViewer.anchorContainer1.position.y.toFixed(2) + '米',
                        '模型海拔': this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z?.toFixed(2) + '米' || '未知',
                        '地板偏移(用户设置)': this.syncManager?.mercatorProjection?.getDualFloorHeight?.()?.toFixed(2) + '米' || '未知',
                        '=== 验证计算 ===': '===',
                        '预期 anchorY': (parseFloat(this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z || 0) + parseFloat(this.syncManager?.mercatorProjection?.getDualFloorHeight?.() || 0)).toFixed(2) + '米',
                        '实际 anchorY': dualViewer.anchorContainer1.position.y.toFixed(2) + '米',
                        '是否匹配': Math.abs((parseFloat(this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z || 0) + parseFloat(this.syncManager?.mercatorProjection?.getDualFloorHeight?.() || 0)) - dualViewer.anchorContainer1.position.y) < 0.01
                      });
                    }
                  }, 200);

                  // 3. 相机定位完成后，创建地面标记（再延迟一帧确保相机完全定位）
                  requestAnimationFrame(() => {
                    console.log('[HelloWorld] 🤖 步骤3: 相机已定位，现在创建地面标记...');
                    // ⭐ 关键修复：使用实际地形高度作为地面点标注高度，与ENU原点标注保持一致
                    // 说明：
                    // 1. 地面点标注、ENU原点标注、红球三者应该使用相同的高度值
                    // 2. 使用异步方法获取实际地形高度（与ENU原点标注相同的方法）
                    // 3. 这样三者会在垂直方向上重合
                    this.addGroundMarkerForLocalCoordWithTerrain(modelLocation.longitude, modelLocation.latitude)
                      .catch(error => {
                        console.error('[HelloWorld] 创建地面点标注失败:', error);
                      });
                  });
                });
              });

            } else {
              console.warn('[HelloWorld] 局部坐标系模式：未找到模型地理位置信息');
            }
          } else {
            // ⭐ 全局坐标系模式：直接定位 Cesium 相机到大坐标模型位置
            console.log('[HelloWorld] ✅ 检测到全局坐标系模式');
            console.log('[HelloWorld] 🌍 全局坐标系模式：将直接定位 Cesium 相机到大坐标模型位置');

            const modelLocation = event.detail.modelLocation;
            if (modelLocation && modelLocation.longitude && modelLocation.latitude) {
              const { longitude, latitude, height: altitude } = modelLocation;

              console.log('[HelloWorld] 📍 定位 Cesium 相机到大坐标模型位置:', {
                经度: longitude.toFixed(6) + '°',
                纬度: latitude.toFixed(6) + '°',
                海拔: altitude.toFixed(2) + '米'
              });

              // 设置 Cesium 相机到模型位置
              const cameraHeight = Math.max(altitude + 500, 1000);
              this.cesiumViewer.camera.setView({
                destination: this.Cesium.Cartesian3.fromDegrees(longitude, latitude, cameraHeight),
                orientation: {
                  heading: 0,
                  pitch: -Cesium.Math.PI_OVER_FOUR,
                  roll: 0
                }
              });

              console.log('[HelloWorld] ✅ Cesium 相机已定位到大坐标模型位置');
            } else {
              console.warn('[HelloWorld] ⚠️ 全局坐标系模式：未找到模型地理位置信息');
            }
          }
        }
      });

      checkDualCanvasReady();

      // 注册全局相机同步函数（用于局部坐标系模式下的手动同步）
      if (typeof window !== 'undefined') {
        window.syncDualCamera = () => this.syncDualCamera();
        console.log('[HelloWorld] ✅ 已注册全局相机同步函数: window.syncDualCamera()');
      }

      // 配置导航控件 - 已临时禁用
      // const options = {
      //   defaultResetView: Cesium.Rectangle.fromDegrees(80, 22, 130, 50),
      //   enableCompass: true,
      //   enableZoomControls: false,
      //   enableDistanceLegend: true,
      //   enableCompassOuterRing: true,
      // };
      // CesiumNavigation(this.cesiumViewer, options);

      // 添加相机监听器
      this.updateMapScaleBound = this.updateMapScale.bind(this);
      this.cesiumViewer.camera.moveEnd.addEventListener(this.updateMapScaleBound);
      this.cesiumViewer.camera.changed.addEventListener(this.updateMapScaleBound);

      this.updateCesiumCoordinatesBound = this.updateCesiumCoordinates.bind(this);
      this.cesiumViewer.camera.changed.addEventListener(this.updateCesiumCoordinatesBound);

      // 初始化比例尺和坐标
      this.updateMapScaleBound();
      this.updateCesiumCoordinatesBound();

      // 设置全局对象
      if (typeof window !== 'undefined') {
        window.__cesiumViewer__ = this.cesiumViewer;

        // ⭐ 触发 Viewer 就绪事件
        const viewerReadyEvent = new CustomEvent('cesium-viewer-ready', {
          detail: { viewer: this.cesiumViewer }
        });
        window.dispatchEvent(viewerReadyEvent);
        console.log('[HelloWorld] 📡 触发 cesium-viewer-ready 事件');

        // 注意：window.__syncManager__ 现在由 DualCanvasViewer 管理
      }

      // ⭐ 关键修复：只有在 syncManager 可用时才调用 setCesium
      // 由于 syncManager 现在通过 getter 从 DualCanvasViewer 获取，
      // 在 DualCanvasViewer 初始化完成之前可能是 null
      if (this.syncManager && typeof this.syncManager.setCesium === 'function') {
        this.syncManager.setCesium(this.Cesium);
        console.log('[HelloWorld] SyncManager.setCesium 已调用');
      } else {
        console.log('[HelloWorld] SyncManager 暂时不可用，将等待 DualCanvasViewer 初始化完成');
      }
    },

    initSyncManager() {
      console.log('[HelloWorld] initSyncManager 调用，当前状态:', {
        hasCesium: !!this.Cesium,
        hasCesiumViewer: !!this.cesiumViewer,
        hasCamera: !!(this.cesiumViewer && this.cesiumViewer.camera),
        hasSyncManager: !!this.syncManager,
        unifiedProjectionInitialized: this.unifiedProjectionInitialized
      });

      if (!this.Cesium || !this.cesiumViewer || !this.cesiumViewer.camera) {
        console.log('[HelloWorld] Cesium 或相机未就绪，500ms后重试');
        setTimeout(() => this.initSyncManager(), 500);
        return;
      }

      // ⭐ 关键修复：检查 syncManager 是否可用
      if (!this.syncManager) {
        console.log('[HelloWorld] SyncManager 暂时不可用，等待 DualCanvasViewer 初始化...');
        setTimeout(() => this.initSyncManager(), 500);
        return;
      }

      // ⭐ 关键修复：设置 cesiumViewer 到 SyncManager
      if (this.syncManager && typeof this.syncManager.setCesiumViewer === 'function') {
        this.syncManager.setCesiumViewer(this.cesiumViewer);
        console.log('[HelloWorld] SyncManager.setCesiumViewer 已调用');
      } else {
        console.warn('[HelloWorld] SyncManager.setCesiumViewer 不可用');
      }

      // 设置地板中心墨卡托坐标（添加保护）
      try {
        if (this.syncManager && typeof this.syncManager.setFloorCenter === 'function') {
          // ⭐ 关键修复：不在 initSyncManager 中设置 floorCenterMercator
          // 因为此时模型可能还没有加载，无法确定是否使用局部坐标系
          // 由 DualCanvasViewer 在模型加载时根据实际情况设置
          console.log('[HelloWorld] initSyncManager: 跳过 floorCenterMercator 设置，将由 DualCanvasViewer 在模型加载时设置');
        }
      } catch (error) {
        console.warn('[HelloWorld] setFloorCenter 调用失败（已忽略，不影响平移）:', error);
      }

      // 设置同步回调（添加保护）
      try {
        if (this.syncManager && typeof this.syncManager.setSyncCallbacks === 'function') {
          this.syncManager.setSyncCallbacks(
            (threeCameraPosition, threeTargetPosition) => {
              this.syncToThreeJS(threeCameraPosition, threeTargetPosition);
            },
            (mercatorCameraPosition, mercatorTargetPosition) => {
              if (!this.isValidCoordinate(mercatorCameraPosition) || !this.isValidCoordinate(mercatorTargetPosition)) {
                return;
              }
              this.syncToCesium(mercatorCameraPosition, mercatorTargetPosition);
            }
          );
        }
      } catch (error) {
        console.warn('[HelloWorld] setSyncCallbacks 调用失败（已忽略，不影响平移）:', error);
      }

      // 添加 Cesium 相机变化监听
      this.cesiumViewer.camera.moveEnd.addEventListener(() => {
        if (!this.syncManager) return; // ⭐ 添加 null 检查

        if (this.syncManager.syncDepth > 0) {
          this.syncManager.syncDepth--;
          return;
        }

        if (window.cesiumDualSyncV2) {
          const state = window.cesiumDualSyncV2.getState();
          if (state && state.isUserDragging) {
            return;
          }
        }

        // 滚轮操作期间跳过同步，避免双重同步冲突
        if (this.isWheeling) {
          return;
        }

        // 更新地下状态追踪
        try {
          const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
          const cartographic = ellipsoid.cartesianToCartographic(this.cesiumViewer.camera.position);
          this._isUnderground = cartographic.height < 0;
        } catch (error) {
          // 忽略错误
        }

        // ⭐ 关键保护：syncManager 调用添加 try-catch，确保平移功能不受影响
        try {
          if (this.syncManager && typeof this.syncManager.syncCesiumToThree === 'function') {
            this.syncManager.syncCesiumToThree(this.cesiumViewer.camera, this.cesiumViewer.scene);
          }
        } catch (error) {
          console.warn('[HelloWorld] syncCesiumToThree 调用失败（已忽略，不影响平移）:', error);
        }
      });

      // 初始化统一平面投影坐标系（添加保护）
      try {
        if (this.syncManager && typeof this.syncManager.initFromCesium === 'function') {
          this.syncManager.initFromCesium(
            this.cesiumViewer.camera,
            this.cesiumViewer.scene
          );
        }
      } catch (error) {
        console.warn('[HelloWorld] initFromCesium 调用失败（已忽略，不影响平移）:', error);
      }

      // 设置全局标志，让 cesium-dual-sync 知道统一坐标系模式已启用
      if (typeof window !== 'undefined') {
        window.__unifiedProjectionMode__ = true;
        console.log('[HelloWorld] ✅ 已设置全局标志 window.__unifiedProjectionMode__ = true');
      }

      this.unifiedProjectionInitialized = true;
      console.log('[HelloWorld] ✅ 统一坐标系已初始化 - 翻转和平移功能已启用', {
        unifiedProjectionInitialized: this.unifiedProjectionInitialized,
        hasSyncManager: !!this.syncManager,
        globalMode: window.__unifiedProjectionMode__
      });
    },

    // ==================== DualCanvasViewer 初始化 ====================

    initDualCanvasViewer() {
      const checkReady = () => {
        // ⭐ 新的 SFC 加载方式检查
        const hasXeokit = typeof window.xeokitSDK !== 'undefined';
        const hasVue3SfcLoader = typeof window !== 'undefined' && window['vue3-sfc-loader'];
        const hasVue = typeof window.Vue !== 'undefined';

        // 兼容旧的 IIFE 方式
        const hasOldPlugin = typeof window.DualCanvasViewerPlugin !== 'undefined';

        // ⭐ 新增：检查关键工具模块是否已加载到全局
        const requiredModules = [
          'rendererManager',
          'unifiedViewport',
          'ViewerSyncManager',
          'mercatorProjectionManager',
          'HeightAlignmentManager',
          'SceneRotationManager'
        ];
        const hasUtilityModules = requiredModules.every(name => typeof window[name] !== 'undefined');

        // ⭐ 优先检查是否强制使用 IIFE 模式
        if (this.useIIFELoading) {
          if (hasXeokit && hasOldPlugin && hasVue) {
            console.log('[HelloWorld] 🔄 强制使用 IIFE 加载方式（用户配置）');
            this.initDualCanvasViewerIIFE();
            return;
          } else {
            console.log('[HelloWorld] 等待 IIFE 依赖加载...', {
              hasXeokit,
              hasOldPlugin,
              hasVue,
              mode: 'IIFE (forced)'
            });
            setTimeout(checkReady, 100);
            return;
          }
        }

        // ⭐ 检查条件：xeokit、vue3-sfc-loader 和工具模块都可用
        if (hasXeokit && hasVue3SfcLoader && hasUtilityModules) {
          console.log('[HelloWorld] ⭐ 使用新的 SFC 加载方式（工具模块已就绪）');
          this.initDualCanvasViewerSFC();
        } else if (hasXeokit && hasOldPlugin && hasVue) {
          console.log('[HelloWorld] ⚠️ 回退到旧的 IIFE 加载方式');
          this.initDualCanvasViewerIIFE();
        } else {
          console.log('[HelloWorld] 等待依赖加载...', {
            hasXeokit,
            hasVue3SfcLoader,
            hasVue,
            hasOldPlugin,
            hasUtilityModules,
            missingModules: requiredModules.filter(name => typeof window[name] === 'undefined')
          });
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    },

    // ⭐ 新的 SFC 加载方式
    async initDualCanvasViewerSFC() {
      try {
        const { loadModule } = window['vue3-sfc-loader'];

        // ⭐ 动态导入 Vue 并传递完整的 Vue 对象
        const Vue = await import('vue');

        // ⭐ 不在编译时导入，而是在运行时从全局获取或使用 CDN
        // 移除 webpack 编译时的 import 语句，避免 "Can't resolve" 错误

        // 导入工具模块（从全局 window 对象获取）
        const utilityModules = await this.importUtilityModules();

        const {
          rendererManager,
          unifiedViewport,
          ViewerSyncManager,
          MercatorProjectionManager,
          mercatorProjectionManager,
          PrecisionModelLoader,
          ENUCoordinateManager,
          enuCoordinateManager,
          HeightAlignmentManager,
          SceneRotationManager,
          sceneRotationManager,
          SceneRotationIntegration,
          sceneRotationIntegration,
          ModelMercatorMetadataManager,
          ThreeJSPanHandler,
          ThreeJSZoomHandler,
          SurfaceModeDetector,
          ControlsRestrictionManager,
          MouseOperationCoordinator
        } = utilityModules;

        // vue3-sfc-loader 配置
        const options = {
          additionalModuleTypes: ['js'],
          moduleCache: {
            // ⭐ 传递完整的 Vue 对象（不是解构的函数）
            vue: Vue,
            three: THREE,
            // ⭐ Three.js addons 从全局 window 获取（如果可用）
            // 使用函数包装器创建正确的模块结构，避免 vue3-sfc-loader 命名空间导入问题
            'three/addons/controls/OrbitControls.js': (typeof window !== 'undefined' && window.OrbitControls) ?
              (() => {
                const module = {};
                module.default = window.OrbitControls;
                module.OrbitControls = window.OrbitControls;
                return module;
              })() : {},
            'three/addons/loaders/PLYLoader.js': (typeof window !== 'undefined' && window.PLYLoader) ?
              (() => {
                const module = {};
                module.default = window.PLYLoader;
                module.PLYLoader = window.PLYLoader;
                return module;
              })() : {},
            'three/addons/loaders/DRACOLoader.js': (typeof window !== 'undefined' && window.DRACOLoader) ?
              (() => {
                const module = {};
                module.default = window.DRACOLoader;
                module.DRACOLoader = window.DRACOLoader;
                return module;
              })() : {},
            'three/addons/loaders/GLTFLoader.js': (typeof window !== 'undefined' && window.GLTFLoader) ?
              (() => {
                const module = {};
                module.default = window.GLTFLoader;
                module.GLTFLoader = window.GLTFLoader;
                return module;
              })() : {},
            'three/addons/controls/TransformControls.js': (typeof window !== 'undefined' && window.TransformControls) ?
              (() => {
                const module = {};
                module.default = window.TransformControls;
                module.TransformControls = window.TransformControls;
                return module;
              })() : {},
            // ⭐ xeokit 和 web-ifc 从全局获取（如果存在）
            'xeokit-sdk': (typeof window !== 'undefined' && window.xeokitSDK) ? window.xeokitSDK : {},
            'web-ifc': (typeof window !== 'undefined' && window.WebIFC) ? window.WebIFC : {},
            '/utils/rendererManager.js': { rendererManager },
            './utils/rendererManager.js': { rendererManager },
            '../utils/rendererManager.js': { rendererManager },
            '/utils/CoordinateSystem.js': { unifiedViewport },
            './utils/CoordinateSystem.js': { unifiedViewport },
            '../utils/CoordinateSystem.js': { unifiedViewport },
            '/utils/SyncManager.js': { ViewerSyncManager },
            './utils/SyncManager.js': { ViewerSyncManager },
            '../utils/SyncManager.js': { ViewerSyncManager },
            '/utils/MercatorProjectionManager.js': { MercatorProjectionManager, mercatorProjectionManager },
            './utils/MercatorProjectionManager.js': { MercatorProjectionManager, mercatorProjectionManager },
            '../utils/MercatorProjectionManager.js': { MercatorProjectionManager, mercatorProjectionManager },
            '/utils/PrecisionModelLoader.js': { PrecisionModelLoader },
            './utils/PrecisionModelLoader.js': { PrecisionModelLoader },
            '../utils/PrecisionModelLoader.js': { PrecisionModelLoader },
            '/utils/ENUCoordinateManager.js': { ENUCoordinateManager, enuCoordinateManager },
            './utils/ENUCoordinateManager.js': { ENUCoordinateManager, enuCoordinateManager },
            '../utils/ENUCoordinateManager.js': { ENUCoordinateManager, enuCoordinateManager },
            '/utils/HeightAlignmentManager.js': { HeightAlignmentManager },
            './utils/HeightAlignmentManager.js': { HeightAlignmentManager },
            '../utils/HeightAlignmentManager.js': { HeightAlignmentManager },
            '/utils/SceneRotationManager.js': { SceneRotationManager, sceneRotationManager },
            './utils/SceneRotationManager.js': { SceneRotationManager, sceneRotationManager },
            '../utils/SceneRotationManager.js': { SceneRotationManager, sceneRotationManager },
            '/utils/SceneRotationIntegration.js': { SceneRotationIntegration, sceneRotationIntegration },
            './utils/SceneRotationIntegration.js': { SceneRotationIntegration, sceneRotationIntegration },
            '../utils/SceneRotationIntegration.js': { SceneRotationIntegration, sceneRotationIntegration },
            '/utils/ModelMercatorMetadataManager.js': { ModelMercatorMetadataManager },
            './utils/ModelMercatorMetadataManager.js': { ModelMercatorMetadataManager },
            '../utils/ModelMercatorMetadataManager.js': { ModelMercatorMetadataManager },
            '/utils/operation-handlers/ThreeJSPanHandler.js': { ThreeJSPanHandler },
            './utils/operation-handlers/ThreeJSPanHandler.js': { ThreeJSPanHandler },
            '../utils/operation-handlers/ThreeJSPanHandler.js': { ThreeJSPanHandler },
            '/utils/operation-handlers/ThreeJSZoomHandler.js': { ThreeJSZoomHandler },
            './utils/operation-handlers/ThreeJSZoomHandler.js': { ThreeJSZoomHandler },
            '../utils/operation-handlers/ThreeJSZoomHandler.js': { ThreeJSZoomHandler },
            '/utils/operation-handlers/SurfaceModeDetector.js': { SurfaceModeDetector },
            './utils/operation-handlers/SurfaceModeDetector.js': { SurfaceModeDetector },
            '../utils/operation-handlers/SurfaceModeDetector.js': { SurfaceModeDetector },
            '/utils/operation-handlers/ControlsRestrictionManager.js': { ControlsRestrictionManager },
            './utils/operation-handlers/ControlsRestrictionManager.js': { ControlsRestrictionManager },
            '../utils/operation-handlers/ControlsRestrictionManager.js': { ControlsRestrictionManager },
            '/MouseOperationCoordinator.js': { MouseOperationCoordinator },
            './MouseOperationCoordinator.js': { MouseOperationCoordinator },
            '../MouseOperationCoordinator.js': { MouseOperationCoordinator }
          },
          async getFile(url) {
            const cacheBuster = `?v=3.1.${Date.now()}`;
            const res = await fetch(url + cacheBuster, { cache: 'no-store' });
            if (!res.ok) {
              throw Object.assign(new Error(res.statusText + ' ' + url), { res });
            }
            return {
              getContentData: (asBinary) => {
                if (asBinary) {
                  return res.arrayBuffer();
                }
                return res.text();
              },
            };
          },
          addStyle(textContent) {
            const style = document.createElement('style');
            style.textContent = textContent;
            document.head.appendChild(style);
          }
        };

        // 动态加载 DualCanvasViewer 组件
        console.log('[HelloWorld] 🔄 加载 DualCanvasViewer.vue...');
        const DualCanvasViewer = await loadModule('/components/DualCanvasViewer.vue', options);

        // 创建 Vue 应用（从 Vue 对象中解构 createApp）
        const app = Vue.createApp({
          components: {
            DualCanvasViewer
          },
          template: `
            <dual-canvas-viewer
              :show-three-layer="true"
              :show-bim-layer="true"
              :camera-sync-enabled="true" />
          `
        });

        const container = document.getElementById('dualCanvasContainer');
        this.dualCanvasAppInstance = app;
        this.dualCanvasApp = app.mount(container);

        // 应用事件穿透样式
        this.applyPointerEvents(container);

        const observer = new MutationObserver(() => {
          this.applyPointerEvents(container);
        });
        observer.observe(container, { childList: true, subtree: true });
        this.dualCanvasObserver = observer;

        // 设置全局实例
        if (typeof window !== 'undefined') {
          window.__dualCanvasViewerInstances = window.__dualCanvasViewerInstances || [];
          window.__dualCanvasViewerInstances.push(this.dualCanvasApp);

          const event = new CustomEvent('DualCanvasViewerMounted', {
            detail: { instance: this.dualCanvasApp }
          });
          document.dispatchEvent(event);
        }

        // 延迟设置 OrbitControls 参数
        setTimeout(() => this.setupOrbitControls(), 100);

        // ⭐ 修复 mercatorProjection 对象
        setTimeout(() => this.fixMercatorProjection(), 200);

        console.log('[HelloWorld] ✅ DualCanvasViewer (SFC) 已加载');
      } catch (error) {
        console.error('[HelloWorld] ❌ SFC 加载失败:', error);
        // 尝试回退到 IIFE 方式
        if (typeof window.DualCanvasViewerPlugin !== 'undefined') {
          console.log('[HelloWorld] ⚠️ 回退到 IIFE 方式');
          this.initDualCanvasViewerIIFE();
        }
      }
    },

    // 导入工具模块（从全局 window 对象获取，不使用 import）
    async importUtilityModules() {
      // ⭐ 所有工具模块应该已经通过 <script> 标签加载到全局
      // 直接从 window 对象获取，避免 webpack 编译时的 import 解析错误

      // ⭐ 新增：等待模块加载完成的轮询机制
      const maxRetries = 50; // 最多等待 5 秒（50次 × 100ms）
      let retries = 0;

      const waitForModules = () => {
        return new Promise((resolve, reject) => {
          const checkModules = () => {
            if (typeof window === 'undefined') {
              reject(new Error('window 对象不可用'));
              return;
            }

            const modules = {
              // ⭐ 单例模块（小写，导出实例）
              rendererManager: window.rendererManager,
              unifiedViewport: window.unifiedViewport,
              mercatorProjectionManager: window.mercatorProjectionManager,
              enuCoordinateManager: window.enuCoordinateManager,
              sceneRotationManager: window.sceneRotationManager,
              sceneRotationIntegration: window.sceneRotationIntegration,
              modelMercatorMetadataManager: window.modelMercatorMetadataManager,
              surfaceModeDetector: window.surfaceModeDetector,

              // ⭐ 多实例类（大写，导出类定义，调用者需自行 new）
              ViewerSyncManager: window.ViewerSyncManager,
              PrecisionModelLoader: window.PrecisionModelLoader,
              HeightAlignmentManager: window.HeightAlignmentManager,
              ControlsRestrictionManager: window.ControlsRestrictionManager,
              MouseOperationCoordinator: window.MouseOperationCoordinator,
              ThreeJSPanHandler: window.ThreeJSPanHandler,
              ThreeJSZoomHandler: window.ThreeJSZoomHandler
            };

            // 检查关键模块是否存在
            const missingModules = Object.entries(modules)
              .filter(([key, value]) => !value)
              .map(([key]) => key);

            if (missingModules.length === 0) {
              // 所有模块都已加载
              console.log('[HelloWorld] ✅ 所有工具模块已就绪');
              resolve(modules);
            } else if (retries < maxRetries) {
              // 还有模块未加载，继续等待
              retries++;
              if (retries % 10 === 0) { // 每秒打印一次日志
                console.log(`[HelloWorld] ⏳ 等待工具模块加载... (${retries * 100}ms)`, {
                  missing: missingModules,
                  progress: `${Math.round((retries / maxRetries) * 100)}%`
                });
              }
              setTimeout(checkModules, 100);
            } else {
              // 超时，返回已加载的模块并记录警告
              console.warn('[HelloWorld] ⚠️ 工具模块加载超时，部分模块未在全局找到:', missingModules);
              resolve(modules); // 返回已加载的模块，让系统能够继续运行
            }
          };

          checkModules();
        });
      };

      return waitForModules();
    },

    // ⚠️ 旧的 IIFE 加载方式（兼容性回退）
    async initDualCanvasViewerIIFE() {
      // ⭐ 等待 window.Vue 可用（如果使用 CDN 版本，需要确保它已加载）
      const waitForVue = () => {
        if (typeof window !== 'undefined' && window.Vue) {
          this.initDualCanvasViewerIIFEImpl();
        } else {
          console.log('[IIFE] 等待 window.Vue...');
          setTimeout(waitForVue, 100);
        }
      };
      waitForVue();
    },

    // IIFE 实际实现
    initDualCanvasViewerIIFEImpl() {
      const { createApp, h } = window.Vue;

      const app = createApp({
        data() {
          return { loaded: true };
        },
        render() {
          return h(window.DualCanvasViewerPlugin);
        }
      });

      const container = document.getElementById('dualCanvasContainer');
      this.dualCanvasAppInstance = app;
      this.dualCanvasApp = app.mount(container);

      // 应用事件穿透样式
      this.applyPointerEvents(container);

      const observer = new MutationObserver(() => {
        this.applyPointerEvents(container);
      });
      observer.observe(container, { childList: true, subtree: true });
      this.dualCanvasObserver = observer;

      // 设置全局实例
      if (typeof window !== 'undefined') {
        window.__dualCanvasViewerInstances = window.__dualCanvasViewerInstances || [];
        window.__dualCanvasViewerInstances.push(this.dualCanvasApp);

        const event = new CustomEvent('DualCanvasViewerMounted', {
          detail: { instance: this.dualCanvasApp }
        });
        document.dispatchEvent(event);
      }

      // 延迟设置 OrbitControls 参数
      setTimeout(() => this.setupOrbitControls(), 100);

      // ⭐ 修复 mercatorProjection 对象
      setTimeout(() => this.fixMercatorProjection(), 200);

      console.log('[HelloWorld] ✅ DualCanvasViewer (IIFE) 已加载');
    },

    // ⭐ 多实例管理方法
    /**
     * ⭐ 切换加载模式（SFC <-> IIFE）
     * 注意：切换模式后需要刷新页面才能生效
     */
    toggleLoadingMode() {
      this.useIIFELoading = !this.useIIFELoading;
      const mode = this.useIIFELoading ? 'IIFE' : 'SFC';
      console.log(`[HelloWorld] 🔄 加载模式已切换到: ${mode}（需要刷新页面才能生效）`);

      // 提示用户需要刷新页面
      const confirmRefresh = confirm(
        `加载模式已切换到 ${mode} 模式。\n\n` +
        `是否立即刷新页面以应用新模式？\n\n` +
        `点击"确定"刷新，点击"取消"稍后手动刷新。`
      );

      if (confirmRefresh) {
        location.reload();
      }
    },

    /**
     * ⭐ 切换 SfcDualCanvasViewer 测试组件显示状态
     * 每次点击都创建新的组件实例
     */
    /**
     * ⭐ 切换 TestSfc Modal 组件显示状态
     * 每次点击都创建新的组件实例
     */
    async toggleTestSfcModal() {
      // 直接创建新实例，允许多实例同时存在
      console.log('[HelloWorld] 创建新的 TestSfc Modal 组件实例（不清理旧实例）');

      // 增加实例计数器
      const instanceId = ++this.testSfcModalInstanceCounter;

      // 设置为显示状态
      this.testSfcModalVisible = true;
      console.log(`[HelloWorld] TestSfc Modal 组件实例 #${instanceId}: 显示`);

      // 等待 DOM 更新
      await this.$nextTick();

      // 加载 TestSfc Modal 组件（创建新实例）
      this.loadTestSfcModalComponent(instanceId);
    },

    async toggleTestSfc() {
      // 直接创建新实例，允许多实例同时存在
      console.log('[HelloWorld] 创建新的 SfcDualCanvasViewer 组件实例（不清理旧实例）');

      // 增加实例计数器
      const instanceId = ++this.testSfcInstanceCounter;

      // 设置为显示状态
      this.testSfcVisible = true;
      console.log(`[HelloWorld] SfcDualCanvasViewer 组件实例 #${instanceId}: 显示`);

      // 等待 DOM 更新
      await this.$nextTick();

      // 加载 SfcDualCanvasViewer 组件（创建新实例）
      this.loadTestSfcComponent(instanceId);
    },

    /**
     * ⭐ 加载 TestSfc 组件（使用打包后的 ESM 模块）
     */

    /**
     * ⭐ 加载 TestSfc Modal 组件（使用打包后的 TestSfc.mjs）
     */
    async loadTestSfcModalComponent(instanceId) {
      try {
        console.log(`[HelloWorld] 🧪 开始加载 TestSfc Modal 组件实例 #${instanceId}...`);

        // 检查 vue3-sfc-loader 是否可用
        if (typeof window === 'undefined' || !window['vue3-sfc-loader']) {
          console.error('[HelloWorld] vue3-sfc-loader 不可用');
          alert('TestSfc Modal 组件加载失败：vue3-sfc-loader 不可用\n请确保使用 SFC 加载模式');
          return;
        }

        const { loadModule } = window['vue3-sfc-loader'];
        const Vue = await import('vue');

        // 加载 CSS
        const cssUrl = '/test-sfc/cesiumBase.css';
        const loadCSS = (href) => {
          return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (document.querySelector(`link[href="${href}"]`)) {
              resolve();
              return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });
        };

        await loadCSS(cssUrl);

        // vue3-sfc-loader 配置（支持 ESM 模块）
        const options = {
          moduleCache: {
            vue: Vue
          },
          getFile: async (url) => {
            console.log('[TestSfc Modal] 获取文件:', url);
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`无法加载文件: ${url}`);
            }
            const content = await res.text();
            return content;
          },
          addStyle: (content) => {
            const style = document.createElement('style');
            style.textContent = content;
            document.head.appendChild(style);
          }
        };

        // 加载 TestSfc.mjs 组件（打包后的 ESM 模块）
        const componentPath = '/test-sfc/TestSfc.mjs';
        const TestSfcModalComponent = await loadModule(componentPath, options);

        // 创建 Vue 应用实例
        const TestSfcModalApp = Vue.createApp(TestSfcModalComponent.default);

        // 创建独立的容器元素
        const offset = (instanceId - 1) * 30;  // 每个实例偏移 30px
        const container = document.createElement('div');
        container.id = `testSfcModalContainer-${instanceId}`;
        const initialTop = 100 + offset;
        const initialRight = 20 + offset;
        container.style.cssText = `
          position: fixed;
          top: ${initialTop}px;
          right: ${initialRight}px;
          z-index: ${100010 + instanceId};
        `;

        // 添加到 body
        document.body.appendChild(container);

        // 注册实例关闭回调
        const closeCallback = () => {
          console.log(`[HelloWorld] TestSfc Modal 实例 #${instanceId} 关闭请求`);
          this.destroyTestSfcModalInstance(instanceId);
        };

        if (typeof window !== 'undefined') {
          const eventName = `testSfcModalClose-${instanceId}`;
          window.addEventListener(eventName, closeCallback);

          // 将事件名传递给组件（组件可以通过触发此事件来关闭自身）
          TestSfcModalApp.provide('closeEventName', eventName);
          TestSfcModalApp.provide('instanceId', instanceId);
        }

        // ⭐ 挂载组件到容器
        const appInstance = TestSfcModalApp.mount(container);

        // 保存实例信息到数组
        this.testSfcModalInstances.push({
          id: instanceId,
          app: TestSfcModalApp,
          componentInstance: appInstance,
          container: container,
          closeEventName: `testSfcModalClose-${instanceId}`,
          closeCallback: closeCallback
        });

        console.log(`[HelloWorld] ✅ TestSfc Modal 组件实例 #${instanceId} 加载成功，总计 ${this.testSfcModalInstances.length} 个实例`);

      } catch (error) {
        console.error(`[HelloWorld] ❌ TestSfc Modal 组件实例 #${instanceId} 加载失败:`, error);
        alert(`TestSfc Modal 组件加载失败：\n${error.message}`);
      }
    },

    /**
     * 销毁指定的 TestSfc Modal 实例
     */
    destroyTestSfcModalInstance(instanceId) {
      const instanceIndex = this.testSfcModalInstances.findIndex(inst => inst.id === instanceId);

      if (instanceIndex === -1) {
        console.warn(`[HelloWorld] TestSfc Modal 实例 #${instanceId} 不存在`);
        return;
      }

      const instance = this.testSfcModalInstances[instanceIndex];

      console.log(`[HelloWorld] 销毁 TestSfc Modal 实例 #${instanceId}`);

      // 卸载 Vue 应用
      if (instance.app) {
        instance.app.unmount();
      }

      // 移除容器
      if (instance.container && instance.container.parentNode) {
        instance.container.parentNode.removeChild(instance.container);
      }

      // 移除事件监听器
      if (typeof window !== 'undefined' && instance.closeEventName) {
        window.removeEventListener(instance.closeEventName, instance.closeCallback);
      }

      // 从数组中移除
      this.testSfcModalInstances.splice(instanceIndex, 1);

      console.log(`[HelloWorld] TestSfc Modal 实例 #${instanceId} 已销毁，剩余 ${this.testSfcModalInstances.length} 个实例`);

      // 如果没有实例了，隐藏标志
      if (this.testSfcModalInstances.length === 0) {
        this.testSfcModalVisible = false;
      }
    },

    /**
     * ⭐ 切换 SfcDualCanvas 双画布组件显示状态
     * 每次点击都创建新的组件实例
     */
    async toggleSfcDualCanvas() {
      // ⭐ 切换显示状态
      this.sfcDualCanvasVisible = !this.sfcDualCanvasVisible;

      if (this.sfcDualCanvasVisible) {
        console.log('[HelloWorld] 创建新的 SfcDualCanvas 组件实例');

        // 增加实例计数器
        const instanceId = ++this.sfcDualCanvasInstanceCounter;

        console.log('[HelloWorld] SfcDualCanvas 实例 #' + instanceId + ': 显示');

        // 动态创建容器和挂载组件
        await this.loadSfcDualCanvasComponent(instanceId);
      } else {
        console.log('[HelloWorld] 隐藏 SfcDualCanvas 组件');
        // 可选：清理所有 SfcDualCanvas 实例
        // this.clearAllSfcDualCanvasInstances();
      }
    },

    /**
     * ⭐ 加载 SfcDualCanvas 组件（使用打包后的 ESM 模块）
     */
    async loadSfcDualCanvasComponent(instanceId) {
      try {
        console.log('[HelloWorld] 开始加载 SfcDualCanvas 组件实例 #' + instanceId + '...');

        // 检查 vue3-sfc-loader 是否可用
        if (typeof window === 'undefined' || !window['vue3-sfc-loader']) {
          console.error('[HelloWorld] vue3-sfc-loader 不可用');
          alert('SfcDualCanvas 组件加载失败：vue3-sfc-loader 不可用\n请确保使用 SFC 加载模式');
          return;
        }

        const { loadModule } = window['vue3-sfc-loader'];
        const Vue = await import('vue');

        // 加载 CSS
        const cssUrl = '/test-sfc/SfcDualCanvasViewer.css';
        const loadCSS = (href) => {
          return new Promise((resolve, reject) => {
            // 先删除已存在的 link 标签以确保加载最新版本
            const existingLink = document.querySelector('link[href="' + href + '"]');
            if (existingLink) {
              existingLink.remove();
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });
        };

        await loadCSS(cssUrl);

        // 动态导入 Three.js 相关模块
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');

        // vue3-sfc-loader 配置（支持 ESM 模块）
        const options = {
          moduleCache: {
            vue: Vue,
            'three': THREE.default || THREE,  // 使用 default 导入以避免多实例
            'three/examples/jsm/controls/OrbitControls.js': { OrbitControls },
            'three/examples/jsm/loaders/GLTFLoader.js': { GLTFLoader },
            'three/examples/jsm/loaders/DRACOLoader.js': { DRACOLoader }
          },
          getFile: async (url) => {
            console.log('[SfcDualCanvas] 获取文件:', url);
            const res = await fetch(url, {
              cache: 'no-cache',
              headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
              }
            });
            if (!res.ok) {
              throw new Error('无法加载文件: ' + url);
            }
            const content = await res.text();
            return content;
          },
          addStyle: (content) => {
            const style = document.createElement('style');
            style.textContent = content;
            document.head.appendChild(style);
          }
        };

        // 加载 SfcDualCanvasViewer.mjs 组件（打包后的 ESM 模块）
        const componentPath = '/test-sfc/SfcDualCanvasViewer.mjs';
        const SfcDualCanvasComponent = await loadModule(componentPath, options);

        // 创建 Vue 应用实例
        const SfcDualCanvasApp = Vue.createApp(SfcDualCanvasComponent.default);

        // 创建独立的容器元素（不设置固定定位和尺寸，让组件自己管理）
        const container = document.createElement('div');
        container.id = 'sfcDualCanvasContainer-' + instanceId;
        // 不设置任何样式，让组件完全控制自己的布局

        // 添加到 body
        document.body.appendChild(container);

        // 注册实例关闭回调
        const closeCallback = () => {
          console.log('[HelloWorld] SfcDualCanvas 实例 #' + instanceId + ' 关闭请求');
          this.destroySfcDualCanvasInstance(instanceId);
        };

        if (typeof window !== 'undefined') {
          const eventName = 'sfcDualCanvasClose-' + instanceId;
          window.addEventListener(eventName, closeCallback);
          SfcDualCanvasApp.provide('closeEventName', eventName);
          SfcDualCanvasApp.provide('instanceId', instanceId);
        }

        // 挂载组件
        const appInstance = SfcDualCanvasApp.mount(container);

        // 保存实例信息到数组
        this.sfcDualCanvasInstances.push({
          id: instanceId,
          app: SfcDualCanvasApp,
          componentInstance: appInstance,
          container: container,
          closeEventName: 'sfcDualCanvasClose-' + instanceId,
          closeCallback: closeCallback
        });

        console.log('[HelloWorld] SfcDualCanvas 组件实例 #' + instanceId + ' 加载成功，总计 ' + this.sfcDualCanvasInstances.length + ' 个实例');

      } catch (error) {
        console.error('[HelloWorld] SfcDualCanvas 组件实例 #' + instanceId + ' 加载失败:', error);
        alert('SfcDualCanvas 组件加载失败：\n' + error.message);
      }
    },

    /**
     * 销毁指定的 SfcDualCanvas 实例
     */
    destroySfcDualCanvasInstance(instanceId) {
      const instanceIndex = this.sfcDualCanvasInstances.findIndex(inst => inst.id === instanceId);

      if (instanceIndex === -1) {
        console.warn('[HelloWorld] SfcDualCanvas 实例 #' + instanceId + ' 不存在');
        return;
      }

      const instance = this.sfcDualCanvasInstances[instanceIndex];

      console.log('[HelloWorld] 销毁 SfcDualCanvas 实例 #' + instanceId);

      // 卸载 Vue 应用
      if (instance.app) {
        instance.app.unmount();
      }

      // 移除容器
      if (instance.container && instance.container.parentNode) {
        instance.container.parentNode.removeChild(instance.container);
      }

      // 移除事件监听器
      if (typeof window !== 'undefined' && instance.closeEventName) {
        window.removeEventListener(instance.closeEventName, instance.closeCallback);
      }

      // 从数组中移除
      this.sfcDualCanvasInstances.splice(instanceIndex, 1);

      console.log('[HelloWorld] SfcDualCanvas 实例 #' + instanceId + ' 已销毁，剩余 ' + this.sfcDualCanvasInstances.length + ' 个实例');
    },
async loadTestSfcComponent(instanceId) {
      try {
        console.log(`[HelloWorld] 🌐 开始加载 SfcDualCanvasViewer 组件实例 #${instanceId}...`);

        // 检查 vue3-sfc-loader 是否可用
        if (typeof window === 'undefined' || !window['vue3-sfc-loader']) {
          console.error('[HelloWorld] vue3-sfc-loader 不可用');
          alert('SfcDualCanvasViewer 组件加载失败：vue3-sfc-loader 不可用\n请确保使用 SFC 加载模式');
          return;
        }

        const { loadModule } = window['vue3-sfc-loader'];
        const Vue = await import('vue');

        // 加载 CSS
        const cssUrl = '/test-sfc/SfcDualCanvasViewer.css';
        const loadCSS = (href) => {
          return new Promise((resolve, reject) => {
            // 检查是否已加载
            if (document.querySelector(`link[href="${href}"]`)) {
              resolve();
              return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });
        };

        await loadCSS(cssUrl);

        // 动态导入 Three.js 相关模块
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');

        // vue3-sfc-loader 配置（支持 ESM 模块）
        const options = {
          moduleCache: {
            vue: Vue,
            'three': THREE.default || THREE,  // 使用 default 导入以避免多实例
            'three/examples/jsm/controls/OrbitControls.js': { OrbitControls },
            'three/examples/jsm/loaders/GLTFLoader.js': { GLTFLoader },
            'three/examples/jsm/loaders/DRACOLoader.js': { DRACOLoader }
          },
          getFile: async (url) => {
            console.log('[SfcDualCanvasViewer] 获取文件:', url);
            const res = await fetch(url);
            if (!res.ok) {
              throw new Error(`无法加载文件: ${url}`);
            }
            const content = await res.text();
            return content;
          },
          addStyle: (content) => {
            const style = document.createElement('style');
            style.textContent = content;
            document.head.appendChild(style);
          }
        };

        // 加载 SfcDualCanvasViewer.mjs 组件（打包后的 ESM 模块）
        const componentPath = '/test-sfc/SfcDualCanvasViewer.mjs';
        const SfcDualCanvasComponent = await loadModule(componentPath, options);

        // 创建 Vue 应用实例
        const SfcDualCanvasApp = Vue.createApp(SfcDualCanvasComponent.default);

        // 创建独立的容器元素
        const offset = (instanceId - 1) * 30;  // 每个实例偏移 30px
        const container = document.createElement('div');
        container.id = `sfcDualCanvasContainer-${instanceId}`;
        const initialTop = 100 + offset;
        const initialLeft = 350 + offset;  // 从多实例面板右侧开始
        container.style.cssText = `
          position: fixed;
          top: ${initialTop}px;
          left: ${initialLeft}px;
          width: 600px;
          height: 500px;
          z-index: ${100000 + instanceId};
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          background: rgba(20, 20, 30, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        `;

        // ⭐ 添加拖动头部
        const header = document.createElement('div');
        header.className = 'sfc-dual-header';
        header.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: rgba(0, 0, 0, 0.5);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          cursor: move;
          user-select: none;
          z-index: 10;
        `;

        // 标题
        const title = document.createElement('div');
        title.className = 'sfc-dual-title';
        title.textContent = `SFC双画布 #${instanceId}`;
        title.style.cssText = `
          color: white;
          font-size: 13px;
          font-weight: 500;
        `;

        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'sfc-dual-close';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
          width: 28px;
          height: 28px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          font-size: 20px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        `;

        closeBtn.addEventListener('mouseenter', () => {
          closeBtn.style.background = 'rgba(244, 67, 54, 0.3)';
          closeBtn.style.color = '#f44336';
        });

        closeBtn.addEventListener('mouseleave', () => {
          closeBtn.style.background = 'transparent';
          closeBtn.style.color = 'rgba(255, 255, 255, 0.7)';
        });

        closeBtn.addEventListener('click', () => {
          this.destroyTestSfcInstance(instanceId);
        });

        // 组装头部
        header.appendChild(title);
        header.appendChild(closeBtn);

        // ⭐ 添加拖动功能
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        header.addEventListener('mousedown', (e) => {
          if (e.target === closeBtn || closeBtn.contains(e.target)) return;

          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startLeft = container.offsetLeft;
          startTop = container.offsetTop;

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);

          e.preventDefault();
        });

        const handleMouseMove = (e) => {
          if (!isDragging) return;

          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;

          container.style.left = (startLeft + deltaX) + 'px';
          container.style.top = (startTop + deltaY) + 'px';
        };

        const handleMouseUp = () => {
          isDragging = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        // 创建内容容器
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'sfc-dual-content';
        contentWrapper.style.cssText = `
          position: absolute;
          top: 40px;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
        `;

        // 组装容器
        container.appendChild(header);
        container.appendChild(contentWrapper);

        // 添加到 body（而不是使用固定的容器）
        document.body.appendChild(container);

        // 注册实例关闭回调
        const closeCallback = () => {
          console.log(`[HelloWorld] SfcDualCanvasViewer 实例 #${instanceId} 关闭请求`);
          this.destroyTestSfcInstance(instanceId);
        };

        if (typeof window !== 'undefined') {
          const eventName = `sfcDualCanvasClose-${instanceId}`;
          window.addEventListener(eventName, closeCallback);

          // 将事件名传递给组件（组件可以通过触发此事件来关闭自身）
          SfcDualCanvasApp.provide('closeEventName', eventName);
          SfcDualCanvasApp.provide('instanceId', instanceId);
        }

        // ⭐ 挂载组件到内容容器
        const appInstance = SfcDualCanvasApp.mount(contentWrapper);

        // 保存实例信息到数组
        this.testSfcInstances.push({
          id: instanceId,
          app: SfcDualCanvasApp,
          componentInstance: appInstance,
          container: container,
          contentWrapper: contentWrapper,
          closeBtn: closeBtn,
          header: header,
          closeEventName: `sfcDualCanvasClose-${instanceId}`,
          closeCallback: closeCallback
        });

        console.log(`[HelloWorld] ✅ SfcDualCanvasViewer 组件实例 #${instanceId} 加载成功，总计 ${this.testSfcInstances.length} 个实例`);

      } catch (error) {
        console.error(`[HelloWorld] ❌ SfcDualCanvasViewer 组件实例 #${instanceId} 加载失败:`, error);
        alert(`SfcDualCanvasViewer 组件加载失败：\n${error.message}`);
      }
    },

    /**
     * 销毁指定的 SfcDualCanvasViewer 实例
     */
    destroyTestSfcInstance(instanceId) {
      const instanceIndex = this.testSfcInstances.findIndex(inst => inst.id === instanceId);

      if (instanceIndex === -1) {
        console.warn(`[HelloWorld] SfcDualCanvasViewer 实例 #${instanceId} 不存在`);
        return;
      }

      const instance = this.testSfcInstances[instanceIndex];

      console.log(`[HelloWorld] 销毁 SfcDualCanvasViewer 实例 #${instanceId}`);

      // 卸载 Vue 应用
      if (instance.app) {
        instance.app.unmount();
      }

      // 移除容器
      if (instance.container && instance.container.parentNode) {
        instance.container.parentNode.removeChild(instance.container);
      }

      // 移除事件监听器
      if (typeof window !== 'undefined' && instance.closeEventName) {
        window.removeEventListener(instance.closeEventName, instance.closeCallback);
      }

      // 从数组中移除
      this.testSfcInstances.splice(instanceIndex, 1);

      console.log(`[HelloWorld] SfcDualCanvasViewer 实例 #${instanceId} 已销毁，剩余 ${this.testSfcInstances.length} 个实例`);

      // 如果没有实例了，隐藏标志
      if (this.testSfcInstances.length === 0) {
        this.testSfcVisible = false;
      }
    },
    /** 创建新的 DualCanvasViewer 实例
     * ⭐ 使用预编译的 dual-canvas-viewer.mjs（与 SfcDualCanvas 相同的加载方式）
     */
    async createDualCanvasInstance() {
      console.log('[HelloWorld] 🔍 多实例按钮被点击');

      // ⭐ 防抖：检查最近是否正在创建实例
      if (this._isCreatingInstance) {
        console.log('[HelloWorld] ⚠️ 正在创建实例中，请稍候...');
        return;
      }

      console.log('[HelloWorld] ✅ 设置创建标志为 true');
      this._isCreatingInstance = true;

      // ⭐ 清除单实例，避免遮挡多实例
      if (this.dualCanvasAppInstance) {
        try {
          console.log('[HelloWorld] 🧹 检测到单实例存在，准备清除...');
          this.dualCanvasAppInstance.unmount();
          this.dualCanvasAppInstance = null;
          this.dualCanvasApp = null;
          console.log('[HelloWorld] ✅ 单实例已清除，为多实例腾出空间');
        } catch (error) {
          console.warn('[HelloWorld] ⚠️ 单实例清除失败:', error);
        }
      } else {
        console.log('[HelloWorld] ℹ️ 没有检测到单实例，直接创建多实例');
      }

      // ⭐ 移除单实例的容器（如果存在）
      const singleContainer = document.getElementById('dualCanvasContainer');
      if (singleContainer) {
        singleContainer.remove();
        console.log('[HelloWorld] ✅ 单实例容器已移除');
      }

      const instanceId = ++this.dualCanvasInstanceCounter;
      console.log(`[HelloWorld] 创建 DualCanvasViewer 实例 #${instanceId}（使用预编译 mjs）`);

      // 设置初始状态
      this.instanceStatuses[instanceId] = 'initializing';

      // 创建容器元素
      const container = document.createElement('div');
      container.id = `dualCanvasContainer-${instanceId}`;
      container.className = 'dual-canvas-overlay-multiple';
      // ⭐ 全屏显示，与单例模式一致
      // ⭐ z-index 必须高于单实例（99995），使用 100000 作为基数
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: ${100000 + instanceId * 100};
        background: transparent;
        pointer-events: auto;
      `;

      // ⭐ 添加一个内部内容容器
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        width: 100%;
        height: 100%;
        position: relative;
        pointer-events: auto;
      `;

      // ⭐ 创建关闭按钮（稍后添加到 container，避免被 Vue 挂载时清除）
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '× 关闭';
      closeBtn.className = 'dual-canvas-instance-close';
      closeBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: ${101500 + instanceId * 100};
        padding: 8px 16px;
        background: rgba(244, 67, 54, 0.9);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        pointer-events: auto;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      closeBtn.onclick = () => this.destroyDualCanvasInstance(instanceId);

      // ⭐ 添加容器到 DOM（先添加 wrapper，后添加关闭按钮）
      container.appendChild(contentWrapper);
      document.body.appendChild(container);

      // 添加CSS覆盖，让内部面板使用fixed定位而不是absolute
      const styleId = `dual-canvas-override-${instanceId}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        // ⭐ 由于容器现在是全屏定位，面板使用相对于视口的fixed定位
        // ⭐ z-index 必须高于单实例（99995）
        style.textContent = `
          #${container.id} .control-panel {
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            left: auto !important;
            max-height: calc(100vh - 100px) !important;
            z-index: ${101000 + instanceId * 100} !important;
            pointer-events: auto !important;
          }
          #${container.id} .control-panel * {
            pointer-events: auto !important;
          }
          #${container.id} .coordinate-panel {
            position: fixed !important;
            top: 80px !important;
            left: 20px !important;
            max-height: calc(100vh - 100px) !important;
            z-index: ${101000 + instanceId * 100} !important;
            pointer-events: auto !important;
          }
          #${container.id} .coordinate-panel * {
            pointer-events: auto !important;
          }
          #${container.id} .layer-container {
            pointer-events: auto !important;
          }
          #${container.id} canvas {
            pointer-events: auto !important;
          }
        `;
        document.head.appendChild(style);
      }

      // ⭐ 使用预编译的 dual-canvas-viewer.mjs（与 TestSfc 相同的加载方式）
      this.$nextTick(async () => {
        try {
          // 检查 vue3-sfc-loader 是否可用
          if (typeof window === 'undefined' || !window['vue3-sfc-loader']) {
            console.error('[HelloWorld] vue3-sfc-loader 不可用');
            alert('DualCanvasViewer 组件加载失败：vue3-sfc-loader 不可用');
            return;
          }

          const { loadModule } = window['vueModule'] = window['vue3-sfc-loader'];
          const Vue = await import('vue');

          // ⭐ 通配符路径解析器：自动检测可用的资源路径
          // 支持多种部署场景，不依赖符号链接
          // 通配符模式：按优先级尝试不同的路径
          const resolveResourcePath = async (relativePath) => {
            // 定义通配符路径模式（按优先级）
            const pathPatterns = [
              // 1. 同级 sfcLib 目录（build:sfc-lib 编译输出）
              `./test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`,
              // 2. 符号链接路径（如果存在）
              `./test-sfc/dual-canvas-viewer-sfc/${relativePath}`,
              // 3. 绝对路径（生产环境）
              `/test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`,
              // 4. gis 子目录（通过 update-gis 复制）
              `./sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`
            ];

            // 通配符检测：尝试每个路径模式
            for (const pattern of pathPatterns) {
              try {
                // ⭐ 修复：直接使用 pattern 进行测试，因为它已经包含了完整的 relativePath
                const response = await fetch(pattern, { method: 'HEAD' });
                if (response.ok) {
                  console.log(`[HelloWorld] ✅ 通配符匹配成功: ${pattern}`);
                  return pattern;
                }
              } catch (e) {
                // 继续尝试下一个路径
              }
            }

            // 如果所有路径都失败，使用默认路径
            console.warn(`[HelloWorld] ⚠️ 所有路径模式失败，使用默认路径`);
            return `./test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`;
          };

          // 解析 CSS 和组件文件路径
          const cssPattern = await resolveResourcePath('lib/dual-canvas-viewer.css');
          const componentPattern = await resolveResourcePath('lib/dual-canvas-viewer.mjs');

          console.log(`[HelloWorld] 通配符路径解析:`, {
            css: cssPattern,
            component: componentPattern
          });

          // ⭐ 加载 CSS (修复路径：使用符号链接路径)
          // ⭐ 加载 CSS（使用通配符解析的路径）
          const loadCSS = (href) => {
            return new Promise((resolve, reject) => {
              // 检查是否已加载
              if (document.querySelector(`link[href="${href}"]`)) {
                resolve();
                return;
              }
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = href;
              link.onload = resolve;
              link.onerror = reject;
              document.head.appendChild(link);
            });
          };

          await loadCSS(cssPattern);

          // ⭐ vue3-sfc-loader 配置（简化版，Three.js 已打包进组件）
          const options = {
            moduleCache: {
              vue: Vue
            },
            getFile: async (url) => {
              console.log('[HelloWorld] 获取文件:', url);
              const res = await fetch(url, {
                cache: 'no-cache',
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              if (!res.ok) {
                throw new Error('无法加载文件: ' + url);
              }
              return await res.text();
            },
            addStyle: (content) => {
              const style = document.createElement('style');
              style.textContent = content;
              document.head.appendChild(style);
            }
          };

          // ⭐ 加载预编译的 dual-canvas-viewer.mjs（使用通配符解析的路径）
          const componentPath = componentPattern;
          console.log(`[HelloWorld] 加载预编译组件: ${componentPath}`);

          const DualCanvasViewerComponent = await loadModule(componentPath, options);

          // 创建 Vue 应用实例
          const DualCanvasApp = Vue.createApp(DualCanvasViewerComponent.default);

          // 挂载组件到 contentWrapper
          const appInstance = DualCanvasApp.mount(contentWrapper);

          console.log(`[HelloWorld] ✅ Vue 应用已挂载到 contentWrapper (实例 #${instanceId})`);

          // ⭐ 在 Vue 挂载完成后，将关闭按钮添加到 container（避免被 mount 清除）
          container.appendChild(closeBtn);
          console.log(`[HelloWorld] ✅ 关闭按钮已添加到 container (实例 #${instanceId})`);

          // ⭐ 为多实例容器添加事件处理器（支持同步到 Cesium）
          // 与单例模式一致，使用箭头函数保持 this 绑定
          container.addEventListener('mousedown', (e) => this.handleMouseDown(e));
          container.addEventListener('mousemove', (e) => this.handleMouseMove(e));
          container.addEventListener('mouseup', (e) => this.handleMouseUp(e));
          container.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
          console.log(`[HelloWorld] ✅ 鼠标事件处理器已添加到容器 (实例 #${instanceId}) - 支持同步到 Cesium`);

          // 保存实例引用
          const instance = {
            id: instanceId,
            app: DualCanvasApp,
            componentInstance: appInstance,
            container: container,
            contentWrapper: contentWrapper,
            styleElement: document.getElementById(styleId),
            cesiumLayerRegistration: null  // ⭐ 添加 Cesium 图层注册引用
          };

          // ⭐ 等待组件初始化
          setTimeout(() => {
            if (appInstance.$refs && appInstance.$refs.threeContainer && appInstance.$refs.bimContainer) {
              console.log(`[HelloWorld] ✅ 实例 #${instanceId} 初始化成功`);
              this.instanceStatuses[instanceId] = 'ready';
              this.showInstanceSuccess(instanceId);

              // ⭐ 为多实例配置 OrbitControls（禁用 damping，与单例模式一致）
              setTimeout(() => this.setupOrbitControls(), 100);

              // ⭐ 为多实例注册 Cesium 图层（与单例模式一致）
              try {
                const CesiumLayerRegister = typeof window !== 'undefined' ? window.CesiumLayerRegister : null;
                if (CesiumLayerRegister && this.cesiumViewer) {
                  const registration = CesiumLayerRegister.registerToViewport(
                    this.cesiumViewer,
                    this.$refs.cesiumContainer,
                    {
                      layerId: `cesium-instance-${instanceId}`,
                      autoSync: true
                    }
                  );

                  if (registration) {
                    console.log(`[HelloWorld] ✅ 实例 #${instanceId} Cesium 图层已注册`);
                    instance.cesiumLayerRegistration = registration;
                  }
                } else {
                  console.warn(`[HelloWorld] ⚠️ 实例 #${instanceId} 无法注册 Cesium 图层：`, {
                    hasCesiumLayerRegister: !!CesiumLayerRegister,
                    hasCesiumViewer: !!this.cesiumViewer
                  });
                }
              } catch (error) {
                console.warn(`[HelloWorld] ⚠️ 实例 #${instanceId} Cesium 图层注册失败:`, error);
              }
            } else {
              console.warn(`[HelloWorld] ⚠️ 实例 #${instanceId} 初始化可能未完成`);
            }
          }, 1000);

          // 添加到实例列表
          this.dualCanvasInstances.push(instance);

          // 更新全局实例列表
          if (typeof window !== 'undefined') {
            window.__dualCanvasViewerInstances = window.__dualCanvasViewerInstances || [];
            window.__dualCanvasViewerInstances.push(appInstance);
          }

          console.log(`[HelloWorld] ✅ 实例 #${instanceId} 创建成功`);
        } catch (error) {
          console.error(`[HelloWorld] ❌ 实例 #${instanceId} 创建失败:`, error);
          this.instanceStatuses[instanceId] = 'error';
          this.showInstanceError(instanceId, error.message);
          container.remove();
        } finally {
          // ⭐ 重置防抖标志
          console.log(`[HelloWorld] 🔓 重置防抖标志（实例 #${instanceId} 处理完成）`);
          this._isCreatingInstance = false;
        }
      });
    },

    /**
     * 销毁指定的 DualCanvasViewer 实例
     */
    destroyDualCanvasInstance(instanceId) {
      console.log(`[HelloWorld] 销毁实例 #${instanceId}`);

      const instanceIndex = this.dualCanvasInstances.findIndex(inst => inst.id === instanceId);
      if (instanceIndex === -1) {
        console.warn(`[HelloWorld] 实例 #${instanceId} 不存在`);
        return;
      }

      const instance = this.dualCanvasInstances[instanceIndex];

      // 卸载 Vue 应用
      if (instance.app && typeof instance.app.unmount === 'function') {
        instance.app.unmount();
      }

      // ⭐ 清理 Cesium 图层注册
      if (instance.cesiumLayerRegistration && typeof instance.cesiumLayerRegistration.unregister === 'function') {
        try {
          instance.cesiumLayerRegistration.unregister();
          console.log(`[HelloWorld] ✅ 实例 #${instanceId} Cesium 图层已清理`);
        } catch (error) {
          console.warn(`[HelloWorld] ⚠️ 实例 #${instanceId} Cesium 图层清理失败:`, error);
        }
      }

      // 移除CSS覆盖
      if (instance.styleElement && instance.styleElement.parentNode) {
        instance.styleElement.parentNode.removeChild(instance.styleElement);
      }

      // 断开观察器
      if (instance.observer) {
        instance.observer.disconnect();
      }

      // 移除容器
      if (instance.container) {
        instance.container.remove();
      }

      // 从列表中移除
      this.dualCanvasInstances.splice(instanceIndex, 1);

      // 更新全局实例列表
      if (typeof window !== 'undefined' && window.__dualCanvasViewerInstances) {
        const globalIndex = window.__dualCanvasViewerInstances.findIndex(
          inst => inst && inst.__instanceId__ === instanceId
        );
        if (globalIndex !== -1) {
          window.__dualCanvasViewerInstances.splice(globalIndex, 1);
        }
      }

      console.log(`[HelloWorld] ✅ 实例 #${instanceId} 已销毁`);
    },

    /**
     * 显示实例成功反馈
     */
    showInstanceSuccess(instanceId) {
      this.instanceStatuses[instanceId] = 'ready';
      console.log(`[HelloWorld] ✅ 实例 #${instanceId} 创建成功，面板应该可见`);
      // 组件内部会自己管理 UI 状态
    },

    /**
     * 显示实例错误反馈
     */
    showInstanceError(instanceId, message) {
      this.instanceStatuses[instanceId] = 'error';
      console.error(`[HelloWorld] ❌ 实例 #${instanceId} 错误:`, message);
      // 组件内部会自己管理错误状态
    },

    /**
     * 清除所有额外的实例
     */
    clearAllDualCanvasInstances() {
      console.log('[HelloWorld] 清除所有额外实例');

      const instanceIds = this.dualCanvasInstances.map(inst => inst.id);
      instanceIds.forEach(id => this.destroyDualCanvasInstance(id));

      console.log('[HelloWorld] ✅ 所有额外实例已清除');
    },

    applyPointerEvents(container) {
      const excludeSelectors = [
        // 容器和面板
        '.control-panel', '.coordinate-panel', '.dual-canvas-viewer',
        // 按钮和控件
        '.tab-button', '.slider', '.toggle-checkbox', '.transform-btn', '.action-btn',
        '.toggle-btn', '.model-selector', '.file-input', '.close-btn',
        // 标准表单元素
        'button', 'input', 'select', 'textarea', 'label',
        // 其他可能的交互元素
        '[role="button"]', '[onclick]', '[data-clickable]',
        // 滚动条
        '::-webkit-scrollbar', '::-webkit-scrollbar-thumb', '::-webkit-scrollbar-track'
      ];

      const allElements = container.querySelectorAll('*');
      allElements.forEach(el => {
        const isInteractive = excludeSelectors.some(sel => {
          try {
            return el.matches(sel);
          } catch (e) {
            return false;
          }
        });

        // 确保容器本身也有 pointer-events
        if (el === container || el.classList.contains('control-panel') ||
            el.classList.contains('coordinate-panel') || el.classList.contains('dual-canvas-viewer')) {
          el.style.pointerEvents = 'auto';
        } else if (!isInteractive) {
          el.style.pointerEvents = 'none';
        }
      });
    },

    /**
     * 修复 mercatorProjection 对象
     * dual-canvas-viewer-plugin.iife.js 中的 mercatorProjection 缺少方法
     * 需要替换为正确的 MercatorProjectionManager 实例
     */
    async fixMercatorProjection() {
      console.log('[HelloWorld] 🔧 检查并修复 mercatorProjection 对象...');

      const syncManager = this.syncManager || window.__syncManager__;
      if (!syncManager || !syncManager.mercatorProjection) {
        console.warn('[HelloWorld] ⚠️ syncManager 或 mercatorProjection 不可用');
        return;
      }

      const oldProj = syncManager.mercatorProjection;
      const hasMethods = typeof oldProj.setDualFloorHeight === 'function' && typeof oldProj.getCurrentFloorHeight === 'function';

      if (hasMethods) {
        console.log('[HelloWorld] ✅ mercatorProjection 对象正常，无需修复');
        return;
      }

      console.log('[HelloWorld] ⚠️ mercatorProjection 缺少方法，开始修复...');

      try {
        // ⭐ 使用 dual-canvas-viewer-plugin.iife.js 暴露的工具类
        const MercatorProjectionManager = typeof window !== 'undefined' ? window.MercatorProjectionManager : null;
        if (!MercatorProjectionManager) {
          throw new Error('window.MercatorProjectionManager 不可用');
        }

        // 创建新实例
        const newProj = new MercatorProjectionManager();

        // 复制旧对象的状态
        if (oldProj.floorCenterMercator) {
          newProj.floorCenterMercator = oldProj.floorCenterMercator;
        }
        if (oldProj.modelAbsoluteMercator) {
          newProj.modelAbsoluteMercator = oldProj.modelAbsoluteMercator;
        }
        if (oldProj.useLocalCoordinateSystem !== undefined) {
          newProj.useLocalCoordinateSystem = oldProj.useLocalCoordinateSystem;
        }
        if (oldProj.Cesium) {
          newProj.Cesium = oldProj.Cesium;
        }

        // 替换 syncManager 中的 mercatorProjection
        syncManager.mercatorProjection = newProj;

        // 设置全局引用
        if (typeof window !== 'undefined') {
          window.__mercatorProjectionManager__ = newProj;
        }

        console.log('[HelloWorld] ✅ mercatorProjection 已修复:', {
          有setDualFloorHeight: typeof newProj.setDualFloorHeight === 'function',
          有getCurrentFloorHeight: typeof newProj.getCurrentFloorHeight === 'function',
          有setFloorCenter: typeof newProj.setFloorCenter === 'function'
        });

        // 重新初始化地板高度面板
        this.initFloorHeightPanel();

      } catch (error) {
        console.error('[HelloWorld] ❌ 修复 mercatorProjection 失败:', error);
      }
    },

    setupOrbitControls() {
      // ⭐ 遍历所有 DualCanvasViewer 实例，配置每个实例的 OrbitControls
      if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
        setTimeout(() => this.setupOrbitControls(), 500);
        return;
      }

      window.__dualCanvasViewerInstances.forEach((dualViewer, index) => {
        if (!dualViewer || !dualViewer.camera1 || !dualViewer.controls1) {
          console.log(`[HelloWorld.setupOrbitControls] 实例 ${index + 1} 未就绪，跳过`);
          return;
        }

        console.log(`[HelloWorld.setupOrbitControls] 配置实例 ${index + 1}/${window.__dualCanvasViewerInstances.length}`);

        const { camera1, controls1, controls2 } = dualViewer;

        // 计算 panSpeed
        const cameraDistance = camera1.position.distanceTo(controls1.target);
        const cameraHeight = camera1.position.y;
        const cesiumPanFactor = 0.5;
        const threejsPanFactor = 1.0;
        const precisePanSpeed = (cesiumPanFactor / threejsPanFactor) * (cameraHeight / cameraDistance);
        const adjustedPanSpeed = precisePanSpeed * 4.0;

        // ⭐ 关键修复：禁用 damping，避免惯性滑动
        controls1.enableDamping = false;
        controls1.panSpeed = adjustedPanSpeed;
        controls1.rotateSpeed = 0.2;
        controls1.zoomSpeed = 1.0;

        // 允许大角度旋转，但限制在 170° 以避免极点翻转（gimbal flip）
        controls1.minPolarAngle = 0;
        controls1.maxPolarAngle = Math.PI * 0.944; // 约 170°，留出 10° 安全边距
        controls1.minAzimuthAngle = -Infinity;
        controls1.maxAzimuthAngle = Infinity;

        controls1.update();

        if (controls2) {
          controls2.enableDamping = false;
          controls2.panSpeed = adjustedPanSpeed;
          controls2.rotateSpeed = 0.2;
          controls2.zoomSpeed = 1.0;
          controls2.minPolarAngle = 0;
          controls2.maxPolarAngle = Math.PI * 0.944;
          controls2.minAzimuthAngle = -Infinity;
          controls2.maxAzimuthAngle = Infinity;
          controls2.update();
        }

        console.log(`[HelloWorld.setupOrbitControls] 实例 ${index + 1} 配置完成`);
      });

      // 同步到 SyncManager（使用第一个实例的参数）
      if (this.syncManager && window.__dualCanvasViewerInstances[0]) {
        const firstControls = window.__dualCanvasViewerInstances[0].controls1;
        if (firstControls) {
          this.syncManager.mouseOperationParams = this.syncManager.mouseOperationParams || {};
          this.syncManager.mouseOperationParams.panSpeed = firstControls.panSpeed;
        }
      }
    },

    getThreeCameraAndControls() {
      // 优先从全局实例获取
      if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
        const instance = window.__dualCanvasViewerInstances[0];
        if (instance.camera1 && instance.controls1) {
          return {
            camera: instance.camera1,
            controls: instance.controls1,
            controls2: instance.controls2,
            source: 'window.__dualCanvasViewerInstances[0]'
          };
        }
      }

      if (!this.dualCanvasApp) return null;

      // 尝试从 dualCanvasApp 获取
      if (this.dualCanvasApp.camera1 && this.dualCanvasApp.controls1) {
        return {
          camera: this.dualCanvasApp.camera1,
          controls: this.dualCanvasApp.controls1,
          controls2: this.dualCanvasApp.controls2,
          source: 'dualCanvasApp'
        };
      }

      return null;
    },

    // ==================== 同步方法 ====================

    syncToThreeJS(threeCameraPosition, threeTargetPosition) {
      if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
        return;
      }

      if (!this.isValidCoordinate(threeCameraPosition) || !this.isValidCoordinate(threeTargetPosition)) {
        return;
      }

      // ⭐ 关键修复：遍历所有 DualCanvasViewer 实例，而不是只处理第一个
      window.__dualCanvasViewerInstances.forEach((dualViewer, index) => {
        if (!dualViewer) return;

        console.log(`[HelloWorld.syncToThreeJS] 同步实例 ${index + 1}/${window.__dualCanvasViewerInstances.length}`);

        // 更新层1相机
        if (dualViewer.camera1 && dualViewer.controls1) {
          dualViewer.camera1.position.set(
            threeCameraPosition.x,
            threeCameraPosition.y,
            threeCameraPosition.z
          );
          dualViewer.controls1.target.set(
            threeTargetPosition.x,
            threeTargetPosition.y,
            threeTargetPosition.z
          );

          // 计算方向向量
          const direction = new THREE.Vector3(
            threeTargetPosition.x - threeCameraPosition.x,
            threeTargetPosition.y - threeCameraPosition.y,
            threeTargetPosition.z - threeCameraPosition.z
          );
          direction.normalize();

          const dummyCamera = new THREE.Camera();
          dummyCamera.position.set(0, 0, 0);
          dummyCamera.up.copy(dualViewer.camera1.up);
          dummyCamera.lookAt(direction.x, direction.y, direction.z);
          dualViewer.camera1.quaternion.copy(dummyCamera.quaternion);

          dualViewer.controls1.update();
          dualViewer.camera1.updateMatrixWorld();
        }

        // 更新层2相机
        if (dualViewer.camera2 && dualViewer.controls2) {
          dualViewer.camera2.position.copy(dualViewer.camera1.position);
          dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);
          dualViewer.camera2.up.copy(dualViewer.camera1.up);
          dualViewer.controls2.target.copy(dualViewer.controls1.target);

          dualViewer.camera2.fov = dualViewer.camera1.fov;
          dualViewer.camera2.near = dualViewer.camera1.near;
          dualViewer.camera2.far = dualViewer.camera1.far;
          dualViewer.camera2.zoom = dualViewer.camera1.zoom;
          dualViewer.camera2.updateProjectionMatrix();

          dualViewer.controls2.update();
          dualViewer.camera2.updateMatrixWorld();
        }
      });
    },

    syncToCesium(mercatorCameraPosition, mercatorTargetPosition) {
      if (!this.isValidCoordinate(mercatorCameraPosition) || !this.isValidCoordinate(mercatorTargetPosition)) {
        return;
      }

      // 检测大坐标模型
      const LARGE_MERCATOR_THRESHOLD = 25000000;
      const isLargeMercatorCoord =
        Math.abs(mercatorCameraPosition.x) > LARGE_MERCATOR_THRESHOLD ||
        Math.abs(mercatorCameraPosition.y) > LARGE_MERCATOR_THRESHOLD;

      if (isLargeMercatorCoord) {
        return;
      }

      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      // 安全的墨卡托反投影
      const safeMercatorToLatitude = (mercatorY) => {
        if (!isFinite(mercatorY) || isNaN(mercatorY)) {
          return 0;
        }

        const yRatio = mercatorY / earthRadius;
        const clampedY = Math.max(-709, Math.min(709, yRatio));

        try {
          const expValue = Math.exp(clampedY);
          const latitude = 2 * Math.atan(expValue) - Math.PI / 2;

          if (!isFinite(latitude) || isNaN(latitude)) {
            return 0;
          }

          return latitude;
        } catch (error) {
          return 0;
        }
      };

      const longitude = mercatorCameraPosition.x / earthRadius;
      const latitude = safeMercatorToLatitude(mercatorCameraPosition.y);
      const height = mercatorCameraPosition.z || 0;

      if (isNaN(longitude) || isNaN(latitude) || !isFinite(longitude) || !isFinite(latitude)) {
        return;
      }

      const cameraCartesian = this.Cesium.Cartesian3.fromRadians(
        longitude,
        latitude,
        height
      );

      this.cesiumViewer.camera.flyTo({
        destination: cameraCartesian,
        duration: 0.5
      });
    },

    syncToThreeJSFromUnified(threeState) {
      if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
        return;
      }

      window.__dualCanvasViewerInstances.forEach((dualViewer, index) => {

      // ⭐ 关键调试：记录场景容器的四元数变化
      const sceneContainerBefore = dualViewer.sceneContainer1;
      let quatBefore, posBefore;
      if (sceneContainerBefore) {
        quatBefore = sceneContainerBefore.quaternion;
        posBefore = sceneContainerBefore.position;
        console.log('[HelloWorld.syncToThreeJSFromUnified] 🔍 场景容器四元数（更新前）:', {
          位置: `(${posBefore.x.toFixed(4)}, ${posBefore.y.toFixed(4)}, ${posBefore.z.toFixed(4)})`,
          四元数: `(${quatBefore.x.toFixed(6)}, ${quatBefore.y.toFixed(6)}, ${quatBefore.z.toFixed(6)}, ${quatBefore.w.toFixed(6)})`,
          欧拉角: `Pitch: ${(Math.asin(2 * (quatBefore.w * quatBefore.y - quatBefore.x * quatBefore.z)) * 180 / Math.PI).toFixed(2)}°, Yaw: ${(Math.atan2(2 * (quatBefore.w * quatBefore.z + quatBefore.x * quatBefore.y), 1 - 2 * (quatBefore.y * quatBefore.y + quatBefore.z * quatBefore.z)) * 180 / Math.PI).toFixed(2)}°`
        });
      }

      // ⭐ 关键修复：检查是否是局部坐标系模式且地板高度接近 0
      // 当地板高度为 0 与地面叠合时，地板应该跟随 Cesium 的翻转而旋转
      const useLocalCoordSystem = this.syncManager && this.syncManager.mercatorProjection &&
                                  this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem &&
                                  this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem();

      const floorHeight = this.floorHeightPanel?.currentHeight ?? 0;
      const isFloorAtGroundLevel = Math.abs(floorHeight) < 1; // 地板高度 < 1 米视为与地面叠合

      // ⭐ 关键修复：在局部坐标系模式下，场景容器不应该旋转
      // 局部坐标系模式下，Three.js 场景固定，只有相机在移动
      // 只有在全局墨卡托坐标系模式下，才需要旋转场景容器来对齐地板
      if (useLocalCoordSystem) {
        // 局部坐标系模式：确保场景容器保持 identity 旋转
        if (sceneContainerBefore && !sceneContainerBefore.quaternion.equals(new THREE.Quaternion(0, 0, 0, 1))) {
          sceneContainerBefore.quaternion.set(0, 0, 0, 1);
          console.log('[HelloWorld.syncToThreeJSFromUnified] ⭐ 局部坐标系模式：重置场景容器旋转为 identity');
        }
      } else if (isFloorAtGroundLevel && sceneContainerBefore) {
        // 全局坐标系模式 + 地板与地面叠合：应用 Cesium 旋转到场景容器
        console.log('[HelloWorld.syncToThreeJSFromUnified] ⭐ 全局坐标系模式：地板与地面叠合，应用 Cesium 旋转到场景容器');

        // 从 Cesium 获取相机方向（已经在 threeState 中转换为 Three.js 坐标系）
        const position = new THREE.Vector3(
          threeState.position.x,
          threeState.position.y,
          threeState.position.z
        );

        const target = new THREE.Vector3(
          threeState.target.x,
          threeState.target.y,
          threeState.target.z
        );

        // 计算相机的方向向量
        const direction = new THREE.Vector3().subVectors(target, position).normalize();

        // 获取 up 向量
        let up;
        if (threeState.up && typeof threeState.up.x === 'number') {
          up = new THREE.Vector3(threeState.up.x, threeState.up.y, threeState.up.z);
        } else {
          up = new THREE.Vector3(0, 1, 0);
        }

        // 创建相机的四元数（代表 Cesium 的旋转）
        const dummyCamera = new THREE.Camera();
        dummyCamera.position.set(0, 0, 0);
        dummyCamera.up.copy(up);
        dummyCamera.lookAt(direction.x, direction.y, direction.z);
        const cameraQuaternion = dummyCamera.quaternion;

        // ⭐ 关键：场景容器应该使用相机旋转的"反向"旋转
        // 这样当地板旋转时，模型会跟随 Cesium 的视角而旋转
        const containerQuaternion = cameraQuaternion.clone().invert();

        // 应用旋转到场景容器
        sceneContainerBefore.quaternion.copy(containerQuaternion);

        console.log('[HelloWorld.syncToThreeJSFromUnified] ✅ 场景容器旋转已更新:', {
          地板高度: floorHeight.toFixed(2) + '米',
          相机方向: `(${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`,
          容器四元数: `(${containerQuaternion.x.toFixed(4)}, ${containerQuaternion.y.toFixed(4)}, ${containerQuaternion.z.toFixed(4)}, ${containerQuaternion.w.toFixed(4)})`
        });
      } else if (sceneContainerBefore) {
        // ⭐ 其他情况（全局坐标系模式 + 地板高度 > 1 米）：重置场景容器旋转为 identity
        // 这样地板不会旋转，只有相机在移动
        if (!sceneContainerBefore.quaternion.equals(new THREE.Quaternion(0, 0, 0, 1))) {
          sceneContainerBefore.quaternion.set(0, 0, 0, 1);
          console.log('[HelloWorld.syncToThreeJSFromUnified] ⭐ 全局坐标系模式：地板高度 > 1 米，重置场景容器旋转为 identity');
        }
      }

      // 更新相机位置
      if (dualViewer.camera1) {
        // 创建向量
        const position = new THREE.Vector3(
          threeState.position.x,
          threeState.position.y,
          threeState.position.z
        );

        const target = new THREE.Vector3(
          threeState.target.x,
          threeState.target.y,
          threeState.target.z
        );

        // 计算方向向量
        const direction = new THREE.Vector3().subVectors(target, position).normalize();

        // ⭐ 关键修复：检查是否是局部坐标系模式
        // 在局部坐标系模式下，Three.js 场景使用局部坐标系，相机的 up 应该是 (0, 1, 0)
        // 在全局墨卡托坐标系模式下，需要使用统一坐标系提供的 up 向量
        const useLocalCoordSystem = this.syncManager && this.syncManager.mercatorProjection &&
                                    this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem &&
                                    this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem();

        let up;
        if (useLocalCoordSystem) {
          // ⭐ 局部坐标系模式：使用 (0, 1, 0) 作为 up 向量（Three.js 局部坐标系的 Y 轴）
          up = new THREE.Vector3(0, 1, 0);
          console.log('[HelloWorld.syncToThreeJSFromUnified] 局部坐标系模式：使用 (0, 1, 0) 作为 up 向量');
        } else if (threeState.up && typeof threeState.up.x === 'number') {
          // ⭐ 全局墨卡托坐标系模式：使用统一坐标系提供的 up 向量
          up = new THREE.Vector3(threeState.up.x, threeState.up.y, threeState.up.z);
          console.log('[HelloWorld.syncToThreeJSFromUnified] 全局坐标系模式：使用统一坐标系 up 向量:', {
            up: `(${up.x.toFixed(4)}, ${up.y.toFixed(4)}, ${up.z.toFixed(4)})`
          });
        } else {
          // 降级方案：动态计算 up 向量
          const dotY = Math.abs(direction.y);
          if (dotY > 0.985) {
            const upZ = direction.y < 0 ? -1 : 1;
            up = new THREE.Vector3(0, 0, upZ);
          } else {
            up = new THREE.Vector3(0, 1, 0);
          }
        }

        // 更新相机位置和 up
        dualViewer.camera1.position.copy(position);
        dualViewer.camera1.up.copy(up);

        // 关键修复：不使用 lookAt()，因为会重新计算 up 向量
        // 使用已计算的 direction 变量来设置相机朝向
        const dummyCamera = new THREE.Camera();
        dummyCamera.position.set(0, 0, 0);
        dummyCamera.up.copy(up); // 使用传入的 up
        dummyCamera.lookAt(direction.x, direction.y, direction.z);
        dualViewer.camera1.quaternion.copy(dummyCamera.quaternion);

        // 同步到 OrbitControls 的 target
        if (dualViewer.controls1) {
          dualViewer.controls1.target.copy(target);
        }

        // 同步到第二个相机
        if (dualViewer.camera2) {
          dualViewer.camera2.position.copy(dualViewer.camera1.position);
          dualViewer.camera2.up.copy(dualViewer.camera1.up);
          dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);

          if (dualViewer.controls2) {
            dualViewer.controls2.target.copy(target);
          }
        }

        // ⭐ 关键调试：记录更新后的场景容器四元数
        if (sceneContainerBefore) {
          const quatAfter = sceneContainerBefore.quaternion;
          const posAfter = sceneContainerBefore.position;
          console.log('[HelloWorld.syncToThreeJSFromUnified] 🔍 场景容器状态（更新后）:', {
            位置: `(${posAfter.x.toFixed(4)}, ${posAfter.y.toFixed(4)}, ${posAfter.z.toFixed(4)})`,
            四元数: `(${quatAfter.x.toFixed(6)}, ${quatAfter.y.toFixed(6)}, ${quatAfter.z.toFixed(6)}, ${quatAfter.w.toFixed(6)})`,
            欧拉角: `Pitch: ${(Math.asin(2 * (quatAfter.w * quatAfter.y - quatAfter.x * quatAfter.z)) * 180 / Math.PI).toFixed(2)}°, Yaw: ${(Math.atan2(2 * (quatAfter.w * quatAfter.z + quatAfter.x * quatAfter.y), 1 - 2 * (quatAfter.y * quatAfter.y + quatAfter.z * quatAfter.z)) * 180 / Math.PI).toFixed(2)}°`,
            是否变化: quatBefore.x !== quatAfter.x || quatBefore.y !== quatAfter.y || quatBefore.z !== quatAfter.z || quatBefore.w !== quatAfter.w
          });
        }
      }
    });
    },

    // ==================== 验证方法 ====================

    isValidCoordinate(coord) {
      if (!coord) return false;

      const { x, y, z } = coord;
      const isValidX = typeof x === 'number' && !isNaN(x) && isFinite(x);
      const isValidY = typeof y === 'number' && !isNaN(y) && isFinite(y);
      const isValidZ = typeof z === 'number' && !isNaN(z) && isFinite(z);

      return isValidX && isValidY && isValidZ;
    },

    // ==================== 鼠标事件处理 ====================

    getMappedButton(originalButton) {
      if (originalButton === 0) return 1; // 左键 → 中键(旋转)
      if (originalButton === 2) return 0; // 右键 → 左键(平移)
      return originalButton;
    },

    handleMouseDown(event) {
      // 检查是否是交互元素
      const target = event.target;
      const interactiveSelectors = [
        '.control-panel', '.coordinate-panel', '.tab-button',
        '.slider', '.toggle-checkbox', '.transform-btn', '.action-btn',
        '.toggle-btn', '.model-selector', '.file-input',
        'button', 'input', 'select', 'textarea'
      ];
      const isInteractive = interactiveSelectors.some(sel => target.matches(sel) || target.closest(sel));

      if (isInteractive) return;

      // 只处理左键和右键
      if (event.button !== 0 && event.button !== 2) return;

      const mappedButton = this.getMappedButton(event.button);

      this.mouseState = {
        isDown: true,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        mappedButton: mappedButton
      };

      // 确定操作类型
      if (mappedButton === 1) {
        this.currentOperation = 'rotate';
        // ⭐ 初始化左键翻转状态（记录翻转前的状态）
        this.initLeftFlipState();
      } else if (mappedButton === 0) {
        this.currentOperation = 'pan';
      }

      if (this.syncManager && this.syncManager.operationState) {
        this.syncManager.operationState = {
          isDragging: true,
          operationType: this.currentOperation,
          lastMousePos: { x: event.clientX, y: event.clientY },
          operationStartTime: Date.now()
        };
      }

      // 检查是否使用局部墨卡托坐标系
      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      let useLocalCoordSystem = false;
      if (this.syncManager && this.syncManager.mercatorProjection) {
        useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
      }

      // ⭐ 关键修复：先检查局部坐标系模式，避免被统一坐标系模式覆盖
      if (useLocalCoordSystem) {
        // ⭐ 局部墨卡托坐标系模式：由 SyncManager 处理，但允许 OrbitControls 工作
        console.log('[HelloWorld] 局部墨卡托坐标系模式：由 SyncManager 处理，允许 OrbitControls 响应');

        // 立即设置 isUserDragging 标志
        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(true);
        }

        // 禁用 Cesium 的相机控制器
        if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
          this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = false;
        }

        // ⭐ 关键修复：禁用 OrbitControls 的右键平移，避免与 SyncManager 冲突
        // OrbitControls 的左键旋转保持启用（翻转功能需要）
        if (dualViewer) {
          if (dualViewer.controls1) {
            dualViewer.controls1.enabled = true;
            // 禁用右键平移，只保留左键旋转和中键缩放
            dualViewer.controls1.enablePan = false;
          }
          if (dualViewer.controls2) {
            dualViewer.controls2.enabled = true;
            dualViewer.controls2.enablePan = false;
          }
          dualViewer.eventLayerDisabled = false;
        }
      } else if (this.unifiedProjectionInitialized && this.syncManager) {
        // ⭐ 关键修复：检查是否有模型加载
        // 未加载模型时，让 Cesium 自己控制相机，不使用 SyncManager
        const hasModels = dualViewer && dualViewer.totalModelCount && dualViewer.totalModelCount > 0;

        if (!hasModels) {
          // 未加载模型：允许 Cesium 自己控制相机
          console.log('[HelloWorld] 统一坐标系模式但未加载模型：允许 Cesium 控制相机', {
            totalModelCount: dualViewer?.totalModelCount || 0
          });

          // 不阻止事件，让 Cesium 处理
          // 不禁用 Cesium 相机控制器
          if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
            this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = true;
          }

          // 禁用 dual controls，避免与 Cesium 冲突
          if (dualViewer) {
            if (dualViewer.controls1) dualViewer.controls1.enabled = false;
            if (dualViewer.controls2) dualViewer.controls2.enabled = false;
            dualViewer.eventLayerDisabled = true;
          }
          return;
        }

        // 已加载模型：由 SyncManager 处理事件
        console.log('[HelloWorld] 统一坐标系模式：由 SyncManager 处理，阻止事件传播');

        // 立即设置 isUserDragging 标志，防止同步脚本触发
        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(true);
        }

        // 禁用 Cesium 的相机控制器，防止其响应鼠标事件
        if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
          this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = false;
        }

        if (dualViewer) {
          if (dualViewer.controls1) dualViewer.controls1.enabled = false;
          if (dualViewer.controls2) dualViewer.controls2.enabled = false;
          dualViewer.eventLayerDisabled = true;
        }
        event.stopPropagation();
        event.preventDefault();
      } else {
        // ⭐ 非统一坐标系模式（且非局部墨卡托）：允许 OrbitControls 正常工作
        console.log('[HelloWorld] 非统一坐标系模式（且非局部墨卡托）：允许 OrbitControls 处理事件');

        // 不阻止事件传播，让 dual-canvas-viewer 的 OrbitControls 处理事件
        // 只在右键平移时特殊处理（如果需要）
        if (event.button === 2) {
          if (dualViewer) {
            if (dualViewer.controls1) dualViewer.controls1.enabled = false;
            if (dualViewer.controls2) dualViewer.controls2.enabled = false;
          }
          event.stopPropagation();
        }
      }
    },

    handleMouseMove(event) {
      this.updateCesiumCoordinatesFromMouse(event);

      if (!this.mouseState.isDown) return;

      // 检查是否使用局部墨卡托坐标系
      let useLocalCoordSystem = false;
      if (this.syncManager && this.syncManager.mercatorProjection) {
        useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
      }

      // ⭐ 关键修复：先检查局部坐标系模式，避免被统一坐标系模式覆盖
      if (useLocalCoordSystem || (this.unifiedProjectionInitialized && this.syncManager)) {
        // 调试日志：显示当前使用的模式
        if (Math.abs(event.clientX - this.mouseState.lastX) > 5 || Math.abs(event.clientY - this.mouseState.lastY) > 5) {
          console.log('[HelloWorld] 🎮 使用统一/局部坐标系模式处理鼠标操作', {
            currentOperation: this.currentOperation,
            unifiedProjectionInitialized: this.unifiedProjectionInitialized,
            hasSyncManager: !!this.syncManager,
            useLocalCoordSystem: useLocalCoordSystem
          });
        }
        this.handleMouseOperationInUnified(event);

        // ⭐ 局部墨卡托坐标系模式：由 SyncManager 管理 target，不手动旋转
        // 原因：手动旋转 OrbitControls.target 与 SyncManager.state.target 不同步
        // 导致 target 跳跃和模型翻转
        // SyncManager 会在 handleRotateInUnified 中统一管理 target 和 position

        return;
      } else {
        // 调试日志：显示为什么没有使用统一坐标系模式
        if (Math.abs(event.clientX - this.mouseState.lastX) > 5 || Math.abs(event.clientY - this.mouseState.lastY) > 5) {
          console.warn('[HelloWorld] ⚠️ 未使用统一/局部坐标系模式，进入降级模式', {
            unifiedProjectionInitialized: this.unifiedProjectionInitialized,
            hasSyncManager: !!this.syncManager,
            useLocalCoordSystem: useLocalCoordSystem,
            原因: !this.unifiedProjectionInitialized ? '统一坐标系未初始化' : !this.syncManager ? 'SyncManager 不可用' : '未知'
          });
        }
      }

      // 降级模式：左键旋转
      if (this.mouseState.mappedButton === 1) {
        if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
          const dualViewer = window.__dualCanvasViewerInstances[0];
          if (dualViewer.camera1) {
            const camera = this.cesiumViewer.camera;
            const currentPosition = this.Cesium.Cartesian3.clone(camera.position);

            const dualDirection = new THREE.Vector3();
            dualViewer.camera1.getWorldDirection(dualDirection);
            dualDirection.normalize();

            const cesiumDirection = new Cesium.Cartesian3(
              dualDirection.x,
              dualDirection.y,
              dualDirection.z
            );
            this.Cesium.Cartesian3.normalize(cesiumDirection, cesiumDirection);

            camera.direction = cesiumDirection;
            camera.right = this.Cesium.Cartesian3.cross(camera.direction, camera.up, new this.Cesium.Cartesian3());
            this.Cesium.Cartesian3.normalize(camera.right, camera.right);
            camera.up = this.Cesium.Cartesian3.cross(camera.right, camera.direction, new this.Cesium.Cartesian3());
            this.Cesium.Cartesian3.normalize(camera.up, camera.up);

            camera.position = currentPosition;
          }
        }
        return;
      }

      // 右键平移：手动处理同步
      const deltaX = event.clientX - this.mouseState.lastX;
      const deltaY = event.clientY - this.mouseState.lastY;

      this.mouseState.lastX = event.clientX;
      this.mouseState.lastY = event.clientY;

      if (this.cesiumViewer && this.cesiumViewer.camera && this.mouseState.mappedButton === 0) {
        const camera = this.cesiumViewer.camera;
        const canvas = this.cesiumViewer.scene.canvas;
        const canvasWidth = canvas.clientWidth;
        const height = camera.positionCartographic.height;
        const fov = camera.frustum.fov;

        const metersPerPixel = (2 * height * Math.tan(fov / 2)) / canvasWidth;

        camera.moveRight(-deltaX * metersPerPixel);
        camera.moveUp(deltaY * metersPerPixel);

        this.syncThreeCameraDuringDrag();
      }

      if (this.mouseState.mappedButton === 0) {
        event.stopPropagation();
      }
    },

    handleMouseOperationInUnified(event) {
      const deltaX = event.clientX - this.mouseState.lastX;
      const deltaY = event.clientY - this.mouseState.lastY;

      this.mouseState.lastX = event.clientX;
      this.mouseState.lastY = event.clientY;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        return;
      }

      // 只在旋转操作时检测相机翻转，且只在开始时检测一次
      if (this.currentOperation === 'rotate' && !this._flipDetectionDone) {
        const camera = this.cesiumViewer.camera;
        if (camera && camera.position && camera.direction) {
          const Cesium = this.Cesium;
          const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;

          try {
            const cartographic = ellipsoid.cartesianToCartographic(camera.position);
            const isUnderground = cartographic.height < 0;
            const isLookingDown = camera.direction.y < 0;

            // 初始化或更新地下状态追踪
            if (this._isUnderground === undefined) {
              this._isUnderground = isUnderground;
            }

            // 地上模式：相机在地面上且向下看
            const isAboveGroundMode = !isUnderground && isLookingDown;
            // 地下模式：相机在地下
            const isBelowGroundMode = isUnderground;

            // 只在地上模式时检查状态一致性
            // 地下模式完全信任统一坐标系，不进行额外检查
            let isInconsistentState = false;
            if (isAboveGroundMode) {
              // ⭐ 添加保护：访问 unifiedCameraState 前检查
              try {
                const state = this.syncManager.unifiedCameraState;
                if (state && state.position) {
                  const currentStateY = state.position.y;
                  isInconsistentState = currentStateY < -100;
                }
              } catch (error) {
                console.warn('[HelloWorld] 检查 unifiedCameraState 失败（已忽略）:', error);
              }
            }

            if (isInconsistentState) {
              console.log('[HelloWorld] 地上模式检测到状态不一致，重新初始化统一坐标系', {
                isUnderground,
                isLookingDown,
                isAboveGroundMode,
                isBelowGroundMode,
                currentStateY: this.syncManager.unifiedCameraState?.position?.y
              });
              // ⭐ 添加保护：initFromCesium 调用
              try {
                if (this.syncManager && typeof this.syncManager.initFromCesium === 'function') {
                  this.syncManager.initFromCesium(camera, this.cesiumViewer.scene);
                }
              } catch (error) {
                console.warn('[HelloWorld] initFromCesium 调用失败（已忽略，不影响平移）:', error);
              }
            }

            // 标记已检测，避免重复检测
            this._flipDetectionDone = true;
          } catch (error) {
            // 忽略错误
          }
        }
      }

      if (this.currentOperation === 'rotate') {
        // === 左键旋转：在统一坐标系中处理 ===
        console.log('[HelloWorld] 统一坐标系处理旋转:', { deltaX, deltaY });

        // 1. 在统一坐标系中更新方向
        this.syncManager.handleRotateInUnified(deltaX, deltaY);

        // 2. 同步到 Cesium（考虑球面曲率）
        this.syncManager.syncUnifiedToCesium(
          this.cesiumViewer.camera,
          this.cesiumViewer.scene
        );

        // 3. 同步到 Three.js（直接映射）
        const threeState = this.syncManager.syncUnifiedToThree();

        // 4. 更新 dual-canvas-viewer 相机
        this.syncToThreeJSFromUnified(threeState);

        // ⭐ 检查是否在局部墨卡托坐标系模式
        const dualViewer = window.__dualCanvasViewerInstances?.[0];
        let useLocalCoordSystem = false;
        if (this.syncManager && this.syncManager.mercatorProjection) {
          useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
        }

        // ⭐ 只在非局部墨卡托坐标系模式下阻止事件传播
        if (!useLocalCoordSystem) {
          // 统一坐标系模式：阻止事件传播
          event.stopPropagation();
          event.preventDefault();
        } else {
          // ⭐ 局部墨卡托坐标系模式：不阻止事件，手动触发 OrbitControls 更新
          console.log('[HelloWorld] 局部墨卡托坐标系模式：手动触发 OrbitControls 更新');

          // 手动更新 controls 的状态，让它基于最新的 target 工作
          if (dualViewer && dualViewer.controls1) {
            // 确保 controls 基于最新的 target
            dualViewer.controls1.update();

            // ⚠️ 修复：不手动触发 change 事件，避免 "Cannot set property target" 错误
            // OrbitControls 的 update() 方法会自动处理状态更新
            // 如果需要监听变化，应该监听 controls 的 'change' 事件而不是手动触发
          }
        }
      } else if (this.currentOperation === 'pan') {
        // === 右键平移：在统一坐标系中处理 ===
        console.log('[HelloWorld] 统一坐标系处理平移:', { deltaX, deltaY });

        // ⭐ 检查是否在局部墨卡托坐标系模式
        let useLocalCoordSystem = false;
        if (this.syncManager && this.syncManager.mercatorProjection) {
          useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
        }

        // 1. 计算每像素米数
        const camera = this.cesiumViewer.camera;
        const canvas = this.cesiumViewer.scene.canvas;
        const fov = camera.frustum.fov || Math.PI / 4;

        // ⭐ 关键修复：在局部坐标系模式下，从 unifiedCameraState 读取高度
        // 而不是从 Cesium 相机读取，避免同步错误导致的循环问题
        let height;
        if (useLocalCoordSystem && this.syncManager && this.syncManager.unifiedCameraState) {
          // 局部坐标系模式：使用 unifiedCameraState 的高度（这是可靠的数据源）
          height = this.syncManager.unifiedCameraState.height || 500;
        } else {
          // 非局部坐标系模式：从 Cesium 相机读取高度
          height = camera.positionCartographic.height;
        }

        // ⚠️ 关键修复：确保 metersPerPixel 是正数
        // 在某些情况下（特别是局部坐标系模式），Cesium 相机的 frustum.fov 可能是负数
        // 使用 Math.abs 确保 metersPerPixel 为正，并添加最小值保护
        let metersPerPixel = (2 * height * Math.tan(Math.abs(fov) / 2)) / canvas.clientWidth;

        // 添加合理性检查和范围限制
        if (!isFinite(metersPerPixel) || metersPerPixel <= 0) {
          // 降级计算：使用相机高度估算
          metersPerPixel = height / canvas.clientWidth;
        }

        // 限制在合理范围内（0.01 到 100 米/像素）
        metersPerPixel = Math.max(0.01, Math.min(100, Math.abs(metersPerPixel)));

        // ⚠️ 调试日志：调整阈值以减少误报
        // 在局部坐标系模式下，当相机高度较低（如100米）且屏幕分辨率较高时，metersPerPixel 可能小于 0.05
        if (metersPerPixel > 10 || metersPerPixel < 0.01) {
          console.warn('[HelloWorld] metersPerPixel 值异常:', {
            metersPerPixel: metersPerPixel.toFixed(4),
            height: height.toFixed(2),
            fov: fov.toFixed(4),
            fovRadians: (Math.abs(fov) / 2).toFixed(4),
            tanFov: Math.tan(Math.abs(fov) / 2).toFixed(4),
            canvasWidth: canvas.clientWidth,
            说明: '正常范围内，无需担心'
          });
        }

        // 2. 在统一坐标系中更新位置
        this.syncManager.handlePanInUnified(deltaX, deltaY, metersPerPixel);

        // 3. 同步到 Cesium
        this.syncManager.syncUnifiedToCesium(
          this.cesiumViewer.camera,
          this.cesiumViewer.scene
        );

        // ⭐ 修复校准时序问题：在 syncUnifiedToCesium 之后记录平移测量数据
        // 此时 Cesium 相机已更新，可以正确测量移动距离
        if (this.syncManager._recordPanMeasurementAfterSync) {
          this.syncManager._recordPanMeasurementAfterSync();
        }

        // 4. 同步到 Three.js
        const threeState = this.syncManager.syncUnifiedToThree();
        this.syncToThreeJSFromUnified(threeState);

        // ⭐ 关键修复：局部坐标系模式下，必须阻止 OrbitControls 干扰校准倍数
        //
        // 问题分析：
        // - SyncManager 使用校准倍数计算 Dual 的平移
        // - OrbitControls 也在响应鼠标移动（无校准倍数）
        // - 两者冲突导致校准倍数失效
        //
        // 解决方案：在局部坐标系模式下，阻止 OrbitControls 响应平移事件
        // 让 SyncManager 完全控制 Dual 的相机移动
        event.stopPropagation();
        event.preventDefault();

        if (useLocalCoordSystem) {
          console.log('[HelloWorld] 局部墨卡托坐标系模式：阻止 OrbitControls 响应，由 SyncManager 完全控制平移');
        }
      }
    },

    /**
     * 原有ENU旋转方法（作为地心旋转的回退方案）
     * @private
     */
    _applyLegacyENURotation(sceneContainer1, sceneContainer2, deltaX, deltaY) {
      if (!sceneContainer1 || !sceneContainer2) return;

      try {
        // 计算旋转角度（基于鼠标移动）
        const rotateSpeed = 0.005;
        const rotationX = deltaX * rotateSpeed; // 绕 X 轴旋转（俯仰）
        const rotationY = deltaY * rotateSpeed; // 绕 Y 轴旋转（偏航）

        // 创建旋转四元数
        const quatX = new THREE.Quaternion();
        quatX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotationX);

        const quatY = new THREE.Quaternion();
        quatY.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rotationY); // 注意：Y轴旋转方向相反

        // 组合旋转（四元数乘法顺序很重要）
        const combinedRotation = new THREE.Quaternion();
        combinedRotation.multiplyQuaternions(quatY, quatX, combinedRotation);

        // 应用旋转到 Three.js 场景容器
        sceneContainer1.quaternion.multiplyQuaternions(combinedRotation, sceneContainer1.quaternion);
        sceneContainer1.quaternion.normalize();
        sceneContainer1.updateMatrixWorld(true);

        // 同步到第二个场景容器
        sceneContainer2.quaternion.copy(sceneContainer1.quaternion);
        sceneContainer2.updateMatrixWorld(true);

        console.log('[HelloWorld] 原有ENU旋转已应用', {
          rotationX: rotationX.toFixed(4),
          rotationY: rotationY.toFixed(4)
        });
      } catch (error) {
        console.warn('[HelloWorld] 原有ENU旋转失败:', error);
      }
    },

    syncThreeCameraDuringDrag() {
      if (!window.__syncManager__) return;

      const Cesium = this.Cesium;
      const camera = this.cesiumViewer.camera;
      const scene = this.cesiumViewer.scene;
      const syncManager = window.__syncManager__;

      if (!Cesium || !camera || !syncManager) return;

      try {
        const cameraPosition = camera.position;
        const ellipsoid = scene.globe.ellipsoid;
        const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);
        const earthRadius = ellipsoid.maximumRadius || 6378137.0;

        const mercatorPosition = {
          x: cartographic.longitude * earthRadius,
          y: Math.log(Math.tan(Math.PI / 4 + cartographic.latitude / 2)) * earthRadius,
          z: cartographic.height
        };

        const targetCartographic = Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );
        const targetMercator = {
          x: targetCartographic.longitude * earthRadius,
          y: Math.log(Math.tan(Math.PI / 4 + targetCartographic.latitude / 2)) * earthRadius,
          z: 0
        };

        const threeCameraPosition = syncManager.mercatorToThree(
          mercatorPosition.x,
          mercatorPosition.y,
          mercatorPosition.z
        );
        const threeTargetPosition = syncManager.mercatorToThree(
          targetMercator.x,
          targetMercator.y,
          targetMercator.z
        );

        if (!this.isValidCoordinate(threeCameraPosition) || !this.isValidCoordinate(threeTargetPosition)) {
          return;
        }

        if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
          const dualViewer = window.__dualCanvasViewerInstances[0];

          if (dualViewer.camera1 && dualViewer.controls1) {
            const deltaX = threeCameraPosition.x - dualViewer.camera1.position.x;
            const deltaY = threeCameraPosition.y - dualViewer.camera1.position.y;
            const deltaZ = threeCameraPosition.z - dualViewer.camera1.position.z;

            dualViewer.camera1.position.set(
              threeCameraPosition.x,
              threeCameraPosition.y,
              threeCameraPosition.z
            );

            dualViewer.controls1.target.set(
              dualViewer.controls1.target.x + deltaX,
              dualViewer.controls1.target.y + deltaY,
              dualViewer.controls1.target.z + deltaZ
            );

            dualViewer.camera1.updateMatrixWorld();
          }

          if (dualViewer.camera2) {
            dualViewer.camera2.position.copy(dualViewer.camera1.position);
            dualViewer.camera2.updateMatrixWorld();

            dualViewer.camera2.fov = dualViewer.camera1.fov;
            dualViewer.camera2.near = dualViewer.camera1.near;
            dualViewer.camera2.far = dualViewer.camera1.far;
            dualViewer.camera2.zoom = dualViewer.camera1.zoom;
            dualViewer.camera2.updateProjectionMatrix();
          }
        }
      } catch (error) {
        // 静默处理错误
      }
    },

    handleMouseUp(event) {
      if (!this.mouseState.isDown) return;

      // ⭐ 关键诊断：平移完成后检查场景容器四元数
      const dualViewer = window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances[0];
      if (dualViewer && dualViewer.sceneContainer1 && this.currentOperation === 'pan') {
        const quat = dualViewer.sceneContainer1.quaternion;
        const pos = dualViewer.sceneContainer1.position;
        console.log('[HelloWorld.handleMouseUp] 🔍 平移结束 - 场景容器状态:', {
          位置: `(${pos.x.toFixed(4)}, ${pos.y.toFixed(4)}, ${pos.z.toFixed(4)})`,
          四元数: `(${quat.x.toFixed(6)}, ${quat.y.toFixed(6)}, ${quat.z.toFixed(6)}, ${quat.w.toFixed(6)})`,
          欧拉角: `Pitch: ${(Math.asin(2 * (quat.w * quat.y - quat.x * quat.z)) * 180 / Math.PI).toFixed(2)}°`,
          包含对象数: dualViewer.sceneContainer1.children.length
        });
      }

      // 重置翻转检测标志
      this._flipDetectionDone = false;

      // 清理操作状态
      if (this.syncManager && this.syncManager.operationState) {
        this.syncManager.operationState.isDragging = false;
        this.syncManager.operationState.operationType = null;
      }

      const isPanOperation = this.currentOperation === 'pan';
      const isRotateOperation = this.currentOperation === 'rotate';

      if (isPanOperation) {
        // 右键平移结束
        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setBlockSyncUntil) {
          window.cesiumDualSyncV2.setBlockSyncUntil(Date.now() + 1500);
        }

        if (this.syncManager) {
          this.syncManager.disableThreeToCesiumSync = true;
          setTimeout(() => {
            this.syncManager.disableThreeToCesiumSync = false;
          }, 1500);
        }

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.trigger) {
          window.cesiumDualSyncV2.trigger();
        }

        // 重新启用 controls
        if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
          const dualViewer = window.__dualCanvasViewerInstances[0];
          if (dualViewer.controls1) {
            dualViewer.controls1.enabled = true;
            dualViewer.controls1.enablePan = true;
          }
          if (dualViewer.controls2) {
            dualViewer.controls2.enabled = true;
            dualViewer.controls2.enablePan = true;
          }

          // 重新启用 DualCanvasViewer 的事件层
          dualViewer.eventLayerDisabled = false;
        }

        // 重新启用 Cesium 相机控制器
        if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
          this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = true;
        }

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(false, false, true);
        }

        event.stopPropagation();

      } else if (isRotateOperation) {
        // 左键旋转结束
        // 检查是否使用局部墨卡托坐标系
        let useLocalCoordSystem = false;
        if (this.syncManager && this.syncManager.mercatorProjection) {
          useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
        }

        // ⭐ 关键修复：先检查局部坐标系模式，避免被统一坐标系模式覆盖
        if (useLocalCoordSystem) {
          // ⭐ 局部墨卡托坐标系模式：controls 从未被禁用，无需重新启用
          console.log('[HelloWorld] 局部墨卡托坐标系模式：OrbitControls 一直保持启用');

          // 只重新启用 Cesium 相机控制器
          if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
            this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = true;
          }
        } else if (this.unifiedProjectionInitialized) {
          // 统一坐标系模式：重新启用 controls
          if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
            const dualViewer = window.__dualCanvasViewerInstances[0];
            if (dualViewer.controls1) dualViewer.controls1.enabled = true;
            if (dualViewer.controls2) dualViewer.controls2.enabled = true;

            // 重新启用 DualCanvasViewer 的事件层
            dualViewer.eventLayerDisabled = false;
          }

          // 重新启用 Cesium 相机控制器
          if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
            this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = true;
          }
        }

        // ⭐ 应用左键翻转同步（计算墨卡托变化量并应用到 dual 地板）
        this.applyLeftFlipSync();

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.trigger) {
          window.cesiumDualSyncV2.trigger();
        }

        if (this.syncManager) {
          this.syncManager.disableThreeToCesiumSync = true;
        }

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(false, false, true, true);
        }
      } else {
        // 其他操作
        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(false);
        }
      }

      // 重置状态
      this.mouseState.isDown = false;
      this.mouseState.mappedButton = null;
      this.currentOperation = null;
    },

    handleWheel(event) {
      // 设置滚轮操作标志
      this.isWheeling = true;

      // 检查是否使用局部墨卡托坐标系
      let useLocalCoordSystem = false;
      if (this.syncManager && this.syncManager.mercatorProjection) {
        useLocalCoordSystem = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem?.() || false;
      }

      // ⭐ 关键修复：先检查局部坐标系模式，避免被统一坐标系模式覆盖
      if (useLocalCoordSystem || (this.unifiedProjectionInitialized && this.syncManager)) {
        event.preventDefault();

        // ⭐ 关键修复：ENU模式下，不需要先同步Three.js到Cesium
        // 因为后续的syncUnifiedToCesium会覆盖这次同步，导致相机位置不一致和跳跃
        // 删除ENU模式下的预同步，直接使用统一坐标系的缩放和同步流程
        const dualViewer = window.__dualCanvasViewer || window.__dualCanvasViewerInstances?.[0];
        const isUsingENU = dualViewer?.usingENU || false;

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(true);
        }

        const deltaZoom = Math.sign(event.deltaY) * 0.1;

        // ⚠️ 使用统一入口方法，根据 useNewArchitecture 标志选择处理器
        this.syncManager.handleZoom(deltaZoom);
        this.syncManager.syncUnifiedToCesium(
          this.cesiumViewer.camera,
          this.cesiumViewer.scene
        );
        const threeState = this.syncManager.syncUnifiedToThree();
        this.syncToThreeJSFromUnified(threeState);

        // ⭐ 滚轮缩放后延迟更新屏幕中心坐标
        // 延迟执行以确保缩放完全稳定，避免在缩放过程中更新屏幕中心
        console.log('[HelloWorld.handleWheel] 🔍 局部坐标系：滚轮缩放结束，延迟更新屏幕中心');
        if (this.wheelEndTimer) {
          clearTimeout(this.wheelEndTimer);
        }

        this.wheelEndTimer = setTimeout(() => {
          this.isWheeling = false;
          console.log('[HelloWorld.handleWheel] 🔍 缩放保护结束，执行屏幕中心更新');
          this._updateScreenCenterCoords();
          if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
            window.cesiumDualSyncV2.setUserDragging(false, true);
          }
        }, 1500);

        return;
      }

      // 降级模式处理
      if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
        window.cesiumDualSyncV2.setUserDragging(true);
      }

      if (this.wheelEndTimer) {
        clearTimeout(this.wheelEndTimer);
      }

      this.wheelEndTimer = setTimeout(() => {
        this.isWheeling = false;
        console.log('[HelloWorld.handleWheel] 🔍 降级模式缩放保护结束');
        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(false, true);
        }
      }, 1500);

      // 处理 Cesium 的滚轮缩放
      if (this.cesiumViewer && this.cesiumViewer.camera) {
        const camera = this.cesiumViewer.camera;
        const isFromCanvas = event.target.tagName === 'CANVAS';

        if (isFromCanvas) {
          event.preventDefault();
          event.stopPropagation();
        }

        const height = camera.positionCartographic.height;
        const zoomPercentage = 0.02;
        const zoomStep = height * zoomPercentage;

        if (event.deltaY > 0) {
          camera.zoomOut(zoomStep);
        } else {
          camera.zoomIn(zoomStep);
        }

        this.updateMapScale();

        // ⭐ 滚轮缩放后更新屏幕中心坐标
        this._updateScreenCenterCoords();
      }
    },

    // ==================== 坐标更新方法 ====================

    updateCesiumCoordinatesFromMouse(event) {
      if (!this.cesiumViewer || !this.cesiumViewer.camera) return;

      const canvas = this.cesiumViewer.canvas;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        return;
      }

      try {
        const scene = this.cesiumViewer.scene;
        const camera = this.cesiumViewer.camera;
        const ellipsoid = scene.globe.ellipsoid;

        const cartesian = camera.pickEllipsoid(new this.Cesium.Cartesian2(x, y), ellipsoid);

        if (!cartesian || !this.Cesium.defined(cartesian)) return;

        if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z) ||
            !isFinite(cartesian.x) || !isFinite(cartesian.y) || !isFinite(cartesian.z)) {
          return;
        }

        const cartographic = ellipsoid.cartesianToCartographic(cartesian);
        if (!cartographic) return;

        if (isNaN(cartographic.longitude) || isNaN(cartographic.latitude) || isNaN(cartographic.height)) {
          return;
        }

        const mouseLongitude = this.Cesium.Math.toDegrees(cartographic.longitude);
        const mouseLatitude = this.Cesium.Math.toDegrees(cartographic.latitude);
        const mouseHeight = cartographic.height;

        const cameraCartographic = camera.positionCartographic;
        const cameraHeight = cameraCartographic.height;

        this.cesiumCoordinates.longitude = mouseLongitude.toFixed(6) + '°';
        this.cesiumCoordinates.latitude = mouseLatitude.toFixed(6) + '°';
        this.cesiumCoordinates.height = mouseHeight.toFixed(2) + ' m (地面点)';

        const mercatorProjection = new this.Cesium.WebMercatorProjection();
        const mercatorPosition = mercatorProjection.project(cartographic);

        this.cesiumCoordinates.mercatorX = mercatorPosition.x.toFixed(2);
        this.cesiumCoordinates.mercatorY = mercatorPosition.y.toFixed(2);

        this.cesiumMercatorPosition = {
          x: mercatorPosition.x,
          y: mercatorPosition.y,
          z: mouseHeight
        };

        if (this.syncManager && this.syncManager.setCesiumMouseMercator) {
          this.syncManager.setCesiumMouseMercator({
            x: mercatorPosition.x,
            y: mercatorPosition.y,
            z: mouseHeight
          });
        }

        let mouseThreeWorld = 'N/A';
        if (this.syncManager && this.syncManager.floorCenterMercator) {
          const threePosition = this.syncManager.mercatorToThree(
            mercatorPosition.x,
            mercatorPosition.y,
            mouseHeight
          );
          mouseThreeWorld = `(${threePosition.x.toFixed(2)}, ${threePosition.y.toFixed(2)}, ${threePosition.z.toFixed(2)})`;
        }

        let cameraThreeWorld = 'N/A';
        if (this.syncManager && this.syncManager.floorCenterMercator) {
          const cameraMercator = mercatorProjection.project(cameraCartographic);
          const cameraThree = this.syncManager.mercatorToThree(
            cameraMercator.x,
            cameraMercator.y,
            cameraHeight
          );
          cameraThreeWorld = `(${cameraThree.x.toFixed(2)}, ${cameraThree.y.toFixed(2)}, ${cameraThree.z.toFixed(2)})`;
        }

        // 获取 target 坐标
        let targetThreeWorld = 'N/A';
        if (this.syncManager && this.syncManager.unifiedCameraState && this.syncManager.unifiedCameraState.target) {
          const target = this.syncManager.unifiedCameraState.target;
          targetThreeWorld = `(${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)})`;
        }

        this.cesiumCoordinates.threeWorld = `(东,上,南) 鼠标:${mouseThreeWorld} | 相机:${cameraThreeWorld} | Target:${targetThreeWorld} (高度:${cameraHeight.toFixed(0)}m)`;

        // ⭐ 同时更新屏幕中心坐标（确保相机移动时屏幕中心也更新）
        this._updateScreenCenterCoords();

        if (!this._coordUpdateThrottle) {
          this._coordUpdateThrottle = setTimeout(() => {
            this._coordUpdateThrottle = null;
          }, 100);
          this.updateCoordinatePanel();
        }
      } catch (error) {
        // 静默处理错误
      }
    },

    updateCoordinatePanel() {
      // 可以在这里添加额外的逻辑来更新其他坐标相关的 UI
    },

    updateCesiumCoordinates() {
      if (!this.cesiumViewer || !this.cesiumViewer.camera) return;

      if (this._coordUpdateTimer) return;

      this._coordUpdateTimer = setTimeout(() => {
        this._coordUpdateTimer = null;
        this._updateCesiumCoordinates();
      }, 100);
    },

    _updateCesiumCoordinates() {
      const camera = this.cesiumViewer.camera;
      const position = camera.positionCartographic;

      const longitude = this.Cesium.Math.toDegrees(position.longitude);
      const latitude = this.Cesium.Math.toDegrees(position.latitude);
      const height = position.height;

      const mercatorProjection = new this.Cesium.WebMercatorProjection();
      const mercatorPosition = mercatorProjection.project(position);

      let threeWorldStr = 'N/A';
      if (this.syncManager &&
          this.syncManager.floorCenterMercator &&
          this.syncManager.mercatorToThree) {
        try {
          const threeWorld = this.syncManager.mercatorToThree(
            mercatorPosition.x,
            mercatorPosition.y,
            height
          );
          threeWorldStr = `(${threeWorld.x.toFixed(1)}, ${threeWorld.y.toFixed(1)}, ${threeWorld.z.toFixed(1)})`;
        } catch (error) {
          // 忽略错误
        }
      }

      this.cesiumCoordinates = {
        longitude: longitude.toFixed(4) + '°',
        latitude: latitude.toFixed(4) + '°',
        height: height.toFixed(0) + ' m (相机)',
        mercatorX: mercatorPosition.x.toFixed(1) + ' m',
        mercatorY: mercatorPosition.y.toFixed(1) + ' m',
        threeWorld: threeWorldStr
      };

      // 更新屏幕中心点的经纬度
      this._updateScreenCenterCoords();
    },

    /**
     * 更新屏幕中心点的Cesium经纬度
     * 使用 pickEllipsoid 计算屏幕中心像素对应的地球表面点
     */
    _updateScreenCenterCoords() {
      if (!this.cesiumViewer || !this.cesiumViewer.camera) return;

      // ⚠️ 关键修复：缩放操作期间跳过屏幕中心更新
      // 缩放时更新屏幕中心可能触发不必要的重新计算，导致地板对齐被破坏
      if (this.isWheeling) {
        console.log('[HelloWorld._updateScreenCenterCoords] ⚠️ 缩放期间跳过屏幕中心更新，避免对齐破坏');
        return;
      }

      try {
        const camera = this.cesiumViewer.camera;
        const scene = this.cesiumViewer.scene;
        const canvas = scene.canvas;

        // 获取画布中心点的屏幕坐标
        const center_x = canvas.clientWidth / 2;
        const center_y = canvas.clientHeight / 2;

        // 使用pickEllipsoid获取中心点对应的地球表面点
        const ellipsoid = scene.globe.ellipsoid;
        const cartesian = camera.pickEllipsoid(new this.Cesium.Cartesian2(center_x, center_y), ellipsoid);

        if (cartesian && this.Cesium.defined(cartesian)) {
          // 检查坐标是否有效
          if (isNaN(cartesian.x) || isNaN(cartesian.y) || isNaN(cartesian.z) ||
              !isFinite(cartesian.x) || !isFinite(cartesian.y) || !isFinite(cartesian.z)) {
            return;
          }

          const cartographic = ellipsoid.cartesianToCartographic(cartesian);
          if (!cartographic) return;

          if (isNaN(cartographic.longitude) || isNaN(cartographic.latitude) || isNaN(cartographic.height)) {
            return;
          }

          const longitude = this.Cesium.Math.toDegrees(cartographic.longitude);
          const latitude = this.Cesium.Math.toDegrees(cartographic.latitude);
          const height = cartographic.height;

          this.screenCenterCoords = {
            longitude: longitude.toFixed(6) + '°',
            latitude: latitude.toFixed(6) + '°',
            height: height.toFixed(2) + ' m'
          };
        }
      } catch (error) {
        // 静默处理错误
      }
    },

    /**
     * 注册 ENU 坐标系到虚拟视口
     * 在大坐标模型加载完成后，将ENU坐标系注册到虚拟视口管理器
     * 使坐标转换系统能够使用ENU坐标系进行计算
     * @param {Object} enuManager - ENUCoordinateManager 实例
     */
    registerENUToViewport(enuManager) {
      if (!enuManager) {
        console.warn('[HelloWorld] ENU 管理器为空，无法注册到虚拟视口');
        return false;
      }

      try {
        // 获取 DualCanvasViewer 实例
        let dualViewer = null;
        if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
          dualViewer = window.__dualCanvasViewerInstances[0];
        } else if (this.dualCanvasApp) {
          dualViewer = this.dualCanvasApp;
        }

        if (!dualViewer) {
          console.warn('[HelloWorld] DualCanvasViewer 实例不可用，无法注册ENU到虚拟视口');
          return false;
        }

        // 获取虚拟视口管理器
        const viewportManager = dualViewer.viewportManager;
        if (!viewportManager) {
          console.warn('[HelloWorld] 虚拟视口管理器不可用，无法注册ENU');
          return false;
        }

        // 将ENU管理器注册到虚拟视口管理器
        viewportManager.setENUManager(enuManager);

        // 将ENU管理器设置到全局，方便其他组件访问
        if (typeof window !== 'undefined') {
          window.__enuCoordinateManager__ = enuManager;
        }

        console.log('[HelloWorld] ✅ ENU 坐标系已注册到虚拟视口:', {
          origin: enuManager.getOriginInfo ? enuManager.getOriginInfo() : null,
          viewportManager: !!viewportManager,
          dualViewer: !!dualViewer
        });

        return true;
      } catch (error) {
        console.error('[HelloWorld] 注册ENU到虚拟视口失败:', error);
        return false;
      }
    },

    updateMapScale() {
      if (!this.cesiumViewer || !this.cesiumViewer.camera) return;

      if (this._scaleUpdateTimer) return;

      this._scaleUpdateTimer = setTimeout(() => {
        this._scaleUpdateTimer = null;
        this._updateMapScale();
      }, 100);
    },

    _updateMapScale() {
      const camera = this.cesiumViewer.camera;
      const canvas = this.cesiumViewer.scene.canvas;

      const position = camera.positionCartographic;
      const height = position.height;
      const latitude = position.latitude;

      const canvasWidth = canvas.clientWidth;
      const fov = camera.frustum.fov;

      const metersPerPixel = this.getMetersPerPixel(height, fov, canvasWidth);
      const scale = this.getStandardScale(metersPerPixel);
      this.mapScale = `1:${scale}`;
    },

    getMetersPerPixel(height, fov, canvasWidth) {
      return (2 * height * Math.tan(fov / 2)) / canvasWidth;
    },

    getStandardScale(metersPerPixel) {
      const correctedMetersPerPixel = metersPerPixel * 20;

      const standardScales = [
        10, 25, 50, 100, 250, 500,
        1000, 2500, 5000, 10000, 25000, 50000,
        100000, 250000, 500000, 1000000
      ];

      let closestScale = standardScales[0];
      let minDiff = Math.abs(correctedMetersPerPixel - closestScale);

      for (let i = 1; i < standardScales.length; i++) {
        const diff = Math.abs(correctedMetersPerPixel - standardScales[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closestScale = standardScales[i];
        }
      }

      return closestScale;
    },

    /**
     * 在 Cesium 地面位置添加黄色圆柱体标记（用于局部坐标系模式）
     * 圆柱体高度400米，底面在地面位置
     *
     * @param {number} longitude - 经度（度）
     * @param {number} latitude - 纬度（度）
     * @param {number} height - 地面高度（米），默认为0表示地表面
     *
     * 说明：
     * - 当 height = 0 时，圆柱体底部在海平面（椭球体表面）
     * - 当 height = modelAltitude 时，圆柱体底部与模型底部对齐
     * - 圆柱体中心高度 = height + cylinderHeight/2
     */
    addGroundMarkerForLocalCoord(longitude, latitude, height = 0) {
      if (!this.Cesium || !this.cesiumViewer) {
        console.warn('[HelloWorld] Cesium 未初始化，跳过地面标记');
        return;
      }

      try {
        // ⭐ 使用可配置的圆柱体高度
        const cylinderHeight = this.cylinderHeight;
        const cylinderRadius = 1;    // 圆柱体半径（米）

        // ⭐ 存储标记信息，用于后续刷新
        this.groundMarkerInfo = {
          longitude,
          latitude,
          height
        };

        // Cesium 的圆柱体是以 position 为中心点的
        // 所以 position 的高度应该是 圆柱体中心高度 = 地面高度 + 圆柱体高度/2
        const centerHeight = height + cylinderHeight / 2;

        // 计算圆柱体中心位置
        const cylinderPosition = this.Cesium.Cartesian3.fromDegrees(
          longitude,
          latitude,
          centerHeight  // 圆柱体中心高度
        );

        // 创建黄色圆柱体标记
        const cylinderEntity = this.cesiumViewer.entities.add({
          id: `ground-marker-${Date.now()}`,
          position: cylinderPosition,
          cylinder: {
            length: cylinderHeight,           // 圆柱体总高度
            topRadius: cylinderRadius,        // 顶部半径
            bottomRadius: cylinderRadius,     // 底部半径
            material: this.Cesium.Color.YELLOW.withAlpha(0.6),  // 黄色半透明
            outline: true,                    // 显示轮廓
            outlineColor: this.Cesium.Color.RED,              // 红色轮廓
            outlineWidth: 2                   // 轮廓宽度
          },
          label: {
            text: `📍 地面点 (${cylinderHeight}m)`,
            font: '16px sans-serif',
            fillColor: this.Cesium.Color.YELLOW,
            outlineColor: this.Cesium.Color.BLACK,
            outlineWidth: 2,
            style: this.Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: this.Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new this.Cesium.Cartesian2(0, -25),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });

        // ⚡ 性能优化：存储Cesium Entity到非响应式Map中
        // 注意：不能冻结Entity对象，因为Cesium需要向其添加内部属性
        this._cesiumEntities.set('groundMarker', cylinderEntity);

        console.log('[HelloWorld] ✅ 局部坐标系模式：已在 Cesium 地面添加黄色圆柱体标记', {
          经度: longitude.toFixed(8) + '°',
          纬度: latitude.toFixed(8) + '°',
          地面高度: height.toFixed(2) + 'm',
          圆柱体中心高度: centerHeight.toFixed(2) + 'm',
          圆柱体底部: height.toFixed(2) + 'm',
          圆柱体顶部: (height + cylinderHeight).toFixed(2) + 'm',
          圆柱体高度: cylinderHeight + 'm',
          圆柱体半径: cylinderRadius + 'm',
          标记ID: cylinderEntity.id,
          说明: height > 0 ? '圆柱体与模型底部对齐' : '圆柱体在海平面'
        });
      } catch (error) {
        console.error('[HelloWorld] 添加 Cesium 地面圆柱体标记失败:', error);
      }
    },

    /**
     * 在 Cesium 地面位置添加黄色圆柱体标记（使用实际地形高度）
     * 这是异步版本，会先采样地形高度，然后创建标记
     * @param {number} longitude - 经度（度）
     * @param {number} latitude - 纬度（度）
     */
    async addGroundMarkerForLocalCoordWithTerrain(longitude, latitude) {
      if (!this.Cesium || !this.cesiumViewer) {
        console.warn('[HelloWorld] Cesium 未初始化，跳过地面标记');
        return;
      }

      try {
        // 获取实际表面高度（从地形表面）
        const position = this.Cesium.Cartographic.fromRadians(
          longitude * Math.PI / 180,
          latitude * Math.PI / 180,
          0
        );

        // ⭐ sampleHeightMostDetailed 会自动采样所有场景内容
        // 包括 3D Tiles（由ObliquePhotographyPanel管理）和地形
        const heights = await this.cesiumViewer.scene.sampleHeightMostDetailed([position]);
        let actualSurfaceHeight = (heights && heights[0] !== undefined && !isNaN(heights[0])) ? heights[0] : 0;

        console.log('[HelloWorld] 📍 地形表面采样:', {
          经度: longitude.toFixed(6) + '°',
          纬度: latitude.toFixed(6) + '°',
          表面高度: actualSurfaceHeight.toFixed(2) + 'm'
        });

        // 使用实际表面高度创建标注
        this.addGroundMarkerForLocalCoord(longitude, latitude, actualSurfaceHeight);
      } catch (error) {
        console.error('[HelloWorld] 获取表面高度失败，使用默认高度0:', error);
        this.addGroundMarkerForLocalCoord(longitude, latitude, 0);
      }
    },

    /**
     * 处理圆柱体高度输入变化
     * @param {Event} event - 输入事件
     */
    onCylinderHeightChange(event) {
      const newValue = parseInt(event.target.value);
      if (isNaN(newValue) || newValue < 1) {
        console.warn('[HelloWorld] ⚠️ 无效的圆柱体高度值:', event.target.value);
        return;
      }
      this.cylinderHeight = newValue;
      console.log('[HelloWorld] 📏 圆柱体高度已更新为:', this.cylinderHeight, '米');
    },

    /**
     * 刷新圆柱体标记
     * 使用新的 cylinderHeight 值重新创建圆柱体
     */
    refreshCylinderMarker() {
      if (!this.groundMarkerInfo) {
        console.warn('[HelloWorld] ⚠️ 没有地面标记信息，无法刷新圆柱体');
        console.warn('[HelloWorld] 💡 请先加载模型，系统会自动创建地面标记');
        return;
      }

      // ⭐ 诊断：检查 Cesium 中是否有多个圆柱体实体
      const allCylinders = this.cesiumViewer.entities.values.filter(entity =>
        entity.cylinder && entity.id && entity.id.startsWith('ground-marker-')
      );
      console.warn('[HelloWorld] 🔍 诊断：当前 Cesium 中的圆柱体实体数量:', allCylinders.length);
      if (allCylinders.length > 0) {
        allCylinders.forEach((entity, index) => {
          // 获取圆柱体的实际属性（使用安全的方式）
          let positionInfo = 'N/A';
          let cylinderLength = 'N/A';
          let cylinderBottom = 'N/A';
          let cylinderTop = 'N/A';

          try {
            // 安全地获取位置信息
            const positionValue = entity.position.getValue(this.cesiumViewer.clock.currentTime);
            if (positionValue) {
              const cartographic = this.Cesium.Cartographic.fromCartesian(positionValue);
              if (cartographic) {
                const lon = this.Cesium.Math.toDegrees(cartographic.longitude);
                const lat = this.Cesium.Math.toDegrees(cartographic.latitude);
                const height = cartographic.height;
                positionInfo = `(${lon.toFixed(6)}°, ${lat.toFixed(6)}°, ${height.toFixed(2)}m)`;

                // 获取圆柱体长度
                const lengthValue = entity.cylinder.length.getValue(this.cesiumViewer.clock.currentTime);
                if (lengthValue !== undefined && lengthValue !== null) {
                  cylinderLength = lengthValue + 'm';
                  cylinderBottom = (height - lengthValue / 2).toFixed(2) + 'm';
                  cylinderTop = (height + lengthValue / 2).toFixed(2) + 'm';
                }
              }
            }
          } catch (error) {
            positionInfo = 'Error: ' + error.message;
          }

          console.warn(`[HelloWorld] 圆柱体 #${index + 1} 详细信息:`, {
            id: entity.id,
            位置: positionInfo,
            cylinder长度: cylinderLength,
            计算的圆柱体底部: cylinderBottom,
            计算的圆柱体顶部: cylinderTop
          });
        });
      }

      // ⭐ 移除旧的圆柱体标记
      const groundMarker = this._cesiumEntities.get('groundMarker');
      if (groundMarker) {
        this.cesiumViewer.entities.remove(groundMarker);
        this._cesiumEntities.delete('groundMarker');
        console.log('[HelloWorld] 🗑️ 已移除旧的圆柱体标记');
      }

      // ⭐ 使用新的高度重新创建圆柱体
      const { longitude, latitude, height } = this.groundMarkerInfo;
      this.addGroundMarkerForLocalCoord(longitude, latitude, height);

      console.log('[HelloWorld] ✅ 圆柱体标记已刷新', {
        新高度: this.cylinderHeight + '米',
        经度: longitude.toFixed(8) + '°',
        纬度: latitude.toFixed(8) + '°',
        地面高度: height.toFixed(2) + 'm',
        圆柱体底部: height + 'm',
        圆柱体顶部: (height + this.cylinderHeight) + 'm',
        警告: this.cylinderHeight > 569 ? '⚠️ 当前高度 > 569，可能触发视觉叠加问题' : '✓ 高度正常'
      });

      // ⭐ 诊断：检查 dual 渲染器中的 anchorContainer 位置
      if (this.syncManager && this.syncManager.dualCanvasViewer) {
        const dualViewer = this.syncManager.dualCanvasViewer;
        if (dualViewer.anchorContainer1) {
          const anchorY = dualViewer.anchorContainer1.position.y;
          console.warn('[HelloWorld] 🔍 Dual 渲染器 anchorContainer1 位置:', {
            Y: anchorY.toFixed(2) + '米',
            说明: '红色球体在此容器中的 (0, 0, 0) 位置',
            红色球体世界Y: anchorY.toFixed(2) + '米',
            Cesium圆柱体底部: height.toFixed(2) + 'm',
            Cesium圆柱体顶部: (height + this.cylinderHeight).toFixed(2) + 'm',
            重叠警告: anchorY >= height && anchorY <= (height + this.cylinderHeight) ?
              '⚠️ 红色球体与 Cesium 圆柱体在垂直方向重叠！' :
              '✓ 无重叠'
          });

          // ⭐ 诊断：列出 dual 渲染器中的所有球体
          console.warn('[HelloWorld] 🔍 Dual 渲染器中的球体统计:');
          this._logAllSpheresInScene(dualViewer.scene1, 'scene1 (Cesium层)');
          this._logAllSpheresInScene(dualViewer.scene2, 'scene2 (BIM层)');
          if (dualViewer.anchorContainer1) {
            this._logAllSpheresInScene(dualViewer.anchorContainer1, 'anchorContainer1');
          }
        }
      } else {
        console.warn('[HelloWorld] ⚠️ syncManager 或 dualCanvasViewer 不可用，无法诊断 dual 渲染器');
      }
    },

    /**
     * 诊断：列出场景中的所有球体
     * @param {THREE.Scene} scene - Three.js 场景
     * @param {string} sceneName - 场景名称
     */
    _logAllSpheresInScene(scene, sceneName) {
      const spheres = [];
      scene.traverse((obj) => {
        if (obj.isMesh && obj.geometry && obj.geometry.type === 'SphereGeometry') {
          const worldPos = new THREE.Vector3();
          obj.getWorldPosition(worldPos);
          spheres.push({
            name: obj.name || 'unnamed',
            局部位置: `(${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`,
            世界位置: `(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)})`,
            颜色: obj.geometry.parameters ? '' : '(wireframe)'
          });
        }
      });

      if (spheres.length > 0) {
        console.warn(`[HelloWorld] ${sceneName} 中的球体:`, spheres);
      } else {
        console.log(`[HelloWorld] ${sceneName} 中没有球体`);
      }
    },

    /**
     * 同步 Cesium 和 Dual 渲染器的相机状态（用于局部坐标系模式）
     *
     * 在局部坐标系模式下，默认的相机同步被禁用了，导致 Cesium 和 Dual 的视角不一致。
     * 这个方法通过 ENU 坐标系转换来手动同步相机状态。
     *
     * 使用方法：
     * 1. 在控制台调用: window.vueInstance.$refs.hello.syncDualCamera()
     * 2. 或者绑定到某个按钮/快捷键
     */
    syncDualCamera() {
      if (!this.Cesium || !this.cesiumViewer) {
        console.warn('[HelloWorld] Cesium 未初始化');
        return;
      }

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.warn('[HelloWorld] Dual Canvas Viewer 未初始化');
        return;
      }

      const enuManager = window.__enuCoordinateManager__;
      if (!enuManager || !enuManager.isInitialized()) {
        console.warn('[HelloWorld] ENU 坐标系未初始化');
        return;
      }

      try {
        // 获取 Cesium 相机状态
        const cesiumCamera = this.cesiumViewer.camera;
        const cameraPosition = cesiumCamera.position.clone();

        // 转换到 ENU 坐标系
        const enuPos = enuManager.ecefToENU(cameraPosition);

        // 转换到局部墨卡托坐标（Dual 坐标系）
        // ENU: x=east, y=north, z=up (单位：米)
        // Dual: x=east, y=up, z=-north (单位：米)
        // 注意：在局部坐标系模式下，单位已经是米，不需要除以地球半径
        const localPos = {
          x: enuPos.x,
          y: enuPos.z,
          z: -enuPos.y
        };

        // 获取相机方向
        const heading = cesiumCamera.heading;
        const pitch = cesiumCamera.pitch;
        const roll = cesiumCamera.roll;

        console.log('[HelloWorld] 🔄 同步相机状态:', {
          Cesium位置: `(${cameraPosition.x.toFixed(0)}, ${cameraPosition.y.toFixed(0)}, ${cameraPosition.z.toFixed(0)})`,
          ENU位置: `(${enuPos.x.toFixed(1)}, ${enuPos.y.toFixed(1)}, ${enuPos.z.toFixed(1)}) 米`,
          Dual位置: `(${localPos.x.toFixed(1)}, ${localPos.y.toFixed(1)}, ${localPos.z.toFixed(1)}) 米`,
          说明: 'ENU→Dual: x保持, y→z(反向), z→y',
          方向: {
            heading: (heading * 180 / Math.PI).toFixed(1) + '°',
            pitch: (pitch * 180 / Math.PI).toFixed(1) + '°',
            roll: (roll * 180 / Math.PI).toFixed(1) + '°'
          },
          当前Dual位置: dualViewer.camera1 ? `(${dualViewer.camera1.position.x.toFixed(1)}, ${dualViewer.camera1.position.y.toFixed(1)}, ${dualViewer.camera1.position.z.toFixed(1)})` : '未初始化'
        });

        // 同步到 Dual
        if (dualViewer.camera1 && dualViewer.controls1) {
          // 先输出同步前的相机状态
          console.log('[HelloWorld] 同步前 Dual 相机:', {
            位置: `(${dualViewer.camera1.position.x.toFixed(1)}, ${dualViewer.camera1.position.y.toFixed(1)}, ${dualViewer.camera1.position.z.toFixed(1)})`,
            controlsTarget: `(${dualViewer.controls1.target.x.toFixed(1)}, ${dualViewer.controls1.target.y.toFixed(1)}, ${dualViewer.controls1.target.z.toFixed(1)})`
          });

          // 设置相机位置
          dualViewer.camera1.position.set(localPos.x, localPos.y, localPos.z);

          // 设置相机方向
          // Cesium: heading(yaw), pitch, roll
          // Three.js: 使用 lookAt 或者设置旋转
          // 方法1：使用 lookAt（更可靠）
          const lookAtPos = new THREE.Vector3(0, 15, 0); // 模型中心
          dualViewer.camera1.lookAt(lookAtPos);

          // 方法2：设置旋转（如果需要精确控制）
          // dualViewer.camera1.rotation.order = 'YXZ';
          // dualViewer.camera1.rotation.y = -heading;
          // dualViewer.camera1.rotation.x = pitch;
          // dualViewer.camera1.rotation.z = roll;

          dualViewer.camera1.updateMatrixWorld();

          // 同时更新 controls 的 target（使其指向模型中心）
          // 在局部坐标系模式下，模型中心大约在 (0, 15, 0)
          dualViewer.controls1.target.set(0, 15, 0);

          // 更新控制器
          dualViewer.controls1.update();

          console.log('[HelloWorld] 同步后 Dual 相机:', {
            位置: `(${dualViewer.camera1.position.x.toFixed(1)}, ${dualViewer.camera1.position.y.toFixed(1)}, ${dualViewer.camera1.position.z.toFixed(1)})`,
            controlsTarget: `(${dualViewer.controls1.target.x.toFixed(1)}, ${dualViewer.controls1.target.y.toFixed(1)}, ${dualViewer.controls1.target.z.toFixed(1)})`
          });

          console.log('[HelloWorld] ✅ 相机状态已同步到 Dual');
        }
      } catch (error) {
        console.error('[HelloWorld] 同步相机失败:', error);
      }
    },

    /**
     * 诊断模型 - 检查红球和模型的实际位置、旋转状态（倒置诊断）
     */
    diagnoseModels() {
      console.log('[HelloWorld] 🔍 开始诊断模型（高度 + 倒置）...');
      console.log('%c=== Dual 渲染器位置诊断 ===', 'color: #4ade80; font-weight: bold; font-size: 14px');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }

      // 1. 检查根场景位置
      console.log('%c--- 1. 根场景 (scene1) ---', 'color: #60a5fa; font-weight: bold');
      console.log('scene1 位置:', {
        x: dualViewer.scene1.position.x,
        y: dualViewer.scene1.position.y,
        z: dualViewer.scene1.position.z
      });

      // 2. 检查场景容器位置
      if (dualViewer.sceneContainer1) {
        const containerWorldPos = new THREE.Vector3();
        dualViewer.sceneContainer1.getWorldPosition(containerWorldPos);
        console.log('%c--- 2. 场景容器 (sceneContainer1) ---', 'color: #60a5fa; font-weight: bold');
        console.log('局部坐标:', {
          x: dualViewer.sceneContainer1.position.x.toFixed(2),
          y: dualViewer.sceneContainer1.position.y.toFixed(2),
          z: dualViewer.sceneContainer1.position.z.toFixed(2)
        });
        console.log('世界坐标:', {
          x: containerWorldPos.x.toFixed(2),
          y: containerWorldPos.y.toFixed(2),
          z: containerWorldPos.z.toFixed(2)
        });
      }

      // 3. 检查锚点容器位置
      if (dualViewer.anchorContainer1) {
        const anchorWorldPos = new THREE.Vector3();
        dualViewer.anchorContainer1.getWorldPosition(anchorWorldPos);
        console.log('%c--- 3. 锚点容器 (anchorContainer1) ---', 'color: #60a5fa; font-weight: bold');
        console.log('局部坐标:', {
          x: dualViewer.anchorContainer1.position.x.toFixed(2),
          y: dualViewer.anchorContainer1.position.y.toFixed(2),
          z: dualViewer.anchorContainer1.position.z.toFixed(2)
        });
        console.log('世界坐标:', {
          x: anchorWorldPos.x.toFixed(2),
          y: anchorWorldPos.y.toFixed(2),
          z: anchorWorldPos.z.toFixed(2)
        });

        // 4. 检查红球位置
        let redSphereFound = false;
        dualViewer.anchorContainer1.traverse((obj) => {
          if (obj.name === 'GroundMarker_Theoretical') {
            redSphereFound = true;
            const sphereWorldPos = new THREE.Vector3();
            obj.getWorldPosition(sphereWorldPos);
            console.log('%c--- 4. 红色球体 (GroundMarker_Theoretical) ---', 'color: #f87171; font-weight: bold');
            console.log('局部坐标:', {
              x: obj.position.x.toFixed(2),
              y: obj.position.y.toFixed(2),
              z: obj.position.z.toFixed(2)
            });
            console.log('世界坐标 Y:', sphereWorldPos.y.toFixed(2) + ' 米');
            console.log('说明: 红球应该在模型的海拔高度 (~70.36米)，但目前可能在 ' + sphereWorldPos.y.toFixed(2) + ' 米');
          }
        });

        if (!redSphereFound) {
          console.warn('[HelloWorld] ⚠️ 未找到红色球体 (GroundMarker_Theoretical)');
        }
      }

      // 5. 检查模型位置和海拔
      if (dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
        console.log('%c--- 5. 模型信息 ---', 'color: #4ade80; font-weight: bold');
        dualViewer.modelGroup1.children.forEach((model, index) => {
          const modelWorldPos = new THREE.Vector3();
          model.getWorldPosition(modelWorldPos);
          const bbox = new THREE.Box3().setFromObject(model);
          const modelAltitude = model.userData?.originalLocation?.cartographic?.height;

          console.log(`模型 ${index + 1} (${model.name || 'unnamed'}):`, {
            模型局部位置: {
              x: model.position.x.toFixed(2),
              y: model.position.y.toFixed(2),
              z: model.position.z.toFixed(2)
            },
            模型世界Y: modelWorldPos.y.toFixed(2) + ' 米',
            边界框: {
              底部Y: bbox.min.y.toFixed(2) + ' 米',
              顶部Y: bbox.max.y.toFixed(2) + ' 米',
              高度: (bbox.max.y - bbox.min.y).toFixed(2) + ' 米'
            },
            模型海拔: modelAltitude !== undefined ? modelAltitude.toFixed(2) + ' 米' : 'N/A',
            说明: modelAltitude !== undefined ?
              `模型应该在海拔 ${modelAltitude.toFixed(2)} 米` :
              '模型海拔未知'
          });
        });
      } else {
        console.warn('[HelloWorld] ⚠️ 未找到模型');
      }

      // 6. 检查相机位置
      console.log('%c--- 6. 相机位置 ---', 'color: #c084fc; font-weight: bold');
      if (dualViewer.camera1) {
        const camPos = dualViewer.camera1.position;
        console.log('Camera1 位置:', {
          x: camPos.x.toFixed(2) + ' 米',
          y: camPos.y.toFixed(2) + ' 米',
          z: camPos.z.toFixed(2) + ' 米'
        });
      }

      // 7. 检查地板高度
      console.log('%c--- 7. 地板高度 ---', 'color: #fb923c; font-weight: bold');
      const mercatorProj = dualViewer.mercatorProjection;
      if (mercatorProj && typeof mercatorProj.getCurrentFloorHeight === 'function') {
        const currentFloorHeight = mercatorProj.getCurrentFloorHeight();
        console.log('当前地板高度:', currentFloorHeight.toFixed(2) + ' 米');
      }

      // 8. 检查模型旋转（倒置诊断）
      console.log('%c--- 8. 模型旋转检查（倒置诊断） ---', 'color: #fbbf24; font-weight: bold');
      if (dualViewer.modelGroup1) {
        console.log('modelGroup1 旋转:', {
          x: dualViewer.modelGroup1.rotation.x.toFixed(4) + ` (${(dualViewer.modelGroup1.rotation.x * 180 / Math.PI).toFixed(2)}°)`,
          y: dualViewer.modelGroup1.rotation.y.toFixed(4) + ` (${(dualViewer.modelGroup1.rotation.y * 180 / Math.PI).toFixed(2)}°)`,
          z: dualViewer.modelGroup1.rotation.z.toFixed(4) + ` (${(dualViewer.modelGroup1.rotation.z * 180 / Math.PI).toFixed(2)}°)`
        });

        // 检查是否有 X 轴旋转（可能导致倒置）
        if (Math.abs(dualViewer.modelGroup1.rotation.x) > 0.01) {
          const rotXDeg = Math.abs(dualViewer.modelGroup1.rotation.x * 180 / Math.PI);
          console.warn('⚠️  检测到 modelGroup1 绕 X 轴旋转！');
          console.warn('   X 轴旋转角度:', rotXDeg.toFixed(2) + '°');

          if (rotXDeg > 170 && rotXDeg < 190) {
            console.error('❌ 严重: modelGroup1 绕 X 轴旋转约 180°，这会导致模型上下颠倒！');
            console.error('   建议: 检查模型加载代码，确认是否有代码设置了 modelGroup1.rotation.x');
          }
        }

        // 检查场景旋转
        if (dualViewer.scene1) {
          console.log('scene1 旋转:', {
            x: dualViewer.scene1.rotation.x.toFixed(4) + ` (${(dualViewer.scene1.rotation.x * 180 / Math.PI).toFixed(2)}°)`,
            y: dualViewer.scene1.rotation.y.toFixed(4) + ` (${(dualViewer.scene1.rotation.y * 180 / Math.PI).toFixed(2)}°)`,
            z: dualViewer.scene1.rotation.z.toFixed(4) + ` (${(dualViewer.scene1.rotation.z * 180 / Math.PI).toFixed(2)}°)`
          });

          if (Math.abs(dualViewer.scene1.rotation.x) > 0.01 || Math.abs(dualViewer.scene1.rotation.z) > 0.01) {
            console.warn('⚠️  scene1 有异常旋转，这可能影响所有模型');
          }
        }

        // ⭐ 新增：深度诊断 - 检查模型内部旋转和子对象
        console.log('%c--- 8.1 深度模型诊断（子对象旋转检查） ---', 'color: #f97316; font-weight: bold');
        dualViewer.modelGroup1.children.forEach((model, index) => {
          const fileName = model.userData.fileName || model.name || 'unnamed';
          console.log(`\n模型 ${index + 1}: ${fileName}`);
          console.log('--- 顶层对象 ---');
          console.log('旋转:', {
            x: model.rotation.x.toFixed(4) + ` (${(model.rotation.x * 180 / Math.PI).toFixed(2)}°)`,
            y: model.rotation.y.toFixed(4) + ` (${(model.rotation.y * 180 / Math.PI).toFixed(2)}°)`,
            z: model.rotation.z.toFixed(4) + ` (${(model.rotation.z * 180 / Math.PI).toFixed(2)}°)`
          });

          // 遍历所有子对象
          console.log('--- 子对象检查 ---');
          let meshCount = 0;
          let rotatedMeshCount = 0;
          const rotatedMeshes = [];

          model.traverse((child) => {
            if (child.isMesh) {
              meshCount++;
              const hasRotation = Math.abs(child.rotation.x) > 0.01 ||
                                 Math.abs(child.rotation.y) > 0.01 ||
                                 Math.abs(child.rotation.z) > 0.01;

              if (hasRotation) {
                rotatedMeshCount++;
                rotatedMeshes.push({
                  name: child.name || 'unnamed',
                  rotation: {
                    x: child.rotation.x.toFixed(4) + ` (${(child.rotation.x * 180 / Math.PI).toFixed(2)}°)`,
                    y: child.rotation.y.toFixed(4) + ` (${(child.rotation.y * 180 / Math.PI).toFixed(2)}°)`,
                    z: child.rotation.z.toFixed(4) + ` (${(child.rotation.z * 180 / Math.PI).toFixed(2)}°)`
                  }
                });
              }
            }
          });

          console.log(`统计: 总共 ${meshCount} 个 Mesh，其中 ${rotatedMeshCount} 个有旋转`);

          // 显示有旋转的 Mesh
          if (rotatedMeshes.length > 0) {
            console.warn(`  ⚠️  发现 ${rotatedMeshes.length} 个有旋转的子对象:`);
            rotatedMeshes.forEach((mesh, i) => {
              console.warn(`    ${i + 1}. "${mesh.name}":`, mesh.rotation);

              // 检查是否接近 180°
              const rotX = parseFloat(mesh.rotation.x.split('(')[1]);
              const rotY = parseFloat(mesh.rotation.y.split('(')[1]);
              const rotZ = parseFloat(mesh.rotation.z.split('(')[1]);

              if (Math.abs(rotX) > 170 || Math.abs(rotY) > 170 || Math.abs(rotZ) > 170) {
                console.error(`    ❌ 该子对象接近 180° 旋转，可能导致倒置！`);
              }
            });
          } else {
            console.log('  ✅ 所有子对象都没有额外旋转');
          }

          // 检查模型的 userData
          console.log('--- UserData 检查 ---');
          if (model.userData) {
            console.log('文件名:', model.userData.fileName || model.userData.filePath || 'N/A');
            console.log('是否大坐标模型:', model.userData.isLargeCoordModel || false);
            console.log('原始位置:', model.userData.originalLocation ? '存在' : '不存在');

            // 检查是否有变换矩阵
            if (model.userData.matrix) {
              console.log('变换矩阵:', model.userData.matrix);
              const euler = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().fromArray(model.userData.matrix));
              console.warn('  ⚠️  发现变换矩阵，对应的欧拉角:', {
                x: euler.x.toFixed(4) + ` (${(euler.x * 180 / Math.PI).toFixed(2)}°)`,
                y: euler.y.toFixed(4) + ` (${(euler.y * 180 / Math.PI).toFixed(2)}°)`,
                z: euler.z.toFixed(4) + ` (${(euler.z * 180 / Math.PI).toFixed(2)}°)`
              });
            }
            if (model.userData.inverseMatrix) {
              console.log('逆变换矩阵:', model.userData.inverseMatrix);
            }
          }
        });
      }

      // 9. 检查 ENU 坐标系
      console.log('%c--- 9. ENU 坐标系检查 ---', 'color: #a78bfa; font-weight: bold');
      const enuManager = window.__enuCoordinateManager__;
      if (enuManager) {
        const enuOrigin = enuManager.getOriginInfo();
        // ⭐ 修复：getOriginInfo() 返回的已经是度数，不需要再次转换
        console.log('ENU 原点信息:', {
          经度: enuOrigin.longitude.toFixed(6) + '°',
          纬度: enuOrigin.latitude.toFixed(6) + '°',
          海拔: enuOrigin.height.toFixed(2) + ' 米',
          方位角: (enuOrigin.heading * 180 / Math.PI).toFixed(2) + '°'
        });

        // 检查红球与 ENU 原点的海拔差异
        let redSphereY = null;
        if (dualViewer.anchorContainer1) {
          dualViewer.anchorContainer1.traverse((obj) => {
            if (obj.name === 'GroundMarker_Theoretical') {
              const sphereWorldPos = new THREE.Vector3();
              obj.getWorldPosition(sphereWorldPos);
              redSphereY = sphereWorldPos.y;
            }
          });
        }

        if (redSphereY !== null) {
          const altitudeDiff = Math.abs(enuOrigin.height - redSphereY);
          console.log('红球与 ENU 原点海拔对比:', {
            'ENU 原点海拔': enuOrigin.height.toFixed(2) + ' 米',
            '红球海拔': redSphereY.toFixed(2) + ' 米',
            '海拔差异': altitudeDiff.toFixed(2) + ' 米',
            '状态': altitudeDiff < 1 ? '✅ 对齐' : '❌ 未对'
          });

          if (altitudeDiff > 1) {
            console.warn('⚠️  红球与 ENU 原点海拔不一致！这可能导致坐标系错位。');
          }
        }
      } else {
        console.warn('⚠️  ENU 坐标系管理器未找到');
      }

      // 10. 深度矩阵变换诊断（新增）
      console.log('%c--- 10. 深度矩阵变换诊断 ---', 'color: #f59e0b; font-weight: bold; font-size: 13px');
      if (dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
        dualViewer.modelGroup1.children.forEach((model, index) => {
          const fileName = model.userData?.fileName || model.name || 'unnamed';
          console.log(`%c模型 ${index + 1}: ${fileName}`, 'color: #3b82f6; font-weight: bold');

          // 对象层级检查
          console.log('  --- 对象层级 ---');
          console.log('  model.parent:', model.parent?.type || 'null');
          console.log('  model.parent.parent:', model.parent?.parent?.type || 'null');

          // 世界位置 vs 本地位置
          const worldPos = new THREE.Vector3();
          model.getWorldPosition(worldPos);
          console.log('  --- 位置对比 ---');
          console.log('  世界位置 (getWorldPosition):', `x=${worldPos.x.toFixed(2)}, y=${worldPos.y.toFixed(2)}, z=${worldPos.z.toFixed(2)}`);
          console.log('  本地位置 (position):', `x=${model.position.x.toFixed(2)}, y=${model.position.y.toFixed(2)}, z=${model.position.z.toFixed(2)}`);

          // 矩阵元素分析
          if (model.matrix) {
            const m = model.matrix.elements;
            console.log('  --- 矩阵变换 ---');
            console.log('  矩阵元素:', m);

            // 手动提取位置（矩阵的第 12, 13, 14 个元素）
            const posX = m[12];
            const posY = m[13];
            const posZ = m[14];
            console.log('  从矩阵提取的位置:', `x=${posX.toFixed(2)}, y=${posY.toFixed(2)}, z=${posZ.toFixed(2)}`);

            // 计算缩放（从对角线元素）
            const scaleX = Math.sqrt(m[0]*m[0] + m[1]*m[1] + m[2]*m[2]);
            const scaleY = Math.sqrt(m[4]*m[4] + m[5]*m[5] + m[6]*m[6]);
            const scaleZ = Math.sqrt(m[8]*m[8] + m[9]*m[9] + m[10]*m[10]);
            console.log('  缩放 (scale):', `x=${scaleX.toFixed(4)}, y=${scaleY.toFixed(4)}, z=${scaleZ.toFixed(4)}`);

            // 缩放异常检测
            const maxScale = Math.max(scaleX, scaleY, scaleZ);
            const minScale = Math.min(scaleX, scaleY, scaleZ);
            if (maxScale > 50 || minScale < 0.01) {
              console.warn(`  ⚠️  异常缩放: 最大=${maxScale.toFixed(2)}, 最小=${minScale.toFixed(4)}`);
            }

            // 计算旋转（使用简化的欧拉角提取）
            const rotationY = Math.atan2(m[8], m[0]) * 180 / Math.PI;
            const rotationX = Math.atan2(-m[9], Math.sqrt(m[10]*m[10] + m[5]*m[5])) * 180 / Math.PI;
            const rotationZ = Math.atan2(m[4], m[1]) * 180 / Math.PI;
            console.log('  从矩阵提取的旋转 (rotation):', `x=${rotationX.toFixed(2)}°, y=${rotationY.toFixed(2)}°, z=${rotationZ.toFixed(2)}°`);

            // 旋转异常检测
            if (Math.abs(rotationX) > 170 || Math.abs(rotationY) > 170 || Math.abs(rotationZ) > 170) {
              console.error(`  ❌ 接近 180° 旋转: x=${rotationX.toFixed(2)}°, y=${rotationY.toFixed(2)}°, z=${rotationZ.toFixed(2)}°`);
            }
          }

          // 包围盒详细信息
          console.log('  --- 包围盒详情 ---');
          try {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            console.log('  包围盒尺寸:', `x=${size.x.toFixed(2)}, y=${size.y.toFixed(2)}, z=${size.z.toFixed(2)}`);
            console.log('  包围盒中心:', `x=${center.x.toFixed(2)}, y=${center.y.toFixed(2)}, z=${center.z.toFixed(2)}`);
            console.log('  包围盒 min:', `x=${box.min.x.toFixed(2)}, y=${box.min.y.toFixed(2)}, z=${box.min.z.toFixed(2)}`);
            console.log('  包围盒 max:', `x=${box.max.x.toFixed(2)}, y=${box.max.y.toFixed(2)}, z=${box.max.z.toFixed(2)}`);

            // 包围盒异常检测
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim < 0.1) {
              console.warn(`  ⚠️  模型尺寸异常小: ${maxDim.toFixed(4)}`);
            } else if (maxDim > 10000) {
              console.warn(`  ⚠️  模型尺寸异常大: ${maxDim.toFixed(2)}`);
            }
          } catch (e) {
            console.error('  ❌ 包围盒计算失败:', e.message);
          }

          // 子模型详细变换
          if (model.children && model.children.length > 0) {
            console.log('  --- 子模型详细变换 ---');
            model.children.slice(0, 3).forEach((child, i) => {
              const childWorldPos = new THREE.Vector3();
              child.getWorldPosition(childWorldPos);
              console.log(`  子模型 ${i + 1} (${child.name || child.type}):`);
              console.log(`    本地位置: (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
              console.log(`    世界位置: (${childWorldPos.x.toFixed(2)}, ${childWorldPos.y.toFixed(2)}, ${childWorldPos.z.toFixed(2)})`);

              if (child.matrix) {
                const cm = child.matrix.elements;
                console.log(`    子模型矩阵位置: x=${cm[12].toFixed(2)}, y=${cm[13].toFixed(2)}, z=${cm[14].toFixed(2)}`);
              }
            });
            if (model.children.length > 3) {
              console.log(`  ... 还有 ${model.children.length - 3} 个子模型`);
            }
          }

          // UserData 检查
          console.log('  --- UserData 标志 ---');
          console.log('  isLargeCoordModel:', model.userData?.isLargeCoordModel);
          console.log('  hasLargeCoordinates:', model.userData?.hasLargeCoordinates);
          console.log('  originalCenter:', model.userData?.originalCenter);
          console.log('  isXKTModel:', model.userData?.isXKTModel);

          console.log(''); // 空行分隔
        });

        // 容器信息汇总
        console.log('%c--- 容器变换信息汇总 ---', 'color: #8b5cf6; font-weight: bold');
        if (dualViewer.sceneContainer1?.matrix) {
          console.log('sceneContainer1 矩阵:', dualViewer.sceneContainer1.matrix.elements);
        }
        if (dualViewer.anchorContainer1?.matrix) {
          console.log('anchorContainer1 矩阵:', dualViewer.anchorContainer1.matrix.elements);
        }
        if (dualViewer.modelGroup1?.matrix) {
          console.log('modelGroup1 矩阵:', dualViewer.modelGroup1.matrix.elements);
        }

        // referenceModelPosition 检查
        console.log('--- 网格排列参考位置 ---');
        console.log('referenceModelPosition:', dualViewer.referenceModelPosition);
        if (dualViewer.referenceModelPosition) {
          console.log(`  x: ${dualViewer.referenceModelPosition.x?.toFixed(2) || 'N/A'}`);
          console.log(`  y: ${dualViewer.referenceModelPosition.y?.toFixed(2) || 'N/A'}`);
          console.log(`  z: ${dualViewer.referenceModelPosition.z?.toFixed(2) || 'N/A'}`);
        }
      }

      // 11. 总结诊断结果
      console.log('%c=== 诊断总结 ===', 'color: #4ade80; font-weight: bold; font-size: 14px');
      console.log('请检查以下关键点:');
      console.log('1. 红色球体的世界Y坐标是否接近模型的海拔高度 (~70.36米)?');
      console.log('2. 模型的世界Y坐标是否正确?');
      console.log('3. 地板高度是否设置正确?');
      console.log('4. 如果红球在约570米，说明存在高度叠加问题');
      console.log('5. modelGroup1.rotation.x 是否接近 0（正常）或 180°（倒置）?');
      console.log('6. 红球与 ENU 原点的海拔是否一致?');
      console.log('');
      console.log('💡 如果发现 modelGroup1.rotation.x 接近 180°，可以在控制台运行以下命令修复:');
      console.log('   const dualViewer = window.__dualCanvasViewerInstances?.[0];');
      console.log('   dualViewer.modelGroup1.rotation.x = 0;');
      console.log('   dualViewer.modelGroup1.updateMatrixWorld();');
    },

    /**
     * 强制刷新渲染器和控制器状态
     *
     * 用于在模型变换后强制刷新 Three.js 渲染，避免需要手动缩放才能看到效果
     * 这个方法会：
     * 1. 更新控制器状态（controls.update()）
     * 2. 更新场景矩阵（scene.updateMatrixWorld()）
     * 3. 重置渲染器状态（renderer.resetState()）
     * 4. 更新相机矩阵（camera.updateMatrixWorld(), camera.updateProjectionMatrix()）
     *
     * @param {Object} options - 配置选项
     * @param {boolean} options.log - 是否输出日志，默认 true
     * @param {boolean} options.updateControls - 是否更新控制器，默认 true
     * @param {boolean} options.updateScene - 是否更新场景矩阵，默认 true
     * @param {boolean} options.updateRenderer - 是否重置渲染器状态，默认 true
     * @param {boolean} options.updateCamera - 是否更新相机矩阵，默认 true
     */
    forceRenderRefresh(options = {}) {
      const {
        log = true,           // 是否输出日志
        updateControls = true, // 是否更新控制器
        updateScene = true,    // 是否更新场景矩阵
        updateRenderer = true, // 是否重置渲染器状态
        updateCamera = true    // 是否更新相机矩阵
      } = options;

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        if (log) console.warn('[HelloWorld] ⚠️ Dual Canvas Viewer 未初始化，无法刷新渲染');
        return;
      }

      if (log) console.log('[HelloWorld] 🔄 强制刷新渲染器和控制器状态...');

      // 1. 更新控制器状态
      if (updateControls) {
        if (dualViewer.controls1) {
          dualViewer.controls1.update();
          if (log) console.log('✅ controls1.update() 已调用');
        }
        if (dualViewer.controls2) {
          dualViewer.controls2.update();
          if (log) console.log('✅ controls2.update() 已调用');
        }
      }

      // 2. 强制刷新所有场景的矩阵
      if (updateScene) {
        if (dualViewer.scene1) {
          dualViewer.scene1.updateMatrixWorld(true);
          if (log) console.log('✅ scene1.updateMatrixWorld() 已调用');
        }
        if (dualViewer.scene2) {
          dualViewer.scene2.updateMatrixWorld(true);
          if (log) console.log('✅ scene2.updateMatrixWorld() 已调用');
        }
      }

      // 3. 强制渲染刷新
      if (updateRenderer) {
        if (dualViewer.renderer1) {
          dualViewer.renderer1.resetState();
          if (log) console.log('✅ renderer1.resetState() 已调用');
        }
        if (dualViewer.renderer2) {
          dualViewer.renderer2.resetState();
          if (log) console.log('✅ renderer2.resetState() 已调用');
        }
      }

      // 4. 触发相机更新
      if (updateCamera) {
        if (dualViewer.camera1) {
          dualViewer.camera1.updateMatrixWorld(true);
          dualViewer.camera1.updateProjectionMatrix();
          if (log) console.log('✅ camera1 矩阵已更新');
        }
        if (dualViewer.camera2) {
          dualViewer.camera2.updateMatrixWorld(true);
          dualViewer.camera2.updateProjectionMatrix();
          if (log) console.log('✅ camera2 矩阵已更新');
        }
      }

      if (log) console.log('[HelloWorld] ✅ 渲染刷新完成');
    },

    /**
     * 修复模型海拔 - 将大坐标模型移动到正确的海拔位置，同时修复小坐标模型的缩放和倒置问题
     *
     * 大坐标模型修复：
     * 1. 计算模型内部 Y 偏移：internalOffsetY = bbox.min.y - model.position.y
     * 2. 计算目标位置：targetY = modelAltitude - internalOffsetY
     * 3. 应用修复：model.position.y = targetY
     *
     * 小坐标模型修复：
     * 1. 重置异常缩放（限制最大缩放为 10）
     * 2. 检查并修复倒置（旋转 -180° 或 180°）
     * 3. 将模型放置在地面上（与红色球体对齐）
     * 
     */
    async fixModel() {
      console.log('[HelloWorld] 🔧 开始修复模型和缩放...');
      console.log('%c=== 模型修复（大坐标 + 小坐标） ===', 'color: #f59e0b; font-weight: bold; font-size: 14px');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }

      if (!dualViewer.modelGroup1 || dualViewer.modelGroup1.children.length === 0) {
        console.error('[HelloWorld] ❌ 没有找到模型');
        return;
      }

      let fixedLargeCoordCount = 0;
      let fixedSmallCoordCount = 0;

      // ⭐ 使用 for...of 而不是 forEach，以便支持 await
      for (let index = 0; index < dualViewer.modelGroup1.children.length; index++) {
        const model = dualViewer.modelGroup1.children[index];
        const fileName = model.userData?.fileName || model.userData?.filePath || model.name || 'unnamed';
        const isLargeCoord = model.userData?.isLargeCoordModel;

        console.log(`\n%c模型 ${index + 1}: ${fileName}`, 'color: #3b82f6; font-weight: bold');
        console.log(`  类型: ${isLargeCoord ? '大坐标模型' : '小坐标模型'}`);

        if (isLargeCoord) {
          // ==================== 大坐标模型修复 ====================
          console.log('  --- 大坐标模型修复 ---');

          // 获取模型原始经纬度（用于采样倾斜摄影表面）
          const cartographic = model.userData?.originalLocation?.cartographic;
          const longitude = cartographic?.longitude;
          const latitude = cartographic?.latitude;
          const originalAltitude = cartographic?.height;

          if (!longitude || !latitude) {
            console.warn(`  ⚠️  模型经纬度无效，跳过`);
            return;
          }

          // ⭐ 使用地形表面采样获取真实地面高度
          let actualSurfaceHeight = 0;

          // ⭐ 直接采样地形表面（包括3D Tiles，由ObliquePhotographyPanel管理）
          if (this.cesiumViewer) {
            try {
              // ⭐ cartographic 使用弧度，需要转换为度数
              const longitudeDeg = this.Cesium.Math.toDegrees(longitude);
              const latitudeDeg = this.Cesium.Math.toDegrees(latitude);
              const position = this.Cesium.Cartesian3.fromDegrees(longitudeDeg, latitudeDeg);
              const heights = await this.cesiumViewer.scene.sampleHeightMostDetailed([position]);
              actualSurfaceHeight = (heights && heights[0] !== undefined && !isNaN(heights[0])) ? heights[0] : 0;

              console.log(`  📍 地形表面采样:`, {
                经度: longitudeDeg.toFixed(6) + '°',
                纬度: latitudeDeg.toFixed(6) + '°',
                表面高度: actualSurfaceHeight.toFixed(2) + 'm',
                原始高度: originalAltitude?.toFixed(2) + 'm'
              });
            } catch (error) {
              console.warn(`  ⚠️  地形采样失败，使用原始高度:`, error);
              actualSurfaceHeight = originalAltitude || 0;
            }
          } else {
            // 没有Cesium Viewer，使用原始高度
            actualSurfaceHeight = originalAltitude || 0;
            console.log(`  ℹ️  未加载Cesium Viewer，使用原始高度: ${actualSurfaceHeight.toFixed(2)}m`);
          }

          if (!actualSurfaceHeight || actualSurfaceHeight <= 0) {
            console.warn(`  ⚠️  表面高度无效: ${actualSurfaceHeight}，跳过`);
            return;
          }

          // 获取当前世界位置
          const currentWorldPos = new THREE.Vector3();
          model.getWorldPosition(currentWorldPos);
          const currentY = currentWorldPos.y;

          console.log(`  目标海拔: ${actualSurfaceHeight.toFixed(2)} 米`);
          console.log(`  当前世界Y: ${currentY.toFixed(2)} 米`);

          const bbox = new THREE.Box3().setFromObject(model);
          const bboxMinY = bbox.min.y;

          // 计算内部偏移和目标位置
          const internalOffsetY = bboxMinY - model.position.y;
          const targetY = actualSurfaceHeight - internalOffsetY;

          console.log(`  目标位置Y: ${targetY.toFixed(2)} 米`);
          console.log(`  需要移动: ${(targetY - currentY).toFixed(2)} 米`);

          // 应用修复
          model.position.y = targetY;
          model.updateMatrixWorld(true);

          // 验证
          const newBbox = new THREE.Box3().setFromObject(model);
          const newAltitudeDiff = Math.abs(actualSurfaceHeight - newBbox.min.y);

          if (newAltitudeDiff < 0.5) {
            console.log(`  ✅ 大坐标模型修复成功！误差: ${newAltitudeDiff.toFixed(2)} 米`);
            fixedLargeCoordCount++;
          } else {
            console.error(`  ❌ 大坐标模型修复失败！误差: ${newAltitudeDiff.toFixed(2)} 米`);
          }

        } else {
          // ==================== 小坐标模型修复 ====================
          console.log('  --- 小坐标模型修复 ---');

          // ⭐ 声明 scaleFixed 变量
          let scaleFixed = false;

          // 获取当前状态
          const bbox = new THREE.Box3().setFromObject(model);
          const bboxSize = new THREE.Vector3();
          bbox.getSize(bboxSize);
          const bboxHeight = bboxSize.y;

          console.log(`  当前缩放: x=${model.scale.x.toFixed(4)}, y=${model.scale.y.toFixed(4)}, z=${model.scale.z.toFixed(4)}`);
          console.log(`  当前包围盒高度: ${bboxHeight.toFixed(2)} 米`);

          // 1. 修复异常缩放
          // const MAX_REASONABLE_SCALE = 10;
          // const currentScale = model.scale.x; // 假设均匀缩放
          // let scaleFixed = false;

          // if (currentScale > MAX_REASONABLE_SCALE) {
          //   console.log(`  ⚠️  检测到异常缩放: ${currentScale.toFixed(2)}x`);
          //   console.log(`  🔄 重置缩放到 1.0`);

          //   model.scale.set(1, 1, 1);
          //   model.updateMatrixWorld(true);
          //   scaleFixed = true;

          //   // 重新计算包围盒
          //   const newBbox = new THREE.Box3().setFromObject(model);
          //   const newBboxSize = new THREE.Vector3();
          //   newBbox.getSize(newBboxSize);
          //   const newBboxHeight = newBboxSize.y;

          //   console.log(`  新缩放: x=${model.scale.x.toFixed(4)}, y=${model.scale.y.toFixed(4)}, z=${model.scale.z.toFixed(4)}`);
          //   console.log(`  新包围盒高度: ${newBboxHeight.toFixed(2)} 米`);
          // }

          // 2. 检查并修复倒置（包括 X/Y/Z 轴的镜像和旋转）
          console.log(`  --- 倒置/镜像检查 ---`);

          // 检查模型的缩放是否有负值（镜像）
          const hasNegativeScale = model.scale.x < 0 || model.scale.y < 0 || model.scale.z < 0;
          if (hasNegativeScale) {
            console.log(`  ⚠️  检测到负缩放（镜像）: x=${model.scale.x.toFixed(4)}, y=${model.scale.y.toFixed(4)}, z=${model.scale.z.toFixed(4)}`);

            // 修复负缩放：取绝对值
            model.scale.set(Math.abs(model.scale.x), Math.abs(model.scale.y), Math.abs(model.scale.z));
            model.updateMatrixWorld(true);
            console.log(`  🔄 修复负缩放: x=${model.scale.x.toFixed(4)}, y=${model.scale.y.toFixed(4)}, z=${model.scale.z.toFixed(4)}`);
            scaleFixed = true;
          }

          // 检查子模型是否有异常旋转或镜像
          let invertedFixed = false;
          model.traverse((child) => {
            if (!child.isMesh) return;

            // 检查子模型的缩放
            if (child.scale.x < 0 || child.scale.y < 0 || child.scale.z < 0) {
              console.log(`  🔍 子模型 "${child.name || 'unnamed'}" 有负缩放:`, {
                x: child.scale.x.toFixed(4),
                y: child.scale.y.toFixed(4),
                z: child.scale.z.toFixed(4)
              });

              // 修复负缩放
              child.scale.set(
                Math.abs(child.scale.x),
                Math.abs(child.scale.y),
                Math.abs(child.scale.z)
              );
              child.updateMatrixWorld(true);
              invertedFixed = true;
              console.log(`  🔄 修复子模型负缩放`);
            }

            // 检查旋转是否异常（接近 90° 或 180°）
            const euler = new THREE.Euler().setFromQuaternion(child.quaternion);
            const rotXDeg = Math.abs(euler.x * 180 / Math.PI) % 360;
            const rotYDeg = Math.abs(euler.y * 180 / Math.PI) % 360;
            const rotZDeg = Math.abs(euler.z * 180 / Math.PI) % 360;

            // 如果旋转接近 90°、180° 或 270°，可能是异常旋转
            const hasAbnormalRotation =
              (rotXDeg > 80 && rotXDeg < 100) || (rotXDeg > 170 && rotXDeg < 190) || (rotXDeg > 260 && rotXDeg < 280) ||
              (rotYDeg > 80 && rotYDeg < 100) || (rotYDeg > 170 && rotYDeg < 190) || (rotYDeg > 260 && rotYDeg < 280) ||
              (rotZDeg > 80 && rotZDeg < 100) || (rotZDeg > 170 && rotZDeg < 190) || (rotZDeg > 260 && rotZDeg < 280);

            if (hasAbnormalRotation) {
              console.log(`  🔍 子模型 "${child.name || 'unnamed'}" 有异常旋转:`, {
                x: `${rotXDeg.toFixed(1)}°`,
                y: `${rotYDeg.toFixed(1)}°`,
                z: `${rotZDeg.toFixed(1)}°`
              });

              // ⭐ 不重置子模型旋转，让统一修复来处理
              // child.rotation.set(0, 0, 0);
              // child.updateMatrixWorld(true);
              // invertedFixed = true;
              console.log(`  ℹ️  保留子模型旋转，由统一修复处理`);
            }
          });

          // 遍历所有 Mesh 检查是否还有倒置
          const bboxCenter = new THREE.Vector3();
          bbox.getCenter(bboxCenter);
          const relativeCenterY = bboxCenter.y - model.position.y;

          console.log(`  模型包围盒中心相对位置: y=${relativeCenterY.toFixed(2)} 米`);

          // 如果模型中心仍然在很奇怪的位置，可能需要整体旋转
          if (Math.abs(relativeCenterY) > bboxHeight * 0.6) {
            console.log(`  ⚠️  模型中心偏移异常: ${relativeCenterY.toFixed(2)} 米`);
            console.log(`  🔄 尝试绕 X 轴旋转 180°`);

            // 对整个模型绕 X 轴旋转 180°
            model.rotation.x = Math.PI;
            model.updateMatrixWorld(true);
            invertedFixed = true;

            // 验证修复
            const rotatedBbox = new THREE.Box3().setFromObject(model);
            const rotatedCenter = new THREE.Vector3();
            rotatedBbox.getCenter(rotatedCenter);
            const newRelativeCenterY = rotatedCenter.y - model.position.y;

            console.log(`  旋转后中心相对位置: y=${newRelativeCenterY.toFixed(2)} 米`);

            if (Math.abs(newRelativeCenterY) > Math.abs(relativeCenterY)) {
              // 如果旋转后更糟了，撤销旋转
              console.log(`  ⚠️  旋转使情况更糟，撤销旋转`);
              model.rotation.x = 0;
              model.updateMatrixWorld(true);
              invertedFixed = false;
            } else {
              console.log(`  ✅ 旋转改善了模型朝向`);
            }
          }

          // 3. ⭐ 改进：更准确的倒置检测和多种旋转尝试
          console.log(`  --- 倒置检测与修复（增强版） ---`);

          const bboxBeforeRotation = new THREE.Box3().setFromObject(model);
          const sizeBeforeRotation = new THREE.Vector3();
          bboxBeforeRotation.getSize(sizeBeforeRotation);

          console.log(`  边界框尺寸: X=${sizeBeforeRotation.x.toFixed(2)}m, Y=${sizeBeforeRotation.y.toFixed(2)}m, Z=${sizeBeforeRotation.z.toFixed(2)}m`);

          // ⭐ 方法1：检查包围盒尺寸比例（Z-up 模型通常 Z 轴尺寸最大）
          const isZUpBySize = sizeBeforeRotation.z > sizeBeforeRotation.y * 1.2;

          // ⭐ 方法2：检查模型的整体旋转（通过检查第一个 Mesh 的 up 向量）
          let firstMeshUp = new THREE.Vector3(0, 1, 0);
          let firstMeshFound = false;
          model.traverse((child) => {
            if (!firstMeshFound && child.isMesh) {
              firstMeshFound = true;
              // 获取 Mesh 的 up 向量（考虑其变换）
              const up = new THREE.Vector3(0, 1, 0);
              up.applyQuaternion(child.quaternion);
              firstMeshUp.copy(up);
            }
          });

          // ⭐ 方法3：检查包围盒中心与模型位置的关系（倒置模型中心可能在下方）
          // 重新计算 bboxCenter（使用新的 bboxBeforeRotation）
          bboxCenter.set(0, 0, 0);
          bboxBeforeRotation.getCenter(bboxCenter);
          const relativeCenterY2 = bboxCenter.y - model.position.y;
          const isCenterBelow = relativeCenterY2 < -sizeBeforeRotation.y * 0.2;

          console.log(`  倒置检测:`, {
            'Z轴尺寸最大': isZUpBySize,
            'Mesh Up 向量': `(${firstMeshUp.x.toFixed(2)}, ${firstMeshUp.y.toFixed(2)}, ${firstMeshUp.z.toFixed(2)})`,
            '中心在下方': isCenterBelow,
            '相对中心Y': relativeCenterY2.toFixed(2) + 'm'
          });

          // ⭐ 所有小坐标模型都执行绕X轴-90°旋转（Z-up → Y-up）
          // 特殊处理：Catwalk04 使用不同的旋转角度
          const fileName = model.userData?.fileName || model.userData?.filePath || '';
          const modelName = model.name || '';
          const isCatwalk04 = fileName.includes('Catwalk04') || modelName === 'Scene';

          if (isCatwalk04) {
            console.log(`  🔄 应用特殊修复: Catwalk04 → 绕X轴180°（上下翻转）`);
          } else {
            console.log(`  🔄 应用统一修复: 绕X轴+90° + 绕Y轴180°`);
          }

          // 方法1: 获取场景容器的旋转并应用到模型上
          const sceneContainer = dualViewer.sceneContainer1;
          if (sceneContainer && sceneContainer.rotation) {
            console.log(`  🔄 获取场景容器的旋转...`);
            console.log(`  场景容器旋转:`, {
              x: (sceneContainer.rotation.x * 180 / Math.PI).toFixed(2) + '°',
              y: (sceneContainer.rotation.y * 180 / Math.PI).toFixed(2) + '°',
              z: (sceneContainer.rotation.z * 180 / Math.PI).toFixed(2) + '°'
            });

            // 获取场景容器的四元数
            const sceneQuaternion = new THREE.Quaternion();
            sceneQuaternion.setFromEuler(new THREE.Euler(
              sceneContainer.rotation.x,
              sceneContainer.rotation.y,
              sceneContainer.rotation.z,
              'XYZ'
            ));

            if (isCatwalk04) {
              console.log(`  🔄 应用反向旋转到 Catwalk04...`);
              // 应用反向旋转以抵消场景旋转
              const inverseQuaternion = sceneQuaternion.clone().invert();
              model.quaternion.multiply(inverseQuaternion);
              model.updateMatrixWorld(true);

              console.log(`  ✅ Catwalk04 已应用反向旋转`);
            } else {
              console.log(`  🔄 应用反向旋转到 CesiumMan...`);
              // 应用反向旋转以抵消场景旋转
              const inverseQuaternion = sceneQuaternion.clone().invert();
              model.quaternion.multiply(inverseQuaternion);
              model.updateMatrixWorld(true);

              // 同时也调整 up 向量
              model.up.set(0, 0, 1);
              model.updateMatrixWorld(true);

              console.log(`  ✅ CesiumMan 已应用反向旋转并调整 up 向量`);
            }
          } else {
            console.log(`  ⚠️  无法获取场景容器，使用默认旋转`);

            // 默认旋转：绕 X 轴180°翻转上下
            model.rotation.x = Math.PI;
            model.rotation.y = 0;
            model.rotation.z = 0;
            model.updateMatrixWorld(true);
          }

          // 验证结果
          const rotatedBbox = new THREE.Box3().setFromObject(model);
          const rotatedSize = new THREE.Vector3();
          rotatedBbox.getSize(rotatedSize);

          const rotationName = isCatwalk04 ? '场景容器反向旋转 (Catwalk04)' : '场景容器反向旋转 + up调整 (CesiumMan)';
          console.log(`  ✅ ${rotationName} 已应用:`, {
            '顶层旋转': `x=${model.rotation.x.toFixed(2)}, y=${model.rotation.y.toFixed(2)}, z=${model.rotation.z.toFixed(2)}`,
            '新尺寸': `X=${rotatedSize.x.toFixed(2)}m, Y=${rotatedSize.y.toFixed(2)}m, Z=${rotatedSize.z.toFixed(2)}m`
          });

          invertedFixed = true;

          // 4. 将模型放置在地面上（与红色球体对齐）
          // 目标：模型底部应该在 Y=0
          const finalBbox = new THREE.Box3().setFromObject(model);
          const finalBboxMinY = finalBbox.min.y;

          console.log(`  --- 地面对齐 ---`);
          console.log(`  当前包围盒底部: ${finalBboxMinY.toFixed(2)} 米`);
          console.log(`  目标: 底部在 Y=0（与红色球体对齐）`);

          if (Math.abs(finalBboxMinY) > 0.1) {
            const targetY = model.position.y - finalBboxMinY;
            console.log(`  🔄 移动模型: Y=${model.position.y.toFixed(2)} → ${targetY.toFixed(2)}`);

            model.position.y = targetY;
            model.updateMatrixWorld(true);

            // 验证
            const verifyBbox = new THREE.Box3().setFromObject(model);
            console.log(`  ✅ 地面对齐完成，新底部: ${verifyBbox.min.y.toFixed(2)} 米`);
          } else {
            console.log(`  ✅ 模型已在地面上，无需移动`);
          }

          if (scaleFixed || invertedFixed) {
            fixedSmallCoordCount++;
            console.log(`  ✅ 小坐标模型修复完成`);
          } else {
            console.log(`  ℹ️  小坐标模型无需修复`);
          }
        }
      }

      console.log('\n%c=== 修复总结 ===', 'color: #4ade80; font-weight: bold; font-size: 14px');
      console.log(`已修复 ${fixedLargeCoordCount} 个大坐标模型的海拔位置`);
      console.log(`已修复 ${fixedSmallCoordCount} 个小坐标模型的缩放和倒置`);

      // 更新 referenceModelPosition（如果存在）
      if (dualViewer.referenceModelPosition && (fixedLargeCoordCount > 0 || fixedSmallCoordCount > 0)) {
        const largeCoordModel = dualViewer.modelGroup1.children.find(m => m.userData?.isLargeCoordModel);
        if (largeCoordModel) {
          const worldPos = new THREE.Vector3();
          largeCoordModel.getWorldPosition(worldPos);
          dualViewer.referenceModelPosition = worldPos;
          console.log('✅ 已更新 referenceModelPosition');
        }
      }

      // ⭐ 关键修复：强制刷新渲染器和控制器状态
      // 这是修复后需要鼠标缩放才能看到效果的替代方案
      this.forceRenderRefresh();

      console.log('\n💡 请再次点击"🔍 诊断模型"按钮验证修复结果');

      // ⭐ 新增：在修复完成后调用 focusOnSingleModel 来触发下拉定位逻辑
      console.log('\n🔄 修复完成后，调用 focusOnSingleModel 来触发下拉定位...');

      // 延迟调用，确保模型更新已完成
      this.$nextTick(() => {
        if (dualViewer.loadedModelsList && dualViewer.loadedModelsList.length > 0) {
          // 获取第一个模型的 ID
          const firstModelId = dualViewer.loadedModelsList[0].id;
          console.log(`  🔄 调用 focusOnSingleModel(${firstModelId})...`);

          try {
            dualViewer.focusOnSingleModel(firstModelId);
            console.log(`  ✅ focusOnSingleModel 已调用`);
          } catch (error) {
            console.warn(`  ⚠️  focusOnSingleModel 调用失败:`, error.message);
          }
        } else {
          console.log(`  ℹ️  没有 loadedModelsList，跳过 focusOnSingleModel 调用`);
        }
      });
    },

    /**
     * 自动聚焦到大坐标模型
     * 在局部坐标系模式下，自动查找大坐标模型并定位 Cesium 相机到模型位置
     */
    autoFocusOnLargeCoordModel() {
      console.log('[HelloWorld] 🎯 自动聚焦到大坐标模型...');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }

      if (!dualViewer.loadedModelsList || dualViewer.loadedModelsList.length === 0) {
        console.warn('[HelloWorld] ⚠️ 没有已加载的模型');
        return;
      }

      // 查找大坐标模型
      const largeCoordModel = dualViewer.loadedModelsList.find(m =>
        m.model && m.model.userData && m.model.userData.isLargeCoordModel === true
      );

      if (!largeCoordModel) {
        console.warn('[HelloWorld] ⚠️ 未找到大坐标模型，跳过自动聚焦');
        return;
      }

      console.log('[HelloWorld] ✅ 找到大坐标模型:', {
        id: largeCoordModel.id,
        name: largeCoordModel.name,
        layer: largeCoordModel.layer
      });

      // 获取模型的地理位置信息
      const modelLocation = largeCoordModel.model?.userData?.originalLocation;

      // ⭐ 关键修复：在局部坐标系模式下，直接定位 Cesium 相机到大坐标模型的经纬度位置
      // 原因：syncThreeToCesium 在 ENU 模式下会跳过同步，导致 Cesium 相机不移动
      if (modelLocation && modelLocation.cartographic) {
        const { longitude, latitude, height: altitude } = modelLocation.cartographic;

        // ⭐ BUG FIX：cartographic 的经纬度是弧度，fromDegrees 需要度数
        const longitudeDeg = this.Cesium.Math.toDegrees(longitude);
        const latitudeDeg = this.Cesium.Math.toDegrees(latitude);

        console.log('[HelloWorld] 📍 直接定位 Cesium 相机到大坐标模型位置:', {
          经度: longitudeDeg.toFixed(6) + '°',
          纬度: latitudeDeg.toFixed(6) + '°',
          海拔: altitude.toFixed(2) + '米'
        });

        // 设置 Cesium 相机到模型位置（垂直俯瞰）
        const cameraHeight = Math.max(altitude + 500, 1000); // 至少 500米 或 1000米高度
        this.cesiumViewer.camera.setView({
          destination: this.Cesium.Cartesian3.fromDegrees(longitudeDeg, latitudeDeg, cameraHeight),
          orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_TWO, // -90度，完全垂直向下俯瞰
            roll: 0
          }
        });

        console.log('[HelloWorld] ✅ Cesium 相机已定位到大坐标模型位置');
      } else {
        console.warn('[HelloWorld] ⚠️ 模型缺少经纬度信息，尝试使用同步方式');
      }

      // 调用 focusOnSingleModel 聚焦 Three.js 相机
      try {
        dualViewer.focusOnSingleModel(largeCoordModel.id);
        console.log('[HelloWorld] ✅ Three.js 相机已聚焦到大坐标模型');
      } catch (error) {
        console.error('[HelloWorld] ❌ 聚焦大坐标模型失败:', error);
      }
    },

    /**
     * 强制设置垂直俯瞰视图
     * 用于解决SyncManager调整相机角度导致不是完全垂直俯瞰的问题
     */
    forceVerticalOverheadView() {
      console.log('[HelloWorld] 🔧 强制设置垂直俯瞰视图...');
      console.log('[HelloWorld] 📍 步骤1: 检查Dual Viewer...');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }
      console.log('[HelloWorld] ✅ Dual Viewer 存在');

      // 临时禁用SyncManager的自动调整
      console.log('[HelloWorld] 📍 步骤2: 禁用SyncManager自动调整...');
      if (dualViewer.syncManager) {
        const originalReinit = dualViewer.syncManager.reinitUnifiedState;
        dualViewer.syncManager.reinitUnifiedState = function() {
          console.log('[HelloWorld] ⏭️ 跳过SyncManager重新初始化（保持垂直俯瞰）');
        };
        console.log('[HelloWorld] ✅ SyncManager重新初始化已禁用');

        // 10秒后恢复原始方法
        setTimeout(() => {
          dualViewer.syncManager.reinitUnifiedState = originalReinit;
          console.log('[HelloWorld] ✅ 已恢复SyncManager重新初始化');
        }, 10000);
      } else {
        console.warn('[HelloWorld] ⚠️ SyncManager 不存在');
      }

      // 设置Cesium相机为垂直俯瞰
      console.log('[HelloWorld] 📍 步骤3: 设置Cesium相机为垂直俯瞰...');
      if (this.cesiumViewer && this.cesiumViewer.camera) {
        const beforePitch = Cesium.Math.toDegrees(this.cesiumViewer.camera.pitch);
        console.log('[HelloWorld] 📍 设置前Cesium相机pitch:', beforePitch.toFixed(2) + '°');

        this.cesiumViewer.camera.setView({
          orientation: {
            heading: 0,
            pitch: -Cesium.Math.PI_OVER_TWO,  // -90度，完全垂直向下
            roll: 0
          }
        });

        const afterPitch = Cesium.Math.toDegrees(this.cesiumViewer.camera.pitch);
        console.log('[HelloWorld] 📍 设置后Cesium相机pitch:', afterPitch.toFixed(2) + '°');
        console.log('[HelloWorld] ✅ Cesium相机已设置为垂直俯瞰');
      } else {
        console.warn('[HelloWorld] ⚠️ Cesium Viewer 或 Camera 不存在');
      }

      // 设置Dual相机为垂直俯瞰
      console.log('[HelloWorld] 📍 步骤4: 设置Dual相机为垂直俯瞰...');
      if (dualViewer.camera1) {
        const beforePos = dualViewer.camera1.position.clone();
        console.log('[HelloWorld] 📍 设置前Dual相机位置:', beforePos);

        dualViewer.camera1.position.set(0, 500, 0);
        dualViewer.camera1.lookAt(0, 0, 0);
        dualViewer.camera1.updateMatrixWorld(true);

        // 更新控制器
        if (dualViewer.controls1) {
          dualViewer.controls1.target.set(0, 0, 0);
          dualViewer.controls1.update();
          console.log('[HelloWorld] ✅ Dual控制器已更新');
        }

        const afterPos = dualViewer.camera1.position.clone();
        console.log('[HelloWorld] 📍 设置后Dual相机位置:', afterPos);
        console.log('[HelloWorld] ✅ Dual相机已设置为垂直俯瞰');
      } else {
        console.warn('[HelloWorld] ⚠️ Dual Camera1 不存在');
      }

      // ⭐ 关键修复：模拟鼠标翻转来触发渲染刷新
      console.log('[HelloWorld] 📍 步骤5: 准备触发渲染刷新（延迟50ms）...');
      setTimeout(() => {
        console.log('[HelloWorld] 📍 步骤5.1: 开始触发渲染刷新...');

        if (dualViewer.syncManager) {
          console.log('[HelloWorld] 📍 步骤5.2: SyncManager 存在，触发事件...');

          // 触发一次相机更新事件
          const event = new CustomEvent('camerachanged', {
            detail: { source: 'forceVerticalOverheadView' }
          });
          window.dispatchEvent(event);
          console.log('[HelloWorld] ✅ camerachanged 事件已触发');

          // 调用update方法来触发渲染
          if (dualViewer.controls1 && dualViewer.controls1.update) {
            dualViewer.controls1.update();
            console.log('[HelloWorld] ✅ controls1.update() 已调用');
          }

          // 强制渲染一帧
          console.log('[HelloWorld] 📍 步骤5.3: 强制渲染一帧...');
          if (dualViewer.renderer1) {
            dualViewer.renderer1.clear();
            dualViewer.renderer1.render(dualViewer.scene1, dualViewer.camera1);
            console.log('[HelloWorld] ✅ renderer1 已强制渲染');
          } else {
            console.warn('[HelloWorld] ⚠️ renderer1 不存在');
          }

          if (dualViewer.renderer2) {
            dualViewer.renderer2.clear();
            dualViewer.renderer2.render(dualViewer.scene2, dualViewer.camera2);
            console.log('[HelloWorld] ✅ renderer2 已强制渲染');
          } else {
            console.warn('[HelloWorld] ⚠️ renderer2 不存在');
          }

          console.log('[HelloWorld] ✅ 已模拟鼠标翻转触发渲染刷新');
        } else {
          console.warn('[HelloWorld] ⚠️ SyncManager 不存在，跳过渲染刷新');
        }

        console.log('[HelloWorld] 📍 步骤5.4: 渲染刷新完成');
      }, 50);

      // 验证设置
      console.log('[HelloWorld] 📍 步骤6: 准备验证设置结果（延迟100ms）...');
      setTimeout(() => {
        console.log('[HelloWorld] 📍 步骤6.1: 开始验证...');

        if (this.cesiumViewer && this.cesiumViewer.camera) {
          const pitch = Cesium.Math.toDegrees(this.cesiumViewer.camera.pitch);
          console.log('[HelloWorld] 📊 垂直俯瞰验证:', {
            Cesium相机pitch: pitch.toFixed(2) + '°',
            是否垂直俯瞰: Math.abs(pitch + 90) < 1,
            期望值: '-90.00°'
          });

          if (Math.abs(pitch + 90) >= 1) {
            console.error('[HelloWorld] ❌ 垂直俯瞰设置失败！当前pitch:', pitch.toFixed(2) + '°');
          } else {
            console.log('[HelloWorld] ✅ 垂直俯瞰设置成功！');
          }
        }

        console.log('[HelloWorld] 📍 步骤6.2: 验证完成');
      }, 100);

      console.log('[HelloWorld] ✅ forceVerticalOverheadView 方法执行完成');
    },

    /**
     * 翻转场景 - 用于修复局部坐标系模式下的整体倒置问题
     */
    flipScene() {
      console.log('[HelloWorld] 🔃 开始翻转场景...');
      console.log('%c=== 场景翻转工具 ===', 'color: #8b5cf6; font-weight: bold; font-size: 14px');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }

      // 检测当前模式
      const isLocalCoord = dualViewer.syncManager?.mercatorProjection?.isUsingLocalCoordinateSystem?.();
      console.log('当前模式:', isLocalCoord ? '局部坐标系' : '全局坐标系');

      // 获取场景容器
      const sceneContainer = dualViewer.sceneContainer1;
      const modelGroup = dualViewer.modelGroup1;
      const anchorContainer = dualViewer.anchorContainer1;
      const scene = dualViewer.scene1;

      if (!sceneContainer && !modelGroup) {
        console.error('[HelloWorld] ❌ 找不到场景容器');
        return;
      }

      // 显示当前旋转状态
      console.log('当前旋转状态:');
      if (sceneContainer) {
        console.log('  sceneContainer1.rotation:', {
          x: (sceneContainer.rotation.x * 180 / Math.PI).toFixed(1) + '°',
          y: (sceneContainer.rotation.y * 180 / Math.PI).toFixed(1) + '°',
          z: (sceneContainer.rotation.z * 180 / Math.PI).toFixed(1) + '°'
        });
      }
      if (modelGroup) {
        console.log('  modelGroup1.rotation:', {
          x: (modelGroup.rotation.x * 180 / Math.PI).toFixed(1) + '°',
          y: (modelGroup.rotation.y * 180 / Math.PI).toFixed(1) + '°',
          z: (modelGroup.rotation.z * 180 / Math.PI).toFixed(1) + '°'
        });
      }

      // ⭐ 主要翻转方法：翻转 sceneContainer1
      console.log('\n🔄 方法1: 翻转 sceneContainer1 (推荐)');
      if (sceneContainer) {
        // 检查当前是否已翻转
        const isFlipped = Math.abs(sceneContainer.rotation.x - Math.PI) < 0.1;

        if (isFlipped) {
          // 撤销翻转
          console.log('  场景已翻转，撤销翻转...');
          sceneContainer.rotation.set(0, 0, 0);
        } else {
          // 应用翻转：绕X轴旋转180度
          console.log('  应用翻转：绕X轴旋转180度...');
          sceneContainer.rotation.x = Math.PI;
        }

        sceneContainer.updateMatrixWorld(true);
        console.log('  ✅ sceneContainer1 翻转完成');
      }

      // ⭐ 更新场景矩阵
      if (scene) {
        scene.updateMatrixWorld(true);
      }

      // ⭐ 同步相机（如果需要）
      if (this.syncManager && this.syncManager.reinitUnifiedState) {
        setTimeout(() => {
          this.syncManager.reinitUnifiedState();
        }, 100);
      }

      console.log('\n✅ 场景翻转完成！');
      console.log('\n💡 如果效果不对，可以点击其他按钮尝试：');
      console.log('   - 再次点击"🔃 翻转场景"撤销翻转');
      console.log('   - 使用"🔄 测试模型旋转"进行精确调整');
    },

    /**
     * 测试模型旋转 - 手动尝试不同的旋转方式来修复倒置
     */
    testModelRotations() {
      console.log('[HelloWorld] 🔄 开始测试模型旋转...');
      console.log('%c=== 模型旋转测试工具 ===', 'color: #f59e0b; font-weight: bold; font-size: 14px');

      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.error('[HelloWorld] ❌ Dual Canvas Viewer 未初始化');
        return;
      }

      if (!dualViewer.modelGroup1 || dualViewer.modelGroup1.children.length === 0) {
        console.error('[HelloWorld] ❌ 没有找到模型');
        return;
      }

      // 定义旋转选项
      const rotationOptions = [
        { name: '1️⃣ 原始', x: 0, y: 0, z: 0 },
        { name: '2️⃣ 绕X轴-90° (Z→Y)', x: -Math.PI / 2, y: 0, z: 0 },
        { name: '3️⃣ 绕X轴+90° (Z→-Y)', x: Math.PI / 2, y: 0, z: 0 },
        { name: '4️⃣ 绕X轴+180° (翻转)', x: Math.PI, y: 0, z: 0 },
        { name: '5️⃣ 绕Y轴+90°', x: 0, y: Math.PI / 2, z: 0 },
        { name: '6️⃣ 绕Y轴+180°', x: 0, y: Math.PI, z: 0 },
        { name: '7️⃣ 绕Z轴+90°', x: 0, y: 0, z: Math.PI / 2 },
        { name: '8️⃣ 绕Z轴+180° (翻转)', x: 0, y: 0, z: Math.PI }
      ];

      console.log('\n📋 可用的旋转选项:');
      rotationOptions.forEach((opt, i) => {
        console.log(`${opt.name}: rotation=(${opt.x.toFixed(2)}, ${opt.y.toFixed(2)}, ${opt.z.toFixed(2)})`);
      });

      console.log('\n💡 使用方法：');
      console.log('   在控制台运行以下命令来应用旋转：');
      console.log('   window.applyModelRotation(模型索引, 旋转选项索引)');
      console.log('   例如：window.applyModelRotation(0, 1) // 第1个模型，绕X轴-90°');
      console.log('   例如：window.applyModelRotation(1, 3) // 第2个模型，绕X轴+180°');

      // 将应用函数暴露到全局
      window.applyModelRotation = (modelIndex, rotationIndex) => {
        const model = dualViewer.modelGroup1.children[modelIndex];
        if (!model) {
          console.error(`❌ 模型索引 ${modelIndex} 无效`);
          return;
        }

        const rotation = rotationOptions[rotationIndex];
        if (!rotation) {
          console.error(`❌ 旋转选项索引 ${rotationIndex} 无效`);
          return;
        }

        const fileName = model.userData?.fileName || model.name || 'unnamed';
        console.log(`\n🔄 应用旋转: ${rotation.name} 到模型 ${modelIndex + 1} (${fileName})`);

        // 保存原始旋转
        const originalRotation = model.rotation.clone();

        // ⭐ 关键修复：递归旋转所有子对象
        const rotateAllChildren = (object) => {
          // 设置对象的旋转
          object.rotation.set(rotation.x, rotation.y, rotation.z);
          object.updateMatrixWorld(true);

          // 递归处理所有子对象
          object.children.forEach(child => {
            rotateAllChildren(child);
          });
        };

        // 应用旋转到模型及其所有子对象
        rotateAllChildren(model);

        // ⭐ 强制更新场景矩阵
        if (dualViewer.scene1) {
          dualViewer.scene1.updateMatrixWorld(true);
        }

        // ⭐ 触发渲染器重新渲染
        if (dualViewer.renderer1) {
          dualViewer.renderer1.render(dualViewer.scene1, dualViewer.camera1);
        }
        if (dualViewer.renderer2 && dualViewer.scene2 && dualViewer.camera2) {
          dualViewer.renderer2.render(dualViewer.scene2, dualViewer.camera2);
        }

        // 计算新的包围盒
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        console.log(`✅ 旋转已应用到所有子对象:`, {
          '新旋转': `x=${rotation.x.toFixed(2)} (${(rotation.x * 180 / Math.PI).toFixed(1)}°), y=${rotation.y.toFixed(2)} (${(rotation.y * 180 / Math.PI).toFixed(1)}°), z=${rotation.z.toFixed(2)} (${(rotation.z * 180 / Math.PI).toFixed(1)}°)`,
          '包围盒尺寸': `X=${size.x.toFixed(2)}m, Y=${size.y.toFixed(2)}m, Z=${size.z.toFixed(2)}m`,
          '包围盒底部': `${bbox.min.y.toFixed(2)}m`,
          '包围盒顶部': `${bbox.max.y.toFixed(2)}m`
        });

        // 检查是否看起来正常
        const yIsMax = size.y > size.x && size.y > size.z;
        const bottomNearZero = Math.abs(bbox.min.y) < 1.0;

        if (yIsMax && bottomNearZero) {
          console.log('✅✅✅ 这个旋转看起来是正确的！Y轴最大且底部接近地面');
        } else if (yIsMax) {
          console.log('⚠️  Y轴最大，但底部不在地面（可能需要调整位置）');
        } else {
          console.log('❌ 这个旋转可能不正确（Y轴不是最大尺寸）');
        }

        console.log('\n💡 如果效果不对，可以尝试其他旋转选项，或者撤销：');
        console.log(`   window.applyModelRotation(${modelIndex}, 0) // 恢复原始旋转`);

        // ⭐ 返回诊断信息
        return {
          modelIndex,
          rotation,
          size: { x: size.x, y: size.y, z: size.z },
          bbox: { min: bbox.min, max: bbox.max },
          yIsMax,
          bottomNearZero
        };
      };

      // 显示当前模型列表
      console.log('\n📦 当前模型列表:');
      dualViewer.modelGroup1.children.forEach((model, i) => {
        const fileName = model.userData?.fileName || model.name || 'unnamed';
        const bbox = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        bbox.getSize(size);

        console.log(`模型 ${i}: ${fileName}`, {
          当前旋转: `x=${model.rotation.x.toFixed(2)}°, y=${model.rotation.y.toFixed(2)}°, z=${model.rotation.z.toFixed(2)}°`,
          尺寸: `X=${size.x.toFixed(1)}m, Y=${size.y.toFixed(1)}m, Z=${size.z.toFixed(1)}m`,
          是否大坐标: model.userData?.isLargeCoordModel || false
        });
      });

      console.log('\n🎯 快速测试：');
      console.log('   如果模型3（大坐标模型）倒置，尝试：');
      console.log('   window.applyModelRotation(2, 3) // 模型3，绕X轴+180°');
    },

    // ==================== 地板高度控制方法 ====================

    /**
     * 初始化地板高度控制面板
     */
    initFloorHeightPanel() {
      console.log('[HelloWorld] 🏠 初始化地板高度控制面板...');

      // ⭐ 使用 mercatorProj getter，它会在每次访问时动态获取最新的对象
      // getter 会按优先级从多个源获取 mercatorProjection：
      // 1. window.__mercatorProjectionManager__
      // 2. this.syncManager.mercatorProjection
      // 3. window.syncManager.mercatorProjection
      // 4. dualViewer.mercatorProjection

      if (this.mercatorProj) {
        // 验证对象是否有必需的方法
        const hasSetMethod = typeof this.mercatorProj.setDualFloorHeight === 'function';
        const hasGetMethod = typeof this.mercatorProj.getCurrentFloorHeight === 'function';

        // ⭐ 添加调试信息
        console.log('[HelloWorld] 🔍 MercatorProjectionManager 对象详细信息:', {
          mercatorProj: this.mercatorProj,
          类型: typeof this.mercatorProj,
          constructorName: this.mercatorProj?.constructor?.name,
          是函数: typeof this.mercatorProj === 'function',
          prototype: this.mercatorProj?.prototype,
          所有方法: Object.getOwnPropertyNames(Object.getPrototypeOf(this.mercatorProj) || {}),
          hasSetMethod,
          hasGetMethod
        });

        if (hasSetMethod && hasGetMethod) {
          this.floorHeightPanel.currentHeight = this.mercatorProj.getCurrentFloorHeight() || 0;
          console.log('[HelloWorld] ✅ 地板高度控制面板已初始化:', {
            当前高度: this.floorHeightPanel.currentHeight.toFixed(2) + '米',
            方法检查: {
              setDualFloorHeight: hasSetMethod ? '✓' : '✗',
              getCurrentFloorHeight: hasGetMethod ? '✓' : '✗'
            }
          });
        } else {
          console.error('[HelloWorld] ❌ MercatorProjectionManager 对象缺少必需方法:', {
            setDualFloorHeight: hasSetMethod ? '✓' : '✗',
            getCurrentFloorHeight: hasGetMethod ? '✓' : '✗',
            对象类型: this.mercatorProj.constructor?.name || 'Unknown'
          });
        }
      } else {
        console.warn('[HelloWorld] ⚠️ 未找到 MercatorProjectionManager 实例，地板高度控制功能将不可用');
        console.warn('[HelloWorld] 提示：请先加载模型后再使用此功能');
      }

      // 注册快捷键
      this.registerFloorHeightShortcuts();
    },

    /**
     * 重新获取 MercatorProjectionManager 实例
     * 用于在模型加载后重新初始化
     */
    refreshMercatorProjection() {
      console.log('[HelloWorld] 🔄 重新获取 MercatorProjectionManager...');

      const getMercatorProj = () => {
        if (window.__mercatorProjectionManager__) {
          return window.__mercatorProjectionManager__;
        }
        if (this.syncManager?.mercatorProjection) {
          return this.syncManager.mercatorProjection;
        }
        if (window?.syncManager?.mercatorProjection) {
          return window.syncManager.mercatorProjection;
        }
        if (window.__dualCanvasViewerInstances?.length > 0) {
          const dualViewer = window.__dualCanvasViewerInstances[0];
          if (dualViewer?.mercatorProjection) {
            return dualViewer.mercatorProjection;
          }
        }
        return null;
      };

      this.mercatorProj = getMercatorProj();

      if (this.mercatorProj) {
        const hasSetMethod = typeof this.mercatorProj.setDualFloorHeight === 'function';
        const hasGetMethod = typeof this.mercatorProj.getCurrentFloorHeight === 'function';

        if (hasSetMethod && hasGetMethod) {
          this.floorHeightPanel.currentHeight = this.mercatorProj.getCurrentFloorHeight() || 0;
          console.log('[HelloWorld] ✅ MercatorProjectionManager 已刷新:', {
            当前高度: this.floorHeightPanel.currentHeight.toFixed(2) + '米'
          });
          return true;
        }
      }

      console.warn('[HelloWorld] ⚠️ 刷新失败，未找到有效的 MercatorProjectionManager');
      return false;
    },

    /**
     * 切换地板高度面板显示/隐藏
     */
    toggleFloorHeightPanel() {
      this.floorHeightPanel.visible = !this.floorHeightPanel.visible;

      // ⭐ 当面板打开时，打印当前状态调试信息
      if (this.floorHeightPanel.visible) {
        setTimeout(() => {
          const dualViewer = window.__dualCanvasViewerInstances?.[0];
          if (dualViewer && dualViewer.camera1 && dualViewer.anchorContainer1) {
            console.log('[HelloWorld] 📊 地板高度面板状态检查:', {
              '=== 坐标系状态 ===': '===',
              '相机 Y': dualViewer.camera1.position.y.toFixed(2) + '米',
              'anchorContainer Y': dualViewer.anchorContainer1.position.y.toFixed(2) + '米',
              '模型海拔': this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z?.toFixed(2) + '米' || '未知',
              '地板偏移(用户设置)': this.syncManager?.mercatorProjection?.getDualFloorHeight?.()?.toFixed(2) + '米' || '未知',
              '=== 计算公式 ===': '===',
              '说明': 'anchorContainer Y = 模型海拔 + 地板偏移',
              '预期值': (parseFloat(this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z || 0) + parseFloat(this.syncManager?.mercatorProjection?.getDualFloorHeight?.() || 0)).toFixed(2) + '米'
            });
          }
        }, 100);
      }
    },

    /**
     * 处理高度滑块变化
     */
    onFloorHeightChange(event) {
      const newHeight = parseFloat(event.target.value);
      this.updateFloorHeight(newHeight);
    },

    /**
     * 处理高度输入框变化
     */
    onFloorHeightInputChange(event) {
      const newHeight = parseFloat(event.target.value);
      if (!isNaN(newHeight)) {
        this.updateFloorHeight(newHeight);
      }
    },

    /**
     * 更新地板高度
     * @param {number} height - 新的高度值（米）
     */
    updateFloorHeight(height) {
      // 首先检查 mercatorProj 是否存在
      if (!this.mercatorProj) {
        console.warn('[HelloWorld] MercatorProjectionManager 不可用，尝试重新获取...');

        // 尝试重新获取
        if (this.refreshMercatorProjection()) {
          // 重新获取成功，继续更新
        } else {
          console.error('[HelloWorld] ❌ 无法获取 MercatorProjectionManager，请先加载模型');
          alert('请先加载模型后再使用地板高度控制功能');
          return;
        }
      }

      // 检查方法是否存在
      if (typeof this.mercatorProj.setDualFloorHeight !== 'function') {
        console.error('[HelloWorld] ❌ setDualFloorHeight 方法不存在');
        return;
      }

      try {
        this.floorHeightPanel.currentHeight = height;
        this.mercatorProj.setDualFloorHeight(height);

        // ⭐ 调试日志：检查地板高度更新后的状态
        console.log('[HelloWorld] 🔍 地板高度更新调试信息:', {
          设置的偏移: height.toFixed(2) + '米'
        });

        // 延迟一点检查实际状态，等待 anchorContainer 更新完成
        setTimeout(() => {
          const dualViewer = window.__dualCanvasViewerInstances?.[0];
          if (dualViewer && dualViewer.camera1 && dualViewer.anchorContainer1) {
            console.log('[HelloWorld] 📊 更新后状态检查:', {
              '相机 Y': dualViewer.camera1.position.y.toFixed(2) + '米',
              'anchorContainer Y': dualViewer.anchorContainer1.position.y.toFixed(2) + '米',
              '模型海拔': this.syncManager?.mercatorProjection?.modelAbsoluteMercator?.z?.toFixed(2) + '米' || '未知',
              '地板偏移': this.syncManager?.mercatorProjection?.getDualFloorHeight?.()?.toFixed(2) + '米' || '未知'
            });
          }
        }, 100);

        console.log('[HelloWorld] ✅ 地板高度已更新:', {
          新高度: height.toFixed(2) + '米'
        });

        // ⭐ 关键修复：调用 DualCanvasViewer 的动态计算方法更新 anchorContainer 位置
        const dualViewer = window.__dualCanvasViewerInstances?.[0];

        if (dualViewer && typeof dualViewer.updateAnchorContainerPosition === 'function') {
          // 使用 DualCanvasViewer 的动态计算方法
          dualViewer.updateAnchorContainerPosition();

          // 获取模型海拔（用于日志）
          let modelAltitude = 0;
          if (dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
            const firstModel = dualViewer.modelGroup1.children[0];
            modelAltitude = firstModel.userData?.originalLocation?.cartographic?.height || 0;
          }

          console.log('[HelloWorld] ✅ anchorContainer 位置已动态更新:', {
            模型海拔: modelAltitude.toFixed(2) + '米',
            地板高度: height.toFixed(2) + '米',
            anchorContainerY: dualViewer.anchorContainer1.position.y.toFixed(2) + '米',
            说明: '使用 updateAnchorContainerPosition() 动态计算'
          });
        }

        // 更新 GridHelper 位置
        this.updateDualFloorVisuals(height);
      } catch (error) {
        console.error('[HelloWorld] ❌ 更新地板高度失败:', error);
      }
    },

    /**
     * 同步更新 DualCanvasViewer 中的红色球体和地板位置
     * @param {number} height - 新的地板高度（米）
     */
    updateDualFloorVisuals(height) {
      // 获取 DualCanvasViewer 实例
      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (!dualViewer) {
        console.warn('[HelloWorld] DualCanvasViewer 不可用，无法更新视觉效果');
        return;
      }

      try {
        // ⭐ 关键修复：红色球体在 anchorContainer1 中，局部位置固定为 Y = 0
        // 不需要手动更新位置，它会自动跟随 anchorContainer1 移动
        // 我们只需要确保 anchorContainer1 的位置正确（已在 updateFloorHeight 中调用 updateAnchorContainerPosition）

        // 更新GridHelper（注意：GridHelper 在 sceneContainer1 中，不在 anchorContainer1 中）
        if (dualViewer.gridHelper1) {
          const oldY = dualViewer.gridHelper1.position.y;

          // ⭐ 关键修复：GridHelper 应该与 anchorContainer1 的位置一致
          // anchorContainer1.position.y 已经在 updateAnchorContainerPosition 中设置
          // GridHelper 在 sceneContainer1 中，需要直接设置其世界坐标 Y
          const anchorContainerY = dualViewer.anchorContainer1?.position.y || 0;

          dualViewer.gridHelper1.position.y = anchorContainerY;
          dualViewer.gridHelper1.updateMatrixWorld(true);

          console.log('[HelloWorld] ✅ 层1 GridHelper 位置已更新:', {
            旧Y: oldY.toFixed(2) + '米',
            新Y: dualViewer.gridHelper1.position.y.toFixed(2) + '米',
            anchorContainerY: anchorContainerY.toFixed(2) + '米',
            说明: 'GridHelper 与 anchorContainer 位置同步'
          });
        }

        // 更新层2的红色球体位置
        // ⭐ 关键修复：红色球体在 anchorContainer2 中，局部位置固定为 Y = 0
        // 不需要手动更新位置，它会自动跟随 anchorContainer2 移动

        // 更新层2的 GridHelper
        if (dualViewer.gridHelper2) {
          const oldY2 = dualViewer.gridHelper2.position.y;

          // ⭐ 关键修复：GridHelper 应该与 anchorContainer2 的位置一致
          const anchorContainerY2 = dualViewer.anchorContainer2?.position.y || 0;

          dualViewer.gridHelper2.position.y = anchorContainerY2;
          dualViewer.gridHelper2.updateMatrixWorld(true);

          console.log('[HelloWorld] ✅ 层2 GridHelper 位置已更新:', {
            旧Y: oldY2.toFixed(2) + '米',
            新Y: dualViewer.gridHelper2.position.y.toFixed(2) + '米',
            anchorContainerY: anchorContainerY2.toFixed(2) + '米',
            说明: 'GridHelper 与 anchorContainer 位置同步'
          });
        }

        // ⭐ 触发渲染器重新渲染
        if (dualViewer.renderer1) {
          dualViewer.renderer1.render(dualViewer.scene1, dualViewer.camera1);
        }
        if (dualViewer.renderer2 && dualViewer.scene2 && dualViewer.camera2) {
          dualViewer.renderer2.render(dualViewer.scene2, dualViewer.camera2);
        }

        console.log('[HelloWorld] ✅ 视觉效果已同步更新');
      } catch (error) {
        console.error('[HelloWorld] ❌ 更新视觉效果失败:', error);
      }
    },

    /**
     * 重置地板高度到地形高度
     */
    async resetFloorHeightToTerrain() {
      // 获取当前相机位置的经纬度
      const cameraPosition = this.cesiumViewer.camera.position;
      const ellipsoid = this.Cesium.Ellipsoid.WGS84;
      const cartographic = ellipsoid.cartesianToCartographic(cameraPosition);

      const longitude = this.Cesium.Math.toDegrees(cartographic.longitude);
      const latitude = this.Cesium.Math.toDegrees(cartographic.latitude);

      console.log('[HelloWorld] 🔄 开始采样地形高度...', {
        位置: `(${longitude.toFixed(6)}°, ${latitude.toFixed(6)}°)`
      });

      try {
        // 检查是否有地形提供器
        const hasTerrain = this.cesiumViewer.terrainProvider;
        console.log('[HelloWorld] 🔍 地形提供器状态:', {
          是否存在: !!hasTerrain,
          类型: hasTerrain ? hasTerrain.constructor?.name : 'None'
        });

        // 方案1: 使用 sampleHeightMostDetailed 采样
        const position = this.Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );

        let terrainHeight = null;
        let useFallback = false;

        // 尝试采样地形
        const heights = await this.cesiumViewer.scene.sampleHeightMostDetailed([position]);

        if (heights && heights[0] !== undefined && !isNaN(heights[0]) && isFinite(heights[0])) {
          terrainHeight = heights[0];
          console.log('[HelloWorld] ✅ 地形采样成功:', {
            地形高度: terrainHeight.toFixed(2) + '米'
          });
        } else {
          console.warn('[HelloWorld] ⚠️ 地形采样返回无效值，使用椭球体表面作为备用方案');
          useFallback = true;
        }

        // 方案2: 备用方案 - 使用椭球体表面
        if (terrainHeight === null || useFallback) {
          // 尝试使用 pickPosition 获取地面高度
          try {
            const ray = new this.Cesium.Ray(
              cameraPosition,
              this.Cesium.Cartesian3.negate(this.cesiumViewer.camera.direction, new this.Cesium.Cartesian3())
            );
            const intersection = this.Cesium.IntersectionTests.rayEllipsoid(
              ray,
              ellipsoid
            );

            if (intersection) {
              const intersectionCartographic = ellipsoid.cartesianToCartographic(
                intersection,
                new this.Cesium.Cartographic()
              );
              terrainHeight = intersectionCartographic.height;

              console.log('[HelloWorld] ✅ 使用椭球体表面交点:', {
                地形高度: terrainHeight.toFixed(2) + '米',
                说明: '椭球体表面高度（通常为0米）'
              });
            }
          } catch (ellipsoidError) {
            console.warn('[HelloWorld] ⚠️ 椭球体交点计算失败，使用默认值 0 米');
          }
        }

        // 方案3: 最后备用 - 使用模型海拔或 0 米
        if (terrainHeight === null || isNaN(terrainHeight) || !isFinite(terrainHeight)) {
          // ⭐ 关键修复：在局部坐标系模式下，使用模型海拔作为默认值
          let defaultHeight = 0;
          const dualViewer = window.__dualCanvasViewerInstances?.[0];

          if (dualViewer && dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
            const firstModel = dualViewer.modelGroup1.children[0];
            const modelAltitude = firstModel.userData?.originalLocation?.cartographic?.height;
            if (modelAltitude !== undefined && modelAltitude !== 0) {
              defaultHeight = modelAltitude;
              console.log('[HelloWorld] ✅ 使用模型海拔作为默认高度:', {
                模型海拔: modelAltitude.toFixed(2) + '米'
              });
            }
          }

          terrainHeight = defaultHeight;
          console.warn('[HelloWorld] ⚠️ 所有方案失败，使用默认值:', {
            默认高度: terrainHeight.toFixed(2) + '米',
            说明: terrainHeight === 0 ? '椭球体表面' : '模型海拔'
          });
        }

        // 限制高度范围
        terrainHeight = Math.max(-1000, Math.min(10000, terrainHeight));

        // 使用 updateFloorHeight 统一更新（包含视觉效果）
        this.updateFloorHeight(terrainHeight);

        console.log('[HelloWorld] ✅ 地板高度已重置:', {
          位置: `(${longitude.toFixed(6)}°, ${latitude.toFixed(6)}°)`,
          最终高度: terrainHeight.toFixed(2) + '米',
          使用的方案: useFallback ? '椭球体表面' : '地形采样'
        });

      } catch (error) {
        console.error('[HelloWorld] ❌ 重置地板高度失败:', error);

        // 出错时使用 0 米作为安全值
        this.updateFloorHeight(0);
        console.log('[HelloWorld] ✅ 已设置到安全值: 0 米（椭球体表面）');
      }
    },

    /**
     * 重置地板高度到默认值（从模型海拔动态获取）
     */
    resetFloorHeightToDefault() {
      const defaultHeight = this.floorHeightPanel.defaultHeight;
      this.updateFloorHeight(defaultHeight);
      console.log('[HelloWorld] ✅ 地板高度已重置到默认值:', {
        高度: defaultHeight.toFixed(2) + '米',
        来源: '模型海拔'
      });
    },

    /**
     * 注册地板高度控制快捷键
     */
    registerFloorHeightShortcuts() {
      this.floorHeightKeydownHandler = (event) => {
        // 避免在输入框中触发快捷键
        if (event.target.tagName === 'INPUT') return;

        switch(event.key) {
          case 'h':
          case 'H':
            this.toggleFloorHeightPanel();
            break;
          case 'ArrowUp': {
            event.preventDefault();
            const deltaUp = event.shiftKey ? 10 : 1;
            this.updateFloorHeight(this.floorHeightPanel.currentHeight + deltaUp);
            break;
          }
          case 'ArrowDown': {
            event.preventDefault();
            const deltaDown = event.shiftKey ? 10 : 1;
            this.updateFloorHeight(this.floorHeightPanel.currentHeight - deltaDown);
            break;
          }
        }
      };

      window.addEventListener('keydown', this.floorHeightKeydownHandler);
      console.log('[HelloWorld] ✅ 地板高度快捷键已注册');
    },

    /**
     * 注销地板高度控制快捷键
     */
    unregisterFloorHeightShortcuts() {
      if (this.floorHeightKeydownHandler) {
        window.removeEventListener('keydown', this.floorHeightKeydownHandler);
        console.log('[HelloWorld] ✅ 地板高度快捷键已注销');
      }
    },
    // ==================== 左键翻转同步相关方法 ====================
    /**
     * 初始化左键翻转状态
     * 记录翻转前的 Cesium 墨卡托坐标和 dual 地板状态
     */
    initLeftFlipState() {
      console.log('[LeftFlip] 初始化左键翻转状态');

      // 清除之前的保护状态，允许新的翻转操作
      if (this.syncManager && this.syncManager.leftFlipProtection) {
        this.syncManager.leftFlipProtection.enabled = false;
        console.log('[LeftFlip] 清除之前的保护状态');
      }

      // ⭐ 检查 cesiumViewer 是否存在
      if (!this.cesiumViewer) {
        console.warn('[LeftFlip] cesiumViewer 为 null，跳过初始化');
        return;
      }

      // ⭐ 检查 cesiumViewer.scene 是否存在
      if (!this.cesiumViewer.scene) {
        console.warn('[LeftFlip] cesiumViewer.scene 为 null，跳过初始化');
        return;
      }

      const Cesium = this.Cesium;
      const camera = this.cesiumViewer.camera;
      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      // 验证相机位置是否有效
      if (!camera || !camera.position) {
        console.warn('[LeftFlip] 相机位置无效，跳过初始化');
        return;
      }

      // 检查相机位置坐标是否为有效数字
      if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z) ||
          !isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
        console.warn('[LeftFlip] 相机位置坐标无效，跳过初始化:', {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        });
        return;
      }

      // 1. 记录 Cesium 墨卡托坐标（相机位置）
      let cameraCartographic;
      try {
        cameraCartographic = ellipsoid.cartesianToCartographic(camera.position);
      } catch (error) {
        console.warn('[LeftFlip] 转换相机坐标失败:', error);
        return;
      }

      if (!cameraCartographic) {
        console.warn('[LeftFlip] 坐标转换返回 null，跳过初始化');
        return;
      }
      const cameraMercator = {
        x: cameraCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + cameraCartographic.latitude / 2)) * earthRadius,
        z: cameraCartographic.height
      };

      // 2. 记录 Cesium 墨卡托坐标（目标点）
      let targetCartographic = null;
      try {
        // 验证相机方向向量是否有效
        let rayDirection = camera.direction;

        // 检查 direction 是否为有效向量
        if (!rayDirection ||
            isNaN(rayDirection.x) || isNaN(rayDirection.y) || isNaN(rayDirection.z) ||
            !isFinite(rayDirection.x) || !isFinite(rayDirection.y) || !isFinite(rayDirection.z)) {

          console.warn('[LeftFlip] 相机方向向量无效，计算向下方向:', {
            direction: rayDirection,
            position: camera.position,
            up: camera.up
          });

          // 使用地球法线的负方向（向下）作为替代
          const positionCartographic = ellipsoid.cartesianToCartographic(camera.position);
          const toENU = Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.ZERO,
            new Cesium.Cartographic(
              positionCartographic.longitude,
              positionCartographic.latitude,
              positionCartographic.height
            )
          );

          // 向下的方向（使用地球法线的负方向）
          const down = Cesium.Cartesian3.clone(camera.position);
          Cesium.Cartesian3.normalize(down, down);
          rayDirection = Cesium.Cartesian3.negate(down, new Cesium.Cartesian3());
        }

        // 再次验证方向向量
        const rayDirectionLength = Cesium.Cartesian3.magnitude(rayDirection);
        if (rayDirectionLength < 0.0001) {
          console.warn('[LeftFlip] 方向向量长度接近零，使用默认向下方向');
          // 使用地球中心到相机位置的向量作为向下方向
          rayDirection = Cesium.Cartesian3.negate(
            Cesium.Cartesian3.normalize(camera.position, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
        }

        const ray = new Cesium.Ray(camera.position, rayDirection);
        const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (Cesium.defined(targetPosition)) {
          targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
        } else {
          targetCartographic = Cesium.Cartographic.fromRadians(
            cameraCartographic.longitude,
            cameraCartographic.latitude,
            0
          );
        }
      } catch (error) {
        console.warn('[LeftFlip] 射线求交失败，使用相机正下方点:', error);
        targetCartographic = Cesium.Cartographic.fromRadians(
          cameraCartographic.longitude,
          cameraCartographic.latitude,
          0
        );
      }

      const targetMercator = {
        x: targetCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + targetCartographic.latitude / 2)) * earthRadius,
        z: 0
      };

      // 3. 记录 dual 地板状态
      let dualCameraState = null;
      if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
        const dualViewer = window.__dualCanvasViewerInstances[0];

        // ⭐ 关键修复：检查是否使用局部坐标系
        const useLocalCoordSystem = dualViewer.syncManager?.mercatorProjection?.isUsingLocalCoordinateSystem?.();

        if (useLocalCoordSystem) {
          console.log('[LeftFlip] ⭐ 检测到局部坐标系模式，禁用 LeftFlip 翻转功能');
          console.log('[LeftFlip] 原因：局部坐标系模式下，Dual 相机使用相对位置（小坐标），不适配墨卡托投影计算');
          this.leftFlipState = {
            isActive: false, // ⭐ 禁用 LeftFlip
            reason: 'local_coord_mode'
          };
          return; // ⭐ 直接返回，不记录初始状态
        }

        if (dualViewer.camera1) {
          dualCameraState = {
            cameraPosition: {
              x: dualViewer.camera1.position.x,
              y: dualViewer.camera1.position.y,
              z: dualViewer.camera1.position.z
            },
            targetPosition: {
              x: dualViewer.controls1.target.x,
              y: dualViewer.controls1.target.y,
              z: dualViewer.controls1.target.z
            },
            quaternion: {
              x: dualViewer.camera1.quaternion.x,
              y: dualViewer.camera1.quaternion.y,
              z: dualViewer.camera1.quaternion.z,
              w: dualViewer.camera1.quaternion.w
            },
            up: {
              x: dualViewer.camera1.up.x,
              y: dualViewer.camera1.up.y,
              z: dualViewer.camera1.up.z
            }
          };

          console.log('[LeftFlip] ✓ 已记录 Dual 相机状态（全局坐标系）:', {
            cameraPosition: `(${dualCameraState.cameraPosition.x.toFixed(2)}, ${dualCameraState.cameraPosition.y.toFixed(2)}, ${dualCameraState.cameraPosition.z.toFixed(2)})`
          });
        }
      }

      // 保存状态
      this.leftFlipState = {
        isActive: true,
        startTime: Date.now(),
        cesiumInitial: {
          cameraMercator: cameraMercator,
          targetMercator: targetMercator
        },
        dualInitial: dualCameraState
      };

      console.log('[LeftFlip] 初始状态已记录:', {
        cameraMercator: cameraMercator,
        targetMercator: targetMercator,
        hasDualState: !!dualCameraState
      });
    },
    /**
     * 应用左键翻转同步
     * 计算 Cesium 墨卡托坐标变化量并应用到 dual 地板
     */
    applyLeftFlipSync() {
      if (!this.leftFlipState.isActive || !this.leftFlipState.dualInitial) {
        console.log('[LeftFlip] 非翻转操作或缺少初始状态，跳过');
        return;
      }

      // ⭐ 检查是否使用局部墨卡托坐标系
      const useLocalCoordSystem = this.syncManager && this.syncManager.mercatorProjection &&
                                  this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem &&
                                  this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem();

      if (useLocalCoordSystem) {
        console.log('[LeftFlip] ⭐ 检测到局部坐标系模式，跳过 LeftFlip（由 handleRotateInUnified 处理）');
        // 在局部坐标系模式下：
        // 1. handleRotateInUnified 已经更新了 unifiedCameraState（包括正确的 target）
        // 2. syncUnifiedToThree 已经将状态同步到 dual 相机
        // 3. 场景容器不需要旋转（保持 identity）
        // 因此 LeftFlip 不需要做任何事情
        this.leftFlipState.isActive = false;
        return;
      }

      const Cesium = this.Cesium;
      const camera = this.cesiumViewer.camera;
      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      // 验证相机位置是否有效
      if (!camera || !camera.position) {
        console.warn('[LeftFlip] 相机位置无效，跳过同步');
        this.leftFlipState.isActive = false;
        return;
      }

      // 检查相机位置坐标是否为有效数字
      if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z) ||
          !isFinite(camera.position.x) || !isFinite(camera.position.y) || !isFinite(camera.position.z)) {
        console.warn('[LeftFlip] 相机位置坐标无效，跳过同步:', {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        });
        this.leftFlipState.isActive = false;
        return;
      }

      // 1. 计算翻转后的 Cesium 墨卡托坐标
      let cameraCartographic;
      try {
        cameraCartographic = ellipsoid.cartesianToCartographic(camera.position);
      } catch (error) {
        console.warn('[LeftFlip] 转换相机坐标失败:', error);
        this.leftFlipState.isActive = false;
        return;
      }

      if (!cameraCartographic) {
        console.warn('[LeftFlip] 坐标转换返回 null，跳过同步');
        this.leftFlipState.isActive = false;
        return;
      }
      const cameraMercator = {
        x: cameraCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + cameraCartographic.latitude / 2)) * earthRadius,
        z: cameraCartographic.height
      };

      // 计算目标点
      let targetCartographic = null;
      try {
        // 验证相机方向向量是否有效
        let rayDirection = camera.direction;

        // 检查 direction 是否为有效向量
        if (!rayDirection ||
            isNaN(rayDirection.x) || isNaN(rayDirection.y) || isNaN(rayDirection.z) ||
            !isFinite(rayDirection.x) || !isFinite(rayDirection.y) || !isFinite(rayDirection.z)) {

          console.warn('[LeftFlip] 相机方向向量无效，计算向下方向:', {
            direction: rayDirection,
            position: camera.position,
            up: camera.up
          });

          // 使用地球法线的负方向（向下）作为替代
          const positionCartographic = ellipsoid.cartesianToCartographic(camera.position);
          const toENU = Cesium.Transforms.eastNorthUpToFixedFrame(
            Cesium.Cartesian3.ZERO,
            new Cesium.Cartographic(
              positionCartographic.longitude,
              positionCartographic.latitude,
              positionCartographic.height
            )
          );

          // 向下的方向（使用地球法线的负方向）
          const down = Cesium.Cartesian3.clone(camera.position);
          Cesium.Cartesian3.normalize(down, down);
          rayDirection = Cesium.Cartesian3.negate(down, new Cesium.Cartesian3());
        }

        // 再次验证方向向量
        const rayDirectionLength = Cesium.Cartesian3.magnitude(rayDirection);
        if (rayDirectionLength < 0.0001) {
          console.warn('[LeftFlip] 方向向量长度接近零，使用默认向下方向');
          // 使用地球中心到相机位置的向量作为向下方向
          rayDirection = Cesium.Cartesian3.negate(
            Cesium.Cartesian3.normalize(camera.position, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
          );
        }

        const ray = new Cesium.Ray(camera.position, rayDirection);
        const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (Cesium.defined(targetPosition)) {
          targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
        } else {
          targetCartographic = Cesium.Cartographic.fromRadians(
            cameraCartographic.longitude,
            cameraCartographic.latitude,
            0
          );
        }
      } catch (error) {
        console.warn('[LeftFlip] 射线求交失败，使用相机正下方点:', error);
        targetCartographic = Cesium.Cartographic.fromRadians(
          cameraCartographic.longitude,
          cameraCartographic.latitude,
          0
        );
      }

      const targetMercator = {
        x: targetCartographic.longitude * earthRadius,
        y: Math.log(Math.tan(Math.PI / 4 + targetCartographic.latitude / 2)) * earthRadius,
        z: 0
      };

      // 2. 计算墨卡托坐标系中的变化量
      const initial = this.leftFlipState.cesiumInitial;

      const mercatorPositionDelta = {
        x: cameraMercator.x - initial.cameraMercator.x,
        y: cameraMercator.y - initial.cameraMercator.y,
        z: cameraMercator.z - initial.cameraMercator.z
      };

      const mercatorTargetDelta = {
        x: targetMercator.x - initial.targetMercator.x,
        y: targetMercator.y - initial.targetMercator.y,
        z: targetMercator.z - initial.targetMercator.z
      };

      console.log('[LeftFlip] 计算墨卡托变化量:', {
        positionDelta: mercatorPositionDelta,
        targetDelta: mercatorTargetDelta
      });

      // 3. 应用变化量到 dual 地板
      this.applyMercatorDeltaToDual(mercatorPositionDelta, mercatorTargetDelta);

      // 4. 设置永久保护（直到下次左键翻转开始）
      // 使用 cesium-dual-sync 的 preserveRotation 机制来保持旋转角度
      // 这样可以防止 Three.js → Cesium 的同步覆盖我们的修改
      if (this.syncManager && this.syncManager.leftFlipProtection) {
        this.syncManager.leftFlipProtection.enabled = true;
        this.syncManager.leftFlipProtection.until = Date.now() + 60000; // 60秒保护窗口
        console.log('[LeftFlip] 设置左键翻转保护：60秒');
      } else {
        console.warn('[LeftFlip] leftFlipProtection 不可用，跳过保护设置');
      }

      // 5. 清除状态
      this.leftFlipState.isActive = false;

      console.log('[LeftFlip] 翻转同步完成');
    },
    /**
     * 仅应用旋转同步（用于局部坐标系模式）
     * 在局部坐标系模式下，地板高度为 0 时与 Cesium 地面叠合
     * 此时翻转应该只同步旋转角度，不应该改变相机位置
     */
    applyRotationSyncOnly() {
      if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
        console.warn('[LeftFlip] DualCanvasViewer 实例不可用');
        return;
      }

      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (!dualViewer.camera1 || !dualViewer.controls1) {
        console.warn('[LeftFlip] Dual 相机未就绪');
        return;
      }

      const Cesium = this.Cesium;
      const camera = this.cesiumViewer.camera;

      // 1. 从 Cesium 获取相机状态并转换为 Three.js 坐标系
      const cesiumBasis = {
        direction: new THREE.Vector3(
          camera.direction.x,
          -camera.direction.z,  // Cesium Z → Three.js Y (反向)
          camera.direction.y     // Cesium Y → Three.js Z
        ),
        up: new THREE.Vector3(
          camera.up.x,
          -camera.up.z,
          camera.up.y
        )
      };

      // 归一化
      cesiumBasis.direction.normalize();
      cesiumBasis.up.normalize();

      // 计算右向量
      const right = new THREE.Vector3();
      right.crossVectors(cesiumBasis.direction, cesiumBasis.up).normalize();

      // 使用 setFromBasis 方法直接设置四元数
      const quaternion = new THREE.Quaternion();
      const matrix = new THREE.Matrix4();
      matrix.makeBasis(right, cesiumBasis.up, cesiumBasis.direction);
      quaternion.setFromRotationMatrix(matrix);

      // 2. 只更新相机的旋转和 up 向量，不改变位置
      dualViewer.camera1.quaternion.copy(quaternion);
      dualViewer.camera1.up.copy(cesiumBasis.up);

      // 3. 更新 target：保持原始距离，只改变方向
      const initial = this.leftFlipState.dualInitial;
      const distance = initial.targetPosition ?
        Math.sqrt(
          Math.pow(initial.targetPosition.x - initial.cameraPosition.x, 2) +
          Math.pow(initial.targetPosition.y - initial.cameraPosition.y, 2) +
          Math.pow(initial.targetPosition.z - initial.cameraPosition.z, 2)
        ) : 1000;

      // 使用新的方向向量计算 target 位置
      const direction = cesiumBasis.direction.clone();
      dualViewer.controls1.target.set(
        dualViewer.camera1.position.x + direction.x * distance,
        dualViewer.camera1.position.y + direction.y * distance,
        dualViewer.camera1.position.z + direction.z * distance
      );

      // 4. 同步到第二个相机
      if (dualViewer.camera2) {
        dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);
        dualViewer.camera2.up.copy(dualViewer.camera1.up);

        if (dualViewer.controls2) {
          dualViewer.controls2.target.copy(dualViewer.controls1.target);
        }
      }

      // 5. 更新矩阵
      dualViewer.camera1.updateMatrixWorld();
      if (dualViewer.camera2) {
        dualViewer.camera2.updateMatrixWorld();
      }

      console.log('[LeftFlip] 局部坐标系模式：仅应用旋转同步', {
        相机位置: dualViewer.camera1.position,
        target: dualViewer.controls1.target,
        方向向量: direction
      });
    },
    /**
     * 将墨卡托变化量应用到 dual 地板
     * @param {Object} mercatorPositionDelta - 相机位置墨卡托变化量
     * @param {Object} mercatorTargetDelta - 目标点墨卡托变化量
     */
    applyMercatorDeltaToDual(mercatorPositionDelta, mercatorTargetDelta) {
      if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
        console.warn('[LeftFlip] DualCanvasViewer 实例不可用');
        return;
      }

      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (!dualViewer.camera1 || !dualViewer.controls1) {
        console.warn('[LeftFlip] Dual 相机未就绪');
        return;
      }

      const initial = this.leftFlipState.dualInitial;

      // 1. 将墨卡托变化量转换为 Three.js 坐标变化量
      // 墨卡托：X=东西, Y=南北, Z=高度
      // Three.js：X=东西, Y=高度, Z=南北(向南为正)
      const scale = this.syncManager ? this.syncManager.scale : 1;

      const threePositionDelta = {
        x: mercatorPositionDelta.x / scale,
        y: mercatorPositionDelta.z / scale,
        z: -mercatorPositionDelta.y / scale
      };

      const threeTargetDelta = {
        x: mercatorTargetDelta.x / scale,
        y: mercatorTargetDelta.z / scale,
        z: -mercatorTargetDelta.y / scale
      };

      // 2. 计算新的位置
      const newPosition = {
        x: initial.cameraPosition.x + threePositionDelta.x,
        y: initial.cameraPosition.y + threePositionDelta.y,
        z: initial.cameraPosition.z + threePositionDelta.z
      };

      const newTarget = {
        x: initial.targetPosition.x + threeTargetDelta.x,
        y: initial.targetPosition.y + threeTargetDelta.y,
        z: initial.targetPosition.z + threeTargetDelta.z
      };

      // 3. 关键修复：直接从 Cesium 获取相机状态并转换为 Three.js 坐标系
      const Cesium = this.Cesium;
      const camera = this.cesiumViewer.camera;

      // 创建一个临时对象，用于转换 Cesium 的相机基座
      const cesiumBasis = {
        direction: new THREE.Vector3(
          camera.direction.x,
          -camera.direction.z,  // Cesium Z → Three.js Y (反向)
          camera.direction.y     // Cesium Y → Three.js Z
        ),
        up: new THREE.Vector3(
          camera.up.x,
          -camera.up.z,
          camera.up.y
        )
      };

      // 归一化
      cesiumBasis.direction.normalize();
      cesiumBasis.up.normalize();

      // 计算右向量
      const right = new THREE.Vector3();
      right.crossVectors(cesiumBasis.direction, cesiumBasis.up).normalize();

      // 使用 setFromBasis 方法直接设置四元数
      const quaternion = new THREE.Quaternion();
      const matrix = new THREE.Matrix4();
      matrix.makeBasis(right, cesiumBasis.up, cesiumBasis.direction);
      quaternion.setFromRotationMatrix(matrix);

      // ⭐ 关键修复：当计算的 Y 坐标异常时，使用原始 Y 坐标（保持翻转前的高度）
      // 问题：LeftFlip 计算的 Y 坐标可能异常（如 -933），导致相机跑到地下
      // 解决：异常时使用翻转前的 Y 坐标，而不是强制修正到最小值
      const SAFE_CAMERA_Y_MIN = 50;  // 低于此值认为异常
      const SAFE_CAMERA_Y_MAX = 2000; // 高于此值认为异常

      let finalCameraY = newPosition.y;
      let usingOriginalY = false;

      if (finalCameraY < SAFE_CAMERA_Y_MIN || finalCameraY > SAFE_CAMERA_Y_MAX) {
        console.warn('[LeftFlip] ⚠️⚠️⚠️ 计算的相机 Y 异常，使用原始 Y 坐标:', {
          原始相机Y: initial.cameraPosition.y.toFixed(2),
          计算相机Y: newPosition.y.toFixed(2),
          原始相机位置: `(${initial.cameraPosition.x.toFixed(2)}, ${initial.cameraPosition.y.toFixed(2)}, ${initial.cameraPosition.z.toFixed(2)})`,
          计算相机位置: `(${newPosition.x.toFixed(2)}, ${newPosition.y.toFixed(2)}, ${newPosition.z.toFixed(2)})`
        });
        finalCameraY = initial.cameraPosition.y;
        usingOriginalY = true;
      }

      // 更新 dual 相机（使用修正后的 Y 坐标）
      dualViewer.camera1.position.set(newPosition.x, finalCameraY, newPosition.z);
      dualViewer.camera1.quaternion.copy(quaternion);
      dualViewer.camera1.up.copy(cesiumBasis.up);

      // 更新 controls 的目标点
      // 从位置和方向计算目标点
      const direction = cesiumBasis.direction.clone();
      const distance = initial.targetPosition ?
        Math.sqrt(
          Math.pow(initial.targetPosition.x - initial.cameraPosition.x, 2) +
          Math.pow(initial.targetPosition.y - initial.cameraPosition.y, 2) +
          Math.pow(initial.targetPosition.z - initial.cameraPosition.z, 2)
        ) : 1000;

      // ⭐ 关键修复：限制 target 的 Y 坐标，防止跑到地下或太高
      // 如果使用了原始 Y，target 也要相应调整
      const MIN_SAFE_TARGET_Y = 0;    // target Y 最小值（地面）
      const MAX_SAFE_TARGET_Y = 500;  // target Y 最大值

      let calculatedTargetY;
      if (usingOriginalY) {
        // 使用原始 Y 时，根据原始 target 和相机 Y 的差值计算
        const originalYDiff = initial.targetPosition.y - initial.cameraPosition.y;
        calculatedTargetY = finalCameraY + originalYDiff;
      } else {
        // 正常情况：根据方向向量计算
        calculatedTargetY = finalCameraY + direction.y * distance;
      }

      let finalTargetY = calculatedTargetY;

      // 限制 target Y 坐标范围
      if (finalTargetY < MIN_SAFE_TARGET_Y) {
        console.warn('[LeftFlip] ⚠️ 计算 target Y 过低，强制修正:', {
          原始targetY: calculatedTargetY.toFixed(2),
          修正后targetY: MIN_SAFE_TARGET_Y.toFixed(2),
          相机Y: finalCameraY.toFixed(2),
          directionY: direction.y.toFixed(3),
          usingOriginalY: usingOriginalY
        });
        finalTargetY = MIN_SAFE_TARGET_Y;
      } else if (finalTargetY > MAX_SAFE_TARGET_Y) {
        console.warn('[LeftFlip] ⚠️ 计算 target Y 过高，强制修正:', {
          原始targetY: calculatedTargetY.toFixed(2),
          修正后targetY: MAX_SAFE_TARGET_Y.toFixed(2),
          相机Y: finalCameraY.toFixed(2),
          directionY: direction.y.toFixed(3)
        });
        finalTargetY = MAX_SAFE_TARGET_Y;
      }

      dualViewer.controls1.target.set(
        newPosition.x + direction.x * distance,
        finalTargetY,  // 使用修正后的 Y 坐标
        newPosition.z + direction.z * distance
      );

      // 4. 同步到第二个相机
      if (dualViewer.camera2) {
        dualViewer.camera2.position.copy(dualViewer.camera1.position);
        dualViewer.camera2.quaternion.copy(dualViewer.camera1.quaternion);
        dualViewer.camera2.up.copy(dualViewer.camera1.up);

        if (dualViewer.controls2) {
          dualViewer.controls2.target.copy(dualViewer.controls1.target);
        }
      }

      // 5. 更新矩阵
      dualViewer.camera1.updateMatrixWorld();
      if (dualViewer.camera2) {
        dualViewer.camera2.updateMatrixWorld();
      }

      console.log('[LeftFlip] dual 地板已更新:', {
        position: newPosition,
        target: dualViewer.controls1.target
      });
    }
  },
  mounted() {
    // ⭐ 初始化多实例配置管理器
    this.initMultiInstanceConfig();

    // 缓存 instanceId 避免重复访问
    const instanceId = this.instanceId || 1;

    // ⭐ 预加载并预注册启用的面板组件（提升首次打开速度）
    // 根据配置文件中的 visible 字段决定是否默认显示
    this.$nextTick(async () => {
      try {
        const enabledNames = getEnabledPanelNames();
        console.log(`[CesiumMain #${instanceId}] 📦 检测到 ${enabledNames.length} 个启用的面板组件`);

        // 获取完整的面板配置
        const panelConfigs = getAvailablePanelConfigs();

        // 预加载所有启用的面板（可选）
        for (const name of enabledNames) {
          if (!this.functionPanelComponents[name] && !this.loadingComponents[name]) {
            console.log(`[CesiumMain #${instanceId}] 📋 预加载面板组件: ${name}`);
            // 标记为加载中
            this.loadingComponents[name] = true;
            // 异步加载（不阻塞）
            this.loadFunctionPanel(name).then((component) => {
              this.loadingComponents[name] = false;

              // ⭐ 从多实例配置管理器获取实例特定的配置
              const instancePanelConfig = multiInstancePanelConfigManager.getPanelConfig(instanceId, name);

              if (instancePanelConfig) {
                const isVisible = instancePanelConfig.visible;
                const panelProps = {
                  ...instancePanelConfig.position  // 使用实例特定的位置配置
                };
                console.log(`[CesiumMain #${instanceId}] 📋 预注册面板: ${name}, visible: ${isVisible}, position:`, panelProps);

                this.registerPanelComponent(name, {
                  component,
                  props: panelProps,
                  visible: isVisible
                });
              }
            }).catch((error) => {
              this.loadingComponents[name] = false;
              console.error(`[CesiumMain #${instanceId}] ❌ 加载面板组件失败: ${name}`, error);
            });
          }
        }
      } catch (error) {
        console.error(`[CesiumMain #${instanceId}] ❌ 预加载面板组件失败:`, error);
      }
    });

    // 暴露实例到全局，用于调试和脚本 hook
    if (typeof window !== 'undefined') {
      window.__helloWorldInstance__ = this;
    }

    // ⭐ 初始化高度对齐管理器（使用 dual-canvas-viewer-plugin.iife.js 暴露的工具类）
    if (typeof window !== 'undefined' && window.HeightAlignmentManager) {
      this.heightAlignmentManager = new window.HeightAlignmentManager();
      window.__heightAlignmentManager__ = this.heightAlignmentManager;
      console.log('[HelloWorld] ✅ HeightAlignmentManager 已从 window 对象初始化并暴露到全局');
    } else {
      console.warn('[HelloWorld] ⚠️ window.HeightAlignmentManager 不可用，等待 dual-canvas-viewer-plugin 加载...');
    }

    // ⭐ 延迟初始化Cesium，确保DOM完全渲染且容器尺寸正确
    this.$nextTick(() => {
      // 再次延迟确保容器有正确尺寸
      setTimeout(() => {
        this.init();
      }, 100);
    });

    this.initDualCanvasViewer();

    // ⭐ 不在这里直接初始化地板高度面板
    // 改为在 DualCanvasViewerMounted 事件中初始化
    // initFloorHeightPanel() 会在 fixMercatorProjection() 中被调用

    // 全局错误处理
    this.globalErrorHandler = (event) => {
      if (event.message && event.message.includes('before initialization')) {
        event.preventDefault();
        return true;
      }
      return false;
    };

    window.addEventListener('error', this.globalErrorHandler);

    this.unhandledRejectionHandler = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('before initialization')) {
        event.preventDefault();
        return true;
      }
      return false;
    };

    window.addEventListener('unhandledrejection', this.unhandledRejectionHandler);

    // 全局 pointerdown 监听器（捕获阶段）- 防止 DualCanvasViewer 插件干扰 Cesium
    this.boundHandleGlobalPointerDown = (event) => {
      // 在统一坐标系模式下，处理左键和右键
      if ((event.button === 0 || event.button === 2) && this.unifiedProjectionInitialized) {
        // 检查事件目标是否是交互元素
        const target = event.target;
        const interactiveSelectors = [
          '.control-panel', '.coordinate-panel', '.tab-button',
          '.slider', '.toggle-checkbox', '.transform-btn', '.action-btn',
          '.toggle-btn', '.model-selector', '.file-input',
          'button', 'input', 'select', 'textarea'
        ];
        const isInteractive = interactiveSelectors.some(sel =>
          target.matches(sel) || target.closest(sel)
        );

        // 只在非交互元素上禁用控制器
        if (!isInteractive) {
          // 禁用 Cesium 相机控制器
          if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
            this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = false;
          }

          // 关键修复：在真实世界模式下不禁用事件层
          // 真实世界模式下已禁用 Cesium → Dual 同步，DualCanvasViewer 应独立处理事件
          const isInRealWorldMode = window.__unifiedProjectionMode__;

          if (!isInRealWorldMode) {
            // 只在非真实世界模式下禁用 DualCanvasViewer 的事件层
            // 这样 DualCanvasViewer.onPointerDown1 检查时会看到 eventLayerDisabled = true
            if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
              const dualViewer = window.__dualCanvasViewerInstances[0];
              if (dualViewer) {
                dualViewer.eventLayerDisabled = true;
                console.log('[HelloWorld] 捕获阶段：已禁用 DualCanvasViewer 事件层', {
                  button: event.button,
                  target: target.tagName + (target.className ? '.' + target.className : '')
                });
              }
            }
          } else {
            console.log('[HelloWorld] 真实世界模式：不禁用事件层，让 DualCanvasViewer 独立处理事件');
          }
        }
      }
    };
    // 使用捕获阶段（第三个参数为 true），在其他处理器之前执行
    window.addEventListener('pointerdown', this.boundHandleGlobalPointerDown, true);

    // 全局 mouseup 监听器
    this.boundHandleGlobalMouseUp = () => {
      if (this.mouseState.isDown) {
        this.mouseState.isDown = false;
        this.mouseState.mappedButton = null;

        if (window.cesiumDualSyncV2 && window.cesiumDualSyncV2.setUserDragging) {
          window.cesiumDualSyncV2.setUserDragging(false);
        }

        if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
          const dualViewer = window.__dualCanvasViewerInstances[0];
          if (dualViewer.controls1) dualViewer.controls1.enabled = true;
          if (dualViewer.controls2) dualViewer.controls2.enabled = true;

          // 确保重新启用 DualCanvasViewer 的事件层
          dualViewer.eventLayerDisabled = false;
        }

        // 重新启用 Cesium 相机控制器
        if (this.cesiumViewer && this.cesiumViewer.scene && this.cesiumViewer.scene.screenSpaceCameraController) {
          this.cesiumViewer.scene.screenSpaceCameraController.enableInputs = true;
        }
      }
    };
    window.addEventListener('mouseup', this.boundHandleGlobalMouseUp);
  },
  beforeUnmount() {
    // ⭐ 销毁多实例配置
    if (this.instanceId) {
      console.log(`[CesiumMain #${this.instanceId}] 🗑️ 销毁实例配置`);
      multiInstancePanelConfigManager.destroyInstance(this.instanceId);
    }

    // 移除全局错误处理器
    if (this.globalErrorHandler) {
      window.removeEventListener('error', this.globalErrorHandler);
      this.globalErrorHandler = null;
    }
    if (this.unhandledRejectionHandler) {
      window.removeEventListener('unhandledrejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = null;
    }

    // 注销地板高度快捷键
    this.unregisterFloorHeightShortcuts();

    window.removeEventListener('pointerdown', this.boundHandleGlobalPointerDown, true);
    this.boundHandleGlobalPointerDown = null;

    window.removeEventListener('mouseup', this.boundHandleGlobalMouseUp);
    this.boundHandleGlobalMouseUp = null;

    // 移除相机监听器
    if (this.cesiumViewer && this.cesiumViewer.camera) {
      this.cesiumViewer.camera.moveEnd.removeEventListener(this.updateMapScaleBound);
      this.cesiumViewer.camera.changed.removeEventListener(this.updateMapScaleBound);
      this.cesiumViewer.camera.changed.removeEventListener(this.updateCesiumCoordinatesBound);
    }

    if (this.dualCanvasObserver) {
      this.dualCanvasObserver.disconnect();
      this.dualCanvasObserver = null;
    }

    if (this.dualCanvasAppInstance) {
      this.dualCanvasAppInstance.unmount();
      this.dualCanvasAppInstance = null;
      this.dualCanvasApp = null;
    }

    // ⭐ 关键新增：从虚拟视口注销 Cesium 层
    if (this._cesiumLayerRegistration) {
      try {
        this._cesiumLayerRegistration.unregister();
        console.log('[HelloWorld] ✅ Cesium 已从虚拟视口注销');
      } catch (error) {
        console.warn('[HelloWorld] ⚠️ Cesium 从虚拟视口注销失败（已忽略）:', error);
      }
      this._cesiumLayerRegistration = null;
    }

    // ⭐ 注意：倾斜摄影清理功能已迁移到 ObliquePhotographyPanel 组件
    // 不再在此处清理倾斜摄影数据
  }
};
</script>

<style scoped>
html,
body,
#cesiumContainer {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.box {
  height: 100%;
  position: relative;
}

/* 确保Cesium容器在底部可见 */
#cesiumContainer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

/* dual-canvas-viewer 覆盖层容器 - 全屏叠加 */
.dual-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99995; /* ⭐ 低于工具条和所有面板 */
  pointer-events: auto;
  background: transparent !important;
  background-color: transparent !important;
}

/* 独立 Vue 应用的根元素 */
.dual-canvas-overlay > * {
  pointer-events: none;
}

/* dual-canvas-viewer 组件根元素 */
.dual-canvas-overlay ::v-deep .dual-canvas-viewer {
  pointer-events: none;
}

/* 所有层容器默认穿透（除了 event-layer，它需要接收鼠标事件） */
.dual-canvas-overlay ::v-deep .layer-container,
.dual-canvas-overlay ::v-deep .three-layer,
.dual-canvas-overlay ::v-deep .bim-layer {
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* event-layer 需要接收鼠标事件以更新坐标 */
.dual-canvas-overlay ::v-deep .event-layer {
  pointer-events: auto !important;
}

/* canvas 元素接收事件，用于 dual-canvas-viewer 的交互 */
.dual-canvas-overlay ::v-deep canvas {
  pointer-events: auto !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* viewer-container 穿透且透明 */
.dual-canvas-overlay ::v-deep .viewer-container {
  pointer-events: none !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* header 默认穿透 */
.dual-canvas-overlay ::v-deep .header {
  pointer-events: none !important;
}

/* 确保所有交互元素可点击 */
.dual-canvas-overlay ::v-deep .control-panel,
.dual-canvas-overlay ::v-deep .coordinate-panel,
.dual-canvas-overlay ::v-deep .tab-button,
.dual-canvas-overlay ::v-deep .slider,
.dual-canvas-overlay ::v-deep .toggle-checkbox,
.dual-canvas-overlay ::v-deep .transform-btn,
.dual-canvas-overlay ::v-deep .action-btn,
.dual-canvas-overlay ::v-deep .toggle-btn,
.dual-canvas-overlay ::v-deep .model-selector,
.dual-canvas-overlay ::v-deep .file-input,
.dual-canvas-overlay ::v-deep button,
.dual-canvas-overlay ::v-deep input,
.dual-canvas-overlay ::v-deep select,
.dual-canvas-overlay ::v-deep textarea,
.dual-canvas-overlay ::v-deep .status {
  pointer-events: auto !important;
}

/* 缩放比例面板 */
.scale-panel {
  position: fixed;
  bottom: 15px;
  right: 70px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  font-family: Arial, sans-serif;
  font-size: 13px;
  z-index: 99994; /* ⭐ 低于其他面板 */
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.scale-panel .scale-title {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 5px;
}

.scale-panel .scale-value {
  font-size: 18px;
  font-weight: bold;
  color: #4ade80;
}

/* Cesium 坐标面板 - 底部状态栏样式 */
.cesium-coordinate-panel {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0);
  color: #000000;
  padding: 6px 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  font-weight: bold;
  z-index: 99993; /* ⭐ 低于其他面板 */
  pointer-events: auto;
  border-top: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(0px);
}

.cesium-coordinate-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  white-space: nowrap;
  gap: 8px;
}

.cesium-coordinate-panel .coord-item {
  color: #000000;
  flex-shrink: 0;
  font-weight: bold;
}

.cesium-coordinate-panel .coord-separator {
  color: rgba(0, 0, 0, 0.5);
  margin: 0 4px;
  flex-shrink: 0;
  font-weight: bold;
}

/* 屏幕中心点经纬度面板 - 左下角 */
.screen-center-panel {
  position: fixed;
  bottom: 100px;
  left: 20px;
  background: rgba(26, 26, 46, 0.9);
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  z-index: 99993; /* ⭐ 低于其他面板 */
  pointer-events: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  min-width: 180px;
}

.screen-center-panel .panel-title {
  font-size: 11px;
  color: #b0b0b0;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}

.screen-center-panel .panel-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.screen-center-panel .center-coord-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.screen-center-panel .center-coord-label {
  color: #b0b0b0;
  margin-right: 8px;
  font-weight: 500;
}

.screen-center-panel .center-coord-value {
  color: #4ade80;
  font-weight: 600;
}

/* ==================== 地板高度控制面板样式 ==================== */
.floor-height-adjuster {
  position: fixed;
  top: 20px;
  left: 20px;
  width: 300px;
  z-index: 99996; /* ⭐ 低于工具条和多实例面板 */
  background: rgba(20, 20, 30, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  font-family: Arial, sans-serif;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.floor-height-adjuster .panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #444;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px 8px 0 0;
}

.floor-height-adjuster .panel-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.floor-height-adjuster .close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.floor-height-adjuster .close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.floor-height-adjuster .panel-body-scroll {
  padding: 16px;
  max-height: 400px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.1);
}

.floor-height-adjuster .panel-body-scroll::-webkit-scrollbar {
  width: 6px;
}

.floor-height-adjuster .panel-body-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.floor-height-adjuster .panel-body-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.floor-height-adjuster .panel-body-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

/* 双画布控制面板开关样式 */
.floor-height-adjuster .control-panel-toggle {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.floor-height-adjuster .toggle-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.floor-height-adjuster .toggle-checkbox:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.floor-height-adjuster .toggle-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #4CAF50;
  cursor: pointer;
}

.floor-height-adjuster .toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  flex: 1;
}

.floor-height-adjuster .toggle-hint {
  font-size: 14px;
  cursor: help;
  opacity: 0.7;
}

/* 倾斜摄影列表样式 */
.floor-height-adjuster .oblique-photography-section {
  margin-bottom: 16px;
}

.floor-height-adjuster .section-title {
  font-size: 13px;
  font-weight: 600;
  color: #4CAF50;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ⭐ 推荐偏移横幅样式 */
.floor-height-adjuster .recommended-offset-banner {
  margin-bottom: 12px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.15) 0%, rgba(76, 175, 80, 0.05) 100%);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 6px;
  animation: slideIn 0.3s ease-out;
}

.floor-height-adjuster .banner-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.floor-height-adjuster .banner-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.floor-height-adjuster .banner-text {
  flex: 1;
  font-size: 12px;
  color: #e0e0e0;
  line-height: 1.4;
}

.floor-height-adjuster .banner-text strong {
  color: #4CAF50;
  font-weight: 600;
}

.floor-height-adjuster .banner-text .banner-suggestion {
  color: #aaa;
}

.floor-height-adjuster .banner-text .highlight {
  color: #FFC107;
  font-weight: 700;
  font-size: 13px;
}

.floor-height-adjuster .apply-recommended-btn-large {
  padding: 6px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.floor-height-adjuster .apply-recommended-btn-large:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.floor-height-adjuster .apply-recommended-btn-large:disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.7;
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

.floor-height-adjuster .oblique-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.floor-height-adjuster .oblique-item {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s, border-color 0.2s;
}

.floor-height-adjuster .oblique-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.floor-height-adjuster .oblique-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.floor-height-adjuster .oblique-checkbox input[type="checkbox"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #4CAF50;
}

.floor-height-adjuster .oblique-checkbox input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.floor-height-adjuster .oblique-name {
  flex: 1;
  font-size: 13px;
  color: #fff;
  font-weight: 500;
}

.floor-height-adjuster .loading-indicator {
  font-size: 11px;
  color: #FFC107;
  animation: pulse 1.5s ease-in-out infinite;
}

.floor-height-adjuster .status-indicator {
  font-size: 14px;
  font-weight: 600;
}

.floor-height-adjuster .status-indicator.loaded {
  color: #4CAF50;
}

.floor-height-adjuster .status-indicator.unloaded {
  color: #666;
}

.floor-height-adjuster .oblique-url {
  margin-top: 6px;
  font-size: 10px;
  color: #888;
  word-break: break-all;
  line-height: 1.4;
}

.floor-height-adjuster .section-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 16px 0;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.floor-height-adjuster .current-height {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.floor-height-adjuster .current-height .label {
  font-size: 12px;
  color: #aaa;
}

.floor-height-adjuster .current-height .value {
  font-size: 16px;
  font-weight: 600;
  color: #4CAF50;
}

.floor-height-adjuster .height-control {
  margin-bottom: 16px;
}

.floor-height-adjuster .height-control label {
  display: block;
  font-size: 12px;
  margin-bottom: 8px;
  color: #aaa;
}

.floor-height-adjuster .recommended-offset {
  margin-left: 8px;
  padding: 2px 8px;
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.floor-height-adjuster .height-slider {
  width: 100%;
  cursor: pointer;
}

.floor-height-adjuster .height-range-info {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: #888;
}

.floor-height-adjuster .height-range-info span:last-child {
  color: #4CAF50;
}

.floor-height-adjuster .height-usage-info {
  margin-top: 6px;
  font-size: 10px;
  color: #666;
  font-style: italic;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.floor-height-adjuster .apply-recommended-btn {
  padding: 4px 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.floor-height-adjuster .apply-recommended-btn:hover:not(:disabled) {
  background: #45a049;
}

.floor-height-adjuster .apply-recommended-btn:disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

.floor-height-adjuster .height-input {
  margin-bottom: 16px;
}

.floor-height-adjuster .height-input label {
  display: block;
  font-size: 12px;
  margin-bottom: 8px;
  color: #aaa;
}

.floor-height-adjuster .number-input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  font-size: 14px;
  box-sizing: border-box;
}

.floor-height-adjuster .number-input:focus {
  outline: none;
  border-color: #4CAF50;
}

.floor-height-adjuster .actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.floor-height-adjuster .btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
  font-weight: 500;
}

.floor-height-adjuster .btn-primary {
  background: #4CAF50;
  color: #fff;
}

.floor-height-adjuster .btn-primary:hover {
  background: #45a049;
}

.floor-height-adjuster .btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.floor-height-adjuster .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.floor-height-adjuster .btn-accent {
  background: #FF6B6B;
  color: #fff;
}

.floor-height-adjuster .btn-accent:hover {
  background: #ff5252;
}

.floor-height-adjuster .btn-diagnose {
  background: #8b5cf6;
  color: #fff;
}

.floor-height-adjuster .btn-diagnose:hover {
  background: #7c3aed;
}

.floor-height-adjuster .btn-fix {
  background: #f59e0b;
  color: #fff;
}

.floor-height-adjuster .btn-fix:hover {
  background: #d97706;
}

.floor-height-adjuster .btn-rotate {
  background: #06b6d4;
  color: #fff;
}

.floor-height-adjuster .btn-rotate:hover {
  background: #0891b2;
}

.floor-height-adjuster .btn-flip {
  background: #8b5cf6;
  color: #fff;
}

.floor-height-adjuster .btn-flip:hover {
  background: #7c3aed;
}

.floor-height-adjuster .cylinder-height-control {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #444;
}

.floor-height-adjuster .cylinder-height-control .control-section {
  margin-bottom: 12px;
}

.floor-height-adjuster .cylinder-height-control .section-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #ddd;
  margin-bottom: 8px;
}

.floor-height-adjuster .cylinder-height-control .cylinder-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.floor-height-adjuster .cylinder-height-control .cylinder-input-group .number-input {
  flex: 1;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #555;
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
}

.floor-height-adjuster .cylinder-height-control .cylinder-input-group .unit-label {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.floor-height-adjuster .cylinder-height-control .btn-cylinder {
  background: #9b59b6;
  color: #fff;
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
}

.floor-height-adjuster .cylinder-height-control .btn-cylinder:hover {
  background: #8e44ad;
}

.floor-height-adjuster .cylinder-height-control .cylinder-info {
  margin-top: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
  color: #888;
  line-height: 1.5;
}

.floor-height-adjuster .cylinder-height-control .cylinder-info p {
  margin: 2px 0;
}

.floor-height-adjuster .shortcuts-hint {
  padding-top: 12px;
  border-top: 1px solid #444;
}

.floor-height-adjuster .shortcuts-hint p {
  margin: 4px 0;
  font-size: 11px;
  color: #888;
  line-height: 1.4;
}

.floor-height-adjuster .shortcuts-hint p:first-child {
  font-weight: 600;
  color: #aaa;
  margin-bottom: 8px;
}

/* 高度对齐模式样式 */
.floor-height-adjuster .alignment-mode-section {
  margin-bottom: 16px;
}

.floor-height-adjuster .alignment-mode-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.floor-height-adjuster .alignment-mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.floor-height-adjuster .alignment-mode-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.2);
}

.floor-height-adjuster .alignment-mode-item input[type="radio"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  accent-color: #4CAF50;
}

.floor-height-adjuster .mode-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.floor-height-adjuster .mode-desc {
  font-size: 11px;
  color: #888;
  margin-left: auto;
}

.floor-height-adjuster .alignment-info {
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: #4CAF50;
}

/* 无加载提示样式 */
.floor-height-adjuster .no-loaded-hint {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #888;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

/* ==================== ⭐ 工具条样式已迁移至 CesiumToolbar 组件 ==================== */

/* ⭐ TestSfc 容器样式 */
.test-sfc-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99997; /* ⭐ 低于多实例面板 */
  pointer-events: none;
}

.test-sfc-container > * {
  pointer-events: auto;
}

/* 多实例叠加层样式 */
.dual-canvas-overlay-multiple {
  /* ⭐ pointer-events 由内联样式控制，这里不强制覆盖 */
  pointer-events: none;
}

.dual-canvas-overlay-multiple > * {
  /* ⭐ 内部元素启用交互 */
  pointer-events: auto;
}

/* ⭐ 确保多实例容器内的 dual-canvas-viewer 组件及其所有子元素都能接收点击事件 */
.dual-canvas-overlay-multiple .dual-canvas-viewer {
  pointer-events: auto !important;
}

.dual-canvas-overlay-multiple .dual-canvas-viewer * {
  pointer-events: auto !important;
}

/* ⭐ 确保 layer-container 能接收画布事件 */
.dual-canvas-overlay-multiple .layer-container {
  pointer-events: auto !important;
}

.dual-canvas-overlay-multiple .layer-container * {
  pointer-events: auto !important;
}

/* ⭐ 针对所有以 dualCanvasContainer- 开头的 ID 的容器 */
[id^="dualCanvasContainer-"] {
  pointer-events: none !important;
}

/* ⭐ 只让直接子元素（contentWrapper）启用交互 */
[id^="dualCanvasContainer-"] > * {
  pointer-events: auto !important;
}

/* ⭐ 确保面板、坐标面板、画布容器能接收点击事件（但不使用通配符） */
[id^="dualCanvasContainer-"] .control-panel {
  pointer-events: auto !important;
}

[id^="dualCanvasContainer-"] .coordinate-panel {
  pointer-events: auto !important;
}

[id^="dualCanvasContainer-"] .layer-container {
  pointer-events: auto !important;
}

[id^="dualCanvasContainer-"] canvas {
  pointer-events: auto !important;
}

/* ⭐ 确保面板内的所有交互元素都能接收点击事件 */
[id^="dualCanvasContainer-"] .control-panel *,
[id^="dualCanvasContainer-"] .coordinate-panel * {
  pointer-events: auto !important;
}

</style>
