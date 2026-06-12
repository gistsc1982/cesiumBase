/**
 * 统一坐标参考系统
 *
 * 为 DualCanvasViewer 提供统一的坐标计算基准，使用虚拟视口容器作为参考系，
 * 支持当前层（层1、层2）和未来地图层（层0）的坐标一致性，并支持 Web Mercator (EPSG:3857) 地理坐标系。
 */

import * as THREE from 'three';

// ============================================================
// VirtualViewport - 虚拟视口容器
// ============================================================

/**
 * 虚拟视口容器类
 *
 * 提供统一的坐标计算基准，不依赖具体 DOM 元素。
 * 基于所有容器的最大值创建逻辑参考系。
 */
class VirtualViewport {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.left = 0;
    this.top = 0;
    this.worldScale = 1.0; // 世界坐标缩放因子
    this._containers = []; // 注册的容器列表
    this._dirty = true; // 标记是否需要更新
  }

  /**
   * 注册一个容器
   * @param {HTMLElement} container - DOM 容器元素
   */
  registerContainer(container) {
    if (!container) {
      console.warn('[VirtualViewport] 尝试注册空容器');
      return;
    }

    if (!this._containers.includes(container)) {
      this._containers.push(container);
      this._dirty = true;
      console.log('[VirtualViewport] 注册容器:', container.className || container.tagName);
    }
  }

  /**
   * 注销一个容器
   * @param {HTMLElement} container - DOM 容器元素
   */
  unregisterContainer(container) {
    const index = this._containers.indexOf(container);
    if (index !== -1) {
      this._containers.splice(index, 1);
      this._dirty = true;
      console.log('[VirtualViewport] 注销容器:', container.className || container.tagName);
    }
  }

  /**
   * 更新虚拟视口尺寸
   * 基于所有注册容器的最大值
   */
  update() {
    if (!this._dirty && this.width > 0 && this.height > 0) {
      return; // 没有变化，跳过更新
    }

    if (this._containers.length === 0) {
      console.warn('[VirtualViewport] 没有注册的容器，使用窗口尺寸');
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.left = 0;
      this.top = 0;
      return;
    }

    // 计算所有容器的最大尺寸和位置
    let maxWidth = 0;
    let maxHeight = 0;
    let minLeft = Infinity;
    let minTop = Infinity;

    for (const container of this._containers) {
      const rect = container.getBoundingClientRect();
      maxWidth = Math.max(maxWidth, rect.width);
      maxHeight = Math.max(maxHeight, rect.height);
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
    }

    // 更新虚拟视口参数
    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = maxWidth;
    this.height = maxHeight;
    this.left = minLeft;
    this.top = minTop;

    this._dirty = false;

    // 只在尺寸真正变化时输出日志
    if (oldWidth !== this.width || oldHeight !== this.height) {
      console.log('[VirtualViewport] 更新尺寸:', {
        width: this.width,
        height: this.height,
        left: this.left,
        top: this.top,
        containers: this._containers.length
      });
    }
  }

  /**
   * 标记需要重新计算
   */
  markDirty() {
    this._dirty = true;
  }

  /**
   * 获取虚拟视口的包围盒
   * @returns {Object} { left, top, width, height }
   */
  getBounds() {
    this.update();
    return {
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height
    };
  }

  /**
   * 获取虚拟视口的中心点
   * @returns {Object} { x, y }
   */
  getCenter() {
    this.update();
    return {
      x: this.left + this.width / 2,
      y: this.top + this.height / 2
    };
  }

  /**
   * 检查点是否在虚拟视口内
   * @param {number} x - 屏幕 X 坐标
   * @param {number} y - 屏幕 Y 坐标
   * @returns {boolean}
   */
  contains(x, y) {
    this.update();
    return x >= this.left && x <= this.left + this.width &&
           y >= this.top && y <= this.top + this.height;
  }
}

// ============================================================
// CoordinateConverter - 坐标转换工具
// ============================================================

/**
 * 坐标转换工具类
 *
 * 提供各种坐标系统之间的转换功能。
 */
class CoordinateConverter {
  constructor(virtualViewport) {
    this.virtualViewport = virtualViewport;

    // Web Mercator (EPSG:3857) 参数
    this.EPSG3857 = {
      radius: 6378137, // 地球半径（米）
      maxLatitude: 85.0511287798, // 最大纬度
      originShift: 2 * Math.PI * 6378137 / 2 // 原点偏移
    };

    // Three.js 世界坐标缩放因子（用于将真实世界坐标映射到 Three.js 坐标系）
    this.worldScaleFactor = 1.0 / 1000; // 默认：1000 米 = 1 Three.js 单位
  }

  /**
   * 设置世界坐标缩放因子
   * @param {number} scaleFactor - 缩放因子（例如：1/1000 表示 1000 米 = 1 单位）
   */
  setWorldScaleFactor(scaleFactor) {
    this.worldScaleFactor = scaleFactor;
    this.virtualViewport.worldScale = 1.0 / scaleFactor;
    console.log('[CoordinateConverter] 设置世界缩放因子:', scaleFactor);
  }

  // ============================================================
  // Cesium SyncManager 集成
  // ============================================================

  /**
   * 设置 Cesium SyncManager
   * 当设置了 SyncManager 后，坐标转换将优先使用 SyncManager 的方法
   * @param {Object} syncManager - SyncManager 实例
   */
  setCesiumSyncManager(syncManager) {
    this._cesiumSyncManager = syncManager;
    console.log('[CoordinateConverter] Cesium SyncManager 已设置');

    // 当 SyncManager 可用时，更新世界缩放因子为 1:1（1米 = 1单位）
    // SyncManager 使用的是 1:1 比例系统
    if (syncManager && syncManager.scale !== undefined) {
      this.setWorldScaleFactor(1.0 / syncManager.scale);
      console.log('[CoordinateConverter] 使用 SyncManager 的缩放比例:', syncManager.scale);
    }
  }

