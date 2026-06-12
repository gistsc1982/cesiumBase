/**
 * Three.js 缩放处理器
 * 沿用 d3d6a9c 版本的缩放逻辑
 * 地上/地下行为：沿视线方向移动
 */

import * as THREE from 'three';
import { ThreeJSOperationHandler } from './ThreeJSOperationHandler.js';

export class ThreeJSZoomHandler extends ThreeJSOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'zoom';
  }

  /**
   * 执行 Three.js 缩放操作
   * @param {number} deltaZoom - 缩放量
   * @returns {boolean} 操作是否成功
   */
  performThreeJSOperation(deltaZoom) {
    const camera = this.getThreeCamera();
    const controls = this.getThreeControls();

    if (!camera || !controls) return false;

    const zoomSpeed = this.syncManager.mouseOperationParams.zoomSpeed || 0.1;
    const zoomFactor = 1 + deltaZoom * zoomSpeed;

    // 计算缩放距离
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    // 获取当前相机到目标的距离
    const distance = camera.position.distanceTo(controls.target);
    const newDistance = distance / zoomFactor;

    // 限制缩放范围
    const minDistance = 10;
    const maxDistance = 50000;
    const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistance));

    // 计算新的相机位置
    const moveDistance = distance - clampedDistance;
    const offset = direction.clone().multiplyScalar(moveDistance);

    camera.position.add(offset);

    return true;
  }
}
