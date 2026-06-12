/**
 * SyncManager - 三层同步管理器
 * 负责 Cesium 地图层、Three.js 层1、Three.js 层2 之间的相机和坐标同步
 * 严格划分地上和地下的鼠标地图操作逻辑，翻转、平移、缩放互不影响
 *
 * 重构说明：
 * - 墨卡托投影相关的计算逻辑已迁移到 MercatorProjectionManager
 * - SyncManager 现在专注于同步状态管理和协调
 */

import * as THREE from 'three';
import { mercatorProjectionManager } from './MercatorProjectionManager.js';
import { enhanceUnifiedStateWithCoordinateSystem, DirectionConverter, DirectionCoordinateSystem } from './CoordinateSystem.js';

// ⭐ 添加调试信息：检查导入的 mercatorProjectionManager
console.log('[SyncManager] 导入的 mercatorProjectionManager:', {
  mercatorProjectionManager,
  类型: typeof mercatorProjectionManager,
  constructorName: mercatorProjectionManager?.constructor?.name,
  原型方法: Object.getOwnPropertyNames(Object.getPrototypeOf(mercatorProjectionManager || {})),
  有setDualFloorHeight: typeof mercatorProjectionManager?.setDualFloorHeight === 'function',
  有getCurrentFloorHeight: typeof mercatorProjectionManager?.getCurrentFloorHeight === 'function'
});

// 动态导入 OperationRouter（延迟加载，避免 vue3-sfc-loader 解析问题）
let OperationRouterClass = null;
async function loadOperationRouter() {
  if (!OperationRouterClass) {
    try {
      const module = await import('./operation-handlers/index.js');
      OperationRouterClass = module.OperationRouter;
    } catch (e) {
      console.warn('[SyncManager] OperationRouter not available:', e.message);
    }
  }
  return OperationRouterClass;
}

// 向量运算工具类（保留用于操作处理器）
class VectorMath {
  static normalize(v) {
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') {
      return { x: 0, y: 1, z: 0 };
    }

    if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) {
      return { x: 0, y: 1, z: 0 };
    }

    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 0.0001) return { x: 0, y: 1, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  static cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static rotateAroundAxis(v, axis, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const cross = this.cross(axis, v);
    const dot = this.dot(axis, v);

    return {
      x: v.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
    };
  }
}

