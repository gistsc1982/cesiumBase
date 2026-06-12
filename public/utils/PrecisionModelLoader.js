/**
 * PrecisionModelLoader - 精确模型加载器
 *
 * 实现您建议的改进方案：
 * 1. 先通过 Cesium 的 setView/flyTo 定位 ECEF 坐标反算出的经纬度位置
 * 2. 然后通过墨卡托投影计算模型在 Three.js 中的位置
 * 3. 实现米级精度的精确加载
 *
 * 坐标转换流程：
 *   ECEF → 经纬度 → Cesium定位 → 墨卡托 → Three.js
 */

import * as THREE from 'three';

export class PrecisionModelLoader {
  constructor(cesiumViewer, mercatorProjectionManager) {
    this.cesiumViewer = cesiumViewer;
    this.mercatorProjection = mercatorProjectionManager;
    this.Cesium = this.getCesium();

    // 地球半径（米），WGS84 椭球体
    this.EARTH_RADIUS = 6378137.0;

    // 精度配置
    this.precision = {
      // 相机飞行持续时间（秒）
      flightDuration: 2.0,
      // 相机高度偏移（米）
      cameraHeightOffset: 500,
      // 是否自动定位到模型位置
      autoPositionCamera: true
    };
  }

  /**
   * 获取 Cesium 实例
   */
  getCesium() {
    if (typeof window !== 'undefined' && window.Cesium) {
      return window.Cesium;
    }
    return null;
  }

  /**
   * ECEF 坐标转经纬度（使用 Cesium 精确反算）
   * @param {THREE.Vector3} ecefPosition - ECEF 坐标
   * @returns {Object|null} {longitude, latitude, height} 单位：弧度、弧度、米
   */
  ecefToCartographic(ecefPosition) {
    if (!this.Cesium || !this.cesiumViewer) {
      console.error('[PrecisionModelLoader] Cesium 未初始化');
      return null;
    }

    try {
      // 创建 Cesium Cartesian3 对象
      const cartesian = new this.Cesium.Cartesian3(
        ecefPosition.x,
        ecefPosition.y,
        ecefPosition.z
      );

      // 使用 Cesium 的椭球体进行精确反算
      const ellipsoid = this.cesiumViewer.scene.globe.ellipsoid;
      const cartographic = ellipsoid.cartesianToCartographic(cartesian);

      if (!cartographic) {
        console.error('[PrecisionModelLoader] ECEF 到经纬度转换失败');
        return null;
      }

      return {
        longitude: cartographic.longitude,  // 弧度
        latitude: cartographic.latitude,    // 弧度
        height: cartographic.height         // 米
      };
    } catch (error) {
      console.error('[PrecisionModelLoader] ECEF 到经纬度转换出错:', error);
      return null;
    }
  }

  /**
   * 经纬度转墨卡托坐标
   * @param {number} longitude - 经度（弧度）
   * @param {number} latitude - 纬度（弧度）
   * @param {number} height - 高度（米）
   * @returns {Object} {x, y, z} 墨卡托坐标（米）
   */
  lonLatToMercator(longitude, latitude, height = 0) {
    // 墨卡托 X 坐标 = 经度 × 地球半径
    const x = longitude * this.EARTH_RADIUS;

    // 墨卡托 Y 坐标 = ln(tan(π/4 + 纬度/2)) × 地球半径
    const y = Math.log(Math.tan(Math.PI / 4 + latitude / 2)) * this.EARTH_RADIUS;

    // Z 坐标就是高度
    const z = height;

    return { x, y, z };
  }

  /**
   * 墨卡托坐标转 Three.js 坐标
   * @param {Object} mercator - 墨卡托坐标 {x, y, z}
   * @param {Object} floorCenter - 地板中心墨卡托坐标
   * @returns {THREE.Vector3} Three.js 位置
   */
  mercatorToThreeJS(mercator, floorCenter = null) {
    // 如果没有提供地板中心，使用墨卡托投影管理器的地板中心
    if (!floorCenter) {
      floorCenter = this.mercatorProjection?.getFloorCenter() || { x: 0, y: 0, z: 0 };
    }

    // 计算相对于地板中心的偏移
    const offsetX = mercator.x - floorCenter.x;
    const offsetY = mercator.y - floorCenter.y;
    const offsetZ = mercator.z - floorCenter.z;

    // 转换为 Three.js 坐标系
    // Three.js: X(右), Y(上), Z(前)
    // 墨卡托: X(经度), Y(纬度), Z(高度)
    return new THREE.Vector3(
      offsetX,        // X 不变
      offsetZ,        // 高度作为 Y
      -offsetY        // 纬度取反作为 Z
    );
  }

