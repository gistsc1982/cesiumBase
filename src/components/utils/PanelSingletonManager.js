/**
 * 面板单例管理器
 *
 * 为特定面板提供单例模式支持，保持组件状态和 Cesium 对象
 * 解决面板关闭/重新打开时状态丢失的问题
 *
 * 功能：
 * - 保持面板组件状态（如 Cesium 对象、数据状态等）
 * - 支持面板假关闭（只隐藏面板，不销毁组件）
 * - 支持单例模式（同一面板只创建一个实例）
 * - 自动恢复上次打开时的状态
 *
 * @example
 * import { panelSingletonManager } from './utils/PanelSingletonManager.js';
 *
 * // 保存面板状态
 * panelSingletonManager.savePanelState('ObliquePhotographyPanel', {
 *   cesiumTilesets: tilesetsMap,
 *   loadedItems: itemsList
 * });
 *
 * // 获取面板状态
 * const state = panelSingletonManager.getPanelState('ObliquePhotographyPanel');
 *
 * // 清除面板状态
 * panelSingletonManager.clearPanelState('ObliquePhotographyPanel');
 */

class PanelSingletonManager {
  constructor() {
    // 面板状态映射
    // Map<panelName, panelState>
    this.panelStates = new Map();

    // Cesium 对象存储（用于避免内存泄漏）
    // Map<panelName, Map<id, cesiumObject>>
    this.cesiumObjects = new Map();

    // 面板可见性状态
    // Map<panelName, boolean>
    this.panelVisibility = new Map();

    // ⭐ 面板注册表（单例面板的唯一注册表）
    // Map<panelName, { component, props, visible, isClosed }>
    this.panelRegistry = new Map();

    // ⭐ 事件监听器（用于面板状态变化通知）
    // Map<panelName, Set<callback>>
    this.eventListeners = new Map();

    // ⭐ mjs 组件全局容器映射（用于管理 IIFE 加载的单例 mjs 组件）
    // Map<panelName, { containerId, iifeGlobalVar, visible, isClosed }>
    this.mjsContainers = new Map();

    console.log('[PanelSingletonManager] 初始化完成');
  }

  /**
   * 保存面板状态
   * @param {string} panelName - 面板名称
   * @param {Object} state - 面板状态对象
   * @param {Object} state.cesiumTilesets - Cesium tileset 映射
   * @param {Object} state.cesiumTransforms - Cesium transform 映射
   * @param {Object} state.cesiumHeightOffsets - 高度偏移映射
   * @param {Object} state.cesiumErrorHandlers - 错误处理器映射
   * @param {Array} state.obliquePhotographyList - 倾斜摄影列表状态
   * @param {Object} state.cesiumObjects - Cesium 对象集合（通用）
   * @param {Array} state.configList - 配置列表
   * @param {number} state.timestamp - 时间戳
   */
  savePanelState(panelName, state = {}) {
    // ⭐ 修复：保存所有传入的字段，而不是只保存特定字段
    // 这允许不同的面板保存不同类型的状态数据
    const panelState = {};

    // 保存 Map 类型的数据（需要转换为新的 Map 实例）
    if (state.cesiumTilesets !== undefined) {
      panelState.cesiumTilesets = new Map(state.cesiumTilesets);
    }
    if (state.cesiumTransforms !== undefined) {
      panelState.cesiumTransforms = new Map(state.cesiumTransforms);
    }
    if (state.cesiumHeightOffsets !== undefined) {
      panelState.cesiumHeightOffsets = new Map(state.cesiumHeightOffsets);
    }
    if (state.cesiumErrorHandlers !== undefined) {
      panelState.cesiumErrorHandlers = new Map(state.cesiumErrorHandlers);
    }

    // 保存数组类型的数据
    if (state.obliquePhotographyList !== undefined) {
      panelState.obliquePhotographyList = state.obliquePhotographyList;
    }
    if (state.configList !== undefined) {
      panelState.configList = state.configList;
    }

    // 保存对象类型的数据
    if (state.cesiumObjects !== undefined) {
      panelState.cesiumObjects = state.cesiumObjects;
    }

    // 保存时间戳（使用传入的时间戳，如果没有则使用当前时间）
    panelState.timestamp = state.timestamp !== undefined ? state.timestamp : Date.now();

    this.panelStates.set(panelName, panelState);
    console.log(`[PanelSingletonManager] 💾 保存面板状态: ${panelName}`, {
      tilesets: panelState.cesiumTilesets?.size || 0,
      transforms: panelState.cesiumTransforms?.size || 0,
      items: panelState.obliquePhotographyList?.length || 0,
      configList: panelState.configList?.length || 0,
      cesiumObjects: panelState.cesiumObjects ? '存在' : '不存在',
      时间: new Date(panelState.timestamp).toLocaleTimeString()
    });

    // 暴露到全局（用于调试）
    if (typeof window !== 'undefined') {
      if (!window.__panelSingletonManager__) {
        window.__panelSingletonManager__ = this;
      }
    }
  }

