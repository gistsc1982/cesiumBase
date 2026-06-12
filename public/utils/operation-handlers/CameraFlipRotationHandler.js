/**
 * 历史版本相机翻转处理器
 * 基于相机up向量翻转的旋转逻辑（类似OrbitControls的实现）
 * 用于非ECEF坐标系的大坐标模型（平面地图模式）
 *
 * 与当前统一坐标系旋转的区别：
 * - 当前版本：绕世界X/Z轴旋转（统一坐标系EUS）
 * - 历史版本：基于相机up向量的本地坐标系旋转
 */

import * as THREE from 'three';
import { BaseOperationHandler } from './BaseOperationHandler.js';

export class CameraFlipRotationHandler extends BaseOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'rotate';
    this.mode = 'camera-flip'; // 标识为相机翻转模式

    // 旋转状态
    this._spherical = {
      radius: 0,
      phi: 0,      // 极角（仰角）：0 = 天顶, PI = 底部
      theta: 0     // 方位角：绕Y轴旋转
    };

    // 旋转增量（用于阻尼）
    this._sphericalDelta = {
      radius: 0,
      phi: 0,
      theta: 0
    };

    // 相机up向量和坐标转换四元数
    this._cameraUp = new THREE.Vector3(0, 1, 0);
    this._quat = null;      // 相机up到世界Y的旋转
    this._quatInverse = null;

    // 目标点
    this._target = new THREE.Vector3(0, 0, 0);

    console.log('[CameraFlipRotationHandler] 历史版本相机翻转处理器已初始化');
  }

  /**
   * 检查是否应该使用相机翻转模式
   * @returns {boolean} true 表示应该使用相机翻转
   */
  shouldUseCameraFlip() {
    // 检查是否在局部坐标系模式（非ECEF）
    const isUsingLocalCoord = this.syncManager?.mercatorProjection?.isUsingLocalCoordinateSystem?.() ??
                              this.syncManager?.mercatorProjectionManager?.isUsingLocalCoordinateSystem?.() ?? false;

    // 检查是否有Cesium球体
    const hasCesiumGlobe = typeof window !== 'undefined' &&
                           window.__cesiumViewer__ &&
                           window.__cesiumViewer__.scene?.globe;

    // 检查模型是否有ECEF坐标信息
    const hasECEFData = this._checkModelHasECEFData();

    const shouldFlip = isUsingLocalCoord || !hasCesiumGlobe || !hasECEFData;

    console.log('[CameraFlipRotationHandler] 模式检测:', {
      isUsingLocalCoord,
      hasCesiumGlobe,
      hasECEFData,
      shouldUseCameraFlip: shouldFlip
    });

    return shouldFlip;
  }

  /**
   * 检查模型是否具有ECEF坐标数据
   * @returns {boolean}
   * @private
   */
  _checkModelHasECEFData() {
    // 从选中的模型检查
    const selectedModel = this._getSelectedModel();
    if (!selectedModel) return false;

    // 检查userData中的ECEF相关字段
    const userData = selectedModel.userData || {};
    return !!(userData.ecefPosition ||
             userData.longitude !== undefined ||
             userData.latitude !== undefined ||
             userData.cartographic);
  }

  /**
   * 获取当前选中的模型
   * @returns {THREE.Object3D|null}
   * @private
   */
  _getSelectedModel() {
    // 尝试从多个来源获取选中的模型
    if (typeof window !== 'undefined') {
      if (window.DualCanvasViewer) {
        return window.DualCanvasViewer.selectedModel1 ||
               window.DualCanvasViewer.selectedModel2;
      }
      if (window.__dualCanvasViewer__) {
        return window.__dualCanvasViewer__.selectedModel1 ||
               window.__dualCanvasViewer__.selectedModel2;
      }
    }
    return null;
  }

  /**
   * 初始化旋转状态（从当前相机状态）
   * @private
   */
  _initializeFromCameraState() {
    const state = this.syncManager.unifiedCameraState;
    if (!state) {
      console.error('[CameraFlipRotationHandler] 统一坐标系状态不可用');
      return false;
    }

    // 设置相机up向量
    this._cameraUp.set(state.up.x, state.up.y, state.up.z);

    // 创建四元数：从相机up到世界Y轴(0,1,0)
    this._quat = new THREE.Quaternion().setFromUnitVectors(
      this._cameraUp,
      new THREE.Vector3(0, 1, 0)
    );
    this._quatInverse = this._quat.clone().invert();

    // 设置目标点
    this._target.set(state.target.x, state.target.y, state.target.z);

    // 计算球形坐标
    const offset = new THREE.Vector3(
      state.position.x - state.target.x,
      state.position.y - state.target.y,
      state.position.z - state.target.z
    );

    // 旋转到"y轴向上"空间
    offset.applyQuaternion(this._quat);

    // 设置球形坐标
    this._spherical.radius = offset.length();
    this._spherical.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / this._spherical.radius)));
    this._spherical.theta = Math.atan2(offset.x, offset.z);

    console.log('[CameraFlipRotationHandler] 初始化完成:', {
      radius: this._spherical.radius.toFixed(2),
      phi: (this._spherical.phi * 180 / Math.PI).toFixed(1) + '°',
      theta: (this._spherical.theta * 180 / Math.PI).toFixed(1) + '°',
      cameraUp: `(${this._cameraUp.x.toFixed(3)}, ${this._cameraUp.y.toFixed(3)}, ${this._cameraUp.z.toFixed(3)})`
    });

    return true;
  }

  /**
   * 执行翻转操作
   * @param {number} deltaX - X轴移动量
   * @param {number} deltaY - Y轴移动量
   */
  execute(deltaX, deltaY) {
    // 验证输入
    if (!this.validateInput(deltaX, 'deltaX') || !this.validateInput(deltaY, 'deltaY')) {
      return false;
    }

    // 检查是否应该使用相机翻转模式
    if (!this.shouldUseCameraFlip()) {
      console.warn('[CameraFlipRotationHandler] 当前不支持相机翻转模式，请使用统一坐标系旋转');
      return false;
    }

    // 执行操作前准备
    const context = this.beforeOperation(this.operationType);
    if (!context) {
      return false;
    }

    try {
      // 初始化旋转状态
      if (!this._initializeFromCameraState()) {
        return false;
      }

      // 执行翻转
      this.performRotation(deltaX, deltaY);

      // 应用旋转到相机状态
      this._applyRotationToCamera();

      return true;
    } catch (error) {
      console.error('[CameraFlipRotationHandler] 翻转操作失败:', error);
      return false;
    } finally {
      // 执行操作后清理
      this.afterOperation(context);
    }
  }

  /**
   * 执行具体的翻转操作
   * @param {number} deltaX - X轴移动量
   * @param {number} deltaY - Y轴移动量
   */
  performRotation(deltaX, deltaY) {
    const rotateSpeed = this.getRotateSpeed();

    // 计算旋转角度
    // 左右旋转：改变theta（方位角）
    const thetaDelta = -deltaX * rotateSpeed;
    // 上下旋转：改变phi（极角）
    const phiDelta = -deltaY * rotateSpeed;

    // 更新球形坐标增量
    this._sphericalDelta.theta += thetaDelta;
    this._sphericalDelta.phi += phiDelta;

    // 应用旋转限制
    this._applyRotationLimits();

    // 更新球形坐标
    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;

    // 限制phi范围（避免万向节死锁）
    this._spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, this._spherical.phi));

    console.log('[CameraFlipRotationHandler] 旋转增量:', {
      thetaDelta: (thetaDelta * 180 / Math.PI).toFixed(2) + '°',
      phiDelta: (phiDelta * 180 / Math.PI).toFixed(2) + '°',
      newTheta: (this._spherical.theta * 180 / Math.PI).toFixed(1) + '°',
      newPhi: (this._spherical.phi * 180 / Math.PI).toFixed(1) + '°'
    });
  }

  /**
   * 应用旋转限制
   * @private
   */
  _applyRotationLimits() {
    // 检查是否需要限制翻转
    const state = this.syncManager.unifiedCameraState;
    if (!state) return;

    const position = state.position;
    const isUnderground = this.detector.isUnderground(position);

    if (isUnderground) {
      // 地下模式：允许更大的翻转范围
      this._sphericalDelta.phi = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, this._sphericalDelta.phi)
      );
    } else {
      // 地上模式：限制不能翻转到地底
      const maxPhi = Math.PI / 2 - 0.01; // 略小于90度
      if (this._spherical.phi + this._sphericalDelta.phi > maxPhi) {
        this._sphericalDelta.phi = Math.max(0, maxPhi - this._spherical.phi);
      }
    }
  }

  /**
   * 应用旋转到相机状态
   * @private
   */
  _applyRotationToCamera() {
    const state = this.syncManager.unifiedCameraState;
    if (!state) {
      console.error('[CameraFlipRotationHandler] 无法应用旋转：统一坐标系状态不可用');
      return;
    }

    // 从球形坐标重建偏移向量
    const offset = new THREE.Vector3().setFromSpherical(
      this._spherical.radius,
      this._spherical.phi,
      this._spherical.theta
    );

    // 旋转回"相机up是向上"的空间
    offset.applyQuaternion(this._quatInverse);

    // 更新相机位置
    state.position = {
      x: this._target.x + offset.x,
      y: this._target.y + offset.y,
      z: this._target.z + offset.z
    };

    // 重建方向向量
    state.direction = this.normalize({
      x: -offset.x,
      y: -offset.y,
      z: -offset.z
    });

    // 重建正交基
    this.rebuildOrthonormalBasis(state);

    console.log('[CameraFlipRotationHandler] 旋转已应用到相机:', {
      position: `(${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)}, ${state.position.z.toFixed(1)})`,
      direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`
    });
  }

  /**
   * 获取翻转速度
   * @returns {number}
   */
  getRotateSpeed() {
    return this.syncManager.mouseOperationParams.rotateSpeed || 0.001;
  }

  /**
   * 获取操作描述
   * @returns {string}
   */
  getDescription() {
    return '历史版本相机翻转 - 基于相机up向量的本地坐标系旋转';
  }

  // ========== 向量工具方法 ==========

  normalize(v) {
    if (!v || typeof v.x !== 'number') return { x: 0, y: 1, z: 0 };

    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 0.0001) return { x: 0, y: 1, z: 0 };

    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  rebuildOrthonormalBasis(state) {
    // 归一化方向向量
    state.direction = this.normalize(state.direction);

    // 计算右向量
    let cross = this.cross(state.direction, state.up);
    const crossLength = this.vectorLength(cross);

    if (crossLength < 0.001) {
      // 方向向量与上向量平行
      const worldX = { x: 1, y: 0, z: 0 };
      cross = this.cross(state.direction, worldX);
      const crossLength2 = this.vectorLength(cross);

      if (crossLength2 < 0.001) {
        const worldZ = { x: 0, y: 0, z: 1 };
        cross = this.cross(state.direction, worldZ);
      }

      state.right = this.normalize(cross);
    } else {
      state.right = this.normalize(cross);
    }

    // 重新计算上向量
    state.up = this.normalize(this.cross(state.right, state.direction));
  }

  cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  validateInput(value, name) {
    if (typeof value !== 'number' || !isFinite(value)) {
      console.warn(`[CameraFlipRotationHandler] 无效的${name}:`, value);
      return false;
    }
    return true;
  }

  beforeOperation(operationType) {
    const mode = this.getCurrentMode();
    const canExecute = this.canExecute(operationType, mode);

    if (!canExecute) {
      console.warn(`[CameraFlipRotationHandler] 操作被锁定: ${operationType} / ${mode}`);
      return null;
    }

    this.setOperationLock(operationType, mode);

    return {
      operationType,
      mode,
      startTime: Date.now()
    };
  }

  afterOperation(context) {
    if (context) {
      this.releaseOperationLock(context.operationType, context.mode);
    }
  }
}
