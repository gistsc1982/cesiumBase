/**
 * 控制器限制管理器
 * 根据 isInRealWorldMode 状态统一管理翻转和平移限制
 */

// 缓存上次应用的限制，避免重复应用
const _restrictionsCache = new WeakMap();

export class ControlsRestrictionManager {
  /**
   * 获取极点角度限制配置
   * @param {boolean} hasLargeCoordModelSelected - 是否选中了大坐标模型
   * @param {boolean} isInRealWorldMode - 是否已切换到真实世界模式
   * @param {number} totalModelCount - 场景中模型总数
   * @param {boolean} restrictSmallCoordMode - 是否限制小坐标模式（默认 false）
   * @param {boolean} isInRealWorldCoordinates - 是否处于真实世界坐标系统（Cesium已集成），默认 false
   * @returns {Object} { minPolarAngle, maxPolarAngle }
   */
  static getPolarAngleLimits(hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordMode = false, isInRealWorldCoordinates = false) {
    // 1. 如果是真实世界模式，允许翻转
    if (isInRealWorldMode) {
      console.log('[ControlsRestrictionManager] 真实世界模式：允许 360 度翻转');
      return {
        minPolarAngle: 0,
        maxPolarAngle: Math.PI  // 允许完全翻转
      };
    }

    // 2. 地图模式（Cesium已集成但未切换到真实世界模式）
    // ⚠️ 修复：允许翻转，让地板和Cesium地面能够同步翻转
    // 参考 cesiumBase-ok-rotation 的实现
    if (isInRealWorldCoordinates) {
      console.log('[ControlsRestrictionManager] 地图模式（未切换）：允许翻转（与参考项目保持一致）');
      return {
        minPolarAngle: 0,
        maxPolarAngle: Math.PI  // 允许完全翻转
      };
    }

    // 3. 大坐标模型但未切换到真实世界模式
    // ⚠️ 修复：允许翻转，让地板和Cesium地面能够同步翻转
    // 参考 cesiumBase-ok-rotation 的实现
    if (hasLargeCoordModelSelected) {
      console.log('[ControlsRestrictionManager] 大坐标模型（未切换）：允许翻转（与参考项目保持一致）');
      return {
        minPolarAngle: 0,
        maxPolarAngle: Math.PI  // 允许完全翻转
      };
    }

    // 4. 小模型模式或未加载模型
    const reason = totalModelCount === 0 ? '未加载模型' : '小模型模式';

    // 5. 如果设置了限制小坐标模式，则限制翻转
    if (restrictSmallCoordMode) {
      console.log(`[ControlsRestrictionManager] ${reason}（限制模式）：限制翻转`);
      return {
        minPolarAngle: 0,
        maxPolarAngle: Math.PI / 2 - 0.01  // 限制到略小于水平线
      };
    }

    // 6. 默认：允许翻转
    console.log(`[ControlsRestrictionManager] ${reason}：允许翻转`);
    return {
      minPolarAngle: 0,
      maxPolarAngle: Math.PI  // 允许完全翻转
    };
  }

  /**
   * 获取平移启用配置
   * @param {boolean} hasLargeCoordModelSelected - 是否选中了大坐标模型
   * @param {boolean} isInRealWorldMode - 是否已切换到真实世界模式
   * @param {number} totalModelCount - 场景中模型总数
   * @param {boolean} restrictSmallCoordMode - 是否限制小坐标模式（默认 false）
   * @param {boolean} isInRealWorldCoordinates - 是否处于真实世界坐标系统（Cesium已集成），默认 false
   * @returns {boolean} 是否启用平移
   */
  static getPanEnabled(hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordMode = false, isInRealWorldCoordinates = false) {
    // 1. 如果是真实世界模式，允许平移
    if (isInRealWorldMode) {
      return true;
    }

    // 2. 地图模式（Cesium已集成但未切换到真实世界模式）：禁用平移
    if (isInRealWorldCoordinates) {
      return false;
    }

    // 3. 大坐标模型但未切换到真实世界模式，禁用平移
    if (hasLargeCoordModelSelected) {
      return false;
    }

    // 4. 如果设置了限制小坐标模式，则禁用平移
    if (restrictSmallCoordMode) {
      return false;
    }

    // 5. 默认：允许平移
    return true;
  }