  /**
   * 获取面板状态
   * @param {string} panelName - 面板名称
   * @returns {Object|null} 面板状态对象
   */
  getPanelState(panelName) {
    const state = this.panelStates.get(panelName);
    if (!state) {
      console.log(`[PanelSingletonManager] ⚠️ 面板 ${panelName} 没有保存的状态`);
      return null;
    }

    console.log(`[PanelSingletonManager] 📦 获取面板状态: ${panelName}`, {
      tilesets: state.cesiumTilesets?.size || 0,
      transforms: state.cesiumTransforms?.size || 0,
      items: state.obliquePhotographyList?.length || 0,
      configList: state.configList?.length || 0,
      cesiumObjects: state.cesiumObjects ? '存在' : '不存在',
      时间: new Date(state.timestamp).toLocaleTimeString()
    });

    return state;
  }

  /**
   * 清除面板状态
   * @param {string} panelName - 面板名称
   */
  clearPanelState(panelName) {
    const state = this.panelStates.get(panelName);
    if (!state) {
      console.warn(`[PanelSingletonManager] ⚠️ 面板 ${panelName} 没有需要清除的状态`);
      return;
    }

    // 清理 Cesium 错误处理器（如果存在）
    if (state.cesiumErrorHandlers) {
      state.cesiumErrorHandlers.forEach((data, id) => {
        if (data && data.tileset && data.tileset.tileFailed) {
          data.tileset.tileFailed.removeEventListener(data.errorHandler);
        }
      });
    }

    this.panelStates.delete(panelName);
    console.log(`[PanelSingletonManager] 🗑️ 清除面板状态: ${panelName}`);
  }

  /**
   * 保存 Cesium 对象
   * @param {string} panelName - 面板名称
   * @param {string} id - 对象ID
   * @param {Object} tileset - Cesium tileset 对象
   * @param {Object} transform - Transform 对象
   * @param {number} heightOffset - 高度偏移
   * @param {Object} errorHandler - 错误处理器
   */
  saveCesiumObject(panelName, id, tileset, transform, heightOffset, errorHandler) {
    let panelCesiumObjects = this.cesiumObjects.get(panelName);
    if (!panelCesiumObjects) {
      panelCesiumObjects = new Map();
      this.cesiumObjects.set(panelName, panelCesiumObjects);
    }

    panelCesiumObjects.set(id, {
      tileset,
      transform,
      heightOffset,
      errorHandler
    });

    console.log(`[PanelSingletonManager] 📦 保存 Cesium 对象: ${panelName}/${id}`);
  }

  /**
   * 获取 Cesium 对象
   * @param {string} panelName - 面板名称
   * @param {string} id - 对象ID
   * @returns {Object|null} Cesium 对象
   */
  getCesiumObject(panelName, id) {
    const panelCesiumObjects = this.cesiumObjects.get(panelName);
    if (!panelCesiumObjects) {
      return null;
    }

    return panelCesiumObjects.get(id) || null;
  }