  /**
   * 获取 Cesium SyncManager
   * @returns {Object|null} SyncManager 实例
   */
  getCesiumSyncManager() {
    // 优先使用实例的 SyncManager
    if (this._cesiumSyncManager) {
      return this._cesiumSyncManager;
    }
    // 降级：尝试从全局获取
    if (typeof window !== 'undefined' && window.__syncManager__) {
      return window.__syncManager__;
    }
    return null;
  }

  // ============================================================
  // ENU 坐标系集成
  // ============================================================

  /**
   * 设置 ENU 坐标管理器
   * 当设置了 ENU 管理器后，坐标转换将优先使用 ENU 坐标系
   * @param {Object} enuManager - ENUCoordinateManager 实例
   */
  setENUManager(enuManager) {
    this._enuManager = enuManager;
    console.log('[CoordinateConverter] ENU 坐标管理器已设置');

    // 当 ENU 管理器可用时，更新世界缩放因子为 1:1（1米 = 1单位）
    // ENU 坐标系使用的是 1:1 比例系统
    if (enuManager && enuManager.scale !== undefined) {
      this.setWorldScaleFactor(1.0 / enuManager.scale);
      console.log('[CoordinateConverter] 使用 ENU 坐标系的缩放比例:', enuManager.scale);
    }
  }

  /**
   * 获取 ENU 坐标管理器
   * @returns {Object|null} ENUCoordinateManager 实例
   */
  getENUManager() {
    // 优先使用实例的 ENU 管理器
    if (this._enuManager) {
      return this._enuManager;
    }
    // 降级：尝试从全局获取
    if (typeof window !== 'undefined' && window.__enuCoordinateManager__) {
      return window.__enuCoordinateManager__;
    }
    return null;
  }

  /**
   * 检查是否使用 ENU 坐标系
   * @returns {boolean}
   */
  isUsingENU() {
    const enuManager = this.getENUManager();
    return enuManager && enuManager.isInitialized && enuManager.isInitialized();
  }

  // ============================================================
  // 屏幕坐标转换
  // ============================================================

  /**
   * 屏幕像素坐标 → 虚拟视口 NDC 坐标
   * @param {number} screenX - 屏幕 X 像素坐标
   * @param {number} screenY - 屏幕 Y 像素坐标
   * @returns {Object} { x, y } NDC 坐标（范围 -1 到 1）
   */
  screenToViewportNDC(screenX, screenY) {
    let bounds = this.virtualViewport.getBounds();

    // 如果虚拟视口尺寸无效，强制重新计算
    if (bounds.width === 0 || bounds.height === 0) {
      console.warn('[CoordinateConverter] 虚拟视口尺寸无效，强制重新计算');
      this.virtualViewport.markDirty();
      bounds = this.virtualViewport.getBounds();
    }

    // 如果仍然无效，使用窗口尺寸作为降级方案
    if (bounds.width === 0 || bounds.height === 0) {
      console.warn('[CoordinateConverter] 虚拟视口仍然无效，使用窗口尺寸作为降级方案');
      bounds.width = window.innerWidth;
      bounds.height = window.innerHeight;
      bounds.left = 0;
      bounds.top = 0;
    }

    // 计算相对于虚拟视口的坐标
    const relativeX = screenX - bounds.left;
    const relativeY = screenY - bounds.top;

    // 转换为 NDC（-1 到 1）
    const ndcX = (relativeX / bounds.width) * 2 - 1;
    const ndcY = -(relativeY / bounds.height) * 2 + 1; // Y 轴翻转

    // 检查结果是否有效
    if (!isFinite(ndcX) || !isFinite(ndcY)) {
      console.error('[CoordinateConverter] 坐标转换结果无效:', {
        screenX, screenY,
        bounds,
        ndcX, ndcY
      });
      return { x: 0, y: 0 };
    }

    return { x: ndcX, y: ndcY };
  }

  /**
   * 虚拟视口 NDC 坐标 → 屏幕像素坐标
   * @param {number} ndcX - NDC X 坐标（-1 到 1）
   * @param {number} ndcY - NDC Y 坐标（-1 到 1）
   * @returns {Object} { x, y } 屏幕像素坐标
   */
  viewportNDCToScreen(ndcX, ndcY) {
    const bounds = this.virtualViewport.getBounds();

    // 从 NDC 转换为相对坐标
    const relativeX = (ndcX + 1) / 2 * bounds.width;
    const relativeY = (-ndcY + 1) / 2 * bounds.height;

    // 转换为绝对屏幕坐标
    return {
      x: relativeX + bounds.left,
      y: relativeY + bounds.top
    };
  }

  // ============================================================
  // Three.js 世界坐标转换
  // ============================================================

