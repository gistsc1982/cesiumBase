/**
 * ModelMercatorMetadata - 模型墨卡托元数据管理器
 *
 * 职责：
 * - 为每个模型记录其在 ENU 坐标系中的相对位置
 * - 计算每个模型在 Cesium 世界中的真实墨卡托坐标
 * - 维护模型的元数据（位置、旋转、缩放）
 * - 支持模型位置的动态更新
 */

import * as THREE from 'three';

// ============================================================
// 常量定义
// ============================================================

const EARTH_RADIUS = 6378137.0;

// ============================================================
// 模型元数据类
// ============================================================

class ModelMetadata {
  constructor(model, options = {}) {
    // 模型引用
    this.model = model;
    this.uuid = model.uuid;
    this.name = model.name || `Model_${model.uuid.substring(0, 8)}`;

    // ENU 相对位置（相对于 ENU 原点）
    this.enuPosition = options.enuPosition ? new THREE.Vector3().copy(options.enuPosition) : new THREE.Vector3();
    this.enuRotation = options.enuRotation ? new THREE.Quaternion().copy(options.enuRotation) : new THREE.Quaternion();
    this.enuScale = options.enuScale ? new THREE.Vector3().copy(options.enuScale) : new THREE.Vector3(1, 1, 1);

    // 真实墨卡托坐标（在 Cesium 世界中的绝对位置）
    this.mercatorPosition = options.mercatorPosition ? { ...options.mercatorPosition } : null;
    this.mercatorOrientation = options.mercatorOrientation ? { ...options.mercatorOrientation } : null;

    // 原始模型变换（加载时的变换）
    this.originalPosition = new THREE.Vector3().copy(model.position);
    this.originalRotation = new THREE.Quaternion().copy(model.quaternion);
    this.originalScale = new THREE.Vector3().copy(model.scale);

    // 时间戳
    this.timestamp = Date.now();
    this.lastUpdate = Date.now();

    // 状态标志
    this.hasMercatorCoords = !!this.mercatorPosition;
    this.isDirty = false;  // 是否需要重新计算墨卡托坐标
  }

  /**
   * 更新 ENU 相对位置
   */
  updateENUPosition(position) {
    this.enuPosition.copy(position);
    this.isDirty = true;
    this.lastUpdate = Date.now();
  }

  /**
   * 更新 ENU 相对旋转
   */
  updateENURotation(rotation) {
    this.enuRotation.copy(rotation);
    this.isDirty = true;
    this.lastUpdate = Date.now();
  }

  /**
   * 更新 ENU 相对缩放
   */
  updateENUScale(scale) {
    this.enuScale.copy(scale);
    this.isDirty = true;
    this.lastUpdate = Date.now();
  }

  /**
   * 设置墨卡托坐标
   */
  setMercatorCoords(mercatorPosition, mercatorOrientation = null) {
    this.mercatorPosition = { ...mercatorPosition };
    if (mercatorOrientation) {
      this.mercatorOrientation = { ...mercatorOrientation };
    }
    this.hasMercatorCoords = true;
    this.isDirty = false;
    this.lastUpdate = Date.now();
  }

  /**
   * 调试信息
   */
  getDebugInfo() {
    return {
      uuid: this.uuid,
      name: this.name,
      enuPosition: {
        x: this.enuPosition.x.toFixed(2),
        y: this.enuPosition.y.toFixed(2),
        z: this.enuPosition.z.toFixed(2)
      },
      mercatorPosition: this.mercatorPosition ? {
        x: this.mercatorPosition.x.toFixed(2),
        y: this.mercatorPosition.y.toFixed(2),
        z: this.mercatorPosition.z.toFixed(2)
      } : null,
      hasMercatorCoords: this.hasMercatorCoords,
      isDirty: this.isDirty,
      timestamp: new Date(this.timestamp).toISOString(),
      lastUpdate: new Date(this.lastUpdate).toISOString()
    };
  }
}

// ============================================================
// 模型墨卡托元数据管理器
// ============================================================

export class ModelMercatorMetadataManager {
  constructor() {
    // 模型元数据映射 (modelUUID → ModelMetadata)
    this.metadataMap = new Map();

    // ENU 原点（用于计算墨卡托坐标）
    this.enuOrigin = {
      mercator: null,  // 地板中心墨卡托坐标
      cartographic: null  // 地板中心经纬度
    };

    // Cesium 引用
    this.Cesium = null;

    console.log('[ModelMercatorMetadataManager] 已创建');
  }

