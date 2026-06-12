/**
 * SceneRotationManager - 场景旋转管理器（支持地上地下模式）
 *
 * 职责：
 * - 计算地球表面法向量
 * - 计算从初始ENU姿态到当前目标姿态的旋转四元数
 * - 管理整个场景容器的旋转（地板+所有模型）
 * - 检测并保持地上地下模式，避免跳变
 * - 提供平滑的旋转过渡
 */

import * as THREE from 'three';

// ============================================================
// 常量定义
// ============================================================

const UNDERGROUND_THRESHOLD = -50;    // 地下模式阈值
const MIN_SURFACE_MARGIN = 20;        // 地上模式余量
const MIN_POSITION_Y = UNDERGROUND_THRESHOLD + MIN_SURFACE_MARGIN; // -30
const EARTH_RADIUS = 6378137.0;

// ============================================================
// 场景旋转管理器主类
// ============================================================

export class SceneRotationManager {
  constructor() {
    // Cesium 引用
    this.Cesium = null;
    this.cesiumViewer = null;

    // 地板中心（参考点）
    this.floorCenterMercator = null;
    this.floorCenterCartographic = null;

    // 初始ENU状态（作为参考）
    this.initialENUState = {
      east: new THREE.Vector3(1, 0, 0),   // 初始东向量（Three.js坐标系）
      north: new THREE.Vector3(0, 0, -1),  // 初始北向量（Three.js坐标系）
      up: new THREE.Vector3(0, 1, 0)       // 初始上向量（Three.js坐标系）
    };

    // 当前旋转状态
    this.currentRotation = {
      quaternion: new THREE.Quaternion(0, 0, 0, 1), // 初始无旋转
      pitch: 0,           // 俯仰角
      roll: 0,            // 翻滚角
      mode: 'surface',    // 当前模式：'surface' | 'underground'
      isOnBackSide: false // 是否在背面
    };

    // 目标旋转（用于平滑过渡）
    this.targetRotation = {
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      mode: 'surface'
    };

    // 上一次的位置（用于检测跳变）
    this.lastPosition = {
      x: 0, y: 0, z: 0
    };

    // 平滑过渡参数
    this.smoothingFactor = 0.15; // 平滑因子（0-1），越小越平滑
    this.enableSmoothing = true; // 是否启用平滑

    // 背面检测参考向量
    this._initialFloorCenterNormal = null;

    // 场景容器引用
    this.sceneContainer = null;

    // 模式切换保护
    this._modeTransitionProtection = {
      enabled: true,
      until: 0,
      lastMode: 'surface'
    };

    console.log('[SceneRotationManager] 已创建（支持地上地下模式）');
  }

  // ============================================================
  // 初始化与设置
  // ============================================================

  /**
   * 设置 Cesium 实例
   */
  setCesium(Cesium, cesiumViewer) {
    this.Cesium = Cesium;
    this.cesiumViewer = cesiumViewer;
    console.log('[SceneRotationManager] Cesium 已设置');
  }

  getCesium() {
    if (this.Cesium) return this.Cesium;
    if (typeof window !== 'undefined' && window.Cesium) return window.Cesium;
    return null;
  }

  /**
   * 设置场景容器（包含地板和所有模型的父对象）
   */
  setSceneContainer(container) {
    if (!container) {
      console.warn('[SceneRotationManager] 场景容器为空');
      return;
    }

    this.sceneContainer = container;
    console.log('[SceneRotationManager] 场景容器已设置:', container.name || 'unnamed');
  }

