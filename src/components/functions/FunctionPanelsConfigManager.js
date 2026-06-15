/**
 * FunctionPanelsConfigManager - 功能面板配置管理工具
 *
 * 用于管理 functionPanels.config.json 配置文件
 * 提供读取、添加、删除、启用/禁用、显示/隐藏面板等功能
 *
 * 当前面板数量：3个
 * - TestPanel（测试面板）
 * - ObliquePhotographyPanel（倾斜摄影面板）
 * - ObliquePhotographyPanelExample（测试面板示例）
 */

import config from './functionPanels.config.json';

class FunctionPanelsConfigManager {
  constructor() {
    this.config = config;
  }

  /**
   * 获取所有面板配置
   * @returns {Array} 面板配置列表
   */
  getAllPanels() {
    return this.config.panels || [];
  }

  /**
   * 获取启用的面板
   * @returns {Array} 启用的面板列表
   */
  getEnabledPanels() {
    return this.getAllPanels().filter(panel => panel.enabled !== false);
  }

  /**
   * 获取禁用的面板
   * @returns {Array} 禁用的面板列表
   */
  getDisabledPanels() {
    return this.getAllPanels().filter(panel => panel.enabled === false);
  }

  /**
   * 获取可见的面板（默认显示）
   * @returns {Array} 可见的面板列表
   */
  getVisiblePanels() {
    return this.getAllPanels().filter(panel => panel.visible !== false);
  }

  /**
   * 获取隐藏的面板（默认不显示）
   * @returns {Array} 隐藏的面板列表
   */
  getHiddenPanels() {
    return this.getAllPanels().filter(panel => panel.visible === false);
  }

  /**
   * 根据名称获取面板配置
   * @param {string} name - 面板名称
   * @returns {Object|null} 面板配置
   */
  getPanel(name) {
    return this.getAllPanels().find(panel => panel.name === name) || null;
  }

  /**
   * 检查面板是否可见
   * @param {string} name - 面板名称
   * @returns {boolean} 是否可见
   */
  isPanelVisible(name) {
    const panel = this.getPanel(name);
    return panel ? panel.visible !== false : false;
  }

  /**
   * 设置面板可见性
   * @param {string} name - 面板名称
   * @param {boolean} visible - 是否可见
   * @returns {boolean} 是否成功
   */
  setPanelVisible(name, visible) {
    const panel = this.getPanel(name);
    if (panel) {
      panel.visible = visible;
      return true;
    }
    return false;
  }

  /**
   * 显示面板
   * @param {string} name - 面板名称
   * @returns {boolean} 是否成功
   */
  showPanel(name) {
    return this.setPanelVisible(name, true);
  }

  /**
   * 隐藏面板
   * @param {string} name - 面板名称
   * @returns {boolean} 是否成功
   */
  hidePanel(name) {
    return this.setPanelVisible(name, false);
  }

  /**
   * 根据分类获取面板
   * @param {string} category - 分类名称
   * @returns {Array} 面板列表
   */
  getPanelsByCategory(category) {
    return this.getAllPanels().filter(panel => panel.category === category);
  }

  /**
   * 启用面板
   * @param {string} name - 面板名称
   * @returns {boolean} 是否成功
   */
  enablePanel(name) {
    const panel = this.getPanel(name);
    if (panel) {
      panel.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * 禁用面板
   * @param {string} name - 面板名称
   * @returns {boolean} 是否成功
   */
  disablePanel(name) {
    const panel = this.getPanel(name);
    if (panel) {
      panel.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * 添加新面板配置
   * @param {Object} panelConfig - 面板配置
   * @returns {boolean} 是否成功
   */
  addPanel(panelConfig) {
    const required = ['name', 'file', 'title'];
    const missing = required.filter(field => !panelConfig[field]);

    if (missing.length > 0) {
      console.error(`[FunctionPanelsConfigManager] 缺少必填字段: ${missing.join(', ')}`);
      return false;
    }

    // 检查是否已存在
    if (this.getPanel(panelConfig.name)) {
      console.error(`[FunctionPanelsConfigManager] 面板已存在: ${panelConfig.name}`);
      return false;
    }

    // 设置默认值
    const newPanel = {
      enabled: true,
      visible: false, // 默认不可见，需要手动打开
      icon: '⚙️',
      category: 'tools',
      permissions: [],
      position: {
        initialX: 'center',
        initialY: 100
      },
      ...panelConfig
    };

    this.config.panels.push(newPanel);
    return true;
  }

  /**
   * 删除面板配置
   * @param {string} name - 面板名称
   * @returns {boolean} 是否成功
   */
  removePanel(name) {
    const index = this.getAllPanels().findIndex(panel => panel.name === name);
    if (index !== -1) {
      this.config.panels.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有分类
   * @returns {Object} 分类配置
   */
  getCategories() {
    return this.config.categories || {};
  }

  /**
   * 导出配置为 JSON 字符串
   * @returns {string} JSON 字符串
   */
  exportToJSON() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 获取配置统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const panels = this.getAllPanels();
    const enabled = panels.filter(p => p.enabled !== false);
    const disabled = panels.filter(p => p.enabled === false);
    const visible = panels.filter(p => p.visible !== false);
    const hidden = panels.filter(p => p.visible === false);

    // 按分类统计
    const byCategory = {};
    panels.forEach(panel => {
      const category = panel.category || 'uncategorized';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    return {
      total: panels.length,
      enabled: enabled.length,
      disabled: disabled.length,
      visible: visible.length,
      hidden: hidden.length,
      byCategory,
      categories: Object.keys(this.getCategories()).length
    };
  }
}

// 创建单例实例
const configManager = new FunctionPanelsConfigManager();

// 暴露到全局（开发调试用）
if (typeof window !== 'undefined') {
  window.__functionPanelsConfigManager__ = configManager;
  window.__functionPanelsConfig__ = config;
}

export default configManager;
