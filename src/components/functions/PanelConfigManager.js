/**
 * 面板配置管理工具
 *
 * 提供静态方法管理 functionPanels.config.json
 */

// 全局配置缓存
let _cachedConfig = null;

/**
 * 加载面板配置文件
 * @returns {Promise<Object>} 配置对象
 */
export async function loadPanelConfig() {
  try {
    // 如果已缓存，直接返回
    if (_cachedConfig) {
      return _cachedConfig;
    }

    // 尝试从全局获取（如果已加载）
    if (typeof window !== 'undefined' && window.__functionPanelsConfig__) {
      _cachedConfig = window.__functionPanelsConfig__;
      return _cachedConfig;
    }

    // 动态导入配置文件
    const configModule = await import('./functionPanels.config.json');
    _cachedConfig = configModule.default || configModule;

    // 缓存到全局
    if (typeof window !== 'undefined') {
      window.__functionPanelsConfig__ = _cachedConfig;
    }

    return _cachedConfig;
  } catch (error) {
    console.error('[PanelConfigManager] 加载配置文件失败:', error);
    return {
      description: '功能面板组件配置文件',
      version: '1.0.0',
      panels: [],
      categories: {}
    };
  }
}

/**
 * 保存配置到文件（导出 JSON）
 * @param {Object} config - 完整的配置对象
 * @param {Boolean} download - 是否下载为文件（默认 false，仅打印到控制台）
 * @returns {String} JSON 字符串
 */
export function savePanelConfig(config, download = false) {
  try {
    const jsonString = JSON.stringify(config, null, 2);

    // 更新缓存
    _cachedConfig = config;

    // 更新全局缓存
    if (typeof window !== 'undefined') {
      window.__functionPanelsConfig__ = config;
    }

    if (download && typeof window !== 'undefined') {
      // 创建下载链接
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'functionPanels.config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[PanelConfigManager] 配置文件已下载');
    } else {
      console.log('[PanelConfigManager] 配置 JSON（请复制到 functionPanels.config.json）:');
      console.log(jsonString);
    }

    return jsonString;
  } catch (error) {
    console.error('[PanelConfigManager] 保存配置失败:', error);
    return null;
  }
}

/**
 * 添加单例面板配置
 * @param {Object} config - 面板配置
 * @param {Boolean} saveAndDownload - 是否保存并下载配置文件
 * @returns {Promise<Object>} 更新后的完整配置
 */
export async function addSingletonPanelConfig(config, saveAndDownload = false) {
  const {
    name,
    file,
    title,
    description = '',
    icon = '📦',
    category = 'tools',
    position = { initialX: 'center', initialY: 120 },
    enabled = true,
    visible = false
  } = config;

  if (!name || !file) {
    console.error('[PanelConfigManager] 添加单例面板配置失败: 缺少 name 或 file');
    return null;
  }

  // 加载现有配置
  const fullConfig = await loadPanelConfig();

  // 检查是否已存在
  const existingIndex = fullConfig.panels.findIndex(p => p.name === name);
  if (existingIndex !== -1) {
    console.warn(`[PanelConfigManager] 面板 ${name} 已存在，将更新配置`);
    fullConfig.panels[existingIndex] = {
      name,
      file,
      title,
      description,
      enabled,
      visible,
      icon,
      category,
      singleton: true,
      permissions: [],
      position
    };
  } else {
    // 添加新配置
    fullConfig.panels.push({
      name,
      file,
      title,
      description,
      enabled,
      visible,
      icon,
      category,
      singleton: true,
      permissions: [],
      position
    });
  }

  // 确保分类存在
  if (!fullConfig.categories[category]) {
    fullConfig.categories[category] = {
      name: category,
      description: `${category} 类面板`,
      icon: icon || '📁'
    };
  }

  console.log(`[PanelConfigManager] ✅ 已添加单例面板配置: ${name}`);

  // 保存配置
  if (saveAndDownload) {
    savePanelConfig(fullConfig, true);
  }

  return fullConfig;
}

/**
 * 添加多实例面板配置
 * @param {Object} config - 面板配置
 * @param {Boolean} saveAndDownload - 是否保存并下载配置文件
 * @returns {Promise<Object>} 更新后的完整配置
 */
