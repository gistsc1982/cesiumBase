/**
 * 地上翻转处理器
 * 处理地上模式的翻转操作（position.y >= -50）
 * 使用统一坐标系和笛卡尔坐标计算
 */

import { UnifiedRotationHandler } from './UnifiedRotationHandler.js';

export class SurfaceRotateHandler extends UnifiedRotationHandler {
  constructor(syncManager) {
    super(syncManager);
    this.mode = 'surface';
  }

  /**
   * 执行地上翻转操作
   * @param {number} deltaX - X 轴移动量
   * @param {number} deltaY - Y 轴移动量
   */
  performRotation(deltaX, deltaY) {
    const state = this.syncManager.unifiedCameraState;

    // 验证状态
    if (!state) {
      console.error('[SurfaceRotateHandler] 统一坐标系状态不可用');
      return false;
    }

    // 验证是否为地上模式
    const position = state.position;
    if (this.detector.isUnderground(position)) {
      console.warn('[SurfaceRotateHandler] 当前处于地下模式，不应使用地上翻转处理器');
      return false;
    }

    const originalTarget = { ...state.target };
    const originalDirection = { ...state.direction };

    // 计算俯仰角和偏航角
    const pitchAngle = this.calculatePitchAngle(deltaY);
    const yawAngle = this.calculateYawAngle(deltaX);

    // 执行翻转（围绕当前目标点）
    // 绕水平轴旋转（俯仰）
    const testDirection = this.pitch(state.direction, pitchAngle, state.right);

    // 绕垂直轴旋转（偏航）
    const finalDirection = this.yaw(testDirection, yawAngle, state.up, state.right);

    // 归一化方向向量
    state.direction = this.normalize(finalDirection);

    // 重建正交基
    this.rebuildOrthonormalBasis(state);

    // 地上模式：确保翻转后位置始终保持在安全范围内
    // 预先计算新位置，检查是否会导致模式切换
    const testPosition = {
      x: state.target.x + state.direction.x * state.height,
      y: state.target.y + state.direction.y * state.height,
      z: state.target.z + state.direction.z * state.height
    };

    const UNDERGROUND_THRESHOLD = -50;
    const MIN_SURFACE_MARGIN = 20; // 留 20 单位的余量，确保不会意外切换
    const MIN_POSITION_Y = UNDERGROUND_THRESHOLD + MIN_SURFACE_MARGIN; // -30

    if (testPosition.y < MIN_POSITION_Y) {
      console.warn(`⚠️ [SurfaceRotateHandler] 翻转会导致位置过低 (${testPosition.y.toFixed(1)} < ${MIN_POSITION_Y})，调整目标点`);

      // 调整 target.y 使 position.y 保持在地表模式
      // position.y = target.y + direction.y * distance
      // target.y = desiredPositionY - direction.y * distance
      state.target.y = MIN_POSITION_Y - state.direction.y * state.height;
    } else {
      // 位置安全，保持原目标点
      state.target.y = originalTarget.y;
    }

    // 更新相机位置
    this.updateCameraPosition(state);

    // 最终验证：确保位置确实在安全范围内
    if (state.position.y < MIN_POSITION_Y) {
      console.error(`❌ [SurfaceRotateHandler] 位置修正失败！当前位置 ${state.position.y.toFixed(1)} 仍然低于阈值 ${MIN_POSITION_Y}`);

      // 强制修正：直接调整 position.y
      state.position.y = MIN_POSITION_Y;
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

    // 检查是否为地上模式
    return this.detector.isSurface(state.position);
  }

  /**
   * 获取操作描述
   * @returns {string} 操作描述
   */
  getDescription() {
    return '地上翻转 - 使用统一坐标系和笛卡尔坐标计算';
  }
}
