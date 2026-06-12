/**
 * Cesium 原生操作基类
 * 使用 Cesium 原生 API 进行操作
 * 操作期间设置操作锁，完成后同步到统一坐标系和 dual 组件
 */

import { BaseOperationHandler } from './BaseOperationHandler.js';

export class CesiumBasedOperationHandler extends BaseOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.cesiumViewer = null;
    this.cesiumCamera = null;
    this.prerotationState = null;

    // 让子类覆盖此属性，用于标识操作类型
    // 不依赖 this.operationType，因为它可能被重置
    this.handlerOperationType = this.operationType;
  }

  /**
   * 设置 Cesium Viewer 和 Camera
   * @param {Object} viewer - Cesium Viewer
   * @param {Object} camera - Cesium Camera
   */
  setCesiumObjects(viewer, camera) {
    this.cesiumViewer = viewer;
    this.cesiumCamera = camera;

    // 同步处理器操作类型
    this.handlerOperationType = this.operationType;
  }

  /**
   * 获取 Cesium Viewer
   * @returns {Object|null} Cesium Viewer
   */
  getCesiumViewer() {
    if (!this.cesiumViewer) {
      this.cesiumViewer = this.syncManager.cesiumViewer;
    }
    return this.cesiumViewer;
  }

  /**
   * 获取 Cesium Camera
   * @returns {Object|null} Cesium Camera
   */
  getCesiumCamera() {
    if (!this.cesiumCamera && this.cesiumViewer) {
      this.cesiumCamera = this.cesiumViewer.camera;
    }
    return this.cesiumCamera;
  }

  /**
   * 获取 Cesium 实例
   * @returns {Object|null} Cesium 构造函数
   */
  getCesium() {
    return this.syncManager.getCesium();
  }

  /**
   * 保存 prerotation 状态
   * 保存操作前的相机状态
   */
  savePrerotationState() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      console.error('[CesiumBasedOperationHandler] Cesium Camera 不可用');
      return false;
    }

    this.prerotationState = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      },
      direction: {
        x: camera.direction.x,
        y: camera.direction.y,
        z: camera.direction.z
      },
      up: {
        x: camera.up.x,
        y: camera.up.y,
        z: camera.up.z
      },
      right: {
        x: camera.right.x,
        y: camera.right.y,
        z: camera.right.z
      }
    };

    return true;
  }

  /**
   * 恢复 prerotation 状态
   * 恢复操作前的相机状态
   */
  restorePrerotationState() {
    const camera = this.getCesiumCamera();
    if (!camera || !this.prerotationState) {
      return false;
    }

    camera.position.x = this.prerotationState.position.x;
    camera.position.y = this.prerotationState.position.y;
    camera.position.z = this.prerotationState.position.z;

    camera.direction.x = this.prerotationState.direction.x;
    camera.direction.y = this.prerotationState.direction.y;
    camera.direction.z = this.prerotationState.direction.z;

    camera.up.x = this.prerotationState.up.x;
    camera.up.y = this.prerotationState.up.y;
    camera.up.z = this.prerotationState.up.z;

    camera.right.x = this.prerotationState.right.x;
    camera.right.y = this.prerotationState.right.y;
    camera.right.z = this.prerotationState.right.z;

    return true;
  }

  /**
   * 同步到统一坐标系
   * 将 Cesium 相机状态同步到统一坐标系
   *
   * ⚠️ 重要修复：地板中心固定后，target 必须跟随相机更新
   *
   * 原设计：keepTarget = true，假设地板中心跟随相机移动，平移时保持 target 不变
   * 新设计：地板中心固定，target 必须重新计算，否则相机会一直看向原点
   */
  syncToUnifiedState() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return false;
    }

    // 调用 SyncManager 的方法同步到统一坐标系
    if (typeof this.syncManager._syncCesiumToUnified === 'function') {
      const viewer = this.getCesiumViewer();
      const scene = viewer?.scene;
      // 关键修复：将 keepTarget 改为 false，让 target 重新计算
      this.syncManager._syncCesiumToUnified(camera, scene, false);
      return true;
    }

    return false;
  }

  /**
   * 同步到 dual 组件
   * 将统一坐标系状态同步到 dual 组件
   */
  syncToDualComponent() {
    // 这里的同步逻辑会由 cesium-dual-sync.js 自动处理
    // 因为 Cesium 相机状态变化后会触发 moveEnd 事件
    return true;
  }

  /**
   * 执行 Cesium 原生操作
   * 子类必须实现此方法
   * @param {...any} args - 操作参数
   * @returns {boolean} 操作是否成功
   */
  performCesiumOperation(...args) {
    throw new Error('子类必须实现 performCesiumOperation 方法');
  }

  /**
   * 执行操作
   * @param {...any} args - 操作参数
   * @returns {boolean} 操作是否成功
   */
  execute(...args) {
    // 检查 Cesium 对象是否可用
    if (!this.getCesiumCamera()) {
      console.error('[CesiumBasedOperationHandler] Cesium Camera 不可用');
      return false;
    }

    // 使用保存的操作类型（不依赖 this.operationType，因为它可能被重置）
    const handlerOperationType = this.handlerOperationType || this.operationType;
    console.log(`[CesiumBasedOperationHandler.execute] 开始执行，操作类型: ${handlerOperationType}, this.operationType: ${this.operationType}, handlerOperationType: ${this.handlerOperationType}, 类名: ${this.constructor.name}`);

    // 执行操作前准备
    console.log(`[CesiumBasedOperationHandler.execute] 调用 beforeOperation 之前`);
    const context = this.beforeOperation(this.operationType);
    console.log(`[CesiumBasedOperationHandler.execute] beforeOperation 返回后，this.operationType: ${this.operationType}`);
    if (!context) {
      return false;
    }

    // 在 try 块之前定义 success，以便在 finally 块中访问
    let success = false;

    try {
      // 保存 prerotation 状态
      this.savePrerotationState();

      // 执行 Cesium 原生操作
      success = this.performCesiumOperation(...args);
      console.log(`[CesiumBasedOperationHandler.execute] 操作结果: ${success}`);

      if (success) {
        // 所有操作都需要同步到统一坐标系
        // 包括缩放操作，因为缩放改变了相机位置
        console.log(`[CesiumBasedOperationHandler] 操作类型: ${handlerOperationType}`);
        // 同步到统一坐标系
        console.log(`[CesiumBasedOperationHandler] 调用 syncToUnifiedState`);
        this.syncToUnifiedState();

        // 同步到 dual 组件（会由 cesium-dual-sync.js 自动处理）
        this.syncToDualComponent();
      }

      return success;
    } catch (error) {
      console.error(`[${this.constructor.name}] 操作失败:`, error);

      // 出错时尝试恢复状态
      this.restorePrerotationState();
      return false;
    } finally {
      // 执行操作后清理
      console.log(`[CesiumBasedOperationHandler.execute] finally 块，准备调用 afterOperation`);
      this.afterOperation(context);
      console.log(`[CesiumBasedOperationHandler.execute] afterOperation 返回后，this.operationType: ${this.operationType}`);

      // 在操作完成后，短暂阻止 dual 到 Cesium 的同步
      // 防止 dual 组件用旧状态覆盖我们的操作结果
      if (success && typeof window !== 'undefined' && window.cesiumDualSync) {
        const blockTime = Date.now() + 100; // 阻止 100ms
        window.cesiumDualSync.setBlockSyncUntil(blockTime);
        console.log(`[CesiumBasedOperationHandler.execute] 已设置同步阻止时间: 100ms`);
      }
    }
  }

  /**
   * 获取相机高度
   * @returns {number} 相机高度（米）
   */
  getCameraHeight() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return 0;
    }

    const Cesium = this.getCesium();
    if (!Cesium) {
      return 0;
    }

    try {
      const viewer = this.getCesiumViewer();
      const scene = viewer?.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const cartographic = ellipsoid.cartesianToCartographic(camera.position);
      return cartographic.height;
    } catch (error) {
      console.warn('[CesiumBasedOperationHandler] 获取相机高度失败:', error);
      return 0;
    }
  }

  /**
   * 判断相机是否在地下
   * @returns {boolean} true 表示在地下
   */
  isCameraUnderground() {
    return this.getCameraHeight() < 0;
  }

  /**
   * 验证相机位置是否有效
   * 检查相机位置是否包含 NaN 或 Infinity
   * @returns {boolean} true 表示相机位置有效
   */
  validateCameraPosition() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return false;
    }

    const pos = camera.position;
    if (!pos) {
      console.warn('[CesiumBasedOperationHandler] 相机位置不存在');
      return false;
    }

    // 检查 x, y, z 是否为有限数
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) {
      console.warn('[CesiumBasedOperationHandler] 相机位置包含无效值:', {
        x: pos.x,
        y: pos.y,
        z: pos.z
      });
      return false;
    }

    return true;
  }

  /**
   * 验证操作参数
   * @param {Array} args - 操作参数
   * @returns {boolean} true 表示参数有效
   */
  validateOperationArgs(args) {
    return args.every(arg => typeof arg === 'number' && isFinite(arg) && !isNaN(arg));
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.prerotationState = null;
  }
}
