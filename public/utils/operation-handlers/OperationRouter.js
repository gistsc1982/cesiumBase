/**
 * 操作路由器
 * 根据地上地下状态路由到对应的处理器
 * 管理所有操作处理器实例
 */

import { SurfaceModeDetector } from './SurfaceModeDetector.js';
import { BaseOperationHandler } from './BaseOperationHandler.js';

// 操作处理器导入（在需要时动态导入或在这里导入）
import { SurfaceCesiumRotateHandler, UndergroundCesiumRotateHandler } from './CesiumRotateHandler.js';
import { SurfaceZoomHandler } from './SurfaceZoomHandler.js';
import { UndergroundZoomHandler } from './UndergroundZoomHandler.js';
import { SurfacePanHandler } from './SurfacePanHandler.js';
import { UndergroundPanHandler } from './UndergroundPanHandler.js';
import { CameraFlipRotationHandler } from './CameraFlipRotationHandler.js';

export class OperationRouter {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.detector = new SurfaceModeDetector();

    console.log('[OperationRouter] 构造函数调用，开始创建处理器实例');

    // 初始化所有处理器（全部使用 Cesium 原生 API）
    this.handlers = {
      // 旋转操作（使用新的 Cesium 原生旋转处理器）
      surfaceRotate: new SurfaceCesiumRotateHandler(syncManager),
      undergroundRotate: new UndergroundCesiumRotateHandler(syncManager),

      // 历史版本相机翻转处理器（用于非ECEF坐标系）
      cameraFlipRotate: new CameraFlipRotationHandler(syncManager),

      // 缩放操作
      surfaceZoom: new SurfaceZoomHandler(syncManager),
      undergroundZoom: new UndergroundZoomHandler(syncManager),

      // 平移操作
      surfacePan: new SurfacePanHandler(syncManager),
      undergroundPan: new UndergroundPanHandler(syncManager)
    };

    console.log('[OperationRouter] 处理器实例已创建，检查 surfaceZoom.operationType:', this.handlers.surfaceZoom.operationType);
  }

  /**
   * 更新所有处理器的 Cesium 对象引用
   * 应在 Cesium Viewer 初始化后调用
   */
  updateCesiumObjects() {
    const viewer = this.syncManager.cesiumViewer;
    const camera = viewer?.camera;

    if (!viewer || !camera) {
      console.warn('[OperationRouter] Cesium Viewer 或 Camera 不可用，跳过更新');
      return false;
    }

    // 更新所有处理器的 Cesium 对象
    Object.values(this.handlers).forEach(handler => {
      if (typeof handler.setCesiumObjects === 'function') {
        handler.setCesiumObjects(viewer, camera);
      }
    });

    console.log('[OperationRouter] 所有处理器的 Cesium 对象已更新');
    return true;
  }

  /**
   * 获取当前模式
   * @returns {string} 'surface' | 'underground'
   */
  getCurrentMode() {
    const position = this.syncManager.unifiedCameraState?.position;
    if (!position) {
      return 'surface'; // 默认为地上模式
    }
    return this.detector.getSurfaceMode(position);
  }

  /**
   * 路由翻转操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {boolean} forceCameraFlip - 强制使用相机翻转模式
   * @returns {boolean} 操作是否成功
   */
  routeRotate(deltaX, deltaY, forceCameraFlip = false) {
    // 检查是否应该使用相机翻转模式
    const cameraFlipHandler = this.handlers.cameraFlipRotate;
    const shouldUseCameraFlip = forceCameraFlip ||
                                (cameraFlipHandler && cameraFlipHandler.shouldUseCameraFlip());

    if (shouldUseCameraFlip) {
      console.log('[OperationRouter] 使用历史版本相机翻转模式');
      return cameraFlipHandler.execute(deltaX, deltaY);
    }

    // 使用统一坐标系旋转（当前版本）
    const mode = this.getCurrentMode();

    if (mode === 'underground') {
      return this.handlers.undergroundRotate.execute(deltaX, deltaY);
    } else {
      return this.handlers.surfaceRotate.execute(deltaX, deltaY);
    }
  }

  /**
   * 检查是否应该使用相机翻转模式
   * @returns {boolean} true 表示应该使用相机翻转
   */
  shouldUseCameraFlipRotation() {
    const cameraFlipHandler = this.handlers.cameraFlipRotate;
    return cameraFlipHandler && cameraFlipHandler.shouldUseCameraFlip();
  }

  /**
   * 路由缩放操作
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  routeZoom(deltaZoom) {
    // ⭐ 检查是否使用局部坐标系
    const isUsingLocalCoord = this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem &&
                              this.syncManager.mercatorProjection.isUsingLocalCoordinateSystem();

    if (isUsingLocalCoord) {
      console.log('[OperationRouter] 局部坐标系模式：使用 SyncManager 专用缩放逻辑');
      // 局部坐标系模式使用 SyncManager 的专用缩放逻辑
      // 这样可以保持 target 不变，只改变相机与目标的距离
      return this.syncManager.handleZoomInUnified(deltaZoom);
    }

    const mode = this.getCurrentMode();

    if (mode === 'underground') {
      return this.handlers.undergroundZoom.execute(deltaZoom);
    } else {
      return this.handlers.surfaceZoom.execute(deltaZoom);
    }
  }

  /**
   * 路由平移操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  routePan(deltaX, deltaY, metersPerPixel) {
    const mode = this.getCurrentMode();

    if (mode === 'underground') {
      return this.handlers.undergroundPan.execute(deltaX, deltaY, metersPerPixel);
    } else {
      return this.handlers.surfacePan.execute(deltaX, deltaY, metersPerPixel);
    }
  }

  /**
   * 注册处理器
   * @param {string} key - 处理器键名
   * @param {BaseOperationHandler} handler - 处理器实例
   */
  registerHandler(key, handler) {
    if (!(handler instanceof BaseOperationHandler)) {
      console.error('[OperationRouter] 处理器必须继承自 BaseOperationHandler');
      return false;
    }

    this.handlers[key] = handler;
    console.log(`[OperationRouter] 处理器已注册: ${key}`);
    return true;
  }

  /**
   * 获取处理器
   * @param {string} key - 处理器键名
   * @returns {BaseOperationHandler|null} 处理器实例
   */
  getHandler(key) {
    return this.handlers[key] || null;
  }

  /**
   * 获取所有处理器
   * @returns {Object} 处理器对象
   */
  getAllHandlers() {
    return { ...this.handlers };
  }

  /**
   * 检查处理器是否可用
   * @param {string} key - 处理器键名
   * @returns {boolean} true 表示可用
   */
  isHandlerAvailable(key) {
    return this.handlers[key] !== null && this.handlers[key] !== undefined;
  }

  /**
   * 获取可用的操作列表
   * @returns {Array<string>} 可用的操作列表
   */
  getAvailableOperations() {
    const operations = [];

    if (this.isHandlerAvailable('surfaceRotate') && this.isHandlerAvailable('undergroundRotate')) {
      operations.push('rotate');
    }

    if (this.isHandlerAvailable('surfaceZoom') && this.isHandlerAvailable('undergroundZoom')) {
      operations.push('zoom');
    }

    if (this.isHandlerAvailable('surfacePan') && this.isHandlerAvailable('undergroundPan')) {
      operations.push('pan');
    }

    return operations;
  }

  /**
   * 获取路由器状态
   * @returns {Object} 路由器状态
   */
  getState() {
    return {
      currentMode: this.getCurrentMode(),
      availableOperations: this.getAvailableOperations(),
      registeredHandlers: Object.keys(this.handlers).filter(key => this.isHandlerAvailable(key))
    };
  }
}
