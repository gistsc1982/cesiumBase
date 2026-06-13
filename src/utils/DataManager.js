/**
 * 通用数据管理器
 *
 * 支持通过 HTTP 与服务器交互，实现配置文件的导入导出
 *
 * @features
 * - 从 HTTP URL 加载配置
 * - 通过 HTTP POST 上传配置到服务器
 * - 本地文件导出（备用）
 * - 本地文件导入（备用）
 * - 支持多个配置文件管理
 * - 数据验证和错误处理
 *
 * @network
 * - 读取: HTTP GET
 * - 写入: HTTP POST (multipart/form-data)
 * - 备用: 本地文件下载/上传
 *
 * @example
 * import { dataManager } from './utils/DataManager.js';
 *
 * // 从服务器加载配置
 * const data = await dataManager.loadFromServer('oblique-photography');
 *
 * // 上传配置到服务器
 * await dataManager.uploadToServer('oblique-photography', data);
 *
 * // 本地导出（备用）
 * await dataManager.exportConfig('oblique-photography', data);
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
          fileName: 'oblique_photography.json',
          relativePath: 'gis/oblique_photography.json',
          description: '倾斜摄影模型加载配置',
          icon: '📷',
          category: 'gis'
        }
      ]
    ]);

    // ⭐ 服务器配置
    this.serverConfig = {
      // API 服务器基础 URL
      baseURL: this.detectServerURL(),

      // API 端口（如果与前端不同）
      apiPort: 8081,

      // 数据 API 路径
      dataAPI: 'api/data',

      // 同步 API 路径
      syncAPI: 'api/sync',

      // 超时设置（毫秒）
      timeout: 30000
    };

    console.log('[DataManager] 初始化完成');
    console.log('[DataManager] 服务器配置:', this.serverConfig);
  }

  /**
   * 自动检测服务器 URL
   * 根据当前页面 URL 推断服务器地址
   */
  detectServerURL() {
    if (typeof window === 'undefined') {
      return 'http://192.168.31.146:8080';
    }

    const currentURL = window.location.href;
    const urlObj = new URL(currentURL);

    // 如果是本地开发，使用测试服务器
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      return 'http://192.168.31.146:8080';
    }

    // 否则使用当前服务器地址
    return `${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || 80}`;
  }

  /**
   * 设置服务器配置
   * @param {Object} config - 服务器配置
   */
  setServerConfig(config) {
    this.serverConfig = {
      ...this.serverConfig,
      ...config
    };
    console.log('[DataManager] 更新服务器配置:', this.serverConfig);
  }

  /**
   * 获取完整的 API URL
   * @param {string} path - API 路径
   * @returns {string} 完整 URL
   */
  getAPIURL(path) {
    // 解析 baseURL，替换端口号为 API 端口
    const urlObj = new URL(this.serverConfig.baseURL);
    urlObj.port = this.serverConfig.apiPort.toString();

    // 移除末尾斜杠并添加路径
    const baseURL = urlObj.toString().replace(/\/$/, '');
    return `${baseURL}/${path}`;
  }

  /**
   * 获取数据文件 URL（静态文件）
   * @param {string} relativePath - 相对路径
   * @returns {string} 完整 URL
   */
  getDataURL(relativePath) {
    const baseURL = this.serverConfig.baseURL.replace(/\/$/, '');
    return `${baseURL}/data/${relativePath}`;
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

  // ==================== HTTP 服务器方式 ====================

  /**
   * 从服务器加载配置文件
   * @param {string} configId - 配置ID
   * @returns {Promise<Object|null>} 加载的数据
   */
  async loadFromServer(configId) {
    const config = this.getConfigDefinition(configId);
    if (!config) {
      console.error(`[DataManager] ❌ 未找到配置: ${configId}`);
      return null;
    }

    try {
      // 使用数据文件 URL（静态文件服务）
      const url = this.getDataURL(config.relativePath);
      console.log(`[DataManager] 📡 从服务器加载: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.serverConfig.timeout);

      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      console.log(`[DataManager] ✅ 从服务器加载成功，数据项: ${Array.isArray(data) ? data.length : Object.keys(data).length}`);

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`[DataManager] ❌ 加载超时`);
      } else {
        console.error(`[DataManager] ❌ 从服务器加载失败:`, error);
      }
      return null;
    }
  }

  /**
   * 上传配置文件到服务器（通过 API）
   * @param {string} configId - 配置ID
   * @param {Array|Object} data - 要上传的数据
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async uploadToServer(configId, data, options = {}) {
    const config = this.getConfigDefinition(configId);
    if (!config) {
      console.error(`[DataManager] ❌ 未找到配置: ${configId}`);
      return { success: false, error: '配置不存在' };
    }

    try {
      console.log(`[DataManager] 📤 上传配置到服务器: ${config.name}`);

      // 验证数据
      const validation = this.validateConfig(configId, data);
      if (!validation.valid) {
        console.error(`[DataManager] ❌ 数据验证失败:`, validation.errors);
        return { success: false, error: '数据验证失败', errors: validation.errors };
      }

      // 构建上传 URL
      const uploadURL = this.getAPIURL(`${this.serverConfig.dataAPI}/${config.relativePath}`);
      console.log(`[DataManager] 📡 上传URL: ${uploadURL}`);

      // 发送 POST 请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.serverConfig.timeout);

      const response = await fetch(uploadURL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`[DataManager] ✅ 上传成功: ${config.fileName}`);
        return { success: true, message: result.message || '上传成功', result };
      } else {
        throw new Error(result.error || '上传失败');
      }
    } catch (error) {
      console.error(`[DataManager] ❌ 上传失败:`, error);
      return {
        success: false,
        error: error.message,
        hint: '请检查服务器配置和网络连接'
      };
    }
  }

  // ==================== 本地文件方式（备用） ====================

  /**
   * 导出配置为 JSON 文件（本地下载）
   * @param {string} configId - 配置ID
   * @param {Array|Object} data - 要导出的数据
   * @param {Object} options - 导出选项
   * @returns {Promise<boolean>} 是否成功
   */
  async exportConfig(configId, data, options = {}) {
    const config = this.getConfigDefinition(configId);
    if (!config) {
      console.error(`[DataManager] ❌ 未找到配置: ${configId}`);
      return false;
    }

    try {
      console.log(`[DataManager] 📤 导出配置（本地）: ${config.name}`);

      const pretty = options.pretty !== false;
      const fileName = options.fileName || config.fileName;
      const jsonString = JSON.stringify(data, null, pretty ? 2 : 0);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
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
   * 导入配置文件（本地上传）
   * @param {Object} options - 导入选项
   * @returns {Promise<Object|null>} 导入的数据
   */
  async importConfig(options = {}) {
    try {
      console.log(`[DataManager] 📥 准备导入配置（本地）`);

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.accept || '.json,application/json';
      input.style.display = 'none';

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

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);

      const file = await filePromise;
      console.log(`[DataManager] 📄 读取文件: ${file.name}`);

      const fileContent = await this.readFile(file, options.onProgress);
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
   */
  readFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      };
      reader.readAsText(file);
    });
  }

  // ==================== 数据验证 ====================

  /**
   * 验证 JSON 数据格式
   * @param {string} configId - 配置ID
   * @param {*} data - 要验证的数据
   * @returns {Object} 验证结果
   */
  validateConfig(configId, data) {
    const config = this.getConfigDefinition(configId);
    const errors = [];

    if (!config) {
      errors.push(`未找到配置定义: ${configId}`);
      return { valid: false, errors };
    }

    if (data === null || data === undefined) {
      errors.push('数据不能为空');
      return { valid: false, errors };
    }

    switch (configId) {
      case 'oblique-photography':
        if (!Array.isArray(data)) {
          errors.push('倾斜摄影配置必须是数组');
        } else {
          data.forEach((item, index) => {
            if (!item.id) errors.push(`第 ${index + 1} 项缺少 id 字段`);
            if (!item.name) errors.push(`第 ${index + 1} 项缺少 name 字段`);
            if (!item.url) errors.push(`第 ${index + 1} 项缺少 url 字段`);
          });
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  // ==================== 统计信息 ====================

  /**
   * 获取配置文件的统计信息
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

  /**
   * 测试服务器连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const url = `${this.serverConfig.baseURL}/`;
      console.log(`[DataManager] 🔌 测试服务器连接: ${url}`);

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        cache: 'no-cache'
      });

      console.log(`[DataManager] ✅ 服务器连接成功: ${response.status}`);
      return response.ok || response.status === 404; // 404 也说明服务器在线
    } catch (error) {
      console.error(`[DataManager] ❌ 服务器连接失败:`, error);
      return false;
    }
  }

  /**
   * 获取服务器文件列表
   * @param {string} directory - 目录路径（相对于 data 目录）
   * @returns {Promise<Array>} 文件列表
   */
  async listServerFiles(directory = '') {
    try {
      console.log(`[DataManager] 📂 获取服务器文件列表: ${directory}`);

      // 使用 API 获取文件列表
      const apiURL = this.getAPIURL('api/configs');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.serverConfig.timeout);

      const response = await fetch(apiURL, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`[DataManager] ✅ 获取文件列表成功，共 ${result.data.length} 个文件`);
        return result.data;
      } else {
        throw new Error(result.error || '获取文件列表失败');
      }
    } catch (error) {
      console.error(`[DataManager] ❌ 获取文件列表失败:`, error);
      return [];
    }
  }

  /**
   * 获取服务器的目录结构
   * @returns {Promise<Object>} 目录结构
   */
  async getServerDirectoryStructure() {
    try {
      const files = await this.listServerFiles();

      // 按目录分组
      const directoryMap = new Map();

      files.forEach(file => {
        const dirPath = file.filePath.includes('/')
          ? file.filePath.substring(0, file.filePath.lastIndexOf('/'))
          : '';

        if (!directoryMap.has(dirPath)) {
          directoryMap.set(dirPath, []);
        }

        directoryMap.get(dirPath).push({
          name: file.fileName,
          path: file.filePath,
          size: file.fileSize,
          modified: file.modifiedTime
        });
      });

      // 转换为对象
      const directories = {};
      directoryMap.forEach((files, dirPath) => {
        directories[dirPath || '/'] = files;
      });

      return directories;
    } catch (error) {
      console.error(`[DataManager] ❌ 获取目录结构失败:`, error);
      return {};
    }
  }
}

// 导出全局单例
export const dataManager = new DataManager();
export default dataManager;