// 地上地下操作处理器
class SurfaceOperationHandler {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.earthRadius = 6378137.0;
  }

  /**
   * 判断相机是否在地下
   */
  isUnderground(cesiumCamera) {
    const Cesium = this.syncManager.getCesium();
    if (!Cesium || !cesiumCamera) return false;

    try {
      const ellipsoid = this.syncManager.cesiumViewer?.scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const cartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
      return cartographic.height < 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 判断相机是否向下看（用于地下模式）
   */
  isLookingDown(cesiumCamera) {
    if (!cesiumCamera || !cesiumCamera.direction) return false;
    return cesiumCamera.direction.y < 0;
  }

  /**
   * 墨卡托Y坐标转纬度
   */
  mercatorToLatitude(mercatorY) {
    const MAX_MERCATOR_Y = 20037508;
    const clampedY = Math.max(-MAX_MERCATOR_Y, Math.min(MAX_MERCATOR_Y, mercatorY));
    return 2 * Math.atan(Math.exp(clampedY / this.earthRadius)) - Math.PI / 2;
  }

  /**
   * 纬度转墨卡托Y坐标
   */
  latitudeToMercator(latitude) {
    return Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * this.earthRadius;
  }
}

export class ViewerSyncManager {
  constructor() {
    // 同步深度计数器，防止循环触发
    this.syncDepth = 0;
    this.throttleTimer = null;
    this.throttleDelay = 50;

    // 地形法线缓存（用于保持地板平行于实际地形）
    this.terrainNormalCache = {
      normal: null,           // 地形法线向量（ECEF 坐标系）
      position: null,         // 采样位置（ECEF 坐标系）
      lastUpdateTime: 0,      // 上次更新时间
      updateInterval: 5000,   // 更新间隔（毫秒）- 5秒更新一次
      isValid: false          // 缓存是否有效
    };

    // 1:1 比例系统：1 Three.js 单位 = 1 米
    this.scale = 1;

    // 墨卡托投影管理器（新增）
    this.mercatorProjection = mercatorProjectionManager;

    // ⭐ 添加调试信息
    console.log('[ViewerSyncManager] mercatorProjection 已设置:', {
      mercatorProjection: this.mercatorProjection,
      类型: typeof this.mercatorProjection,
      constructorName: this.mercatorProjection?.constructor?.name,
      是函数: typeof this.mercatorProjection === 'function',
      有SetDualFloorHeight: typeof this.mercatorProjection?.setDualFloorHeight === 'function'
    });

    // Cesium 实例引用
    this.Cesium = null;

    // 回调函数
    this.onCesiumToThreeSync = null;
    this.onThreeToCesiumSync = null;

    // Cesium 鼠标墨卡托坐标
    this.cesiumMouseMercator = { x: null, y: null, z: null };

    // 统一平面投影坐标系状态
    // ⭐ 初始方向设置为倾斜向下而非垂直向下，避免极点翻转（gimbal flip）
    // polarAngle 约为 150°（cos 150° ≈ -0.866），在安全范围内
    // ⭐ 坐标系定义：统一坐标系（EUS）= 东南天坐标系（X=东, Y=天, Z=南）
    this.unifiedCameraState = {
      position: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: -0.866, z: -0.5 },  // 约 150°，倾斜向下而非垂直向下（EUS坐标系）
      up: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      height: 500,
      target: { x: 0, y: 0, z: 0 }
    };

    // ⭐ 关键修复：增强 unifiedCameraState 的坐标系功能
    // 这会添加坐标系标识和转换方法，确保方向向量在正确的坐标系中使用
    enhanceUnifiedStateWithCoordinateSystem(this.unifiedCameraState);

    // 鼠标操作参数
    this.mouseOperationParams = {
      rotateSpeed: 0.001,
      panSpeed: 5.0,  // ⚠️ 提高平移速度：从 1.0 提高到 5.0，适应高空视角下的平移需求
      zoomSpeed: 0.1,
      minPanDistance: 0.01,
      maxPanDistance: 10000
    };

    // 操作状态追踪
    this.operationState = {
      isDragging: false,
      operationType: null,
      lastMousePos: { x: 0, y: 0 },
      operationStartTime: 0
    };

    // 禁用 Three.js → Cesium 同步
    this.disableThreeToCesiumSync = false;

    // 创建地上地下操作处理器
    this.surfaceHandler = new SurfaceOperationHandler(this);

    // 保存Cesium Viewer引用
    this.cesiumViewer = null;

    // 初始化操作路由器（延迟加载，避免 vue3-sfc-loader 解析问题）
    this.operationRouter = null;
    this._initOperationRouter();

    // 是否使用新架构（默认为 false，保持向后兼容）
    this.useNewArchitecture = false;

    // ⚠️ 关键修复：添加高度历史追踪和异常检测机制
    this.heightTracker = {
      history: [],              // 保存最近的高度记录
      maxHistorySize: 10,       // 最大历史记录数
      lastValidHeight: null,    // 上次有效的高度
      anomalyThreshold: 0.2,    // 异常阈值：高度变化超过20%视为异常
      consecutiveAnomalies: 0,  // 连续异常次数
      maxAnomalies: 3,          // 最大连续异常次数，超过后强制重置
      lastSyncTime: 0,          // 上次同步时间
      minSyncInterval: 100      // 最小同步间隔（毫秒），防止频繁同步
    };

    // ⚠️ 新增：循环同步保护标记
    this._isSyncingFromDual = false;
    this._syncCooldownTimer = null;

    // 地板中心更新回调
    this.onFloorCenterUpdate = null;

    // 初始化默认地板中心（确保 floorCenterMercator 不为 null）
    // 这样可以避免 DualCanvasViewer 在挂载时因地板中心未设置而等待
    this.floorCenterMercator = { x: 0, y: 0, z: 0 };
    this.mercatorProjection.setFloorCenter(this.floorCenterMercator);

    // ⭐ 左键翻转保护机制（防止翻转后被反向同步覆盖）
    this.leftFlipProtection = {
      enabled: false,    // 是否启用保护
      until: 0           // 保护截止时间戳
    };
  }

  // 延迟初始化 OperationRouter
  async _initOperationRouter() {
    const RouterClass = await loadOperationRouter();
    if (RouterClass) {
      this.operationRouter = new RouterClass(this);
    }
  }

  // ==================== Cesium 实例管理 ====================

  setCesium(Cesium) {
    this.Cesium = Cesium;
    // 同步到 MercatorProjectionManager
    this.mercatorProjection.setCesium(Cesium);
  }

  getCesium() {
    if (this.Cesium) return this.Cesium;
    if (typeof window !== 'undefined' && window.Cesium) {
      return window.Cesium;
    }
    return null;
  }

  isCesiumReady() {
    return this.getCesium() !== null;
  }

  setCesiumViewer(viewer) {
    this.cesiumViewer = viewer;
    // ⚠️ 自动设置 Cesium 鼠标事件监听器，启用操作路由器
    this._setupCesiumMouseEvents();
  }

  /**
   * 设置 Cesium 鼠标事件监听器
   * 在新架构启用时，拦截 Cesium 的鼠标操作并使用操作路由器处理
   * @private
   */
  _setupCesiumMouseEvents() {
    if (!this.cesiumViewer || !this.useNewArchitecture) {
      console.log('[SyncManager] 跳过设置 Cesium 鼠标事件（viewer 未就绪或新架构未启用）');
      return;
    }

    // 避免重复设置
    if (this._cesiumEventsSetup) {
      console.log('[SyncManager] Cesium 鼠标事件已设置');
      return;
    }

    const canvas = this.cesiumViewer.canvas;
    if (!canvas) {
      console.warn('[SyncManager] 无法设置 Cesium 鼠标事件：canvas 不可用');
      return;
    }

    console.log('[SyncManager] ✅ 设置 Cesium 鼠标事件监听器（操作路由器模式）');

    // ⭐ 更新操作路由器的 Cesium 对象引用
    if (this.operationRouter && typeof this.operationRouter.updateCesiumObjects === 'function') {
      this.operationRouter.updateCesiumObjects();
    }

    // 鼠标状态追踪
    let isDragging = false;
    let mouseButton = -1;
    let lastMousePos = { x: 0, y: 0 };

    // 鼠标按下事件
    const onMouseDown = (event) => {
      isDragging = true;
      mouseButton = event.button;
      lastMousePos = { x: event.clientX, y: event.clientY };
      console.log('[SyncManager] 鼠标按下:', { button: event.button });
    };

    // 鼠标移动事件
    const onMouseMove = (event) => {
      if (!isDragging) return;

      const deltaX = event.clientX - lastMousePos.x;
      const deltaY = event.clientY - lastMousePos.y;

      // 左键：旋转
      if (mouseButton === 0 && (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5)) {
        console.log('[SyncManager] 检测到旋转操作:', { deltaX, deltaY });
        this.handleRotate(deltaX, deltaY);
      }
      // 右键或中键：平移
      else if ((mouseButton === 2 || mouseButton === 1) && (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5)) {
        // 计算每像素代表的米数（基于相机高度）
        const cameraHeight = this.unifiedCameraState.height || 500;
        const metersPerPixel = cameraHeight / 1000; // 简化计算

        console.log('[SyncManager] 检测到平移操作:', { deltaX, deltaY, metersPerPixel });
        this.handlePan(deltaX, deltaY, metersPerPixel);
      }

      lastMousePos = { x: event.clientX, y: event.clientY };
    };

    // 鼠标释放事件
    const onMouseUp = () => {
      isDragging = false;
      mouseButton = -1;
    };

    // 阻止右键菜单
    const onContextMenu = (event) => {
      event.preventDefault();
    };

    // 添加事件监听器
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);

    // 保存引用以便清理
    this._cesiumMouseHandlers = { onMouseDown, onMouseMove, onMouseUp, onContextMenu };
    this._cesiumEventsSetup = true;

    console.log('[SyncManager] ✅ Cesium 鼠标事件监听器已设置完成');
  }

  // ==================== 坐标系管理 ====================

  /**
   * 设置地板中心墨卡托坐标
   * 委托给 MercatorProjectionManager
   * @param {Object} floorCenter - 地板中心 {x, y, z}
   * @param {number} modelAltitude - 模型海拔（米），可选
   */
  setFloorCenter(floorCenter, modelAltitude = null) {
    // ⭐ 关键修复：局部坐标系模式下，地板中心始终为 (0, 0, 0)
    // 不接受任何非零的地板中心设置，避免破坏局部坐标系
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (isUsingLocalCoord) {
      // 检查是否尝试设置非零的地板中心
      const isNonZero = floorCenter.x !== 0 || floorCenter.y !== 0 || floorCenter.z !== 0;

      if (isNonZero) {
        console.log('[SyncManager.setFloorCenter] ⚠️ 局部坐标系模式：拒绝设置非零地板中心', {
          尝试设置: `(${floorCenter.x.toFixed(2)}, ${floorCenter.y.toFixed(2)}, ${floorCenter.z.toFixed(2)})`,
          当前地板中心: '(0, 0, 0)',
          模型海拔: modelAltitude !== null ? modelAltitude.toFixed(2) + '米' : '未提供',
          原因: '局部坐标系模式下地板中心必须保持为原点，但需要保存模型海拔'
        });

        // ⭐ 关键修复：仍然需要调用 MercatorProjectionManager.setFloorCenter
        // 虽然拒绝设置 floorCenterMercator，但需要设置 modelAbsoluteAltitude
        // 传入 (0, 0, 0) 作为 floorCenter，保持地板中心为原点
        this.mercatorProjection.setFloorCenter({ x: 0, y: 0, z: 0 }, modelAltitude);

        return; // 拒绝设置，保持地板中心为 (0, 0, 0)
      }
    }

    this.mercatorProjection.setFloorCenter(floorCenter, modelAltitude);

    // 为了向后兼容，保留本地的引用
    this.floorCenterMercator = this.mercatorProjection.getFloorCenter();
    this.setOriginalFloorHeight(floorCenter.z || 0);

    // ⭐ 新增：在局部坐标系模式下，记录虚拟地板中心对齐状态
    if (isUsingLocalCoord && this.mercatorProjection.modelAbsoluteMercator) {
      const isAligned = this.mercatorProjection.isVirtualFloorCenterAlignedWithENU();
      console.log('[SyncManager.setFloorCenter] 虚拟地板中心对齐状态:', {
        dual地板中心: '(0, 0, 0)',
        ENU切点: `(${this.mercatorProjection.modelAbsoluteMercator.x.toFixed(2)}, ${this.mercatorProjection.modelAbsoluteMercator.y.toFixed(2)})`,
        对齐状态: isAligned ? '✅ 已对齐' : '⚠️ 未对齐'
      });
    }

    // ⚠️ 关键修复：通知 DualCanvasViewer 更新地板中心
    // 这确保地板中心的变化能够同步到显示层
    if (this.onFloorCenterUpdate && typeof this.onFloorCenterUpdate === 'function') {
      this.onFloorCenterUpdate(this.floorCenterMercator);
    }
  }

  /**
   * 获取地板中心墨卡托坐标
   * @returns {Object|null} 地板中心坐标
   */
  getFloorCenter() {
    return this.mercatorProjection.getFloorCenter();
  }

  /**
   * 检查地板中心是否已配置（不是默认值 { x: 0, y: 0, z: 0 }）
   * @returns {boolean} 地板中心是否有效
   */
  hasValidFloorCenter() {
    if (!this.floorCenterMercator) return false;
    // 检查是否至少有一个非零值
    return this.floorCenterMercator.x !== 0 ||
           this.floorCenterMercator.y !== 0 ||
           this.floorCenterMercator.z !== 0;
  }

  /**
   * 验证虚拟地板中心与ENU切点的对齐状态
   * @returns {boolean} 对齐返回true
   */
  verifyVirtualFloorCenterAlignment() {
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (!isUsingLocalCoord) return true;

    const isAligned = this.mercatorProjection.isVirtualFloorCenterAlignedWithENU();
    if (!isAligned) {
      console.warn('[SyncManager] ⚠️ 虚拟地板中心与ENU切点对齐失效，可能影响同步精度');
    }
    return isAligned;
  }

  /**
   * 获取原始地板高度
   * @returns {number} 原始地板高度
   */
  get originalFloorHeight() {
    return this.mercatorProjection.getOriginalFloorHeight();
  }

  /**
   * 设置原始地板高度
   * @param {number} height - 地板高度
   */
  setOriginalFloorHeight(height) {
    this.mercatorProjection.originalFloorHeight = height;
  }

  setPanSpeed(speed) {
    this.mouseOperationParams.panSpeed = speed;
  }

  setSyncCallbacks(onCesiumToThree, onThreeToCesium) {
    this.onCesiumToThreeSync = onCesiumToThree;
    this.onThreeToCesiumSync = onThreeToCesium;
  }

  // ==================== 轻量级 ENU 初始化（兼容局部坐标系模式）====================

  /**
   * 轻量级 ENU 初始化（兼容局部坐标系模式）
   * 旋转整个场景容器以对齐地形，不重新定位模型
   *
   * @param {number} longitude - 经度（度）
   * @param {number} latitude - 纬度（度）
   * @param {number} height - 高度（米，默认0）
   * @returns {Promise<boolean>} 是否成功初始化
   */
  async initENUForLocalCoordMode(longitude, latitude, height = 0) {
    console.log('[SyncManager] 🔄 轻量级 ENU 初始化（局部坐标系兼容模式）');

    // ⚠️ 检查 Cesium 是否准备好
    if (!this.isCesiumReady()) {
      console.warn('[SyncManager] ⚠️ Cesium 未准备好，跳过 ENU/局部坐标系初始化');
      return false;
    }

    try {
      // 1. 动态导入 ENUCoordinateManager
      const enuModule = await import('./ENUCoordinateManager.js');
      const { enuCoordinateManager } = enuModule;

      // 2. 设置 Cesium 实例
      if (typeof window !== 'undefined' && window.Cesium && window.viewer) {
        enuCoordinateManager.setCesium(window.Cesium, window.viewer);
      }

      // 3. 初始化 ENU 坐标系（但不重新定位模型）
      const longitudeRad = longitude * Math.PI / 180;
      const latitudeRad = latitude * Math.PI / 180;

      const success = enuCoordinateManager.initializeAtPosition(
        longitudeRad,
        latitudeRad,
        height
      );

      if (!success) {
        console.error('[SyncManager] ENU坐标系初始化失败');
        return false;
      }

      // 4. 保存 ENU 基向量到 SyncManager（用于方向同步）
      this.enuBasis = {
        east: { ...enuCoordinateManager.basis.east },
        north: { ...enuCoordinateManager.basis.north },
        up: { ...enuCoordinateManager.basis.up }
      };

      this.enuOrigin = {
        longitude: longitude,
        latitude: latitude,
        height: height
      };

      // 5. 通知 DualCanvasViewer 旋转场景容器（包括模型和 GridHelper）
      if (typeof window !== 'undefined' && window.__dualCanvasViewerInstances__ &&
          window.__dualCanvasViewerInstances__.length > 0) {
        const dualViewer = window.__dualCanvasViewerInstances__[0];
        if (dualViewer && typeof dualViewer.rotateSceneContainersToAlignTerrain === 'function') {
          dualViewer.rotateSceneContainersToAlignTerrain(this.enuBasis);
          console.log('[SyncManager] ✅ 已通知 DualCanvasViewer 旋转场景容器');
        }
      }

      console.log('[SyncManager] ✅ 轻量级 ENU 初始化完成', {
        ENU原点: `经度${longitude.toFixed(6)}°, 纬度${latitude.toFixed(6)}°, 高度${height.toFixed(2)}m`,
        天向量: `(${this.enuBasis.up.x.toFixed(4)}, ${this.enuBasis.up.y.toFixed(4)}, ${this.enuBasis.up.z.toFixed(4)})`,
        说明: '模型位置保持不变，只旋转场景容器和方向同步'
      });

      return true;
    } catch (error) {
      console.error('[SyncManager] 轻量级 ENU 初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取 ENU 基向量（用于方向同步）
   * @returns {Object|null} ENU 基向量 {east, north, up} 或 null
   */
  getENUBasis() {
    return this.enuBasis || null;
  }

  /**
   * 获取 ENU 原点信息
   * @returns {Object|null} ENU 原点 {longitude, latitude, height} 或 null
   */
  getENUOrigin() {
    return this.enuOrigin || null;
  }

  /**
   * 检查是否已初始化 ENU
   * @returns {boolean} 是否已初始化 ENU
   */
  hasENUInitialized() {
    return this.enuBasis !== null && this.enuOrigin !== null;
  }

  // ==================== Cesium 屏幕中心坐标获取 ====================

  /**
   * 获取 Cesium 屏幕中心点的墨卡托坐标
   * 用于地上模式翻转时的参考点
   * @returns {Object|null} 屏幕中心的墨卡托坐标 {x, y, z} 或 null
   */
  /**
   * 获取 Cesium 屏幕中心点的墨卡托坐标
   * 用于地上模式翻转时的参考点
   * @returns {Object|null} 屏幕中心的墨卡托坐标 {x, y, z} 或 null
   */
  getCesiumScreenCenterMercator() {
    console.log('[SyncManager.getCesiumScreenCenterMercator] 开始获取屏幕中心墨卡托坐标');

    const Cesium = this.getCesium();
    console.log('[SyncManager.getCesiumScreenCenterMercator] Cesium 可用:', !!Cesium);

    if (!Cesium) {
      console.warn('[SyncManager.getCesiumScreenCenterMercator] Cesium 不可用');
      return null;
    }

    if (!this.cesiumViewer) {
      console.warn('[SyncManager.getCesiumScreenCenterMercator] cesiumViewer 为 null');
      console.log('[SyncManager.getCesiumScreenCenterMercator] 当前 this:', {
        hasCesiumViewer: !!this.cesiumViewer,
        hasWindowCesiumViewer: !!(typeof window !== 'undefined' && window.__cesiumViewer__)
      });
      return null;
    }

    if (!this.cesiumViewer.camera) {
      console.warn('[SyncManager.getCesiumScreenCenterMercator] cesiumViewer.camera 为 null');
      return null;
    }

    console.log('[SyncManager.getCesiumScreenCenterMercator] 所有检查通过，开始计算');

    try {
      const camera = this.cesiumViewer.camera;
      console.log('[SyncManager.getCesiumScreenCenterMercator] camera.position:', {
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2)
      });

      const scene = this.cesiumViewer.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const earthRadius = 6378137.0;

      // 获取屏幕中心点对应的地面位置
      // 使用相机的经纬度，高度设为 0（地面）
      const cameraCartographic = ellipsoid.cartesianToCartographic(camera.position);

      if (!cameraCartographic) {
        console.warn('[SyncManager.getCesiumScreenCenterMercator] cameraCartographic 转换失败');
        return null;
      }

      console.log('[SyncManager.getCesiumScreenCenterMercator] cameraCartographic:', {
        longitude: cameraCartographic.longitude.toFixed(8),
        latitude: cameraCartographic.latitude.toFixed(8),
        height: cameraCartographic.height.toFixed(2)
      });

      // 计算屏幕中心对应的地面墨卡托坐标
      const screenCenterMercator = {
        x: cameraCartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(cameraCartographic.latitude),
        z: 0  // 地面高度为 0
      };

      console.log('[SyncManager.getCesiumScreenCenterMercator] 计算完成:', {
        x: screenCenterMercator.x.toFixed(2),
        y: screenCenterMercator.y.toFixed(2),
        z: screenCenterMercator.z.toFixed(2)
      });

      return screenCenterMercator;
    } catch (error) {
      console.error('[SyncManager.getCesiumScreenCenterMercator] 异常:', error);
      console.error('[SyncManager.getCesiumScreenCenterMercator] 错误堆栈:', error.stack);
      return null;
    }
  }

  // ==================== 坐标转换 ====================

  /**
   * 墨卡托坐标 → Three.js 世界坐标
   * 委托给 MercatorProjectionManager
   */
  mercatorToThree(mercatorX, mercatorY, mercatorZ) {
    return this.mercatorProjection.mercatorToThree(mercatorX, mercatorY, mercatorZ);
  }

  /**
   * Three.js 世界坐标 → 墨卡托坐标
   * 委托给 MercatorProjectionManager
   *
   * ⚠️ 重要：此方法使用正确的地面高度转换
   * floorCenterMercator.z 始终为0（地面高度）
   */
  threeToMercator(threeX, threeY, threeZ) {
    const result = this.mercatorProjection.threeToMercator(threeX, threeY, threeZ);

    // 验证转换结果的合理性
    if (this.floorCenterMercator) {
      // 检测高度累积：如果结果高度与输入高度差异过大，可能有问题
      const expectedHeight = threeY;
      const actualHeight = result.z;
      const heightDifference = Math.abs(actualHeight - expectedHeight);

      // ⚠️ 修复：允许更大的误差阈值（10米）
      // 考虑到：
      // 1. 浮点数精度问题
      // 2. 真实世界模式下的坐标转换
      // 3. 大坐标模型的高度偏移
      const WARNING_THRESHOLD = 10;  // 米

      // 只有当差异超过阈值时才发出警告
      if (heightDifference > WARNING_THRESHOLD) {
        console.warn('[SyncManager] threeToMercator 高度转换异常:', {
          输入高度: threeY.toFixed(2),
          输出高度: actualHeight.toFixed(2),
          差异: heightDifference.toFixed(2),
          floorCenterZ: this.floorCenterMercator.z,
          说明: '差异超过10米阈值，可能是大坐标模型或坐标转换问题'
        });
      }

      // ⚠️ 新增：检测极端异常（差异超过1000米）
      // 这通常表示坐标系统完全错误
      if (heightDifference > 1000) {
        console.error('[SyncManager] threeToMercator 高度转换严重异常:', {
          输入高度: threeY.toFixed(2),
          输出高度: actualHeight.toFixed(2),
          差异: heightDifference.toFixed(2),
          建议检查: '坐标系统配置、地板中心设置、模型加载状态'
        });
      }
    }

    return result;
  }

  /**
   * 墨卡托向量 → Three.js 向量
   * 用于转换方向向量（direction, up, right），不包含位置偏移
   * @param {number} x - 墨卡托向量 X 分量
   * @param {number} y - 墨卡托向量 Y 分量
   * @param {number} z - 墨卡托向量 Z 分量
   * @returns {Object} {x, y, z} Three.js 向量
   */
  mercatorVectorToThree(x, y, z) {
    // 向量转换只需要交换轴，不需要位置偏移
    // Three.js X = 墨卡托 X
    // Three.js Y = 墨卡托 Z (高度分量)
    // Three.js Z = -墨卡托 Y (纬度分量，取反)
    return { x: x, y: z, z: -y };
  }

  /**
   * 经纬度 → 墨卡托坐标
   * 委托给 MercatorProjectionManager
   */
  lonLatToMercator(longitude, latitude) {
    return this.mercatorProjection.lonLatToMercator(longitude, latitude);
  }

  /**
   * 墨卡托坐标 → 经纬度
   * 委托给 MercatorProjectionManager
   */
  mercatorToLonLat(x, y) {
    return this.mercatorProjection.mercatorToLonLat(x, y);
  }

  /**
   * 纬度 → 墨卡托 Y 坐标
   * 委托给 MercatorProjectionManager
   */
  latitudeToMercator(latitude) {
    return this.mercatorProjection.latitudeToMercatorY(latitude);
  }

  /**
   * 墨卡托 Y 坐标 → 纬度
   * 委托给 MercatorProjectionManager
   */
  mercatorToLatitude(mercatorY) {
    return this.mercatorProjection.mercatorYToLatitude(mercatorY);
  }

  // ==================== Cesium 同步 ====================

  /**
   * 从 Cesium 相机同步到 Three.js
   *
   * ⚠️ 添加循环同步保护：防止从Dual同步时又触发从Cesium同步
   */
  syncCesiumToThree(cesiumCamera, cesiumScene) {
    const Cesium = this.getCesium();
    if (!Cesium) return;

    if (this.syncDepth > 0) return;
    if (this.throttleTimer) return;

    // ⭐ 关键修复：在局部坐标系模式下完全跳过 Cesium 到 Three.js 的同步
    // 局部坐标系模式下，floorCenterMercator 为 (0, 0, 0)，不应该从 Cesium 同步位置
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (isUsingLocalCoord) {
      console.log('[SyncManager.syncCesiumToThree] 局部坐标系模式：跳过 Cesium 到 Three.js 的同步', {
        说明: '局部坐标系模式下不需要从 Cesium 同步位置'
      });
      return;
    }

    // ⚠️ 关键修复：在大坐标模式下跳过同步（但局部坐标系模式除外）
    const LARGE_COORD_THRESHOLD = 1000;

    // ⭐ 使用前面声明的 isUsingLocalCoord 变量（第 748-749 行）
    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0 && !isUsingLocalCoord) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer && dualViewer.camera1 && dualViewer.camera1.position) {
        const isDualInLargeCoord =
          Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
          Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;

        if (isDualInLargeCoord) {
          console.log('[SyncManager.syncCesiumToThree] 大坐标模式：跳过同步，保持 Three.js 相机位置');
          return;
        }
      }
    }

    // ⚠️ 关键修复：检查是否正在从Dual同步，防止循环更新
    if (this._isSyncingFromDual) {
      console.log('[SyncManager] 跳过Cesium同步（正在从Dual同步）');
      return;
    }

    // ⭐ 新增：检测ENU坐标系，如果使用ENU则跳过Cesium到Three.js的同步
    const enuManager = typeof window !== 'undefined' && window.__enuCoordinateManager__;
    const usingENU = enuManager && enuManager.isInitialized();

    if (usingENU) {
      console.log('[SyncManager.syncCesiumToThree] ENU坐标系模式：跳过Cesium到Three.js的同步', {
        说明: 'ENU是本地坐标系，不需要从Cesium同步位置'
      });
      return;
    }

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
    }, this.throttleDelay);

    this.syncDepth++;

    try {
      const cameraPosition = cesiumCamera.position;

      if (!this.isValidCameraPosition(Cesium, cameraPosition)) {
        return;
      }

      const ellipsoid = cesiumScene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const earthRadius = ellipsoid.maximumRadius || 6378137.0;

      let cartographic;
      try {
        cartographic = ellipsoid.cartesianToCartographic(cameraPosition);
      } catch (error) {
        console.warn('[SyncManager] 坐标转换失败:', error.message);
        return;
      }

      if (!cartographic) return;

      const mercatorPosition = {
        x: cartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(cartographic.latitude),
        z: cartographic.height
      };

      // 计算目标点
      let targetCartographic = null;

      try {
        const direction = cesiumCamera.direction;
        const position = cesiumCamera.position;

        const directionMagnitude = Math.sqrt(
          direction.x * direction.x +
          direction.y * direction.y +
          direction.z * direction.z
        );

        const isValidDirection = direction &&
          Cesium.defined(direction) &&
          isFinite(direction.x) && isFinite(direction.y) && isFinite(direction.z) &&
          !isNaN(direction.x) && !isNaN(direction.y) && !isNaN(direction.z) &&
          directionMagnitude > 0.001 && directionMagnitude < 1000;

        const isValidPosition = position &&
          Cesium.defined(position) &&
          isFinite(position.x) && isFinite(position.y) && isFinite(position.z) &&
          !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z);

        const isVertical = Math.abs(direction.z) > 0.999;
        const mayIntersect = isValidDirection && isValidPosition && !isVertical;

        if (mayIntersect) {
          const ray = new Cesium.Ray(cesiumCamera.position, cesiumCamera.direction);
          const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);

          if (Cesium.defined(targetPosition)) {
            if (isFinite(targetPosition.x) && isFinite(targetPosition.y) && isFinite(targetPosition.z)) {
              targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
            }
          }
        }
      } catch (error) {
        // 静默忽略
      }

      if (!targetCartographic) {
        if (isNaN(cartographic.longitude) || isNaN(cartographic.latitude)) {
          return;
        }

        targetCartographic = Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );
      }

      if (isNaN(targetCartographic.longitude) || isNaN(targetCartographic.latitude)) {
        return;
      }

      const targetMercator = {
        x: targetCartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(targetCartographic.latitude),
        z: 0
      };

      // 转换为 Three.js 坐标
      const threeCameraPosition = this.mercatorToThree(
        mercatorPosition.x,
        mercatorPosition.y,
        mercatorPosition.z
      );

      const threeTargetPosition = this.mercatorToThree(
        targetMercator.x,
        targetMercator.y,
        targetMercator.z
      );

      // 检测相机是否在背面
      let isCameraOnBackSide = false;
      try {
        const cameraCartesian = cesiumCamera.position;

        if (cameraCartesian && this.floorCenterMercator) {
          if (!this._initialFloorCenterNormal) {
            const floorCenterCartographic = Cesium.Cartographic.fromRadians(
              this.floorCenterMercator.x / earthRadius,
              this.surfaceHandler.mercatorToLatitude(this.floorCenterMercator.y),
              0
            );
            const floorCenterCartesian = ellipsoid.cartographicToCartesian(floorCenterCartographic);

            if (floorCenterCartesian) {
              this._initialFloorCenterNormal = Cesium.Cartesian3.normalize(floorCenterCartesian, new Cesium.Cartesian3());
            }
          }

          if (this._initialFloorCenterNormal) {
            const cameraNormal = Cesium.Cartesian3.normalize(cameraCartesian, new Cesium.Cartesian3());
            const dotProduct = Cesium.Cartesian3.dot(cameraNormal, this._initialFloorCenterNormal);
            isCameraOnBackSide = dotProduct < 0;
          }
        }
      } catch (error) {
        // 忽略错误
      }

      if (this.onCesiumToThreeSync) {
        this.onCesiumToThreeSync(threeCameraPosition, threeTargetPosition, targetCartographic, isCameraOnBackSide);
      }
    } finally {
      this.syncDepth--;
    }
  }

  /**
   * 从 Three.js 相机同步到 Cesium
   *
   * ⚠️ 添加同步源标记，防止触发循环更新
   * ⚠️ 支持 ENU 坐标系：检测是否使用 ENU，如果是则跳过同步
   */
  syncThreeToCesium(threeCameraPosition, threeTargetPosition) {
    if (this.disableThreeToCesiumSync) return;

    // ⭐ 检查左键翻转保护（防止翻转后被反向同步覆盖）
    if (this.leftFlipProtection.enabled && Date.now() < this.leftFlipProtection.until) {
      console.log('[SyncManager] 左键翻转保护生效，跳过 Three.js → Cesium 同步');
      return;
    }

    if (typeof window !== 'undefined' && window.cesiumDualSyncV2) {
      const state = window.cesiumDualSyncV2.getState();
      if (state && state.isUserDragging) return;

      if (state && state.blockDualToCesiumSyncUntil && Date.now() < state.blockDualToCesiumSyncUntil) {
        return;
      }
    }

    if (this.syncDepth > 0) return;
    if (this.throttleTimer) return;

    // ⚠️ 关键修复：清除冷却计时器，允许同步
    if (this._syncCooldownTimer) {
      clearTimeout(this._syncCooldownTimer);
      this._syncCooldownTimer = null;
    }

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
    }, this.throttleDelay);

    // ⚠️ 关键修复：标记正在从Dual同步到Cesium
    this._isSyncingFromDual = true;

    this.syncDepth++;

    try {
      // ⭐ 新增：检测是否使用ENU坐标系
      const enuManager = typeof window !== 'undefined' && window.__enuCoordinateManager__;
      const usingENU = enuManager && enuManager.isInitialized();

      if (usingENU) {
        // ⭐ ENU坐标系：跳过Three.js到Cesium的同步
        // 理由：
        // 1. ENU是本地坐标系，相机移动不应影响Cesium的全局位置
        // 2. Cesium相机在ENU初始化时已经设置到正确位置
        // 3. Three.js相机的移动只是观察角度的变化，不需要同步到Cesium
        console.log('[SyncManager.syncThreeToCesium] ENU坐标系模式：跳过同步（ENU是本地坐标系）', {
          threePosition: `(${threeCameraPosition.x.toFixed(2)}, ${threeCameraPosition.y.toFixed(2)}, ${threeCameraPosition.z.toFixed(2)})`,
          threeTarget: `(${threeTargetPosition.x.toFixed(2)}, ${threeTargetPosition.y.toFixed(2)}, ${threeTargetPosition.z.toFixed(2)})`,
          说明: 'ENU是本地坐标系，Three.js相机移动不同步到Cesium'
        });
        return;
      }

      // ⚠️ 关键修复：在大坐标场景下，跳过 SyncManager 的同步逻辑
      // 直接检测 Three.js 原始坐标是否是大坐标
      const LARGE_COORD_THRESHOLD = 1000;
      const isLargeCoordinateScene =
        Math.abs(threeCameraPosition.x) > LARGE_COORD_THRESHOLD ||
        Math.abs(threeCameraPosition.z) > LARGE_COORD_THRESHOLD;

      if (isLargeCoordinateScene) {
        console.log('[SyncManager.syncThreeToCesium] 大坐标场景：跳过同步', {
          inputPosition: `(${threeCameraPosition.x.toFixed(2)}, ${threeCameraPosition.y.toFixed(2)}, ${threeCameraPosition.z.toFixed(2)})`,
          inputTarget: `(${threeTargetPosition.x.toFixed(2)}, ${threeTargetPosition.y.toFixed(2)}, ${threeTargetPosition.z.toFixed(2)})`
        });
        return;
      }

      const mercatorCameraPosition = this.threeToMercator(
        threeCameraPosition.x,
        threeCameraPosition.y,
        threeCameraPosition.z
      );

      const mercatorTargetPosition = this.threeToMercator(
        threeTargetPosition.x,
        threeTargetPosition.y,
        threeTargetPosition.z
      );

      console.log('[SyncManager.syncThreeToCesium] 小坐标场景：执行同步', {
        threePosition: `(${threeCameraPosition.x.toFixed(2)}, ${threeCameraPosition.y.toFixed(2)}, ${threeCameraPosition.z.toFixed(2)})`,
        threeTarget: `(${threeTargetPosition.x.toFixed(2)}, ${threeTargetPosition.y.toFixed(2)}, ${threeTargetPosition.z.toFixed(2)})`,
        mercatorPosition: `(${mercatorCameraPosition.x.toFixed(2)}, ${mercatorCameraPosition.y.toFixed(2)}, ${mercatorCameraPosition.z.toFixed(2)})`,
        mercatorTarget: `(${mercatorTargetPosition.x.toFixed(2)}, ${mercatorTargetPosition.y.toFixed(2)}, ${mercatorTargetPosition.z.toFixed(2)})`
      });

      if (this.onThreeToCesiumSync) {
        this.onThreeToCesiumSync(mercatorCameraPosition, mercatorTargetPosition);
      }
    } catch (error) {
      this.syncDepth--;
      console.error('[SyncManager] Three.js → Cesium 同步错误:', error);
    } finally {
      // ⚠️ 关键修复：延迟清除同步源标记，防止立即触发反向同步
      this._syncCooldownTimer = setTimeout(() => {
        this._isSyncingFromDual = false;
        this._syncCooldownTimer = null;
      }, 150); // 150ms冷却时间
    }
  }

  /**
   * 从 Cesium 相机同步初始方向到 Dual 相机
   * 用于大坐标模型加载后，确保 dual 相机与 Cesium 相机方向一致
   *
   * @param {Object} cesiumCamera - Cesium 相机实例
   */
  syncInitialDirectionFromCesium(cesiumCamera) {
    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera) {
      console.warn('[SyncManager] syncInitialDirectionFromCesium: 缺少必要参数');
      return;
    }

    try {
      // 获取 Cesium 相机的方向（ECEF 坐标系）
      const cesiumDirection = cesiumCamera.direction;

      // 获取相机位置的 ENU 基向量
      const ellipsoid = this.cesiumViewer?.scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);

      // 计算 ENU 基向量
      const lon = cameraCartographic.longitude;
      const lat = cameraCartographic.latitude;

      const cosLon = Math.cos(lon);
      const sinLon = Math.sin(lon);
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      // ENU 基向量在 ECEF 坐标系中
      const ecefEast = new Cesium.Cartesian3(-sinLon, cosLon, 0);
      const ecefUp = new Cesium.Cartesian3(cosLat * cosLon, cosLat * sinLon, sinLat);
      const ecefNorth = new Cesium.Cartesian3();
      Cesium.Cartesian3.cross(ecefUp, ecefEast, ecefNorth);

      // 将 Cesium 方向投影到 ENU 基向量
      const enuX = Cesium.Cartesian3.dot(cesiumDirection, ecefEast);
      const enuY = Cesium.Cartesian3.dot(cesiumDirection, ecefNorth);
      const enuZ = Cesium.Cartesian3.dot(cesiumDirection, ecefUp);

      // 转换到 State 坐标系（EUS: X=东, Y=天, Z=南）
      // ENU (X=东, Y=北, Z=天) → EUS (X=东, Y=天, Z=南)
      const newDirection = {
        x: enuX,        // 东 → 东
        y: enuZ,        // 天 → 天
        z: -enuY        // 北取反 → 南
      };

      // 归一化
      const len = Math.sqrt(newDirection.x ** 2 + newDirection.y ** 2 + newDirection.z ** 2);
      if (len > 0.0001) {
        newDirection.x /= len;
        newDirection.y /= len;
        newDirection.z /= len;
      }

      // 更新 unifiedCameraState
      this.unifiedCameraState.direction = newDirection;

      // 重建正交基
      this._rebuildOrthonormalBasis();

      console.log('[SyncManager] ✅ 已从 Cesium 同步初始方向:', {
        Cesium方向_ECEF: `(${cesiumDirection.x.toFixed(3)}, ${cesiumDirection.y.toFixed(3)}, ${cesiumDirection.z.toFixed(3)})`,
        ENU方向: `(${enuX.toFixed(3)}, ${enuY.toFixed(3)}, ${enuZ.toFixed(3)})`,
        State方向_EUS: `(${newDirection.x.toFixed(3)}, ${newDirection.y.toFixed(3)}, ${newDirection.z.toFixed(3)})`
      });

      // 同步到 dual 相机
      if (typeof window !== 'undefined' && window.__dualCanvasViewerInstances__) {
        const dualViewer = window.__dualCanvasViewerInstances__[0];
        if (dualViewer && dualViewer.camera1 && dualViewer.camera1.isCamera) {
          dualViewer.camera1.position.set(
            this.unifiedCameraState.position.x,
            this.unifiedCameraState.position.y,
            this.unifiedCameraState.position.z
          );

          // 设置方向
          const target = new THREE.Vector3(
            this.unifiedCameraState.position.x + newDirection.x * this.unifiedCameraState.height,
            this.unifiedCameraState.position.y + newDirection.y * this.unifiedCameraState.height,
            this.unifiedCameraState.position.z + newDirection.z * this.unifiedCameraState.height
          );
          dualViewer.camera1.lookAt(target);

          console.log('[SyncManager] ✅ 已同步方向到 dual 相机');
        }
      }
    } catch (error) {
      console.error('[SyncManager] syncInitialDirectionFromCesium 失败:', error);
    }
  }

  isValidCameraPosition(Cesium, cameraPosition) {
    if (!cameraPosition) return false;
    if (typeof Cesium.Cartesian3.isValid === 'function') {
      return Cesium.Cartesian3.isValid(cameraPosition);
    }
    return (
      typeof cameraPosition.x === 'number' &&
      typeof cameraPosition.y === 'number' &&
      typeof cameraPosition.z === 'number' &&
      isFinite(cameraPosition.x) &&
      isFinite(cameraPosition.y) &&
      isFinite(cameraPosition.z) &&
      (cameraPosition.x !== 0 || cameraPosition.y !== 0 || cameraPosition.z !== 0)
    );
  }

  // ==================== 统一平面投影坐标系 - 鼠标操作 ====================

  /**
   * 在统一坐标系中处理旋转
   * 新方案：使用 Cesium 屏幕中心墨卡托坐标作为参考点
   * 计算翻转时的变换，应用变换到 dual 地板中心点
   * 实现地板贴地与地面同步翻转，避免跳到地下
   */
  handleRotateInUnified(deltaX, deltaY) {
    const params = this.mouseOperationParams;
    const state = this.unifiedCameraState;

    // ⭐ 关键修复：验证 state 向量是否有效，防止 NaN 传播
    if (!state.direction ||
        typeof state.direction.x !== 'number' ||
        typeof state.direction.y !== 'number' ||
        typeof state.direction.z !== 'number' ||
        !isFinite(state.direction.x) ||
        !isFinite(state.direction.y) ||
        !isFinite(state.direction.z)) {
      console.error('[SyncManager] handleRotateInUnified state.direction 无效，使用安全默认值:', {
        direction: state.direction,
        x: state.direction?.x,
        y: state.direction?.y,
        z: state.direction?.z
      });
      // 使用安全的默认方向：向下倾斜 150°
      state.direction = { x: 0, y: -0.866, z: -0.5 };
    }

    // 验证 state.right
    if (!state.right ||
        typeof state.right.x !== 'number' ||
        typeof state.right.y !== 'number' ||
        typeof state.right.z !== 'number' ||
        !isFinite(state.right.x) ||
        !isFinite(state.right.y) ||
        !isFinite(state.right.z)) {
      console.error('[SyncManager] handleRotateInUnified state.right 无效，使用安全默认值:', {
        right: state.right
      });
      state.right = { x: 1, y: 0, z: 0 };
    }

    // 验证 state.up
    if (!state.up ||
        typeof state.up.x !== 'number' ||
        typeof state.up.y !== 'number' ||
        typeof state.up.z !== 'number' ||
        !isFinite(state.up.x) ||
        !isFinite(state.up.y) ||
        !isFinite(state.up.z)) {
      console.error('[SyncManager] handleRotateInUnified state.up 无效，使用安全默认值:', {
        up: state.up
      });
      state.up = { x: 0, y: 1, z: 0 };
    }

    // 验证 state.position
    if (!state.position ||
        typeof state.position.x !== 'number' ||
        typeof state.position.y !== 'number' ||
        typeof state.position.z !== 'number' ||
        !isFinite(state.position.x) ||
        !isFinite(state.position.y) ||
        !isFinite(state.position.z)) {
      console.error('[SyncManager] handleRotateInUnified state.position 无效，使用安全默认值:', {
        position: state.position
      });
      state.position = { x: 0, y: 100, z: 0 };
    }

    // 验证 state.target
    if (!state.target ||
        typeof state.target.x !== 'number' ||
        typeof state.target.y !== 'number' ||
        typeof state.target.z !== 'number' ||
        !isFinite(state.target.x) ||
        !isFinite(state.target.y) ||
        !isFinite(state.target.z)) {
      console.error('[SyncManager] handleRotateInUnified state.target 无效，使用安全默认值:', {
        target: state.target
      });
      state.target = { x: 0, y: 0, z: 0 };
    }

    const originalDirection = { ...state.direction };
    let originalTarget = { ...state.target };
    const originalPosition = { ...state.position };
    const originalHeight = state.height;
    const dotY = VectorMath.dot(originalDirection, { x: 0, y: 1, z: 0 });
    const isVertical = Math.abs(dotY) > 0.999;

    // 计算基础翻转角度
    let pitchAngle = deltaY * params.rotateSpeed;
    let yawAngle = deltaX * params.rotateSpeed;

    // ⭐ 检查是否为局部坐标系模式
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    // ⭐ 关键：局部坐标模式下的谨慎动态旋转速度调整
    // 只调整旋转角度计算，不修改方向向量，不重新计算高度，避免位置跳跃
    if (isUsingLocalCoord) {
      // 1. 计算俯仰程度：越接近俯瞰（direction.y 接近 -1），俯仰程度越高
      const lookingDownFactor = Math.max(0, -originalDirection.y); // 0 (水平) 到 1 (完全向下)

      // 2. 计算高度因子：相机越高，因子越大
      const heightFactor = Math.min(1, originalHeight / 500); // 0 (低空) 到 1 (高空500米+)

      // 3. 使用平滑的调整曲线（平方函数）使变化更渐进，避免突变
      // 最大降低 40% (俯仰) + 20% (高度) = 60%，保留至少 30%
      const speedReductionFactor = 1.0 - (Math.pow(lookingDownFactor, 2) * 0.4) - (Math.pow(heightFactor, 2) * 0.2);
      const clampedSpeedFactor = Math.max(0.4, Math.min(1.0, speedReductionFactor));

      // 4. 应用调整因子到旋转角度（不修改方向向量，不改变高度）
      pitchAngle *= clampedSpeedFactor;
      yawAngle *= clampedSpeedFactor;
    }

    // ⭐ 只在非局部坐标系模式下获取屏幕中心墨卡托坐标（用于地板变换）
    // 局部坐标系模式下，floorCenterMercator 为 (0, 0, 0)，不需要也不应该使用地板变换
    const screenCenterMercator = isUsingLocalCoord ? null : this.getCesiumScreenCenterMercator();

    // ⭐ 监控大坐标模型海拔位置（仅在局部坐标系模式下）
    let largeCoordModelInfoBefore = null;
    if (isUsingLocalCoord && typeof window !== 'undefined') {
      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (dualViewer && dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
        largeCoordModelInfoBefore = [];
        dualViewer.modelGroup1.children.forEach((model, index) => {
          const originalLocation = model.userData?.originalLocation;
          if (originalLocation && (originalLocation.cartographic || originalLocation.ecef)) {
            const modelWorldPos = new THREE.Vector3();
            model.getWorldPosition(modelWorldPos);

            largeCoordModelInfoBefore.push({
              index,
              name: model.name,
              localPosition: {
                x: model.position.x,
                y: model.position.y,
                z: model.position.z
              },
              worldPosition: {
                x: modelWorldPos.x,
                y: modelWorldPos.y,
                z: modelWorldPos.z
              },
              ecef: originalLocation.ecef ? {
                x: originalLocation.ecef.x,
                y: originalLocation.ecef.y,
                z: originalLocation.ecef.z
              } : null,
              cartographic: originalLocation.cartographic ? {
                longitude: originalLocation.cartographic.longitude,
                latitude: originalLocation.cartographic.latitude,
                height: originalLocation.cartographic.height
              } : null
            });
          }
        });

        if (largeCoordModelInfoBefore.length > 0) {
          console.log('%c[SyncManager] ⭐ 翻转前 - 大坐标模型位置监控:', 'color: #ff6b6b; font-weight: bold', {
            模型数量: largeCoordModelInfoBefore.length,
            模型详情: largeCoordModelInfoBefore.map(info => ({
              名称: info.name,
              局部坐标: `(${info.localPosition.x.toFixed(2)}, ${info.localPosition.y.toFixed(2)}, ${info.localPosition.z.toFixed(2)})`,
              世界坐标: `(${info.worldPosition.x.toFixed(2)}, ${info.worldPosition.y.toFixed(2)}, ${info.worldPosition.z.toFixed(2)})`,
              ECEF坐标: info.ecef ? `(${info.ecef.x.toFixed(2)}, ${info.ecef.y.toFixed(2)}, ${info.ecef.z.toFixed(2)})` : '无',
              经纬度: info.cartographic ? `(${(info.cartographic.longitude * 180 / Math.PI).toFixed(6)}°, ${(info.cartographic.latitude * 180 / Math.PI).toFixed(6)}°)` : '无',
              海拔: info.cartographic ? `${info.cartographic.height.toFixed(2)}米` : '无'
            }))
          });
        }
      }
    }

    console.log('[SyncManager] handleRotateInUnified 调用:', {
      originalPosition: `(${originalPosition.x.toFixed(2)}, ${originalPosition.y.toFixed(2)}, ${originalPosition.z.toFixed(2)})`,
      originalTarget: `(${originalTarget.x.toFixed(2)}, ${originalTarget.y.toFixed(2)}, ${originalTarget.z.toFixed(2)})`,
      directionY: originalDirection.y.toFixed(3),
      pitchAngle: pitchAngle.toFixed(4),
      yawAngle: yawAngle.toFixed(4),
      hasFloorCenter: !!this.floorCenterMercator,
      hasScreenCenter: !!screenCenterMercator,
      isUsingLocalCoord,
      speedAdjusted: isUsingLocalCoord,
      screenCenter: screenCenterMercator ? `(${screenCenterMercator.x.toFixed(2)}, ${screenCenterMercator.y.toFixed(2)})` : 'null'
    });

    // ⭐ 强制翻转保护：无论是否获取到屏幕中心，都检查并防止跳到地下
    const wasAboveGround = originalPosition.y >= -10;
    const wasLookingDown = originalDirection.y < 0;

    console.log('[SyncManager] 翻转前状态:', {
      wasAboveGround,
      wasLookingDown,
      originalPositionY: originalPosition.y.toFixed(2)
    });

    // 执行方向向量旋转
    let newDirection = { ...originalDirection };

    // ⚠️ 关键修复：在旋转前检查是否会翻转，提前限制俯仰角
    // 如果相机向下看且向上旋转，预测旋转后的 Y 分量
    if (wasLookingDown && pitchAngle > 0) {
      // 向上仰视，检查是否会翻转
      // 使用简化的角度计算：sin(angle) ≈ angle for small angles
      const estimatedNewY = originalDirection.y - Math.cos(Math.asin(Math.abs(originalDirection.y))) * pitchAngle;

      // 如果预测会翻转（Y 变为正或接近 0），限制俯仰角
      const minY = -0.1; // 最小向下分量
      if (estimatedNewY > minY) {
        // 限制俯仰角，避免翻转
        const maxPitchAngle = Math.asin(Math.abs(originalDirection.y)) - Math.asin(Math.abs(minY));
        pitchAngle = Math.min(pitchAngle, maxPitchAngle);
        console.log('[SyncManager] 限制俯仰角以避免翻转:', {
          originalY: originalDirection.y.toFixed(3),
          estimatedY: estimatedNewY.toFixed(3),
          maxY: minY,
          originalPitch: (pitchAngle * 180 / Math.PI).toFixed(2) + '°',
          limitedPitch: (pitchAngle * 180 / Math.PI).toFixed(2) + '°'
        });
      }
    }

    // 绕水平轴旋转（俯仰）
    if (isVertical) {
      const worldX = { x: 1, y: 0, z: 0 };
      newDirection = VectorMath.rotateAroundAxis(newDirection, worldX, -pitchAngle);
    } else {
      newDirection = VectorMath.rotateAroundAxis(newDirection, state.right, -pitchAngle);
    }

    // 绕垂直轴旋转（偏航）
    const isLookingDown = originalDirection.y < 0;
    const isNearlyVerticalDown = isLookingDown && Math.abs(dotY) > 0.9;

    if (isVertical) {
      const worldZ = { x: 0, y: 0, z: 1 };
      newDirection = VectorMath.rotateAroundAxis(newDirection, worldZ, -yawAngle);
    } else if (isNearlyVerticalDown) {
      newDirection = VectorMath.rotateAroundAxis(newDirection, state.right, -yawAngle);
    } else {
      newDirection = VectorMath.rotateAroundAxis(newDirection, state.up, -yawAngle);
    }

    // 归一化方向向量
    newDirection = VectorMath.normalize(newDirection);

    // ⚠️ 二次保护：旋转后检查是否进入极点翻转区域
    // 170° 对应 direction.y ≈ -0.985，如果超过这个值则强制修正
    const MAX_POLAR_ANGLE = Math.PI * 0.944; // 170°
    const minDirectionY = Math.cos(MAX_POLAR_ANGLE); // cos(170°) ≈ -0.985

    if (wasLookingDown && newDirection.y < minDirectionY) {
      console.log('[SyncManager] 旋转后极点翻转保护：强制修正方向向量', {
        before: originalDirection.y.toFixed(3),
        after: newDirection.y.toFixed(3),
        polarAngle: `${(Math.acos(newDirection.y) * 180 / Math.PI).toFixed(1)}°`,
        limit: `≤ ${MAX_POLAR_ANGLE * 180 / Math.PI}°`
      });

      // 保持水平方向，只限制 Y 分量到安全边界
      const horizontalLength = Math.sqrt(newDirection.x * newDirection.x + newDirection.z * newDirection.z);
      if (horizontalLength > 0.001) {
        const normalizedX = newDirection.x / horizontalLength;
        const normalizedZ = newDirection.z / horizontalLength;
        const safeY = minDirectionY + 0.01; // 留出额外 1° 缓冲
        const horizontalScale = Math.sqrt(1 - safeY * safeY);

        newDirection.x = normalizedX * horizontalScale;
        newDirection.y = safeY;
        newDirection.z = normalizedZ * horizontalScale;

        // 归一化
        const len = Math.sqrt(newDirection.x ** 2 + newDirection.y ** 2 + newDirection.z ** 2);
        if (len > 0.0001) {
          newDirection.x /= len;
          newDirection.y /= len;
          newDirection.z /= len;
        }

        console.log('[SyncManager] 方向向量已修正到安全范围:', {
          newPolarAngle: `${(Math.acos(newDirection.y) * 180 / Math.PI).toFixed(1)}°`,
          newDirectionY: newDirection.y.toFixed(3)
        });
      }
    }

    // ⭐ 地上模式翻转保护：如果原来在地上且向下看，翻转后必须保持在地上
    // 放宽限制：允许相机在一定范围内旋转，只有真正翻转时才限制
    if (wasAboveGround && wasLookingDown) {
      // 预测翻转后的位置
      const predictedPosition = {
        x: originalTarget.x - newDirection.x * originalHeight,
        y: originalTarget.y - newDirection.y * originalHeight,
        z: originalTarget.z - newDirection.z * originalHeight
      };

      const wouldGoUnderground = predictedPosition.y < -10;
      // ⭐ 修改：只有当方向真正翻转（向上看）时才限制，允许水平或略微向上看
      const wouldFlipOver = newDirection.y > 0.2; // 向上看超过约 11.5 度才算翻转

      if (wouldGoUnderground || wouldFlipOver) {
        console.log('[SyncManager] 地上模式翻转限制：强制修正', {
          wasAboveGround,
          wasLookingDown,
          predictedY: predictedPosition.y.toFixed(2),
          newDirectionY: newDirection.y.toFixed(3),
          wouldGoUnderground,
          wouldFlipOver,
          pitchAngle: pitchAngle.toFixed(4)
        });

        // 强制保持向下看：direction.y 必须在 -1 到 -0.1 之间
        const minDownwardY = -0.1; // 允许的最小向下分量（对应约 5.7 度仰角）

        if (newDirection.y > minDownwardY) {
          // 方向向量过于水平或向上，需要强制修正
          // 计算原始方向在水平面的投影
          const horizontalLength = Math.sqrt(newDirection.x * newDirection.x + newDirection.z * newDirection.z);

          if (horizontalLength > 0.001) {
            // ⚠️ 关键修复：保持水平方向符号不变，避免180度翻转
            // 归一化水平分量（保持符号）
            const normalizedX = newDirection.x / horizontalLength;
            const normalizedZ = newDirection.z / horizontalLength;

            // 限制 Y 分量的最大值（确保向下看）
            // maxY 是允许的最大 Y 值（接近水平但仍然向下）
            const maxY = -0.05; // 稍微放宽限制，允许接近水平但仍然向下

            // 如果 newDirection.y 大于阈值（太接近水平或向上），强制修正
            if (newDirection.y > maxY) {
              // 保持水平方向不变，只调整 Y 分量
              // 确保 X 和 Z 的符号不会改变
              const safeY = Math.min(newDirection.y, maxY);
              const horizontalScale = Math.sqrt(1 - safeY * safeY);

              newDirection.x = normalizedX * horizontalScale;
              newDirection.y = safeY;
              newDirection.z = normalizedZ * horizontalScale;
            }
          } else {
            // 原始方向几乎垂直，使用默认向下看方向
            newDirection = { x: 0, y: -1, z: 0 };
          }

          // 重新归一化
          const len = Math.sqrt(newDirection.x ** 2 + newDirection.y ** 2 + newDirection.z ** 2);
          if (len > 0.0001) {
            newDirection.x /= len;
            newDirection.y /= len;
            newDirection.z /= len;
          }

          console.log('[SyncManager] 方向向量已修正:', {
            before: `(${originalDirection.y.toFixed(3)})`,
            after: `(${newDirection.y.toFixed(3)})`
          });
        }
      }
    }

    // 更新状态
    state.direction = newDirection;

    // ⭐ 关键修复：局部坐标系模式下，相机原地旋转，保持 target 与相机的相对关系
    // 真实世界模式下，相机围绕固定的 target 旋转
    if (isUsingLocalCoord) {
      // ⭐ 关键修复：在局部坐标系模式下，target 应该指向模型位置
      // 局部坐标系模式下：
      // - 模型在 Dual 坐标中的位置通常是 (0, 0, 0)
      // - 但相机的 target 需要考虑 dualFloorHeight 的偏移
      // - dualFloorHeight 表示 Dual 地板相对于 Cesium 地面的偏移

      // ⚠️ 使用 dualFloorHeight 而不是 actualTerrainHeight
      // 原因：dualFloorHeight 包含了地板高度配置，可能不为 0
      const dualFloorHeight = this.mercatorProjection.dualFloorHeight ?? 0;

      state.target = {
        x: 0,  // 保持 x=0，确保旋转中心在模型附近
        y: dualFloorHeight,  // ⭐ 使用 dualFloorHeight，包含地板高度偏移
        z: 0   // 保持 z=0，确保旋转中心在模型附近
      };

      // ⭐ 关键修复：更新 state.position，使相机能够旋转
      // 问题：之前 state.position 保持为 originalPosition，导致 dual 层不转动
      // 解决：根据新的方向和 target 计算新的相机位置
      state.position = {
        x: state.target.x - newDirection.x * originalHeight,
        y: state.target.y - newDirection.y * originalHeight,
        z: state.target.z - newDirection.z * originalHeight
      };

      console.log('[SyncManager.handleRotateInUnified] 局部坐标系模式：更新相机位置以支持旋转', {
        target: `(${state.target.x.toFixed(2)}, ${state.target.y.toFixed(2)}, ${state.target.z.toFixed(2)})`,
        position: `(${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`,
        direction: `(${newDirection.x.toFixed(3)}, ${newDirection.y.toFixed(3)}, ${newDirection.z.toFixed(3)})`,
        dualFloorHeight: dualFloorHeight.toFixed(2) + 'm',
        说明: 'target.y 使用 dualFloorHeight 以正确对齐模型位置'
      });
    } else {
      // 真实世界模式：围绕固定 target 旋转
      state.target = { ...originalTarget };
      state.position = {
        x: state.target.x - state.direction.x * originalHeight,
        y: state.target.y - state.direction.y * originalHeight,
        z: state.target.z - state.direction.z * originalHeight
      };
    }

    // 重建正交基
    this._rebuildOrthonormalBasis();

    // ⭐ 新增：应用地板变换（仅真实世界模式下）
    // 使用屏幕中心墨卡托坐标计算变换，应用到dual地板中心点
    // ⚠️ 关键：局部坐标系模式下不调用地板变换，因为 floorCenterMercator 为 (0, 0, 0)
    if (!isUsingLocalCoord) {
      this._applyFloorTransformAfterRotate(screenCenterMercator, originalDirection, state.direction);
    }

    // ⚠️ 关键修复：翻转操作后也需要更新地板中心
    // 翻转虽然不改变相机位置，但屏幕中心对应的墨卡托坐标可能已经变化
    // 特别是在平移后翻转，地板中心需要保持同步
    // ⭐ 局部坐标系模式下不更新地板中心
    if (!isUsingLocalCoord && screenCenterMercator && this.floorCenterMercator && this.floorCenterMercator.x !== 0) {
      // 检查屏幕中心是否发生了显著变化（避免频繁更新）
      const deltaX = Math.abs(screenCenterMercator.x - this.floorCenterMercator.x);
      const deltaY = Math.abs(screenCenterMercator.y - this.floorCenterMercator.y);

      if (deltaX > 1 || deltaY > 1) {
        console.log('[SyncManager.handleRotateInUnified] 更新地板中心（翻转后）:', {
          oldFloorCenter: `(${this.floorCenterMercator.x.toFixed(2)}, ${this.floorCenterMercator.y.toFixed(2)})`,
          newFloorCenter: `(${screenCenterMercator.x.toFixed(2)}, ${screenCenterMercator.y.toFixed(2)})`
        });

        // 更新地板中心
        this.setFloorCenter(screenCenterMercator);
      }
    }

    // ⭐ 关键修复：局部坐标系模式下，同步 state.target 到 OrbitControls.target
    // 确保 OrbitControls 的旋转中心与 SyncManager 的 target 保持一致
    if (isUsingLocalCoord) {
      const dualViewer = window.__dualCanvasViewerInstances?.[0];
      if (dualViewer && dualViewer.controls1 && dualViewer.controls1.target) {
        // ⭐ 关键修复：在更新 target 之前，保存当前相机位置
        // 问题：更新 target 后，OrbitControls 可能会调整相机位置
        // 解决：更新 target 后立即恢复相机位置到原始值
        const originalCameraPosition = {
          x: dualViewer.camera1.position.x,
          y: dualViewer.camera1.position.y,
          z: dualViewer.camera1.position.z
        };

        dualViewer.controls1.target.set(
          state.target.x,
          state.target.y,
          state.target.z
        );

        // ⭐ 立即恢复相机位置，防止 OrbitControls 自动调整
        dualViewer.camera1.position.set(
          originalCameraPosition.x,
          originalCameraPosition.y,
          originalCameraPosition.z
        );

        console.log('[SyncManager.handleRotateInUnified] 🔄 已同步 target 并保持相机位置不变:', {
          target: `(${state.target.x.toFixed(2)}, ${state.target.y.toFixed(2)}, ${state.target.z.toFixed(2)})`,
          相机位置: `(${originalCameraPosition.x.toFixed(2)}, ${originalCameraPosition.y.toFixed(2)}, ${originalCameraPosition.z.toFixed(2)})`
        });
      }
    }

    // ⭐ 在局部坐标系模式下，跳过 target 调整
    // 原因：_adjustTargetToAlignWithGround 使用 Cesium 相机位置计算 target，
    // 但在局部坐标系模式下，Three.js 相机可能远离模型位置，导致计算错误
    // 解决：target 已在 reinitUnifiedState 中正确设置，无需在此调整
    // if (isUsingLocalCoord) {
    //   this._adjustTargetToAlignWithGround(state);
    // }

    // ⭐ 关键修复：翻转后立即同步到 Cesium（局部坐标模式）
    // 问题：禁用同步导致翻转操作在 Three.js dual 中生效，但 Cesium 地面不同步
    // 解决：使用 mercatorProjection.syncDirectionToCesium 而不是 syncUnifiedToCesium
    // 原因：syncDirectionToCesium 直接使用 state.direction，不会从 target 重新计算方向
    if (isUsingLocalCoord) {
      const cesiumViewer = this.cesiumViewer;
      const cesiumCamera = cesiumViewer?.camera;
      const cesiumScene = cesiumViewer?.scene;

      if (cesiumCamera && cesiumScene && this.mercatorProjection) {
        console.log('[SyncManager.handleRotateInUnified] 局部坐标模式：翻转后立即同步到 Cesium');
        const success = this.mercatorProjection.syncDirectionToCesium(
          this.unifiedCameraState,
          cesiumCamera,
          cesiumScene
        );

        if (!success) {
          console.error('[SyncManager.handleRotateInUnified] 同步到 Cesium 失败');
        }

        // ⭐ 关键：强制 Cesium 立即渲染，确保翻转在地面视口中立即可见
        // 无论 requestRenderMode 是否开启，都强制渲染确保翻转立即可见
        if (cesiumScene.requestRender) {
          cesiumScene.requestRender();
        } else {
          // 如果没有 requestRender 方法，尝试直接触发相机更新
          cesiumCamera.update(cesiumScene.clock.currentTime);
        }

        // ⭐ 设置标志，避免后续的 syncUnifiedToCesium 重复同步
        this._skipNextCesiumSync = true;
      }

      // ⭐ 监控大坐标模型海拔位置（翻转后）
      if (largeCoordModelInfoBefore && typeof window !== 'undefined') {
        const dualViewer = window.__dualCanvasViewerInstances?.[0];
        if (dualViewer && dualViewer.modelGroup1 && dualViewer.modelGroup1.children.length > 0) {
          const largeCoordModelInfoAfter = [];
          dualViewer.modelGroup1.children.forEach((model, index) => {
            const originalLocation = model.userData?.originalLocation;
            if (originalLocation && (originalLocation.cartographic || originalLocation.ecef)) {
              const modelWorldPos = new THREE.Vector3();
              model.getWorldPosition(modelWorldPos);

              largeCoordModelInfoAfter.push({
                index,
                name: model.name,
                localPosition: {
                  x: model.position.x,
                  y: model.position.y,
                  z: model.position.z
                },
                worldPosition: {
                  x: modelWorldPos.x,
                  y: modelWorldPos.y,
                  z: modelWorldPos.z
                },
                ecef: originalLocation.ecef ? {
                  x: originalLocation.ecef.x,
                  y: originalLocation.ecef.y,
                  z: originalLocation.ecef.z
                } : null,
                cartographic: originalLocation.cartographic ? {
                  longitude: originalLocation.cartographic.longitude,
                  latitude: originalLocation.cartographic.latitude,
                  height: originalLocation.cartographic.height
                } : null
              });
            }
          });

          // 对比翻转前后的变化
          const changes = [];
          largeCoordModelInfoBefore.forEach((before, idx) => {
            const after = largeCoordModelInfoAfter.find(a => a.index === before.index);
            if (after) {
              const localDelta = {
                x: after.localPosition.x - before.localPosition.x,
                y: after.localPosition.y - before.localPosition.y,
                z: after.localPosition.z - before.localPosition.z
              };
              const worldDelta = {
                x: after.worldPosition.x - before.worldPosition.x,
                y: after.worldPosition.y - before.worldPosition.y,
                z: after.worldPosition.z - before.worldPosition.z
              };
              const heightDelta = after.cartographic && before.cartographic
                ? after.cartographic.height - before.cartographic.height
                : 0;

              // 检查是否有显著变化（阈值：0.01米）
              const hasSignificantChange =
                Math.abs(localDelta.x) > 0.01 ||
                Math.abs(localDelta.y) > 0.01 ||
                Math.abs(localDelta.z) > 0.01 ||
                Math.abs(worldDelta.x) > 0.01 ||
                Math.abs(worldDelta.y) > 0.01 ||
                Math.abs(worldDelta.z) > 0.01 ||
                Math.abs(heightDelta) > 0.01;

              if (hasSignificantChange) {
                changes.push({
                  index: before.index,
                  name: before.name,
                  局部坐标变化: `Δ(${localDelta.x.toFixed(4)}, ${localDelta.y.toFixed(4)}, ${localDelta.z.toFixed(4)})`,
                  世界坐标变化: `Δ(${worldDelta.x.toFixed(4)}, ${worldDelta.y.toFixed(4)}, ${worldDelta.z.toFixed(4)})`,
                  海拔变化: heightDelta !== 0 ? `${heightDelta.toFixed(4)}米` : '无',
                  ECEF坐标: before.ecef ? `相同` : '无'
                });
              }
            }
          });

          console.log('%c[SyncManager] ⭐ 翻转后 - 大坐标模型位置监控:', 'color: #4ade80; font-weight: bold', {
            模型数量: largeCoordModelInfoAfter.length,
            变化检测: changes.length > 0 ? '❌ 检测到变化' : '✅ 无变化',
            变化详情: changes.length > 0 ? changes : '无显著变化',
            模型详情: largeCoordModelInfoAfter.map(info => ({
              名称: info.name,
              局部坐标: `(${info.localPosition.x.toFixed(2)}, ${info.localPosition.y.toFixed(2)}, ${info.localPosition.z.toFixed(2)})`,
              世界坐标: `(${info.worldPosition.x.toFixed(2)}, ${info.worldPosition.y.toFixed(2)}, ${info.worldPosition.z.toFixed(2)})`,
              ECEF坐标: info.ecef ? `(${info.ecef.x.toFixed(2)}, ${info.ecef.y.toFixed(2)}, ${info.ecef.z.toFixed(2)})` : '无',
              经纬度: info.cartographic ? `(${(info.cartographic.longitude * 180 / Math.PI).toFixed(6)}°, ${(info.cartographic.latitude * 180 / Math.PI).toFixed(6)}°)` : '无',
              海拔: info.cartographic ? `${info.cartographic.height.toFixed(2)}米` : '无'
            }))
          });

          if (changes.length > 0) {
            console.error('%c[SyncManager] ⚠️ 警告：翻转后大坐标模型位置发生变化！', 'color: #ff6b6b; font-weight: bold', changes);
          }
        }
      }
    }

    // 减少日志输出频率，只在需要时调试
    // console.log('[SyncManager] 旋转完成:', {
    //   newPositionY: state.position.y.toFixed(2),
    //   directionY: state.direction.y.toFixed(3),
    //   height: state.height.toFixed(2)
    // });
  }

  /**
   * 在翻转后应用地板变换
   * 使用屏幕中心墨卡托坐标计算变换，应用到dual地板中心点
   * 实现地板贴地与地面同步翻转
   *
   * @param {Object|null} screenCenterMercator - 屏幕中心墨卡托坐标
   * @param {Object} originalDirection - 原始方向向量
   * @param {Object} newDirection - 新的方向向量
   */
  _applyFloorTransformAfterRotate(screenCenterMercator, originalDirection, newDirection) {
    if (!screenCenterMercator || !this.floorCenterMercator) {
      console.log('[SyncManager._applyFloorTransformAfterRotate] 跳过地板变换（缺少必要参数）');
      return;
    }

    console.log('[SyncManager._applyFloorTransformAfterRotate] 开始应用地板变换:', {
      screenCenter: `(${screenCenterMercator.x.toFixed(2)}, ${screenCenterMercator.y.toFixed(2)})`,
      floorCenter: `(${this.floorCenterMercator.x.toFixed(2)}, ${this.floorCenterMercator.y.toFixed(2)})`
    });

    try {
      // ⭐ 核心逻辑：在真实世界模式下，地板模型应该始终贴地
      // 关键是保持屏幕中心点和地板中心点的相对关系不变

      // 计算屏幕中心相对于地板中心的偏移（翻转前）
      const beforeOffset = {
        x: screenCenterMercator.x - this.floorCenterMercator.x,
        y: screenCenterMercator.y - this.floorCenterMercator.y
      };

      // 计算方向向量的水平旋转角度（偏航角变化）
      // 这是我们需要应用到地板模型上的旋转量
      const horizontalRotationAngle = this._calculateHorizontalRotationAngle(originalDirection, newDirection);

      console.log('[SyncManager._applyFloorTransformAfterRotate] 水平旋转角度:', {
        angleInRadians: horizontalRotationAngle.toFixed(4),
        angleInDegrees: (horizontalRotationAngle * 180 / Math.PI).toFixed(2) + '°',
        originalDirection: `(${originalDirection.x.toFixed(3)}, ${originalDirection.y.toFixed(3)}, ${originalDirection.z.toFixed(3)})`,
        newDirection: `(${newDirection.x.toFixed(3)}, ${newDirection.y.toFixed(3)}, ${newDirection.z.toFixed(3)})`
      });

      // ⭐ 关键决策：是否需要更新地板中心？
      // 在真实世界模式下，地板中心应该保持固定（它是地理坐标）
      // 但是，由于我们使用的是相对坐标系统，需要在某些情况下进行调整

      // 检查是否需要应用变换
      const needsTransform = Math.abs(horizontalRotationAngle) > 0.001; // 大于0.001弧度才需要变换

      if (needsTransform && this.onFloorCenterUpdate) {
        // ⭐ 策略：保持地板中心固定，但通知DualCanvasViewer调整模型位置
        // 这样可以确保模型始终贴地，与地面保持同步

        // 计算旋转后的屏幕中心位置（围绕地板中心旋转）
        const rotatedScreenCenter = this._rotatePointAroundCenter(
          screenCenterMercator,
          this.floorCenterMercator,
          horizontalRotationAngle
        );

        // 计算模型需要的偏移量（从旋转后的屏幕中心回到原始屏幕中心）
        const modelOffset = {
          x: screenCenterMercator.x - rotatedScreenCenter.x,
          y: screenCenterMercator.y - rotatedScreenCenter.y,
          z: 0
        };

        console.log('[SyncManager._applyFloorTransformAfterRotate] 模型偏移计算:', {
          原始屏幕中心: `(${screenCenterMercator.x.toFixed(2)}, ${screenCenterMercator.y.toFixed(2)})`,
          旋转后屏幕中心: `(${rotatedScreenCenter.x.toFixed(2)}, ${rotatedScreenCenter.y.toFixed(2)})`,
          模型偏移: `(${modelOffset.x.toFixed(2)}, ${modelOffset.y.toFixed(2)})`,
          旋转角度: (horizontalRotationAngle * 180 / Math.PI).toFixed(2) + '°'
        });

        // 将墨卡托偏移量转换为 Three.js 偏移量
        const threeOffset = {
          x: modelOffset.x,
          y: modelOffset.z,  // 高度分量
          z: -modelOffset.y  // 纬度分量，取反
        };

        // 触发地板中心更新回调，传递模型偏移量
        // 注意：这里我们传递的是原始地板中心，但带有模型偏移信息
        this.onFloorCenterUpdate({
          ...this.floorCenterMercator,
          _modelOffset: threeOffset,  // 附加模型偏移信息
          _rotationAngle: horizontalRotationAngle,  // 附加旋转角度信息
          _isRotateOperation: true  // 标记这是翻转操作
        });

        console.log('[SyncManager._applyFloorTransformAfterRotate] 已触发地板变换回调（翻转模式）');
      } else {
        console.log('[SyncManager._applyFloorTransformAfterRotate] 跳过地板变换（角度太小或无回调）');
      }

    } catch (error) {
      console.error('[SyncManager._applyFloorTransformAfterRotate] 地板变换失败:', error);
    }
  }

  /**
   * 计算方向向量的水平旋转角度（偏航角变化）
   * 只考虑水平面（XZ平面）上的旋转，忽略俯仰角变化
   *
   * @param {Object} dir1 - 原始方向向量 {x, y, z}
   * @param {Object} dir2 - 新方向向量 {x, y, z}
   * @returns {number} 水平旋转角度（弧度）
   */
  _calculateHorizontalRotationAngle(dir1, dir2) {
    if (!dir1 || !dir2) return 0;

    // 提取水平分量（XZ平面）
    const h1 = { x: dir1.x, z: dir1.z };
    const h2 = { x: dir2.x, z: dir2.z };

    // 计算水平向量的长度
    const len1 = Math.sqrt(h1.x * h1.x + h1.z * h1.z);
    const len2 = Math.sqrt(h2.x * h2.x + h2.z * h2.z);

    // 防止除零
    if (len1 < 0.0001 || len2 < 0.0001) return 0;

    // 归一化水平向量
    const n1 = { x: h1.x / len1, z: h1.z / len1 };
    const n2 = { x: h2.x / len2, z: h2.z / len2 };

    // 计算点积
    const dot = n1.x * n2.x + n1.z * n2.z;

    // 计算叉积（用于确定旋转方向）
    const cross = n1.x * n2.z - n1.z * n2.x;

    // 计算角度
    const cosAngle = Math.max(-1, Math.min(1, dot));
    let angle = Math.acos(cosAngle);

    // 根据叉积确定旋转方向
    if (cross < 0) {
      angle = -angle;
    }

    return angle;
  }

  /**
   * 计算两个方向向量之间的夹角
   * @param {Object} dir1 - 方向向量1 {x, y, z}
   * @param {Object} dir2 - 方向向量2 {x, y, z}
   * @returns {number} 夹角（弧度）
   */
  _calculateAngleBetweenDirections(dir1, dir2) {
    if (!dir1 || !dir2) return 0;

    // 计算点积
    const dot = dir1.x * dir2.x + dir1.y * dir2.y + dir1.z * dir2.z;

    // 计算向量的长度
    const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y + dir1.z * dir1.z);
    const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y + dir2.z * dir2.z);

    // 防止除零
    if (len1 < 0.0001 || len2 < 0.0001) return 0;

    // 计算夹角
    const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
    return Math.acos(cosAngle);
  }

  /**
   * 计算点围绕中心旋转后的新位置
   * @param {Object} point - 要旋转的点 {x, y}
   * @param {Object} center - 旋转中心 {x, y}
   * @param {number} angle - 旋转角度（弧度）
   * @returns {Object} 旋转后的点 {x, y}
   */
  _rotatePointAroundCenter(point, center, angle) {
    // 计算点相对于中心的偏移
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    // 应用旋转变换
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const rotatedDx = dx * cos - dy * sin;
    const rotatedDy = dx * sin + dy * cos;

    // 计算新的位置
    return {
      x: center.x + rotatedDx,
      y: center.y + rotatedDy,
      z: point.z || 0
    };
  }

  /**
   * 调整 target 位置使地板保持平行于实际地形（使用地形法线缓存）
   * 结合地形法线采样、实时 target 经纬度、Cesium 相机方向计算
   *
   * 核心思路：
   * 1. 检查地形法线缓存是否有效，无效则触发异步更新
   * 2. 使用地形法线（而非椭球体法线）计算局部基向量
   * 3. 调整 target 位置，使其位于地形切平面上
   *
   * @param {Object} state - 相机状态
   */
  _adjustTargetToAlignWithGround(state) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.cesiumViewer || !this.cesiumViewer.camera) {
      console.warn('[SyncManager._adjustTargetToAlignWithGround] Cesium 不可用');
      return;
    }

    try {
      const camera = this.cesiumViewer.camera;
      const scene = this.cesiumViewer.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;

      // 1. 获取相机位置
      const cameraPosition = camera.position;
      const cameraCartographic = ellipsoid.cartesianToCartographic(cameraPosition);
      if (!cameraCartographic) {
        console.warn('[SyncManager._adjustTargetToAlignWithGround] 无法获取相机经纬度');
        return;
      }

      // 2. 检查是否需要更新地形法线缓存
      const now = Date.now();
      const cameraMovedSignificantly = !this.terrainNormalCache.position ||
        Cesium.Cartesian3.distance(cameraPosition, this.terrainNormalCache.position) > 100; // 相机移动超过100米

      if (cameraMovedSignificantly ||
          (now - this.terrainNormalCache.lastUpdateTime > this.terrainNormalCache.updateInterval)) {
        // 触发异步更新（不等待结果，使用当前缓存或椭球体法线）
        this._updateTerrainNormalCache(cameraPosition);
      }

      // 3. 决定使用地形法线还是椭球体法线
      const useTerrainNormal = this.terrainNormalCache.isValid && this.terrainNormalCache.normal;

      if (useTerrainNormal) {
        // 使用地形法线调整（新方法）
        this._adjustTargetWithTerrainNormal(state, cameraPosition, cameraCartographic);
      } else {
        // 使用椭球体法线调整（原方法，兼容模式）
        this._adjustTargetWithEllipsoidNormal(state, cameraPosition, cameraCartographic, ellipsoid);
      }

    } catch (error) {
      console.error('[SyncManager._adjustTargetToAlignWithGround] 调整失败:', error);
      // 回退到椭球体法线方法
      this._adjustTargetWithEllipsoidNormal(state, camera.position,
        ellipsoid.cartesianToCartographic(camera.position), ellipsoid);
    }
  }

  /**
   * 异步更新地形法线缓存
   * @param {Cesium.Cartesian3} position - ECEF 坐标系中的位置
   */
  async _updateTerrainNormalCache(position) {
    const Cesium = this.getCesium();
    if (!Cesium) return;

    try {
      console.log('[SyncManager._updateTerrainNormalCache] 正在采样地形法线...');

      const terrainNormal = await this._getTerrainNormal(position);

      if (terrainNormal) {
        this.terrainNormalCache.normal = terrainNormal;
        this.terrainNormalCache.position = position;
        this.terrainNormalCache.lastUpdateTime = Date.now();
        this.terrainNormalCache.isValid = true;

        console.log('[SyncManager._updateTerrainNormalCache] ✅ 地形法线已更新:', {
          normal: `(${terrainNormal.x.toFixed(3)}, ${terrainNormal.y.toFixed(3)}, ${terrainNormal.z.toFixed(3)})`
        });
      } else {
        console.warn('[SyncManager._updateTerrainNormalCache] ⚠️ 地形法线采样失败，使用椭球体法线');
        this.terrainNormalCache.isValid = false;
      }
    } catch (error) {
      console.error('[SyncManager._updateTerrainNormalCache] 更新失败:', error);
      this.terrainNormalCache.isValid = false;
    }
  }

  /**
   * 使用地形法线调整 target（新方法）
   * @param {Object} state - 相机状态
   * @param {Cesium.Cartesian3} cameraPosition - 相机位置（ECEF）
   * @param {Cesium.Cartographic} cameraCartographic - 相机经纬度
   */
  _adjustTargetWithTerrainNormal(state, cameraPosition, cameraCartographic) {
    const Cesium = this.getCesium();
    const terrainNormal = this.terrainNormalCache.normal;
    const camera = this.cesiumViewer.camera;

    // 地形法线作为 "天" 向量
    const terrainUp = terrainNormal;

    // 计算 "东" 向量：垂直于地形法线且指向东
    const longitude = cameraCartographic.longitude;
    const sinLon = Math.sin(longitude);
    const cosLon = Math.cos(longitude);

    const ellipsoidEast = new Cesium.Cartesian3(-sinLon, cosLon, 0);

    // 将椭球体东向量投影到地形切平面
    const eastComponent = Cesium.Cartesian3.multiplyByScalar(
      terrainUp,
      Cesium.Cartesian3.dot(ellipsoidEast, terrainUp),
      new Cesium.Cartesian3()
    );
    const terrainEast = Cesium.Cartesian3.subtract(
      ellipsoidEast,
      eastComponent,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(terrainEast, terrainEast);

    // 计算 "北" 向量：地形法线 × 东向量
    const terrainNorth = Cesium.Cartesian3.cross(
      terrainUp,
      terrainEast,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(terrainNorth, terrainNorth);

    console.log('[SyncManager._adjustTargetWithTerrainNormal] 地形对齐基向量:', {
      经纬度: {
        经度: (longitude * 180 / Math.PI).toFixed(6) + '°',
        纬度: (cameraCartographic.latitude * 180 / Math.PI).toFixed(6) + '°'
      },
      东: `(${terrainEast.x.toFixed(3)}, ${terrainEast.y.toFixed(3)}, ${terrainEast.z.toFixed(3)})`,
      北: `(${terrainNorth.x.toFixed(3)}, ${terrainNorth.y.toFixed(3)}, ${terrainNorth.z.toFixed(3)})`,
      天: `(${terrainUp.x.toFixed(3)}, ${terrainUp.y.toFixed(3)}, ${terrainUp.z.toFixed(3)})`,
      来源: '实际地形采样'
    });

    // 计算目标位置（ECEF 坐标系）
    const cesiumDirection = camera.direction;
    const currentHeight = state.height || 100;

    const targetECEF = new Cesium.Cartesian3(
      cameraPosition.x + cesiumDirection.x * currentHeight,
      cameraPosition.y + cesiumDirection.y * currentHeight,
      cameraPosition.z + cesiumDirection.z * currentHeight
    );

    // 将 target ECEF 转换为地形对齐坐标
    const offsetECEF = Cesium.Cartesian3.subtract(
      targetECEF,
      cameraPosition,
      new Cesium.Cartesian3()
    );

    // 将 ECEF 偏移转换为地形对齐坐标
    const offsetTerrainAligned = {
      east: Cesium.Cartesian3.dot(offsetECEF, terrainEast),
      north: Cesium.Cartesian3.dot(offsetECEF, terrainNorth),
      up: Cesium.Cartesian3.dot(offsetECEF, terrainUp)
    };

    console.log('[SyncManager._adjustTargetWithTerrainNormal] Target 偏移（地形对齐）:', {
      east: offsetTerrainAligned.east.toFixed(2) + 'm',
      north: offsetTerrainAligned.north.toFixed(2) + 'm',
      up: offsetTerrainAligned.up.toFixed(2) + 'm'
    });

    // 在局部坐标系中调整 target 位置
    const threeJSTarget = {
      x: offsetTerrainAligned.east,   // 东 → X
      y: offsetTerrainAligned.up,     // 天 → Y
      z: -offsetTerrainAligned.north // 北 → -Z
    };

    console.log('[SyncManager._adjustTargetWithTerrainNormal] 调整后 Target (Three.js):', {
      x: threeJSTarget.x.toFixed(2),
      y: threeJSTarget.y.toFixed(2),
      z: threeJSTarget.z.toFixed(2)
    });

    // 更新 state.target
    state.target = threeJSTarget;

    console.log('[SyncManager._adjustTargetWithTerrainNormal] ✅ Target 已调整，地板平行于实际地形');
  }

  /**
   * 使用椭球体法线调整 target（原方法，兼容模式）
   * @param {Object} state - 相机状态
   * @param {Cesium.Cartesian3} cameraPosition - 相机位置（ECEF）
   * @param {Cesium.Cartographic} cameraCartographic - 相机经纬度
   * @param {Cesium.Ellipsoid} ellipsoid - 椭球体
   */
  _adjustTargetWithEllipsoidNormal(state, cameraPosition, cameraCartographic, ellipsoid) {
    const Cesium = this.getCesium();
    const camera = this.cesiumViewer.camera;
    const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem();

    const longitude = cameraCartographic.longitude;
    const latitude = cameraCartographic.latitude;

    const sinLon = Math.sin(longitude);
    const cosLon = Math.cos(longitude);
    const sinLat = Math.sin(latitude);
    const cosLat = Math.cos(latitude);

    // ENU 基向量（ECEF 坐标系）
    const ENU_East = { x: -sinLon, y: cosLon, z: 0 };
    const ENU_North = { x: -sinLat * cosLon, y: -sinLat * sinLon, z: cosLat };
    const ENU_Up = { x: cosLat * cosLon, y: cosLat * sinLon, z: sinLat };

    console.log('[SyncManager._adjustTargetWithEllipsoidNormal] 屏幕中心 ENU 基向量:', {
      经纬度: {
        经度: (longitude * 180 / Math.PI).toFixed(6) + '°',
        纬度: (latitude * 180 / Math.PI).toFixed(6) + '°'
      },
      东: `(${ENU_East.x.toFixed(3)}, ${ENU_East.y.toFixed(3)}, ${ENU_East.z.toFixed(3)})`,
      北: `(${ENU_North.x.toFixed(3)}, ${ENU_North.y.toFixed(3)}, ${ENU_North.z.toFixed(3)})`,
      天: `(${ENU_Up.x.toFixed(3)}, ${ENU_Up.y.toFixed(3)}, ${ENU_Up.z.toFixed(3)})`,
      来源: '椭球体法线（回退模式）',
      坐标模式: isUsingLocalCoord ? '局部坐标系（直接计算）' : '真实世界坐标（ECEF转换）'
    });

    const currentHeight = state.height || 100;

    if (isUsingLocalCoord) {
      // ⭐⭐⭐ 局部坐标系模式：直接在局部坐标系中计算 target
      //
      // 关键理解：
      // 1. 局部坐标系的原点 = 模型的地理位置（通过 mercatorProjection 设置）
      // 2. ENU_Up = 该地理位置的椭球体法线（在该点的"垂直向上"方向）
      // 3. 因此，ENU_Up 的 ENU 坐标为 (0, 0, 1)（完全向上）
      //
      // 目标：使 target 位于"水平面"上（垂直于 ENU_Up）
      // 方法：将 target 的 ENU 坐标限制在水平面上

      console.log('[SyncManager._adjustTargetWithEllipsoidNormal] 局部坐标模式：直接计算 target（避免 ECEF 转换误差）');

      // state.direction 是 Three.js 局部坐标系中的单位向量（EUS: X=东, Y=天, Z=南）
      // 将其转换为 ENU 坐标系（ENU: X=东, Y=北, Z=天）
      const directionENU = {
        east: state.direction.x,  // EUS-X → ENU-East（相同）
        north: -state.direction.z, // EUS-Z（南） → ENU-North（反向）
        up: state.direction.y  // EUS-Y（天） → ENU-Up（相同）
      };

      // 计算 target 在 ENU 坐标系中的位置
      const targetENU = {
        east: directionENU.east * currentHeight,
        north: directionENU.north * currentHeight,
        up: directionENU.up * currentHeight
      };

      // ⭐ 关键：将 target 投影到水平面上（垂直于 ENU_Up）
      // 在 ENU 坐标系中，"水平面"就是 east-north 平面（up = 0）
      // 所以我们只需要移除 up 分量即可！
      const targetENU_horizontal = {
        east: targetENU.east,
        north: targetENU.north,
        up: 0  // ⭐ 投影到水平面
      };

      // 将 ENU 坐标转换回 Three.js 局部坐标系（EUS）
      const threeJSTarget = {
        x: targetENU_horizontal.east,  // ENU-East → EUS-X
        y: targetENU_horizontal.up,    // ENU-Up → EUS-Y
        z: -targetENU_horizontal.north // ENU-North → EUS-Z（反向）
      };

      console.log('[SyncManager._adjustTargetWithEllipsoidNormal] 局部坐标模式 Target 调整:', {
        原始方向ENU: `(${directionENU.east.toFixed(3)}, ${directionENU.north.toFixed(3)}, ${directionENU.up.toFixed(3)})`,
        原始目标ENU: `(${targetENU.east.toFixed(2)}m, ${targetENU.north.toFixed(2)}m, ${targetENU.up.toFixed(2)}m)`,
        投影后ENU: `(${targetENU_horizontal.east.toFixed(2)}m, ${targetENU_horizontal.north.toFixed(2)}m, 0.00m)`,
        最终ThreeJS: `(${threeJSTarget.x.toFixed(2)}, ${threeJSTarget.y.toFixed(2)}, ${threeJSTarget.z.toFixed(2)})`
      });

      // 更新 state.target
      state.target = threeJSTarget;

    } else {
      // 真实世界坐标模式：使用原有的 ECEF 转换方法
      console.log('[SyncManager._adjustTargetWithEllipsoidNormal] 真实世界坐标模式：使用 ECEF 转换');

      const cesiumDirection = camera.direction;

      // 计算新的 target 位置
      const targetECEF = {
        x: cameraPosition.x + cesiumDirection.x * currentHeight,
        y: cameraPosition.y + cesiumDirection.y * currentHeight,
        z: cameraPosition.z + cesiumDirection.z * currentHeight
      };

      // 将 target ECEF 转换为相对于屏幕中心的 ENU 坐标
      const screenCenterECEF = ellipsoid.cartographicToCartesian(
        new Cesium.Cartographic(longitude, latitude, 0)
      );

      // 计算 target 相对于屏幕中心的偏移（ECEF）
      const offsetECEF = {
        x: targetECEF.x - screenCenterECEF.x,
        y: targetECEF.y - screenCenterECEF.y,
        z: targetECEF.z - screenCenterECEF.z
      };

      // 将 ECEF 偏移转换为 ENU 坐标
      const offsetENU = {
        east: offsetECEF.x * ENU_East.x + offsetECEF.y * ENU_East.y + offsetECEF.z * ENU_East.z,
        north: offsetECEF.x * ENU_North.x + offsetECEF.y * ENU_North.y + offsetECEF.z * ENU_North.z,
        up: offsetECEF.x * ENU_Up.x + offsetECEF.y * ENU_Up.y + offsetECEF.z * ENU_Up.z
      };

      console.log('[SyncManager._adjustTargetWithEllipsoidNormal] Target 偏移（ENU）:', {
        east: offsetENU.east.toFixed(2) + 'm',
        north: offsetENU.north.toFixed(2) + 'm',
        up: offsetENU.up.toFixed(2) + 'm'
      });

      // 在局部坐标系中调整 target 位置
      const threeJSTarget = {
        x: offsetENU.east,
        y: offsetENU.up,
        z: -offsetENU.north
      };

      console.log('[SyncManager._adjustTargetWithEllipsoidNormal] 调整后 Target (Three.js):', {
        x: threeJSTarget.x.toFixed(2),
        y: threeJSTarget.y.toFixed(2),
        z: threeJSTarget.z.toFixed(2)
      });

      // 更新 state.target
      state.target = threeJSTarget;
    }

    console.log('[SyncManager._adjustTargetWithEllipsoidNormal] Target 已调整，保持地板平行于椭球体');
  }

  /**
   * 获取指定位置的地形法线（通过采样多个点）
   * @param {Cesium.Cartesian3} position - ECEF 坐标系中的位置
   * @returns {Promise<Cesium.Cartesian3>} 地形法线向量（ECEF 坐标系）
   */
  async _getTerrainNormal(position) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.cesiumViewer || !this.cesiumViewer.scene) {
      console.warn('[SyncManager._getTerrainNormal] Cesium 或 scene 不可用');
      return null;
    }

    try {
      const scene = this.cesiumViewer.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;

      // 将 ECEF 位置转换为经纬度
      const cartographic = ellipsoid.cartesianToCartographic(position);

      // 采样距离（米）- 根据地形复杂度调整
      const sampleDistance = 10.0;

      // 定义四个采样点（相对于中心点的偏移）
      const offsets = [
        { lon: sampleDistance, lat: 0 },      // 东
        { lon: -sampleDistance, lat: 0 },     // 西
        { lon: 0, lat: sampleDistance },      // 北
        { lon: 0, lat: -sampleDistance }      // 南
      ];

      // 计算采样点的经纬度偏移（考虑纬度对经度距离的影响）
      const latInRadians = cartographic.latitude;
      const metersPerDegreeLon = 111412.84 * Math.cos(latInRadians) - 93.5 * Math.cos(3 * latInRadians);
      const metersPerDegreeLat = 111132.95 - 559.82 * Math.cos(2 * latInRadians) + 1.175 * Math.cos(4 * latInRadians);

      const samplePositions = [];

      // 采样每个点的高度
      for (const offset of offsets) {
        const lonOffset = offset.lon / metersPerDegreeLon;
        const latOffset = offset.lat / metersPerDegreeLat;

        const sampleCartographic = new Cesium.Cartographic(
          cartographic.longitude + lonOffset,
          cartographic.latitude + latOffset,
          0 // 高度由采样决定
        );

        // 使用 sampleHeightMostDetailed 获取精确地形高度
        try {
          const height = await Cesium.sampleHeightMostDetailed(scene, sampleCartographic);
          samplePositions.push({
            longitude: sampleCartographic.longitude,
            latitude: sampleCartographic.latitude,
            height: height
          });
        } catch (err) {
          // 如果采样失败，使用椭球体高度
          samplePositions.push({
            longitude: sampleCartographic.longitude,
            latitude: sampleCartographic.latitude,
            height: 0
          });
        }
      }

      // 添加中心点
      const centerHeight = await Cesium.sampleHeightMostDetailed(scene, cartographic);
      samplePositions.push({
        longitude: cartographic.longitude,
        latitude: cartographic.latitude,
        height: centerHeight
      });

      // 将采样点转换为 ECEF 坐标
      const ecefPositions = samplePositions.map(pos =>
        ellipsoid.cartographicToCartesian(
          new Cesium.Cartographic(pos.longitude, pos.latitude, pos.height)
        )
      );

      // 计算地形法线（使用最小二乘法拟合平面）
      // 平面方程: ax + by + cz + d = 0
      // 法线向量 n = (a, b, c)

      const center = ecefPositions[4]; // 中心点在最后

      // 构建协方差矩阵
      let sumXX = 0, sumYY = 0, sumZZ = 0;
      let sumXY = 0, sumXZ = 0, sumYZ = 0;

      for (let i = 0; i < 4; i++) {
        const dx = ecefPositions[i].x - center.x;
        const dy = ecefPositions[i].y - center.y;
        const dz = ecefPositions[i].z - center.z;

        sumXX += dx * dx;
        sumYY += dy * dy;
        sumZZ += dz * dz;
        sumXY += dx * dy;
        sumXZ += dx * dz;
        sumYZ += dy * dz;
      }

      // 计算法线（使用最小特征值对应的特征向量）
      const matrix = [
        [sumXX, sumXY, sumXZ],
        [sumXY, sumYY, sumYZ],
        [sumXZ, sumYZ, sumZZ]
      ];

      const normal = this._computeSmallestEigenvector(matrix);

      // 确保法线向上（与椭球体法线点积为正）
      const ellipsoidNormal = Cesium.Cartesian3.normalize(center, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.dot(normal, ellipsoidNormal) < 0) {
        Cesium.Cartesian3.negate(normal, normal);
      }

      return normal;

    } catch (error) {
      console.error('[SyncManager._getTerrainNormal] 获取地形法线失败:', error);
      return null;
    }
  }

  /**
   * 计算对称矩阵最小特征值对应的特征向量
   * @param {Array} matrix - 3x3 对称矩阵
   * @returns {Cesium.Cartesian3} 最小特征值对应的特征向量
   */
  _computeSmallestEigenvector(matrix) {
    const Cesium = this.getCesium();

    // 对于 3x3 对称矩阵，可以使用解析解
    // 特征方程: det(A - λI) = 0
    // 这里使用幂迭代法的逆迭代来找最小特征值对应的特征向量

    const maxIterations = 100;
    const tolerance = 1e-6;

    // 初始向量
    let v = new Cesium.Cartesian3(1, 1, 1);
    Cesium.Cartesian3.normalize(v, v);

    for (let i = 0; i < maxIterations; i++) {
      // 解线性方程组: A * v_new = v_old
      // 使用高斯消元法
      const vNew = this._solveLinearSystem(matrix, v);

      // 归一化
      const magnitude = Cesium.Cartesian3.magnitude(vNew);
      if (magnitude < tolerance) break;

      Cesium.Cartesian3.normalize(vNew, vNew);

      // 检查收敛
      const dot = Cesium.Cartesian3.dot(v, vNew);
      if (Math.abs(dot - 1.0) < tolerance) {
        v = vNew;
        break;
      }

      v = vNew;
    }

    return v;
  }

  /**
   * 解线性方程组 A * x = b（高斯消元法）
   * @param {Array} A - 3x3 矩阵
   * @param {Cesium.Cartesian3} b - 右侧向量
   * @returns {Cesium.Cartesian3} 解向量
   */
  _solveLinearSystem(A, b) {
    const Cesium = this.getCesium();

    // 深拷贝矩阵和向量
    const matrix = A.map(row => [...row]);
    const result = { x: b.x, y: b.y, z: b.z };

    // 前向消元
    for (let i = 0; i < 3; i++) {
      // 选主元
      let maxRow = i;
      for (let k = i + 1; k < 3; k++) {
        if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
          maxRow = k;
        }
      }

      // 交换行
      [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
      const temp = (i === 0) ? result.x : (i === 1) ? result.y : result.z;
      if (i === 0) {
        result.x = (maxRow === 0) ? result.x : (maxRow === 1) ? result.y : result.z;
      } else if (i === 1) {
        result.y = (maxRow === 0) ? result.x : (maxRow === 1) ? result.y : result.z;
      } else {
        result.z = (maxRow === 0) ? result.x : (maxRow === 1) ? result.y : result.z;
      }
      if (maxRow === 0) {
        const tempVal = result.x;
        result.x = temp;
      } else if (maxRow === 1) {
        const tempVal = result.y;
        result.y = temp;
      } else {
        const tempVal = result.z;
        result.z = temp;
      }

      // 消元
      for (let k = i + 1; k < 3; k++) {
        const factor = matrix[k][i] / matrix[i][i];
        for (let j = i; j < 3; j++) {
          matrix[k][j] -= factor * matrix[i][j];
        }
        if (k === 0) result.x -= factor * ((i === 0) ? result.x : (i === 1) ? result.y : result.z);
        else if (k === 1) result.y -= factor * ((i === 0) ? result.x : (i === 1) ? result.y : result.z);
        else result.z -= factor * ((i === 0) ? result.x : (i === 1) ? result.y : result.z);
      }
    }

    // 回代
    const solution = { x: 0, y: 0, z: 0 };
    const tempResult = [result.x, result.y, result.z];

    solution.z = tempResult[2] / matrix[2][2];
    solution.y = (tempResult[1] - matrix[1][2] * solution.z) / matrix[1][1];
    solution.x = (tempResult[0] - matrix[0][1] * solution.y - matrix[0][2] * solution.z) / matrix[0][0];

    return new Cesium.Cartesian3(solution.x, solution.y, solution.z);
  }

  /**
   * 获取指定经纬度位置的地形高度（同步版本）
   * 用于局部坐标系模式下保持Dual贴地
   *
   * @param {number} longitude - 经度（弧度）
   * @param {number} latitude - 纬度（弧度）
   * @returns {number} 地形高度（米），采样失败时返回模型海拔作为降级方案
   */
  _getTerrainHeightAtPosition(longitude, latitude) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.cesiumViewer) {
      console.warn('[SyncManager._getTerrainHeightAtPosition] Cesium 不可用，使用模型海拔作为降级');
      // ⭐ 降级方案：使用模型海拔
      const modelAltitude = this.mercatorProjection.modelAbsoluteMercator?.z || 0;
      return modelAltitude;
    }

    try {
      // 创建 Cartographic 位置
      const position = Cesium.Cartographic.fromRadians(longitude, latitude, 0);

      // ⚠️ 关键修复：使用同步方式采样地形
      // sampleHeightMostDetailed 是异步的，但我们可以使用 sampleTerrainMostDetailed 的结果
      // 或者直接使用 Cartographic 的高度字段（如果有缓存）

      // ⚠️ 方案1：尝试从sampleHeightMostDetailed获取（如果已有缓存）
      // 注意：这里使用同步方式，如果采样未完成会返回默认值
      let terrainHeight = null;

      // ⚠️ 方案2：使用模型海拔作为基础值
      const modelAltitude = this.mercatorProjection.modelAbsoluteMercator?.z || 0;

      // ⭐ 关键修复：使用 Cesium 的采样器（异步转同步处理）
      // 由于我们无法在同步函数中等待异步结果，我们使用以下策略：
      // 1. 首次调用时，启动异步采样并返回模型海拔
      // 2. 后续调用时，如果采样完成，使用采样结果
      // 3. 否则继续使用模型海拔

      // 检查是否有缓存的采样结果
      const cacheKey = `${longitude.toFixed(6)}_${latitude.toFixed(6)}`;
      if (this._terrainHeightCache && this._terrainHeightCache[cacheKey]) {
        const cached = this._terrainHeightCache[cacheKey];
        // 检查缓存是否在有效期内（5秒）
        if (Date.now() - cached.timestamp < 5000) {
          return cached.height;
        }
      }

      // ⭐ 关键：使用尝试采样的方式（非阻塞）
      // 如果 Cesium 已有地形数据，会立即返回；否则返回默认值
      try {
        // 使用 Globe.getHeight 获取快速高度（不加载地形数据）
        const scene = this.cesiumViewer.scene;
        if (scene && scene.globe) {
          // ⚠️ 关键修复：尝试从地形服务获取高度
          // 使用 sampleHeightMostDetailed 的简化版本
          const cartographic = Cesium.Cartographic.fromRadians(longitude, latitude, 0);

          // ⚠️ 方案3：使用已有的地形采样队列（如果有）
          // 如果没有加载地形数据，返回模型海拔
          const height = scene.globe.getHeight(cartographic);

          if (height !== undefined && height !== null && !isNaN(height)) {
            terrainHeight = height;

            // ⚠️ 合理性检查：地形高度应在合理范围内
            if (terrainHeight < -500 || terrainHeight > 9000) {
              console.warn('[SyncManager._getTerrainHeightAtPosition] 地形高度超出合理范围，使用模型海拔:', {
                地形高度: terrainHeight.toFixed(2) + 'm',
                模型海拔: modelAltitude.toFixed(2) + 'm'
              });
              terrainHeight = modelAltitude;
            }
          }
        }
      } catch (e) {
        // 地形采样失败，使用模型海拔
      }

      // 如果采样失败，使用模型海拔作为降级方案
      if (terrainHeight === null || terrainHeight === undefined) {
        terrainHeight = modelAltitude;
      }

      // 缓存结果
      if (!this._terrainHeightCache) {
        this._terrainHeightCache = {};
      }
      this._terrainHeightCache[cacheKey] = {
        height: terrainHeight,
        timestamp: Date.now()
      };

      return terrainHeight;

    } catch (e) {
      console.warn('[SyncManager._getTerrainHeightAtPosition] 采样失败，使用模型海拔:', e.message);
      const modelAltitude = this.mercatorProjection.modelAbsoluteMercator?.z || 0;
      return modelAltitude;
    }
  }

  /**
   * 获取target位置对应的地形高度
   * 用于局部坐标系模式下保持target贴地
   *
   * ⭐ 关键修复：局部坐标系模式下，地形表面就是 Y=0
   * 原因：局部坐标系的原点(0,0,0)就是地形表面
   * 解决：直接返回 0
   *
   * @returns {number} 地形高度（米），局部坐标系模式下始终为 0
   * @private
   */
  _getTargetTerrainHeight() {
    // ⭐ 局部坐标系模式下，地形表面就是 Y=0
    // 模型海拔由 MercatorProjectionManager.modelAbsoluteAltitude 管理
    return 0;
  }

  /**
   * 在统一坐标系中处理平移
   */
  handlePanInUnified(deltaX, deltaY, metersPerPixel) {
    const params = this.mouseOperationParams;
    const state = this.unifiedCameraState;

    // ⭐ 关键修复：检查是否为局部坐标系模式
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    // ⭐ 自适应校准：记录初始位置用于测量
    // ⚠️ 修复时序问题：在 handlePanInUnified 中只记录初始位置
    // 实际的校准测量在 syncUnifiedToCesium 之后执行（_recordPanMeasurementAfterSync）
    const camera = this.cesiumViewer?.camera;
    const Cesium = this.getCesium();
    let initialCesiumPosition = null;
    let initialDualState = null;

    if (isUsingLocalCoord && camera && Cesium) {
      initialCesiumPosition = Cesium.Cartesian3.clone(camera.position);
      initialDualState = {
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      };

      // ⭐ 保存初始位置供后续校准使用
      this._pendingPanCalibration = {
        initialCesiumPosition,
        initialDualState,
        timestamp: Date.now()
      };
    }

    // ⭐ 关键修复：局部坐标系模式下的动态自适应平移速度校准
    //
    // 问题分析：
    // 1. Cesium 的 metersPerPixel = (2 * height * Math.tan(fov / 2)) / canvasWidth
    //    这是 3D 视角的透视投影计算，会随高度、FOV 变化
    // 2. Dual 在墨卡托平面坐标系中移动，不考虑透视投影
    // 3. 地球曲率和墨卡托投影变形会随纬度变化
    //
    // 新解决方案（基于ENU切平面投影的几何计算）：
    // - 计算Cesium相机的right/up向量在ENU切平面上的投影比率
    // - 使用这个比率来调整metersPerPixel
    // - 不依赖经验测量，而是基于几何计算
    // - 自动适应高度、FOV、纬度、相机角度的变化
    //
    let adjustedMetersPerPixel = metersPerPixel;
    if (isUsingLocalCoord) {
      // ⚠️ 新方法：使用ENU切平面投影计算（传入平移方向用于加权）
      const enuAdjusted = this._calculateMetersPerPixelOnENUPlane(metersPerPixel, deltaX, deltaY);

      if (enuAdjusted !== null) {
        adjustedMetersPerPixel = enuAdjusted;
      }
      // ⚠️ 降级方案：如果ENU计算失败，使用固定视觉比1.0（不校正）
      else {
        adjustedMetersPerPixel = metersPerPixel * 1.0;
      }

      // 调试日志（只在metersPerPixel变化时输出）
      if (!this._lastLoggedMetersPerPixel ||
          Math.abs(adjustedMetersPerPixel - this._lastLoggedMetersPerPixel) > 0.001) {
        console.log('[SyncManager.handlePanInUnified] 局部坐标系模式平移计算:', {
          metersPerPixel: adjustedMetersPerPixel.toFixed(4),
          方法: '按角度分档校准（不应用几何校正）',
          说明: 'metersPerPixel用于计算基础距离，校准倍数在后续应用'
        });
        this._lastLoggedMetersPerPixel = adjustedMetersPerPixel;
      }
    }

    // ⭐ 获取按角度分档的校准倍数
    const calibrationFactor = this._getCalibratedPanSpeed();

    // ⭐ 应用校准倍数：调整Dual的移动速度
    //
    // 关键理解（从实测数据推导）：
    // 校准倍数0.891的含义：
    // - 不应用校准时：Dual移动快，Cesium移动慢
    // - 应用校准倍数0.891后：Dual移动减慢，与Cesium匹配
    //
    // 计算公式：
    // distanceX = deltaX * metersPerPixel * calibrationFactor
    //
    // 实际效果：
    // - Dual的state.position变化被减慢到原来的89.1%
    // - 这样Dual的视觉移动速度与Cesium的实际移动速度一致
    const distanceX = deltaX * adjustedMetersPerPixel * calibrationFactor;
    const distanceY = deltaY * adjustedMetersPerPixel * calibrationFactor;

    // ⚠️ 关键修复：平移方向处理（墨卡托坐标系）
    // 在墨卡托坐标系中：
    // - right 向量指向 X 轴正方向（经度方向）
    // - direction 向量指向相机朝向的方向（前方）
    //
    // ⚠️ 重要：相机移动方向应该与鼠标拖拽方向相反
    // 这样场景才会跟随鼠标方向移动（类似地图应用）
    // 例如：向左拖拽鼠标时，希望场景向东移动（相机向东移动，X 增加）
    // - 鼠标向右移动（deltaX > 0）时，相机应该向左移动（X 减小），场景向右移动
    // - 鼠标向左移动（deltaX < 0）时，相机应该向右移动（X 增加），场景向左移动
    // - 鼠标向下移动（deltaY > 0）时，相机应该向前移动（沿 direction 方向），场景向下移动
    // - 鼠标向上移动（deltaY < 0）时，相机应该向后移动（沿 direction 反方向），场景向上移动
    const panX = -distanceX;  // ⚠️ X轴取反：相机移动方向与鼠标拖拽方向相反
    const panY = distanceY;   // ⚠️ Y轴不取反：相机移动方向与鼠标拖拽方向相反

    // ⚠️ 调试日志：记录平移输入和方向向量状态
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      console.log('[SyncManager.handlePanInUnified] 平移输入:', {
        deltaX: deltaX.toFixed(2),
        deltaY: deltaY.toFixed(2),
        metersPerPixel: metersPerPixel.toFixed(4),
        校准倍数: calibrationFactor.toFixed(3),
        说明: `减慢Dual移动以匹配Cesium速度 (×${calibrationFactor.toFixed(3)})`,
        isUsingLocalCoord: isUsingLocalCoord,
        原始panSpeed: params.panSpeed.toFixed(2),
        panX: panX.toFixed(2),
        panY: panY.toFixed(2),
        direction: {
          x: state.direction.x.toFixed(3),
          y: state.direction.y.toFixed(3),
          z: state.direction.z.toFixed(3)
        },
        right: {
          x: state.right.x.toFixed(3),
          y: state.right.y.toFixed(3),
          z: state.right.z.toFixed(3)
        },
        up: {
          x: state.up.x.toFixed(3),
          y: state.up.y.toFixed(3),
          z: state.up.z.toFixed(3)
        },
        isUnderground: state.position.y < -50,
        isInMercator: Math.abs(state.up.y - 1) < 0.001
      });
    }

    // 保存原始 Y 坐标
    const originalPositionY = state.position.y;
    const originalTargetY = state.target.y;

    // ⚠️ 关键修复：检查是否在墨卡托坐标系
    const isInMercatorCoordinateSystem = (
      Math.abs(state.up.y - 1) < 0.001 &&  // up ≈ (0, 1, 0)
      Math.abs(state.up.x) < 0.001 &&
      Math.abs(state.up.z) < 0.001
    );

    if (isInMercatorCoordinateSystem) {
      // ⚠️ 墨卡托坐标系（世界坐标系）：使用 += 公式
      // 在世界坐标系中：
      // - right 向量应该指向 X 轴正方向（经度方向）
      // - up 向量指向 Y 轴正方向（高度方向）
      // 鼠标向右移动时，相机应该向右移动（X 增加）

      // ⭐ 新增：验证 right 向量是否与 X 轴对齐
      const rightAngleFromX = Math.atan2(state.right.z, state.right.x) * 180 / Math.PI;

      if (Math.abs(rightAngleFromX) > 10) {
        console.warn('[SyncManager.handlePanInUnified] ⚠️ right向量与X轴有明显夹角:', {
          right: `(${state.right.x.toFixed(3)}, ${state.right.y.toFixed(3)}, ${state.right.z.toFixed(3)})`,
          与X轴夹角: rightAngleFromX.toFixed(2) + '°',
          panX: panX.toFixed(2),
          说明: '这会导致左右平移方向与鼠标移动方向不一致',
          预期平移: 'X方向',
          实际平移: `与X轴夹角${rightAngleFromX.toFixed(2)}°方向`
        });
      }

      // 沿 right 向量平移（左右平移）
      state.position.x += state.right.x * panX;
      state.position.y += state.right.y * panX;
      state.position.z += state.right.z * panX;

      state.target.x += state.right.x * panX;
      state.target.y += state.right.y * panX;
      state.target.z += state.right.z * panX;

      // ⭐ 调试日志：验证校准倍数应用
      if (Math.abs(panX) > 1) {
        const actualXMovement = Math.abs(state.right.x * panX);
        console.log('[SyncManager.handlePanInUnified] 校准倍数应用验证（X方向）:', {
          输入像素: Math.abs(deltaX),
          metersPerPixel: adjustedMetersPerPixel.toFixed(4),
          校准倍数: calibrationFactor.toFixed(3),
          计算的distanceX: Math.abs(distanceX).toFixed(2) + ' m',
          panX: panX.toFixed(2) + ' m',
          right向量: {
            x: state.right.x.toFixed(3),
            y: state.right.y.toFixed(3),
            z: state.right.z.toFixed(3)
          },
          X方向实际移动: actualXMovement.toFixed(2) + ' m',
          说明: actualXMovement > 0 ? '校准倍数已应用' : '校准倍数未应用'
        });
      }

      // ⚠️ 关键修复：在真实世界模式下，右键平移应该只在水平面（XZ平面）移动
      // 不应该改变 Y 坐标（高度），否则会产生放大/缩小效果

      // ⭐ 关键修复：在局部坐标系模式下，禁用 heightFactor，确保与 Cesium 地面平移步长一致
      // 真实世界模式下，高空视角需要更大的平移幅度
      const heightFactor = isUsingLocalCoord ? 1.0 : Math.max(1, state.height / 200);
      const adjustedPanY = panY * heightFactor;

      // 沿 direction 向量在 XZ 平面上的投影移动（前后平移）
      const dirXZ = {
        x: state.direction.x,
        y: 0,  // 不改变 Y 坐标
        z: state.direction.z
      };
      const dirXZLen = Math.sqrt(dirXZ.x * dirXZ.x + dirXZ.z * dirXZ.z);
      if (dirXZLen > 0.001) {
        dirXZ.x /= dirXZLen;
        dirXZ.z /= dirXZLen;
      } else {
        // ⚠️ 关键修复：当 direction 垂直向下（俯视）时，XZ 投影太小
        // 此时使用 right 向量的垂直方向作为前进方向
        // ⚠️ 关键修复：修改默认前进方向为 Z 轴正方向（向北），这样鼠标向下移动时相机向北移动
        // 如果 right = (1, 0, 0)，则前进方向 = (0, 0, 1)（Z 轴正方向）
        dirXZ.x = 0;
        dirXZ.z = 1;  // 默认沿 Z 轴正方向前进（向北）
        console.log('[SyncManager.handlePanInUnified] 方向向量XZ投影太小，使用默认前进方向:', dirXZ);
      }

      // 沿 direction 向量的 XZ 投影移动（前后平移）
      state.position.x += dirXZ.x * adjustedPanY;
      state.position.y += dirXZ.y * adjustedPanY;  // = 0，不改变高度
      state.position.z += dirXZ.z * adjustedPanY;

      state.target.x += dirXZ.x * adjustedPanY;
      state.target.y += dirXZ.y * adjustedPanY;    // = 0，不改变高度
      state.target.z += dirXZ.z * adjustedPanY;
    } else {
      // ⚠️ 传统相机坐标系：使用 -= 公式
      // 沿 right 向量平移（左右平移）
      state.position.x -= state.right.x * panX;
      state.position.y -= state.right.y * panX;
      state.position.z -= state.right.z * panX;

      state.target.x -= state.right.x * panX;
      state.target.y -= state.right.y * panX;
      state.target.z -= state.right.z * panX;

      // 上下平移：在地下模式下使用水平面，在地上模式下使用 up 向量
      const isUnderground = state.position.y < -50;
      if (isUnderground) {
        // 地下模式：上下平移沿水平面（Z 轴方向）
        // 计算方向向量在 XZ 平面上的投影（归一化）
        const dirXZ = {
          x: state.direction.x,
          y: 0,
          z: state.direction.z
        };
        const dirXZLength = Math.sqrt(dirXZ.x * dirXZ.x + dirXZ.z * dirXZ.z);
        if (dirXZLength > 0.001) {
          dirXZ.x /= dirXZLength;
          dirXZ.z /= dirXZLength;
        } else {
          // 如果 direction 几乎垂直，使用 Z 轴负方向作为默认前进方向
          dirXZ.x = 0;
          dirXZ.z = -1;
        }

        // 沿水平方向平移
        state.position.x -= dirXZ.x * panY;
        state.position.z -= dirXZ.z * panY;

        state.target.x -= dirXZ.x * panY;
        state.target.z -= dirXZ.z * panY;
      } else {
        // 地上模式：使用 up 向量
        state.position.x -= state.up.x * panY;
        state.position.y -= state.up.y * panY;
        state.position.z -= state.up.z * panY;

        state.target.x -= state.up.x * panY;
        state.target.y -= state.up.y * panY;
        state.target.z -= state.up.z * panY;
      }
    }

    // ⚠️ 撤销平移时的 target.y 强制修正
    // 原因：强制修正会导致平移时相机突然跳跃
    // 替代方案：让 target.y 自然跟随平移，在缩放时平滑处理偏差（如果需要）

    // 检测异常的 Y 坐标跳转
    const yDelta = Math.abs(state.position.y - originalPositionY);
    if (yDelta > 100) {
      console.warn('⚠️ [SyncManager] 平移导致 Y 坐标大幅变化:', {
        originalY: originalPositionY.toFixed(2),
        newY: state.position.y.toFixed(2),
        yDelta: yDelta.toFixed(2),
        deltaY: deltaY.toFixed(2),
        upVector: { x: state.up.x.toFixed(3), y: state.up.y.toFixed(3), z: state.up.z.toFixed(3) }
      });
    }

    // ⚠️ 关键修复：在平移时更新地板中心
    // 地板中心应该随着相机的平移而更新，以保持与相机位置的同步
    // 这确保在真实世界模式下，坐标计算能够正确反映相机的位置变化
    // ⭐ 局部坐标系模式下不更新地板中心
    // isUsingLocalCoord 已在函数开头声明

    if (!isUsingLocalCoord && this.floorCenterMercator && this.floorCenterMercator.x !== 0) {
      // 计算地板中心的变化量（墨卡托坐标系）
      // ⚠️ 重要：floorCenter 的变化方向应该与相机移动方向相反
      // 因为 floorCenter 是参考点，相机向东移动意味着 floorCenter 相对向西移动
      // 在墨卡托坐标系中：
      // - panX 的负值对应 X 轴（经度方向）的变化（因为 panX = -distanceX）
      // - panY 对应 Y 轴（纬度方向）的变化（因为 panY = distanceY）
      const floorCenterDelta = {
        x: -panX,   // ⚠️ X轴取反：floorCenter 变化与相机移动方向相反
        y: -panY,   // ⚠️ Y轴取反：floorCenter 变化与相机移动方向相反
        z: 0        // Z轴不变
      };

      // ⚠️ 关键修复：调用 setFloorCenter 方法，而不是直接修改
      // 这样可以确保地板中心正确同步到 MercatorProjectionManager 和 DualCanvasViewer
      const newFloorCenter = {
        x: this.floorCenterMercator.x + floorCenterDelta.x,
        y: this.floorCenterMercator.y + floorCenterDelta.y,
        z: this.floorCenterMercator.z + floorCenterDelta.z
      };

      // 调用 setFloorCenter 方法同步更新
      this.setFloorCenter(newFloorCenter);

      // 调试日志：记录地板中心的更新
      if (Math.abs(panX) > 1 || Math.abs(panY) > 1) {
        console.log('[SyncManager.handlePanInUnified] 更新地板中心:', {
          delta: { x: panX.toFixed(2), y: panY.toFixed(2) },
          newFloorCenter: {
            x: newFloorCenter.x.toFixed(2),
            y: newFloorCenter.y.toFixed(2),
            z: newFloorCenter.z.toFixed(2)
          }
        });
      }
    }

    // ⚠️ 修复时序问题：校准测量已移到 _recordPanMeasurementAfterSync 方法中
    // 该方法应该在 syncUnifiedToCesium 之后调用，此时 Cesium 相机已更新
    // 参考 HelloWorld.vue 中的调用顺序

    // ⭐ 关键修复：局部坐标系模式下，平移后更新target.y到地形高度
    // 问题：平移后target.y可能偏离地形高度，导致地板不贴地
    // 解决：使用_getTargetTerrainHeight获取新位置的地形高度
    if (isUsingLocalCoord) {
      const terrainHeight = this._getTargetTerrainHeight();
      const oldTargetY = state.target.y;
      state.target.y = terrainHeight;

      // ⚠️ 同时更新相机位置的Y坐标，保持相机与target的相对高度
      // 这样可以避免相机突然跳跃
      const heightDiff = terrainHeight - oldTargetY;
      if (Math.abs(heightDiff) > 0.1) {
        // 只更新target.y，不更新position.y，避免相机位置跳跃
        // 相机会在下一帧渲染时自动调整到正确的高度

        console.log('[SyncManager.handlePanInUnified] 局部坐标系模式：平移后更新target贴地', {
          旧targetY: oldTargetY.toFixed(2) + 'm',
          新targetY: terrainHeight.toFixed(2) + 'm',
          高度差: heightDiff.toFixed(2) + 'm',
          说明: 'target.y已更新到地形高度，确保地板贴地'
        });
      }
    }
    // 该方法应该在 syncUnifiedToCesium 之后调用，此时 Cesium 相机已更新
    // 参考 HelloWorld.vue 中的调用顺序
  }

  /**
   * 动态校准平移速度，使其与 Cesium 保持一致
   *
   * ⭐ 关键修复：使用实际平移测量方法，而不是 moveRight()
   * 原因：Cesium 的 ScreenSpaceCameraController 在实际平移时使用的计算方式可能与 moveRight() 不同
   *
   * 方法：
   * 1. 记录初始位置
   * 2. 模拟平移操作（计算期望的平移量）
   * 3. 观察实际移动的距离
   * 4. 计算校准倍数
   *
   * @private
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {number|null} 校准后的平移倍数，如果校准失败则返回 null
   */
  _calibratePanSpeed(metersPerPixel) {
    // ⭐ 自适应校准：返回当前校准倍数（按角度分档）
    // 倍数通过实际平移测量动态更新
    const currentFactor = this._getCalibratedPanSpeed();

    return currentFactor;
  }

  /**
   * 初始化平移速度校准系统
   * 用于动态测量和调整 Cesium 与 dual 的平移速度差异
   * ⭐ 按角度分档校准：陡角、中角、平角
   * @private
   */
  _initPanSpeedCalibration() {
    if (this._panSpeedCalibration) {
      return; // 已初始化
    }

    // ⭐ 按角度分档的校准系统
    this._panSpeedCalibration = {
      // ⚠️ 禁用自动校准，使用固定倍数
      enabled: false,  // 设置为 false 禁用自动校准

      // 三个档位的校准倍数（固定值0.49，基于实测数据优化）
      // 校准倍数 > 1.0 表示 Dual 移动比理论值快
      // 校准倍数 < 1.0 表示 Dual 移动比理论值慢
      //
      // ⭐ 按几何原理设置的递减校准倍数（2025年优化）
      // 原理：俯仰角越小（越接近水平），透视效应越强，需要更大的校准倍数
      //
      // 几何推导：
      // - 陡角（0-30°）：相机接近水平，透视效应最强，倍数最大
      // - 中角（30-60°）：中等视角，透视效应中等，倍数居中
      // - 平角（60-90°）：相机接近垂直，透视效应最弱，倍数最小
      //
      // 实测验证：
      // - 中角实测数据：Cesium 0.63m vs Dual 1.87m → 倍数 0.34
      // - 平角实测数据：Cesium 0.14m vs Dual 0.43m → 倍数 0.34
      //
      // 陡角倍数推算：基于透视投影公式，陡角倍数应比中角大 8-10%
      //
      // ⭐ 2026年优化：降低校准倍数以匹配实测速度差异
      // - 实测数据：Cesium 14.82m vs Dual 视觉 16.67m（Dual快约12%）
      // - 修正后：flat档位从0.34降低到0.30（约降低12%）
      steep: { currentFactor: 0.37, measurements: [] },    // 陡角（0-30°）：最大倍数
      medium: { currentFactor: 0.35, measurements: [] },   // 中角（30-60°）：中等倍数
      flat: { currentFactor: 0.30, measurements: [] },     // 平角（60-90°）：最小倍数（2026年实测优化：0.34→0.30）

      // 最小样本数
      minSamples: 5,

      // 最大样本数（滑动窗口）
      maxSamples: 20,

      // 标准差阈值（超过此值认为测量不稳定）
      maxStdDev: 0.2,

      // 上次校准时间（用于避免频繁校准）
      lastCalibrationTime: 0,

      // 校准间隔（毫秒）
      calibrationInterval: 100
    };

    console.log('[SyncManager._initPanSpeedCalibration] ⭐ 按角度分档平移速度校准系统已初始化:', {
      陡角档位: '0-30°, 固定倍数: 0.37',
      中角档位: '30-60°, 固定倍数: 0.35',
      平角档位: '60-90°, 固定倍数: 0.30',
      说明: '基于透视投影几何原理设置递减倍数（0.37→0.35→0.30），平角档位基于2026年实测数据优化（降低约12%以匹配速度）'
    });
  }

  /**
   * 基于ENU切平面投影计算metersPerPixel（几何方法，替代经验测量）
   *
   * ⭐ 核心思想：
   * 1. Cesium的平移是沿着相机的right和up向量（3D空间中的向量）
   * 2. Dual的平移是在墨卡托平面（2D平面，相当于ENU的东-北平面）
   * 3. 计算Cesium的right/up向量在ENU切平面上的投影比率
   * 4. 根据实际平移方向（deltaX/deltaY）动态加权
   *
   * @param {number} baseMetersPerPixel - 基础metersPerPixel（透视投影公式计算）
   * @param {number} deltaX - X方向平移量（像素）
   * @param {number} deltaY - Y方向平移量（像素）
   * @returns {number|null} 调整后的metersPerPixel，失败返回null
   * @private
   */
  _calculateMetersPerPixelOnENUPlane(baseMetersPerPixel, deltaX = 0, deltaY = 0) {
    const camera = this.cesiumViewer?.camera;
    const Cesium = this.getCesium();

    if (!camera || !Cesium || !baseMetersPerPixel) {
      return null;
    }

    try {
      // ⭐ 方案1：基于相机方向向量的水平分量
      // 优势：不受delta方向影响，基于相机姿态的物理特性
      //
      // 1. 获取相机方向向量（ECEF坐标）
      const direction = camera.direction;

      if (!direction) {
        return null;
      }

      // 2. 获取ENU基向量
      const enuBasis = this.mercatorProjection.getENUBasisVectorsAtPosition(
        camera.position,
        this.cesiumViewer
      );

      if (!enuBasis) {
        return null;
      }

      const { east, north } = enuBasis;

      // 3. 计算方向向量在水平面（东-北平面）上的投影
      const eastComponent = Cesium.Cartesian3.dot(direction, east);
      const northComponent = Cesium.Cartesian3.dot(direction, north);

      // 水平分量长度
      const horizontalLength = Math.sqrt(
        eastComponent * eastComponent + northComponent * northComponent
      );

      // 4. 方向向量总长度（归一化）
      const directionLength = Cesium.Cartesian3.magnitude(direction);

      // 5. 水平投影比率（相机的"平视程度"）
      const horizontalRatio = directionLength > 0.001 ? horizontalLength / directionLength : 1.0;

      // 6. ⭐ 禁用几何校正，避免与按角度分档的校准倍数重复校正
      // 现在使用按角度分档的自适应校准系统（陡角/中角/平角）
      // 校准倍数会在 handlePanInUnified 中应用
      const smoothedRatio = 1.0; // 不做几何校正

      // 7. ⭐ 禁用校正，返回原始值
      // 校正由按角度分档的校准系统负责
      const adjustedMetersPerPixel = baseMetersPerPixel * smoothedRatio;

      // 8. 调试日志（简化版本，因为不再使用几何校正）
      // 几何校正已禁用，使用按角度分档的校准系统
      /*
      if (Math.abs(smoothedRatio - 1.0) > 0.01) {
        console.log('[SyncManager._calculateMetersPerPixelOnENUPlane] 基于相机方向的水平投影:', {
          deltaX: deltaX.toFixed(1),
          deltaY: deltaY.toFixed(1),
          基础metersPerPixel: baseMetersPerPixel.toFixed(4),
          方向水平分量: horizontalLength.toFixed(3),
          方向总长度: directionLength.toFixed(3),
          水平投影比率: horizontalRatio.toFixed(3),
          平滑校正比率: smoothedRatio.toFixed(3),
          调整后metersPerPixel: adjustedMetersPerPixel.toFixed(4),
          实测视觉比率: expectedRatio.toFixed(3),
          偏差: deviation.toFixed(1) + '%',
          说明: `相机${(horizontalRatio * 100).toFixed(0)}%水平，校正${(smoothedRatio * 100).toFixed(1)}%，偏差${deviation > 5 ? '⚠️ 较大' : '✓ 正常'}`
        });
      }
      */

      return adjustedMetersPerPixel;
    } catch (error) {
      console.warn('[SyncManager._calculateMetersPerPixelOnENUPlane] 计算失败:', error);
      return null;
    }
  }

  /**
   * 获取当前校准倍数
   * @returns {number} 当前校准倍数
   * @private
   */
  /**
   * 获取当前相机俯仰角所属的档位
   * @returns {string} 档位名称: 'steep' | 'medium' | 'flat'
   * @private
   */
  _getPitchRange() {
    const camera = this.cesiumViewer?.camera;
    if (!camera) {
      return 'medium'; // 默认中角档位
    }

    // 获取相机俯仰角（弧度）
    const pitch = camera.pitch;

    // 转换为角度（0-90度，0=水平，90=垂直向下）
    const pitchDegrees = Math.abs(pitch * 180 / Math.PI);

    // 分档逻辑
    if (pitchDegrees < 30) {
      return 'steep';  // 陡角（0-30°，接近水平）
    } else if (pitchDegrees < 60) {
      return 'medium'; // 中角（30-60°）
    } else {
      return 'flat';   // 平角（60-90°，接近俯视）
    }
  }

  /**
   * 获取当前校准倍数（根据相机角度自动选择档位）
   * @returns {number} 当前校准倍数
   * @private
   */
  _getCalibratedPanSpeed() {
    this._initPanSpeedCalibration();

    // 获取当前角度所属档位
    const pitchRange = this._getPitchRange();
    const calibration = this._panSpeedCalibration[pitchRange];

    console.log('[SyncManager._getCalibratedPanSpeed] 当前校准倍数（按角度分档）:', {
      档位: pitchRange === 'steep' ? '陡角(0-30°)' :
            pitchRange === 'medium' ? '中角(30-60°)' : '平角(60-90°)',
      校准倍数: calibration.currentFactor.toFixed(3),
      测量样本数: calibration.measurements.length,
      说明: calibration.measurements.length >= 5
        ? '基于该档位实际平移测量'
        : '使用递减初始值（陡0.37/中0.35/平0.34），等待更多测量数据验证'
    });

    return calibration.currentFactor;
  }

  /**
   * 记录平移测量数据（动态自适应校准，按角度分档）
   * @param {number} cesiumDelta - Cesium 实际移动距离（米）
   * @param {number} dualDelta - dual 期望移动距离（米）
   * @private
   */
  _recordPanMeasurement(cesiumDelta, dualDelta) {
    this._initPanSpeedCalibration();

    // ⚠️ 如果自动校准被禁用，不记录测量数据，保持固定倍数
    if (!this._panSpeedCalibration.enabled) {
      return;
    }

    if (Math.abs(cesiumDelta) < 0.01 || Math.abs(dualDelta) < 0.01) {
      return; // 移动距离太小，忽略
    }

    // ⭐ 按角度分档：获取当前相机角度所属档位
    const pitchRange = this._getPitchRange();
    const calibration = this._panSpeedCalibration[pitchRange];

    // ⭐ 关键修复：校准因子应该是 cesiumDelta / dualDelta
    // 逻辑：
    // - 目标：使 Dual 的视觉移动 = Cesium 的视觉移动
    // - 如果 dualDelta > cesiumDelta（Dual 移动更快），需要减小 Dual
    //   校准因子 = cesiumDelta / dualDelta < 1
    // - 如果 dualDelta < cesiumDelta（Dual 移动更慢），需要增大 Dual
    //   校准因子 = cesiumDelta / dualDelta > 1
    const measuredFactor = cesiumDelta / dualDelta;

    // ⭐ 限制校准因子的范围，避免极端值
    const MIN_FACTOR = 0.5;  // 最快只能减慢到 50%
    const MAX_FACTOR = 2.0;  // 最快只能加速到 200%
    const clampedFactor = Math.max(MIN_FACTOR, Math.min(MAX_FACTOR, measuredFactor));

    // 获取相机角度信息（用于调试）
    const camera = this.cesiumViewer?.camera;
    const pitchDegrees = camera ? Math.abs(camera.pitch * 180 / Math.PI) : 0;

    // 调试日志（只在有明显偏差时输出）
    if (Math.abs(measuredFactor - 1.0) > 0.05) {
      console.log('[SyncManager._recordPanMeasurement] 测量到平移偏差（按角度分档）:', {
        档位: pitchRange === 'steep' ? '陡角(0-30°)' :
              pitchRange === 'medium' ? '中角(30-60°)' : '平角(60-90°)',
        当前角度: pitchDegrees.toFixed(1) + '°',
        dualDelta: dualDelta.toFixed(4) + ' m',
        cesiumDelta: cesiumDelta.toFixed(4) + ' m',
        测量因子: measuredFactor.toFixed(3),
        限制后因子: clampedFactor.toFixed(3),
        调整方向: measuredFactor < 1 ? '减慢 Dual' : '加快 Dual'
      });
    }

    // ⭐ 使用指数平滑（EWMA）更新当前因子，避免突然跳变
    // alpha = 0.3 表示新测量占 30% 权重，历史值占 70% 权重
    const alpha = 0.3;
    const oldFactor = calibration.currentFactor;
    const smoothedFactor = oldFactor * (1 - alpha) + clampedFactor * alpha;

    // ⭐ 只有在测量样本较少时才频繁更新
    // 样本足够多后，降低更新频率，避免抖动
    // ⚠️ 修复收敛停滞问题：最小阈值设为 0.001（原 0.01 太大，导致校准卡住）
    const updateThreshold = Math.max(0.001, 0.05 / (calibration.measurements.length + 1));

    if (Math.abs(smoothedFactor - oldFactor) > updateThreshold ||
        calibration.measurements.length < 5) {
      calibration.currentFactor = smoothedFactor;
    }

    // 添加到对应档位的测量历史
    calibration.measurements.push({
      factor: clampedFactor,
      timestamp: Date.now(),
      cesiumDelta: cesiumDelta,
      dualDelta: dualDelta,
      pitchDegrees: pitchDegrees  // 记录测量时的角度
    });

    // 保持滑动窗口大小
    if (calibration.measurements.length > this._panSpeedCalibration.maxSamples) {
      calibration.measurements.shift();
    }

    // 调试日志（因子更新时输出）
    if (Math.abs(smoothedFactor - oldFactor) > updateThreshold) {
      console.log('[SyncManager._recordPanMeasurement] 校准倍数已更新（按角度分档）:', {
        档位: pitchRange === 'steep' ? '陡角(0-30°)' :
              pitchRange === 'medium' ? '中角(30-60°)' : '平角(60-90°)',
        当前角度: pitchDegrees.toFixed(1) + '°',
        旧倍数: oldFactor.toFixed(3),
        新倍数: smoothedFactor.toFixed(3),
        样本数: calibration.measurements.length
      });
    }
  }

  /**
   * 在 syncUnifiedToCesium 之后记录平移测量数据
   *
   * ⚠️ 修复时序问题：
   * - handlePanInUnified 只记录初始位置
   * - syncUnifiedToCesium 更新 Cesium 相机位置
   * - 此方法在 syncUnifiedToCesium 之后调用，此时 Cesium 相机已更新
   *
   * @private
   */
  _recordPanMeasurementAfterSync() {
    // 检查是否有待处理的校准数据
    if (!this._pendingPanCalibration) {
      return;
    }

    const { initialCesiumPosition, initialDualState, timestamp, deltaX, deltaY, direction: panDirection } = this._pendingPanCalibration;

    // 避免处理过期的数据（超过 1 秒）
    if (Date.now() - timestamp > 1000) {
      this._pendingPanCalibration = null;
      return;
    }

    const camera = this.cesiumViewer?.camera;
    const Cesium = this.getCesium();
    const state = this.unifiedCameraState;

    if (!camera || !Cesium || !state || !initialCesiumPosition || !initialDualState) {
      return;
    }

    // 计算 Cesium 的实际移动距离（此时相机已更新）
    const finalCesiumPosition = camera.position;
    const cesiumDelta = Cesium.Cartesian3.distance(initialCesiumPosition, finalCesiumPosition);

    // ⭐ 关键修复：计算水平移动距离（忽略垂直分量）
    // 原因：平移只应该在水平面（XZ平面）移动，垂直移动会被忽略
    // 这样可以避免天向量倾斜导致的测量误差
    const dualDeltaHorizontal = Math.sqrt(
      Math.pow(state.position.x - initialDualState.x, 2) +
      Math.pow(state.position.z - initialDualState.z, 2)
    );

    // 计算 dual 的期望移动距离（基于我们计算的平移量）
    const dualDelta = Math.sqrt(
      Math.pow(state.position.x - initialDualState.x, 2) +
      Math.pow(state.position.y - initialDualState.y, 2) +
      Math.pow(state.position.z - initialDualState.z, 2)
    );

    // ⭐ 关键修复：检测 dual 层的实际缩放因子
    // 在局部坐标系模式下，模型可能有缩放，这会影响视觉移动距离
    let modelScale = 1.0;
    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer.modelGroup && dualViewer.modelGroup.children.length > 0) {
        const model = dualViewer.modelGroup.children[0];
        if (model && model.scale) {
          // 取 xyz 缩放的平均值作为模型的整体缩放
          modelScale = (model.scale.x + model.scale.y + model.scale.z) / 3;

          console.log('[SyncManager._recordPanMeasurementAfterSync] ⚠️ 检测到模型缩放:', {
            scaleX: model.scale.x.toFixed(3),
            scaleY: model.scale.y.toFixed(3),
            scaleZ: model.scale.z.toFixed(3),
            平均缩放: modelScale.toFixed(3),
            说明: '模型缩放会影响视觉移动距离：dualDelta * modelScale = 视觉移动距离'
          });
        }
      }
    }

    // ⭐ 关键：提前计算视觉移动距离，供后续调试和校准使用
    const visualDualDelta = dualDelta * modelScale;
    const visualDualDeltaHorizontal = dualDeltaHorizontal * modelScale;

    // 调试日志：添加视觉移动距离的计算
    if (cesiumDelta > 0.01 || dualDelta > 0.01) {
      const visualRatio = cesiumDelta / visualDualDelta;
      const visualRatioHorizontal = cesiumDelta / visualDualDeltaHorizontal;

      // 计算说明文本
      let 说明 = '';
      if (visualRatio > 1) {
        说明 = 'Cesium 更快，需要减小 dual 移动';
      } else if (visualRatio < 1) {
        说明 = 'Dual 更快，需要减小 Cesium 移动';
      } else {
        说明 = '视觉速度一致';
      }

      console.log('[SyncManager._recordPanMeasurementAfterSync] ⭐ 平移测量（含视觉校正）:', {
        'Cesium 实际移动': cesiumDelta.toFixed(4) + ' m',
        'Dual 状态变化（3D）': dualDelta.toFixed(4) + ' m',
        'Dual 状态变化（水平）': dualDeltaHorizontal.toFixed(4) + ' m',
        '模型缩放因子': modelScale.toFixed(3),
        'Dual 视觉移动（3D）': visualDualDelta.toFixed(4) + ' m',
        'Dual 视觉移动（水平）': visualDualDeltaHorizontal.toFixed(4) + ' m',
        '视觉比率（3D）': visualRatio.toFixed(3),
        '视觉比率（水平）': visualRatioHorizontal.toFixed(3),
        说明: 说明,
        使用测量方法: Math.abs(visualRatioHorizontal - 1) < Math.abs(visualRatio - 1) ? '水平距离' : '3D距离'
      });

      // 对比：用户看到的视觉差异
      if (Math.abs(visualRatioHorizontal - 1) > 0.1) {
        let 用户观察 = '';
        let 建议 = '';

        if (visualRatioHorizontal > 1) {
          // Cesium 移动更快 (cesiumDelta > visualDualDelta)
          用户观察 = 'Dual 移动得更快';
          建议 = 'Dual 移动太慢，增大校准倍数';
        } else {
          // Dual 移动更快 (visualRatio < 1, cesiumDelta < visualDualDelta)
          用户观察 = 'Cesium 移动得更快';
          建议 = 'Dual 移动太快，减小校准倍数';
        }

        console.warn('[SyncManager._recordPanMeasurementAfterSync] ⚠️ 视觉移动速度不匹配!', {
          用户观察: 用户观察,
          数据分析: `Cesium ${cesiumDelta.toFixed(2)}m vs Dual 视觉（水平） ${visualDualDeltaHorizontal.toFixed(2)}m`,
          建议: 建议,
          当前校准倍数: (() => {
            const pitchRange = this._getPitchRange();
            return this._panSpeedCalibration?.[pitchRange]?.currentFactor?.toFixed(3) || 'N/A';
          })()
        });
      }
    }

    // 如果移动距离足够大，记录测量数据
    // ⭐ 关键修复：使用水平移动距离，忽略垂直分量
    // 因为平移操作只应该在水平面移动，垂直移动会导致测量误差
    if (cesiumDelta > 0.1 && dualDeltaHorizontal > 0.1) {
      this._recordPanMeasurement(cesiumDelta, visualDualDeltaHorizontal);
    }

    // 清除待处理数据
    this._pendingPanCalibration = null;
  }

  /**
   * 在统一坐标系中处理缩放
   */
  handleZoomInUnified(deltaZoom) {
    // ⚠️ 关键修复：大坐标模式检测
    // 大坐标模式包括：
    // 1. 真实世界模式 (isInRealWorldMode = true)
    // 2. 相机在大坐标位置 (camera.position 超过阈值)
    const LARGE_COORD_THRESHOLD = 1000;

    // 检测是否处于大坐标模式
    let isInLargeCoordMode = false;
    let modeReason = '';

    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];

      // ⭐ 关键修复：检查是否为局部坐标系模式
      // 局部坐标系模式下，即使相机坐标较大，也不应该使用大坐标模式的缩放逻辑
      const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem &&
                                this.mercatorProjection.isUsingLocalCoordinateSystem();

      // 检查1：真实世界模式标志（且不是局部坐标系模式）
      if (dualViewer.isInRealWorldMode && !isUsingLocalCoord) {
        isInLargeCoordMode = true;
        modeReason = '真实世界模式';
      }
      // 检查2：相机在大坐标位置（且不是局部坐标系模式）
      else if (!isUsingLocalCoord && dualViewer.camera1 && dualViewer.camera1.position) {
        const isCameraInLargeCoord =
          Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
          Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;

        if (isCameraInLargeCoord) {
          isInLargeCoordMode = true;
          modeReason = '大坐标位置';
        }
      }

      // ⭐ 局部坐标系模式下的调试信息
      if (isUsingLocalCoord) {
        console.log('[SyncManager.handleZoomInUnified] 局部坐标系模式：使用标准缩放逻辑', {
          isUsingLocalCoord: true,
          说明: '即使相机坐标较大，也使用局部坐标系的标准缩放'
        });
      }
    }

    const params = this.mouseOperationParams;
    const state = this.unifiedCameraState;

    const zoomFactor = 1 + deltaZoom * params.zoomSpeed;
    const oldHeight = state.height;

    // ⚠️ 在大坐标模式下，只更新高度用于 Cesium 同步，不更新位置
    if (isInLargeCoordMode) {
      // 初始化 Cesium 高度基准（如果尚未初始化）
      const cesiumCamera = this.cesiumViewer?.camera;
      if (cesiumCamera && this._lastCesiumHeightForSync === undefined) {
        this._lastCesiumHeightForSync = cesiumCamera.positionCartographic.height;

        console.log(`[SyncManager.handleZoomInUnified] ${modeReason}：初始化 Cesium 高度基准`, {
          Cesium高度: this._lastCesiumHeightForSync.toFixed(2)
        });
      }

      state.height *= zoomFactor;
      state.height = Math.max(10, Math.min(50000, state.height));

      console.log(`[SyncManager.handleZoomInUnified] ${modeReason}：只更新高度（${oldHeight.toFixed(2)} → ${state.height.toFixed(2)}），不更新位置`);
      return;
    }

    // 普通模式：执行完整的缩放逻辑
    const oldPosition = { x: state.position.x, y: state.position.y, z: state.position.z };
    const oldTarget = { x: state.target.x, y: state.target.y, z: state.target.z };

    // 详细调试：保存缩放前的完整状态
    const beforeState = {
      position: { ...state.position },
      direction: { ...state.direction },
      up: { ...state.up },
      right: { ...state.right },
      target: { ...state.target },
      height: state.height
    };

    // ⭐ 关键修复：在缩放计算之前先修正 target.y，避免使用错误的target值导致跳跃
    const isUnderground = state.position.y < -50;
    const originalTargetY = state.target.y;  // 保存原始target.y用于后续计算

    // ⭐ 获取是否为局部坐标系模式（在函数开头已检查，这里复用）
    const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    // ⭐ 在局部坐标系模式下，target.y 应该使用实际地形高度（0米），而不是模型海拔
    if (isUsingLocalCoord) {
      // 局部坐标系模式：target.y 应该始终为地形高度（0米）
      // 模型海拔（72.17米）由 MercatorProjectionManager 管理，不应该影响 target
      if (Math.abs(state.target.y) > 0.5) {  // 降低阈值，确保贴地
        console.warn('⚠️ [SyncManager] 缩放前修正target.y（局部坐标系模式）:', {
          原始targetY: state.target.y.toFixed(2) + '米',
          修正为: '0米（地形高度）',
          说明: '局部坐标系下target应使用地形高度，而非模型海拔'
        });
        state.target.y = 0;
      }
    } else {
      // 真实世界模式：只有当 target.y 明显不合理时（> 5 米）才修正
      if (Math.abs(state.target.y) > 5.0 && !isUnderground) {
        console.warn('⚠️ [SyncManager] 缩放前修正目标点 Y（真实世界模式）:', {
          原始targetY: state.target.y.toFixed(2) + '米',
          修正为: '0米',
          说明: '避免使用偏离地面的target导致缩放跳跃'
        });
        state.target.y = 0;
      } else if (Math.abs(state.target.y) > 0.01 && Math.abs(state.target.y) <= 5.0) {
        console.log('[SyncManager] 目标点 Y 在允许范围内，不修正:', {
          currentTargetY: state.target.y.toFixed(2) + '米'
        });
      }
    }

    // ⚠️ 关键修复：反转缩放方向（与大坐标模式保持一致）
    // 放大地图 → height 增大 → 相机上升 → 视野变大
    // 缩小地图 → height 减小 → 相机降低 → 视野变小
    state.height /= zoomFactor;  // 使用除法而不是乘法
    state.height = Math.max(10, Math.min(50000, state.height));

    const scale = state.height / oldHeight;

    // 关键：完全保持原始方向向量和正交基
    state.direction.x = beforeState.direction.x;
    state.direction.y = beforeState.direction.y;
    state.direction.z = beforeState.direction.z;

    state.up.x = beforeState.up.x;
    state.up.y = beforeState.up.y;
    state.up.z = beforeState.up.z;

    state.right.x = beforeState.right.x;
    state.right.y = beforeState.right.y;
    state.right.z = beforeState.right.z;

    // ⭐ 关键修复：使用原始target（修正前）来计算targetToCamera，保持方向一致性
    const targetToCamera = {
      x: oldPosition.x - oldTarget.x,
      y: oldPosition.y - oldTarget.y,
      z: oldPosition.z - oldTarget.z
    };

    // 归一化得到方向向量（从目标指向相机）
    const directionFromTarget = VectorMath.normalize(targetToCamera);

    // 根据新的高度重新计算位置：使用修正后的target
    state.position.x = state.target.x + directionFromTarget.x * state.height;
    state.position.y = state.target.y + directionFromTarget.y * state.height;
    state.position.z = state.target.z + directionFromTarget.z * state.height;

    // 更新方向向量（从相机指向目标）
    state.direction.x = -directionFromTarget.x;
    state.direction.y = -directionFromTarget.y;
    state.direction.z = -directionFromTarget.z;

    // 检测地上地下跳转
    const wasUnderground = oldPosition.y < 0;
    const isUndergroundNow = state.position.y < 0;
    if (wasUnderground !== isUndergroundNow) {
      console.error('🚨 [SyncManager] 缩放导致地上地下跳转!', {
        wasUnderground,
        isUnderground: isUndergroundNow,
        oldY: oldPosition.y.toFixed(2),
        newY: state.position.y.toFixed(2),
        oldHeight: oldHeight.toFixed(2),
        newHeight: state.height.toFixed(2),
        beforeDirection: { x: beforeState.direction.x.toFixed(6), y: beforeState.direction.y.toFixed(6), z: beforeState.direction.z.toFixed(6) },
        afterDirection: { x: state.direction.x.toFixed(6), y: state.direction.y.toFixed(6), z: state.direction.z.toFixed(6) },
        targetY: state.target.y.toFixed(2),
        formula: `position.y = ${state.target.y.toFixed(2)} - (${state.direction.y.toFixed(6)} * ${state.height.toFixed(2)}) = ${state.position.y.toFixed(2)}`
      });
    }

    // 检测缩放导致的真正异常跳跃
    const yDelta = Math.abs(state.position.y - oldPosition.y);
    if (yDelta > 5000) {
      console.warn('⚠️ [SyncManager] 缩放导致 Y 坐标异常跳跃:', {
        zoomFactor,
        scale,
        oldHeight: oldHeight.toFixed(2),
        newHeight: state.height.toFixed(2),
        oldY: oldPosition.y.toFixed(2),
        newY: state.position.y.toFixed(2),
        yDelta: yDelta.toFixed(2),
        targetY: state.target.y.toFixed(2),
        isUnderground: state.position.y < 0
      });
    }

    // 注意：缩放时不重建正交基，保持原始方向向量
    // _rebuildOrthonormalBasis() 会在其他操作（如旋转）时被调用

    // ⚠️ 关键修复：缩放操作后也需要更新地板中心
    // 缩放虽然不改变相机位置（只改变高度），但屏幕中心对应的墨卡托坐标可能已经变化
    // 特别是在平移后缩放，地板中心需要保持同步
    //
    // ⚠️ 额外修复：但在大坐标场景下，跳过地板中心更新以防止模型位置错误
    // 检查实际的 Three.js 相机是否在大坐标位置（而不是 state.position）

    // 获取实际的 Three.js 相机位置
    let actualCameraInLargeCoord = false;
    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer.camera1) {
        const camX = dualViewer.camera1.position.x;
        const camZ = dualViewer.camera1.position.z;
        actualCameraInLargeCoord = Math.abs(camX) > LARGE_COORD_THRESHOLD ||
                                      Math.abs(camZ) > LARGE_COORD_THRESHOLD;
      }
    }

    // ⭐ 局部坐标系模式下不更新地板中心
    if (!isUsingLocalCoord && !actualCameraInLargeCoord && this.floorCenterMercator && this.floorCenterMercator.x !== 0) {
      // 获取当前屏幕中心的墨卡托坐标
      const screenCenterMercator = this.getCesiumScreenCenterMercator();
      if (screenCenterMercator) {
        // 检查屏幕中心是否发生了显著变化（避免频繁更新）
        const deltaX = Math.abs(screenCenterMercator.x - this.floorCenterMercator.x);
        const deltaY = Math.abs(screenCenterMercator.y - this.floorCenterMercator.y);

        if (deltaX > 1 || deltaY > 1) {
          console.log('[SyncManager.handleZoomInUnified] 更新地板中心（缩放后）:', {
            oldFloorCenter: `(${this.floorCenterMercator.x.toFixed(2)}, ${this.floorCenterMercator.y.toFixed(2)})`,
            newFloorCenter: `(${screenCenterMercator.x.toFixed(2)}, ${screenCenterMercator.y.toFixed(2)})`
          });

          // 更新地板中心
          this.setFloorCenter(screenCenterMercator);
        }
      }
    } else if (actualCameraInLargeCoord) {
      // 大坐标场景：跳过地板中心更新
      console.log('[SyncManager.handleZoomInUnified] 检测到大坐标相机，跳过地板中心更新');
    } else if (isUsingLocalCoord) {
      // 局部坐标系场景：跳过地板中心更新
      console.log('[SyncManager.handleZoomInUnified] 检测到局部坐标系，跳过地板中心更新');
    }
  }

  // ==================== 新架构：使用操作路由器 ====================

  /**
   * 统一的旋转入口（根据架构选择处理器）
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @returns {boolean} 操作是否成功
   */
  handleRotate(deltaX, deltaY) {
    if (this.useNewArchitecture) {
      return this.handleRotateWithRouter(deltaX, deltaY);
    } else {
      return this.handleRotateInUnified(deltaX, deltaY);
    }
  }

  /**
   * 统一的缩放入口（根据架构选择处理器）
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  handleZoom(deltaZoom) {
    // ⭐ 局部坐标系模式 + Cesium已就绪：让Cesium主导缩放，然后同步到dual组件
    const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    // 检查Cesium是否已就绪
    const isCesiumReady = this.cesiumViewer?.camera && !this.cesiumViewer.isDestroyed();

    if (isUsingLocalCoord && isCesiumReady) {
      // 直接调用Cesium的缩放方法
      const cesiumCamera = this.cesiumViewer.camera;
      const zoomAmount = deltaZoom * this.mouseOperationParams.zoomSpeed;

      // 保存相机方向
      const heading = cesiumCamera.heading;
      const pitch = cesiumCamera.pitch;
      const roll = cesiumCamera.roll;

      // 执行Cesium缩放
      if (deltaZoom > 0) {
        cesiumCamera.zoomIn(zoomAmount);
      } else {
        cesiumCamera.zoomOut(-zoomAmount);
      }

      // 恢复相机方向（防止zoomIn/zoomOut改变方向）
      cesiumCamera.heading = heading;
      cesiumCamera.pitch = pitch;
      cesiumCamera.roll = roll;

      console.log('[SyncManager.handleZoom] 局部坐标系模式：由Cesium执行缩放', {
        缩放量: zoomAmount.toFixed(3),
        方向: deltaZoom > 0 ? '放大' : '缩小'
      });

      // Cesium的缩放会触发camera.changed事件，进而调用_syncCesiumToUnified
      // 所以不需要手动同步
      return true;
    }

    // ⭐ 局部坐标系模式但Cesium未就绪：沿用之前的逻辑
    // 非局部坐标系模式：使用原有逻辑
    if (this.useNewArchitecture) {
      return this.handleZoomWithRouter(deltaZoom);
    } else {
      return this.handleZoomInUnified(deltaZoom);
    }
  }

  /**
   * 统一的平移入口（根据架构选择处理器）
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  handlePan(deltaX, deltaY, metersPerPixel) {
    if (this.useNewArchitecture) {
      return this.handlePanWithRouter(deltaX, deltaY, metersPerPixel);
    } else {
      return this.handlePanInUnified(deltaX, deltaY, metersPerPixel);
    }
  }

  /**
   * 使用操作路由器处理旋转（新架构）
   * 根据地上地下状态路由到对应的处理器
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @returns {boolean} 操作是否成功
   */
  handleRotateWithRouter(deltaX, deltaY) {
    if (!this.operationRouter) {
      console.warn('[SyncManager] 操作路由器未初始化，使用降级方案');
      return this.handleRotateInUnified(deltaX, deltaY);
    }

    try {
      return this.operationRouter.routeRotate(deltaX, deltaY);
    } catch (error) {
      console.error('[SyncManager] 操作路由器翻转失败，使用降级方案:', error);
      return this.handleRotateInUnified(deltaX, deltaY);
    }
  }

  /**
   * 使用操作路由器处理缩放（新架构）
   * 根据地上地下状态路由到对应的处理器
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  handleZoomWithRouter(deltaZoom) {
    if (!this.operationRouter) {
      console.warn('[SyncManager] 操作路由器未初始化，使用降级方案');
      return this.handleZoomInUnified(deltaZoom);
    }

    try {
      return this.operationRouter.routeZoom(deltaZoom);
    } catch (error) {
      console.error('[SyncManager] 操作路由器缩放失败，使用降级方案:', error);
      return this.handleZoomInUnified(deltaZoom);
    }
  }

  /**
   * 使用操作路由器处理平移（新架构）
   * 根据地上地下状态路由到对应的处理器
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  handlePanWithRouter(deltaX, deltaY, metersPerPixel) {
    if (!this.operationRouter) {
      console.warn('[SyncManager] 操作路由器未初始化，使用降级方案');
      const result = this.handlePanInUnified(deltaX, deltaY, metersPerPixel);
      if (result) {
        this._updateFloorCenterAfterPan();
      }
      return result;
    }

    try {
      const result = this.operationRouter.routePan(deltaX, deltaY, metersPerPixel);
      if (result) {
        // 平移成功后，更新地板中心到新的相机位置
        this._updateFloorCenterAfterPan();
      }
      return result;
    } catch (error) {
      console.error('[SyncManager] 操作路由器平移失败，使用降级方案:', error);
      const result = this.handlePanInUnified(deltaX, deltaY, metersPerPixel);
      if (result) {
        this._updateFloorCenterAfterPan();
      }
      return result;
    }
  }

  /**
   * 获取操作路由器
   * @returns {OperationRouter|null} 操作路由器实例
   */
  getOperationRouter() {
    return this.operationRouter;
  }

  /**
   * 设置使用新架构标志
   * @param {boolean} useNewArchitecture - 是否使用新架构
   */
  setUseNewArchitecture(useNewArchitecture) {
    this.useNewArchitecture = useNewArchitecture;
    console.log(`[SyncManager] ${useNewArchitecture ? '启用' : '禁用'}新架构`);

    // 如果启用新架构，重新设置鼠标事件
    if (useNewArchitecture && this.cesiumViewer) {
      this._cesiumEventsSetup = false; // 重置标志，允许重新设置
      this._setupCesiumMouseEvents();
    }
  }

  /**
   * 清理 Cesium 鼠标事件监听器
   * 在组件卸载时调用
   */
  cleanupCesiumMouseEvents() {
    if (!this._cesiumMouseHandlers || !this.cesiumViewer) {
      return;
    }

    const canvas = this.cesiumViewer.canvas;
    if (!canvas) {
      return;
    }

    console.log('[SyncManager] 清理 Cesium 鼠标事件监听器');

    // 移除事件监听器
    canvas.removeEventListener('mousedown', this._cesiumMouseHandlers.onMouseDown);
    canvas.removeEventListener('mousemove', this._cesiumMouseHandlers.onMouseMove);
    window.removeEventListener('mouseup', this._cesiumMouseHandlers.onMouseUp);
    canvas.removeEventListener('contextmenu', this._cesiumMouseHandlers.onContextMenu);

    // 清理引用
    this._cesiumMouseHandlers = null;
    this._cesiumEventsSetup = false;

    console.log('[SyncManager] ✅ Cesium 鼠标事件监听器已清理');
  }

  /**
   * 统一的旋转操作入口（根据 useNewArchitecture 标志选择处理器）
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @returns {boolean} 操作是否成功
   */
  handleRotate(deltaX, deltaY) {
    if (this.useNewArchitecture) {
      console.log('[SyncManager] 使用新架构处理旋转（操作路由器）');
      return this.handleRotateWithRouter(deltaX, deltaY);
    } else {
      return this.handleRotateInUnified(deltaX, deltaY);
    }
  }

  /**
   * 统一的缩放操作入口（根据 useNewArchitecture 标志选择处理器）
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  handleZoom(deltaZoom) {
    if (this.useNewArchitecture) {
      console.log('[SyncManager] 使用新架构处理缩放（操作路由器）');
      return this.handleZoomWithRouter(deltaZoom);
    } else {
      return this.handleZoomInUnified(deltaZoom);
    }
  }

  /**
   * 统一的平移操作入口（根据 useNewArchitecture 标志选择处理器）
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  handlePan(deltaX, deltaY, metersPerPixel) {
    if (this.useNewArchitecture) {
      console.log('[SyncManager] 使用新架构处理平移（操作路由器）');
      return this.handlePanWithRouter(deltaX, deltaY, metersPerPixel);
    } else {
      return this.handlePanInUnified(deltaX, deltaY, metersPerPixel);
    }
  }

  /**
   * 重建正交基
   *
   * ⚠️ 墨卡托坐标系特殊处理：
   * 在墨卡托坐标系中，X→经度，Y→高度，Z→纬度(取反)
   * 为了确保平移方向正确：
   * - up 必须指向 Y 轴正方向（高度方向）
   * - right 必须指向 X 轴正方向（经度方向）
   */
  _rebuildOrthonormalBasis() {
    const state = this.unifiedCameraState;

    state.direction = VectorMath.normalize(state.direction);

    // ⚠️ 关键修复：在墨卡托坐标系中，强制 up 向量指向 Y 轴正方向（高度方向）
    state.up = { x: 0, y: 1, z: 0 };

    // ⭐ 关键修复：使用正确的叉乘公式 cross(direction, up)
    // 叉乘顺序很重要：right = cross(direction, up)
    // cross(direction, up) = cross((dx, dy, dz), (0, 1, 0)) = (dz, 0, -dx)
    // 这样可以确保 right 指向 X 轴正方向
    const dirLen = Math.sqrt(state.direction.x ** 2 + state.direction.y ** 2 + state.direction.z ** 2);
    if (dirLen > 0.001) {
      // ⭐ 修复：使用正确的叉乘顺序
      let right = {
        x: state.direction.z / dirLen,
        y: 0,
        z: -state.direction.x / dirLen
      };

      // 归一化 right
      const rightLen = Math.sqrt(right.x ** 2 + right.z ** 2);
      if (rightLen < 0.001) {
        // 如果 direction 几乎平行于 up（垂直向上或向下），使用 X 轴正方向
        right = { x: 1, y: 0, z: 0 };
      } else {
        right.x /= rightLen;
        right.z /= rightLen;
      }

      // ⭐ 关键修复：确保 right 指向 X 轴正方向
      // 如果 right.x < 0，说明方向反了，需要取反
      if (right.x < 0) {
        right.x = -right.x;
        right.y = -right.y;
        right.z = -right.z;
      }

      state.right = right;

      // ⭐ 新增：验证 right 向量与 X 轴的对齐情况
      const angleFromX = Math.atan2(right.z, right.x) * 180 / Math.PI;

      console.log('[SyncManager._rebuildOrthonormalBasis] 重建正交基:', {
        direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        up: `(${state.up.x.toFixed(3)}, ${state.up.y.toFixed(3)}, ${state.up.z.toFixed(3)})`,
        right: `(${state.right.x.toFixed(3)}, ${state.right.y.toFixed(3)}, ${state.right.z.toFixed(3)})`,
        rightDotX: state.right.x.toFixed(3),
        与X轴夹角: angleFromX.toFixed(2) + '°',
        说明: Math.abs(angleFromX) < 10 ? '✅ right向量与X轴对齐良好' : '⚠️ right向量与X轴有明显夹角，可能导致平移方向偏差'
      });
    }
  }

  /**
   * 平移后更新地板中心
   *
   * ⚠️ 重要设计决策：地板中心应该保持固定
   *
   * 原设计：地板中心跟随相机移动，避免大坐标精度问题
   * 问题：这导致地板中心的经纬度随平移而改变，不符合"地板中心固定在地面某点"的预期
   *
   * 新设计：地板中心在初始化后保持固定，平移时只更新相机位置
   * 优势：
   * 1. 地板中心代表固定的地理位置（经纬度不变）
   * 2. Three.js 模型的世界坐标代表相对于该固定点的偏移
   * 3. 平移操作更直观，符合用户预期
   *
   * @private
   */
  _updateFloorCenterAfterPan() {
    const Cesium = this.getCesium();
    if (!Cesium || !this.cesiumViewer?.camera) {
      console.warn('[SyncManager] 无法记录相机位置：缺少必要参数');
      return;
    }

    try {
      const camera = this.cesiumViewer.camera;
      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;

      // 获取当前相机位置的墨卡托坐标（用于日志）
      const cartographic = ellipsoid.cartesianToCartographic(camera.position);

      if (!cartographic) {
        console.warn('[SyncManager] 无法获取相机位置的地理坐标');
        return;
      }

      // 计算当前相机位置的墨卡托坐标
      const currentMercatorPosition = {
        x: cartographic.longitude * 6378137.0,
        y: this.surfaceHandler.latitudeToMercator(cartographic.latitude),
        z: cartographic.height
      };

      // 计算当前相机位置相对于地板中心的偏移
      const relativePosition = {
        x: currentMercatorPosition.x - this.floorCenterMercator.x,
        y: currentMercatorPosition.z,  // 高度作为 Y
        z: -(currentMercatorPosition.y - this.floorCenterMercator.y)  // 纬度偏移取反作为 Z
      };

      console.log('[SyncManager] 平移后相机位置（地板中心固定）:', {
        地板中心: `(${this.floorCenterMercator.x.toFixed(2)}, ${this.floorCenterMercator.y.toFixed(2)})`,
        相机墨卡托位置: `(${currentMercatorPosition.x.toFixed(2)}, ${currentMercatorPosition.y.toFixed(2)}, ${currentMercatorPosition.z.toFixed(2)})`,
        相对位置: `(${relativePosition.x.toFixed(2)}, ${relativePosition.y.toFixed(2)}, ${relativePosition.z.toFixed(2)})`,
        相机地理坐标: {
          经度: (cartographic.longitude * 180 / Math.PI).toFixed(6),
          纬度: (cartographic.latitude * 180 / Math.PI).toFixed(6),
          高度: cartographic.height.toFixed(2)
        }
      });

      // ⚠️ 不再更新地板中心
      // 地板中心保持固定，只更新统一坐标系中的相机位置
      // 统一坐标系的更新已经在 _syncCesiumToUnified 中完成

      // ⚠️ 不再触发回调
      // 因为地板中心没有变化，不需要通知 DualCanvasViewer 更新模型位置

    } catch (error) {
      console.error('[SyncManager] 记录平移后相机位置失败:', error);
    }
  }

  // ==================== 统一平面投影坐标系 - 坐标同步 ====================

  /**
   * 从统一平面投影坐标系同步到 Cesium
   * 委托给 MercatorProjectionManager
   */
  syncUnifiedToCesium(cesiumCamera, cesiumScene) {
    // ⭐ 关键修复：检查是否在 handleRotateInUnified 中已经同步过
    // 局部坐标模式下，翻转操作已经在 handleRotateInUnified 中同步过了
    if (this._skipNextCesiumSync) {
      console.log('[SyncManager.syncUnifiedToCesium] 跳过同步：已在 handleRotateInUnified 中同步');
      this._skipNextCesiumSync = false; // 重置标志
      return true;
    }

    // ⭐ 关键修复：使用计数器检查 DualCanvasViewer 是否正在设置相机
    // 计数器 > 0 表示有相机操作正在进行，跳过同步以防止干扰
    if (this._syncOperationCount && this._syncOperationCount > 0) {
      console.log('[SyncManager.syncUnifiedToCesium] 跳过同步：相机操作正在进行，计数器:', this._syncOperationCount);
      return false;
    }

    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera) {
      console.error('[SyncManager] syncUnifiedToCesium 缺少必要参数');
      return false;
    }

    // ⚠️ 关键修复：大坐标模式检测
    // 大坐标模式包括：
    // 1. 真实世界模式 (isInRealWorldMode = true)
    // 2. 相机在大坐标位置 (camera.position 超过阈值)
    // 3. 局部坐标系模式 (useLocalCoordinateSystem = true)
    const LARGE_COORD_THRESHOLD = 1000;

    let isInLargeCoordMode = false;
    let modeReason = '';

    // ⭐ 关键修复：优先检查局部坐标系模式
    // 因为在局部坐标系模式下，相机位置会被转换到小坐标（原点附近）
    // 所以不能通过相机位置来判断是否在大坐标模式
    const isLocalCoordMode = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                            this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (isLocalCoordMode) {
      isInLargeCoordMode = true;
      modeReason = '局部坐标系模式';
    }

    if (!isInLargeCoordMode && window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];

      // 检查1：真实世界模式标志
      if (dualViewer && dualViewer.isInRealWorldMode) {
        isInLargeCoordMode = true;
        modeReason = '真实世界模式';
      }
      // 检查2：相机在大坐标位置
      else if (dualViewer && dualViewer.camera1 && dualViewer.camera1.position) {
        const isCameraInLargeCoord =
          Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
          Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;

        if (isCameraInLargeCoord) {
          isInLargeCoordMode = true;
          modeReason = '大坐标位置';
        }
      }
    }

    // ⚠️ 在大坐标模式下，根据不同的子模式采用不同的同步策略
    if (isInLargeCoordMode) {
      // ⭐ 关键修复：局部坐标系模式使用 syncDirectionToCesium
      if (isLocalCoordMode) {
        console.log(`[SyncManager.syncUnifiedToCesium] ${modeReason}：使用 syncDirectionToCesium 保持旋转一致性`);

        // ⭐ 关键修复：局部坐标系模式下，使用 syncDirectionToCesium 而不是 syncToCesium
        // 原因：syncToCesium 会从 target 重新计算方向向量，丢失 handleRotateInUnified 中的旋转更新
        // syncDirectionToCesium 直接使用 state.direction，保持旋转与 Three.js dual 地板一致
        const success = this.mercatorProjection.syncDirectionToCesium(
          this.unifiedCameraState,
          cesiumCamera,
          cesiumScene
        );

        if (!success) {
          console.error('[SyncManager] 局部坐标系模式下同步方向到 Cesium 失败');
        }

        return success;
      } else {
        // ⚠️ 大坐标位置模式（非局部坐标系）：只同步缩放，不同步位置
        // 这种情况下，相机在大坐标位置但不是局部坐标系模式，只同步缩放
        const state = this.unifiedCameraState;

        // 保存上次的高度用于计算变化比例
        if (!this._lastStateHeight) {
          this._lastStateHeight = state.height;
        }

        // 计算高度变化比例
        const heightRatio = state.height / this._lastStateHeight;

        // 更新保存的高度值
        this._lastStateHeight = state.height;

        // 只在高度变化较大时才执行缩放
        if (Math.abs(heightRatio - 1) > 0.001) {
          // ⚠️ 关键修复：保存相机方向（heading, pitch, roll），防止 zoomIn/zoomOut 改变方向
          const currentHeading = cesiumCamera.heading;
          const currentPitch = cesiumCamera.pitch;
          const currentRoll = cesiumCamera.roll;

          // 执行 Cesium 缩放
          const currentHeight = cesiumCamera.positionCartographic.height;
          const heightChange = Math.abs(currentHeight * (heightRatio - 1));
          const clampedAmount = Math.max(1, Math.min(10000000, heightChange));

          if (heightRatio > 1) {
            cesiumCamera.zoomIn(clampedAmount);
          } else {
            cesiumCamera.zoomOut(clampedAmount);
          }

          // ⚠️ 恢复相机方向，确保只改变高度，不改变方向
          // 这防止了缩放时相机翻转
          cesiumCamera.setView({
            orientation: {
              heading: currentHeading,
              pitch: currentPitch,
              roll: currentRoll
            }
          });

          console.log(`[SyncManager.syncUnifiedToCesium] ${modeReason}：执行 Cesium 缩放并恢复方向`, {
            heightRatio: heightRatio.toFixed(4),
            currentHeight: currentHeight.toFixed(2),
            zoomAmount: clampedAmount.toFixed(2),
            direction: heightRatio > 1 ? 'zoomIn' : 'zoomOut',
            headingPreserved: (cesiumCamera.heading - currentHeading).toExponential(4),
            pitchPreserved: (cesiumCamera.pitch - currentPitch).toExponential(4),
            rollPreserved: (cesiumCamera.roll - currentRoll).toExponential(4)
          });
        }

        return true;
      }
    }

    // 普通模式：委托给 MercatorProjectionManager
    const success = this.mercatorProjection.syncToCesium(
      this.unifiedCameraState,
      cesiumCamera,
      cesiumScene
    );

    if (!success) {
      console.error('[SyncManager] 同步到 Cesium 失败');
    }

    return success;
  }

  /**
   * 从统一平面投影坐标系同步到 Three.js
   */
  syncUnifiedToThree() {
    // ⭐ 关键修复：使用计数器检查 DualCanvasViewer 是否正在设置相机
    // 计数器 > 0 表示有相机操作正在进行，跳过同步以防止干扰
    if (this._syncOperationCount && this._syncOperationCount > 0) {
      console.log('[SyncManager.syncUnifiedToThree] 跳过同步：相机操作正在进行，计数器:', this._syncOperationCount);
      return;
    }

    // ⚠️ 关键修复：大坐标模式下跳过 SyncManager 的小坐标系统同步
    // 大坐标模式包括：
    // 1. 真实世界模式 (isInRealWorldMode = true)
    // 2. 相机在大坐标位置 (camera.position 超过阈值)
    const LARGE_COORD_THRESHOLD = 1000;
    const dualViewer = window.__dualCanvasViewerInstances &&
                       window.__dualCanvasViewerInstances.length > 0 &&
                       window.__dualCanvasViewerInstances[0];

    // 检测是否应该使用大坐标模式同步逻辑
    let shouldUseLargeCoordSync = false;
    let syncReason = '';

    if (dualViewer) {
      // ⚠️ 关键修复：只检查真实世界模式标志
      // 禁用"选中大坐标模型"的检测
      // 原因：模型已经被放置在局部墨卡托坐标系原点附近，不再需要特殊的大坐标模式同步逻辑
      // 使用"选中大坐标模型"的检测会导致：
      // 1. 相机位置被设置到 state.position（包含大坐标值）
      // 2. 旋转时相机跳变到遥远位置
      if (dualViewer.isInRealWorldMode) {
        shouldUseLargeCoordSync = true;
        syncReason = '真实世界模式';
      }
      // 注释掉的原始代码：
      // // 检查2：选中了大坐标模型
      // else if (dualViewer.hasLargeCoordModelSelected) {
      //   shouldUseLargeCoordSync = true;
      //   syncReason = '选中大坐标模型';
      // }
      // ⚠️ 关键修复：禁用"相机在大坐标位置"的检测
      // 原因：模型现在已经被放置在局部墨卡托坐标系原点附近
      // 不再需要根据相机位置判断是否使用大坐标模式
      // 这个检测会导致相机在正常旋转时被误判为大坐标模式，从而跳到错误的位置
      //
      // 如果后续需要启用，应该：
      // 1. 使用更高的阈值（如 100000）来避免误判
      // 2. 或者只在模型确实是真实世界大坐标时才启用
      //
      // 注释掉的原始代码：
      // else if (dualViewer.camera1 && dualViewer.camera1.position) {
      //   const LARGE_COORD_THRESHOLD_ADJUSTED = 1000;
      //   const isCameraInLargeCoord =
      //     Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD_ADJUSTED ||
      //     Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD_ADJUSTED;
      //   if (isCameraInLargeCoord) {
      //     shouldUseLargeCoordSync = true;
      //     syncReason = '大坐标位置';
      //   }
      // }
    }

    // 大坐标模式、真实世界模式或混合模式：同步高度变化到 Three.js 相机
    if (shouldUseLargeCoordSync) {
      console.log(`[SyncManager.syncUnifiedToThree] ${syncReason}：使用大坐标模式同步逻辑`);

      // 获取 Cesium 相机（在大坐标模式下需要）
      const cesiumCamera = this.cesiumViewer?.camera;
      const state = this.unifiedCameraState;

      // ⭐ 关键修复：大坐标模式下，使用 unifiedCameraState 中的方向信息
      // 而不是从 Three.js 当前状态计算，这样才能正确反映 Cesium 的翻转

      // 从 unifiedCameraState 获取正确的方向向量（已从 Cesium 同步）
      const direction = {
        x: state.direction.x,
        y: state.direction.y,
        z: state.direction.z
      };

      // 从 unifiedCameraState 获取 up 向量
      const up = {
        x: state.up.x,
        y: state.up.y,
        z: state.up.z
      };

      // 检查所有必要的对象是否存在
      if (dualViewer && dualViewer.camera1 && dualViewer.camera1.position && dualViewer.controls1) {
        const currentPosition = dualViewer.camera1.position.clone();
        const currentTarget = dualViewer.controls1.target.clone();

        // 初始化或更新高度基准
        if (!this._lastCesiumHeightForSync && cesiumCamera) {
          this._lastCesiumHeightForSync = cesiumCamera.positionCartographic.height;
          this._lastThreeHeightForSync = currentPosition.y;
          this._lastThreeTargetYForSync = currentTarget.y;
        }

        // ⚠️ 关键修复：临时增加 syncDepth，防止 controls1.update() 触发额外的同步
        const originalSyncDepth = dualViewer.syncDepth || 0;
        dualViewer.syncDepth = originalSyncDepth + 1;

        if (cesiumCamera) {
          // 只初始化或更新 Cesium 高度基准，不执行任何同步操作
          if (!this._lastCesiumHeightForSync) {
            this._lastCesiumHeightForSync = cesiumCamera.positionCartographic.height;
            this._lastThreeHeightForSync = currentPosition.y;
            this._lastThreeTargetYForSync = currentTarget.y;
          } else {
            // 更新基准值以保持同步，但不修改 Three.js 相机
            this._lastCesiumHeightForSync = cesiumCamera.positionCartographic.height;
            this._lastThreeHeightForSync = currentPosition.y;
            this._lastThreeTargetYForSync = currentTarget.y;
          }
        }

        // ⚠️ 恢复 syncDepth
        dualViewer.syncDepth = originalSyncDepth;

        // ⭐ 关键修复：使用 state.target 而不是 currentTarget
        // state.target 已经在 _syncCesiumToUnified 中更新并固定在地面
        const stateTarget = state.target || { x: 0, y: 0, z: 0 };

        // ⭐ 关键修复：direction 需要取反
        // Cesium 的 direction 是相机看的方向（从相机指向目标）
        // 但我们的 state.direction 是从 Cesium 同步的，所以需要取反才能用于 OrbitControls
        // OrbitControls 的 direction 是从相机指向目标，与 Cesium 相同，所以不需要取反
        // 但我们的计算公式有问题，应该让相机在目标上方

        // 简化方案：使用 state.position 直接作为相机位置
        // 这样可以避免公式计算的复杂性
        const calculatedPosition = {
          x: state.position.x,
          y: state.position.y,
          z: state.position.z
        };

        // 使用 state.target 作为目标点
        const calculatedTarget = {
          x: stateTarget.x,
          y: stateTarget.y,
          z: stateTarget.z
        };

        console.log(`[SyncManager.syncUnifiedToThree] ${syncReason}：使用 unifiedCameraState 方向计算相机位置`, {
          height: state.height.toFixed(2),
          direction: `(${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)})`,
          up: `(${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`,
          position: `(${calculatedPosition.x.toFixed(2)}, ${calculatedPosition.y.toFixed(2)}, ${calculatedPosition.z.toFixed(2)})`,
          target: `(${calculatedTarget.x.toFixed(2)}, ${calculatedTarget.y.toFixed(2)}, ${calculatedTarget.z.toFixed(2)})`
        });

        // 计算 right 向量
        const right = {
          x: up.y * direction.z - up.z * direction.y,
          y: up.z * direction.x - up.x * direction.z,
          z: up.x * direction.y - up.y * direction.x
        };

        // 返回计算后的位置和方向信息
        return {
          position: calculatedPosition,
          target: calculatedTarget,
          direction: direction,
          up: up,
          right: right,
          // 标记这是大坐标模式的结果
          _isLargeCoordMode: true
        };
      } else {
        // 大坐标模式下，如果 dualViewer 未就绪，记录警告并返回 null
        console.warn('[SyncManager.syncUnifiedToThree] 大坐标模式下 dualViewer 未就绪', {
          hasDualViewer: !!dualViewer,
          hasCamera1: !!dualViewer?.camera1,
          hasPosition: !!dualViewer?.camera1?.position,
          hasControls1: !!dualViewer?.controls1
        });
        return null;
      }
    }

    const state = this.unifiedCameraState;
    let floorCenter = this.floorCenterMercator;

    // ⭐ 关键修复：局部坐标系模式下，使用模型的绝对地理位置
    const isUsingLocalCoord = this.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();
    if (isUsingLocalCoord && this.mercatorProjection.modelAbsoluteMercator) {
      floorCenter = this.mercatorProjection.modelAbsoluteMercator;
    }

    // unifiedCameraState.position 存储的是相对地板中心的坐标
    // 需要先还原成绝对墨卡托坐标，然后再转换为 Three.js 坐标

    // 还原相机位置的绝对墨卡托坐标
    // state.position.x = 相对墨卡托 X
    // state.position.y = 高度
    // state.position.z = 相对墨卡托 Y（取反）
    const absMercatorX = state.position.x + floorCenter.x;
    const absMercatorY = -state.position.z + floorCenter.y;  // 反向取反
    const height = state.position.y;

    // 还原目标点的绝对墨卡托坐标
    const absTargetX = state.target.x + floorCenter.x;
    const absTargetY = -state.target.z + floorCenter.y;
    const targetHeight = state.target.y;

    // 通过 mercatorToThree 转换坐标
    // ⚠️ 调试：记录输入输出，检测是否有额外缩放
    const stateX = state.position.x;
    const stateZ = state.position.z;

    const threePosition = this.mercatorToThree(
      absMercatorX,
      absMercatorY,
      height
    );

    const threeTarget = this.mercatorToThree(
      absTargetX,
      absTargetY,
      targetHeight
    );

    // ⚠️ 调试：检测坐标转换是否有额外缩放
    if (isUsingLocalCoord && (Math.abs(stateX) > 1 || Math.abs(stateZ) > 1)) {
      const deltaXExpected = stateX;  // 期望的 X 变化
      const deltaZExpected = stateZ;  // 期望的 Z 变化（取反）
      const deltaXActual = threePosition.x;  // 实际的 X 变化
      const deltaZActual = threePosition.z;  // 实际的 Z 变化

      const scaleX = deltaXActual / deltaXExpected;
      const scaleZ = deltaZActual / deltaZExpected;

      console.log('[SyncManager.syncUnifiedToThree] 坐标转换缩放检测:', {
        期望X: deltaXExpected.toFixed(2),
        实际X: deltaXActual.toFixed(2),
        X缩放: scaleX.toFixed(3),
        期望Z: deltaZExpected.toFixed(2),
        实际Z: deltaZActual.toFixed(2),
        Z缩放: scaleZ.toFixed(3),
        说明: scaleX !== 1.0 || scaleZ !== 1.0 ? '⚠️ 存在额外缩放' : '✓ 无额外缩放'
      });
    }

    // ⚠️ 关键修复：不要直接转换 direction 向量
    // 原因：mercatorToThree() 包含地板中心偏移，而 mercatorVectorToThree() 不包含偏移
    // 这会导致 position = target + direction * height 的关系在转换后不再成立
    // 解决方案：在 Three.js 坐标系中重新计算 direction 和 up 向量

    // 从 Three.js 坐标重新计算方向向量
    const threeDirection = {
      x: threeTarget.x - threePosition.x,
      y: threeTarget.y - threePosition.y,
      z: threeTarget.z - threePosition.z
    };
    const dirLength = Math.sqrt(threeDirection.x ** 2 + threeDirection.y ** 2 + threeDirection.z ** 2);
    if (dirLength > 0.0001) {
      threeDirection.x /= dirLength;
      threeDirection.y /= dirLength;
      threeDirection.z /= dirLength;
    }

    // 转换 up 向量（仅轴转换，作为参考方向）
    const rawUp = this.mercatorVectorToThree(
      state.up.x,
      state.up.y,
      state.up.z
    );

    // 确保 up 向量与 direction 正交
    // 使用 Gram-Schmidt 正交化
    const dot = threeDirection.x * rawUp.x + threeDirection.y * rawUp.y + threeDirection.z * rawUp.z;
    const threeUp = {
      x: rawUp.x - threeDirection.x * dot,
      y: rawUp.y - threeDirection.y * dot,
      z: rawUp.z - threeDirection.z * dot
    };
    const upLength = Math.sqrt(threeUp.x ** 2 + threeUp.y ** 2 + threeUp.z ** 2);
    if (upLength > 0.0001) {
      threeUp.x /= upLength;
      threeUp.y /= upLength;
      threeUp.z /= upLength;
    } else {
      // 降级方案：使用默认 up 向量
      threeUp.x = 0;
      threeUp.y = 1;
      threeUp.z = 0;
    }

    // 计算 right 向量（cross product）
    const threeRight = {
      x: threeUp.y * threeDirection.z - threeUp.z * threeDirection.y,
      y: threeUp.z * threeDirection.x - threeUp.x * threeDirection.z,
      z: threeUp.x * threeDirection.y - threeUp.y * threeDirection.x
    };
    const rightLength = Math.sqrt(threeRight.x ** 2 + threeRight.y ** 2 + threeRight.z ** 2);
    if (rightLength > 0.0001) {
      threeRight.x /= rightLength;
      threeRight.y /= rightLength;
      threeRight.z /= rightLength;
    }

    return {
      position: threePosition,
      target: threeTarget,
      direction: threeDirection,
      up: threeUp,
      right: threeRight
    };
  }

  /**
   * 从 Cesium 相机状态初始化统一平面投影坐标系
   * 委托给 MercatorProjectionManager
   */
  initFromCesium(cesiumCamera, cesiumScene) {
    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera) {
      console.error('[SyncManager] initFromCesium 缺少必要参数');
      return;
    }

    // ⚠️ 关键修复：在大坐标模式下跳过初始化（但局部坐标系模式除外）
    // 如果 Dual 相机已经在大坐标位置，不要用 Cesium 的状态覆盖
    const LARGE_COORD_THRESHOLD = 1000;

    // ⭐ 检查是否为局部坐标系模式
    const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0 && !isUsingLocalCoord) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer && dualViewer.camera1 && dualViewer.camera1.position) {
        const isDualInLargeCoord =
          Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
          Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;

        if (isDualInLargeCoord) {
          console.log('[SyncManager.initFromCesium] 大坐标模式：跳过从 Cesium 初始化，保持现有状态');
          return;
        }
      }
    }

    // 委托给 MercatorProjectionManager
    const state = this.mercatorProjection.initFromCesium(cesiumCamera, cesiumScene);

    if (state) {
      // 更新本地状态
      this.unifiedCameraState = state;
      console.log('[SyncManager] 从 Cesium 初始化完成');
    } else {
      console.error('[SyncManager] 从 Cesium 初始化失败');
    }
  }

  /**
   * 重新初始化统一坐标系状态（用于局部坐标系模式）
   * 当 floorCenterMercator 从大坐标变为 (0, 0, 0) 时，需要重新初始化 unifiedCameraState
   */
  reinitUnifiedState() {
    console.log('[SyncManager] 重新初始化 unifiedCameraState');

    // ⭐ 关键修复：在局部坐标系模式下，unifiedCameraState 应该使用小坐标
    // 从 Three.js 相机（camera1）读取当前位置，并转换为统一坐标系状态
    if (!window.__dualCanvasViewerInstances || window.__dualCanvasViewerInstances.length === 0) {
      console.warn('[SyncManager.reinitUnifiedState] DualCanvasViewer 实例不存在');
      return;
    }

    const dualViewer = window.__dualCanvasViewerInstances[0];
    if (!dualViewer || !dualViewer.camera1) {
      console.warn('[SyncManager.reinitUnifiedState] camera1 不存在');
      return;
    }

    const camera1 = dualViewer.camera1;
    const controls1 = dualViewer.controls1;



    // ⭐ 关键修复：直接读取 controls1.target，避免重新计算导致的位置错误
    // 问题：如果重新计算 target，当模型距离相机很远时，会导致 target 位置不正确
    const currentDirection = new THREE.Vector3();
    camera1.getWorldDirection(currentDirection);

    // 直接使用 controls1.target（如果存在且有效）
    // ⭐ 但是要检查 target 是否合理，如果距离相机太远则重新计算
    let targetPosition;
    if (controls1 && controls1.target) {
      const rawTarget = new THREE.Vector3().copy(controls1.target);
      const horizontalDistance = Math.sqrt(
        Math.pow(rawTarget.x - camera1.position.x, 2) +
        Math.pow(rawTarget.z - camera1.position.z, 2)
      );

      // ⭐ 如果 target 距离相机水平方向超过阈值，可能是错误值，需要重新计算
      // ⭐ 修复：提高阈值到 500 米，因为在局部坐标系模式下，target 可能在较远处
      // 避免误判正常的 target 为"太远"
      const MAX_REASONABLE_DISTANCE = 500;

      if (horizontalDistance > MAX_REASONABLE_DISTANCE) {
        console.log('[SyncManager.reinitUnifiedState] ⚠️⚠️⚠️ target 距离相机太远，使用相机方向重新计算!', {
          原始target: `(${rawTarget.x.toFixed(2)}, ${rawTarget.y.toFixed(2)}, ${rawTarget.z.toFixed(2)})`,
          相机位置: `(${camera1.position.x.toFixed(2)}, ${camera1.position.y.toFixed(2)}, ${camera1.position.z.toFixed(2)})`,
          水平距离: horizontalDistance.toFixed(2) + ' 米',
          说明: '在局部坐标模式下，target 应该在相机附近，不应该这么远'
        });

        // ⭐ 关键修复：检查是否为局部坐标系模式
        const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem?.() || false;

        // ⭐ 简化逻辑：直接使用相机方向计算 target，保持一致性
        // ⭐ 修复：使用更大的 reasonableDistance，避免 target 过近导致角度太陡
        // 使用相机高度的 50-80% 作为目标距离，保持合理的俯仰角度
        const reasonableDistance = Math.max(50, Math.min(400, camera1.position.y * 0.6));
        const currentDirection = new THREE.Vector3();
        camera1.getWorldDirection(currentDirection);

        if (isUsingLocalCoord) {
          // ⭐ 关键修复：局部坐标系模式下，target.y 应该始终为 0（地面高度）
          // 这样可以确保地板始终贴地，不会因为target.y的变化而脱离地面
          const targetY = 0;

          // ⭐ 关键修复：target.x 和 target.z 也应该设置为 0，确保旋转中心在原点
          // 这样可以保持地板贴地效果，避免旋转中心改变
          targetPosition = new THREE.Vector3(
            0,  // x = 0
            0,  // y = 0（地面）
            0   // z = 0
          );

          console.log('[SyncManager.reinitUnifiedState] ⭐ 局部坐标系模式：强制target到地面', {
            target: `(${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`,
            相机Y: camera1.position.y.toFixed(2) + '米',
            说明: '保持target在原点(0,0,0)，确保地板贴地'
          });
        } else {
          // 非局部坐标系模式：保持原有逻辑
          targetPosition = new THREE.Vector3(
            camera1.position.x + currentDirection.x * reasonableDistance,
            camera1.position.y + currentDirection.y * reasonableDistance,
            camera1.position.z + currentDirection.z * reasonableDistance
          );
        }

        // ⭐ 同时更新 controls1.target 到这个合理值
        controls1.target.copy(targetPosition);
        console.log('[SyncManager.reinitUnifiedState] ✅✅✅ 已更新 controls1.target 到合理位置:', `(${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
      } else {
        targetPosition = rawTarget;
        console.log('[SyncManager.reinitUnifiedState] ✅ target 距离合理，使用 controls1.target:', {
          target: `(${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`,
          水平距离: horizontalDistance.toFixed(2) + ' 米'
        });
      }
    } else {
      // 备选方案：沿着相机方向推算
      const currentDistance = 500;
      targetPosition = new THREE.Vector3(
        camera1.position.x + currentDirection.x * currentDistance,
        camera1.position.y + currentDirection.y * currentDistance,
        camera1.position.z + currentDirection.z * currentDistance
      );
    }

    // 计算相机到目标的距离
    const currentDistance = camera1.position.distanceTo(targetPosition);

    // 计算从相机到目标的方向
    const directionToTarget = new THREE.Vector3()
      .subVectors(targetPosition, camera1.position)
      .normalize();

    const state = {
      position: {
        x: camera1.position.x,
        y: camera1.position.y,
        z: camera1.position.z
      },
      // ⭐ 直接使用 controls1.target 的值
      target: {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      },
      direction: {
        x: directionToTarget.x,
        y: directionToTarget.y,
        z: directionToTarget.z
      },
      up: { x: 0, y: 1, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      height: currentDistance
    };

    // 限制高度范围
    state.height = Math.max(10, Math.min(50000, state.height));

    // ⭐ 极点翻转保护：检查并限制初始 polarAngle，避免进入极点翻转区域
    // polarAngle = acos(direction.y)，170° 对应 direction.y ≈ -0.985
    const MAX_POLAR_ANGLE = Math.PI * 0.944; // 170°
    const minDirectionY = Math.cos(MAX_POLAR_ANGLE); // cos(170°) ≈ -0.985

    if (state.direction.y < minDirectionY) {
      // direction.y 太小（太接近 -1），说明相机太接近垂直向下
      // 需要调整方向向量，使其向上倾斜到安全范围内

      console.warn('[SyncManager.reinitUnifiedState] ⚠️ 初始相机角度接近极点翻转区域，进行调整:', {
        原始direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        原始polarAngle: `${(Math.acos(state.direction.y) * 180 / Math.PI).toFixed(1)}°`,
        限制: `≤ ${MAX_POLAR_ANGLE * 180 / Math.PI}°`
      });

      // ⭐ 关键修复：直接创建一个安全的 target 和 direction
      // 不依赖原始的 target，因为原始 target 可能在相机正下方

      // 1. 检查相机是否几乎完全垂直向下（没有水平分量）
      const horizontalLength = Math.sqrt(state.direction.x ** 2 + state.direction.z ** 2);

      let newTarget, newDirection, newHeight;

      if (horizontalLength < 0.01) {
        // 相机完全垂直向下：创建一个新的 target，在相机前方并略微向下
        const safeY = minDirectionY + 0.01; // 约 -0.975
        const safeXZ = Math.sqrt(1 - safeY * safeY); // 约 0.224

        // 创建安全的方向向量：指向 -Z 方向，Y 分量为 -0.975（约 167°）
        newDirection = new THREE.Vector3(0, safeY, -safeXZ);

        // 保持相同的 height，计算新的 target
        newTarget = new THREE.Vector3(
          camera1.position.x + newDirection.x * state.height,
          camera1.position.y + newDirection.y * state.height,
          camera1.position.z + newDirection.z * state.height
        );

        newHeight = state.height;

        console.log('[SyncManager.reinitUnifiedState] 完全垂直向下，创建新的方向和目标');
      } else {
        // 有水平分量：调整 Y 分量到安全边界，同时保持水平方向比例
        const safeY = minDirectionY + 0.01;
        const horizontalScale = Math.sqrt(1 - safeY * safeY);
        const scale = Math.sqrt(state.direction.x ** 2 + state.direction.z ** 2);

        newDirection = new THREE.Vector3(
          (state.direction.x / scale) * horizontalScale,
          safeY,
          (state.direction.z / scale) * horizontalScale
        );
        newDirection.normalize();

        // 保持 target 位置不变（如果合理），否则重新计算
        const toOriginalTarget = new THREE.Vector3(
          state.target.x - camera1.position.x,
          state.target.y - camera1.position.y,
          state.target.z - camera1.position.z
        );

        // 如果原始 target 在相机正下方（距离太近），则重新计算
        if (toOriginalTarget.length() < 10) {
          newTarget = new THREE.Vector3(
            camera1.position.x + newDirection.x * state.height,
            camera1.position.y + newDirection.y * state.height,
            camera1.position.z + newDirection.z * state.height
          );
          newHeight = state.height;
        } else {
          // 保持原始 target，重新计算 height
          newTarget = new THREE.Vector3(state.target.x, state.target.y, state.target.z);
          newHeight = camera1.position.distanceTo(newTarget);

          // 重新计算方向，使其指向原始 target
          newDirection.subVectors(newTarget, camera1.position).normalize();
        }

        console.log('[SyncManager.reinitUnifiedState] 调整现有方向到安全范围');
      }

      // 2. 更新 state
      state.direction = {
        x: newDirection.x,
        y: newDirection.y,
        z: newDirection.z
      };

      state.target = {
        x: newTarget.x,
        y: newTarget.y,
        z: newTarget.z
      };

      state.height = newHeight;

      // 3. 更新 controls1
      if (controls1) {
        controls1.target.copy(newTarget);
      }

      console.log('[SyncManager.reinitUnifiedState] ✅ 已调整相机到安全范围:', {
        新direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        新polarAngle: `${(Math.acos(state.direction.y) * 180 / Math.PI).toFixed(1)}°`,
        新height: newHeight.toFixed(2),
        新target: `(${newTarget.x.toFixed(2)}, ${newTarget.y.toFixed(2)}, ${newTarget.z.toFixed(2)})`
      });

      console.log('[SyncManager.reinitUnifiedState] ✅ 已同步更新 controls1.target 和 height');
    }

    // 重建正交基
    this._rebuildOrthonormalBasis(state);

    // 更新 unifiedCameraState
    this.unifiedCameraState = state;

    console.log('[SyncManager] unifiedCameraState 重新初始化完成:', {
      cameraPosition: `(${camera1.position.x.toFixed(2)}, ${camera1.position.y.toFixed(2)}, ${camera1.position.z.toFixed(2)})`,
      controlsTarget: controls1 ? `(${controls1.target.x.toFixed(2)}, ${controls1.target.y.toFixed(2)}, ${controls1.target.z.toFixed(2)})` : 'null',
      position: `(${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`,
      target: `(${state.target.x.toFixed(2)}, ${state.target.y.toFixed(2)}, ${state.target.z.toFixed(2)})`,
      height: state.height.toFixed(2),
      direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`
    });
  }

  /**
   * 向量归一化
   */
  normalizeVector(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len > 0.0001) {
      return {
        x: v.x / len,
        y: v.y / len,
        z: v.z / len
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  /**
   * 将 Cesium 相机状态同步回统一坐标系
   */
  _syncCesiumToUnified(cesiumCamera, cesiumScene, keepTarget = false) {
    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera || !this.floorCenterMercator) {
      console.warn('[SyncManager._syncCesiumToUnified] 跳过同步，缺少必要参数:', {
        hasCesium: !!Cesium,
        hasCamera: !!cesiumCamera,
        hasFloorCenter: !!this.floorCenterMercator
      });
      return;
    }

    // ⭐ 关键修复：将 ellipsoid 和 earthRadius 的声明移到函数顶部
    // 避免在大坐标模式分支中出现 "Cannot access before initialization" 错误
    const ellipsoid = cesiumScene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
    const earthRadius = 6378137.0;

    // ⭐ 局部坐标系模式：同步Cesium相机高度到dual组件
    const isUsingLocalCoord = this.mercatorProjection?.isUsingLocalCoordinateSystem &&
                              this.mercatorProjection.isUsingLocalCoordinateSystem();

    if (isUsingLocalCoord) {
      const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
      const state = this.unifiedCameraState;

      // 获取Cesium相机的绝对高度
      const cesiumHeight = cameraCartographic.height;

      // 获取模型海拔
      const modelAltitude = this.mercatorProjection.modelAbsoluteAltitude || 0;

      // 计算dual相机的相对高度
      const relativeHeight = cesiumHeight - modelAltitude;

      // 更新unifiedCameraState
      state.position.y = relativeHeight;
      state.height = Math.abs(relativeHeight);

      // ⭐ 关键修复：在局部坐标系模式下，确保target指向地面
      // 这样可以保持地板贴地效果
      if (!state.target || state.target.y !== 0) {
        state.target = {
          x: state.position.x || 0,
          y: 0,  // 地面高度为0
          z: state.position.z || 0
        };
        console.log('[SyncManager._syncCesiumToUnified] 局部坐标系：已更新target到地面');
      }

      console.log('[SyncManager._syncCesiumToUnified] 局部坐标系：同步Cesium高度到dual', {
        Cesium高度: cesiumHeight.toFixed(2) + '米',
        模型海拔: modelAltitude.toFixed(2) + '米',
        dual相对高度: relativeHeight.toFixed(2) + '米',
        说明: 'Cesium主导缩放后的高度已同步到dual组件',
        target: `(${state.target.x.toFixed(2)}, ${state.target.y.toFixed(2)}, ${state.target.z.toFixed(2)})`
      });

      // 保持方向同步
      this.mercatorProjection.syncDirectionToCesium?.(
        this.unifiedCameraState,
        cesiumCamera,
        cesiumScene
      );

      return; // 局部坐标系模式下跳过后续的射线求交逻辑
    }

    // ⭐ 关键修复：在大坐标模式下，需要更新 unifiedCameraState.position
    // 但不使用射线求交（因为会失败），直接使用相机正下方的地面点
    // ⚠️ 使用与 syncUnifiedToThree 相同的降低后的阈值
    const LARGE_COORD_THRESHOLD = 1000;
    let isLargeCoordMode = false;

    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer) {
        // ⚠️ 关键修复：禁用所有大坐标模式检测
        // 原因：模型已经被放置在局部墨卡托坐标系原点附近，不再需要大坐标模式
        // 禁用以下检测：
        // 1. 选中了大坐标模型
        // 2. 相机在大坐标位置
        //
        // 只保留真实世界模式的检测（通过 isInRealWorldMode 标志）
        if (dualViewer.isInRealWorldMode) {
          isLargeCoordMode = true;
        }
        // 注释掉的原始代码：
        // // 只检查是否选中了大坐标模型
        // if (dualViewer.hasLargeCoordModelSelected) {
        //   isLargeCoordMode = true;
        // }
        // 注释掉的原始代码：
        // // 相机在大坐标位置的检测
        // else if (dualViewer.camera1 && dualViewer.camera1.position) {
        //   isLargeCoordMode =
        //     Math.abs(dualViewer.camera1.position.x) > LARGE_COORD_THRESHOLD ||
        //     Math.abs(dualViewer.camera1.position.z) > LARGE_COORD_THRESHOLD;
        // }
      }
    }

    if (isLargeCoordMode) {
      console.log('[SyncManager._syncCesiumToUnified] 大坐标模式：使用简化的状态更新（不使用射线求交）');

      // 大坐标模式下的简化更新：
      // 1. 更新 unifiedCameraState.position 为 Cesium 相机的相对墨卡托坐标
      // 2. 更新 unifiedCameraState.height 为相机到目标点的距离
      // 3. 更新 unifiedCameraState.direction 和 up 向量以反映相机的旋转
      // 4. 不使用射线求交（因为在大坐标模式下会失败）

      const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
      const mercatorPosition = {
        x: cameraCartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(cameraCartographic.latitude),
        z: cameraCartographic.height
      };

      // 计算相对位置（相对于地板中心）
      const state = this.unifiedCameraState;
      state.position.x = mercatorPosition.x - this.floorCenterMercator.x;
      state.position.z = -(mercatorPosition.y - this.floorCenterMercator.y);
      state.position.y = mercatorPosition.z;

      // ⭐ 关键修复：更新方向和 up 向量以反映 Cesium 相机的旋转
      // Cesium 的方向向量需要从 ECEF 转换到墨卡托坐标系
      const Cesium = this.getCesium();
      const cameraDirection = cesiumCamera.direction;
      const cameraUp = cesiumCamera.up;

      // 转换方向向量：从 ECEF 到墨卡托（简化版本，只处理方向）
      // 在墨卡托坐标系中：X=东，Y=北，Z=上
      // 需要将 ECEF 方向向量投影到墨卡托坐标系的切平面上

      // 计算当前位置的经纬度
      const longitude = cameraCartographic.longitude;
      const latitude = cameraCartographic.latitude;

      // 简化的转换：只考虑水平方向，忽略垂直分量
      // 将 ECEF 方向向量转换到东北上(ENU)坐标系，然后到墨卡托
      const sinLon = Math.sin(longitude);
      const cosLon = Math.cos(longitude);
      const sinLat = Math.sin(latitude);
      const cosLat = Math.cos(latitude);

      // ECEF 到 ENU 的旋转矩阵
      // ENU: East(x), North(y), Up(z)
      const enuDirection = {
        x: -sinLon * cameraDirection.x + cosLon * cameraDirection.y,
        y: -sinLat * cosLon * cameraDirection.x - sinLat * sinLon * cameraDirection.y + cosLat * cameraDirection.z,
        z: cosLat * cosLon * cameraDirection.x + cosLat * sinLon * cameraDirection.y + sinLat * cameraDirection.z
      };

      // ⭐ 关键修复：ENU 到墨卡托的正确映射
      // ENU: East(x), North(y), Up(z)
      // 墨卡托: X=东, Y=高度(上), Z=南（与北相反）
      // 注意：墨卡托的 Z 轴方向是向南，与 ENU 的北方向相反
      state.direction = {
        x: enuDirection.x,   // 东 → 东
        y: enuDirection.z,   // 上 → 高度
        z: -enuDirection.y   // 北 → 南（取反）
      };

      // 归一化方向向量
      const dirLen = Math.sqrt(state.direction.x ** 2 + state.direction.y ** 2 + state.direction.z ** 2);
      if (dirLen > 0.0001) {
        state.direction.x /= dirLen;
        state.direction.y /= dirLen;
        state.direction.z /= dirLen;
      }

      // 同样转换 up 向量
      const enuUp = {
        x: -sinLon * cameraUp.x + cosLon * cameraUp.y,
        y: -sinLat * cosLon * cameraUp.x - sinLat * sinLon * cameraUp.y + cosLat * cameraUp.z,
        z: cosLat * cosLon * cameraUp.x + cosLat * sinLon * cameraUp.y + sinLat * cameraUp.z
      };

      state.up = {
        x: enuUp.x,   // 东 → 东
        y: enuUp.z,   // 上 → 高度
        z: -enuUp.y   // 北 → 南（取反）
      };

      // 归一化 up 向量
      const upLen = Math.sqrt(state.up.x ** 2 + state.up.y ** 2 + state.up.z ** 2);
      if (upLen > 0.0001) {
        state.up.x /= upLen;
        state.up.y /= upLen;
        state.up.z /= upLen;
      }

      // ⭐ 关键修复：重建正交基，确保 direction, up, right 互相正交
      // ENU 转换后的向量可能不再正交，需要重建
      this._rebuildOrthonormalBasis();

      // ⭐ 关键修复：使用射线求交获取目标点（与正常模式一致）
      // 不使用公式计算，因为公式在大坐标模式下可能不准确
      let targetCartographic;
      try {
        // 使用相机正下方的地面点作为目标
        targetCartographic = Cesium.Cartographic.fromRadians(
          cameraCartographic.longitude,
          cameraCartographic.latitude,
          0  // 地面高度为 0
        );
      } catch (e) {
        console.warn('[SyncManager._syncCesiumToUnified] 计算目标点失败:', e);
        // 降级：使用相机位置作为参考
        targetCartographic = cameraCartographic;
      }

      // 转换为墨卡托坐标
      const mercatorTarget = {
        x: targetCartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(targetCartographic.latitude),
        z: 0
      };

      // 更新 target（相对地板中心的坐标）
      state.target = {
        x: mercatorTarget.x - this.floorCenterMercator.x,
        y: 0,  // 目标点在地面上（统一坐标系的 Y = 0）
        z: -(mercatorTarget.y - this.floorCenterMercator.y)
      };

      // ⭐ 关键修复：计算相机到目标点的距离
      // 在大坐标模式下，目标点是模型的实际高度（从地板中心 originalFloorHeight 获取）
      const modelHeight = this.floorCenterMercator?.originalFloorHeight || 0;
      // state.height 应该是相机到目标点的距离，而不是相机的绝对高度
      state.height = Math.max(1, cameraCartographic.height - modelHeight);

      console.log('[SyncManager._syncCesiumToUnified] 大坐标模式：已更新统一坐标系状态', {
        cameraHeight: cameraCartographic.height.toFixed(2),
        modelHeight: modelHeight.toFixed(2),
        stateHeight: state.height.toFixed(2),
        statePosition: `(${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`,
        stateDirection: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        stateUp: `(${state.up.x.toFixed(3)}, ${state.up.y.toFixed(3)}, ${state.up.z.toFixed(3)})`,
        stateTarget: `(${state.target.x.toFixed(2)}, ${state.target.y.toFixed(2)}, ${state.target.z.toFixed(2)})`,
        stateRight: `(${state.right.x.toFixed(3)}, ${state.right.y.toFixed(3)}, ${state.right.z.toFixed(3)})`
      });

      return; // 大坐标模式下跳过后续的射线求交逻辑
    }

    // ⭐ 新增：ENU 模式检查
    // ENU 模式下，Three.js 使用本地坐标系（小坐标），与 Cesium 的坐标系统不一致
    // 射线求交在 ENU 模式下会失败，因此直接使用相机正下方的地面点
    let isENUMode = false;
    if (window.__dualCanvasViewerInstances && window.__dualCanvasViewerInstances.length > 0) {
      const dualViewer = window.__dualCanvasViewerInstances[0];
      if (dualViewer && dualViewer.usingENU) {
        isENUMode = true;
        console.log('[SyncManager._syncCesiumToUnified] ENU 模式：检测到 ENU 坐标系统，跳过射线求交');
      }
    }

    const state = this.unifiedCameraState;
    // ellipsoid 和 earthRadius 已在函数顶部声明，不再重复声明

    try {
      const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);

      if (!cameraCartographic ||
          typeof cameraCartographic.longitude === 'undefined' ||
          typeof cameraCartographic.latitude === 'undefined') {
        return;
      }

      const mercatorPosition = {
        x: cameraCartographic.longitude * earthRadius,
        y: this.surfaceHandler.latitudeToMercator(cameraCartographic.latitude),
        z: cameraCartographic.height
      };

      // 转换到统一坐标系
      state.position.x = mercatorPosition.x - this.floorCenterMercator.x;
      state.position.z = -(mercatorPosition.y - this.floorCenterMercator.y);
      // 对于平移和缩放操作，直接使用 Cesium 的真实高度
      state.position.y = mercatorPosition.z;

      console.log('[SyncManager._syncCesiumToUnified] 更新统一坐标系位置:', {
        cameraHeight: cameraCartographic.height.toFixed(2),
        mercatorPositionZ: mercatorPosition.z.toFixed(2),
        statePositionY: state.position.y.toFixed(2),
        floorCenterMercator: this.floorCenterMercator,
        keepTarget: keepTarget
      });

      if (!keepTarget) {
        let targetCartographic;

        try {
          // ⚠️ 关键修复：使用相机方向向量而不是位置向量来计算目标点
          // 修复前：归一化相机位置向量，但位置向量不代表相机朝向
          // 修复后：直接使用相机方向向量，更准确地反映相机的实际朝向
          let cameraDirection;
          let directionValid = false;

          try {
            // 验证相机方向向量是否有效
            cameraDirection = cesiumCamera.direction;
            directionValid = Cesium.defined(cameraDirection) &&
              isFinite(cameraDirection.x) && isFinite(cameraDirection.y) && isFinite(cameraDirection.z) &&
              !isNaN(cameraDirection.x) && !isNaN(cameraDirection.y) && !isNaN(cameraDirection.z);

            // 检查方向向量的长度是否合理（应该接近1，因为是归一化的）
            if (directionValid) {
              const dirMagnitude = Math.sqrt(
                cameraDirection.x * cameraDirection.x +
                cameraDirection.y * cameraDirection.y +
                cameraDirection.z * cameraDirection.z
              );
              directionValid = dirMagnitude > 0.001 && dirMagnitude < 1000;
            }
          } catch (e) {
            directionValid = false;
          }

          if (!directionValid) {
            // ⚠️ 降级方案：方向向量无效，使用相机正下方的地面点
            // 但记录日志以便调试
            console.warn('[SyncManager._syncCesiumToUnified] 相机方向向量无效，使用正下方地面点作为目标:', {
              direction: cameraDirection,
              cameraPosition: cesiumCamera.position
            });
            targetCartographic = Cesium.Cartographic.fromRadians(
              cameraCartographic.longitude,
              cameraCartographic.latitude,
              0
            );
          } else {
            // ⭐ ENU 模式检查：跳过射线求交，直接使用相机正下方的地面点
            if (isENUMode) {
              console.log('[SyncManager._syncCesiumToUnified] ENU 模式：跳过射线求交，使用正下方地面点');
              targetCartographic = Cesium.Cartographic.fromRadians(
                cameraCartographic.longitude,
                cameraCartographic.latitude,
                0
              );
            } else {
              // ✅ 关键修复：使用有效的方向向量进行射线求交
              // 计算射线与地球椭球面的交点
              const isUnderground = cameraCartographic.height < 0;
              const isLookingDown = cesiumCamera.direction.y < 0;

              // ⚠️ 改进：使用up向量来判断射线是否指向地球
              // up向量是从地球表面指向外部的，与position方向相同
              const dotProduct = Cesium.Cartesian3.dot(
                Cesium.Cartesian3.normalize(cesiumCamera.position, new Cesium.Cartesian3()),
                cesiumCamera.direction
              );
              const isRayPointingToEarth = isUnderground ? isLookingDown : (dotProduct < 0);

              if (isRayPointingToEarth) {
                // 射线指向地球，尝试求交
                try {
                  const ray = new Cesium.Ray(cesiumCamera.position, cesiumCamera.direction);
                  const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
                  if (Cesium.defined(targetPosition) &&
                      isFinite(targetPosition.x) && isFinite(targetPosition.y) && isFinite(targetPosition.z)) {
                    targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
                    console.log('[SyncManager._syncCesiumToUnified] 射线求交成功:', {
                      targetHeight: targetCartographic.height.toFixed(2)
                    });
                  } else {
                    // 求交失败，使用相机正下方地面点
                    console.warn('[SyncManager._syncCesiumToUnified] 射线求交返回无效结果，使用正下方地面点');
                    targetCartographic = Cesium.Cartographic.fromRadians(
                      cameraCartographic.longitude,
                      cameraCartographic.latitude,
                      0
                    );
                  }
                } catch (e) {
                  console.error('[SyncManager._syncCesiumToUnified] 射线求交异常:', e);
                  targetCartographic = Cesium.Cartographic.fromRadians(
                    cameraCartographic.longitude,
                    cameraCartographic.latitude,
                    0
                  );
                }
              } else {
                // 射线不指向地球（如仰望天空），使用正下方地面点
                console.log('[SyncManager._syncCesiumToUnified] 射线不指向地球，使用正下方地面点');
                targetCartographic = Cesium.Cartographic.fromRadians(
                  cameraCartographic.longitude,
                  cameraCartographic.latitude,
                  0
                );
              }
            }
          }
        } catch (e) {
          const isValidLonLat = isFinite(cameraCartographic.longitude) &&
                                isFinite(cameraCartographic.latitude) &&
                                !isNaN(cameraCartographic.longitude) &&
                                !isNaN(cameraCartographic.latitude);

          if (isValidLonLat) {
            targetCartographic = Cesium.Cartographic.fromRadians(
              cameraCartographic.longitude,
              cameraCartographic.latitude,
              0
            );
          } else {
            return;
          }
        }

        const isValidNumber = (val) => typeof val === 'number' && isFinite(val) && !isNaN(val);

        if (!targetCartographic ||
            !isValidNumber(targetCartographic.longitude) ||
            !isValidNumber(targetCartographic.latitude) ||
            !isValidNumber(targetCartographic.height)) {
          return;
        }

        const mercatorTarget = {
          x: targetCartographic.longitude * earthRadius,
          y: this.surfaceHandler.latitudeToMercator(targetCartographic.latitude),
          z: 0
        };

        state.target.x = mercatorTarget.x - this.floorCenterMercator.x;
        state.target.z = -(mercatorTarget.y - this.floorCenterMercator.y);
        state.target.y = 0;
      }

      // 更新高度
      const targetCartesian = Cesium.Cartesian3.fromRadians(
        cameraCartographic.longitude,
        cameraCartographic.latitude,
        0
      );
      const distance = Cesium.Cartesian3.distance(cesiumCamera.position, targetCartesian);
      state.height = distance;

    } catch (error) {
      console.error('[SyncManager] _syncCesiumToUnified 失败:', error);
    }
  }

  // ==================== Cesium 鼠标坐标管理 ====================

  setCesiumMouseMercator(mercator) {
    this.cesiumMouseMercator = mercator;
  }

  getCesiumMouseMercator() {
    return this.cesiumMouseMercator;
  }

  // ==================== 地板方向计算 ====================

  calculateSurfaceNormal(targetCartographic, ellipsoid) {
    const Cesium = this.getCesium();
    if (!Cesium || !targetCartographic || !ellipsoid) {
      return { x: 0, y: 1, z: 0 };
    }

    try {
      const surfacePoint = ellipsoid.cartographicToCartesian(targetCartographic);
      const normal = Cesium.Cartesian3.normalize(surfacePoint, new Cesium.Cartesian3());

      return {
        x: normal.x,
        y: normal.z,
        z: -normal.y
      };
    } catch (error) {
      console.error('[SyncManager] calculateSurfaceNormal 失败:', error);
      return { x: 0, y: 1, z: 0 };
    }
  }

  calculateFloorQuaternion(normal) {
    const up = new THREE.Vector3(0, 1, 0);
    const targetNormal = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const quaternion = new THREE.Quaternion();

    const dotProduct = up.dot(targetNormal);

    if (dotProduct < -0.9999) {
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    } else {
      quaternion.setFromUnitVectors(up, targetNormal);
    }

    return {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w
    };
  }

  // ==================== 重置 ====================

  /**
   * 验证并修正统一坐标系状态
   * 当检测到异常状态时，自动修正为合理值
   */
  validateAndFixUnifiedState() {
    const state = this.unifiedCameraState;
    let fixed = false;

    // ⚠️ 关键修复：添加高度异常检测和累积误差修正
    const now = Date.now();
    const timeSinceLastSync = now - this.heightTracker.lastSyncTime;

    // 验证高度基本范围
    if (state.height < 10 || state.height > 50000 || !isFinite(state.height)) {
      console.warn('⚠️ [SyncManager] 验证检测到异常高度，正在修正:', {
        originalHeight: state.height
      });
      state.height = Math.max(10, Math.min(50000, state.height || 500));
      fixed = true;
    }

    // ⚠️ 检测高度异常变化（累积误差）
    if (this.heightTracker.lastValidHeight !== null && timeSinceLastSync > this.heightTracker.minSyncInterval) {
      const heightChange = Math.abs(state.height - this.heightTracker.lastValidHeight);
      const heightChangeRatio = heightChange / this.heightTracker.lastValidHeight;

      // 如果高度变化超过阈值，可能是累积误差
      if (heightChangeRatio > this.heightTracker.anomalyThreshold) {
        this.heightTracker.consecutiveAnomalies++;

        console.warn('⚠️ [SyncManager] 检测到高度异常变化（可能的累积误差）:', {
          当前高度: state.height.toFixed(2),
          上次有效高度: this.heightTracker.lastValidHeight.toFixed(2),
          变化量: heightChange.toFixed(2),
          变化率: (heightChangeRatio * 100).toFixed(2) + '%',
          连续异常次数: this.heightTracker.consecutiveAnomalies
        });

        // 如果连续异常次数超过阈值，强制修正
        if (this.heightTracker.consecutiveAnomalies >= this.heightTracker.maxAnomalies) {
          console.error('🚨 [SyncManager] 连续异常次数超过阈值，强制修正高度:', {
            原始高度: state.height.toFixed(2),
            修正为: this.heightTracker.lastValidHeight.toFixed(2)
          });
          state.height = this.heightTracker.lastValidHeight;
          this.heightTracker.consecutiveAnomalies = 0;
          fixed = true;
        }
      } else {
        // 高度变化正常，重置异常计数
        this.heightTracker.consecutiveAnomalies = 0;
      }
    }

    // 更新高度历史
    this.heightTracker.history.push({
      height: state.height,
      timestamp: now
    });

    // 限制历史记录大小
    if (this.heightTracker.history.length > this.heightTracker.maxHistorySize) {
      this.heightTracker.history.shift();
    }

    // 更新上次有效高度
    if (isFinite(state.height) && state.height >= 10 && state.height <= 50000) {
      this.heightTracker.lastValidHeight = state.height;
    }

    this.heightTracker.lastSyncTime = now;

    // 验证 position.y
    if (!isFinite(state.position.y) || Math.abs(state.position.y) > 50000) {
      console.warn('⚠️ [SyncManager] 验证检测到异常 position.y，正在修正:', {
        originalY: state.position.y
      });
      // 保持地下/地上状态，但限制在合理范围
      const wasUnderground = state.position.y < 0;
      state.position.y = wasUnderground ? -500 : 500;
      fixed = true;
    }

    // 验证 target.y
    if (!isFinite(state.target.y) || Math.abs(state.target.y) > 1000) {
      console.warn('⚠️ [SyncManager] 验证检测到异常 target.y，正在修正:', {
        originalTargetY: state.target.y
      });
      state.target.y = 0;
      fixed = true;
    }

    // 验证方向向量
    const dirLength = Math.sqrt(
      state.direction.x ** 2 +
      state.direction.y ** 2 +
      state.direction.z ** 2
    );
    if (!isFinite(dirLength) || dirLength < 0.001) {
      console.warn('⚠️ [SyncManager] 验证检测到异常方向向量，正在重置');
      state.direction = { x: 0, y: -1, z: 0 };
      state.up = { x: 0, y: 1, z: 0 };
      state.right = { x: 1, y: 0, z: 0 };
      fixed = true;
    }

    if (fixed) {
      console.info('✅ [SyncManager] 统一状态已修正');
      // 重建正交基以确保一致性
      this._rebuildOrthonormalBasis();
    }

    return fixed;
  }

  reset() {
    this.syncDepth = 0;
    this.throttleTimer = null;
  }
}

// ⚠️ 不再导出单例实例
// SyncManager 应该由 DualCanvasViewer 插件内部创建和管理
// 宿主项目不应该直接创建 SyncManager 实例
// export const syncManager = new SyncManager(); // 已移除单例导出

// ==================== 全局辅助函数 ====================

/**
 * 安全地设置 Cesium 实例到 SyncManager
 * 这是一个全局辅助函数，供外部应用使用
 * 它会检查 SyncManager 是否已初始化，避免初始化顺序问题
 *
 * @param {Object} Cesium - Cesium 构造函数或实例
 * @returns {boolean} 是否成功设置
 *
 * @example
 * // 等待 DualCanvasViewer 初始化完成后再设置 Cesium
 * function initCesium() {
 *   if (window.__dualCanvasViewerReady__ && window.__syncManager__) {
 *     return safeSetCesium(window.Cesium);
 *   } else {
 *     console.warn('DualCanvasViewer 未初始化，等待...');
 *     setTimeout(initCesium, 100);
 *   }
 * }
 */
function safeSetCesium(Cesium) {
  try {
    // 检查 SyncManager 是否可用
    if (!window.__syncManager__) {
      console.warn('[safeSetCesium] SyncManager 未初始化，请确保 DualCanvasViewer 已加载');
      return false;
    }

    // 检查 Cesium 参数
    if (!Cesium) {
      console.error('[safeSetCesium] Cesium 参数为空');
      return false;
    }

    // 设置 Cesium 实例
    window.__syncManager__.setCesium(Cesium);
    console.log('[safeSetCesium] ✓ Cesium 实例已成功设置到 SyncManager');
    return true;
  } catch (error) {
    console.error('[safeSetCesium] 设置 Cesium 实例时出错:', error);
    return false;
  }
}

/**
 * 等待 DualCanvasViewer 初始化完成后执行回调
 * 这是一个全局辅助函数，供外部应用使用
 *
 * @param {Function} callback - 初始化完成后要执行的回调函数
 * @param {number} timeout - 超时时间（毫秒），默认 10 秒
 * @returns {Promise<boolean>} 是否成功初始化
 *
 * @example
 * waitForDualCanvasViewer(() => {
 *   window.__syncManager__.setCesium(window.Cesium);
 * }).then(success => {
 *   if (success) {
 *     console.log('初始化成功');
 *   } else {
 *     console.error('初始化超时');
 *   }
 * });
 */
function waitForDualCanvasViewer(callback, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function check() {
      // 检查初始化完成标志
      if (window.__dualCanvasViewerReady__ && window.__syncManager__) {
        try {
          callback();
          resolve(true);
        } catch (error) {
          console.error('[waitForDualCanvasViewer] 回调执行失败:', error);
          reject(error);
        }
        return;
      }

      // 检查超时
      if (Date.now() - startTime > timeout) {
        console.error('[waitForDualCanvasViewer] 等待 DualCanvasViewer 初始化超时');
        resolve(false);
        return;
      }

      // 继续等待
      setTimeout(check, 100);
    }

    check();
  });
}

// 将辅助函数暴露到全局
if (typeof window !== 'undefined') {
  window.safeSetCesium = safeSetCesium;
  window.waitForDualCanvasViewer = waitForDualCanvasViewer;
}