  /**
   * 设置面板可见性（通过注册表）
   * ⭐ 此方法为兼容保留，建议使用 updatePanelVisible()
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  setPanelVisible(panelName, visible) {
    // ⭐ 重定向到 updatePanelVisible 以保持同步
    this.updatePanelVisible(panelName, visible);
  }

  /**
   * 检查面板是否有保存的状态
   * @param {string} panelName - 面板名称
   * @returns {boolean} 是否有保存的状态
   */
  hasPanelState(panelName) {
    return this.panelStates.has(panelName);
  }

  /**
   * 获取所有面板名称
   * @returns {Array<string>} 面板名称列表
   */
  getAllPanelNames() {
    return Array.from(this.panelStates.keys());
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      面板数: this.panelStates.size,
      Cesium对象数: this.cesiumObjects.size,
      面板列表: this.getAllPanelNames()
    };
  }

  /**
   * 清除所有面板状态
   */
  clearAll() {
    // 清理所有 Cesium 错误处理器
    this.panelStates.forEach((state, panelName) => {
      state.cesiumErrorHandlers.forEach((data, id) => {
        if (data && data.tileset && data.tileset.tileFailed) {
          data.tileset.tileFailed.removeEventListener(data.errorHandler);
        }
      });
    });

    this.panelStates.clear();
    this.cesiumObjects.clear();
    this.panelVisibility.clear();

    console.log('[PanelSingletonManager] 🗑️ 清除所有面板状态');
  }

  // ==================== 面板注册表管理 ====================

  /**
   * 注册面板（单例面板的唯一注册表）
   * @param {string} panelName - 面板名称
   * @param {Object} config - 面板配置
   * @param {Object} config.component - 组件实例
   * @param {Object} config.props - 组件属性
   * @param {boolean} config.visible - 是否可见
   */
  registerPanel(panelName, config) {
    // ⭐ 获取现有面板（如果存在）
    const existingPanel = this.panelRegistry.get(panelName);

    // ⭐ 修复：确保 visible 和 isClosed 状态一致
    // 如果 config.visible 明确指定为 true 或 false，使用它
    // 否则默认为 visible: false, isClosed: true
    const visible = config.visible === true;
    const isClosed = !visible;

    // ⭐ 关键修复：正确处理 _visibilityExplicitlySet 标志
    // 1. 如果 config.visible 是明确的布尔值，说明这是用户/代码的明确设置
    // 2. 如果面板已存在且有 _visibilityExplicitlySet 标志，保留该标志
    // 3. 否则默认为 false
    let visibilityExplicitlySet = false;

    if (config.visible === true || config.visible === false) {
      // config.visible 是明确的布尔值，说明这是用户/代码的明确设置
      visibilityExplicitlySet = true;
      console.log(`[PanelSingletonManager] 🎯 config.visible 是明确的布尔值: ${config.visible}，设置 _visibilityExplicitlySet = true`);
    } else if (existingPanel?._visibilityExplicitlySet) {
      // 保留现有的标志
      visibilityExplicitlySet = true;
      console.log(`[PanelSingletonManager] 🔄 保留现有的 _visibilityExplicitlySet 标志`);
    }

    this.panelRegistry.set(panelName, {
      component: config.component,
      props: config.props || {},
      visible,
      isClosed,
      _visibilityExplicitlySet: visibilityExplicitlySet
    });
    console.log(`[PanelSingletonManager] ✅ 注册面板: ${panelName}`, {
      visible,
      isClosed,
      hasComponent: !!config.component,
      visibilityExplicitlySet
    });
  }

  /**
   * 注销面板
   * @param {string} panelName - 面板名称
   */
  unregisterPanel(panelName) {
    const deleted = this.panelRegistry.delete(panelName);
    if (deleted) {
      console.log(`[PanelSingletonManager] 🗑️ 注销面板: ${panelName}`);
    } else {
      console.warn(`[PanelSingletonManager] ⚠️ 面板 ${panelName} 未注册`);
    }
    return deleted;
  }

  /**
   * 获取面板配置
   * @param {string} panelName - 面板名称
   * @returns {Object|null} 面板配置
   */
  getPanel(panelName) {
    return this.panelRegistry.get(panelName) || null;
  }

  /**
   * 检查面板是否已注册
   * ⭐ 同时检查 panelRegistry 和 mjsContainers
   * @param {string} panelName - 面板名称
   * @returns {boolean} 是否已注册
   */
  hasPanel(panelName) {
    return this.panelRegistry.has(panelName) || this.mjsContainers.has(panelName);
  }

  /**
   * 获取所有已注册的面板
   * @returns {Array<Object>} 面板配置列表
   */
  getAllPanels() {
    return Array.from(this.panelRegistry.entries()).map(([name, config]) => ({
      name,
      ...config
    }));
  }

  /**
   * 更新面板可见性（通过注册表）
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  updatePanelVisible(panelName, visible) {
    // ⭐ 优先检查是否为 mjs 容器
    if (this.isMjsContainer(panelName)) {
      this.updateMjsContainerVisible(panelName, visible);

      // 触发事件
      this.emitEvent(panelName, {
        type: 'visibleChange',
        panelName,
        visible,
        isClosed: !visible
      });
      return;
    }

    // 原有 Vue 面板逻辑
    const panel = this.panelRegistry.get(panelName);
    if (panel) {
      panel.visible = visible;
      // ⭐ 标记用户明确设置了可见性
      panel._visibilityExplicitlySet = true;
      // ⭐ 同步 isClosed 状态：visible = false 时设置 isClosed = true，visible = true 时重置 isClosed = false
      if (visible) {
        panel.isClosed = false;
      } else {
        panel.isClosed = true;
      }
      console.log(`[PanelSingletonManager] 🔄 更新面板可见性: ${panelName} = ${visible}, isClosed = ${panel.isClosed}`);

      // ⭐ 直接更新面板组件实例的 isClosed 状态（绕过事件机制）
      if (panel.component && typeof panel.component === 'object') {
        const oldIsClosed = panel.component.isClosed;
        panel.component.isClosed = panel.isClosed;
        console.log(`[PanelSingletonManager] 🔧 直接更新组件 isClosed: ${oldIsClosed} -> ${panel.component.isClosed}`);

        // ⭐ 强制 Vue 重新渲染组件
        if (panel.component.$forceUpdate && typeof panel.component.$forceUpdate === 'function') {
          panel.component.$forceUpdate();
          console.log(`[PanelSingletonManager] ✅ 强制重新渲染面板组件: ${panelName}`);
        }
      }

      // ⭐ 触发面板状态变化事件（通知组件同步状态）
      this.emitEvent(panelName, {
        type: 'visibleChange',
        panelName,
        visible,
        isClosed: panel.isClosed
      });
    } else {
      console.warn(`[PanelSingletonManager] ⚠️ 面板 ${panelName} 未注册，无法更新可见性`);
    }
  }

  /**
   * 获取面板可见性（通过注册表）
   * @param {string} panelName - 面板名称
   * @returns {boolean|null} 面板可见性
   */
  getPanelVisible(panelName) {
    const panel = this.panelRegistry.get(panelName);
    return panel ? panel.visible : null;
  }

  /**
   * 设置面板关闭状态（通过注册表）
   * @param {string} panelName - 面板名称
   * @param {boolean} isClosed - 是否关闭
   */
  setPanelClosed(panelName, isClosed) {
    const panel = this.panelRegistry.get(panelName);
    if (panel) {
      panel.isClosed = isClosed;
      if (isClosed) {
        panel.visible = false;
      }
      console.log(`[PanelSingletonManager] 🔒 设置面板关闭状态: ${panelName} = ${isClosed}`);
    }
  }

  /**
   * 获取面板关闭状态（通过注册表）
   * @param {string} panelName - 面板名称
   * @returns {boolean|null} 面板关闭状态
   */
  getPanelClosed(panelName) {
    const panel = this.panelRegistry.get(panelName);
    return panel ? panel.isClosed : null;
  }

  /**
   * 获取注册表统计信息
   * @returns {Object} 统计信息
   */
  getRegistryStats() {
    return {
      已注册面板数: this.panelRegistry.size,
      可见面板数: Array.from(this.panelRegistry.values()).filter(p => p.visible).length,
      关闭面板数: Array.from(this.panelRegistry.values()).filter(p => p.isClosed).count
    };
  }

  /**
   * 清空面板注册表
   */
  clearRegistry() {
    this.panelRegistry.clear();
    console.log('[PanelSingletonManager] 🗑️ 清空面板注册表');
  }

  // ==================== mjs 组件全局容器管理 ====================

  /**
   * 获取 mjs 组件的容器 DOM ID
   * @param {string} componentName - 组件名称
   * @returns {string} 容器 DOM ID
   */
  getMjsContainerId(componentName) {
    // 特殊处理：DualCanvasViewer 使用固定的容器 ID
    if (componentName === 'DualCanvasViewer') {
      return 'dualCanvasContainer';
    }
    // 默认使用驼峰命名
    return `${componentName}Container`;
  }

  /**
   * 获取 IIFE 全局变量名（可选的辅助方法）
   * @param {string} componentName - 组件名称
   * @returns {string} IIFE 全局变量名
   */
  getIifeGlobalVarName(componentName) {
    // 特殊处理：DualCanvasViewer 使用特定的全局变量名
    if (componentName === 'DualCanvasViewer') {
      return 'DualCanvasViewerPlugin';
    }
    // 通用规范：直接使用组件名
    return componentName;
  }

  /**
   * 注册 mjs 组件全局容器
   * @param {string} panelName - 面板名称
   * @param {Object} containerConfig - 容器配置
   * @param {string} containerConfig.containerId - 容器DOM ID（可选，不提供则自动生成）
   * @param {string} containerConfig.iifeGlobalVar - IIFE全局变量名（可选，不提供则自动生成）
   */
  registerMjsContainer(panelName, containerConfig = {}) {
    const containerId = containerConfig.containerId || this.getMjsContainerId(panelName);
    const iifeGlobalVar = containerConfig.iifeGlobalVar || this.getIifeGlobalVarName(panelName);

    this.mjsContainers.set(panelName, {
      containerId,
      iifeGlobalVar,
      visible: containerConfig.visible !== false,
      isClosed: containerConfig.visible === false
    });
    console.log(`[PanelSingletonManager] ✅ 注册 mjs 容器: ${panelName}`, { containerId, iifeGlobalVar });

    // ⭐ 立即应用可见性状态到 DOM
    const visible = containerConfig.visible !== false;
    this.updateMjsContainerVisible(panelName, visible);
  }

  /**
   * 注销 mjs 容器
   * @param {string} panelName - 面板名称
   */
  unregisterMjsContainer(panelName) {
    const deleted = this.mjsContainers.delete(panelName);
    if (deleted) {
      console.log(`[PanelSingletonManager] 🗑️ 注销 mjs 容器: ${panelName}`);
    } else {
      console.warn(`[PanelSingletonManager] ⚠️ mjs 容器未注册: ${panelName}`);
    }
    return deleted;
  }

  /**
   * 更新 mjs 容器可见性（由 updatePanelVisible 调用）
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  updateMjsContainerVisible(panelName, visible) {
    const containerConfig = this.mjsContainers.get(panelName);
    if (!containerConfig) {
      console.warn(`[PanelSingletonManager] ⚠️ mjs 容器未注册: ${panelName}`);
      return;
    }

    console.log(`[PanelSingletonManager] 🔍 查找容器: ${panelName}`, {
      containerId: containerConfig.containerId,
      iifeGlobalVar: containerConfig.iifeGlobalVar,
      当前可见性: containerConfig.visible
    });

    const container = document.getElementById(containerConfig.containerId);

    if (!container) {
      console.error(`[PanelSingletonManager] ❌ 容器未找到: ${containerConfig.containerId}`);
      console.log(`[PanelSingletonManager] 🔍 当前页面所有包含 'dual' 的容器:`,
        Array.from(document.querySelectorAll('[id*="dual"], [class*="dual"]')).map(el => ({
          id: el.id,
          class: el.className,
          display: window.getComputedStyle(el).display
        }))
      );
      return;
    }
    if (!container) {
      console.warn(`[PanelSingletonManager] ⚠️ mjs 容器 DOM 不存在: ${containerConfig.containerId}`);
      return;
    }

    // ⭐ 使用 CSS 类来控制显示状态（更可靠，防止 Vue 响应式系统覆盖）
    const oldHiddenState = container.classList.contains('hidden');
    if (visible) {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }

    // 更新状态
    containerConfig.visible = visible;
    containerConfig.isClosed = !visible;

    console.log(`[PanelSingletonManager] 🔄 更新 mjs 容器可见性: ${panelName}, visible: ${visible}, hidden: ${oldHiddenState} -> ${container.classList.contains('hidden')}, container:`, container);

    // 验证更新是否成功
    if (visible && container.classList.contains('hidden')) {
      console.error(`[PanelSingletonManager] ❌ 尝试显示容器但仍有 hidden 类: ${panelName}`);
    }
  }

  /**
   * 获取 mjs 容器配置
   * @param {string} panelName - 面板名称
   * @returns {Object|null} 容器配置
   */
  getMjsContainer(panelName) {
    return this.mjsContainers.get(panelName) || null;
  }

  /**
   * 检查是否为 mjs 容器
   * @param {string} panelName - 面板名称
   * @returns {boolean}
   */
  isMjsContainer(panelName) {
    return this.mjsContainers.has(panelName);
  }

  /**
   * 获取所有 mjs 容器
   * @returns {Array} mjs 容器列表
   */
  getAllMjsContainers() {
    return Array.from(this.mjsContainers.entries()).map(([name, config]) => ({
      name,
      ...config
    }));
  }

  // ==================== 事件监听器 ====================

  /**
   * 添加面板状态变化监听器
   * @param {string} panelName - 面板名称
   * @param {Function} callback - 回调函数
   */
  addEventListener(panelName, callback) {
    if (!this.eventListeners.has(panelName)) {
      this.eventListeners.set(panelName, new Set());
    }
    this.eventListeners.get(panelName).add(callback);
    console.log(`[PanelSingletonManager] 📝 添加事件监听器: ${panelName}`);
  }

  /**
   * 移除面板状态变化监听器
   * @param {string} panelName - 面板名称
   * @param {Function} callback - 回调函数
   */
  removeEventListener(panelName, callback) {
    if (this.eventListeners.has(panelName)) {
      this.eventListeners.get(panelName).delete(callback);
      console.log(`[PanelSingletonManager] 🗑️ 移除事件监听器: ${panelName}`);
    }
  }

  /**
   * 触发面板状态变化事件
   * @param {string} panelName - 面板名称
   * @param {Object} eventData - 事件数据
   */
  emitEvent(panelName, eventData) {
    if (this.eventListeners.has(panelName)) {
      const listeners = this.eventListeners.get(panelName);
      listeners.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error(`[PanelSingletonManager] ❌ 事件监听器执行错误: ${panelName}`, error);
        }
      });
    }
  }
}

// 导出全局单例
export const panelSingletonManager = new PanelSingletonManager();
export default panelSingletonManager;