  // ============================================================
  // 初始化
  // ============================================================

  /**
   * 设置 Cesium 实例
   */
  setCesium(Cesium) {
    this.Cesium = Cesium;
  }

  getCesium() {
    if (this.Cesium) return this.Cesium;
    if (typeof window !== 'undefined' && window.Cesium) return window.Cesium;
    return null;
  }

  /**
   * 设置 ENU 原点
   * @param {Object} floorCenterMercator - 地板中心墨卡托坐标
   * @param {Object} floorCenterCartographic - 地板中心经纬度
   */
  setENUOrigin(floorCenterMercator, floorCenterCartographic) {
    this.enuOrigin = {
      mercator: { ...floorCenterMercator },
      cartographic: { ...floorCenterCartographic }
    };

    // 标记所有模型为需要重新计算
    this.markAllDirty();

    console.log('[ModelMercatorMetadataManager] ENU 原点已设置:', {
      mercator: this.enuOrigin.mercator,
      cartographic: {
        longitude: (this.enuOrigin.cartographic.longitude * 180 / Math.PI).toFixed(6) + '°',
        latitude: (this.enuOrigin.cartographic.latitude * 180 / Math.PI).toFixed(6) + '°'
      }
    });
  }

  // ============================================================
  // 模型注册
  // ============================================================

  /**
   * 注册模型
   * @param {THREE.Object3D} model - 模型对象
   * @param {Object} options - 选项 { enuPosition, enuRotation, enuScale }
   */
  registerModel(model, options = {}) {
    if (!model) {
      console.warn('[ModelMercatorMetadataManager] 无法注册空模型');
      return null;
    }

    let metadata = this.metadataMap.get(model.uuid);

    if (!metadata) {
      // 创建新的元数据
      metadata = new ModelMetadata(model, options);
      this.metadataMap.set(model.uuid, metadata);
      console.log('[ModelMercatorMetadataManager] 已注册模型:', {
        uuid: model.uuid,
        name: model.name || 'unnamed'
      });
    } else {
      // 更新现有元数据
      if (options.enuPosition) metadata.updateENUPosition(options.enuPosition);
      if (options.enuRotation) metadata.updateENURotation(options.enuRotation);
      if (options.enuScale) metadata.updateENUScale(options.enuScale);
    }

    return metadata;
  }

  /**
   * 批量注册模型
   * @param {THREE.Group} modelGroup - 模型组
   */
  registerModelGroup(modelGroup) {
    if (!modelGroup) {
      console.warn('[ModelMercatorMetadataManager] 无法注册空模型组');
      return;
    }

    let count = 0;
    modelGroup.traverse((obj) => {
      if (obj.isMesh || obj.isGroup || obj.type === 'GLTF') {
        // 跳过辅助对象
        if (obj.isHelper || obj.name?.includes('Helper')) {
          return;
        }

        // 计算相对于 ENU 原点的位置
        const worldPosition = new THREE.Vector3();
        obj.getWorldPosition(worldPosition);
        const worldQuaternion = new THREE.Quaternion();
        obj.getWorldQuaternion(worldQuaternion);
        const worldScale = new THREE.Vector3();
        obj.getWorldScale(worldScale);

        this.registerModel(obj, {
          enuPosition: worldPosition,
          enuRotation: worldQuaternion,
          enuScale: worldScale
        });

        count++;
      }
    });

    console.log('[ModelMercatorMetadataManager] 已批量注册模型:', count, '个');
  }

  /**
   * 注销模型
   */
  unregisterModel(model) {
    if (!model) return;

    const removed = this.metadataMap.delete(model.uuid);
    if (removed) {
      console.log('[ModelMercatorMetadataManager] 已注销模型:', {
        uuid: model.uuid,
        name: model.name || 'unnamed'
      });
    }
  }

  /**
   * 清空所有元数据
   */
  clear() {
    const count = this.metadataMap.size;
    this.metadataMap.clear();
    console.log('[ModelMercatorMetadataManager] 已清空所有元数据:', count, '条');
  }

  // ============================================================
  // 墨卡托坐标计算
  // ============================================================