  /**
   * 虚拟视口 NDC 坐标 → Three.js 世界坐标
   * @param {number} ndcX - NDC X 坐标（-1 到 1）
   * @param {number} ndcY - NDC Y 坐标（-1 到 1）
   * @param {number} depth - 深度值（默认 0.5，对应相机 near-far 中点）
   * @param {THREE.Camera} camera - Three.js 相机
   * @returns {THREE.Vector3} 世界坐标
   */
  viewportNDCToWorld(ndcX, ndcY, depth = 0.5, camera) {
    if (!camera) {
      console.warn('[CoordinateConverter] camera 参数为空，返回原点');
      return new THREE.Vector3(0, 0, 0);
    }

    // ⚠️ 关键修复：在反投影之前，强制更新相机的矩阵世界和投影矩阵
    // 这确保在相机位置变化后，坐标转换系统能立即使用新的相机状态
    // 修复切换到真实世界模式后，坐标显示不正确的问题
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // 创建 NDC 向量
    const ndcVector = new THREE.Vector3(ndcX, ndcY, depth);

    // 反投影到世界坐标
    ndcVector.unproject(camera);

    // ⚠️ 使用不会被 Terser 移除的调试方法（存储到全局变量）
    if (typeof window !== 'undefined' && window.__viewportNDCToWorldDebug__) {
      const debugInfo = {
        timestamp: Date.now(),
        ndc: { x: ndcX, y: ndcY, z: depth },
        world: { x: ndcVector.x, y: ndcVector.y, z: ndcVector.z },
        cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      };
      window.__viewportNDCToWorldDebug__.push(debugInfo);

      // 只保留最近 100 条记录
      if (window.__viewportNDCToWorldDebug__.length > 100) {
        window.__viewportNDCToWorldDebug__.shift();
      }
    }

    return ndcVector;
  }

  /**
   * Three.js 世界坐标 → 虚拟视口 NDC 坐标
   * @param {THREE.Vector3} worldPosition - 世界坐标
   * @param {THREE.Camera} camera - Three.js 相机
   * @returns {Object} { x, y } NDC 坐标（-1 到 1）
   */
  worldToViewportNDC(worldPosition, camera) {
    if (!camera) {
      console.warn('[CoordinateConverter] camera 参数为空，返回中心 NDC');
      return { x: 0, y: 0 };
    }

    // ⚠️ 关键修复：在投影之前，强制更新相机的矩阵世界和投影矩阵
    // 这确保在相机位置变化后，坐标转换系统能立即使用新的相机状态
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    // 克隆位置以避免修改原始值
    const position = worldPosition.clone();

    // 投影到 NDC 空间
    position.project(camera);

    return { x: position.x, y: position.y };
  }

  /**
   * Three.js 世界坐标 → 屏幕像素坐标
   * @param {THREE.Vector3} worldPosition - 世界坐标
   * @param {THREE.Camera} camera - Three.js 相机
   * @returns {Object} { x, y } 屏幕像素坐标
   */
  worldToScreen(worldPosition, camera) {
    const ndc = this.worldToViewportNDC(worldPosition, camera);
    return this.viewportNDCToScreen(ndc.x, ndc.y);
  }

  // ============================================================
  // Web Mercator (EPSG:3857) 地理坐标转换
  // ============================================================

  /**
   * 经纬度 (WGS84) → Web Mercator (EPSG:3857)
   * @param {number} longitude - 经度（度）
   * @param {number} latitude - 纬度（度）
   * @returns {Object} { x, y } Web Mercator 坐标（米）
   */
  lonLatToWebMercator(longitude, latitude) {
    const { radius, maxLatitude, originShift } = this.EPSG3857;

    // 限制纬度范围
    const lat = Math.max(Math.min(latitude, maxLatitude), -maxLatitude);

    // 转换为弧度
    const lonRad = longitude * Math.PI / 180;
    const latRad = lat * Math.PI / 180;

    // Web Mercator 投影公式
    const x = lonRad * radius;
    const y = Math.log(Math.tan(Math.PI / 4 + latRad / 2)) * radius;

    return {
      x: x + originShift,
      y: y + originShift
    };
  }

  /**
   * Web Mercator (EPSG:3857) → 经纬度 (WGS84)
   * @param {number} x - Web Mercator X 坐标（米）
   * @param {number} y - Web Mercator Y 坐标（米）
   * @returns {Object} { longitude, latitude } 经纬度（度）
   */
  webMercatorToLonLat(x, y) {
    const { radius, originShift } = this.EPSG3857;

    // 减去原点偏移
    const xOffset = x - originShift;
    const yOffset = y - originShift;

    // 反投影公式
    const lonRad = xOffset / radius;
    const latRad = 2 * (Math.atan(Math.exp(yOffset / radius)) - Math.PI / 4);

    // 转换为度
    const longitude = lonRad * 180 / Math.PI;
    const latitude = latRad * 180 / Math.PI;

    return {
      longitude,
      latitude
    };
  }

  /**
   * Web Mercator (EPSG:3857) → Three.js 世界坐标
   * 优先使用 Cesium SyncManager 进行转换（如果可用）
   * @param {number} x - Web Mercator X 坐标（米）
   * @param {number} y - Web Mercator Y 坐标（米）
   * @param {number} altitude - 高程（米，默认 0）
   * @returns {THREE.Vector3} Three.js 世界坐标
   */
  webMercatorToWorld(x, y, altitude = 0) {
    // 优先使用 Cesium SyncManager（如果可用且已配置地板中心）
    const syncManager = this.getCesiumSyncManager();
    if (syncManager && syncManager.floorCenterMercator && syncManager.mercatorToThree) {
      // ⚠️ 关键修复：输入的 x, y 是 EPSG:3857 坐标（带 originShift）
      // 需要转换为绝对墨卡托坐标（不带 originShift）才能传给 SyncManager
      const { originShift } = this.EPSG3857;
      const absMercatorX = x - originShift;
      const absMercatorY = y - originShift;
      const threeCoords = syncManager.mercatorToThree(absMercatorX, absMercatorY, altitude);
      return new THREE.Vector3(threeCoords.x, threeCoords.y, threeCoords.z);
    }

    // 降级：使用内置的 Web Mercator 转换
    const { originShift } = this.EPSG3857;

    // 减去原点偏移，使原点在中心
    const xOffset = x - originShift;
    const yOffset = y - originShift;

    // 应用缩放因子并转换为 Three.js 坐标系
    // Three.js: X 右, Y 上, Z 向外（默认）
    // Web Mercator: X 右, Y 上（北）
    return new THREE.Vector3(
      xOffset * this.worldScaleFactor,
      altitude * this.worldScaleFactor, // 高程映射到 Y 轴
      -yOffset * this.worldScaleFactor // Web Mercator Y 映射到 Three.js -Z 轴
    );
  }