  /**
   * 初始化旋转系统
   */
  initialize(floorCenterMercator, floorCenterCartographic, initialENUState = null) {
    // ⚠️ 检查 Cesium 是否准备好
    if (!this.getCesium()) {
      console.warn('[SceneRotationManager] ⚠️ Cesium 未准备好，跳过旋转系统初始化');
      return;
    }

    this.floorCenterMercator = floorCenterMercator;
    this.floorCenterCartographic = floorCenterCartographic;

    if (initialENUState) {
      this.initialENUState = {
        east: new THREE.Vector3().copy(initialENUState.east),
        north: new THREE.Vector3().copy(initialENUState.north),
        up: new THREE.Vector3().copy(initialENUState.up)
      };
    }

    this._initializeBackSideDetection(floorCenterCartographic);

    // 检测初始模式
    const initialMode = this._detectModeFromCartographic(floorCenterCartographic);
    this.currentRotation.mode = initialMode;
    this.targetRotation.mode = initialMode;
    this._modeTransitionProtection.lastMode = initialMode;

    console.log('[SceneRotationManager] 旋转系统已初始化:', {
      floorCenterMercator,
      floorCenterCartographic: {
        longitude: (floorCenterCartographic.longitude * 180 / Math.PI).toFixed(6) + '°',
        latitude: (floorCenterCartographic.latitude * 180 / Math.PI).toFixed(6) + '°',
        height: floorCenterCartographic.height.toFixed(2) + 'm'
      },
      initialMode: initialMode
    });
  }

  // ============================================================
  // 模式检测与保护
  // ============================================================

  /**
   * 从经纬度检测模式
   * @private
   */
  _detectModeFromCartographic(cartographic) {
    if (!cartographic) return 'surface';
    return cartographic.height < UNDERGROUND_THRESHOLD ? 'underground' : 'surface';
  }

  /**
   * 从位置检测模式（Three.js坐标系）
   * @param {Object} position - 位置 {x, y, z}
   * @returns {string} 'surface' | 'underground'
   */
  detectModeFromPosition(position) {
    if (!position || typeof position.y !== 'number') {
      return this.currentRotation.mode; // 保持当前模式
    }
    return position.y < UNDERGROUND_THRESHOLD ? 'underground' : 'surface';
  }

  /**
   * 启用模式切换保护
   * @param {number} duration - 保护时长（毫秒）
   */
  enableModeTransitionProtection(duration = 1000) {
    this._modeTransitionProtection.enabled = true;
    this._modeTransitionProtection.until = Date.now() + duration;
    console.log('[SceneRotationManager] 模式切换保护已启用，时长:', duration, 'ms');
  }

  /**
   * 禁用模式切换保护
   */
  disableModeTransitionProtection() {
    this._modeTransitionProtection.enabled = false;
    this._modeTransitionProtection.until = 0;
    console.log('[SceneRotationManager] 模式切换保护已禁用');
  }

  /**
   * 检查是否在保护期内
   * @private
   */
  _isInProtectionPeriod() {
    return this._modeTransitionProtection.enabled && Date.now() < this._modeTransitionProtection.until;
  }

  // ============================================================
  // 核心旋转计算
  // ============================================================

  /**
   * 计算目标点处的局部坐标系（在Three.js坐标系中）
   */
  calculateLocalCoordinateSystem(targetCartographic, ellipsoid) {
    const Cesium = this.getCesium();
    if (!Cesium || !targetCartographic || !ellipsoid) {
      console.warn('[SceneRotationManager] calculateLocalCoordinateSystem: 缺少必要参数');
      return null;
    }

    try {
      const targetECEF = ellipsoid.cartographicToCartesian(targetCartographic);

      const lon = targetCartographic.longitude;
      const lat = targetCartographic.latitude;

      const cosLon = Math.cos(lon);
      const sinLon = Math.sin(lon);
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      const ecefEast = new Cesium.Cartesian3(-sinLon, cosLon, 0);
      const ecefUp = new Cesium.Cartesian3(cosLat * cosLon, cosLat * sinLon, sinLat);
      const ecefNorth = new Cesium.Cartesian3();
      Cesium.Cartesian3.cross(ecefUp, ecefEast, ecefNorth);

      const threeLocal = {
        east: new THREE.Vector3(ecefEast.x, ecefEast.z, -ecefEast.y),
        north: new THREE.Vector3(ecefNorth.x, ecefNorth.z, -ecefNorth.y),
        up: new THREE.Vector3(ecefUp.x, ecefUp.z, -ecefUp.y)
      };

      threeLocal.east.normalize();
      threeLocal.north.normalize();
      threeLocal.up.normalize();

      return threeLocal;
    } catch (error) {
      console.error('[SceneRotationManager] calculateLocalCoordinateSystem 失败:', error);
      return null;
    }
  }

