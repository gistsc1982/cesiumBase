/**
 * 多实例面板配置管理器
 *
 * 为每个 CesiumMain 实例维护独立的面板配置
 * 解决多实例模式下位置重叠和可见性冲突问题
 *
 * 功能：
 * - 为每个实例创建独立的配置副本
 * - 自动计算位置偏移，避免面板重叠
 * - 支持实例级别的可见性控制
 * - 兼容单实例模式
 *
 * @example
 * import { multiInstancePanelConfigManager } from './utils/MultiInstancePanelConfigManager.js';
 *
 * // 初始化全局配置
 * multiInstancePanelConfigManager.initGlobalConfig(functionPanelsConfig);
 *
 * // 创建新实例
 * const instanceId = multiInstancePanelConfigManager.createInstance();
 *
 * // 获取实例的面板配置
 * const panelConfig = multiInstancePanelConfigManager.getPanelConfig(instanceId, 'TestPanel');
 *
 * // 设置面板可见性
 * multiInstancePanelConfigManager.setPanelVisible(instanceId, 'TestPanel', true);
 */

class MultiInstancePanelConfigManager {
  constructor() {
    // 全局配置（从 functionPanels.config.json 读取）
    this.globalConfig = null;

    // 实例配置映射
    // Map<instanceId, Map<panelName, panelConfig>>
    this.instanceConfigs = new Map();

    // ⭐ 多实例面板运行时管理
    // 用于管理动态创建的面板实例（如 TestSfc 多实例）
    // Map<instanceKey, panelInstance>
    // instanceKey 格式: `${instanceId}_${panelName}_${panelInstanceId}`
    this.panelInstances = new Map();

    // ⭐ 面板实例计数器（为每个面板类型维护独立的计数器）
    // Map<panelName, counter>
    this.panelInstanceCounters = new Map();

    // 实例计数器
    this.instanceCounter = 0;

    // 位置偏移配置
    this.positionOffset = {
      x: 40, // 每个实例水平偏移量
      y: 40  // 每个实例垂直偏移量
    };

    // 默认配置
    this.defaultConfig = {
      visible: true,
      position: {
        initialX: 'center',
        initialY: 80
      }
    };

    console.log('[MultiInstancePanelConfigManager] 初始化完成');
  }

  /**
   * 初始化全局配置
   * @param {Object} config - 从 functionPanels.config.json 读取的配置
   */
  initGlobalConfig(config) {
    this.globalConfig = config;

    // 读取位置偏移配置
    if (config.multiInstance?.positionOffset) {
      this.positionOffset = {
        ...this.positionOffset,
        ...config.multiInstance.positionOffset
      };
    }

    // 读取默认可见性配置
    if (config.multiInstance?.defaultVisible !== undefined) {
      this.defaultConfig.visible = config.multiInstance.defaultVisible;
    }

    console.log('[MultiInstancePanelConfigManager] 全局配置已初始化:', {
      面板数: config.panels?.length || 0,
      位置偏移: this.positionOffset,
      默认可见: this.defaultConfig.visible
    });
  }

  /**
   * 创建新实例配置
   * @param {Object} options - 创建选项
   * @param {number} options.positionOffset - 自定义位置偏移（可选）
   * @param {boolean} options.inheritVisible - 是否继承全局配置的可见性（默认 true）
   * @returns {number} 实例ID
   */
  createInstance(options = {}) {
    const instanceId = ++this.instanceCounter;

    // 为新实例创建默认配置
    const instanceConfig = new Map();

    if (this.globalConfig && this.globalConfig.panels) {
      this.globalConfig.panels.forEach(panel => {
        // 计算实例特定的位置偏移
        const position = this._calculateInstancePosition(
          panel.position,
          instanceId,
          options.positionOffset
        );

        // 确定可见性
        const visible = options.inheritVisible !== false
          ? (panel.visible !== undefined ? panel.visible : this.defaultConfig.visible)
          : this.defaultConfig.visible;

        instanceConfig.set(panel.name, {
          // 基础配置
          name: panel.name,
          title: panel.title,
          description: panel.description,
          icon: panel.icon,
          category: panel.category,
          enabled: panel.enabled,
          file: panel.file,

          // 实例特定配置
          visible: visible,
          position: position,

          // 原始配置（用于参考）
          originalConfig: panel
        });
      });
    }

    this.instanceConfigs.set(instanceId, instanceConfig);

    console.log(`[MultiInstancePanelConfigManager] ✅ 创建实例 #${instanceId}，配置面板数: ${instanceConfig.size}`);

    // 暴露到全局（用于调试和非Vue环境访问）
    if (typeof window !== 'undefined') {
      if (!window.__multiInstancePanelConfigManager__) {
        window.__multiInstancePanelConfigManager__ = this;
      }
    }

    return instanceId;
  }