export async function addMultiInstancePanelConfig(config, saveAndDownload = false) {
  const {
    name,
    file,
    title,
    description = '',
    icon = '🧬',
    category = 'tools',
    position = { initialX: 'center', initialY: 120 },
    enabled = true,
    visible = false
  } = config;

  if (!name || !file) {
    console.error('[PanelConfigManager] 添加多实例面板配置失败: 缺少 name 或 file');
    return null;
  }

  // 多实例面板名称自动添加 Multi 后缀
  const multiInstanceName = `${name}Multi`;

  // 加载现有配置
  const fullConfig = await loadPanelConfig();

  // 检查是否已存在
  const existingIndex = fullConfig.panels.findIndex(p => p.name === multiInstanceName);
  if (existingIndex !== -1) {
    console.warn(`[PanelConfigManager] 多实例面板 ${multiInstanceName} 已存在，将更新配置`);
    fullConfig.panels[existingIndex] = {
      name: multiInstanceName,
      file,
      title: title || `${name}（多实例）`,
      description,
      enabled,
      visible,
      icon,
      category,
      singleton: false,
      permissions: [],
      position
    };
  } else {
    // 添加新配置
    fullConfig.panels.push({
      name: multiInstanceName,
      file,
      title: title || `${name}（多实例）`,
      description,
      enabled,
      visible,
      icon,
      category,
      singleton: false,
      permissions: [],
      position
    });
  }

  // 确保分类存在
  if (!fullConfig.categories[category]) {
    fullConfig.categories[category] = {
      name: category,
      description: `${category} 类面板`,
      icon: icon || '📁'
    };
  }

  console.log(`[PanelConfigManager] ✅ 已添加多实例面板配置: ${multiInstanceName}`);

  // 保存配置
  if (saveAndDownload) {
    savePanelConfig(fullConfig, true);
  }

  return fullConfig;
}

/**
 * 同时添加单例和多实例面板配置
 * @param {Object} config - 面板配置
 * @param {Boolean} saveAndDownload - 是否保存并下载配置文件
 * @returns {Promise<Object>} 更新后的完整配置
 */
export async function addBothPanelConfigs(config, saveAndDownload = false) {
  const {
    singletonPosition = { initialX: 'center', initialY: 120 },
    multiInstancePosition = { initialX: 'center', initialY: 200 },
    ...baseConfig
  } = config;

  // 添加单例配置
  await addSingletonPanelConfig({
    ...baseConfig,
    position: singletonPosition
  }, false);

  // 添加多实例配置
  await addMultiInstancePanelConfig({
    ...baseConfig,
    position: multiInstancePosition
  }, false);

  // 获取更新后的配置
  const fullConfig = await loadPanelConfig();

  console.log(`[PanelConfigManager] ✅ 已同时添加单例和多实例面板配置: ${config.name}`);

  // 保存配置
  if (saveAndDownload) {
    savePanelConfig(fullConfig, true);
  }

  return fullConfig;
}

/**
 * 删除面板配置
 * @param {String} name - 面板名称
 * @param {Boolean} saveAndDownload - 是否保存并下载配置文件
 * @returns {Promise<Object>} 更新后的完整配置
 */
export async function removePanelConfig(name, saveAndDownload = false) {
  if (!name) {
    console.error('[PanelConfigManager] 删除面板配置失败: 缺少 name');
    return null;
  }

  // 加载现有配置
  const fullConfig = await loadPanelConfig();

  // 查找并删除
  const initialLength = fullConfig.panels.length;
  fullConfig.panels = fullConfig.panels.filter(p => p.name !== name);

  if (fullConfig.panels.length < initialLength) {
    console.log(`[PanelConfigManager] ✅ 已删除面板配置: ${name}`);
  } else {
    console.warn(`[PanelConfigManager] 未找到面板配置: ${name}`);
  }

  // 保存配置
  if (saveAndDownload) {
    savePanelConfig(fullConfig, true);
  }

  return fullConfig;
}

/**
 * 获取指定面板的配置
 * @param {String} name - 面板名称
 * @returns {Promise<Object|null>} 面板配置对象
 */
export async function getPanelConfig(name) {
  const config = await loadPanelConfig();
  return config.panels.find(p => p.name === name) || null;
}

/**
 * 获取所有面板配置
 * @returns {Promise<Array>} 面板配置数组
 */
export async function getAllPanelConfigs() {
  const config = await loadPanelConfig();
  return config.panels;
}

/**
 * 获取指定分类的面板配置
 * @param {String} category - 分类名称
 * @returns {Promise<Array>} 面板配置数组
 */
export async function getPanelsByCategory(category) {
  const configs = await getAllPanelConfigs();
  return configs.filter(p => p.category === category);
}

/**
 * 导出当前配置为 JSON 文件
 */
export async function exportConfigToFile() {
  const config = await loadPanelConfig();
  savePanelConfig(config, true);
}

/**
 * 生成面板配置的 TypeScript 接口代码
 * @returns {String} TypeScript 接口代码
 */
export function generateConfigInterface() {
  return `
interface PanelConfig {
  name: string;
  file: string;
  title: string;
  description: string;
  enabled: boolean;
  visible: boolean;
  icon: string;
  category: string;
  singleton: boolean;
  permissions: string[];
  position: {
    initialX: number | 'left' | 'center' | 'right';
    initialY: number;
  };
}

interface FunctionPanelsConfig {
  description: string;
  version: string;
  lastUpdated: string;
  panels: PanelConfig[];
  categories: Record<string, {
    name: string;
    description: string;
    icon: string;
  }>;
}
`.trim();
}

// 默认导出对象，包含所有方法
export default {
  loadPanelConfig,
  savePanelConfig,
  addSingletonPanelConfig,
  addMultiInstancePanelConfig,
  addBothPanelConfigs,
  removePanelConfig,
  getPanelConfig,
  getAllPanelConfigs,
  getPanelsByCategory,
  exportConfigToFile,
  generateConfigInterface
};