  /**
   * 计算 ENU 相对位置对应的真实墨卡托坐标
   * @param {THREE.Vector3} enuPosition - ENU 相对位置（米）
   * @returns {Object} 墨卡托坐标 {x, y, z}
   */
  calculateMercatorFromENU(enuPosition) {
    if (!this.enuOrigin.mercator) {
      console.warn('[ModelMercatorMetadataManager] ENU 原点未设置，无法计算墨卡托坐标');
      return null;
    }

    // ENU 坐标系定义：
    // - ENU 原点在地板中心
    // - X 指向东方
    // - Y 指向北方
    // - Z 指向天顶（向上）

    // 墨卡托坐标定义：
    // - X = 经度 × 地球半径
    // - Y = 纬度投影（北向为正）
    // - Z = 高度

    // 转换公式：
    // ENU (东, 北, 天) → 墨卡托 (X, Y, Z)
    // mercator.x = floorCenter.x + enuPosition.x
    // mercator.y = floorCenter.y - enuPosition.y  (注意：ENU 北向对应墨卡托 Y 的负方向)
    // mercator.z = floorCenter.z + enuPosition.z  (高度)

    const mercator = {
      x: this.enuOrigin.mercator.x + enuPosition.x,
      y: this.enuOrigin.mercator.y - enuPosition.y,
      z: this.enuOrigin.mercator.z + enuPosition.z
    };

    return mercator;
  }

  /**
   * 将墨卡托坐标转换为经纬度
   * @param {Object} mercator - 墨卡托坐标 {x, y, z}
   * @returns {Object} 经纬度 {longitude, latitude, height}
   */
  mercatorToLonLat(mercator) {
    if (!mercator) return null;

    const longitude = mercator.x / EARTH_RADIUS;
    const latitude = 2 * Math.atan(Math.exp(mercator.y / EARTH_RADIUS)) - Math.PI / 2;

    return {
      longitude: longitude,
      latitude: latitude,
      height: mercator.z
    };
  }

  /**
   * 将经纬度转换为 Cesium 笛卡尔坐标
   * @param {Object} lonLat - 经纬度 {longitude, latitude, height}
   * @returns {Object} 笛卡尔坐标 {x, y, z}
   */
  lonLatToCartesian(lonLat) {
    const Cesium = this.getCesium();
    if (!Cesium) {
      console.error('[ModelMercatorMetadataManager] Cesium 不可用');
      return null;
    }

    try {
      const cartesian = Cesium.Cartesian3.fromRadians(
        lonLat.longitude,
        lonLat.latitude,
        lonLat.height
      );

      return {
        x: cartesian.x,
        y: cartesian.y,
        z: cartesian.z
      };
    } catch (error) {
      console.error('[ModelMercatorMetadataManager] 经纬度转笛卡尔失败:', error);
      return null;
    }
  }

  /**
   * 更新单个模型的墨卡托坐标
   * @param {string} modelUUID - 模型 UUID
   * @returns {boolean} 是否成功
   */
  updateModelMercatorCoords(modelUUID) {
    const metadata = this.metadataMap.get(modelUUID);
    if (!metadata) {
      console.warn('[ModelMercatorMetadataManager] 模型未注册:', modelUUID);
      return false;
    }

    if (!metadata.isDirty) {
      return true;  // 无需更新
    }

    // 计算真实墨卡托坐标
    const mercator = this.calculateMercatorFromENU(metadata.enuPosition);
    if (!mercator) {
      console.error('[ModelMercatorMetadataManager] 计算墨卡托坐标失败');
      return false;
    }

    // 转换为经纬度
    const lonLat = this.mercatorToLonLat(mercator);

    // 转换为笛卡尔坐标
    const cartesian = this.lonLatToCartesian(lonLat);

    // 设置墨卡托坐标
    metadata.setMercatorCoords(mercator, {
      longitude: lonLat.longitude,
      latitude: lonLat.latitude,
      height: lonLat.height,
      cartesian: cartesian
    });

    return true;
  }

  /**
   * 批量更新所有模型的墨卡托坐标
   * @returns {number} 更新的模型数量
   */
  updateAllMercatorCoords() {
    let updateCount = 0;
    let errorCount = 0;

    for (const [uuid, metadata] of this.metadataMap.entries()) {
      if (metadata.isDirty) {
        const success = this.updateModelMercatorCoords(uuid);
        if (success) {
          updateCount++;
        } else {
          errorCount++;
        }
      }
    }

    console.log('[ModelMercatorMetadataManager] 批量更新完成:', {
      更新成功: updateCount,
      更新失败: errorCount,
      总模型数: this.metadataMap.size
    });

    return updateCount;
  }