  /**
   * Three.js 世界坐标 → Web Mercator (EPSG:3857)
   * 优先使用 Cesium SyncManager 进行转换（如果可用）
   * @param {THREE.Vector3} worldPosition - Three.js 世界坐标
   * @returns {Object} { x, y, altitude } Web Mercator 坐标（米）和高程
   */
  worldToWebMercator(worldPosition) {
    // 优先使用 Cesium SyncManager（如果可用且已配置地板中心）
    const syncManager = this.getCesiumSyncManager();
    if (syncManager && syncManager.floorCenterMercator && syncManager.threeToMercator) {
      const mercator = syncManager.threeToMercator(worldPosition.x, worldPosition.y, worldPosition.z);
      // ⚠️ 关键修复：SyncManager 返回的是绝对墨卡托坐标，需要转换为 EPSG:3857 坐标
      // EPSG:3857 使用 originShift 使原点在左下角
      const { originShift } = this.EPSG3857;
      return {
        x: mercator.x + originShift,
        y: mercator.y + originShift,
        altitude: mercator.z
      };
    }

    // 降级：使用内置的 Web Mercator 转换
    const { originShift } = this.EPSG3857;

    // 反向应用缩放因子
    const xOffset = worldPosition.x / this.worldScaleFactor;
    const yOffset = -worldPosition.z / this.worldScaleFactor;
    const altitude = worldPosition.y / this.worldScaleFactor;

    return {
      x: xOffset + originShift,
      y: yOffset + originShift,
      altitude
    };
  }

  /**
   * 经纬度 (WGS84) → Three.js 世界坐标（组合转换）
   * @param {number} longitude - 经度（度）
   * @param {number} latitude - 纬度（度）
   * @param {number} altitude - 高程（米，默认 0）
   * @returns {THREE.Vector3} Three.js 世界坐标
   */
  lonLatToWorld(longitude, latitude, altitude = 0) {
    const mercator = this.lonLatToWebMercator(longitude, latitude);
    return this.webMercatorToWorld(mercator.x, mercator.y, altitude);
  }

  /**
   * Three.js 世界坐标 → 经纬度 (WGS84)（组合转换）
   * @param {THREE.Vector3} worldPosition - Three.js 世界坐标
   * @returns {Object} { longitude, latitude, altitude } 经纬度（度）和高程（米）
   */
  worldToLonLat(worldPosition) {
    const mercator = this.worldToWebMercator(worldPosition);
    return this.webMercatorToLonLat(mercator.x, mercator.y);
  }

  // ============================================================
  // 实用工具方法
  // ============================================================

  /**
   * 计算两点之间的屏幕距离
   * @param {THREE.Vector3} pos1 - 第一个点的世界坐标
   * @param {THREE.Vector3} pos2 - 第二个点的世界坐标
   * @param {THREE.Camera} camera - Three.js 相机
   * @returns {number} 屏幕像素距离
   */
  screenDistance(pos1, pos2, camera) {
    const screen1 = this.worldToScreen(pos1, camera);
    const screen2 = this.worldToScreen(pos2, camera);
    const dx = screen2.x - screen1.x;
    const dy = screen2.y - screen1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 获取调试信息
   * @returns {Object} 调试信息对象
   */
  getDebugInfo() {
    return {
      virtualViewport: {
        width: this.virtualViewport.width,
        height: this.virtualViewport.height,
        left: this.virtualViewport.left,
        top: this.virtualViewport.top
      },
      worldScaleFactor: this.worldScaleFactor,
      EPSG3857: this.EPSG3857
    };
  }
}

// ============================================================
// LayerInfo - 层信息类
// ============================================================

/**
 * 层信息类
 *
 * 存储单个层的所有相关信息。
 */
class LayerInfo {
  constructor(id, config) {
    this.id = id;
    this.camera = config.camera || null;
    this.scene = config.scene || null;
    this.container = config.container || null;
    this.raycaster = config.raycaster || null;
    this.mouseVector = config.mouseVector || new THREE.Vector2();
    this.controls = config.controls || null;
    this.modelGroup = config.modelGroup || null;
    this.selectedModel = null;
    this.transformControls = null;
  }

  /**
   * 更新层配置
   * @param {Object} config - 配置对象
   */
  update(config) {
    if (config.camera !== undefined) this.camera = config.camera;
    if (config.scene !== undefined) this.scene = config.scene;
    if (config.container !== undefined) this.container = config.container;
    if (config.raycaster !== undefined) this.raycaster = config.raycaster;
    if (config.mouseVector !== undefined) this.mouseVector = config.mouseVector;
    if (config.controls !== undefined) this.controls = config.controls;
    if (config.modelGroup !== undefined) this.modelGroup = config.modelGroup;
    if (config.selectedModel !== undefined) this.selectedModel = config.selectedModel;
    if (config.transformControls !== undefined) this.transformControls = config.transformControls;
  }

  /**
   * 检查层是否准备好进行交互
   * @returns {boolean}
   */
  isReady() {
    return !!(this.camera && this.scene && this.container);
  }

