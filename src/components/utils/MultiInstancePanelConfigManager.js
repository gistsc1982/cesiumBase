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
    this.instanceCounter = 0;
    console.log('[MultiInstancePanelConfigManager] 🔄 已重置所有实例配置');
  }
}

// 导出全局单例
export const multiInstancePanelConfigManager = new MultiInstancePanelConfigManager();
export default multiInstancePanelConfigManager;