  /**
   * 应用控制器限制
   * @param {THREE.OrbitControls} controls - OrbitControls 实例
   * @param {boolean} hasLargeCoordModelSelected - 是否选中了大坐标模型
   * @param {boolean} isInRealWorldMode - 是否已切换到真实世界模式
   * @param {number} totalModelCount - 场景中模型总数
   * @param {boolean|Object} restrictSmallCoordModeOrOptions - 是否限制小坐标模式（true=限制），或配置对象
   * @param {Object} finalOptions - 当 restrictSmallCoordModeOrOptions 为配置对象时，此参数为额外选项
   */
  static applyRestrictions(controls, hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordModeOrOptions = {}, finalOptions = {}) {
    if (!controls) return;

    // 兼容多种调用方式：
    // 1. applyRestrictions(controls, hasLargeCoord, isInRealWorld, totalModelCount, restrictSmallCoordMode, { update, verbose })
    // 2. applyRestrictions(controls, hasLargeCoord, isInRealWorld, totalModelCount, { update, verbose, restrictSmallCoordMode, isInRealWorldCoordinates })

    let restrictSmallCoordMode = false;
    let isInRealWorldCoordinates = false;
    let update = false;
    let verbose = false;

    // 判断第5个参数的类型
    if (typeof restrictSmallCoordModeOrOptions === 'boolean') {
      restrictSmallCoordMode = restrictSmallCoordModeOrOptions;
      update = finalOptions.update || false;
      verbose = finalOptions.verbose || false;
      isInRealWorldCoordinates = finalOptions.isInRealWorldCoordinates || false;
    } else if (typeof restrictSmallCoordModeOrOptions === 'object') {
      update = restrictSmallCoordModeOrOptions.update || false;
      verbose = restrictSmallCoordModeOrOptions.verbose || false;
      restrictSmallCoordMode = restrictSmallCoordModeOrOptions.restrictSmallCoordMode || false;
      isInRealWorldCoordinates = restrictSmallCoordModeOrOptions.isInRealWorldCoordinates || false;
    }

    const limits = this.getPolarAngleLimits(hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordMode, isInRealWorldCoordinates);
    const panEnabled = this.getPanEnabled(hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordMode, isInRealWorldCoordinates);

    // 保存旧值用于比较
    const oldMinPolar = controls.minPolarAngle;
    const oldMaxPolar = controls.maxPolarAngle;
    const oldEnablePan = controls.enablePan;

    // 应用新设置
    controls.minPolarAngle = limits.minPolarAngle;
    controls.maxPolarAngle = limits.maxPolarAngle;
    controls.enablePan = panEnabled;

    // 更新控制器状态
    if (update) {
      controls.update();
    }

    // 输出日志
    if (verbose) {
      let mode;
      let description;

      if (isInRealWorldMode) {
        mode = '真实世界模式';
        description = '允许 360 度翻转和平移';
      } else if (isInRealWorldCoordinates) {
        mode = '地图模式（未切换）';
        description = '允许 360 度翻转（与参考项目一致）';
      } else if (hasLargeCoordModelSelected) {
        mode = '大坐标模型（未切换）';
        description = '允许 360 度翻转（与参考项目一致）';
      } else if (restrictSmallCoordMode) {
        mode = totalModelCount === 0 ? '未加载模型（限制模式）' : '小模型模式（限制模式）';
        description = '限制在上半球，禁用平移';
      } else {
        mode = totalModelCount === 0 ? '未加载模型' : '小模型模式';
        description = '允许 360 度翻转和平移';
      }

      const changed =
        oldMinPolar !== limits.minPolarAngle ||
        oldMaxPolar !== limits.maxPolarAngle ||
        oldEnablePan !== panEnabled;

      if (changed) {
        console.log(`[ControlsRestrictionManager] 应用限制 (${mode}):`, {
          minPolarAngle: `${oldMinPolar.toFixed(4)} → ${limits.minPolarAngle.toFixed(4)}`,
          maxPolarAngle: `${oldMaxPolar.toFixed(4)} → ${limits.maxPolarAngle.toFixed(4)}`,
          enablePan: `${oldEnablePan} → ${panEnabled}`,
          描述: description
        });
      }
    }
  }

  /**
   * 批量应用限制到多个控制器
   * @param {Array<THREE.OrbitControls>} controlsArray - OrbitControls 实例数组
   * @param {boolean} hasLargeCoordModelSelected - 是否选中了大坐标模型
   * @param {boolean} isInRealWorldMode - 是否已切换到真实世界模式
   * @param {number} totalModelCount - 场景中模型总数
   * @param {Object} options - 可选配置，包含 isInRealWorldCoordinates
   */
  static applyRestrictionsToMultiple(controlsArray, hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, options = {}) {
    if (!Array.isArray(controlsArray)) return;

    controlsArray.forEach(controls => {
      this.applyRestrictions(controls, hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, options);
    });
  }

  /**
   * 检查控制器是否处于大坐标模式
   * @param {THREE.OrbitControls} controls - OrbitControls 实例
   * @returns {boolean} 是否处于大坐标模式
   */
  static isLargeCoordinateMode(controls) {
    if (!controls) return false;
    // 通过 maxPolarAngle 判断
    return controls.maxPolarAngle >= Math.PI - 0.01;
  }

  /**
   * 获取当前模式描述
   * @param {boolean} hasLargeCoordModelSelected - 是否选中了大坐标模型
   * @param {boolean} isInRealWorldMode - 是否已切换到真实世界模式
   * @param {number} totalModelCount - 场景中模型总数
   * @param {boolean} restrictSmallCoordMode - 是否限制小坐标模式（默认 false）
   * @param {boolean} isInRealWorldCoordinates - 是否处于真实世界坐标系统（Cesium已集成），默认 false
   * @returns {Object} 模式描述
   */
  static getModeDescription(hasLargeCoordModelSelected, isInRealWorldMode, totalModelCount, restrictSmallCoordMode = false, isInRealWorldCoordinates = false) {
    if (isInRealWorldMode) {
      return {
        name: '真实世界模式',
        description: '允许 360 度翻转和平移',
        polarAngle: '0 ~ π (180°)',
        pan: '启用'
      };
    } else if (isInRealWorldCoordinates) {
      return {
        name: '地图模式（未切换）',
        description: '允许 360 度翻转（与参考项目一致）',
        polarAngle: '0 ~ π (180°)',
        pan: '启用'
      };
    } else if (hasLargeCoordModelSelected) {
      return {
        name: '大坐标模型（未切换）',
        description: '允许 360 度翻转（与参考项目一致）',
        polarAngle: '0 ~ π (180°)',
        pan: '启用'
      };
    } else if (restrictSmallCoordMode) {
      return {
        name: totalModelCount === 0 ? '未加载模型（限制模式）' : '小模型模式（限制模式）',
        description: '限制在上半球，禁用平移',
        polarAngle: '0 ~ π/2 - 0.01 (90°)',
        pan: '禁用'
      };
    } else {
      return {
        name: totalModelCount === 0 ? '未加载模型' : '小模型模式',
        description: '允许 360 度翻转和平移',
        polarAngle: '0 ~ π (180°)',
        pan: '启用'
      };
    }
  }
}

export default ControlsRestrictionManager;
