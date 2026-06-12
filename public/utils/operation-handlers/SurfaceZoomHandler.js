/**
 * 地上缩放处理器
 * 处理地上模式的缩放操作（position.y >= -50）
 * 使用 Cesium 原生 camera.zoom API
 */

import { CesiumBasedOperationHandler } from './CesiumBasedOperationHandler.js';

export class SurfaceZoomHandler extends CesiumBasedOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'zoom';
    this.mode = 'surface';
    this.handlerOperationType = 'zoom'; // 额外保存
    console.log('[SurfaceZoomHandler] 构造函数调用，operationType:', this.operationType, 'handlerOperationType:', this.handlerOperationType);
  }

  /**
   * 执行地上缩放操作
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  performCesiumOperation(deltaZoom) {
    const camera = this.getCesiumCamera();
    if (!camera) {
      console.error('[SurfaceZoomHandler] Cesium Camera 不可用');
      return false;
    }

    // 验证相机位置
    if (!this.validateCameraPosition()) {
      console.warn('[SurfaceZoomHandler] 相机位置无效，跳过缩放操作');
      return false;
    }

    // 验证是否为地上模式
    if (this.isCameraUnderground()) {
      console.warn('[SurfaceZoomHandler] 当前处于地下模式，不应使用地上缩放处理器');
      return false;
    }

    // 验证输入
    if (!this.validateInput(deltaZoom, 'deltaZoom')) {
      return false;
    }

    const Cesium = this.getCesium();
    if (!Cesium) {
      console.error('[SurfaceZoomHandler] Cesium 不可用');
      return false;
    }

    try {
      // 获取缩放参数，增加缩放速度以获得更明显的效果
      const zoomSpeed = (this.syncManager.mouseOperationParams.zoomSpeed || 0.1) * 2000; // 增加到2000倍
      const amount = Math.abs(deltaZoom) * zoomSpeed;

      // 记录操作前的相机位置和方向
      const beforePosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };

      // 保存相机方向向量，防止缩放时发生旋转
      const savedDirection = Cesium.Cartesian3.clone(camera.direction);
      const savedUp = Cesium.Cartesian3.clone(camera.up);
      const savedRight = Cesium.Cartesian3.clone(camera.right);

      // 手动实现缩放：沿视线方向移动相机位置
      const direction = camera.direction;
      if (deltaZoom < 0) {
        // 放大（靠近目标）- 沿视线方向向前移动
        const newPosition = new Cesium.Cartesian3();
        Cesium.Cartesian3.add(camera.position,
          Cesium.Cartesian3.multiplyByScalar(direction, amount, new Cesium.Cartesian3()),
          newPosition);
        camera.position = newPosition;
      } else {
        // 缩小（远离目标）- 沿视线方向向后移动
        const newPosition = new Cesium.Cartesian3();
        Cesium.Cartesian3.add(camera.position,
          Cesium.Cartesian3.multiplyByScalar(direction, -amount, new Cesium.Cartesian3()),
          newPosition);
        camera.position = newPosition;
      }

      // 恢复相机方向，防止旋转
      camera.direction = savedDirection;
      camera.up = savedUp;
      camera.right = savedRight;

      console.log('[SurfaceZoomHandler] 缩放操作:', {
        deltaZoom,
        zoomSpeed,
        amount,
        before: beforePosition,
        after: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
      });

      return true;
    } catch (error) {
      console.error('[SurfaceZoomHandler] 缩放操作失败:', error);
      return false;
    }
  }

  /**
   * 执行前的额外检查
   * @returns {boolean} true 表示可以执行
   */
  canExecute() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return false;
    }

    // 检查是否为地上模式
    return !this.isCameraUnderground();
  }

  /**
   * 获取操作描述
   * @returns {string} 操作描述
   */
  getDescription() {
    return '地上缩放 - 使用 Cesium 原生 camera.zoom API';
  }
}
