/**
 * MercatorProjectionManager - 墨卡托投影管理器
 *
 * 负责墨卡托平面投影坐标系的所有计算逻辑：
 * - 经纬度 ↔ 墨卡托坐标转换
 * - 墨卡托 ↔ Three.js 坐标转换
 * - 统一平面投影坐标系的初始化和同步
 * - 地上地下模式检测
 *
 * 单一职责：专注于坐标投影和变换
 */

import * as THREE from 'three';

// ============================================================
// 常量定义
// ============================================================

const EARTH_RADIUS = 6378137.0; // 地球半径（米），WGS84 椭球体
const MAX_MERCATOR_Y = 20037508; // 墨卡托 Y 坐标最大值（约 85.05° 纬度）
const MIN_VALID_HEIGHT = -5000; // 最小有效高度（米）
const MAX_VALID_HEIGHT = 100000; // 最大有效高度（米）

// ============================================================
// 向量运算工具类
// ============================================================

class VectorMath {
  static normalize(v) {
    if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') {
      return { x: 0, y: 1, z: 0 };
    }

    if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) {
      return { x: 0, y: 1, z: 0 };
    }

    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 0.0001) return { x: 0, y: 1, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  static cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static rotateAroundAxis(v, axis, angle) {
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
}

// ============================================================
// 地上地下模式检测器
// ============================================================

class SurfaceModeDetector {
  /**
   * 检测是否在地下
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {boolean} true 表示在地下
   */
  isUnderground(position) {
    if (!position || typeof position.y !== 'number') {
      return false;
    }
    return position.y < -50; // 阈值：-50 米
  }

  /**
   * 检测是否在地上
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {boolean} true 表示在地上
   */
  isSurface(position) {
    return !this.isUnderground(position);
  }

  /**
   * 获取表面模式
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {string} 'surface' | 'underground'
   */
  getSurfaceMode(position) {
    return this.isUnderground(position) ? 'underground' : 'surface';
  }
}

// ============================================================
// 墨卡托投影管理器主类
// ============================================================

export class MercatorProjectionManager {
  constructor() {
    // 地板中心墨卡托坐标
    this.floorCenterMercator = null;

    // 原始地板高度
    this.originalFloorHeight = 0;

    // 1:1 比例系统：1 Three.js 单位 = 1 米
    this.scale = 1;

    // 模式检测器
    this.modeDetector = new SurfaceModeDetector();

    // Cesium 引用
    this.Cesium = null;

    // ⭐ 新增：局部坐标系标志位
    // true = 使用局部墨卡托坐标系（模型在原点附近，floorCenterMercator = (0, 0, 0)）
    // false = 使用绝对墨卡托坐标系（floorCenterMercator = 模型的绝对墨卡托坐标）
    this.useLocalCoordinateSystem = false;

    // ⭐ 新增：模型的绝对地理位置（墨卡托坐标）
    // 在局部坐标系模式下，保存模型的实际地理位置，用于坐标转换
    this.modelAbsoluteMercator = null;

    // ⭐ 新增：虚拟地板中心（与ENU切点对齐）
    // 在局部坐标系模式下，虚拟地板中心等于模型的绝对地理位置
    this.virtualFloorCenter = null;

    // ⭐ 新增：Dual地板初始高度配置（相对于Cesium地面）
    // 在局部坐标系模式下，Dual地板会被放置在这个高度
    // 默认值：76米（可根据需要调整）
    this.dualFloorHeight = 76;

    // ⭐ 新增：模型的绝对海拔（相对于海平面）
    // 在局部坐标系模式下，保存模型的实际海拔高度（米）
    // 用于计算 anchorContainer 的 Y 位置偏移
    // 注意：这与 dualFloorHeight 不同，dualFloorHeight 是用户可调整的地板高度
    this.modelAbsoluteAltitude = 0;

    // ⭐ 新增：实际地形高度（椭球体表面高度）
    // 在局部坐标系模式下，保存采样得到的实际地形高度
    // 用于计算 anchorContainer 的 Y 位置，使红球与地面点标注对齐
    this.actualTerrainHeight = 0;

    // ⭐ 新增：米级同步模式
    // true = 使用 1:1 缩放（真正的米级同步）
    // false = 使用视觉校准缩放（COORD_SCALE_FACTOR = 0.38）
    this.useMeterLevelSync = true;

    // 视觉校准缩放因子（仅当 useMeterLevelSync = false 时使用）
    this.coordScaleFactor = 0.38;
  }

  // ============================================================
  // Cesium 实例管理
  // ============================================================

  setCesium(Cesium) {
    this.Cesium = Cesium;
  }

  getCesium() {
    if (this.Cesium) return this.Cesium;
    if (typeof window !== 'undefined' && window.Cesium) {
      return window.Cesium;
    }
    return null;
  }

  // ============================================================
  // 地板中心管理
  // ============================================================

  /**
   * 设置地板中心墨卡托坐标
   * @param {Object} floorCenter - 地板中心 {x, y, z}
   * @param {number} modelAltitude - 模型的绝对海拔（米），仅在局部坐标系模式下使用
   *                                 用于计算 anchorContainer 的 Y 位置偏移
   *
   * ⚠️ 重要说明：
   * - floorCenter.z 应该是地面高度（通常是0）
   * - modelAltitude 参数用于在局部坐标系模式下保存模型的实际海拔高度
   */
  setFloorCenter(floorCenter, modelAltitude = null) {
    const wasUsingLocalCoord = this.useLocalCoordinateSystem;

    // ⭐ 关键修复：局部坐标系模式下，floorCenterMercator 应该为 (0, 0, 0)
    if (this.useLocalCoordinateSystem) {
      // 保存模型的绝对海拔（用于计算 anchorContainer 的 Y 位置偏移）
      if (modelAltitude !== null) {
        this.modelAbsoluteAltitude = modelAltitude;
      }

      // 保存原始地板高度（实际地面高度）
      this.originalFloorHeight = floorCenter.z || 0;

      // ⭐ 关键修复：保存模型的绝对地理位置（墨卡托坐标）
      // 这个值将在 threeToMercator() 和 syncDirectionToCesium 中用于坐标转换
      // ⚠️ 重要修复：z 应该使用模型的真实海拔高度（modelAltitude），而不是 floorCenter.z（地形高度）
      // 这样 Three.js (0, 0, 0) 对应的地理位置才是模型的经纬度和海拔
      this.modelAbsoluteMercator = {
        x: floorCenter.x,
        y: floorCenter.y,
        z: modelAltitude !== null ? modelAltitude : floorCenter.z  // ⭐ 使用模型海拔，而不是地形高度
      };

      // 局部坐标系模式：地板中心始终为原点
      this.floorCenterMercator = { x: 0, y: 0, z: 0 };

      console.log('[MercatorProjectionManager] ✅ 局部坐标系模式：floorCenterMercator 设置为 (0, 0, 0)', {
        originalFloorHeight: this.originalFloorHeight,
        modelAbsoluteAltitude: this.modelAbsoluteAltitude,
        modelAbsoluteMercator: this.modelAbsoluteMercator,
        说明: '局部坐标系模式下，地板中心始终为原点，所有坐标都是相对坐标。modelAbsoluteMercator 保存模型的绝对地理位置，modelAbsoluteAltitude 保存模型的绝对海拔'
      });

      // ⭐ 关键修复：通知 SyncManager 重新初始化 unifiedCameraState
      // 因为 floorCenterMercator 从大坐标变成了 (0, 0, 0)，需要重新计算相机状态
      if (typeof window !== 'undefined' && window.__syncManager__) {
        const syncManager = window.__syncManager__;
        if (syncManager && syncManager.reinitUnifiedState) {
          console.log('[MercatorProjectionManager] 触发 SyncManager 重新初始化 unifiedCameraState');
          syncManager.reinitUnifiedState();
        }
      }

      return;
    }

    // 关键修复：地板中心的z应该是地面高度，不是模型海拔
    // 保存原始地板高度（实际地面高度）
    this.originalFloorHeight = floorCenter.z || 0;

    // 地板中心墨卡托坐标的z应该始终为0（代表地面高度）
    this.floorCenterMercator = {
      x: floorCenter.x,
      y: floorCenter.y,
      z: 0  // ⚠️ 关键修复：地面高度应该为0
    };
    console.log('[MercatorProjectionManager] 设置地板中心:', {
      floorCenterMercator: this.floorCenterMercator,
      originalFloorHeight: this.originalFloorHeight,
      说明: 'floorCenterMercator.z 始终为0（地面高度）'
    });
  }

  /**
   * 获取地板中心墨卡托坐标
   * @returns {Object|null} 地板中心坐标
   */
  getFloorCenter() {
    return this.floorCenterMercator;
  }

  /**
   * 获取原始地板高度
   * @returns {number} 原始地板高度
   */
  getOriginalFloorHeight() {
    return this.originalFloorHeight;
  }

  /**
   * 获取模型的绝对海拔（仅在局部坐标系模式下有效）
   * @returns {number} 模型的绝对海拔（米）
   */
  getModelAbsoluteAltitude() {
    return this.modelAbsoluteAltitude;
  }

  /**
   * 设置模型的绝对海拔
   * @param {number} altitude - 模型的绝对海拔（米）
   */
  setModelAbsoluteAltitude(altitude) {
    this.modelAbsoluteAltitude = altitude;
    console.log('[MercatorProjectionManager] ✅ 已设置模型绝对海拔:', {
      altitude: altitude.toFixed(2) + '米',
      说明: '此值用于计算 anchorContainer 的 Y 位置偏移'
    });
  }

  // ============================================================
  // 局部坐标系管理
  // ============================================================

  /**
   * 设置是否使用局部坐标系
   * @param {boolean} useLocal - true 使用局部坐标系，false 使用绝对坐标系
   */
  setUseLocalCoordinateSystem(useLocal) {
    // ⭐ 关键修复：在启用局部坐标系模式前，检查 Cesium 是否就绪
    // 如果 Cesium 未就绪，禁止启用局部坐标系模式
    if (useLocal === true) {
      // 检查 Cesium 是否就绪
      let isCesiumReady = false;
      if (typeof window !== 'undefined') {
        // 方法1: 通过 SyncManager 检查
        if (window.__syncManager__ && typeof window.__syncManager__.isCesiumReady === 'function') {
          isCesiumReady = window.__syncManager__.isCesiumReady();
        }
        // 方法2: 直接检查 Cesium Viewer
        else if (window.__cesiumViewer__) {
          isCesiumReady = true;
        }
      }

      if (!isCesiumReady) {
        console.error('[MercatorProjectionManager] ❌ Cesium 未就绪，禁止启用局部坐标系模式！', {
          请求设置: useLocal,
          当前状态: this.useLocalCoordinateSystem,
          原因: '局部坐标系模式需要 Cesium 已就绪才能正常工作',
          影响: '保持当前模式不变'
        });
        // ⚠️ 不更新 useLocalCoordinateSystem，保持当前状态
        return;
      }

      console.log('[MercatorProjectionManager] ✅ Cesium 已就绪，允许启用局部坐标系模式');
    }

    this.useLocalCoordinateSystem = useLocal;
    console.log('[MercatorProjectionManager] 设置局部坐标系模式:', {
      useLocalCoordinateSystem: useLocal,
      说明: useLocal ? '使用局部墨卡托坐标系（模型在原点附近）' : '使用绝对墨卡托坐标系（模型在绝对位置）'
    });
  }

  /**
   * 设置Dual地板的初始高度（相对于Cesium地面）
   * @param {number} height - 地板高度（米），默认76米
   *
   * ⚠️ 注意：此方法应在启用局部坐标系模式之前调用
   * 调用后会自动更新 modelAbsoluteMercator.z
   */
  setDualFloorHeight(height) {
    const oldHeight = this.dualFloorHeight;
    // ⭐ 修复：允许负值，以便将地板降到地球海拔 0 米处
    // 限制在 -2000 到 10000 米范围内（覆盖海沟到高山）
    this.dualFloorHeight = Math.max(-2000, Math.min(10000, height));

    console.log('[MercatorProjectionManager] ⭐ 设置Dual地板偏移高度:', {
      旧偏移: oldHeight.toFixed(2) + '米',
      新偏移: this.dualFloorHeight.toFixed(2) + '米',
      说明: this.dualFloorHeight >= 0
        ? 'Dual地板将放置在Cesium地面之上' + this.dualFloorHeight + '米处'
        : 'Dual地板将放置在Cesium地面之下' + Math.abs(this.dualFloorHeight) + '米处'
    });

    // ⭐ 关键修复：不再更新 modelAbsoluteMercator.z
    // modelAbsoluteMercator.z 应该保持为模型的真实海拔（如70.36米）
    // dualFloorHeight 是独立的偏移值（如-254米）
    // 计算：anchorY = modelAbsoluteMercator.z + dualFloorHeight
    // 移除错误的逻辑：this.modelAbsoluteMercator.z = this.dualFloorHeight;
  }

  /**
   * 获取Dual地板的初始高度
   * @returns {number} 地板高度（米）
   */
  getDualFloorHeight() {
    return this.dualFloorHeight;
  }

  /**
   * 设置Dual地板高度到实际地形高度
   * @param {number} terrainHeight - 实际地形高度（米）
   *
   * 此方法用于在模型加载后，将Dual地板高度调整为实际采样的地形高度
   * 而不是使用默认的硬编码值（76米）
   *
   * ⭐ 重要说明：当地形采样失败时（返回0），dualFloorHeight 将被设置为 0（椭球体表面）
   */
  setDualFloorHeightToTerrain(terrainHeight) {
    const oldHeight = this.dualFloorHeight;

    // ⭐ 关键修复：当地形采样失败时（返回0），强制使用椭球体表面高度（0）
    // 这样可以确保 dual 地板始终对齐到椭球体表面，而不是使用默认值（76米）
    if (terrainHeight === 0 || isNaN(terrainHeight)) {
      this.dualFloorHeight = 0;
      this.actualTerrainHeight = 0;

      console.warn('[MercatorProjectionManager] ⚠️ 地形采样失败，Dual地板对齐到椭球体表面:', {
        输入高度: isNaN(terrainHeight) ? 'NaN (采样失败)' : terrainHeight.toFixed(2) + '米',
        使用高度: '0 米（椭球体表面）',
        原因: '地形采样返回无效值，使用椭球体表面作为默认地面'
      });
    } else if (terrainHeight < -500 || terrainHeight > 9000) {
      // 范围检查：地球表面高度通常在 -500m 到 9000m 之间
      this.dualFloorHeight = 0;
      this.actualTerrainHeight = 0;

      console.warn('[MercatorProjectionManager] ⚠️ 地形高度超出合理范围，使用椭球体表面:', {
        输入高度: terrainHeight.toFixed(2) + '米',
        使用高度: '0 米（椭球体表面）',
        原因: '超出合理范围 [-500, 9000]'
      });
    } else {
      this.dualFloorHeight = terrainHeight;
      this.actualTerrainHeight = terrainHeight;
    }

    console.log('[MercatorProjectionManager] ⭐ 设置Dual地板高度到实际地形:', {
      旧高度: oldHeight.toFixed(2) + '米',
      新地形高度: this.dualFloorHeight.toFixed(2) + '米',
      实际地形高度: this.actualTerrainHeight.toFixed(2) + '米',
      说明: this.dualFloorHeight === 0
        ? 'Dual地板已对齐到椭球体表面（地形采样失败时默认行为）'
        : 'Dual地板将放置在实际地形高度，actualTerrainHeight 已保存'
    });

    // ⭐ 关键修复：不要修改 modelAbsoluteMercator.z
    // modelAbsoluteMercator.z 应该始终代表模型海拔（从 setFloorCenter 的 modelAltitude 参数获取）
    // 而 dualFloorHeight 代表地形高度（用户可调整的地板高度）
    // 这两个值是不同的，不应该相互覆盖
    console.log('[MercatorProjectionManager] ⭐ modelAbsoluteMercator.z 保持不变:', {
      modelAbsoluteMercator_z: this.modelAbsoluteMercator?.z?.toFixed(2) + '米 (模型海拔)',
      dualFloorHeight: this.dualFloorHeight.toFixed(2) + '米 (地形高度)',
      说明: '模型海拔和地形高度是两个独立的值'
    });
  }

  /**
   * 获取当前地板高度（供UI显示）
   * @returns {number} 地板高度（米）
   */
  getCurrentFloorHeight() {
    return this.dualFloorHeight;
  }

  /**
   * 获取是否使用局部坐标系
   * @returns {boolean} true 使用局部坐标系，false 使用绝对坐标系
   */
  isUsingLocalCoordinateSystem() {
    return this.useLocalCoordinateSystem;
  }

  // ============================================================
  // 米级同步模式管理
  // ============================================================

  /**
   * 设置米级同步模式
   * @param {boolean} useMeterLevel - true 使用1:1缩放（真正的米级同步），false 使用视觉校准缩放
   */
  setUseMeterLevelSync(useMeterLevel) {
    this.useMeterLevelSync = useMeterLevel;
    console.log('[MercatorProjectionManager] 设置米级同步模式:', {
      useMeterLevelSync: useMeterLevel,
      实际缩放因子: useMeterLevel ? '1.0 (真正米级)' : this.coordScaleFactor + ' (视觉校准)'
    });
  }

  /**
   * 获取实际缩放因子
   * @returns {number} 根据米级同步模式返回1.0或视觉校准缩放因子
   */
  getActualScaleFactor() {
    return this.useMeterLevelSync ? 1.0 : this.coordScaleFactor;
  }

  /**
   * 获取是否使用米级同步模式
   * @returns {boolean} true 使用米级同步，false 使用视觉校准
   */
  isUsingMeterLevelSync() {
    return this.useMeterLevelSync;
  }

  /**
   * 获取指定位置的ENU基向量（用于切平面投影计算）
   *
   * ⭐ 新增：用于计算Cesium相机平移在切平面上的投影比率
   *
   * @param {Cesium.Cartesian3} position - ECEF坐标位置
   * @param {Object} cesiumViewer - Cesium viewer实例
   * @returns {Object|null} {east, north, up} ENU基向量（ECEF坐标），失败返回null
   */
  getENUBasisVectorsAtPosition(position, cesiumViewer) {
    const Cesium = this.getCesium();
    if (!Cesium || !position || !cesiumViewer) {
      return null;
    }

    try {
      // 1. 获取位置的经纬度
      const ellipsoid = cesiumViewer?.scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const cartographic = ellipsoid.cartesianToCartographic(position, new Cesium.Cartographic());
      if (!cartographic) {
        return null;
      }

      const longitude = cartographic.longitude;
      const latitude = cartographic.latitude;

      // 2. 计算ENU到ECEF的转换矩阵
      // 参考：Cesium.Transforms.eastNorthUpToFixedFrame
      const enuToEcefMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(position, undefined, new Cesium.Matrix4());

      // 3. 从矩阵中提取ENU基向量
      const east = new Cesium.Cartesian3();
      const north = new Cesium.Cartesian3();
      const up = new Cesium.Cartesian3();

      // 矩阵的前3列分别对应 东、北、上（在ECEF坐标系中）
      east.x = enuToEcefMatrix[0];
      east.y = enuToEcefMatrix[1];
      east.z = enuToEcefMatrix[2];

      north.x = enuToEcefMatrix[4];
      north.y = enuToEcefMatrix[5];
      north.z = enuToEcefMatrix[6];

      up.x = enuToEcefMatrix[8];
      up.y = enuToEcefMatrix[9];
      up.z = enuToEcefMatrix[10];

      // 归一化（确保是单位向量）
      Cesium.Cartesian3.normalize(east, east);
      Cesium.Cartesian3.normalize(north, north);
      Cesium.Cartesian3.normalize(up, up);

      return {
        east: east,
        north: north,
        up: up,
        longitude: longitude,
        latitude: latitude
      };
    } catch (error) {
      console.warn('[MercatorProjectionManager.getENUBasisVectorsAtPosition] 计算失败:', error);
      return null;
    }
  }

  // ============================================================
  // 经纬度 ↔ 墨卡托转换
  // ============================================================

  /**
   * 经纬度 → 墨卡托坐标
   * @param {number} longitude - 经度（弧度）
   * @param {number} latitude - 纬度（弧度）
   * @returns {Object} {x, y} 墨卡托坐标（米）
   */
  lonLatToMercator(longitude, latitude) {
    return {
      x: longitude * EARTH_RADIUS,
      y: Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * EARTH_RADIUS
    };
  }

  /**
   * 墨卡托坐标 → 经纬度
   * @param {number} x - 墨卡托 X 坐标（米）
   * @param {number} y - 墨卡托 Y 坐标（米）
   * @returns {Object} {longitude, latitude} 经纬度（弧度）
   */
  mercatorToLonLat(x, y) {
    const clampedY = Math.max(-MAX_MERCATOR_Y, Math.min(MAX_MERCATOR_Y, y));

    try {
      const longitude = x / EARTH_RADIUS;
      const latitude = 2 * Math.atan(Math.exp(clampedY / EARTH_RADIUS)) - Math.PI / 2;

      return { longitude, latitude };
    } catch (error) {
      console.error('[MercatorProjectionManager] 墨卡托转经纬度失败:', error);
      return { longitude: 0, latitude: 0 };
    }
  }

  /**
   * 纬度 → 墨卡托 Y 坐标
   * @param {number} latitude - 纬度（弧度）
   * @returns {number} 墨卡托 Y 坐标（米）
   */
  latitudeToMercatorY(latitude) {
    return Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * EARTH_RADIUS;
  }

  /**
   * 墨卡托 Y 坐标 → 纬度
   * @param {number} mercatorY - 墨卡托 Y 坐标（米）
   * @returns {number} 纬度（弧度）
   */
  mercatorYToLatitude(mercatorY) {
    const clampedY = Math.max(-MAX_MERCATOR_Y, Math.min(MAX_MERCATOR_Y, mercatorY));
    try {
      return 2 * Math.atan(Math.exp(clampedY / EARTH_RADIUS)) - Math.PI / 2;
    } catch (error) {
      return 0;
    }
  }

  // ============================================================
  // 墨卡托 ↔ Three.js 坐标转换
  // ============================================================

  /**
   * 墨卡托坐标 → Three.js 世界坐标
   * @param {number} mercatorX - 墨卡托 X 坐标（米）
   * @param {number} mercatorY - 墨卡托 Y 坐标（米）
   * @param {number} mercatorZ - 墨卡托 Z 坐标（高度，米）
   * @returns {Object} {x, y, z} Three.js 世界坐标
   */
  mercatorToThree(mercatorX, mercatorY, mercatorZ) {
    if (!this.floorCenterMercator) {
      // 没有设置地板中心，直接转换
      return { x: mercatorX, y: mercatorZ, z: -mercatorY };
    }

    // 验证输入
    const inputValid = !isNaN(mercatorX) && !isNaN(mercatorY) && !isNaN(mercatorZ) &&
                      isFinite(mercatorX) && isFinite(mercatorY) && isFinite(mercatorZ);

    // ⭐ 关键修复：局部坐标系模式下，使用模型的绝对地理位置进行转换
    let referenceMercator = this.floorCenterMercator;
    if (this.useLocalCoordinateSystem && this.modelAbsoluteMercator) {
      referenceMercator = this.modelAbsoluteMercator;
    }

    if (!inputValid) {
      console.error('[MercatorProjectionManager] mercatorToThree 输入无效:', { x: mercatorX, y: mercatorY, z: mercatorZ });
      return { x: 0, y: 0, z: 0 };
    }

    // ⚠️ 关键修复：地板中心z应该始终为0（地面高度）
    // 转换公式：
    // Three.js X = (墨卡托 X - 地板中心 X) / 比例
    // Three.js Y = (墨卡托 Z - 地面高度) / 比例，地面高度始终为0
    // Three.js Z = -(墨卡托 Y - 地板中心 Y) / 比例
    const result = {
      x: (mercatorX - referenceMercator.x) / this.scale,
      y: mercatorZ / this.scale,  // ⚠️ 关键修复：直接使用高度，referenceMercator.z始终为0
      z: -(mercatorY - referenceMercator.y) / this.scale
    };

    // 验证输出
    const isValidResult = !isNaN(result.x) && !isNaN(result.y) && !isNaN(result.z) &&
                         isFinite(result.x) && isFinite(result.y) && isFinite(result.z);

    if (!isValidResult) {
      console.error('[MercatorProjectionManager] mercatorToThree 转换产生无效结果:', result);
      return { x: 0, y: 0, z: 0 };
    }

    return result;
  }

  /**
   * Three.js 世界坐标 → 墨卡托坐标
   * @param {number} threeX - Three.js X 坐标
   * @param {number} threeY - Three.js Y 坐标
   * @param {number} threeZ - Three.js Z 坐标
   * @returns {Object} {x, y, z} 墨卡托坐标
   */
  threeToMercator(threeX, threeY, threeZ) {
    if (!this.floorCenterMercator) {
      return { x: threeX, y: -threeZ, z: threeY };
    }

    // 验证输入
    const inputValid = !isNaN(threeX) && !isNaN(threeY) && !isNaN(threeZ) &&
                      isFinite(threeX) && isFinite(threeY) && isFinite(threeZ);

    // ⭐ 关键修复：局部坐标系模式下，使用模型的绝对地理位置进行转换
    let referenceMercator = this.floorCenterMercator;
    if (this.useLocalCoordinateSystem && this.modelAbsoluteMercator) {
      referenceMercator = this.modelAbsoluteMercator;
    }

    if (!inputValid) {
      console.error('[MercatorProjectionManager] threeToMercator 输入无效:', { x: threeX, y: threeY, z: threeZ });
      return {
        x: referenceMercator.x,
        y: referenceMercator.y,
        z: 500
      };
    }

    // 检测大坐标模型（X 和 Y 平面坐标）
    // 注意：高度（threeY）不应该触发大坐标检测
    const LARGE_COORD_THRESHOLD = 100000;
    const isLargeCoordinate = Math.abs(threeX) > LARGE_COORD_THRESHOLD ||
                             Math.abs(threeZ) > LARGE_COORD_THRESHOLD;  // 只检测平面坐标

    if (isLargeCoordinate) {
      // ⚠️ 关键修复：保留实际高度，而不是使用固定的 500
      // 这样可以确保相机高度正确传递给 Cesium
      const resultHeight = threeY * this.scale;
      console.warn('[MercatorProjectionManager] 检测到大坐标模型:', {
        输入: { x: threeX.toFixed(2), y: threeY.toFixed(2), z: threeZ.toFixed(2) },
        输出: { x: referenceMercator.x, y: referenceMercator.y, z: resultHeight.toFixed(2) },
        说明: '平面坐标使用地板中心，高度保持原值'
      });
      return {
        x: referenceMercator.x,
        y: referenceMercator.y,
        z: resultHeight  // 使用实际高度而不是固定的 500
      };
    }

    // 转换公式：
    // 墨卡托 X = threeX * 比例 + 地板中心 X
    // 墨卡托 Y = -threeZ * 比例 + 地板中心 Y
    // 墨卡托 Z = threeY * 比例 + 地面高度，地面高度始终为0
    const result = {
      x: threeX * this.scale + referenceMercator.x,
      y: -threeZ * this.scale + referenceMercator.y,
      z: threeY * this.scale  // ⚠️ 关键修复：直接使用高度，floorCenterMercator.z始终为0
    };

    // 验证输出
    const outputValid = !isNaN(result.x) && !isNaN(result.y) && !isNaN(result.z) &&
                       isFinite(result.x) && isFinite(result.y) && isFinite(result.z);

    if (!outputValid) {
      console.error('[MercatorProjectionManager] threeToMercator 输出无效:', result);
      return {
        x: this.floorCenterMercator.x,
        y: this.floorCenterMercator.y,
        z: 500
      };
    }

    return result;
  }

  // ============================================================
  // 统一平面投影坐标系状态管理
  // ============================================================

  /**
   * 从 Cesium 相机初始化统一平面投影坐标系
   * @param {Object} cesiumCamera - Cesium 相机
   * @param {Object} cesiumScene - Cesium 场景
   * @returns {Object|null} 统一坐标系状态，失败返回 null
   */
  initFromCesium(cesiumCamera, cesiumScene) {
    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera || !this.floorCenterMercator) {
      console.error('[MercatorProjectionManager] initFromCesium 缺少必要参数');
      return null;
    }

    try {
      const ellipsoid = cesiumScene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;

      // 转换相机位置
      const cartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
      const mercatorPosition = {
        x: cartographic.longitude * EARTH_RADIUS,
        y: this.latitudeToMercatorY(cartographic.latitude),
        z: cartographic.height
      };

      // 检测并修正异常的相机高度
      if (mercatorPosition.z < MIN_VALID_HEIGHT || mercatorPosition.z > MAX_VALID_HEIGHT) {
        console.error('[MercatorProjectionManager] 检测到异常相机高度，正在修正:', {
          originalHeight: mercatorPosition.z,
          clampedHeight: Math.max(MIN_VALID_HEIGHT, Math.min(MAX_VALID_HEIGHT, mercatorPosition.z))
        });
        mercatorPosition.z = Math.max(MIN_VALID_HEIGHT, Math.min(MAX_VALID_HEIGHT, mercatorPosition.z));
      }

      // 计算目标点
      let targetCartographic;
      try {
        const ray = new Cesium.Ray(cesiumCamera.position, cesiumCamera.direction);
        const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);
        if (Cesium.defined(targetPosition)) {
          targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
        } else {
          targetCartographic = Cesium.Cartographic.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            0
          );
        }
      } catch (e) {
        targetCartographic = Cesium.Cartographic.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          0
        );
      }

      const mercatorTarget = {
        x: targetCartographic.longitude * EARTH_RADIUS,
        y: this.latitudeToMercatorY(targetCartographic.latitude),
        z: 0
      };

      // 墨卡托 → 平面投影坐标
      const state = {
        position: {
          x: mercatorPosition.x - this.floorCenterMercator.x,
          y: mercatorPosition.z, // 直接使用 Cesium 的真实高度
          z: -(mercatorPosition.y - this.floorCenterMercator.y)
        },
        target: {
          x: mercatorTarget.x - this.floorCenterMercator.x,
          y: mercatorTarget.z - this.floorCenterMercator.z,
          z: -(mercatorTarget.y - this.floorCenterMercator.y)
        },
        direction: { x: 0, y: -1, z: 0 },
        up: { x: 0, y: 1, z: 0 },
        right: { x: 1, y: 0, z: 0 },
        height: 500
      };

      // 计算方向向量
      const dir = {
        x: state.target.x - state.position.x,
        y: state.target.y - state.position.y,
        z: state.target.z - state.position.z
      };
      state.direction = VectorMath.normalize(dir);

      // 计算高度
      state.height = Math.sqrt(
        Math.pow(state.position.x - state.target.x, 2) +
        Math.pow(state.position.y - state.target.y, 2) +
        Math.pow(state.position.z - state.target.z, 2)
      );

      // 限制高度范围
      state.height = Math.max(10, Math.min(50000, state.height));

      // 重建正交基
      this._rebuildOrthonormalBasis(state);

      // 设置原始地板高度为 0
      this.originalFloorHeight = 0;

      console.log('[MercatorProjectionManager] 从 Cesium 初始化完成:', {
        position: state.position,
        target: state.target,
        height: state.height,
        mode: this.modeDetector.getSurfaceMode(state.position)
      });

      return state;
    } catch (error) {
      console.error('[MercatorProjectionManager] initFromCesium 失败:', error);
      return null;
    }
  }

  /**
   * 将统一平面投影坐标系同步到 Cesium
   * @param {Object} state - 统一坐标系状态
   * @param {Object} cesiumCamera - Cesium 相机
   * @param {Object} cesiumScene - Cesium 场景
   * @returns {boolean} 是否成功
   */
  syncToCesium(state, cesiumCamera, cesiumScene) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.floorCenterMercator || !cesiumCamera || !state) {
      console.error('[MercatorProjectionManager] syncToCesium 缺少必要参数');
      return false;
    }

    try {
      // ⚠️ 关键修复：局部坐标系模式下，使用模型的绝对地理位置作为参考点
      let referenceMercator = this.floorCenterMercator;
      if (this.useLocalCoordinateSystem && this.modelAbsoluteMercator) {
        referenceMercator = this.modelAbsoluteMercator;
      }

      // ⭐ 关键修复：在局部坐标系模式下，需要加上 originalFloorHeight 得到绝对高度
      // state.position.y 是相对于局部原点的高度，需要加上局部原点的绝对海拔
      const absoluteCameraHeight = state.position.y + (this.useLocalCoordinateSystem ? (this.originalFloorHeight || 0) : 0);
      const absoluteTargetHeight = state.target.y + this.originalFloorHeight;

      // 转换为墨卡托坐标
      const mercatorPosition = {
        x: state.position.x + referenceMercator.x,
        y: -state.position.z + referenceMercator.y,
        z: absoluteCameraHeight
      };

      const mercatorTarget = {
        x: state.target.x + referenceMercator.x,
        y: -state.target.z + referenceMercator.y,
        z: absoluteTargetHeight
      };

      // 转换为经纬度
      const cameraLongitude = mercatorPosition.x / EARTH_RADIUS;
      const cameraLatitude = this.mercatorYToLatitude(mercatorPosition.y);

      const targetLongitude = mercatorTarget.x / EARTH_RADIUS;
      const targetLatitude = this.mercatorYToLatitude(mercatorTarget.y);

      // 创建 Cesium 相机位置
      const cameraCartesian = Cesium.Cartesian3.fromRadians(
        cameraLongitude,
        cameraLatitude,
        mercatorPosition.z
      );

      const targetCartesian = Cesium.Cartesian3.fromRadians(
        targetLongitude,
        targetLatitude,
        mercatorTarget.z
      );

      // 计算方向向量
      const direction = Cesium.Cartesian3.subtract(
        targetCartesian,
        cameraCartesian,
        new Cesium.Cartesian3()
      );

      // ⭐ 检查方向向量是否有效，避免 normalize 失败
      const directionLength = Cesium.Cartesian3.magnitude(direction);
      if (directionLength < 0.0001) {
        console.warn('[MercatorProjectionManager] 方向向量接近零，跳过同步', {
          相机位置: cameraCartesian,
          目标位置: targetCartesian,
          方向向量长度: directionLength
        });
        return false;
      }

      Cesium.Cartesian3.normalize(direction, direction);

      // 设置 Cesium 相机状态
      cesiumCamera.position = cameraCartesian;
      cesiumCamera.direction = direction;

      const ellipsoid = cesiumScene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      const up = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
      cesiumCamera.up = up;
      cesiumCamera.right = Cesium.Cartesian3.cross(
        cesiumCamera.direction,
        cesiumCamera.up,
        new Cesium.Cartesian3()
      );
      Cesium.Cartesian3.normalize(cesiumCamera.right, cesiumCamera.right);

      // 调试日志：输出转换结果
      console.log('[MercatorProjectionManager] syncToCesium 完成（ENS→ECEF）:', {
        State坐标_东南天: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        ECEF方向: `(${cesiumCamera.direction.x.toFixed(3)}, ${cesiumCamera.direction.y.toFixed(3)}, ${cesiumCamera.direction.z.toFixed(3)})`
      });

      // ⭐ 关键修复：强制 Cesium 相机立即更新
      if (cesiumCamera.update) {
        cesiumCamera.update(cesiumScene?.clock?.currentTime || Cesium.JulianDate.now());
      }

      return true;
    } catch (error) {
      console.error('[MercatorProjectionManager] syncToCesium 失败:', error);
      return false;
    }
  }

  /**
   * 将方向向量同步到 Cesium（用于旋转操作）
   * 直接使用 direction 向量，不依赖 target
   * @param {Object} state - 统一坐标系状态 {position, direction, up}
   * @param {Object} cesiumCamera - Cesium 相机
   * @param {Object} cesiumScene - Cesium 场景
   * @returns {boolean} 是否成功
   */
  syncDirectionToCesium(state, cesiumCamera, cesiumScene) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.floorCenterMercator || !cesiumCamera || !state) {
      console.error('[MercatorProjectionManager] syncDirectionToCesium 缺少必要参数');
      return false;
    }

    // ⭐ 关键修复：验证 state.direction 是否有效
    if (!state.direction ||
        typeof state.direction.x !== 'number' ||
        typeof state.direction.y !== 'number' ||
        typeof state.direction.z !== 'number' ||
        !isFinite(state.direction.x) ||
        !isFinite(state.direction.y) ||
        !isFinite(state.direction.z)) {
      console.error('[MercatorProjectionManager] syncDirectionToCesium state.direction 无效:', {
        direction: state.direction,
        x: state.direction?.x,
        y: state.direction?.y,
        z: state.direction?.z
      });
      return false;
    }

    // ⭐ 验证 state.position 是否有效
    if (!state.position ||
        typeof state.position.x !== 'number' ||
        typeof state.position.y !== 'number' ||
        typeof state.position.z !== 'number' ||
        !isFinite(state.position.x) ||
        !isFinite(state.position.y) ||
        !isFinite(state.position.z)) {
      console.error('[MercatorProjectionManager] syncDirectionToCesium state.position 无效:', {
        position: state.position,
        x: state.position?.x,
        y: state.position?.y,
        z: state.position?.z
      });
      return false;
    }

    try {
      // ⚠️ 关键修复：局部坐标系模式下，使用模型的绝对地理位置作为参考点
      let referenceMercator = this.floorCenterMercator;

      // ⭐ 验证：检查是否在局部坐标系模式下
      const isUsingLocalCoord = this.useLocalCoordinateSystem;

      if (isUsingLocalCoord && this.modelAbsoluteMercator) {
        referenceMercator = this.modelAbsoluteMercator;
        console.log('[MercatorProjectionManager] syncDirectionToCesium 使用局部坐标系参考点:', {
          modelAbsoluteMercator: `(${this.modelAbsoluteMercator.x.toFixed(2)}, ${this.modelAbsoluteMercator.y.toFixed(2)})`,
          说明: '使用模型的绝对地理位置作为参考点'
        });
      } else if (isUsingLocalCoord && !this.modelAbsoluteMercator) {
        console.error('[MercatorProjectionManager] ⚠️ 局部坐标系模式但 modelAbsoluteMercator 未设置！', {
          useLocalCoordinateSystem: this.useLocalCoordinateSystem,
          modelAbsoluteMercator: this.modelAbsoluteMercator,
          floorCenterMercator: this.floorCenterMercator
        });
        return false;
      }

      // ⭐ 关键修复：在局部坐标系模式下，需要将局部高度转换为绝对高度
      // 在局部坐标系模式下：
      // - state.position.y 是 Three.js 相机相对于 Dual 地板的高度（局部高度）
      // - modelAbsoluteMercator.z 是 Dual 地板在 Cesium 中的配置高度（绝对高度）
      // - 绝对相机高度 = Dual 地板高度 + 相机相对高度
      let absoluteCameraHeight;

      if (isUsingLocalCoord && this.modelAbsoluteMercator) {
        // 局部坐标系模式：将局部高度转换为绝对高度
        absoluteCameraHeight = this.modelAbsoluteMercator.z + state.position.y;

        console.log('[MercatorProjectionManager] 局部坐标系模式：高度转换', {
          'Dual相机相对高度': state.position.y.toFixed(2) + '米',
          'Dual地板配置高度': this.modelAbsoluteMercator.z.toFixed(2) + '米',
          'Cesium相机绝对高度': absoluteCameraHeight.toFixed(2) + '米',
          说明: 'Cesium高度 = Dual地板高度 + Dual相机相对高度'
        });
      } else {
        // 真实世界模式：state.position.y 本身就是绝对高度
        absoluteCameraHeight = state.position.y;
      }

      // ⭐ 验证：检查高度是否在合理范围内
      if (Math.abs(absoluteCameraHeight) > 10000000) {
        console.error('[MercatorProjectionManager] ⚠️ 绝对相机高度超出合理范围:', {
          absoluteCameraHeight,
          statePositionY: state.position.y,
          stateHeight: state.height,
          modelAbsoluteMercatorZ: this.modelAbsoluteMercator?.z
        });
      }

      // ⭐ 关键修复：应用坐标系转换缩放因子
      // 问题：Dual 的状态变化（局部墨卡托平面）与 Cesium 的实际移动（ECEF 坐标系）存在恒定的尺度差异
      // 实测：Dual 的 1m 状态变化 → Cesium 的 0.887m 移动
      // 原因：墨卡托投影是平面投影，而 Cesium 使用地球曲率，两者在不同尺度下的转换存在非线性
      // 解决：放大墨卡托坐标偏移，使得 Cesium 移动距离匹配 Dual 状态变化
      //
      // ⚠️ 视觉校准：由于透视效果不同，需要额外调整以使视觉速度一致
      // - 数值准确时（Cesium ≈ Dual），视觉上 Cesium 会显得更快
      // - 减小此值可以让 Cesium 移动减慢，匹配 Dual 的视觉速度
      //
      // ⭐ 2024年平移实测数据优化：
      // - 调整前：0.65，导致旋转时 Cesium 移动速度不匹配
      // - 调整后：0.38，基于实测比率 0.578（0.65 × 0.578 ≈ 0.38）
      //
      // ⭐ 米级同步模式：
      // - 使用 getActualScaleFactor() 获取实际缩放因子
      // - 米级同步模式（useMeterLevelSync = true）：返回 1.0（真正的 1:1）
      // - 视觉校准模式（useMeterLevelSync = false）：返回 0.38（基于实测数据）
      const actualScaleFactor = this.getActualScaleFactor();

      // 转换为墨卡托坐标（应用缩放因子）
      const mercatorPosition = {
        x: state.position.x * actualScaleFactor + referenceMercator.x,
        y: -state.position.z * actualScaleFactor + referenceMercator.y,
        z: absoluteCameraHeight
      };

      // 转换为经纬度
      const cameraLongitude = mercatorPosition.x / EARTH_RADIUS;
      const cameraLatitude = this.mercatorYToLatitude(mercatorPosition.y);

      // 创建 Cesium 相机位置
      const cameraCartesian = Cesium.Cartesian3.fromRadians(
        cameraLongitude,
        cameraLatitude,
        mercatorPosition.z
      );

      // ⭐ 关键：使用 direction 向量计算目标点，然后使用 lookAt 设置方向
      // 坐标系转换：
      // - state.position.x → Mercator X (东)
      // - state.position.z → Mercator Y (北，但取反)
      // - state.position.y → Mercator Z (上/高度)
      const REASONABLE_DISTANCE = 100; // 合理的目标距离

      // 计算目标点在墨卡托坐标系中的位置
      // ⚠️ 注意：state.position.z 取反，所以 state.direction.z 也应该取反
      const mercatorTarget = {
        x: state.position.x + state.direction.x * REASONABLE_DISTANCE + referenceMercator.x,
        y: -state.position.z + (-state.direction.z * REASONABLE_DISTANCE) + referenceMercator.y,
        z: state.position.y + state.direction.y * REASONABLE_DISTANCE
      };

      // 转换为经纬度
      const targetLongitude = mercatorTarget.x / EARTH_RADIUS;
      const targetLatitude = this.mercatorYToLatitude(mercatorTarget.y);

      // 创建 Cesium 目标位置（ECEF 坐标系）
      const targetCartesian = Cesium.Cartesian3.fromRadians(
        targetLongitude,
        targetLatitude,
        mercatorTarget.z
      );

      // 设置 Cesium 相机位置
      cesiumCamera.position = cameraCartesian;

      // ⭐ 关键优化：直接在局部墨卡托坐标系中计算
      // 局部墨卡托坐标系: X=东, Y=北, Z=天
      // State坐标系（统一坐标系EUS）: X=东, Y=天, Z=南
      // 转换流程: State（EUS）→ 局部墨卡托（ENU）→ ECEF（使用 ENU 基向量）

      // 1. 将 state.direction 从统一坐标系（EUS）转换到墨卡托坐标系（ENU）
      // 转换公式：
      // - mercator.x = state.x   （东→东）
      // - mercator.y = -state.z  （南取反→北）
      // - mercator.z = state.y   （天→天）
      const mercatorDirectionENU = {
        x: state.direction.x,    // 东 → 东
        y: -state.direction.z,   // 南取反 → 北
        z: state.direction.y     // 天 → 天
      };

      const mercatorDirection = new Cesium.Cartesian3(
        mercatorDirectionENU.x,  // 东
        mercatorDirectionENU.y,  // 北（已经通过转换公式处理）
        mercatorDirectionENU.z   // 天
      );

      console.log('[MercatorProjectionManager] 坐标系转换:', {
        state_direction_EUS: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        mercator_direction_ENU: `(${mercatorDirectionENU.x.toFixed(3)}, ${mercatorDirectionENU.y.toFixed(3)}, ${mercatorDirectionENU.z.toFixed(3)})`,
        说明: '统一坐标系(EUS) → 墨卡托坐标系(ENU)'
      });

      // ⭐ 验证 mercatorDirection 是否有效
      if (!isFinite(mercatorDirection.x) || !isFinite(mercatorDirection.y) || !isFinite(mercatorDirection.z)) {
        console.error('[MercatorProjectionManager] mercatorDirection 包含无效值:', {
          stateDirection: state.direction,
          mercatorDirection: mercatorDirection
        });
        return false;
      }

      // 2. 计算相机位置的切平面基向量（ECEF坐标系中）
      const ellipsoid = cesiumScene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;

      // ⭐ 关键修复：使用地球法线作为天向量，确保垂直于地面
      // 天向量（地球法线）
      let up = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());

      // ⭐ 关键修复：归一化天向量，确保是单位向量
      Cesium.Cartesian3.normalize(up, up);

      // ⭐ 关键修复：验证天向量是否垂直（检查其长度是否为1）
      const upLength = Cesium.Cartesian3.magnitude(up);
      if (Math.abs(upLength - 1.0) > 0.01) {
        console.warn('[MercatorProjectionManager] ⚠️ 天向量长度异常，重新归一化:', {
          原始长度: upLength,
          修正前: `(${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`
        });
        Cesium.Cartesian3.normalize(up, up);
      }

      // ⭐ 关键修复：在局部墨卡托坐标系模式下，使用模型位置而非相机位置计算ENU基向量
      // 局部墨卡托坐标系模式：模型和相机都在局部坐标系中（靠近原点）
      // ENU基向量应该基于模型的地理位置计算，确保与Three.js世界坐标轴对齐

      let enuToEcefMatrix;
      let enuReferencePosition = cameraCartesian;
      let enuReferenceCartographic = Cesium.Cartographic.fromRadians(cameraLongitude, cameraLatitude, state.position.y);

      if (isUsingLocalCoord && this.modelAbsoluteMercator) {
        // 局部坐标系模式：使用模型的地理位置作为ENU参考点
        const modelLongitude = this.modelAbsoluteMercator.x / EARTH_RADIUS;
        const modelLatitude = this.mercatorYToLatitude(this.modelAbsoluteMercator.y);
        const modelHeight = this.modelAbsoluteMercator.z || 0;

        enuReferenceCartographic = Cesium.Cartographic.fromRadians(modelLongitude, modelLatitude, modelHeight);
        enuReferencePosition = ellipsoid.cartographicToCartesian(enuReferenceCartographic);

        console.log('[MercatorProjectionManager] 局部坐标系模式：使用模型位置计算ENU基向量', {
          模型经纬度: `(${ (modelLongitude * 180 / Math.PI).toFixed(6) }°, ${(modelLatitude * 180 / Math.PI).toFixed(6)}°)`,
          相机经纬度: `(${ (cameraLongitude * 180 / Math.PI).toFixed(6) }°, ${(cameraLatitude * 180 / Math.PI).toFixed(6)}°)`,
          说明: 'ENU基向量基于模型位置，确保与局部坐标系对齐'
        });
      }

      // 使用 eastNorthUpToFixedFrame 获取转换矩阵（ENU = 局部墨卡托）
      enuToEcefMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(enuReferencePosition);

      // 从矩阵中提取基向量（ENU/局部墨卡托 基向量）
      let east = new Cesium.Cartesian3();
      let north = new Cesium.Cartesian3();
      let matrixUp = new Cesium.Cartesian3();

      // 矩阵的前3列分别对应 东、北、上（在ECEF坐标系中）
      east.x = enuToEcefMatrix[0];
      east.y = enuToEcefMatrix[1];
      east.z = enuToEcefMatrix[2];

      north.x = enuToEcefMatrix[4];
      north.y = enuToEcefMatrix[5];
      north.z = enuToEcefMatrix[6];

      // ⭐ 关键修复：从矩阵中提取天向量，并验证
      matrixUp.x = enuToEcefMatrix[8];
      matrixUp.y = enuToEcefMatrix[9];
      matrixUp.z = enuToEcefMatrix[10];

      // 归一化（确保是单位向量）
      Cesium.Cartesian3.normalize(east, east);
      Cesium.Cartesian3.normalize(north, north);
      Cesium.Cartesian3.normalize(matrixUp, matrixUp);

      // ⭐ 关键修复：验证天向量是否与地球法线一致
      const upDotProduct = Cesium.Cartesian3.dot(up, matrixUp);
      if (Math.abs(upDotProduct - 1.0) > 0.01) {
        console.warn('[MercatorProjectionManager] ⚠️ 矩阵天向量与地球法线不一致，使用地球法线:', {
          点积: upDotProduct,
          地球法线: `(${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`,
          矩阵天向量: `(${matrixUp.x.toFixed(3)}, ${matrixUp.y.toFixed(3)}, ${matrixUp.z.toFixed(3)})`
        });
        // 使用地球法线，确保垂直于地面
        up = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(up, up);
      } else {
        // 使用矩阵中的天向量（与地球法线一致）
        up = matrixUp;
      }

      // ⭐ 验证 ENU 基向量是否有效
      if (!isFinite(east.x) || !isFinite(east.y) || !isFinite(east.z) ||
          !isFinite(north.x) || !isFinite(north.y) || !isFinite(north.z) ||
          !isFinite(up.x) || !isFinite(up.y) || !isFinite(up.z)) {
        console.error('[MercatorProjectionManager] ENU 基向量包含无效值:', {
          east: east,
          north: north,
          up: up,
          cameraCartesian: cameraCartesian
        });
        return false;
      }

      // 3. 将墨卡托方向投影到ECEF（线性组合）
      // ⚠️ 关键修复：确保 ecefDirection 初始化为零向量
      const ecefDirection = new Cesium.Cartesian3(0, 0, 0);

      // 东分量
      const eastComponent = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(east, mercatorDirection.x, eastComponent);
      Cesium.Cartesian3.add(ecefDirection, eastComponent, ecefDirection);

      // 北分量
      const northComponent = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(north, mercatorDirection.y, northComponent);
      Cesium.Cartesian3.add(ecefDirection, northComponent, ecefDirection);

      // 天分量
      const upComponent = new Cesium.Cartesian3();
      Cesium.Cartesian3.multiplyByScalar(up, mercatorDirection.z, upComponent);
      Cesium.Cartesian3.add(ecefDirection, upComponent, ecefDirection);

      // ⭐ 关键修复：验证基向量的正交性
      // 东向量应该垂直于天向量
      const eastDotUp = Cesium.Cartesian3.dot(east, up);
      // 北向量应该垂直于天向量
      const northDotUp = Cesium.Cartesian3.dot(north, up);
      // 东向量应该垂直于北向量
      const eastDotNorth = Cesium.Cartesian3.dot(east, north);

      if (Math.abs(eastDotUp) > 0.01 || Math.abs(northDotUp) > 0.01 || Math.abs(eastDotNorth) > 0.01) {
        console.warn('[MercatorProjectionManager] ⚠️ ENU基向量不正交，重新计算:', {
          eastDotUp: eastDotUp.toFixed(4),
          northDotUp: northDotUp.toFixed(4),
          eastDotNorth: eastDotNorth.toFixed(4),
          说明: '理想情况下这些值应该接近0'
        });

        // ⭐ 关键修复：重新计算北向量，确保正交性
        // 北向量 = 天向量 × 东向量
        const recalculatedNorth = new Cesium.Cartesian3();
        Cesium.Cartesian3.cross(up, east, recalculatedNorth);
        Cesium.Cartesian3.normalize(recalculatedNorth, recalculatedNorth);

        // 验证正交性
        const newEastDotNorth = Cesium.Cartesian3.dot(east, recalculatedNorth);
        const newNorthDotUp = Cesium.Cartesian3.dot(recalculatedNorth, up);

        if (Math.abs(newEastDotNorth) < 0.001 && Math.abs(newNorthDotUp) < 0.001) {
          console.log('[MercatorProjectionManager] ✅ 重新计算后的北向量正交性验证通过');
          north = recalculatedNorth;
        } else {
          console.error('[MercatorProjectionManager] ❌ 无法修正基向量正交性');
        }
      }

      // ⭐ 验证 ecefDirection 在归一化前是否有效
      const directionLength = Cesium.Cartesian3.magnitude(ecefDirection);
      if (!isFinite(ecefDirection.x) || !isFinite(ecefDirection.y) || !isFinite(ecefDirection.z) || directionLength < 0.0001) {
        console.error('[MercatorProjectionManager] ecefDirection 无效或长度接近零:', {
          ecefDirection: ecefDirection,
          directionLength: directionLength,
          mercatorDirection: mercatorDirection,
          east: east,
          north: north,
          up: up
        });
        return false;
      }

      // 归一化
      Cesium.Cartesian3.normalize(ecefDirection, ecefDirection);

      // ⭐ 关键修复：检测相机是否接近地平线
      // 计算相机方向与天向量的点积，判断是否接近地平线
      const cameraDotUp = Cesium.Cartesian3.dot(
        new Cesium.Cartesian3(state.direction.x, state.direction.y, state.direction.z),
        new Cesium.Cartesian3(0, 1, 0)
      );

      const isNearHorizon = Math.abs(cameraDotUp) < 0.2; // 相机方向接近水平

      if (isNearHorizon) {
        console.warn('[MercatorProjectionManager] ⚠️ 相机接近地平线，启用特殊处理:', {
          cameraDotUp: cameraDotUp.toFixed(3),
          说明: '可能需要额外的姿态修正'
        });

        // ⭐ 在接近地平线时，强制使用更稳定的计算方法
        // 1. 确保天向量完全垂直
        const verticalUp = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
        Cesium.Cartesian3.normalize(verticalUp, verticalUp);

        // 2. 重新计算东向量和北向量，确保正交性
        const stableEast = new Cesium.Cartesian3();
        stableEast.x = -Math.sin(cameraLongitude);
        stableEast.y = Math.cos(cameraLongitude);
        stableEast.z = 0;
        Cesium.Cartesian3.normalize(stableEast, stableEast);

        const stableNorth = new Cesium.Cartesian3();
        Cesium.Cartesian3.cross(verticalUp, stableEast, stableNorth);
        Cesium.Cartesian3.normalize(stableNorth, stableNorth);

        // 3. 验证正交性
        const orthoCheck1 = Cesium.Cartesian3.dot(stableEast, verticalUp);
        const orthoCheck2 = Cesium.Cartesian3.dot(stableNorth, verticalUp);
        const orthoCheck3 = Cesium.Cartesian3.dot(stableEast, stableNorth);

        console.log('[MercatorProjectionManager] ✅ 地平线模式：稳定的基向量:', {
          正交性检查: {
            eastDotUp: orthoCheck1.toFixed(4),
            northDotUp: orthoCheck2.toFixed(4),
            eastDotNorth: orthoCheck3.toFixed(4)
          },
          天向量: `(${verticalUp.x.toFixed(3)}, ${verticalUp.y.toFixed(3)}, ${verticalUp.z.toFixed(3)})`,
          说明: '天向量应该完全垂直于地面'
        });

        // 4. 使用稳定的基向量
        east = stableEast;
        north = stableNorth;
        up = verticalUp;

        // 5. 重新计算 ECEF 方向
        ecefDirection.x = 0;
        ecefDirection.y = 0;
        ecefDirection.z = 0;

        Cesium.Cartesian3.multiplyByScalar(east, mercatorDirection.x, eastComponent);
        Cesium.Cartesian3.add(ecefDirection, eastComponent, ecefDirection);

        Cesium.Cartesian3.multiplyByScalar(north, mercatorDirection.y, northComponent);
        Cesium.Cartesian3.add(ecefDirection, northComponent, ecefDirection);

        Cesium.Cartesian3.multiplyByScalar(up, mercatorDirection.z, upComponent);
        Cesium.Cartesian3.add(ecefDirection, upComponent, ecefDirection);
      }

      // 调试日志：输出 ENU/局部墨卡托 基向量和计算结果
      console.log('[MercatorProjectionManager] ENU/局部墨卡托 基向量检查:', {
        东向量: `(${east.x.toFixed(3)}, ${east.y.toFixed(3)}, ${east.z.toFixed(3)})`,
        北向量: `(${north.x.toFixed(3)}, ${north.y.toFixed(3)}, ${north.z.toFixed(3)})`,
        天向量: `(${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`,
        墨卡托方向: `(${mercatorDirection.x.toFixed(3)}, ${mercatorDirection.y.toFixed(3)}, ${mercatorDirection.z.toFixed(3)})`,
        东分量: `(${eastComponent.x.toFixed(3)}, ${eastComponent.y.toFixed(3)}, ${eastComponent.z.toFixed(3)})`,
        北分量: `(${northComponent.x.toFixed(3)}, ${northComponent.y.toFixed(3)}, ${northComponent.z.toFixed(3)})`,
        天分量: `(${upComponent.x.toFixed(3)}, ${upComponent.y.toFixed(3)}, ${upComponent.z.toFixed(3)})`,
        ECEF方向_归一化前: `(${ecefDirection.x.toFixed(3)}, ${ecefDirection.y.toFixed(3)}, ${ecefDirection.z.toFixed(3)})`,
        接近地平线: isNearHorizon ? '是' : '否'
      });

      // ⭐ 验证天向量是否正确对齐地球表面法线
      // 在 ECEF 坐标系中，天向量应该是地球表面法线，即从地心指向相机位置的归一化向量
      // 注意：天向量不一定与 ECEF Y 轴对齐（仅当位置在赤道 90°E 时才对齐）
      const expectedUp = ellipsoid.geodeticSurfaceNormal(cameraCartesian, new Cesium.Cartesian3());
      const upDotExpected = Cesium.Cartesian3.dot(up, expectedUp);
      if (upDotExpected < 0.99) {
        console.warn('[MercatorProjectionManager] ⚠️ 天向量与地球表面法线不一致:', {
          实际天向量: `(${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)})`,
          期望天向量: `(${expectedUp.x.toFixed(3)}, ${expectedUp.y.toFixed(3)}, ${expectedUp.z.toFixed(3)})`,
          点积: upDotExpected.toFixed(4),
          说明: '天向量应该与地球表面法线一致',
          isUsingLocalCoord: isUsingLocalCoord
        });
      }

      // 再次归一化
      Cesium.Cartesian3.normalize(ecefDirection, ecefDirection);

      // 4. 设置相机的方向向量
      cesiumCamera.direction = ecefDirection;
      cesiumCamera.up = up;

      // 5. 计算right向量
      cesiumCamera.right = Cesium.Cartesian3.cross(
        cesiumCamera.direction,
        cesiumCamera.up,
        new Cesium.Cartesian3()
      );
      Cesium.Cartesian3.normalize(cesiumCamera.right, cesiumCamera.right);

      // ⭐ 关键修复：强制 Cesium 相机立即更新，确保方向向量生效
      // lookAt 设置了方向，但需要调用 update 才能立即生效
      if (cesiumCamera.update) {
        cesiumCamera.update(cesiumScene?.clock?.currentTime || Cesium.JulianDate.now());
      }

      // ⭐ 锚定验证：打印相机位置的经纬度和模型锚定经纬度
      const cameraCartographic = ellipsoid.cartesianToCartographic(
        cesiumCamera.position,
        new Cesium.Cartographic()
      );
      const anchorCameraLon = (cameraCartographic.longitude * 180 / Math.PI).toFixed(6);
      const anchorCameraLat = (cameraCartographic.latitude * 180 / Math.PI).toFixed(6);
      const anchorCameraHeight = cameraCartographic.height.toFixed(2);

      // 获取模型锚定经纬度（从 modelAbsoluteMercator 转换）
      let modelAnchorLon = 'N/A', modelAnchorLat = 'N/A';
      if (this.modelAbsoluteMercator) {
        // 墨卡托坐标转经纬度
        // 经度（弧度）= x / EARTH_RADIUS
        // 纬度（弧度）= mercatorYToLatitude(y)
        const lonRad = this.modelAbsoluteMercator.x / EARTH_RADIUS;
        const latRad = this.mercatorYToLatitude(this.modelAbsoluteMercator.y);
        modelAnchorLon = (lonRad * 180 / Math.PI).toFixed(6);
        modelAnchorLat = (latRad * 180 / Math.PI).toFixed(6);
      }

      console.log('[MercatorProjectionManager] syncDirectionToCesium 完成（局部墨卡托 → ENU基向量 → ECEF）:', {
        State_东南天: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
        墨卡托_东北天: `(${mercatorDirection.x.toFixed(3)}, ${mercatorDirection.y.toFixed(3)}, ${mercatorDirection.z.toFixed(3)})`,
        ECEF方向: `(${cesiumCamera.direction.x.toFixed(3)}, ${cesiumCamera.direction.y.toFixed(3)}, ${cesiumCamera.direction.z.toFixed(3)})`
      });

      console.log('[MercatorProjectionManager] ⭐ 锚定验证:', {
        Cesium相机位置: {
          经度: anchorCameraLon + '°',
          纬度: anchorCameraLat + '°',
          高度: anchorCameraHeight + 'm'
        },
        大模型锚定点: {
          经度: modelAnchorLon + '°',
          纬度: modelAnchorLat + '°'
        },
        相机相对锚定点: {
          经度差: ((parseFloat(anchorCameraLon) - parseFloat(modelAnchorLon)) * 111320).toFixed(2) + 'm (东)',
          纬度差: ((parseFloat(anchorCameraLat) - parseFloat(modelAnchorLat)) * 110540).toFixed(2) + 'm (北)'
        },
        锚定状态: Math.abs(parseFloat(anchorCameraLon) - parseFloat(modelAnchorLon)) < 0.001 &&
                   Math.abs(parseFloat(anchorCameraLat) - parseFloat(modelAnchorLat)) < 0.001 ?
                   '❌ 相机在锚定点上方（视角中心）' : '✅ 锚定点在相机视野内'
      });

      return true;
    } catch (error) {
      console.error('[MercatorProjectionManager] syncDirectionToCesium 失败:', error);
      return false;
    }
  }

  // ============================================================
  // 地上地下模式检测
  // ============================================================

  /**
   * 检测是否在地下
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {boolean} true 表示在地下
   */
  isUnderground(position) {
    return this.modeDetector.isUnderground(position);
  }

  /**
   * 检测是否在地上
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {boolean} true 表示在地上
   */
  isSurface(position) {
    return this.modeDetector.isSurface(position);
  }

  /**
   * 获取表面模式
   * @param {Object} position - 位置对象 {x, y, z}
   * @returns {string} 'surface' | 'underground'
   */
  getSurfaceMode(position) {
    return this.modeDetector.getSurfaceMode(position);
  }

  // ============================================================
  // 正交基重建
  // ============================================================

  /**
   * 重建正交基
   * @param {Object} state - 统一坐标系状态
   */
  _rebuildOrthonormalBasis(state) {
    if (!state || !state.direction) {
      return;
    }

    state.direction = VectorMath.normalize(state.direction);

    // ⚠️ 关键修复：在墨卡托坐标系中，强制 up 向量指向 Y 轴正方向（高度方向）
    state.up = { x: 0, y: 1, z: 0 };

    // ⚠️ 关键修复：在墨卡托坐标系中，right 必须指向 X 轴正方向
    // 使用 cross(up, direction) 而不是 cross(direction, up)
    const dirLen = Math.sqrt(state.direction.x ** 2 + state.direction.y ** 2 + state.direction.z ** 2);
    if (dirLen > 0.001) {
      let right = {
        x: state.direction.z / dirLen,
        y: 0,
        z: -state.direction.x / dirLen
      };

      // 归一化 right
      const rightLen = Math.sqrt(right.x ** 2 + right.z ** 2);
      if (rightLen < 0.001) {
        // 如果 direction 几乎平行于 up（垂直向上或向下），使用 X 轴正方向
        right = { x: 1, y: 0, z: 0 };
      } else {
        right.x /= rightLen;
        right.z /= rightLen;
      }

      state.right = right;
    } else {
      state.right = { x: 1, y: 0, z: 0 };
    }

    console.log('[MercatorProjectionManager._rebuildOrthonormalBasis] 重建正交基:', {
      direction: `(${state.direction.x.toFixed(3)}, ${state.direction.y.toFixed(3)}, ${state.direction.z.toFixed(3)})`,
      up: `(${state.up.x.toFixed(3)}, ${state.up.y.toFixed(3)}, ${state.up.z.toFixed(3)})`,
      right: `(${state.right.x.toFixed(3)}, ${state.right.y.toFixed(3)}, ${state.right.z.toFixed(3)})`,
      rightDotX: state.right.x.toFixed(3)
    });
  }

  // ============================================================
  // 虚拟地板中心管理（与ENU切点对齐）
  // ============================================================

  /**
   * 获取虚拟地板中心（与ENU切点对齐）
   * 在局部坐标系模式下，返回模型位置的墨卡托坐标
   *
   * ⚠️ 关键修复：z 坐标使用 actualTerrainHeight（地形表面高度）
   * - ENU 坐标系原点应该在地形表面，这样 Up 轴才垂直于地形
   * - x, y 使用模型的经纬度（水平位置）
   * - z 使用地形高度（垂直位置）
   *
   * @returns {Object} {x, y, z} 墨卡托坐标
   */
  getVirtualFloorCenter() {
    if (this.useLocalCoordinateSystem && this.modelAbsoluteMercator) {
      return {
        x: this.modelAbsoluteMercator.x,
        y: this.modelAbsoluteMercator.y,
        z: this.actualTerrainHeight || 0  // ⭐ 修复：使用地形高度而非模型海拔
      };
    }
    return this.floorCenterMercator;
  }

  /**
   * 检查虚拟地板中心是否与ENU切点对齐
   * @returns {boolean}
   */
  isVirtualFloorCenterAlignedWithENU() {
    if (!this.useLocalCoordinateSystem) return true;
    if (!this.modelAbsoluteMercator) return false;

    // 在局部坐标系模式下，虚拟地板中心应该等于模型位置
    return this.floorCenterMercator.x === 0 &&
           this.floorCenterMercator.y === 0 &&
           this.floorCenterMercator.z === 0;
  }
}

// 导出单例实例
export const mercatorProjectionManager = new MercatorProjectionManager();
export default mercatorProjectionManager;

// ⭐ 添加调试信息
console.log('[MercatorProjectionManager] 单例实例已创建:', {
  mercatorProjectionManager,
  类型: typeof mercatorProjectionManager,
  constructorName: mercatorProjectionManager?.constructor?.name,
  方法: Object.getOwnPropertyNames(Object.getPrototypeOf(mercatorProjectionManager)).filter(name => name !== 'constructor')
});