  /**
   * 标记所有模型为需要重新计算
   */
  markAllDirty() {
    for (const metadata of this.metadataMap.values()) {
      metadata.isDirty = true;
    }
  }

  // ============================================================
  // 查询方法
  // ============================================================

  /**
   * 获取模型元数据
   */
  getModelMetadata(model) {
    if (!model) return null;
    return this.metadataMap.get(model.uuid);
  }

  /**
   * 获取模型的墨卡托坐标
   */
  getModelMercatorCoords(model) {
    const metadata = this.getModelMetadata(model);
    return metadata?.mercatorPosition || null;
  }

  /**
   * 获取所有需要更新的模型
   */
  getDirtyModels() {
    const dirtyModels = [];
    for (const [uuid, metadata] of this.metadataMap.entries()) {
      if (metadata.isDirty) {
        dirtyModels.push(metadata);
      }
    }
    return dirtyModels;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      总模型数: this.metadataMap.size,
      已计算墨卡托坐标: Array.from(this.metadataMap.values()).filter(m => m.hasMercatorCoords).length,
      需要重新计算: Array.from(this.metadataMap.values()).filter(m => m.isDirty).length,
      ENU原点已设置: !!this.enuOrigin.mercator
    };
  }

  // ============================================================
  // 调试方法
  // ============================================================

  /**
   * 打印所有模型的调试信息
   */
  printDebugInfo() {
    console.group('[ModelMercatorMetadataManager] 模型元数据调试信息');
    console.log('统计:', this.getStats());

    if (this.metadataMap.size > 0) {
      console.log('模型列表:');
      for (const metadata of this.metadataMap.values()) {
        console.log(`  - ${metadata.name} (${metadata.uuid})`);
        console.log(`    ENU 位置: (${metadata.enuPosition.x.toFixed(2)}, ${metadata.enuPosition.y.toFixed(2)}, ${metadata.enuPosition.z.toFixed(2)})`);
        if (metadata.mercatorPosition) {
          console.log(`    墨卡托: (${metadata.mercatorPosition.x.toFixed(2)}, ${metadata.mercatorPosition.y.toFixed(2)}, ${metadata.mercatorPosition.z.toFixed(2)})`);
        } else {
          console.log(`    墨卡托: 未计算`);
        }
      }
    }

    console.groupEnd();
  }

  /**
   * 验证模型位置一致性
   * 检查模型的 ENU 位置是否与其墨卡托坐标匹配
   */
  verifyModelPositions() {
    console.group('[ModelMercatorMetadataManager] 验证模型位置一致性');

    let validCount = 0;
    let invalidCount = 0;

    for (const [uuid, metadata] of this.metadataMap.entries()) {
      if (!metadata.hasMercatorCoords) {
        console.log(`  ⏭️  ${metadata.name}: 无墨卡托坐标`);
        invalidCount++;
        continue;
      }

      // 重新计算墨卡托坐标
      const calculatedMercator = this.calculateMercatorFromENU(metadata.enuPosition);

      // 比较误差
      const error = {
        x: Math.abs(calculatedMercator.x - metadata.mercatorPosition.x),
        y: Math.abs(calculatedMercator.y - metadata.mercatorPosition.y),
        z: Math.abs(calculatedMercator.z - metadata.mercatorPosition.z)
      };

      const maxError = Math.max(error.x, error.y, error.z);
      const isValid = maxError < 0.01;  // 1cm 误差内认为有效

      if (isValid) {
        console.log(`  ✅ ${metadata.name}: 有效 (误差: ${maxError.toFixed(4)}m)`);
        validCount++;
      } else {
        console.log(`  ⚠️  ${metadata.name}: 可能无效 (误差: ${maxError.toFixed(4)}m, 位置: (${error.x.toFixed(2)}, ${error.y.toFixed(2)}, ${error.z.toFixed(2)}))`);
        invalidCount++;
      }
    }

    console.log(`验证结果: ${validCount} 有效, ${invalidCount} 可能无效`);
    console.groupEnd();

    return { validCount, invalidCount };
  }
}

// 导出单例实例
export const modelMercatorMetadataManager = new ModelMercatorMetadataManager();
export default modelMercatorMetadataManager;