  /**
   * 完整的坐标转换流程：ECEF → Three.js
   * @param {THREE.Vector3} ecefPosition - ECEF 坐标
   * @returns {Object|null} {threeJSPosition, cartographic, mercator}
   */
  convertECEFToThreeJS(ecefPosition) {
    console.log('[PrecisionModelLoader] 🔄 开始精确坐标转换:', {
      ecef: `(${ecefPosition.x.toFixed(2)}, ${ecefPosition.y.toFixed(2)}, ${ecefPosition.z.toFixed(2)})`
    });

    // 步骤 1: ECEF → 经纬度
    const cartographic = this.ecefToCartographic(ecefPosition);
    if (!cartographic) {
      return null;
    }

    console.log('[PrecisionModelLoader] 步骤 1: ECEF → 经纬度', {
      longitude: this.toDegrees(cartographic.longitude).toFixed(8) + '°',
      latitude: this.toDegrees(cartographic.latitude).toFixed(8) + '°',
      height: cartographic.height.toFixed(2) + 'm'
    });

    // 步骤 2: 经纬度 → 墨卡托
    const mercator = this.lonLatToMercator(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height
    );

    console.log('[PrecisionModelLoader] 步骤 2: 经纬度 → 墨卡托', {
      x: mercator.x.toFixed(2) + 'm',
      y: mercator.y.toFixed(2) + 'm',
      z: mercator.z.toFixed(2) + 'm'
    });

    // 步骤 3: 墨卡托 → Three.js
    const threeJSPosition = this.mercatorToThreeJS(mercator);

    console.log('[PrecisionModelLoader] 步骤 3: 墨卡托 → Three.js', {
      position: `(${threeJSPosition.x.toFixed(2)}, ${threeJSPosition.y.toFixed(2)}, ${threeJSPosition.z.toFixed(2)})`
    });

    return {
      threeJSPosition,
      cartographic,
      mercator
    };
  }

