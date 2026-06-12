/**
 * Three.js 平移处理器
 * 沿用 d3d6a9c 版本的平移逻辑
 * 地上/地下行为：上下平移沿水平面移动
 */

import * as THREE from 'three';
import { ThreeJSOperationHandler } from './ThreeJSOperationHandler.js';

export class ThreeJSPanHandler extends ThreeJSOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'pan';
  }

  /**
   * 执行 Three.js 平移操作
   * @param {number} deltaX - X 轴移动量（像素）
   * @param {number} deltaY - Y 轴移动量（像素）
   * @param {number} metersPerPixel - 每像素代表的米数
   * @returns {boolean} 操作是否成功
   */
  performThreeJSOperation(deltaX, deltaY, metersPerPixel) {
    const camera = this.getThreeCamera();
    const controls = this.getThreeControls();

    if (!camera || !controls) return false;

    const panSpeed = this.syncManager.mouseOperationParams.panSpeed || 1.0;
    const distanceX = deltaX * metersPerPixel * panSpeed;
    const distanceY = deltaY * metersPerPixel * panSpeed;

    // X 轴：左右平移（沿相机右向量）
    if (Math.abs(distanceX) > 0.001) {
      const right = new THREE.Vector3();
      camera.getWorldDirection(right);
      right.cross(camera.up).normalize();

      const offsetX = right.clone().multiplyScalar(distanceX);
      camera.position.add(offsetX);
      controls.target.add(offsetX);
    }

    // Y 轴：前后平移（沿水平面投影）
    if (Math.abs(distanceY) > 0.001) {
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);

      // 计算水平面投影（忽略 Y 分量）
      const horizontalDirection = new THREE.Vector3(direction.x, 0, direction.z);
      const length = horizontalDirection.length();

      if (length > 0.001) {
        horizontalDirection.normalize();
      } else {
        // 如果方向向量几乎垂直，使用 Z 轴负方向作为默认前进方向
        horizontalDirection.set(0, 0, -1);
      }

      // 负号：鼠标向上移动时相机向前
      const moveAmount = -distanceY;
      const offsetZ = horizontalDirection.clone().multiplyScalar(moveAmount);

      // 只修改 X 和 Z，保持 Y 不变（实现水平面平移）
      camera.position.x += offsetZ.x;
      camera.position.z += offsetZ.z;
      controls.target.x += offsetZ.x;
      controls.target.z += offsetZ.z;
    }

    return true;
  }
}
