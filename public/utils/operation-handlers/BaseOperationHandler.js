/**
 * 基础操作处理器
 * 为所有操作处理器提供基础接口和工具方法
 */

import { surfaceModeDetector } from './SurfaceModeDetector.js';
import { LargeCoordinateGuard } from '../LargeCoordinateGuard.js';

export class BaseOperationHandler {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.detector = surfaceModeDetector;
    this.operationType = null; // 'rotate' | 'pan' | 'zoom'
    this.mode = null; // 'surface' | 'underground'
    // 大坐标检查缓存（避免频繁检测）
    this._largeCoordCheckCache = { timestamp: 0, result: null };
  }

  /**
   * 获取操作锁状态
   * @returns {Object} 操作锁状态对象
   */
  getOperationLock() {
    if (typeof window !== 'undefined' && window.cesiumDualSync) {
      return window.cesiumDualSync.getOperationLock?.() || {
        locked: false,
        operationType: null,
        mode: null,
        lockStartTime: 0,
        lockTimeout: 3000
      };
    }
    return {
      locked: false,
      operationType: null,
      mode: null,
      lockStartTime: 0,
      lockTimeout: 3000
    };
  }

  /**
   * 设置操作锁
   * @param {string} operationType - 操作类型 'rotate' | 'pan' | 'zoom'
   * @param {string} mode - 模式 'surface' | 'underground'
   */
  setOperationLock(operationType, mode) {
    console.log(`[BaseOperationHandler.setOperationLock] 被调用，operationType: ${operationType}, mode: ${mode}, this.operationType (设置前): ${this.operationType}`);
    if (typeof window !== 'undefined' && window.cesiumDualSync) {
      window.cesiumDualSync.setOperationLock?.(operationType, mode);
    }
    this.operationType = operationType;
    this.mode = mode;
    console.log(`[BaseOperationHandler.setOperationLock] 设置完成，this.operationType (设置后): ${this.operationType}`);
  }

  /**
   * 释放操作锁
   * @param {string} operationType - 操作类型
   * @param {string} mode - 模式
   */
  releaseOperationLock(operationType, mode) {
    if (typeof window !== 'undefined' && window.cesiumDualSync) {
      window.cesiumDualSync.releaseOperationLock?.(operationType, mode);
    }
    // 注意：不重置 this.operationType，因为它是由构造函数设置的固定值
    // this.mode 可以重置，因为它是动态的
    this.mode = null;
  }

  /**
   * 检查操作锁是否已设置
   * @returns {boolean} true 表示已锁定
   */
  isLocked() {
    const lock = this.getOperationLock();
    return lock.locked;
  }

  /**
   * 检查是否可以执行操作
   * @param {string} operationType - 操作类型
   * @param {string} mode - 模式
   * @returns {boolean} true 表示可以执行
   */
  canExecute(operationType, mode) {
    const lock = this.getOperationLock();
    if (lock.locked) {
      // 检查锁是否超时
      const elapsed = Date.now() - lock.lockStartTime;
      if (elapsed > lock.lockTimeout) {
        // 锁已超时，自动释放
        this.releaseOperationLock(lock.operationType, lock.mode);
        return true;
      }
      // 锁未超时，检查是否是同类型操作
      return lock.operationType === operationType && lock.mode === mode;
    }
    return true;
  }

  /**
   * 获取当前相机位置
   * @returns {Object} 相机位置 {x, y, z}
   */
  getCameraPosition() {
    return this.syncManager.unifiedCameraState.position;
  }

  /**
   * 获取当前相机模式
   * @returns {string} 'surface' | 'underground'
   */
  getCurrentMode() {
    const position = this.getCameraPosition();
    return this.detector.getSurfaceMode(position);
  }

  /**
   * 执行操作前的准备工作
   * @param {string} operationType - 操作类型
   * @returns {Object} 操作上下文
   */
  beforeOperation(operationType) {
    // 如果 operationType 无效，使用实例的 operationType
    if (!operationType && this.operationType) {
      operationType = this.operationType;
    }

    const mode = this.getCurrentMode();
    const canExecute = this.canExecute(operationType, mode);

    if (!canExecute) {
      console.warn(`[BaseOperationHandler] 操作被锁定: ${operationType} / ${mode}`);
      return null;
    }

    // ⚠️ 大坐标状态检查（仅针对翻转和平移操作）
    if (operationType === 'rotate' || operationType === 'pan') {
      const checkResult = this._checkLargeCoordinateState(operationType);
      if (!checkResult.allowed) {
        LargeCoordinateGuard.showBlockedMessage(operationType, checkResult.reason);
        return null;
      }
    }

    // 设置操作锁
    this.setOperationLock(operationType, mode);

    return {
      operationType,
      mode,
      timestamp: Date.now()
    };
  }

  /**
   * 检查大坐标状态（带缓存）
   * @param {string} operationType - 操作类型
   * @returns {Object} { allowed: boolean, reason?: string }
   * @private
   */
  _checkLargeCoordinateState(operationType) {
    // 使用缓存（1秒内有效）
    const now = Date.now();
    if (this._largeCoordCheckCache.result && now - this._largeCoordCheckCache.timestamp < 1000) {
      return this._largeCoordCheckCache.result;
    }

    // 获取模型组（从 DualCanvasViewer）
    const modelGroup = this._getModelGroup();
    if (!modelGroup) {
      // 如果无法获取模型组，允许操作（向后兼容）
      const result = { allowed: true, reason: null };
      this._largeCoordCheckCache = { timestamp: now, result };
      return result;
    }

    // 执行检查
    const result = LargeCoordinateGuard.checkOperationAllowed(
      { mercatorProjectionManager: this.syncManager?.mercatorProjection },
      modelGroup,
      operationType
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
   * 执行操作后的清理工作
   * @param {Object} context - 操作上下文
   */
  afterOperation(context) {
    if (context) {
      this.releaseOperationLock(context.operationType, context.mode);
    }
  }

  /**
   * 验证输入参数
   * @param {*} value - 待验证的值
   * @param {string} name - 参数名称
   * @returns {boolean} true 表示有效
   */
  validateInput(value, name) {
    if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
      console.warn(`[BaseOperationHandler] 无效的参数 ${name}:`, value);
      return false;
    }
    return true;
  }

  /**
   * 验证位置对象
   * @param {Object} position - 位置对象
   * @returns {boolean} true 表示有效
   */
  validatePosition(position) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
      console.warn('[BaseOperationHandler] 无效的位置对象:', position);
      return false;
    }

    if (!isFinite(position.x) || !isFinite(position.y) || !isFinite(position.z)) {
      console.warn('[BaseOperationHandler] 位置坐标包含无效值:', position);
      return false;
    }

    return true;
  }

  /**
   * 计算向量长度
   * @param {Object} v - 向量 {x, y, z}
   * @returns {number} 向量长度
   */
  vectorLength(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  /**
   * 归一化向量
   * @param {Object} v - 向量 {x, y, z}
   * @returns {Object} 归一化后的向量
   */
  normalize(v) {
    const len = this.vectorLength(v);
    if (len < 0.0001) {
      return { x: 0, y: 1, z: 0 };
    }
    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len
    };
  }

  /**
   * 向量点积
   * @param {Object} a - 向量 a
   * @param {Object} b - 向量 b
   * @returns {number} 点积结果
   */
  dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * 向量叉积
   * @param {Object} a - 向量 a
   * @param {Object} b - 向量 b
   * @returns {Object} 叉积结果
   */
  cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  /**
   * 绕轴旋转向量
   * @param {Object} v - 待旋转向量
   * @param {Object} axis - 旋转轴
   * @param {number} angle - 旋转角度（弧度）
   * @returns {Object} 旋转后的向量
   */
  rotateAroundAxis(v, axis, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const cross = this.cross(axis, v);
    const dot = this.dot(axis, v);

    return {
      x: v.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
    };
  }

  /**
   * 抽象方法：执行操作
   * 子类必须实现此方法
   */
  execute(...args) {
    throw new Error('子类必须实现 execute 方法');
  }
}