  /**
   * 使用 Cesium 相机定位到模型位置
   * @param {Object} cartographic - 经纬度位置 {longitude, latitude, height}
   * @param {number} heightOffset - 相机高度偏移（米）
   * @returns {Promise<void>}
   */
  async positionCesiumCamera(cartographic, heightOffset = null) {
    if (!this.Cesium || !this.cesiumViewer) {
      console.warn('[PrecisionModelLoader] Cesium 未初始化，跳过相机定位');
      return;
    }

    if (!this.precision.autoPositionCamera) {
      console.log('[PrecisionModelLoader] 自动定位已禁用，跳过相机定位');
      return;
    }

    const h = heightOffset !== null ? heightOffset : this.precision.cameraHeightOffset;

    console.log('[PrecisionModelLoader] 📍 定位 Cesium 相机到模型位置:', {
      longitude: this.toDegrees(cartographic.longitude).toFixed(8) + '°',
      latitude: this.toDegrees(cartographic.latitude).toFixed(8) + '°',
      height: (cartographic.height + h).toFixed(2) + 'm'
    });

    try {
      // 使用 flyTo 进行平滑飞行定位
      await this.cesiumViewer.camera.flyTo({
        destination: this.Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          cartographic.height + h
        ),
        orientation: {
          heading: 0,      // 朝向正北
          pitch: -Math.PI / 4,  // 俯视 45 度
          roll: 0
        },
        duration: this.precision.flightDuration
      });

      console.log('[PrecisionModelLoader] ✅ Cesium 相机定位完成');
    } catch (error) {
      console.error('[PrecisionModelLoader] Cesium 相机定位失败:', error);
    }
  }

  /**
   * 精确加载模型（完整流程）
   * @param {THREE.Object3D} model - Three.js 模型对象
   * @param {THREE.Vector3} ecefPosition - ECEF 坐标
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} {threeJSPosition, cartographic, mercator}
   */
  async loadModelPrecisely(model, ecefPosition, options = {}) {
    console.log('[PrecisionModelLoader] 🚀 开始精确加载模型');

    // 合并配置
    const config = { ...this.precision, ...options };

    // 步骤 1: 坐标转换 ECEF → Three.js
    const result = this.convertECEFToThreeJS(ecefPosition);
    if (!result) {
      console.error('[PrecisionModelLoader] 坐标转换失败');
      return null;
    }

    // 步骤 2: 设置模型位置
    model.position.copy(result.threeJSPosition);
    model.updateMatrixWorld(true);

    console.log('[PrecisionModelLoader] ✅ 模型位置已设置:', {
      position: `(${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`
    });

    // 步骤 3: 定位 Cesium 相机
    if (config.autoPositionCamera) {
      await this.positionCesiumCamera(result.cartographic, config.cameraHeightOffset);
    }

    // 保存模型数据
    model.userData.precisionLoaded = true;
    model.userData.ecefPosition = ecefPosition.clone();
    model.userData.cartographic = result.cartographic;
    model.userData.mercator = result.mercator;
    model.userData.threeJSPosition = result.threeJSPosition.clone();

    // 步骤 4: 局部坐标系模式下标记地面点
    if (this.mercatorProjection?.isUsingLocalCoordinateSystem()) {
      this.addGroundMarker(result.cartographic);
    }

    return result;
  }

  /**
   * 在地面位置添加黄色标记点（用于局部坐标系模式）
   * @param {Object} cartographic - 经纬度位置 {longitude, latitude, height}
   */
  addGroundMarker(cartographic) {
    if (!this.Cesium || !this.cesiumViewer) {
      console.warn('[PrecisionModelLoader] Cesium 未初始化，跳过地面标记');
      return;
    }

    try {
      // 计算地面位置（高度设为0，表示地表面）
      const groundPosition = this.Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        0  // 地面高度为0
      );

      // 创建黄色标记点
      const markerEntity = this.cesiumViewer.entities.add({
        id: `ground-marker-${Date.now()}`,
        position: groundPosition,
        point: {
          pixelSize: 15,
          color: this.Cesium.Color.YELLOW,
          outlineColor: this.Cesium.Color.RED,
          outlineWidth: 2,
          heightReference: this.Cesium.HeightReference.NONE,  // 绝对高度
          disableDepthTestDistance: Number.POSITIVE_INFINITY  // 始终可见
        },
        label: {
          text: '📍 地面点',
          font: '14px sans-serif',
          fillColor: this.Cesium.Color.YELLOW,
          outlineColor: this.Cesium.Color.BLACK,
          outlineWidth: 2,
          style: this.Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: this.Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new this.Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });

      console.log('[PrecisionModelLoader] ✅ 局部坐标系模式：已添加地面黄色标记点', {
        经度: this.toDegrees(cartographic.longitude).toFixed(8) + '°',
        纬度: this.toDegrees(cartographic.latitude).toFixed(8) + '°',
        标记ID: markerEntity.id
      });
    } catch (error) {
      console.error('[PrecisionModelLoader] 添加地面标记失败:', error);
    }
  }

  /**
   * 批量精确加载模型
   * @param {Array<THREE.Object3D>} models - 模型数组
   * @param {Array<THREE.Vector3>} ecefPositions - ECEF 坐标数组
   * @param {Object} options - 配置选项
   * @returns {Promise<Array>} 转换结果数组
   */
  async loadModelsPrecisely(models, ecefPositions, options = {}) {
    if (models.length !== ecefPositions.length) {
      console.error('[PrecisionModelLoader] 模型和位置数量不匹配');
      return null;
    }

    console.log(`[PrecisionModelLoader] 🚀 批量精确加载 ${models.length} 个模型`);

    const results = [];

    for (let i = 0; i < models.length; i++) {
      const result = await this.loadModelPrecisely(models[i], ecefPositions[i], options);
      if (result) {
        results.push(result);
      }
    }

    // 定位到第一个模型位置
    if (results.length > 0 && options.autoPositionCamera !== false) {
      await this.positionCesiumCamera(results[0].cartographic, options.cameraHeightOffset);
    }

    console.log(`[PrecisionModelLoader] ✅ 批量加载完成，成功加载 ${results.length} 个模型`);

    return results;
  }

  /**
   * 弧度转度
   */
  toDegrees(radians) {
    return radians * 180 / Math.PI;
  }

  /**
   * 度转弧度
   */
  toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  /**
   * 设置精度配置
   */
  setPrecisionConfig(config) {
    this.precision = { ...this.precision, ...config };
  }

  /**
   * 获取精度配置
   */
  getPrecisionConfig() {
    return { ...this.precision };
  }
}

export default PrecisionModelLoader;
