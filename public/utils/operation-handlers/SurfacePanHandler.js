/**
 * 地上平移处理器
 * 处理地上模式的平移操作（position.y >= -50）
 * 使用 Cesium 原生 camera.move* API
 * 上下平移沿着水平面移动（不改变高度）
 */

import { CesiumBasedOperationHandler } from './CesiumBasedOperationHandler.js';

export class SurfacePanHandler extends CesiumBasedOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'pan';
    this.mode = 'surface';
  }

  /**
   * 执行地上平移操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  performCesiumOperation(deltaX, deltaY, metersPerPixel) {
    const camera = this.getCesiumCamera();
    if (!camera) {
      console.error('[SurfacePanHandler] Cesium Camera 不可用');
      return false;
    }

    // 验证相机位置
    if (!this.validateCameraPosition()) {
      console.warn('[SurfacePanHandler] 相机位置无效，跳过平移操作');
      return false;
    }

    // 验证是否为地上模式
    if (this.isCameraUnderground()) {
      console.warn('[SurfacePanHandler] 当前处于地下模式，不应使用地上平移处理器');
      return false;
    }

    // 验证输入
    if (!this.validateInput(deltaX, 'deltaX') ||
        !this.validateInput(deltaY, 'deltaY') ||
        !this.validateInput(metersPerPixel, 'metersPerPixel')) {
      return false;
    }

    const Cesium = this.getCesium();
    if (!Cesium) {
      console.error('[SurfacePanHandler] Cesium 不可用');
      return false;
    }

    try {
      // 获取平移参数
      const panSpeed = this.syncManager.mouseOperationParams.panSpeed || 1.0;

      // 计算移动距离
      const distanceX = deltaX * metersPerPixel * panSpeed;
      const distanceY = deltaY * metersPerPixel * panSpeed;

      // 保存相机方向向量
      const savedDirection = Cesium.Cartesian3.clone(camera.direction);
      const savedUp = Cesium.Cartesian3.clone(camera.up);
      const savedRight = Cesium.Cartesian3.clone(camera.right);

      // 保存真正的高度（距椭球体表面的距离），而不是 ECEF 坐标系的 Y 坐标
      const scene = this.getCesiumViewer()?.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const cartographic = ellipsoid.cartesianToCartographic(camera.position);
      const savedHeight = cartographic.height;

      // 计算水平化的移动向量
      // 使用椭球体法向量作为"向上"参考，确保移动完全在水平面上
      const earthUp = ellipsoid.geodeticSurfaceNormal(camera.position, new Cesium.Cartesian3());

      // 计算水平化的 right 向量（左右方向）
      const dotRight = Cesium.Cartesian3.dot(camera.right, earthUp);
      const horizontalRight = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(earthUp, dotRight, horizontalRight);
      Cesium.Cartesian3.subtract(camera.right, horizontalRight, horizontalRight);
      Cesium.Cartesian3.normalize(horizontalRight, horizontalRight);

      // 计算水平化的 forward 向量（前后方向）
      const direction = new Cesium.Cartesian3();
      Cesium.Cartesian3.normalize(camera.direction, direction);
      const dotForward = Cesium.Cartesian3.dot(direction, earthUp);
      const horizontalForward = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(earthUp, dotForward, horizontalForward);
      Cesium.Cartesian3.subtract(direction, horizontalForward, horizontalForward);
      Cesium.Cartesian3.normalize(horizontalForward, horizontalForward);

      // 调试：输出向量信息
      console.log('[SurfacePanHandler] 平移向量:', {
        deltaX: deltaX.toFixed(2),
        deltaY: deltaY.toFixed(2),
        distanceX: distanceX.toFixed(2),
        distanceY: distanceY.toFixed(2),
        cameraRight: { x: camera.right.x.toFixed(4), y: camera.right.y.toFixed(4), z: camera.right.z.toFixed(4) },
        horizontalRight: { x: horizontalRight.x.toFixed(4), y: horizontalRight.y.toFixed(4), z: horizontalRight.z.toFixed(4) },
        cameraUp: { x: camera.up.x.toFixed(4), y: camera.up.y.toFixed(4), z: camera.up.z.toFixed(4) },
        earthUp: { x: earthUp.x.toFixed(4), y: earthUp.y.toFixed(4), z: earthUp.z.toFixed(4) }
      });

      // 手动实现平移：计算新的相机位置
      const newPosition = new Cesium.Cartesian3();
      const tempVector = new Cesium.Cartesian3();

      // X 轴：左右平移（沿水平化的 right 向量）
      if (distanceX !== 0) {
        Cesium.Cartesian3.multiplyByScalar(horizontalRight, distanceX, tempVector);
        Cesium.Cartesian3.add(camera.position, tempVector, newPosition);
        camera.position = newPosition;
      }

      // Y 轴：前后平移（沿水平化的 forward 向量）
      // 鼠标向上拖（deltaY < 0）时，相机向前移动（沿视野方向）
      // 鼠标向下拖（deltaY > 0）时，相机向后移动（沿视野反方向）
      if (distanceY !== 0) {
        Cesium.Cartesian3.multiplyByScalar(horizontalForward, -distanceY, tempVector);
        Cesium.Cartesian3.add(camera.position, tempVector, newPosition);
        camera.position = newPosition;
      }

      // 恢复高度：在新的位置上，调整到保存的高度
      const newCartographic = ellipsoid.cartesianToCartographic(camera.position);
      const adjustedCartographic = new Cesium.Cartographic(
        newCartographic.longitude,
        newCartographic.latitude,
        savedHeight
      );
      camera.position = ellipsoid.cartographicToCartesian(adjustedCartographic);

      // 验证高度是否正确恢复
      const finalCartographic = ellipsoid.cartesianToCartographic(camera.position);
      console.log('[SurfacePanHandler] 平移高度:', {
        保存: savedHeight.toFixed(3),
        恢复后: finalCartographic.height.toFixed(3),
        差异: (finalCartographic.height - savedHeight).toFixed(6)
      });

      // 恢复相机方向，防止旋转
      camera.direction = savedDirection;
      camera.up = savedUp;
      camera.right = savedRight;

      return true;
    } catch (error) {
      console.error('[SurfacePanHandler] 平移操作失败:', error);
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
    return '地上平移 - 使用 Cesium 原生 camera.move* API，上下平移沿水平面';
  }
}
