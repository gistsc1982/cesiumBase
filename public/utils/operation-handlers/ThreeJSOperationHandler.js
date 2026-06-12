/**
 * Three.js 相机操作基础处理器
 * 直接操作 Three.js 相机对象，而非 Cesium 相机
 */

import * as THREE from 'three';
import { BaseOperationHandler } from './BaseOperationHandler.js';

export class ThreeJSOperationHandler extends BaseOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.threeCamera = null;
    this.threeControls = null;
  }

  /**
   * 设置 Three.js 对象
   * @param {THREE.Camera} camera - Three.js 相机
   * @param {THREE.OrbitControls} controls - Three.js OrbitControls
   */
  setThreeObjects(camera, controls) {
    this.threeCamera = camera;
    this.threeControls = controls;
  }

  /**
   * 获取 Three.js 相机
   * @returns {THREE.Camera|null}
   */
  getThreeCamera() {
    return this.threeCamera;
  }

  /**
   * 获取 Three.js 控制器
   * @returns {THREE.OrbitControls|null}
   */
  getThreeControls() {
    return this.threeControls;
  }

  /**
   * 子类实现此方法
   * @param {...any} args - 操作参数
   * @returns {boolean} 操作是否成功
   */
  performThreeJSOperation(...args) {
    throw new Error('子类必须实现 performThreeJSOperation 方法');
  }

  /**
   * 执行操作
   * @param {...any} args - 操作参数
   * @returns {boolean} 操作是否成功
   */
  execute(...args) {
    if (!this.threeCamera || !this.threeControls) {
      console.error('[ThreeJSOperationHandler] Three.js 对象未设置');
      return false;
    }

    const context = this.beforeOperation(this.operationType);
    if (!context) return false;

    try {
      return this.performThreeJSOperation(...args);
    } catch (error) {
      console.error(`[${this.constructor.name}] 操作失败:`, error);
      return false;
    } finally {
      this.afterOperation(context);
    }
  }

  /**
   * 获取相机方向向量
   * @returns {THREE.Vector3} 归一化的方向向量
   */
  getCameraDirection() {
    if (!this.threeCamera) return new THREE.Vector3(0, 0, -1);
    const direction = new THREE.Vector3();
    this.threeCamera.getWorldDirection(direction);
    return direction;
  }

  /**
   * 获取相机右向量
   * @returns {THREE.Vector3} 归一化的右向量
   */
  getCameraRight() {
    if (!this.threeCamera) return new THREE.Vector3(1, 0, 0);
    const right = new THREE.Vector3();
    this.threeCamera.getWorldDirection(right);
    right.cross(this.threeCamera.up).normalize();
    return right;
  }

  /**
   * 获取相机到目标的距离
   * @returns {number} 距离
   */
  getDistanceToTarget() {
    if (!this.threeCamera || !this.threeControls) return 0;
    return this.threeCamera.position.distanceTo(this.threeControls.target);
  }

  /**
   * 验证 Three.js 对象是否已设置
   * @returns {boolean} 是否已设置
   */
  isReady() {
    return this.threeCamera !== null && this.threeControls !== null;
  }
}