  /**
   * 获取模型列表
   * @returns {THREE.Object3D[]} 模型数组
   */
  getModels() {
    if (!this.modelGroup) {
      return [];
    }
    return this.modelGroup.children || [];
  }
}

// ============================================================
// UnifiedViewportManager - 统一视口管理器
// ============================================================

/**
 * 统一视口管理器类
 *
 * 管理多个层的坐标计算和射线检测，提供统一的接口。
 */
class UnifiedViewportManager {
  constructor() {
    this.virtualViewport = new VirtualViewport();
    this.converter = new CoordinateConverter(this.virtualViewport);
    this.layers = new Map(); // 层信息映射 (id → LayerInfo)
    this._windowResizeHandler = null;
    this._setupWindowResizeListener();
  }

  /**
   * 设置窗口大小变化监听器
   * @private
   */
  _setupWindowResizeListener() {
    this._windowResizeHandler = () => {
      this.virtualViewport.markDirty();
      console.log('[UnifiedViewportManager] 窗口大小变化，标记虚拟视口为脏');
    };
    window.addEventListener('resize', this._windowResizeHandler);
  }

  /**
   * 注册一个层
   * @param {string} id - 层 ID（如 'layer1', 'layer2', 'layer0'）
   * @param {Object} config - 层配置对象
   * @returns {boolean} 是否成功注册
   */
  registerLayer(id, config) {
    if (!id) {
      console.error('[UnifiedViewportManager] 层 ID 不能为空');
      return false;
    }

    if (!config) {
      console.error('[UnifiedViewportManager] 层配置不能为空');
      return false;
    }

    // 创建或更新层信息
    let layerInfo = this.layers.get(id);
    if (!layerInfo) {
      layerInfo = new LayerInfo(id, config);
      this.layers.set(id, layerInfo);
      console.log('[UnifiedViewportManager] 注册新层:', id);
    } else {
      layerInfo.update(config);
      console.log('[UnifiedViewportManager] 更新层:', id);
    }

    // 注册容器的虚拟视口
    if (config.container) {
      this.virtualViewport.registerContainer(config.container);
    }

    // 更新虚拟视口
    this.virtualViewport.update();

    return true;
  }

  /**
   * 注销一个层
   * @param {string} id - 层 ID
   * @returns {boolean} 是否成功注销
   */
  unregisterLayer(id) {
    const layerInfo = this.layers.get(id);
    if (!layerInfo) {
      console.warn('[UnifiedViewportManager] 层不存在:', id);
      return false;
    }

    // 从虚拟视口注销容器
    if (layerInfo.container) {
      this.virtualViewport.unregisterContainer(layerInfo.container);
    }

    this.layers.delete(id);
    console.log('[UnifiedViewportManager] 注销层:', id);

    return true;
  }

  /**
   * 获取层信息
   * @param {string} id - 层 ID
   * @returns {LayerInfo|null} 层信息对象
   */
  getLayer(id) {
    return this.layers.get(id) || null;
  }

  /**
   * 检查层是否存在
   * @param {string} id - 层 ID
   * @returns {boolean}
   */
  hasLayer(id) {
    return this.layers.has(id);
  }

  /**
   * 获取所有层 ID
   * @returns {string[]} 层 ID 数组
   */
  getLayerIds() {
    return Array.from(this.layers.keys());
  }

  /**
   * 更新虚拟视口尺寸
   * 应在窗口大小变化或容器尺寸变化时调用
   */
  updateViewportSize() {
    this.virtualViewport.markDirty();
    this.virtualViewport.update();
  }

  /**
   * 屏幕像素坐标 → 虚拟视口 NDC 坐标
   * @param {number} screenX - 屏幕 X 像素坐标
   * @param {number} screenY - 屏幕 Y 像素坐标
   * @returns {Object} { x, y } NDC 坐标（-1 到 1）
   */
  screenToViewportNDC(screenX, screenY) {
    return this.converter.screenToViewportNDC(screenX, screenY);
  }

  /**
   * 更新层的鼠标向量
   * @param {string} layerId - 层 ID
   * @param {number} screenX - 屏幕 X 像素坐标
   * @param {number} screenY - 屏幕 Y 像素坐标
   * @returns {boolean} 是否成功更新
   */
  updateLayerMouse(layerId, screenX, screenY) {
    const layer = this.getLayer(layerId);
    if (!layer || !layer.mouseVector) {
      console.warn('[UnifiedViewportManager] 层不存在或没有鼠标向量:', layerId);
      return false;
    }

    const ndc = this.screenToViewportNDC(screenX, screenY);
    layer.mouseVector.x = ndc.x;
    layer.mouseVector.y = ndc.y;

    return true;
  }

  /**
   * 统一的射线检测
   * @param {string} layerId - 层 ID
   * @param {number} screenX - 屏幕 X 像素坐标
   * @param {number} screenY - 屏幕 Y 像素坐标
   * @param {Object} options - 可选参数
   * @param {boolean} options.filterHelpers - 是否过滤辅助对象（默认 true）
   * @param {boolean} options.updateMatrix - 是否更新矩阵世界（默认 true）
   * @returns {Array} 射线检测结果数组
   */
  raycast(layerId, screenX, screenY, options = {}) {
    const {
      filterHelpers = true,
      updateMatrix = true
    } = options;

    const layer = this.getLayer(layerId);
    if (!layer) {
      console.warn('[UnifiedViewportManager] 层不存在:', layerId);
      return [];
    }

    if (!layer.isReady()) {
      console.warn('[UnifiedViewportManager] 层未准备好:', layerId);
      return [];
    }

    if (!layer.raycaster) {
      console.warn('[UnifiedViewportManager] 层没有射线检测器:', layerId);
      return [];
    }

    const models = layer.getModels();
    if (models.length === 0) {
      console.log('[UnifiedViewportManager] 层没有模型:', layerId);
      return [];
    }

    // 更新矩阵世界
    if (updateMatrix && layer.modelGroup) {
      layer.modelGroup.updateMatrixWorld(true);
    }

    // 计算鼠标位置
    const ndc = this.screenToViewportNDC(screenX, screenY);

    // 执行射线检测
    layer.raycaster.setFromCamera(ndc, layer.camera);
    layer.raycaster.params.Line.threshold = 1.0;
    layer.raycaster.params.Points.threshold = 1.0;

    let intersects = layer.raycaster.intersectObjects(models, true);

    // 过滤辅助对象
    if (filterHelpers) {
      intersects = intersects.filter(hit => {
        const obj = hit.object;
        if (obj.type === 'TransformControls' ||
            obj.type === 'TransformControlsPlane' ||
            (obj.name && obj.name.includes('TransformControls'))) {
          return false;
        }
        if (obj.isHelper || obj.isLine) {
          return false;
        }
        return true;
      });
    }

    console.log('[UnifiedViewportManager] 射线检测:', layerId, '结果:', intersects.length);

    return intersects;
  }

