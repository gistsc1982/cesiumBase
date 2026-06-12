/**
 * 地上地下检测器
 * 负责判断当前相机处于地上模式还是地下模式
 */

export class SurfaceModeDetector {
  constructor() {
    // 地下模式阈值：position.y < -50 为地下模式
    this.UNDERGROUND_THRESHOLD = -50;
  }

  /**
   * 判断是否为地下模式
   * @param {Object} position - 相机位置 {x, y, z}
   * @returns {boolean} true 表示地下模式，false 表示地上模式
   */
  isUnderground(position) {
    if (!position || typeof position.y !== 'number') {
      console.warn('[SurfaceModeDetector] 无效的位置对象');
      return false;
    }
    return position.y < this.UNDERGROUND_THRESHOLD;
  }

  /**
   * 判断是否为地上模式
   * @param {Object} position - 相机位置 {x, y, z}
   * @returns {boolean} true 表示地上模式，false 表示地下模式
   */
  isSurface(position) {
    return !this.isUnderground(position);
  }

  /**
   * 获取当前模式
   * @param {Object} position - 相机位置 {x, y, z}
   * @returns {string} 'surface' | 'underground' | 'unknown'
   */
  getSurfaceMode(position) {
    if (!position || typeof position.y !== 'number') {
      return 'unknown';
    }
    return this.isUnderground(position) ? 'underground' : 'surface';
  }

  /**
   * 从 Cesium 相机状态检测模式
   * @param {Object} cesiumCamera - Cesium 相机对象
   * @param {Function} cartesianToCartographic - 坐标转换函数
   * @returns {string} 'surface' | 'underground' | 'unknown'
   */
  detectFromCesiumCamera(cesiumCamera, cartesianToCartographic) {
    if (!cesiumCamera || !cesiumCamera.position) {
      return 'unknown';
    }

    try {
      const cartographic = cartesianToCartographic(cesiumCamera.position);
      if (!cartographic) {
        return 'unknown';
      }

      // Cesium 中 height < 0 为地下模式
      return cartographic.height < 0 ? 'underground' : 'surface';
    } catch (error) {
      console.warn('[SurfaceModeDetector] 从 Cesium 相机检测模式失败:', error);
      return 'unknown';
    }
  }

  /**
   * 获取地下模式阈值
   * @returns {number} 地下模式阈值
   */
  getThreshold() {
    return this.UNDERGROUND_THRESHOLD;
  }

  /**
   * 设置地下模式阈值
   * @param {number} threshold - 新的阈值
   */
  setThreshold(threshold) {
    if (typeof threshold === 'number' && isFinite(threshold)) {
      this.UNDERGROUND_THRESHOLD = threshold;
      console.log(`[SurfaceModeDetector] 地下模式阈值已更新为: ${threshold}`);
    } else {
      console.warn('[SurfaceModeDetector] 无效的阈值:', threshold);
    }
  }
}

// 导出单例实例
export const surfaceModeDetector = new SurfaceModeDetector();
