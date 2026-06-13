/**
 * 通用数据管理器
 *
 * 支持导出/导入 JSON 文件，用于备份和恢复配置数据
 *
 * @features
 * - 导出 JSON 数据为文件下载
 * - 从上传的文件导入 JSON 数据
 * - 支持多个配置文件管理
 * - 数据验证和错误处理
 * - 支持 data 目录下的所有 JSON 文件
 *
 * @example
 * import { dataManager } from './utils/DataManager.js';
 *
 * // 导出配置
 * await dataManager.exportConfig('oblique-photography', data);
 *
 * // 导入配置
 * const data = await dataManager.importConfig();
 *
 * // 获取可用的配置文件列表
 * const configs = dataManager.getAvailableConfigs();
 */

class DataManager {
  constructor() {
    // 配置文件定义
    this.configDefinitions = new Map([
      [
        'oblique-photography',
        {
          id: 'oblique-photography',
          name: '倾斜摄影配置',
          fileName: 'oblique-photography.json',
          relativePath: 'gis/oblique-photography.json',
          description: '倾斜摄影模型加载配置',
          icon: '📷',
          category: 'gis'
        }
      ]
    ]);

    console.log('[DataManager] 初始化完成');
  }

  /**
   * 获取所有可用的配置文件
   * @returns {Array<Object>} 配置文件列表
   */
  getAvailableConfigs() {
    return Array.from(this.configDefinitions.values()).map(config => ({
      id: config.id,
      name: config.name,
      fileName: config.fileName,
      description: config.description,
      icon: config.icon,
      category: config.category
    }));
  }

  /**
   * 获取配置文件定义
   * @param {string} configId - 配置ID
   * @returns {Object|null} 配置文件定义
   */
  getConfigDefinition(configId) {
    return this.configDefinitions.get(configId) || null;
  }

  /**
   * 导出配置为 JSON 文件
   * @param {string} configId - 配置ID（如 'oblique-photography'）
   * @param {Array|Object} data - 要导出的数据
   * @param {Object} options - 导出选项
   * @param {boolean} options.pretty - 是否格式化 JSON（默认 true）
   * @param {string} options.fileName - 自定义文件名（可选）
   * @returns {Promise<boolean>} 是否成功
   */
  async exportConfig(configId, data, options = {}) {
    const config = this.getConfigDefinition(configId);
    if (!config) {
      console.error(`[DataManager] ❌ 未找到配置: ${configId}`);
      return false;
    }

    try {
      console.log(`[DataManager] 📤 导出配置: ${config.name}`);

      // 格式化选项
      const pretty = options.pretty !== false;
      const fileName = options.fileName || config.fileName;

      // 转换为 JSON 字符串
      const jsonString = JSON.stringify(data, null, pretty ? 2 : 0);

      // 创建 Blob
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // 创建下载链接
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`[DataManager] ✅ 导出成功: ${fileName}`);
      return true;
    } catch (error) {
      console.error(`[DataManager] ❌ 导出失败:`, error);
      return false;
    }
  }

  /**
   * 导入配置文件
   * @param {Object} options - 导入选项
   * @param {string} options.accept - 接受的文件类型（默认 '.json'）
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Object|null>} 导入的数据，失败返回 null
   */
  async importConfig(options = {}) {
    try {
      console.log(`[DataManager] 📥 准备导入配置`);

      // 创建文件输入元素
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '.json,application/json';
      input.style.display = 'none';

      // 创建 Promise 等待用户选择文件
      const filePromise = new Promise((resolve, reject) => {
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            resolve(file);
          } else {
            reject(new Error('未选择文件'));
          }
        };

        input.oncancel = () => {
          reject(new Error('用户取消'));
        };
      });

      // 触发文件选择对话框
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);

      // 等待用户选择文件
      const file = await filePromise;

      console.log(`[DataManager] 📄 读取文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);

      // 读取文件内容
      const fileContent = await this.readFile(file, options.onProgress);

      // 解析 JSON
      const data = JSON.parse(fileContent);

      console.log(`[DataManager] ✅ 导入成功，数据项: ${Array.isArray(data) ? data.length : Object.keys(data).length}`);

      return {
        data,
        fileName: file.name,
        fileSize: file.size,
        lastModified: new Date(file.lastModified)
      };
    } catch (error) {
      console.error(`[DataManager] ❌ 导入失败:`, error);
      return null;
    }
  }

  /**
   * 读取文件内容
   * @param {File} file - 文件对象
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<string>} 文件内容
   */
  readFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      };

      reader.readAsText(file);
    });
  }

  /**
   * 验证 JSON 数据格式
   * @param {string} configId - 配置ID
   * @param {*} data - 要验证的数据
   * @returns {Object} 验证结果 { valid: boolean, errors: Array<string> }
   */
  validateConfig(configId, data) {
    const config = this.getConfigDefinition(configId);
    const errors = [];

    if (!config) {
      errors.push(`未找到配置定义: ${configId}`);
      return { valid: false, errors };
    }

    // 基本验证：必须是数组或对象
    if (data === null || data === undefined) {
      errors.push('数据不能为空');
      return { valid: false, errors };
    }

    // 特定配置的验证规则
    switch (configId) {
      case 'oblique-photography':
        if (!Array.isArray(data)) {
          errors.push('倾斜摄影配置必须是数组');
        } else {
          data.forEach((item, index) => {
            if (!item.id) {
              errors.push(`第 ${index + 1} 项缺少 id 字段`);
            }
            if (!item.name) {
              errors.push(`第 ${index + 1} 项缺少 name 字段`);
            }
            if (!item.url) {
              errors.push(`第 ${index + 1} 项缺少 url 字段`);
            }
          });
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出多个配置文件为 ZIP（需要 JSZip 库）
   * @param {Array<string>} configIds - 配置ID列表
   * @returns {Promise<boolean>} 是否成功
   */
  async exportMultipleConfigs(configIds) {
    console.log(`[DataManager] 📦 批量导出配置: ${configIds.join(', ')}`);

    // 如果有 JSZip 库，可以创建 ZIP 文件
    if (typeof JSZip !== 'undefined') {
      try {
        const zip = new JSZip();

        for (const configId of configIds) {
          const config = this.getConfigDefinition(configId);
          if (config) {
            // 这里需要从服务器获取数据或从参数传入
            // 暂时跳过
          }
        }

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'configs.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return true;
      } catch (error) {
        console.error('[DataManager] ❌ ZIP导出失败:', error);
        return false;
      }
    } else {
      console.warn('[DataManager] ⚠️ JSZip 库未加载，无法导出为 ZIP');
      return false;
    }
  }

  /**
   * 获取配置文件的统计信息
   * @param {string} configId - 配置ID
   * @param {Array|Object} data - 配置数据
   * @returns {Object} 统计信息
   */
  getConfigStats(configId, data) {
    const config = this.getConfigDefinition(configId);
    const stats = {
      configId,
      configName: config?.name || '未知',
      itemCount: 0,
      dataSize: JSON.stringify(data).length,
      dataSizeKB: 0,
      lastModified: new Date().toISOString()
    };

    if (Array.isArray(data)) {
      stats.itemCount = data.length;
    } else if (typeof data === 'object' && data !== null) {
      stats.itemCount = Object.keys(data).length;
    }

    stats.dataSizeKB = (stats.dataSize / 1024).toFixed(2);

    return stats;
  }
}

// 导出全局单例
export const dataManager = new DataManager();
export default dataManager;