  /**
   * 计算从初始ENU姿态到目标局部姿态的旋转四元数
   */
  calculateRotationQuaternion(targetLocal) {
    if (!targetLocal) {
      return new THREE.Quaternion(0, 0, 0, 1);
    }

    const targetMatrix = new THREE.Matrix4();
    const right = targetLocal.east.clone();
    const up = targetLocal.up.clone();
    const forward = targetLocal.north.clone().negate();

    targetMatrix.makeBasis(right, up, forward);

    const targetQuaternion = new THREE.Quaternion();
    targetQuaternion.setFromRotationMatrix(targetMatrix);

    return targetQuaternion;
  }

  // ============================================================
  // 背面检测
  // ============================================================

  _initializeBackSideDetection(floorCenterCartographic) {
    const Cesium = this.getCesium();
    if (!Cesium || !floorCenterCartographic) return;

    try {
      const ellipsoid = Cesium.Ellipsoid.WGS84;
      const floorCenterCartesian = ellipsoid.cartographicToCartesian(floorCenterCartographic);

      if (floorCenterCartesian) {
        this._initialFloorCenterNormal = Cesium.Cartesian3.normalize(
          floorCenterCartesian,
          new Cesium.Cartesian3()
        );
      }
    } catch (error) {
      console.warn('[SceneRotationManager] 背面检测初始化失败:', error);
    }
  }

  detectBackSide(cesiumCamera) {
    const Cesium = this.getCesium();
    if (!Cesium || !cesiumCamera || !this._initialFloorCenterNormal) {
      return false;
    }

    try {
      const cameraNormal = Cesium.Cartesian3.normalize(
        cesiumCamera.position,
        new Cesium.Cartesian3()
      );

      const dotProduct = Cesium.Cartesian3.dot(cameraNormal, this._initialFloorCenterNormal);
      const isOnBackSide = dotProduct < 0;

      this.currentRotation.isOnBackSide = isOnBackSide;

      return isOnBackSide;
    } catch (error) {
      return false;
    }
  }

  // ============================================================
  // 场景旋转更新（核心方法）
  // ============================================================

  /**
   * 计算围绕地心的旋转四元数
   * 从ENU原点的地心向量旋转到目标点的地心向量
   *
   * @param {Object} targetCartographic - 目标点的经纬度 {longitude, latitude, height}（弧度）
   * @param {Object} ellipsoid - Cesium椭球体
   * @param {Object} cesiumCamera - Cesium相机
   * @returns {THREE.Quaternion|null} 旋转四元数
   */
  calculateEarthCenterRotation(targetCartographic, ellipsoid, cesiumCamera) {
    const Cesium = this.getCesium();
    if (!Cesium || !targetCartographic || !ellipsoid) {
      console.warn('[SceneRotationManager] calculateEarthCenterRotation: 缺少必要参数');
      return null;
    }

    try {
      // 1. 获取ENU原点的ECEF坐标
      const currentENUOriginECEF = this._getENUOriginECEF();
      if (!currentENUOriginECEF) {
        console.warn('[SceneRotationManager] calculateEarthCenterRotation: ENU原点ECEF不可用');
        return null;
      }

      // 2. 计算目标点的ECEF坐标
      const targetECEF = ellipsoid.cartographicToCartesian(targetCartographic);
      if (!targetECEF) {
        console.warn('[SceneRotationManager] calculateEarthCenterRotation: 目标点ECEF转换失败');
        return null;
      }

      // 3. 计算法向量（从地心指向地表点的单位向量）
      const enuNormal = Cesium.Cartesian3.normalize(currentENUOriginECEF, new Cesium.Cartesian3());
      const targetNormal = Cesium.Cartesian3.normalize(targetECEF, new Cesium.Cartesian3());

      // 4. 计算旋转轴和角度
      const rotationAxis = Cesium.Cartesian3.cross(enuNormal, targetNormal, new Cesium.Cartesian3());
      const rotationAxisLength = Cesium.Cartesian3.magnitude(rotationAxis);

      // 检查是否共线（法向量相同或相反）
      if (rotationAxisLength < 0.0001) {
        // 法向量相同或相反，不需要旋转或旋转180度
        const dotProduct = Cesium.Cartesian3.dot(enuNormal, targetNormal);
        if (dotProduct > 0) {
          // 同向，不需要旋转
          console.log('[SceneRotationManager] calculateEarthCenterRotation: 法向量同向，无需旋转');
          return new THREE.Quaternion(0, 0, 0, 1);
        } else {
          // 反向，需要旋转180度
          console.log('[SceneRotationManager] calculateEarthCenterRotation: 法向量反向，旋转180度');
          // 使用任意垂直轴作为旋转轴
          const arbAxis = new Cesium.Cartesian3(1, 0, 0);
          const perpAxis = Cesium.Cartesian3.cross(enuNormal, arbAxis, new Cesium.Cartesian3());
          const finalAxis = Cesium.Cartesian3.normalize(perpAxis, new Cesium.Cartesian3());
          const rotationAxisENU = this._ecefVectorToENU(finalAxis);
          const rotationQuaternion = new THREE.Quaternion();
          rotationQuaternion.setFromAxisAngle(
            new THREE.Vector3(rotationAxisENU.x, rotationAxisENU.y, rotationAxisENU.z),
            Math.PI
          );
          return rotationQuaternion;
        }
      }

      // 归一化旋转轴
      Cesium.Cartesian3.normalize(rotationAxis, rotationAxis);

      // 计算旋转角度
      const dotProduct = Cesium.Cartesian3.dot(enuNormal, targetNormal);
      const rotationAngle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));

