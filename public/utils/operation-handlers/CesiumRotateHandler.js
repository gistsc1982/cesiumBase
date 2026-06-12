/**
 * Cesium 原生旋转处理器基类
 * 直接操作 Cesium 相机进行旋转
 * 与平移和缩放使用相同的架构
 */

import { CesiumBasedOperationHandler } from './CesiumBasedOperationHandler.js';

export class CesiumRotateHandler extends CesiumBasedOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'rotate';
    this.handlerOperationType = 'rotate';
  }

  /**
   * 执行旋转操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   * @returns {boolean} 操作是否成功
   */
  performCesiumOperation(deltaX, deltaY) {
    const camera = this.getCesiumCamera();
    if (!camera) {
      console.error('[CesiumRotateHandler] Cesium Camera 不可用');
      return false;
    }

    const Cesium = this.getCesium();
    if (!Cesium) {
      console.error('[CesiumRotateHandler] Cesium 不可用');
      return false;
    }

    // 验证相机位置
    if (!this.validateCameraPosition()) {
      console.warn('[CesiumRotateHandler] 相机位置无效，跳过旋转操作');
      return false;
    }

    // 验证输入
    if (!this.validateInput(deltaX, 'deltaX') || !this.validateInput(deltaY, 'deltaY')) {
      return false;
    }

    try {
      const rotateSpeed = this.syncManager.mouseOperationParams.rotateSpeed || 0.001;

      // 计算旋转角度
      const yawAngle = deltaX * rotateSpeed;   // 偏航角（左右旋转）
      const pitchAngle = deltaY * rotateSpeed; // 俯仰角（上下旋转）

      // 保存当前位置（用于围绕目标点旋转）
      const scene = this.getCesiumViewer()?.scene;
      const ellipsoid = scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;

      // 验证相机的方向和右向量
      if (!this.validateCartesian3(camera.direction) || !this.validateCartesian3(camera.right)) {
        console.warn('[CesiumRotateHandler] 相机方向向量无效，重置相机方向');
        this.resetCameraOrientation(camera);
        return false;
      }

      // 计算目标点（相机视线与椭球体的交点）
      let targetPosition;
      try {
        const ray = new Cesium.Ray(camera.position, camera.direction);
        const intersection = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (Cesium.defined(intersection) && this.validateCartesian3(intersection)) {
          targetPosition = intersection;
        } else {
          // 如果没有交点，使用相机正下方的地表点
          const cartographic = ellipsoid.cartesianToCartographic(camera.position);
          if (!cartographic || !isFinite(cartographic.longitude) || !isFinite(cartographic.latitude)) {
            console.warn('[CesiumRotateHandler] 无法计算地理坐标，跳过旋转');
            return false;
          }
          targetPosition = ellipsoid.cartographicToCartesian(
            new Cesium.Cartographic(cartographic.longitude, cartographic.latitude, 0)
          );
        }
      } catch (e) {
        console.warn('[CesiumRotateHandler] 计算目标点失败:', e);
        return false;
      }

      // 验证计算出的目标点
      if (!this.validateCartesian3(targetPosition)) {
        console.warn('[CesiumRotateHandler] 目标点无效，使用相机位置作为旋转中心');
        targetPosition = Cesium.Cartesian3.clone(camera.position, new Cesium.Cartesian3());
      }

      // 围绕目标点旋转相机
      // 1. 先俯仰（绕右向量）
      if (Math.abs(pitchAngle) > 0.0001) {
        if (!this.validateCartesian3(camera.right)) {
          console.warn('[CesiumRotateHandler] 右向量无效，跳过俯仰旋转');
        } else {
          this.rotateAroundPoint(camera, targetPosition, camera.right, pitchAngle);
        }
      }

      // 2. 再偏航（绕世界 Y 轴）
      if (Math.abs(yawAngle) > 0.0001) {
        // 计算世界向上向量
        let worldUp;
        try {
          worldUp = ellipsoid.geodeticSurfaceNormal(camera.position, new Cesium.Cartesian3());
        } catch (e) {
          console.warn('[CesiumRotateHandler] 计算地表面法线失败:', e);
          // 使用默认的上向量（地球 Y 轴方向）
          worldUp = new Cesium.Cartesian3(0, 1, 0);
        }

        // 验证 worldUp
        if (!this.validateCartesian3(worldUp)) {
          console.warn('[CesiumRotateHandler] 世界上向量无效，使用默认值');
          worldUp = new Cesium.Cartesian3(0, 1, 0);
        }

        this.rotateAroundPoint(camera, targetPosition, worldUp, yawAngle);
      }

      return true;
    } catch (error) {
      console.error('[CesiumRotateHandler] 旋转操作失败:', error);
      return false;
    }
  }

  /**
   * 围绕指定点和轴旋转相机
   * @param {Object} camera - Cesium 相机
   * @param {Object} point - 旋转中心点（Cartesian3）
   * @param {Object} axis - 旋转轴（Cartesian3）
   * @param {number} angle - 旋转角度（弧度）
   */
  rotateAroundPoint(camera, point, axis, angle) {
    const Cesium = this.getCesium();

    // 验证输入参数
    if (!this.validateCartesian3(point) || !this.validateCartesian3(axis)) {
      console.warn('[CesiumRotateHandler] 旋转参数无效，跳过旋转');
      return false;
    }

    // 1. 将相机位置相对于旋转点平移到原点
    const offset = new Cesium.Cartesian3();
    Cesium.Cartesian3.subtract(camera.position, point, offset);

    // 2. 创建旋转矩阵（使用 Quaternion 兼容性更好）
    const rotationMatrix = new Cesium.Matrix3();
    if (typeof Cesium.Matrix3.fromAxisAngle === 'function') {
      Cesium.Matrix3.fromAxisAngle(axis, angle, rotationMatrix);
    } else {
      // 备用方案：使用 Quaternion 然后转换为 Matrix3
      const quaternion = Cesium.Quaternion.fromAxisAngle(axis, angle);
      Cesium.Matrix3.fromQuaternion(quaternion, rotationMatrix);
    }

    // 3. 旋转偏移向量
    const rotatedOffset = new Cesium.Cartesian3();
    Cesium.Matrix3.multiplyByVector(rotationMatrix, offset, rotatedOffset);

    // 4. 将旋转后的偏移向量加回旋转点
    const newPosition = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(point, rotatedOffset, newPosition);

    // 验证新位置是否有效
    if (!this.isFiniteCartesian3(newPosition)) {
      console.warn('[CesiumRotateHandler] 旋转后位置无效，跳过此次旋转');
      return false;
    }
    camera.position = newPosition;

    // 5. 旋转方向向量
    const rotatedDirection = new Cesium.Cartesian3();
    Cesium.Matrix3.multiplyByVector(rotationMatrix, camera.direction, rotatedDirection);
    Cesium.Cartesian3.normalize(rotatedDirection, rotatedDirection);
    camera.direction = rotatedDirection;

    // 6. 旋转 up 向量
    const rotatedUp = new Cesium.Cartesian3();
    Cesium.Matrix3.multiplyByVector(rotationMatrix, camera.up, rotatedUp);
    Cesium.Cartesian3.normalize(rotatedUp, rotatedUp);
    camera.up = rotatedUp;

    // 7. 重新计算 right 向量（修复：处理平行向量情况）
    const newRight = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(camera.direction, camera.up, newRight);

    // 检查叉积是否有效（方向和上向量可能平行）
    const magnitude = Cesium.Cartesian3.magnitude(newRight);
    if (magnitude < 0.0001) {
      // 方向和上向量平行，需要重新构建正交坐标系
      console.warn('[CesiumRotateHandler] 方向和上向量平行，重新构建正交坐标系');
      this.reorthogonalizeCamera(camera);
    } else {
      Cesium.Cartesian3.normalize(newRight, newRight);
      camera.right = newRight;
    }

    return true;
  }

  /**
   * 验证 Cartesian3 是否有效
   * @param {Object} vec - Cartesian3 对象
   * @returns {boolean} 是否有效
   */
  validateCartesian3(vec) {
    if (!vec || typeof vec.x !== 'number' || typeof vec.y !== 'number' || typeof vec.z !== 'number') {
      return false;
    }
    return isFinite(vec.x) && isFinite(vec.y) && isFinite(vec.z);
  }

  /**
   * 检查 Cartesian3 的所有分量是否有限
   * @param {Object} vec - Cartesian3 对象
   * @returns {boolean} 是否有限
   */
  isFiniteCartesian3(vec) {
    if (!vec) return false;
    return isFinite(vec.x) && isFinite(vec.y) && isFinite(vec.z);
  }

  /**
   * 重新正交化相机坐标系
   * 当方向和上向量平行时调用
   * @param {Object} camera - Cesium 相机
   */
  reorthogonalizeCamera(camera) {
    const Cesium = this.getCesium();

    // direction 保持不变（已归一化）
    const direction = new Cesium.Cartesian3();
    Cesium.Cartesian3.clone(camera.direction, direction);

    // 找一个与 direction 不共线的向量作为临时上向量
    const tempUp = new Cesium.Cartesian3();
    if (Math.abs(direction.x) < 0.9) {
      tempUp.x = 1; tempUp.y = 0; tempUp.z = 0;
    } else {
      tempUp.x = 0; tempUp.y = 1; tempUp.z = 0;
    }

    // 计算新的 right 向量
    const newRight = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(direction, tempUp, newRight);
    Cesium.Cartesian3.normalize(newRight, newRight);
    camera.right = newRight;

    // 计算新的 up 向量
    const newUp = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(newRight, direction, newUp);
    Cesium.Cartesian3.normalize(newUp, newUp);
    camera.up = newUp;
  }

  /**
   * 重置相机方向为默认值
   * 当相机方向向量无效时调用
   * @param {Object} camera - Cesium 相机
   */
  resetCameraOrientation(camera) {
    const Cesium = this.getCesium();

    // 设置默认的方向向量（朝向地心）
    const defaultDirection = new Cesium.Cartesian3();
    Cesium.Cartesian3.negate(camera.position, defaultDirection);
    Cesium.Cartesian3.normalize(defaultDirection, defaultDirection);
    camera.direction = defaultDirection;

    // 设置默认的上向量（地球 Y 轴方向）
    const defaultUp = new Cesium.Cartesian3(0, 1, 0);
    camera.up = defaultUp;

    // 计算右向量
    const defaultRight = new Cesium.Cartesian3();
    Cesium.Cartesian3.cross(camera.direction, camera.up, defaultRight);
    Cesium.Cartesian3.normalize(defaultRight, defaultRight);
    camera.right = defaultRight;

    console.warn('[CesiumRotateHandler] 相机方向已重置为默认值');
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
    return true;
  }

  /**
   * 获取操作描述
   * @returns {string} 操作描述
   */
  getDescription() {
    return 'Cesium 原生旋转 - 直接操作 Cesium 相机';
  }
}

/**
 * 地上模式旋转处理器
 */
export class SurfaceCesiumRotateHandler extends CesiumRotateHandler {
  constructor(syncManager) {
    super(syncManager);
    this.mode = 'surface';
  }

  canExecute() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return false;
    }
    // 检查是否为地上模式
    return !this.isCameraUnderground();
  }

  getDescription() {
    return '地上旋转 - Cesium 原生 API';
  }
}

/**
 * 地下模式旋转处理器
 */
export class UndergroundCesiumRotateHandler extends CesiumRotateHandler {
  constructor(syncManager) {
    super(syncManager);
    this.mode = 'underground';
  }

  canExecute() {
    const camera = this.getCesiumCamera();
    if (!camera) {
      return false;
    }
    // 检查是否为地下模式
    return this.isCameraUnderground();
  }

  getDescription() {
    return '地下旋转 - Cesium 原生 API';
  }
}