  /**
   * 多层射线检测（按优先级顺序）
   * @param {string[]} layerIds - 层 ID 数组（按优先级排序）
   * @param {number} screenX - 屏幕 X 像素坐标
   * @param {number} screenY - 屏幕 Y 像素坐标
   * @param {Object} options - 可选参数（传递给 raycast 方法）
   * @returns {Object} { layerId, intersects } 第一个有结果的层的检测结果
   */
  raycastMultiple(layerIds, screenX, screenY, options = {}) {
    for (const layerId of layerIds) {
      const intersects = this.raycast(layerId, screenX, screenY, options);
      if (intersects.length > 0) {
        return { layerId, intersects };
      }
    }
    return { layerId: null, intersects: [] };
  }

  /**
   * 同步多层相机
   * @param {string} sourceLayerId - 源层 ID
   * @param {string[]} targetLayerIds - 目标层 ID 数组
   * @param {Object} options - 可选参数
   * @param {boolean} options.syncPosition - 是否同步位置（默认 true）
   * @param {boolean} options.syncRotation - 是否同步旋转（默认 true）
   * @param {boolean} options.syncZoom - 是否同步缩放（默认 true）
   * @param {boolean} options.syncProjection - 是否同步投影矩阵（默认 false）
   */
  syncCameras(sourceLayerId, targetLayerIds, options = {}) {
    const {
      syncPosition = true,
      syncRotation = true,
      syncZoom = true,
      syncProjection = false
    } = options;

    const sourceLayer = this.getLayer(sourceLayerId);
    if (!sourceLayer || !sourceLayer.camera) {
      console.warn('[UnifiedViewportManager] 源层不存在或没有相机:', sourceLayerId);
      return;
    }

    const sourceCamera = sourceLayer.camera;

    for (const targetLayerId of targetLayerIds) {
      const targetLayer = this.getLayer(targetLayerId);
      if (!targetLayer || !targetLayer.camera) {
        continue;
      }

      const targetCamera = targetLayer.camera;

      if (syncPosition) {
        targetCamera.position.copy(sourceCamera.position);
      }

      if (syncRotation) {
        targetCamera.rotation.copy(sourceCamera.rotation);
        targetCamera.quaternion.copy(sourceCamera.quaternion);
      }

      if (syncZoom && targetCamera.zoom !== undefined) {
        targetCamera.zoom = sourceCamera.zoom;
      }

      if (syncProjection) {
        targetCamera.projectionMatrix.copy(sourceCamera.projectionMatrix);
      }

      targetCamera.updateMatrixWorld(true);

      if (targetLayer.controls) {
        targetLayer.controls.update();
      }
    }

    console.log('[UnifiedViewportManager] 同步相机:', sourceLayerId, '→', targetLayerIds);
  }

  /**
   * 在指定地理位置放置模型
   * @param {THREE.Object3D} model - 要放置的模型
   * @param {number} longitude - 经度（度）
   * @param {number} latitude - 纬度（度）
   * @param {number} altitude - 高程（米，默认 0）
   */
  placeModelAtLocation(model, longitude, latitude, altitude = 0) {
    const worldPos = this.converter.lonLatToWorld(longitude, latitude, altitude);
    model.position.copy(worldPos);
    console.log('[UnifiedViewportManager] 放置模型到地理位置:', { longitude, latitude, altitude }, '→', worldPos);
  }

  /**
   * 获取模型的地理位置
   * @param {THREE.Object3D} model - 模型对象
   * @returns {Object} { longitude, latitude, altitude } 经纬度（度）和高程（米）
   */
  getModelLocation(model) {
    return this.converter.worldToLonLat(model.position);
  }

  // ============================================================
  // Cesium 坐标系统集成
  // ============================================================

  /**
   * 设置 Cesium SyncManager
   * 将 Cesium 的墨卡托坐标系集成到统一视口管理器中
   * @param {Object} syncManager - SyncManager 实例
   * @param {Object} floorCenterMercator - 地板中心墨卡托坐标（可选，如果不提供则从 syncManager 获取）
   */
  setCesiumSyncManager(syncManager, floorCenterMercator = null) {
    if (!syncManager) {
      console.warn('[UnifiedViewportManager] SyncManager 为空，无法设置');
      return;
    }

    // 将 SyncManager 传递给 CoordinateConverter
    this.converter.setCesiumSyncManager(syncManager);

    // 设置地板中心墨卡托坐标（如果提供）
    if (floorCenterMercator) {
      syncManager.setFloorCenter(floorCenterMercator);
    }

    console.log('[UnifiedViewportManager] Cesium SyncManager 已集成到统一视口管理器');
  }

