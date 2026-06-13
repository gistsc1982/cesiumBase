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
   */
  savePanelState(panelName, state = {}) {
    // 创建面板状态对象
    const panelState = {
      cesiumTilesets: new Map(state.cesiumTilesets || []),
      cesiumTransforms: new Map(state.cesiumTransforms || []),
      cesiumHeightOffsets: new Map(state.cesiumHeightOffsets || []),
      cesiumErrorHandlers: new Map(state.cesiumErrorHandlers || []),
      obliquePhotographyList: state.obliquePhotographyList || [],
      timestamp: Date.now()
    };

    this.panelStates.set(panelName, panelState);
    console.log(`[PanelSingletonManager] 💾 保存面板状态: ${panelName}`, {
      tilesets: panelState.cesiumTilesets.size,
      transforms: panelState.cesiumTransforms.size,
      items: panelState.obliquePhotographyList.length
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
      tilesets: state.cesiumTilesets.size,
      transforms: state.cesiumTransforms.size,
      items: state.obliquePhotographyList.length,
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

    // 清理 Cesium 错误处理器
    state.cesiumErrorHandlers.forEach((data, id) => {
      if (data && data.tileset && data.tileset.tileFailed) {
        data.tileset.tileFailed.removeEventListener(data.errorHandler);
      }
    });

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
   * 设置面板可见性
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  setPanelVisible(panelName, visible) {
    this.panelVisibility.set(panelName, visible);
    console.log(`[PanelSingletonManager] 👁️ 设置面板可见性: ${panelName} = ${visible}`);
  }

  /**
   * 获取面板可见性
   * @param {string} panelName - 面板名称
   * @returns {boolean|undefined} 面板可见性
   */
  getPanelVisible(panelName) {
    return this.panelVisibility.get(panelName);
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
}

// 导出全局单例
export const panelSingletonManager = new PanelSingletonManager();
export default panelSingletonManager;