      // 5. 转换旋转轴到ENU坐标系
      const rotationAxisENU = this._ecefVectorToENU(rotationAxis);

      // 6. 创建旋转四元数
      const rotationQuaternion = new THREE.Quaternion();
      rotationQuaternion.setFromAxisAngle(
        new THREE.Vector3(rotationAxisENU.x, rotationAxisENU.y, rotationAxisENU.z),
        rotationAngle
      );

      console.log('[SceneRotationManager] calculateEarthCenterRotation: 旋转计算完成', {
        旋转角度: (rotationAngle * 180 / Math.PI).toFixed(2) + '°',
        旋转轴ENU: `(${rotationAxisENU.x.toFixed(4)}, ${rotationAxisENU.y.toFixed(4)}, ${rotationAxisENU.z.toFixed(4)})`
      });

      return rotationQuaternion;
    } catch (error) {
      console.error('[SceneRotationManager] calculateEarthCenterRotation 失败:', error);
      return null;
    }
  }

  /**
   * 获取ENU原点的ECEF坐标
   * @private
   * @returns {Cesium.Cartesian3|null} ENU原点的ECEF坐标
   */
  _getENUOriginECEF() {
    const Cesium = this.getCesium();
    if (!Cesium || !this.floorCenterCartographic) {
      return null;
    }

    try {
      const ellipsoid = this.cesiumViewer?.scene?.globe?.ellipsoid || Cesium.Ellipsoid.WGS84;
      return ellipsoid.cartographicToCartesian(this.floorCenterCartographic);
    } catch (error) {
      console.error('[SceneRotationManager] _getENUOriginECEF 失败:', error);
      return null;
    }
  }

  /**
   * 将ECEF向量转换到ENU坐标系
   * @private
   * @param {Cesium.Cartesian3} ecefVector - ECEF坐标系中的向量
   * @returns {THREE.Vector3} ENU坐标系中的向量
   */
  _ecefVectorToENU(ecefVector) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.floorCenterCartographic) {
      console.warn('[SceneRotationManager] _ecefVectorToENU: 缺少必要参数');
      return new THREE.Vector3(0, 0, 0);
    }

    try {
      const lon = this.floorCenterCartographic.longitude;
      const lat = this.floorCenterCartographic.latitude;

      const cosLon = Math.cos(lon);
      const sinLon = Math.sin(lon);
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      // ECEF到ENU的转换矩阵
      // ENU基向量在ECEF坐标系中的表示
      const ecefEast = new Cesium.Cartesian3(-sinLon, cosLon, 0);
      const ecefUp = new Cesium.Cartesian3(cosLat * cosLon, cosLat * sinLon, sinLat);
      const ecefNorth = new Cesium.Cartesian3();
      Cesium.Cartesian3.cross(ecefUp, ecefEast, ecefNorth);

      // 将ECEF向量投影到ENU基向量
      const enuX = Cesium.Cartesian3.dot(ecefVector, ecefEast);
      const enuY = Cesium.Cartesian3.dot(ecefVector, ecefNorth);
      const enuZ = Cesium.Cartesian3.dot(ecefVector, ecefUp);

      // ENU到Three.js坐标系的转换: X=East, Y=Up, Z=-North
      return new THREE.Vector3(enuX, enuZ, -enuY);
    } catch (error) {
      console.error('[SceneRotationManager] _ecefVectorToENU 失败:', error);
      return new THREE.Vector3(0, 0, 0);
    }
  }

  /**
   * 更新场景旋转（在渲染循环中调用）
   * @param {Object} cesiumCamera - Cesium相机
   * @param {boolean} forceUpdate - 是否强制更新
   */
  updateSceneRotation(cesiumCamera, forceUpdate = false) {
    const Cesium = this.getCesium();
    if (!Cesium || !this.cesiumViewer || !this.sceneContainer) {
      return;
    }

    try {
      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;

      // 1. 计算目标点（射线求交）
      let targetCartographic;
      try {
        const ray = new Cesium.Ray(cesiumCamera.position, cesiumCamera.direction);
        const targetPosition = Cesium.IntersectionTests.rayEllipsoid(ray, ellipsoid);

        if (Cesium.defined(targetPosition)) {
          targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);
        } else {
          const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
          targetCartographic = Cesium.Cartographic.fromRadians(
            cameraCartographic.longitude,
            cameraCartographic.latitude,
            0
          );
        }
      } catch (e) {
        const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
        targetCartographic = Cesium.Cartographic.fromRadians(
          cameraCartographic.longitude,
          cameraCartographic.latitude,
          0
        );
      }

      // 2. 检测背面
      this.detectBackSide(cesiumCamera);

      // 3. 检测当前模式
      const currentMode = this._detectModeFromCartographic(targetCartographic);

      // 4. 模式切换保护逻辑
      if (this._isInProtectionPeriod()) {
        // 在保护期内，保持上一次的模式
        this.targetRotation.mode = this._modeTransitionProtection.lastMode;
      } else {
        // 更新模式
        if (this.targetRotation.mode !== currentMode) {
          console.log('[SceneRotationManager] 模式切换:', this.targetRotation.mode, '→', currentMode);
          this._modeTransitionProtection.lastMode = currentMode;
        }
        this.targetRotation.mode = currentMode;
      }

      // 5. 根据模式调整旋转策略
      const adjustedQuaternion = this._calculateModeAwareRotation(
        targetCartographic,
        ellipsoid,
        cesiumCamera
      );

      if (!adjustedQuaternion) {
        return;
      }

      // 6. 应用旋转（带平滑过渡）
      if (this.enableSmoothing && !forceUpdate) {
        this.currentRotation.quaternion.slerp(adjustedQuaternion, this.smoothingFactor);
      } else {
        this.currentRotation.quaternion.copy(adjustedQuaternion);
      }

      // 7. 更新当前模式
      this.currentRotation.mode = this.targetRotation.mode;

      // 8. 应用到场景容器
      this.sceneContainer.quaternion.copy(this.currentRotation.quaternion);
      this.sceneContainer.updateMatrixWorld(true);

      // 9. 更新欧拉角
      this._updateEulerAngles();

    } catch (error) {
      console.error('[SceneRotationManager] updateSceneRotation 失败:', error);
    }
  }

  /**
   * 根据模式计算合适的旋转
   * @private
   */
  _calculateModeAwareRotation(targetCartographic, ellipsoid, cesiumCamera) {
    // 计算基础旋转
    const targetLocal = this.calculateLocalCoordinateSystem(targetCartographic, ellipsoid);
    if (!targetLocal) return null;

    let baseQuaternion = this.calculateRotationQuaternion(targetLocal);

    // 获取相机位置的高度
    const cameraCartographic = ellipsoid.cartesianToCartographic(cesiumCamera.position);
    const cameraHeight = cameraCartographic.height;

    // 根据模式调整旋转
    if (this.targetRotation.mode === 'surface') {
      // 地上模式：确保旋转后不会进入地下
      return this._adjustForSurfaceMode(baseQuaternion, cameraHeight);
    } else {
      // 地下模式：确保旋转后不会跳到地上
      return this._adjustForUndergroundMode(baseQuaternion, cameraHeight);
    }
  }

  /**
   * 为地上模式调整旋转
   * @private
   */
  _adjustForSurfaceMode(quaternion, cameraHeight) {
    // 地上模式：确保相机不会意外进入地下
    // 如果相机高度接近阈值，限制俯仰角

    if (cameraHeight < MIN_POSITION_Y + 100) {
      // 相机接近地下，限制旋转
      console.warn('[SceneRotationManager] 地上模式：相机高度过低，限制旋转');

      // 计算当前俯仰角
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
      const MIN_PITCH = -Math.PI / 2 + 0.1; // 最小俯仰角（约-85度）

      if (euler.x < MIN_PITCH) {
        euler.x = MIN_PITCH;
        quaternion.setFromEuler(euler);
      }
    }

    return quaternion;
  }

  /**
   * 为地下模式调整旋转
   * @private
   */
  _adjustForUndergroundMode(quaternion, cameraHeight) {
    // 地下模式：确保相机不会意外跳到地上
    // 如果相机高度接近阈值，限制俯仰角

    if (cameraHeight > UNDERGROUND_THRESHOLD - 100) {
      // 相机接近地面，限制旋转
      console.warn('[SceneRotationManager] 地下模式：相机高度过高，限制旋转');

      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
      const MAX_PITCH = Math.PI / 2 - 0.1; // 最大俯仰角（约85度）

      if (euler.x > MAX_PITCH) {
        euler.x = MAX_PITCH;
        quaternion.setFromEuler(euler);
      }
    }

    return quaternion;
  }

  _updateEulerAngles() {
    const euler = new THREE.Euler().setFromQuaternion(this.currentRotation.quaternion, 'YXZ');
    this.currentRotation.pitch = euler.x;
    this.currentRotation.roll = euler.z;
  }

  // ============================================================
  // 平滑控制
  // ============================================================

  setSmoothingFactor(factor) {
    this.smoothingFactor = Math.max(0.01, Math.min(1, factor));
  }

  setSmoothingEnabled(enabled) {
    this.enableSmoothing = enabled;
  }

  // ============================================================
  // 状态查询
  // ============================================================

  getRotationState() {
    return {
      quaternion: {
        x: this.currentRotation.quaternion.x,
        y: this.currentRotation.quaternion.y,
        z: this.currentRotation.quaternion.z,
        w: this.currentRotation.quaternion.w
      },
      pitch: this.currentRotation.pitch,
      roll: this.currentRotation.roll,
      mode: this.currentRotation.mode,
      isOnBackSide: this.currentRotation.isOnBackSide,
      hasSceneContainer: !!this.sceneContainer,
      isInitialized: !!this.floorCenterMercator,
      isInProtectionPeriod: this._isInProtectionPeriod()
    };
  }

  /**
   * 重置旋转系统
   */
  reset() {
    this.currentRotation = {
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      pitch: 0,
      roll: 0,
      mode: 'surface',
      isOnBackSide: false
    };

    this.targetRotation = {
      quaternion: new THREE.Quaternion(0, 0, 0, 1),
      mode: 'surface'
    };

    if (this.sceneContainer) {
      this.sceneContainer.quaternion.set(0, 0, 0, 1);
      this.sceneContainer.updateMatrixWorld(true);
    }

    this._modeTransitionProtection = {
      enabled: true,
      until: 0,
      lastMode: 'surface'
    };

    console.log('[SceneRotationManager] 旋转系统已重置');
  }
}

// 导出单例实例
export const sceneRotationManager = new SceneRotationManager();
export default sceneRotationManager;
