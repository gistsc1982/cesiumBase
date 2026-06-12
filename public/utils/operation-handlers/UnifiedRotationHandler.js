/**
 * 统一坐标系翻转处理器基类
 * 使用统一坐标系模式，优先使用笛卡尔坐标计算
 * 为地上和地下翻转提供基础实现
 */

import { BaseOperationHandler } from './BaseOperationHandler.js';
import { LargeCoordinateGuard } from '../LargeCoordinateGuard.js';

export class UnifiedRotationHandler extends BaseOperationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.operationType = 'rotate';
    // 大坐标检查缓存（避免频繁检测）
    this._largeCoordCheckCache = { timestamp: 0, result: null };
  }

  /**
   * 执行翻转操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   */
  execute(deltaX, deltaY) {
    // 验证输入
    if (!this.validateInput(deltaX, 'deltaX') || !this.validateInput(deltaY, 'deltaY')) {
      return false;
    }

    // ⚠️ 大坐标状态检查
    const checkResult = this._checkLargeCoordinateState();
    if (!checkResult.allowed) {
      LargeCoordinateGuard.showBlockedMessage('rotate', checkResult.reason);
      return false;
    }

    // 执行操作前准备
    const context = this.beforeOperation(this.operationType);
    if (!context) {
      return false;
    }

    try {
      // 执行翻转
      this.performRotation(deltaX, deltaY);
      return true;
    } catch (error) {
      console.error('[UnifiedRotationHandler] 翻转操作失败:', error);
      return false;
    } finally {
      // 执行操作后清理
      this.afterOperation(context);
    }
  }

  /**
   * 检查大坐标状态（带缓存）
   * @returns {Object} { allowed: boolean, reason?: string }
   * @private
   */
  _checkLargeCoordinateState() {
    // 使用缓存（1秒内有效）
    const now = Date.now();
    if (this._largeCoordCheckCache.result && now - this._largeCoordCheckCache.timestamp < 1000) {
      return this._largeCoordCheckCache.result;
    }

    // 获取模型组（从 DualCanvasViewer）
    const modelGroup = this._getModelGroup();
    if (!modelGroup) {
      const result = {
        allowed: true, // 如果无法获取模型组，允许操作
        reason: null
      };
      this._largeCoordCheckCache = { timestamp: now, result };
      return result;
    }

    // 执行检查
    const result = LargeCoordinateGuard.checkOperationAllowed(
      { mercatorProjectionManager: this.syncManager?.mercatorProjection },
      modelGroup,
      'rotate'
    );

    // 缓存结果
    this._largeCoordCheckCache = { timestamp: now, result };
    return result;
  }

  /**
   * 获取模型组
   * @returns {THREE.Group|null}
   * @private
   */
  _getModelGroup() {
    // 尝试从 window.DualCanvasViewer 获取
    if (typeof window !== 'undefined' && window.DualCanvasViewer) {
      return window.DualCanvasViewer.modelGroup1 || null;
    }

    // 尝试从 Vue 实例获取
    if (typeof window !== 'undefined' && window.__dualCanvasViewer__) {
      return window.__dualCanvasViewer__.modelGroup1 || null;
    }

    return null;
  }

  /**
   * 执行具体的翻转操作（由子类实现）
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   */
  performRotation(deltaX, deltaY) {
    throw new Error('子类必须实现 performRotation 方法');
  }

  /**
   * 获取翻转速度
   * @returns {number} 翻转速度
   */
  getRotateSpeed() {
    return this.syncManager.mouseOperationParams.rotateSpeed || 0.001;
  }

  /**
   * 计算俯仰角
   * @param {number} deltaY - Y 轴移动量
   * @returns {number} 俯仰角（弧度）
   */
  calculatePitchAngle(deltaY) {
    return deltaY * this.getRotateSpeed();
  }

  /**
   * 计算偏航角
   * @param {number} deltaX - X 轴移动量
   * @returns {number} 偏航角（弧度）
   */
  calculateYawAngle(deltaX) {
    return deltaX * this.getRotateSpeed();
  }

  /**
   * 判断是否为垂直视角
   * @param {Object} direction - 方向向量
   * @returns {boolean} true 表示垂直视角
   */
  isVerticalView(direction) {
    const dotY = this.dot(direction, { x: 0, y: 1, z: 0 });
    return Math.abs(dotY) > 0.999;
  }

  /**
   * 判断是否向下看
   * @param {Object} direction - 方向向量
   * @returns {boolean} true 表示向下看
   */
  isLookingDown(direction) {
    return direction.y < 0;
  }

  /**
   * 判断是否接近垂直向下
   * @param {Object} direction - 方向向量
   * @returns {boolean} true 表示接近垂直向下
   */
  isNearlyVerticalDown(direction) {
    const dotY = this.dot(direction, { x: 0, y: 1, z: 0 });
    return this.isLookingDown(direction) && Math.abs(dotY) > 0.9;
  }

  /**
   * 绕水平轴旋转（俯仰）
   * @param {Object} direction - 方向向量
   * @param {number} pitchAngle - 俯仰角
   * @param {Object} right - 右向量
   * @returns {Object} 旋转后的方向向量
   */
  pitch(direction, pitchAngle, right) {
    if (this.isVerticalView(direction)) {
      // 垂直视角时，绕世界 X 轴旋转
      const worldX = { x: 1, y: 0, z: 0 };
      return this.rotateAroundAxis(direction, worldX, -pitchAngle);
    } else {
      // 正常情况下，绕右向量旋转
      return this.rotateAroundAxis(direction, right, -pitchAngle);
    }
  }

  /**
   * 绕垂直轴旋转（偏航）
   * @param {Object} direction - 方向向量
   * @param {number} yawAngle - 偏航角
   * @param {Object} up - 上向量
   * @param {Object} right - 右向量
   * @returns {Object} 旋转后的方向向量
   */
  yaw(direction, yawAngle, up, right) {
    if (this.isVerticalView(direction)) {
      // 垂直视角时，绕世界 Z 轴旋转
      const worldZ = { x: 0, y: 0, z: 1 };
      return this.rotateAroundAxis(direction, worldZ, -yawAngle);
    } else if (this.isNearlyVerticalDown(direction)) {
      // 接近垂直向下时，使用右向量作为旋转轴
      return this.rotateAroundAxis(direction, right, -yawAngle);
    } else {
      // 正常情况下，绕上向量旋转
      return this.rotateAroundAxis(direction, up, -yawAngle);
    }
  }

  /**
   * 重建正交基
   * @param {Object} state - 统一坐标系状态
   */
  rebuildOrthonormalBasis(state) {
    // 归一化方向向量
    state.direction = this.normalize(state.direction);

    // 计算右向量
    let cross = this.cross(state.direction, state.up);
    const crossLength = this.vectorLength(cross);

    if (crossLength < 0.001) {
      // 方向向量与上向量平行，尝试其他轴
      const worldX = { x: 1, y: 0, z: 0 };
      cross = this.cross(state.direction, worldX);
      const crossLength2 = this.vectorLength(cross);

      if (crossLength2 < 0.001) {
        // 尝试世界 Z 轴
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

  /**
   * 更新相机位置
   * @param {Object} state - 统一坐标系状态
   */
  updateCameraPosition(state) {
    const distance = state.height;

    // 更新位置
    state.position = {
      x: state.target.x + state.direction.x * distance,
      y: state.target.y + state.direction.y * distance,
      z: state.target.z + state.direction.z * distance
    };
  }

  /**
   * 修正目标点 Y 坐标
   * @param {Object} state - 统一坐标系状态
   * @param {boolean} isUnderground - 是否为地下模式
   */
  fixTargetY(state, isUnderground) {
    // 在地下模式下，不强制修正 target.y
    // 在地上模式下，强制将 target.y 设置为 0
    if (!isUnderground) {
      state.target.y = 0;
    }
  }
}