  /**
   * 获取当前使用的 Cesium SyncManager
   * @returns {Object|null} SyncManager 实例
   */
  getCesiumSyncManager() {
    return this.converter.getCesiumSyncManager();
  }

  /**
   * 检查是否已集成 Cesium 坐标系统
   * @returns {boolean}
   */
  hasCesiumIntegration() {
    const syncManager = this.getCesiumSyncManager();
    return !!(syncManager && syncManager.floorCenterMercator);
  }

  // ============================================================
  // ENU 坐标系集成
  // ============================================================

  /**
   * 设置 ENU 坐标管理器
   * 将 ENU 坐标管理器注册到虚拟视口，使虚拟视口支持 ENU 坐标系
   * @param {Object} enuManager - ENUCoordinateManager 实例
   */
  setENUManager(enuManager) {
    this.converter.setENUManager(enuManager);
    console.log('[UnifiedViewportManager] ENU 坐标管理器已注册到虚拟视口');
  }

  /**
   * 获取 ENU 坐标管理器
   * @returns {Object|null} ENUCoordinateManager 实例
   */
  getENUManager() {
    return this.converter.getENUManager();
  }

  /**
   * 检查是否使用 ENU 坐标系
   * @returns {boolean}
   */
  isUsingENU() {
    return this.converter.isUsingENU();
  }

  /**
   * 获取调试信息
   * @returns {Object} 调试信息对象
   */
  getDebugInfo() {
    const enuManager = this.getENUManager();
    return {
      virtualViewport: {
        width: this.virtualViewport.width,
        height: this.virtualViewport.height,
        left: this.virtualViewport.left,
        top: this.virtualViewport.top,
        containers: this.virtualViewport._containers.length
      },
      layers: Array.from(this.layers.keys()),
      converter: this.converter.getDebugInfo(),
      enu: {
        enabled: this.isUsingENU(),
        hasManager: !!enuManager,
        originInfo: enuManager && enuManager.getOriginInfo ? enuManager.getOriginInfo() : null
      }
    };
  }

  /**
   * 销毁管理器
   */
  dispose() {
    // 移除窗口大小变化监听器
    if (this._windowResizeHandler) {
      window.removeEventListener('resize', this._windowResizeHandler);
      this._windowResizeHandler = null;
    }

    // 清空层信息
    this.layers.clear();

    console.log('[UnifiedViewportManager] 已销毁');
  }
}

// ============================================================
// 导出单例
// ============================================================

/**
 * 统一视口管理器单例
 * 提供全局访问点，确保整个应用使用同一个坐标系统实例
 */
export const unifiedViewport = new UnifiedViewportManager();

// ⚠️ 初始化调试数组（不会被 Terser 移除，因为不是 console.log）
if (typeof window !== 'undefined') {
  window.__viewportNDCToWorldDebug__ = window.__viewportNDCToWorldDebug__ || [];
}

// ============================================================
// 方向向量坐标系管理
// ============================================================

/**
 * 坐标系类型枚举 - 用于方向向量
 */
export const DirectionCoordinateSystem = {
  // 统一坐标系（State坐标系）：X=东, Y=天, Z=南（东南天，EUS）
  UNIFIED_EUS: 'UNIFIED_EUS',

  // 墨卡托坐标系（ENU）：X=东, Y=北, Z=天（东北天）
  MERCATOR_ENU: 'MERCATOR_ENU',

  // Cesium ECEF坐标系：地心地固坐标系
  ECEF: 'ECEF',

  // Three.js 默认坐标系：X=右, Y=上, Z=观察方向
  THREEJS: 'THREEJS'
};

/**
 * 坐标系详细定义
 */
export const CoordinateSystemDefinitions = {
  [DirectionCoordinateSystem.UNIFIED_EUS]: {
    name: '统一坐标系（State坐标系）',
    shortName: 'State/EUS',
    axes: {
      x: '东（East）',
      y: '天（Up/Sky）',
      z: '南（South）'
    },
    description: '用于 unifiedCameraState.direction，方向向量的标准坐标系',
    handedness: 'right-handed'
  },

  [DirectionCoordinateSystem.MERCATOR_ENU]: {
    name: '墨卡托坐标系（ENU）',
    shortName: 'Mercator/ENU',
    axes: {
      x: '东（East）',
      y: '北（North）',
      z: '天（Up）'
    },
    description: '标准的墨卡托投影坐标系，与地理坐标系对应',
    handedness: 'right-handed'
  },

  [DirectionCoordinateSystem.ECEF]: {
    name: '地心地固坐标系',
    shortName: 'ECEF',
    axes: {
      x: '穿过本初子午线',
      y: '穿过东经90度',
      z: '穿过北极'
    },
    description: 'Cesium 使用的3D笛卡尔坐标系',
    handedness: 'right-handed'
  },

  [DirectionCoordinateSystem.THREEJS]: {
    name: 'Three.js 默认坐标系',
    shortName: 'Three.js',
    axes: {
      x: '右',
      y: '上',
      z: '观察方向'
    },
    description: 'Three.js 场景的标准坐标系',
    handedness: 'right-handed'
  }
};

/**
 * 方向向量坐标系转换器
 */
export class DirectionConverter {
  /**
   * 从统一坐标系（EUS）转换到墨卡托坐标系（ENU）
   *
   * 统一坐标系：X=东, Y=天, Z=南
   * 墨卡托坐标系：X=东, Y=北, Z=天
   *
   * 转换公式：
   * - mercator.x = unified.x  （东不变）
   * - mercator.y = -unified.z （南取反为北）
   * - mercator.z = unified.y  （天不变）
   *
   * @param {Object} directionInEUS - 统一坐标系中的方向向量 {x, y, z}
   * @returns {Object} 墨卡托坐标系中的方向向量 {x, y, z}
   */
  static unifiedEUSToMercatorENU(directionInEUS) {
    if (!directionInEUS) {
      console.error('[DirectionConverter] unifiedEUSToMercatorENU: 输入为空');
      return { x: 0, y: -1, z: 0 }; // 默认向北
    }

    // 验证输入
    if (!isFinite(directionInEUS.x) ||
        !isFinite(directionInEUS.y) ||
        !isFinite(directionInEUS.z)) {
      console.error('[DirectionConverter] unifiedEUSToMercatorENU: 输入包含无效值', directionInEUS);
      return { x: 0, y: -1, z: 0 };
    }

    return {
      x: directionInEUS.x,   // 东 → 东
      y: -directionInEUS.z,  // 南取反 → 北
      z: directionInEUS.y    // 天 → 天
    };
  }