  /**
   * 计算实例位置偏移
   * @private
   * @param {Object} basePosition - 基础位置配置
   * @param {number} instanceId - 实例ID
   * @param {number} customOffset - 自定义偏移量（可选）
   * @returns {Object} 偏移后的位置配置
   */
  _calculateInstancePosition(basePosition, instanceId, customOffset) {
    const offset = customOffset !== undefined
      ? customOffset
      : (instanceId - 1) * this.positionOffset.y;

    if (!basePosition) {
      return {
        initialX: this.defaultConfig.position.initialX,
        initialY: this.defaultConfig.position.initialY + offset
      };
    }

    // 处理 initialX
    let initialX = basePosition.initialX;
    if (initialX !== 'center' && initialX !== 'left' && initialX !== 'right') {
      // 如果是数值，添加偏移
      initialX = typeof initialX === 'number' ? initialX + offset : initialX;
    }

    // 处理 initialY
    const initialY = (basePosition.initialY || this.defaultConfig.position.initialY) + offset;

    return { initialX, initialY };
  }

  /**
   * 获取实例的面板配置
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @returns {Object|null} 面板配置
   */
  getPanelConfig(instanceId, panelName) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 不存在`);
      return null;
    }

    const panelConfig = instanceConfig.get(panelName);
    if (!panelConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 中没有找到面板: ${panelName}`);
      return null;
    }

    return panelConfig;
  }

  /**
   * 获取实例的所有面板配置
   * @param {number} instanceId - 实例ID
   * @returns {Array<Object>} 面板配置列表
   */
  getAllPanelConfigs(instanceId) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 不存在`);
      return [];
    }

    return Array.from(instanceConfig.values());
  }

  /**
   * 设置面板可见性
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  setPanelVisible(instanceId, panelName, visible) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 不存在`);
      return;
    }

    const panelConfig = instanceConfig.get(panelName);
    if (!panelConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 面板 ${panelName} 不存在于实例 #${instanceId}`);
      return;
    }

    panelConfig.visible = visible;
    console.log(`[MultiInstancePanelConfigManager] 🔄 设置实例 #${instanceId} 的面板 ${panelName} 可见性: ${visible}`);
  }

  /**
   * 切换面板可见性
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @returns {boolean} 切换后的可见性
   */
  togglePanelVisible(instanceId, panelName) {
    const panelConfig = this.getPanelConfig(instanceId, panelName);
    if (!panelConfig) {
      return false;
    }

    panelConfig.visible = !panelConfig.visible;
    console.log(`[MultiInstancePanelConfigManager] 🔄 切换实例 #${instanceId} 的面板 ${panelName} 可见性: ${panelConfig.visible}`);

    return panelConfig.visible;
  }

  /**
   * 获取实例所有可见的面板
   * @param {number} instanceId - 实例ID
   * @returns {Array<Object>} 可见面板列表
   */
  getVisiblePanels(instanceId) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 不存在`);
      return [];
    }

    return Array.from(instanceConfig.values())
      .filter(config => config.visible)
      .map(config => ({
        name: config.name,
        title: config.title,
        icon: config.icon,
        visible: config.visible,
        position: config.position
      }));
  }

  /**
   * 更新面板位置
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @param {Object} position - 新位置配置
   */
  updatePanelPosition(instanceId, panelName, position) {
    const panelConfig = this.getPanelConfig(instanceId, panelName);
    if (!panelConfig) {
      return;
    }

    panelConfig.position = {
      ...panelConfig.position,
      ...position
    };

    console.log(`[MultiInstancePanelConfigManager] 📍 更新实例 #${instanceId} 的面板 ${panelName} 位置:`, panelConfig.position);
  }

  /**
   * 销毁实例配置
   * @param {number} instanceId - 实例ID
   */
  destroyInstance(instanceId) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 实例 #${instanceId} 不存在`);
      return;
    }

    const panelCount = instanceConfig.size;
    this.instanceConfigs.delete(instanceId);

    console.log(`[MultiInstancePanelConfigManager] 🗑️ 销毁实例 #${instanceId}，清理 ${panelCount} 个面板配置`);
  }

  /**
   * 获取所有实例ID
   * @returns {Array<number>} 实例ID列表
   */
  getAllInstanceIds() {
    return Array.from(this.instanceConfigs.keys());
  }

  /**
   * 获取实例统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      总实例数: this.instanceConfigs.size,
      实例列表: this.getAllInstanceIds(),
      位置偏移: this.positionOffset,
      默认可见: this.defaultConfig.visible
    };
  }

  /**
   * 重置所有实例配置
   */
  reset() {
    this.instanceConfigs.clear();
    this.panelInstances.clear();
    this.panelInstanceCounters.clear();
    this.instanceCounter = 0;
    console.log('[MultiInstancePanelConfigManager] 🔄 已重置所有实例配置');
  }

  // ==================== 多实例面板运行时管理 ====================

  /**
   * 生成唯一面板实例键
   * @private
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {number} panelInstanceId - 面板实例ID（可选，用于多实例面板）
   * @returns {string} 唯一键
   */
  _generateInstanceKey(instanceId, panelName, panelInstanceId = null) {
    if (panelInstanceId !== null) {
      return `${instanceId}_${panelName}_${panelInstanceId}`;
    }
    return `${instanceId}_${panelName}`;
  }

  /**
   * 注册面板实例（用于动态创建的多实例面板）
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {Object} config - 面板配置
   * @param {Object} config.component - 组件实例
   * @param {Object} config.props - 组件属性
   * @param {boolean} config.visible - 是否可见
   * @param {number} panelInstanceId - 面板实例ID（可选，默认自动生成）
   * @returns {string} 面板实例键
   */
  registerPanelInstance(instanceId, panelName, config, panelInstanceId = null) {
    // 如果没有提供面板实例ID，自动生成
    if (panelInstanceId === null) {
      const counter = this.panelInstanceCounters.get(panelName) || 0;
      panelInstanceId = counter + 1;
      this.panelInstanceCounters.set(panelName, panelInstanceId);
    }

    const instanceKey = this._generateInstanceKey(instanceId, panelName, panelInstanceId);

    // 计算位置偏移（如果是多实例面板）
    // ⭐ 修复：直接展开位置属性，而不是嵌套在 position 对象中
    const { initialX, initialY } = config.props?.position || this._calculateMultiInstancePanelPosition(
      instanceId,
      panelName,
      panelInstanceId,
      config.props
    );

    const props = {
      ...config.props,
      initialX,
      initialY
    };

    // ⭐ 移除嵌套的 position 对象（如果存在）
    delete props.position;

    this.panelInstances.set(instanceKey, {
      instanceId,
      panelName,
      panelInstanceId,
      component: config.component,
      props: props,
      visible: config.visible !== false,
      createdAt: Date.now()
    });

    console.log(`[MultiInstancePanelConfigManager] ✅ 注册面板实例: ${instanceKey}`, {
      位置: { initialX, initialY },
      可见: this.panelInstances.get(instanceKey).visible,
      props: props,
      propsPanelInstanceId: props.panelInstanceId
    });

    return instanceKey;
  }

  /**
   * 注销面板实例
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {number} panelInstanceId - 面板实例ID（可选）
   */
  unregisterPanelInstance(instanceId, panelName, panelInstanceId = null) {
    if (panelInstanceId === null) {
      // 如果没有指定面板实例ID，删除该面板的所有实例
      let deletedCount = 0;
      for (const [key, instance] of this.panelInstances.entries()) {
        if (instance.instanceId === instanceId && instance.panelName === panelName) {
          this.panelInstances.delete(key);
          deletedCount++;
        }
      }
      console.log(`[MultiInstancePanelConfigManager] 🗑️ 注销面板 ${panelName} 的 ${deletedCount} 个实例`);
      return;
    }

    const instanceKey = this._generateInstanceKey(instanceId, panelName, panelInstanceId);
    const deleted = this.panelInstances.delete(instanceKey);

    if (deleted) {
      console.log(`[MultiInstancePanelConfigManager] 🗑️ 注销面板实例: ${instanceKey}`);
    } else {
      console.warn(`[MultiInstancePanelConfigManager] ⚠️ 未找到面板实例: ${instanceKey}`);
    }
  }

  /**
   * 获取面板实例
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {number} panelInstanceId - 面板实例ID（可选）
   * @returns {Object|null} 面板实例配置
   */
  getPanelInstance(instanceId, panelName, panelInstanceId = null) {
    if (panelInstanceId === null) {
      // 返回第一个匹配的实例
      for (const [key, instance] of this.panelInstances.entries()) {
        if (instance.instanceId === instanceId && instance.panelName === panelName) {
          return instance;
        }
      }
      return null;
    }

    const instanceKey = this._generateInstanceKey(instanceId, panelName, panelInstanceId);
    return this.panelInstances.get(instanceKey) || null;
  }

  /**
   * 获取实例的所有动态面板
   * @param {number} instanceId - CesiumMain 实例ID
   * @returns {Array<Object>} 面板实例列表
   */
  getAllPanelInstances(instanceId) {
    const instances = [];
    for (const instance of this.panelInstances.values()) {
      if (instance.instanceId === instanceId) {
        instances.push(instance);
      }
    }
    return instances;
  }

  /**
   * 获取实例的所有可见动态面板
   * @param {number} instanceId - CesiumMain 实例ID
   * @returns {Array<Object>} 可见面板实例列表
   */
  getVisiblePanelInstances(instanceId) {
    return this.getAllPanelInstances(instanceId).filter(instance => instance.visible);
  }

  /**
   * 设置面板实例可见性
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   * @param {number} panelInstanceId - 面板实例ID（可选）
   */
  setPanelInstanceVisible(instanceId, panelName, visible, panelInstanceId = null) {
    if (panelInstanceId === null) {
      // 设置该面板的所有实例的可见性
      for (const instance of this.panelInstances.values()) {
        if (instance.instanceId === instanceId && instance.panelName === panelName) {
          instance.visible = visible;
        }
      }
      console.log(`[MultiInstancePanelConfigManager] 🔄 设置面板 ${panelName} 的所有实例可见性: ${visible}`);
      return;
    }

    const instance = this.getPanelInstance(instanceId, panelName, panelInstanceId);
    if (instance) {
      instance.visible = visible;
      console.log(`[MultiInstancePanelConfigManager] 🔄 设置面板实例可见性: ${panelName} #${panelInstanceId} = ${visible}`);
    }
  }

  /**
   * 切换面板实例可见性
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {number} panelInstanceId - 面板实例ID（可选）
   * @returns {boolean|null} 切换后的可见性
   */
  togglePanelInstanceVisible(instanceId, panelName, panelInstanceId = null) {
    const instance = this.getPanelInstance(instanceId, panelName, panelInstanceId);
    if (instance) {
      instance.visible = !instance.visible;
      console.log(`[MultiInstancePanelConfigManager] 🔄 切换面板实例可见性: ${panelName} #${panelInstanceId || '*'} = ${instance.visible}`);
      return instance.visible;
    }
    return null;
  }

  /**
   * 计算多实例面板的位置偏移
   * @private
   * @param {number} instanceId - CesiumMain 实例ID
   * @param {string} panelName - 面板名称
   * @param {number} panelInstanceId - 面板实例ID
   * @param {Object} baseProps - 基础属性
   * @returns {Object} 位置配置
   */
  _calculateMultiInstancePanelPosition(instanceId, panelName, panelInstanceId, baseProps = {}) {
    // 获取已有实例数量来计算偏移
    let existingCount = 0;
    for (const instance of this.panelInstances.values()) {
      if (instance.panelName === panelName) {
        existingCount++;
      }
    }

    const baseX = baseProps.initialX !== undefined ? baseProps.initialX : 'center';
    const baseY = baseProps.initialY !== undefined ? baseProps.initialY : 80;

    // 计算偏移量
    const offsetX = 40 * (instanceId - 1); // CesiumMain 实例偏移
    const offsetY = 40 * existingCount; // 同类型面板实例偏移

    let initialX = baseX;
    if (typeof baseX === 'number') {
      initialX = baseX + offsetX;
    } else if (baseX === 'center') {
      initialX = 'center';
    }

    const initialY = baseY + offsetY;

    return { initialX, initialY };
  }

  /**
   * 获取面板实例统计信息
   * @returns {Object} 统计信息
   */
  getPanelInstanceStats() {
    const stats = {
      总面板实例数: this.panelInstances.size,
      按面板类型统计: {},
      按CesiumMain实例统计: {}
    };

    for (const instance of this.panelInstances.values()) {
      // 按面板类型统计
      if (!stats.按面板类型统计[instance.panelName]) {
        stats.按面板类型统计[instance.panelName] = 0;
      }
      stats.按面板类型统计[instance.panelName]++;

      // 按CesiumMain实例统计
      if (!stats.按CesiumMain实例统计[instance.instanceId]) {
        stats.按CesiumMain实例统计[instance.instanceId] = 0;
      }
      stats.按CesiumMain实例统计[instance.instanceId]++;
    }

    return stats;
  }
}

// 导出全局单例
export const multiInstancePanelConfigManager = new MultiInstancePanelConfigManager();
export default multiInstancePanelConfigManager;
