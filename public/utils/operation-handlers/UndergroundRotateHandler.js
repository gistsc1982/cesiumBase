/**
 * 地下翻转处理器
 * 处理地下模式的翻转操作（position.y < -50）
 * 使用统一坐标系和笛卡尔坐标计算
 */

import { UnifiedRotationHandler } from './UnifiedRotationHandler.js';

export class UndergroundRotateHandler extends UnifiedRotationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.mode = 'underground';
  }

  /**
   * 执行地下翻转操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   */
  performRotation(deltaX, deltaY) {
    const state = this.syncManager.unifiedCameraState;

    // 验证状态
    if (!state) {
      console.error('[UndergroundRotateHandler] 统一坐标系状态不可用');
      return false;
    }

    // 验证是否为地下模式
    const position = state.position;
    if (!this.detector.isUnderground(position)) {
      console.warn('[UndergroundRotateHandler] 当前处于地上模式，不应使用地下翻转处理器');
      return false;
    }

    const originalTarget = { ...state.target };
    const originalPositionY = state.position.y;

    // 计算俯仰角和偏航角
    const pitchAngle = this.calculatePitchAngle(deltaY);
    const yawAngle = this.calculateYawAngle(deltaX);

    // 执行翻转（围绕当前目标点）
    // 绕水平轴旋转（俯仰）
    state.direction = this.pitch(state.direction, pitchAngle, state.right);

    // 绕垂直轴旋转（偏航）
    state.direction = this.yaw(state.direction, yawAngle, state.up, state.right);

    // 归一化方向向量
    state.direction = this.normalize(state.direction);

    // 重建正交基
    this.rebuildOrthonormalBasis(state);

    // 地下模式：保持 target.y 不变
    state.target.y = originalTarget.y;

    // 更新相机位置
    this.updateCameraPosition(state);

    // 验证：地下模式保持 position.y 为负
    if (state.position.y > 0) {
      console.warn('⚠️ [UndergroundRotateHandler] 翻转后位置变为正值，强制修正');
      state.position.y = -Math.abs(state.position.y);
    }

    return true;
  }

  /**
   * 执行前的额外检查
   * @returns {boolean} true 表示可以执行
   */
  canExecute() {
    const state = this.syncManager.unifiedCameraState;
    if (!state || !state.position) {
      return false;
    }

    // 检查是否为地下模式
    return this.detector.isUnderground(state.position);
  }

  /**
   * 获取操作描述
   * @returns {string} 操作描述
   */
  getDescription() {
    return '地下翻转 - 使用统一坐标系和笛卡尔坐标计算';
  }
}