  /**
   * 从墨卡托坐标系（ENU）转换到统一坐标系（EUS）
   *
   * 转换公式：
   * - unified.x = mercator.x  （东不变）
   * - unified.y = mercator.z  （天不变）
   * - unified.z = -mercator.y （北取反为南）
   *
   * @param {Object} directionInENU - 墨卡托坐标系中的方向向量 {x, y, z}
   * @returns {Object} 统一坐标系中的方向向量 {x, y, z}
   */
  static mercatorENUToUnifiedEUS(directionInENU) {
    if (!directionInENU) {
      console.error('[DirectionConverter] mercatorENUToUnifiedEUS: 输入为空');
      return { x: 0, y: -0.866, z: -0.5 }; // 默认倾斜向下
    }

    // 验证输入
    if (!isFinite(directionInENU.x) ||
        !isFinite(directionInENU.y) ||
        !isFinite(directionInENU.z)) {
      console.error('[DirectionConverter] mercatorENUToUnifiedEUS: 输入包含无效值', directionInENU);
      return { x: 0, y: -0.866, z: -0.5 };
    }

    return {
      x: directionInENU.x,   // 东 → 东
      y: directionInENU.z,   // 天 → 天
      z: -directionInENU.y   // 北取反 → 南
    };
  }

  /**
   * 验证方向向量是否有效
   * @param {Object} direction - 方向向量 {x, y, z}
   * @returns {boolean} 是否有效
   */
  static isValidDirection(direction) {
    if (!direction ||
        typeof direction.x !== 'number' ||
        typeof direction.y !== 'number' ||
        typeof direction.z !== 'number') {
      return false;
    }

    if (!isFinite(direction.x) ||
        !isFinite(direction.y) ||
        !isFinite(direction.z)) {
      return false;
    }

    // 检查是否为零向量
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (length < 0.0001) {
      console.warn(`[DirectionConverter] 方向向量长度接近零: ${length}`);
      return false;
    }

    return true;
  }

  /**
   * 格式化方向向量用于调试
   * @param {Object} direction - 方向向量
   * @param {string} coordinateSystem - 坐标系类型
   * @returns {string} 格式化的字符串
   */
  static formatForDebug(direction, coordinateSystem) {
    if (!direction) {
      return 'null';
    }

    const sysInfo = CoordinateSystemDefinitions[coordinateSystem];
    const sysName = sysInfo ? sysInfo.shortName : coordinateSystem;

    return `(${sysName}) [${direction.x.toFixed(3)}, ${direction.y.toFixed(3)}, ${direction.z.toFixed(3)}]`;
  }
}

/**
 * 为 unifiedCameraState 增强坐标系功能
 * 在 SyncManager 初始化时调用此函数
 *
 * @param {Object} unifiedState - unifiedCameraState 对象
 */
export function enhanceUnifiedStateWithCoordinateSystem(unifiedState) {
  if (!unifiedState) {
    console.error('[enhanceUnifiedStateWithCoordinateSystem] unifiedState 为空');
    return;
  }

  // 添加坐标系标识
  unifiedState._directionCoordinateSystem = DirectionCoordinateSystem.UNIFIED_EUS;

  // 添加转换方法
  unifiedState.directionToMercatorENU = function() {
    if (this._directionCoordinateSystem !== DirectionCoordinateSystem.UNIFIED_EUS) {
      console.warn(`[unifiedState.directionToMercatorENU] 当前坐标系不是 UNIFIED_EUS，而是: ${this._directionCoordinateSystem}`);
    }
    return DirectionConverter.unifiedEUSToMercatorENU(this.direction);
  };

  unifiedState.directionFromMercatorENU = function(mercatorDirection) {
    if (this._directionCoordinateSystem !== DirectionCoordinateSystem.UNIFIED_EUS) {
      console.warn(`[unifiedState.directionFromMercatorENU] 当前坐标系不是 UNIFIED_EUS，而是: ${this._directionCoordinateSystem}`);
    }
    return DirectionConverter.mercatorENUToUnifiedEUS(mercatorDirection);
  };

  // 添加验证方法
  unifiedState.validateDirection = function() {
    return DirectionConverter.isValidDirection(this.direction);
  };

  // 添加获取坐标系信息的方法
  unifiedState.getCoordinateSystemInfo = function() {
    return CoordinateSystemDefinitions[this._directionCoordinateSystem] || null;
  };

  console.log('[enhanceUnifiedStateWithCoordinateSystem] unifiedCameraState 已增强方向向量坐标系功能:', {
    coordinateSystem: unifiedState._directionCoordinateSystem,
    info: unifiedState.getCoordinateSystemInfo()?.name
  });
}

// 同时导出类，以便需要时可以创建多个实例
export {
  VirtualViewport,
  CoordinateConverter,
  LayerInfo,
  UnifiedViewportManager
};
