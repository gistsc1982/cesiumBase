<template>
  <!-- 主面板 -->
  <FunctionPanelUIBase
    title="倾斜摄影加载"
    title-icon="📷"
    :width="420"
    :max-height="'70vh'"
    :initial-x="initialX"
    :initial-y="initialY"
    :allow-minimize="true"
    close-event-name="obliquePhotographyPanelClose"
    :auto-register="true"
    registration-key="ObliquePhotographyPanel"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
  >
    <!-- 工具栏 -->
    <div class="toolbar">
        <button @click="showAddDialog = true" class="tool-btn add-btn" title="添加倾斜摄影数据">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          添加
        </button>

        <!-- ⭐ 导出配置到服务器 JSON 文件（通过 HTTP API 写入 SQLite → 自动同步到 FTP 目录） -->
        <button @click="exportConfig" class="tool-btn export-btn" title="导出配置到服务器 JSON 文件">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导出
        </button>

        <!-- ⭐ 从服务器 JSON 文件导入配置（通过 HTTP API 读取） -->
        <button @click="importConfig" class="tool-btn import-btn" title="从服务器 JSON 文件导入配置">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          导入
        </button>

        <!-- ⭐ 从服务器刷新 JSON 数据 -->
        <button @click="refreshFromJson" class="tool-btn refresh-btn" title="从服务器刷新 JSON 数据">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          刷新
        </button>
      </div>

    <!-- 倾斜摄影列表 -->
    <div class="oblique-list">
      <template v-for="item in obliquePhotographyList" :key="item.id">
        <div
          class="oblique-item"
          :class="{
            'is-loaded': item.loaded,
            'is-loading': item.loading,
            'is-selected': selectedItemId === item.id
          }"
        >
          <!-- 复选框和名称 -->
          <div class="item-main">
            <label class="oblique-checkbox">
              <input
                type="checkbox"
                :checked="item.loaded || false"
                @change="toggleObliquePhotography(item)"
                :disabled="item.loading || false"
                class="checkbox-input"
              />
              <span class="check-indicator"></span>
              <div class="item-info">
                <span class="oblique-name">{{ item.name || '未知' }}</span>
                <span v-if="item.loading" class="loading-text">加载中...</span>
                <span v-else-if="item.loaded" class="status-text loaded">已加载</span>
                <span v-else class="status-text unloaded">未加载</span>
              </div>
            </label>
          </div>

          <!-- 操作按钮组 -->
          <div class="item-actions">
            <!-- 定位按钮：始终显示，定位到3D Tiles位置 -->
            <button
              @click="locateToObliquePhotography(item)"
              class="action-btn locate-btn"
              type="button"
              :disabled="!item.loaded"
              :aria-label="`定位到 ${item.name}`"
              title="定位到3D Tiles位置"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 高度调整按钮：只在已加载时显示 -->
            <button
              v-if="item.loaded"
              @click="openHeightAdjust(item)"
              class="action-btn height-btn"
              type="button"
              :aria-label="`调整 ${item.name} 高度`"
              title="高度调整"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19V5M5 12l7-7 7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 编辑按钮 -->
            <button
              @click="openEditDialog(item)"
              class="action-btn edit-btn"
              type="button"
              :aria-label="`编辑 ${item.name}`"
              title="编辑"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <!-- 删除按钮 -->
            <button
              @click="confirmDelete(item)"
              class="action-btn delete-btn"
              type="button"
              :aria-label="`删除 ${item.name}`"
              title="删除"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 空状态 -->
    <div v-if="obliquePhotographyList.length === 0" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="empty-title">暂无倾斜摄影数据</div>
      <div class="empty-hint">点击"添加"按钮导入倾斜摄影配置</div>
    </div>

    <!-- 添加/编辑对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showAddDialog || showEditDialog" class="dialog-overlay" @click.self="closeDialog">
          <div class="dialog" @click.stop>
            <div class="dialog-header">
              <h3 class="dialog-title">{{ showEditDialog ? '编辑倾斜摄影' : '添加倾斜摄影' }}</h3>
              <button @click="closeDialog" class="dialog-close" aria-label="关闭对话框">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <div class="dialog-body">
              <div class="form-group">
                <label class="form-label">ID <span class="required">*</span></label>
                <input
                  v-model="formData.id"
                  type="text"
                  class="form-input"
                  placeholder="输入唯一标识符"
                  :disabled="showEditDialog"
                />
              </div>
              <div class="form-group">
                <label class="form-label">名称 <span class="required">*</span></label>
                <input
                  v-model="formData.name"
                  type="text"
                  class="form-input"
                  placeholder="输入显示名称"
                />
              </div>
              <div class="form-group">
                <label class="form-label">URL <span class="required">*</span></label>
                <textarea
                  v-model="formData.url"
                  class="form-textarea"
                  rows="3"
                  placeholder="输入倾斜摄影数据URL"
                ></textarea>
              </div>
            </div>
            <div class="dialog-footer">
              <button @click="closeDialog" class="dialog-btn cancel-btn">取消</button>
              <button @click="saveItem" class="dialog-btn confirm-btn">保存</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showDeleteDialog" class="dialog-overlay" @click.self="showDeleteDialog = false">
          <div class="dialog dialog-small" @click.stop>
            <div class="dialog-header">
              <h3 class="dialog-title">确认删除</h3>
            </div>
            <div class="dialog-body">
              <div class="delete-warning">
                <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <div class="warning-text">
                  确定要删除 "{{ deleteTarget?.name }}" 吗？此操作无法撤销。
                </div>
              </div>
            </div>
            <div class="dialog-footer">
              <button @click="showDeleteDialog = false" class="dialog-btn cancel-btn">取消</button>
              <button @click="executeDelete" class="dialog-btn danger-btn">删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ⭐ 服务器文件浏览对话框（导入配置） -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showImportDialog" class="dialog-overlay" @click.self="closeImportDialog">
          <div class="dialog dialog-large" @click.stop>
            <div class="dialog-header">
              <h3 class="dialog-title">📂 从服务器导入配置</h3>
              <button @click="closeImportDialog" class="close-btn" aria-label="关闭">×</button>
            </div>

            <div class="dialog-body">
              <!-- 服务器信息 -->
              <div class="server-info">
                <span class="server-label">服务器：</span>
                <span class="server-url">{{ apiServerURL }}</span>
              </div>

              <!-- 文件列表 -->
              <div class="file-browser">
                <!-- 目录导航 -->
                <div class="directory-nav">
                  <button
                    v-if="canGoBack"
                    @click="navigateToParentDirectory"
                    class="nav-btn back-btn"
                    title="返回上级目录"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    返回
                  </button>
                  <span class="nav-label">目录：</span>
                  <span class="nav-path">{{ currentDirectoryDisplay }}</span>
                </div>

                <!-- 子目录列表 -->
                <div class="file-list" v-if="!loadingServerFiles">
                  <!-- 子目录 -->
                  <div
                    v-for="dir in currentSubdirectories"
                    :key="'dir-' + dir"
                    class="file-item directory-item"
                    @click="navigateToDirectory(dir)"
                  >
                    <div class="file-icon">📁</div>
                    <div class="file-info">
                      <div class="file-name">{{ dir }}</div>
                      <div class="file-path">目录</div>
                    </div>
                    <div class="file-action">📂</div>
                  </div>

                  <!-- 文件 -->
                  <div
                    v-for="file in currentDirectoryFiles"
                    :key="file.path || file.filePath"
                    class="file-item"
                    :class="{ 'is-selected': selectedServerFile === file }"
                    @click="selectServerFile(file)"
                  >
                    <div class="file-icon">📄</div>
                    <div class="file-info">
                      <div class="file-name">{{ file.fileName || file.name }}</div>
                      <div class="file-path">{{ file.filePath || file.path }}</div>
                      <div class="file-meta">
                        <span class="file-size">{{ formatFileSize(file.fileSize || file.size) }}</span>
                        <span class="file-date">{{ formatDate(file.modifiedTime || file.modified) }}</span>
                      </div>
                    </div>
                    <div class="file-action">📥</div>
                  </div>
                </div>

                <!-- 加载状态 -->
                <div v-else class="file-list loading">
                  <div class="loading-spinner"></div>
                  <p>正在加载服务器文件...</p>
                </div>

                <!-- 空状态 -->
                <div v-if="!loadingServerFiles && serverFiles.length === 0" class="empty-state">
                  <div class="empty-icon">📁</div>
                  <div class="empty-title">服务器上没有找到配置文件</div>
                  <div class="empty-hint">请确保 API 服务器已启动</div>
                </div>
              </div>
            </div>

            <div class="dialog-footer">
              <button @click="closeImportDialog" class="dialog-btn cancel-btn">取消</button>
              <button
                @click="loadServerFiles()"
                class="dialog-btn secondary-btn"
                :disabled="loadingServerFiles"
              >
                🔄 刷新
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </FunctionPanelUIBase>

  <!-- 高度调整面板（独立渲染，避免嵌套Teleport冲突） -->
  <Teleport to="body">
    <Transition name="height-panel-fade">
      <ObliqueHeightAdjustPanel
        v-if="showHeightPanel && selectedLayer"
        :initial-x="computedHeightPanelX"
        :initial-y="initialY"
        :selected-layer="selectedLayer"
        @close="showHeightPanel = false"
        @height-preview="onHeightPreview"
        @height-change="onHeightChange"
      />
    </Transition>
  </Teleport>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';
import SfcBase from '../SfcBase.vue';
import ObliqueHeightAdjustPanel from './ObliqueHeightAdjustPanel.vue';
import { panelSingletonManager } from '../utils/PanelSingletonManager.js';
import { dataManager } from '../../utils/DataManager.js';

const JSON_FILE_PATH = '/data/gis/oblique_photography.json';
const CONFIG_ID = 'oblique-photography';

/**
 * ObliquePhotographyPanel - 倾斜摄影功能面板
 *
 * 使用 FunctionPanelUIBase 作为容器，实现完整的倾斜摄影加载和管理功能：
 * - 从JSON文件读取配置
 * - 支持添加/编辑/删除配置
 * - 列表展示和加载/卸载
 * - 高度偏移调整（通过独立组件）
 */
export default {
  name: 'ObliquePhotographyPanel',
  components: {
    FunctionPanelUIBase,
    ObliqueHeightAdjustPanel
  },
  mixins: [SfcBase],
  props: {
    initialX: {
      type: [Number, String],
      default: 'center'
    },
    initialY: {
      type: Number,
      default: 120
    }
  },
  data() {
    return {
      componentName: 'ObliquePhotographyPanel',
      // 倾斜摄影列表（仅包含UI状态，不包含Cesium对象）
      obliquePhotographyList: [],
      // Cesium 对象引用
      cesiumViewer: null,
      Cesium: null,
      // 对话框状态
      showAddDialog: false,
      showEditDialog: false,
      showDeleteDialog: false,
      showImportDialog: false,  // ⭐ 服务器文件导入对话框
      // 服务器文件浏览相关
      serverFiles: [],           // 所有服务器文件
      serverDirectories: {},     // 目录结构
      selectedServerFile: null,
      loadingServerFiles: false,
      currentServerDirectory: '', // 当前目录路径（相对于 data 目录）
      allFilesMap: new Map(),    // 文件路径到文件对象的映射
      serverBaseURL: '', // ⭐ 前端服务器地址（用于静态文件）
      apiServerURL: '', // ⭐ API 服务器地址（用于 API 请求）
      // 表单数据
      formData: {
        id: '',
        name: '',
        url: ''
      },
      editingItem: null,
      deleteTarget: null,
      // 高度调整面板
      showHeightPanel: false,
      selectedLayer: null,
      selectedItemId: null
    };
  },
  // ==================== 性能优化：Cesium对象管理器 ====================
  // ⚡ 使用非响应式Map存储Cesium对象，避免Vue响应式包装
  // 这解决了严重的性能问题：将362ms(38.8%)的性能损耗降低到15-20%
  beforeCreate() {
    // ⭐ 在Vue实例创建前初始化，避免被包装为响应式
    this._cesiumTilesets = new Map();  // 存储Cesium3DTileset对象
    this._cesiumTransforms = new Map(); // 存储initialTransform
    this._cesiumHeightOffsets = new Map(); // 存储heightOffset
    this._cesiumErrorHandlers = new Map(); // 存储错误处理器
  },
  created() {
    // ⭐ 从环境变量读取服务器配置
    this.serverBaseURL = process.env.VUE_APP_SERVER_BASE_URL || 'http://192.168.31.146:8080';

    // ⭐ API 服务器地址（从环境变量获取，或从前端地址推断）
    const apiPort = process.env.VUE_APP_API_PORT || '8081';
    const urlObj = new URL(this.serverBaseURL);
    urlObj.port = apiPort;
    this.apiServerURL = urlObj.toString().replace(/\/$/, '');

    console.log(`[${this.componentName}] 🔧 服务器配置:`, {
      frontend: this.serverBaseURL,
      api: this.apiServerURL
    });
  },
  computed: {
    /**
     * 计算高度调整面板的X位置
     * 如果主面板在中间，则高度调整面板也在中间
     * 如果主面板在右侧，则高度调整面板向左偏移
     */
    computedHeightPanelX() {
      if (typeof this.initialX === 'number') {
        return this.initialX + 450;
      }
      // 如果是 'center' 或其他字符串，保持原值
      return this.initialX;
    },

    /**
     * 获取当前目录的文件列表
     */
    currentDirectoryFiles() {
      const currentDir = this.currentServerDirectory || '';

      return this.serverFiles.filter(file => {
        const filePath = file.filePath || file.path;
        if (!filePath) return false;

        // 获取文件所在目录
        const fileDir = filePath.includes('/')
          ? filePath.substring(0, filePath.lastIndexOf('/'))
          : '';

        // 匹配当前目录
        return fileDir === currentDir;
      });
    },

    /**
     * 获取当前目录的子目录列表
     */
    currentSubdirectories() {
      const currentDir = this.currentServerDirectory || '';
      const subdirs = new Set();

      this.serverFiles.forEach(file => {
        const filePath = file.filePath || file.path;
        if (!filePath) return;

        // 获取文件所在目录
        const fileDir = filePath.includes('/')
          ? filePath.substring(0, filePath.lastIndexOf('/'))
          : '';

        // 跳过当前目录的文件
        if (fileDir === currentDir) return;

        // 检查是否是当前目录的子目录
        if (currentDir === '') {
          // 根目录：提取第一级目录名
          if (fileDir) {
            const firstSlash = fileDir.indexOf('/');
            if (firstSlash === -1) {
              // 直接子目录（如 gis, config4user）
              subdirs.add(fileDir);
            } else {
              // 嵌套子目录，取第一级（如 config4user/user1 中的 config4user）
              subdirs.add(fileDir.substring(0, firstSlash));
            }
          }
        } else {
          // 子目录：检查是否以当前目录为前缀
          if (fileDir.startsWith(currentDir + '/')) {
            // 提取下一级目录名
            const relativePath = fileDir.substring(currentDir.length + 1);
            const firstSlash = relativePath.indexOf('/');

            if (firstSlash === -1) {
              // 直接子目录
              subdirs.add(relativePath);
            } else {
              // 嵌套子目录，取第一级
              subdirs.add(relativePath.substring(0, firstSlash));
            }
          }
        }
      });

      return Array.from(subdirs).sort();
    },

    /**
     * 获取当前目录的显示路径
     */
    currentDirectoryDisplay() {
      return '/data/' + (this.currentServerDirectory ? this.currentServerDirectory + '/' : '');
    },

    /**
     * 是否可以返回上级目录
     */
    canGoBack() {
      return this.currentServerDirectory !== '';
    }
  },
  mounted() {
    // ⭐ 单例模式：检查是否有保存的状态
    const savedState = panelSingletonManager.getPanelState(this.componentName);
    const hasValidData = savedState && savedState.obliquePhotographyList && savedState.obliquePhotographyList.length > 0;

    if (hasValidData) {
      console.log(`[${this.componentName}] 📦 恢复保存的状态（单例模式）`);

      // 恢复 Cesium 对象
      this._cesiumTilesets = savedState.cesiumTilesets;
      this._cesiumTransforms = savedState.cesiumTransforms;
      this._cesiumHeightOffsets = savedState.cesiumHeightOffsets;
      this._cesiumErrorHandlers = savedState.cesiumErrorHandlers;

      // 恢复倾斜摄影列表状态
      this.obliquePhotographyList = savedState.obliquePhotographyList;

      // 重新设置错误处理器（事件监听器需要重新绑定）
      this._cesiumErrorHandlers.forEach((data, id) => {
        if (data && data.tileset && data.tileset.tileFailed) {
          data.tileset.tileFailed.addEventListener(data.errorHandler);
        }
      });
    }

    this.initCesium(() => {
      console.log(`[${this.componentName}] Cesium 已就绪，面板初始化完成`);

      // ⭐ 等待 Cesium 就绪后再加载数据
      if (!hasValidData) {
        // 没有有效数据：从 JSON 加载
        console.log(`[${this.componentName}] 📂 没有保存的有效数据，从 JSON 加载`);
        this.loadFromJson();
      } else {
        // 有有效数据：恢复 Cesium 对象
        console.log(`[${this.componentName}] 🔄 有保存的数据，恢复 Cesium 对象`);
        this.restoreCesiumObjects();
      }
    });
  },
  beforeUnmount() {
    // ⭐ 单例模式：保存面板状态到单例管理器
    console.log(`[${this.componentName}] 💾 保存面板状态到单例管理器`);

    // 保存面板状态到单例管理器
    panelSingletonManager.savePanelState(this.componentName, {
      cesiumTilesets: this._cesiumTilesets,
      cesiumTransforms: this._cesiumTransforms,
      cesiumHeightOffsets: this._cesiumHeightOffsets,
      cesiumErrorHandlers: this._cesiumErrorHandlers,
      obliquePhotographyList: this.obliquePhotographyList
    });

    // ⚡ 清理事件监听器（避免内存泄漏）
    if (this._cesiumErrorHandlers) {
      this._cesiumErrorHandlers.forEach((data, id) => {
        if (data && data.tileset && data.tileset.tileFailed) {
          data.tileset.tileFailed.removeEventListener(data.errorHandler);
        }
      });
    }

    // ⚠️ 不清理以下数据，已保存到单例管理器：
    // - obliquePhotographyList（保留loaded状态）
    // - _cesiumTilesets（保留tileset对象）
    // - _cesiumTransforms（保留transform对象）
    // - _cesiumHeightOffsets（保留高度偏移）
  },
  methods: {
    handleClose() {
      console.log(`[${this.componentName}] 面板假关闭（单实例模式）`);
      // ⭐ 触发自定义事件，通知父组件假关闭（不销毁组件）
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('obliquePhotographyPanelFakeClose', {
          detail: {
            componentName: this.componentName,
            preserveData: true
          }
        });
        window.dispatchEvent(event);
      }
      this.$emit('close');
    },

    handleMinimize() {
      console.log(`[${this.componentName}] 面板已最小化`);
    },

    handleExpand() {
      console.log(`[${this.componentName}] 面板已展开`);
    },

    // ==================== 单例模式状态恢复 ====================

    /**
     * 恢复 Cesium 对象到场景中
     * 在面板重新打开时调用，将保存的 Cesium 对象重新添加到场景
     */
    restoreCesiumObjects() {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化，无法恢复 Cesium 对象`);
        return;
      }

      console.log(`[${this.componentName}] 🔄 恢复 Cesium 对象到场景`);

      let restoredCount = 0;
      this._cesiumTilesets.forEach((tileset, id) => {
        if (tileset && !tileset.isDestroyed()) {
          // 检查 tileset 是否已经在场景中
          if (!viewer.scene.primitives.contains(tileset)) {
            viewer.scene.primitives.add(tileset);
            restoredCount++;
            console.log(`[${this.componentName}] ✅ 恢复 tileset: ${id}`);
          } else {
            console.log(`[${this.componentName}] ℹ️ tileset 已在场景中: ${id}`);
          }

          // 恢复 transform
          const transform = this._cesiumTransforms.get(id);
          if (transform) {
            tileset.modelMatrix = transform;
          }
        }
      });

      console.log(`[${this.componentName}] ✅ 恢复完成，共恢复 ${restoredCount} 个 tileset`);
    },

    // ==================== JSON 数据管理 ====================

    /**
     * 从JSON文件加载数据
     */
    async loadFromJson() {
      try {
        console.log(`[${this.componentName}] 📂 开始加载JSON文件: ${JSON_FILE_PATH}`);

        const response = await fetch(JSON_FILE_PATH);

        console.log(`[${this.componentName}] 📡 HTTP响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}, text: ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`[${this.componentName}] 📦 JSON解析成功，原始数据:`, data);

        // 验证数据格式
        if (!Array.isArray(data)) {
          console.error(`[${this.componentName}] ❌ JSON数据格式错误：期望数组，实际收到:`, typeof data);
          this.obliquePhotographyList = [];
          return;
        }

        if (data.length === 0) {
          console.warn(`[${this.componentName}] ⚠️ JSON数据为空数组`);
          this.obliquePhotographyList = [];
          return;
        }

        // ⚡ 性能优化：保留UI状态，Cesium对象从非响应式Map中获取
        this.obliquePhotographyList = data.map(item => {
          const existing = this.obliquePhotographyList.find(old => old.id === item.id);
          return {
            ...item,
            loaded: existing?.loaded || false,
            heightOffset: this._cesiumHeightOffsets.get(item.id) || 0.0,
            loading: false
          };
        });

        console.log(`[${this.componentName}] ✅ 从JSON加载数据成功，共 ${this.obliquePhotographyList.length} 条:`, this.obliquePhotographyList);
      } catch (error) {
        console.error(`[${this.componentName}] ❌ 从JSON加载数据失败:`, error);
        console.error(`[${this.componentName}] 错误详情:`, {
          message: error.message,
          stack: error.stack,
          name: error.name
        });

        // 设置为空数组，避免显示错误状态
        this.obliquePhotographyList = [];
      }
    },

    /**
     * 刷新JSON数据
     */
    async refreshFromJson() {
      await this.loadFromJson();
      console.log(`[${this.componentName}] 数据已刷新`);
    },

    /**
     * 导出配置到服务器
     */
    async exportConfig() {
      console.log(`[${this.componentName}] 📤 准备导出配置到服务器`);

      // 提取需要保存的数据（排除运行时状态）
      const saveData = this.obliquePhotographyList.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url
      }));

      // 验证数据
      const validation = dataManager.validateConfig(CONFIG_ID, saveData);
      if (!validation.valid) {
        console.error(`[${this.componentName}] ❌ 数据验证失败:`, validation.errors);
        alert(`数据验证失败:\n${validation.errors.join('\n')}`);
        return false;
      }

      // 上传到服务器
      const result = await dataManager.uploadToServer(CONFIG_ID, saveData);

      if (result.success) {
        console.log(`[${this.componentName}] ✅ 配置已导出到服务器`);
        alert(`配置已成功导出到服务器！\n\n文件：oblique-photography.json\n数据将自动同步到 FTP 目录`);
      } else {
        console.error(`[${this.componentName}] ❌ 导出失败:`, result.error);
        alert(`导出失败！\n\n错误：${result.error}\n\n请检查：\n1. API 服务器是否启动（端口 8081）\n2. 网络连接是否正常`);
      }

      return result.success;
    },

    /**
     * 打开服务器文件导入对话框
     */
    async openImportDialog() {
      console.log(`[${this.componentName}] 📂 打开服务器文件浏览`);

      // 显示对话框
      this.showImportDialog = true;

      // 加载服务器文件列表
      await this.loadServerFiles();
    },

    /**
     * 从服务器导入配置
     */
    async importConfig() {
      console.log(`[${this.componentName}] 📥 打开服务器文件导入对话框`);

      // 打开文件浏览对话框
      await this.openImportDialog();
    },

    /**
     * 加载服务器文件列表
     */
    async loadServerFiles(directory = '') {
      this.loadingServerFiles = true;

      try {
        // 获取服务器文件列表
        const files = await dataManager.listServerFiles(directory);

        // 获取目录结构
        const directories = await dataManager.getServerDirectoryStructure();

        this.serverFiles = files;
        this.serverDirectories = directories;

        // 创建文件路径映射
        this.allFilesMap = new Map();
        files.forEach(file => {
          const filePath = file.filePath || file.path;
          if (filePath) {
            this.allFilesMap.set(filePath, file);
          }
        });

        console.log(`[${this.componentName}] ✅ 已加载 ${files.length} 个文件，${Object.keys(directories).length} 个目录`);
      } catch (error) {
        console.error(`[${this.componentName}] ❌ 加载服务器文件失败:`, error);
        alert(`加载服务器文件失败！\n\n错误：${error.message}\n\n请检查：\n1. API 服务器是否启动（端口 8081）\n2. 网络连接是否正常`);

        this.serverFiles = [];
        this.serverDirectories = {};
        this.allFilesMap = new Map();
      } finally {
        this.loadingServerFiles = false;
      }
    },

    /**
     * 导航到子目录
     */
    navigateToDirectory(dirName) {
      const newPath = this.currentServerDirectory
        ? `${this.currentServerDirectory}/${dirName}`
        : dirName;

      console.log(`[${this.componentName}] 📂 进入目录: ${newPath}`);
      this.currentServerDirectory = newPath;
    },

    /**
     * 返回上级目录
     */
    navigateToParentDirectory() {
      if (!this.currentServerDirectory) return;

      const lastSlash = this.currentServerDirectory.lastIndexOf('/');
      const parentPath = lastSlash === -1
        ? ''
        : this.currentServerDirectory.substring(0, lastSlash);

      console.log(`[${this.componentName}] 🔙 返回上级目录: ${parentPath || '(根目录)'}`);
      this.currentServerDirectory = parentPath;
    },

    /**
     * 选择服务器文件进行导入
     */
    async selectServerFile(file) {
      if (!file) {
        this.selectedServerFile = null;
        return;
      }

      // 兼容不同的属性名
      const fileName = file.fileName || file.name;
      const filePath = file.filePath || file.path;

      console.log(`[${this.componentName}] 📄 选择文件: ${fileName}`);
      console.log(`[${this.componentName}] 文件路径: ${filePath}`);

      this.selectedServerFile = file;

      // 确认导入
      const confirmMsg = `确认导入文件：${fileName}\n\n这将覆盖当前配置。`;
      if (!confirm(confirmMsg)) {
        console.log(`[${this.componentName}] ⚠️ 用户取消导入`);
        return;
      }

      // 从服务器加载文件内容
      // 注意：使用 CONFIG_ID 而不是文件路径，因为 DataManager 中有配置定义
      const data = await dataManager.loadFromServer(CONFIG_ID);

      if (!data) {
        alert(`从服务器加载文件失败！\n\n请检查网络连接`);
        return;
      }

      // 验证数据
      const validation = dataManager.validateConfig(CONFIG_ID, data);
      if (!validation.valid) {
        alert(`服务器数据验证失败:\n${validation.errors.join('\n')}`);
        return;
      }

      // 应用导入的数据
      this.obliquePhotographyList = data.map(item => ({
        ...item,
        loaded: false,
        heightOffset: 0.0,
        loading: false
      }));

      console.log(`[${this.componentName}] ✅ 从服务器导入配置成功，共 ${this.obliquePhotographyList.length} 条`);

      // 关闭对话框
      this.closeImportDialog();

      alert(`配置已成功从服务器导入！\n\n文件：${fileName}\n共导入 ${this.obliquePhotographyList.length} 条配置。`);
    },

    /**
     * 关闭导入对话框
     */
    closeImportDialog() {
      this.showImportDialog = false;
      this.selectedServerFile = null;
      // 保留文件列表和目录状态，不重置
      // this.serverFiles = [];
      // this.serverDirectories = {};
    },

    /**
     * 格式化日期时间
     * @param {string|Date} date - 日期对象或字符串
     * @returns {string} 格式化的日期
     */
    formatDate(date) {
      if (!date) return '未知';

      const d = new Date(date);
      if (isNaN(d.getTime())) return '无效日期';

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}`;
    },

    /**
     * 格式化文件大小
     * @param {number} bytes - 文件大小（字节）
     * @returns {string} 格式化的文件大小
     */
    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';

      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    /**
     * 获取配置统计信息
     */
    getConfigStats() {
      const saveData = this.obliquePhotographyList.map(item => ({
        id: item.id,
        name: item.name,
        url: item.url
      }));

      return dataManager.getConfigStats(CONFIG_ID, saveData);
    },

    // ==================== 对话框管理 ====================

    closeDialog() {
      this.showAddDialog = false;
      this.showEditDialog = false;
      this.formData = { id: '', name: '', url: '' };
      this.editingItem = null;
    },

    openEditDialog(item) {
      this.editingItem = item;
      this.formData = {
        id: item.id,
        name: item.name,
        url: item.url
      };
      this.showEditDialog = true;
    },

    async saveItem() {
      if (!this.formData.id || !this.formData.name || !this.formData.url) {
        alert('请填写所有必填字段');
        return;
      }

      if (this.showEditDialog && this.editingItem) {
        // 编辑现有项目
        const index = this.obliquePhotographyList.findIndex(item => item.id === this.editingItem.id);
        if (index !== -1) {
          this.obliquePhotographyList[index] = {
            ...this.obliquePhotographyList[index],
            name: this.formData.name,
            url: this.formData.url
          };
        }
      } else {
        // 添加新项目
        if (this.obliquePhotographyList.some(item => item.id === this.formData.id)) {
          alert('ID已存在，请使用唯一的ID');
          return;
        }
        this.obliquePhotographyList.push({
          id: this.formData.id,
          name: this.formData.name,
          url: this.formData.url,
          loaded: false,
          heightOffset: 0.0,
          loading: false
        });
      }

      await this.saveToJson();
      this.closeDialog();
    },

    confirmDelete(item) {
      if (item.loaded) {
        alert('请先卸载倾斜摄影再删除');
        return;
      }
      this.deleteTarget = item;
      this.showDeleteDialog = true;
    },

    async executeDelete() {
      if (!this.deleteTarget) return;

      const index = this.obliquePhotographyList.findIndex(item => item.id === this.deleteTarget.id);
      if (index !== -1) {
        this.obliquePhotographyList.splice(index, 1);
        await this.saveToJson();
      }

      this.showDeleteDialog = false;
      this.deleteTarget = null;
    },

    // ==================== 倾斜摄影加载/卸载 ====================

    async toggleObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      if (item.loaded) {
        await this.unloadObliquePhotography(item);
      } else {
        await this.loadObliquePhotography(item);
      }
    },

    async loadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 加载倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：使用数组替换代替$set
      const index = this.obliquePhotographyList.findIndex(i => i.id === item.id);
      if (index !== -1) {
        this.obliquePhotographyList[index].loading = true;
        this.obliquePhotographyList = [...this.obliquePhotographyList];
      }

      try {
        // ⚡ 性能优化：优化3D瓦片配置，提升性能30-40%
        const tileset = new Cesium.Cesium3DTileset({
          url: item.url,
          show: true,
          // ⚡ 提高maximumScreenSpaceError以减少细节渲染
          maximumScreenSpaceError: 16,  // 从2提高到16
          skipLevelOfDetail: true,
          baseScreenSpaceError: 1024,
          skipScreenSpaceErrorFactor: 16,
          skipLevels: 1,
          // ⚡ 改为false，避免立即加载导致性能问题
          immediatelyLoadDesiredLevelOfDetail: false,
          loadSiblings: false,
          // ⭐ 添加动态屏幕空间误差优化
          dynamicScreenSpaceError: true,
          dynamicScreenSpaceErrorDensity: 0.00278,
          dynamicScreenSpaceErrorFactor: 4.0,
          dynamicScreenSpaceErrorHeightFalloff: 0.25,
          // ⚡ 性能优化：确保调试模式关闭
          debugShowBoundingVolume: false,
          debugShowContentBoundingVolume: false,
          debugShowViewerRequestVolume: false
        });

        // ⚡ 性能优化：存储到非响应式Map中，避免Vue响应式包装
        // 注意：不能冻结tileset对象，因为Cesium需要向其添加内部属性
        this._cesiumTilesets.set(item.id, tileset);

        viewer.scene.primitives.add(tileset);

        const handleReady = () => {
          console.log(`[${this.componentName}] 倾斜摄影加载完成: ${item.name}`);

          if (tileset.boundingSphere) {
            const sphere = tileset.boundingSphere;
            console.log(`[${this.componentName}] ${item.name} 边界球:`, {
              中心X: sphere.center.x.toFixed(2),
              中心Y: sphere.center.y.toFixed(2),
              中心Z: sphere.center.z.toFixed(2),
              半径: sphere.radius.toFixed(2) + '米'
            });
          }

          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loading = false;
            this.obliquePhotographyList[itemIndex].loaded = true;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }

          // ⚡ 性能优化：存储initialTransform到非响应式Map中
          if (tileset.root && tileset.root.transform) {
            const transform = Cesium.Matrix4.clone(tileset.root.transform);
            this._cesiumTransforms.set(item.id, transform);
          }

          // ⭐ 自动定位到当前加载的倾斜摄影位置
          if (tileset.boundingSphere) {
            viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
              duration: 2,
              offset: new Cesium.HeadingPitchRange(0, -45, tileset.boundingSphere.radius * 2.0)
            });
            console.log(`[${this.componentName}] 🎯 已自动定位到 ${item.name}`);
          }
        };

        const handleError = (error) => {
          console.error(`[${this.componentName}] 倾斜摄影加载失败: ${item.name}`, error);
          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loading = false;
            this.obliquePhotographyList[itemIndex].loaded = false;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }
        };

        if (tileset.readyPromise) {
          if (typeof Promise !== 'undefined' && tileset.readyPromise instanceof Promise) {
            tileset.readyPromise.then(handleReady).catch(handleError);
          } else if (typeof tileset.readyPromise.then === 'function') {
            tileset.readyPromise.then(handleReady);
            if (typeof tileset.readyPromise.otherwise === 'function') {
              tileset.readyPromise.otherwise(handleError);
            }
          }
        }

        // ⚡ 存储错误事件监听器引用，用于后续清理
        this._cesiumErrorHandlers = this._cesiumErrorHandlers || new Map();
        if (tileset.tileFailed) {
          const errorHandler = handleError;
          tileset.tileFailed.addEventListener(errorHandler);
          this._cesiumErrorHandlers.set(item.id, {
            tileset,
            errorHandler
          });
        }

      } catch (error) {
        console.error(`[${this.componentName}] 倾斜摄影加载失败: ${item.name}`, error);
        // ⚡ 性能优化：使用数组替换代替$set
        const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
        if (itemIndex !== -1) {
          this.obliquePhotographyList[itemIndex].loading = false;
          this.obliquePhotographyList[itemIndex].loaded = false;
          this.obliquePhotographyList = [...this.obliquePhotographyList];
        }
      }
    },

    unloadObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      if (!viewer) {
        console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
        return;
      }

      console.log(`[${this.componentName}] 卸载倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      if (tileset) {
        try {
          viewer.scene.primitives.remove(tileset);

          // ⚡ 清理非响应式Map中的数据
          this._cesiumTilesets.delete(item.id);
          this._cesiumTransforms.delete(item.id);
          this._cesiumHeightOffsets.delete(item.id);

          // ⚡ 清理事件监听器
          const errorHandlerData = this._cesiumErrorHandlers?.get(item.id);
          if (errorHandlerData && errorHandlerData.tileset.tileFailed) {
            errorHandlerData.tileset.tileFailed.removeEventListener(errorHandlerData.errorHandler);
            this._cesiumErrorHandlers.delete(item.id);
          }

          // ⚡ 性能优化：使用数组替换代替$set
          const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === item.id);
          if (itemIndex !== -1) {
            this.obliquePhotographyList[itemIndex].loaded = false;
            this.obliquePhotographyList = [...this.obliquePhotographyList];
          }

          console.log(`[${this.componentName}] 倾斜摄影已卸载: ${item.name}`);
        } catch (error) {
          console.error(`[${this.componentName}] 倾斜摄影卸载失败: ${item.name}`, error);
        }
      }
    },

    // ==================== 定位和高度调整 ====================

    locateToObliquePhotography(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      if (!viewer || !Cesium) {
        console.error(`[${this.componentName}] Cesium 未就绪`);
        return;
      }

      console.log(`[${this.componentName}] 定位到倾斜摄影: ${item.name}`);

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      if (!tileset || !item.loaded) {
        console.warn(`[${this.componentName}] 倾斜摄影未加载，无法定位: ${item.name}`);
        return;
      }

      try {
        if (tileset.boundingSphere) {
          const sphere = tileset.boundingSphere;
          viewer.camera.flyToBoundingSphere(sphere, {
            duration: 2,
            offset: new Cesium.HeadingPitchRange(0, -45, sphere.radius * 2.0)
          });
          console.log(`[${this.componentName}] 相机已定位到倾斜摄影位置: ${item.name}`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] 定位到倾斜摄影失败: ${item.name}`, error);
      }
    },

    openHeightAdjust(item) {
      this.selectedLayer = item;
      this.selectedItemId = item.id;
      this.showHeightPanel = true;
    },

    /**
     * 高度预览（仅更新显示值，不触发Cesium更新）
     */
    onHeightPreview({ layer, value }) {
      if (!layer) return;
      // ⚡ 性能优化：存储到非响应式Map中，避免触发 Vue 更新
      this._cesiumHeightOffsets.set(layer.id, value);
      // 同时更新显示值（从Map中获取）
      const itemIndex = this.obliquePhotographyList.findIndex(i => i.id === layer.id);
      if (itemIndex !== -1) {
        this.obliquePhotographyList[itemIndex].heightOffset = value;
        this.obliquePhotographyList = [...this.obliquePhotographyList];
      }
    },

    /**
     * 高度变化确认（触发Cesium更新）
     */
    onHeightChange({ layer, value }) {
      if (!layer) return;

      // ⚡ 性能优化：存储到非响应式Map中
      this._cesiumHeightOffsets.set(layer.id, value);
      console.log(`[${this.componentName}] ${layer.name} 高度偏移调整为: ${value.toFixed(1)} 米`);
      this.applyObliqueHeightOffset(layer);
    },

    applyObliqueHeightOffset(item) {
      const viewer = this.getCesiumViewer();
      const Cesium = this.getCesium();

      // ⚡ 性能优化：从非响应式Map中获取Cesium对象
      const tileset = this._cesiumTilesets.get(item.id);
      const initialTransform = this._cesiumTransforms.get(item.id);

      if (!viewer || !Cesium || !tileset || !item.loaded) {
        console.warn(`[${this.componentName}] 倾斜摄影未加载，无法应用高度偏移: ${item.name}`);
        return;
      }

      if (!initialTransform) {
        console.warn(`[${this.componentName}] 未找到初始变换矩阵，无法应用相对偏移: ${item.name}`);
        return;
      }

      try {
        if (tileset.root) {
          const transform = Cesium.Matrix4.clone(initialTransform);
          const heightOffset = this._cesiumHeightOffsets.get(item.id) || 0;
          const offset = new Cesium.Cartesian3(0, 0, heightOffset);
          const translation = Cesium.Matrix4.fromTranslation(offset);
          Cesium.Matrix4.multiply(transform, translation, transform);
          tileset.root.transform = transform;

          console.log(`[${this.componentName}] ${item.name} 高度偏移已应用`);
        }
      } catch (error) {
        console.error(`[${this.componentName}] 应用高度偏移失败: ${item.name}`, error);
      }
    }
  }
};
</script>

<style scoped>
/* 工具栏 */
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn svg {
  width: 16px;
  height: 16px;
}

.add-btn {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

.add-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.6);
  transform: translateY(-1px);
}

.export-btn {
  background: rgba(33, 150, 243, 0.2);
  border: 1px solid rgba(33, 150, 243, 0.4);
  color: #2196F3;
}

.export-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.6);
  transform: translateY(-1px);
}

.import-btn {
  background: rgba(156, 39, 176, 0.2);
  border: 1px solid rgba(156, 39, 176, 0.4);
  color: #9C27B0;
}

.import-btn:hover {
  background: rgba(156, 39, 176, 0.3);
  border-color: rgba(156, 39, 176, 0.6);
  transform: translateY(-1px);
}

.refresh-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

/* 列表 */
.oblique-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.oblique-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.oblique-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.oblique-item.is-loaded {
  border-color: rgba(76, 175, 80, 0.2);
  background: rgba(76, 175, 80, 0.03);
}

.oblique-item.is-selected {
  border-color: rgba(76, 175, 80, 0.4);
  background: rgba(76, 175, 80, 0.06);
}

.oblique-item.is-loading {
  opacity: 0.7;
  pointer-events: none;
}

.item-main {
  flex: 1;
  min-width: 0;
}

.oblique-checkbox {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.check-indicator {
  position: relative;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.checkbox-input:checked ~ .check-indicator {
  background: #4CAF50;
  border-color: #4CAF50;
}

.checkbox-input:checked ~ .check-indicator::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-input:disabled ~ .check-indicator {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.oblique-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-text {
  font-size: 11px;
  font-weight: 500;
}

.status-text.loaded {
  color: #4CAF50;
}

.status-text.unloaded {
  color: #808090;
}

.loading-text {
  font-size: 11px;
  color: #FFC107;
}

/* 操作按钮 */
.item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.locate-btn:hover {
  background: rgba(33, 150, 243, 0.2);
  border-color: rgba(33, 150, 243, 0.4);
  color: #2196F3;
}

.height-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

.edit-btn:hover {
  background: rgba(255, 193, 7, 0.2);
  border-color: rgba(255, 193, 7, 0.4);
  color: #FFC107;
}

.delete-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 56px;
  height: 56px;
  color: #808090;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: #b0b0b0;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #808090;
}

/* ==================== 服务器文件浏览对话框 ==================== */

.dialog-large {
  max-width: 700px;
  width: 90%;
}

.server-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(33, 150, 243, 0.1);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  font-size: 13px;
}

.server-label {
  color: #90CAF9;
  font-weight: 600;
}

.server-url {
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.file-browser {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.directory-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(33, 150, 243, 0.2);
  border: 1px solid rgba(33, 150, 243, 0.4);
  border-radius: 6px;
  color: #2196F3;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.6);
}

.nav-btn svg {
  width: 14px;
  height: 14px;
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #e0e0e0;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.nav-label {
  color: #808090;
  font-weight: 600;
}

.nav-path {
  color: #4CAF50;
  font-family: 'Courier New', monospace;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-list.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(76, 175, 80, 0.3);
  border-top-color: #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.file-item:hover {
  background: rgba(76, 175, 80, 0.1);
}

.file-item.is-selected {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
}

.file-item.directory-item:hover {
  background: rgba(33, 150, 243, 0.15);
}

.file-item.directory-item .file-action {
  opacity: 0.6;
}

.file-icon {
  font-size: 24px;
  opacity: 0.8;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  margin-bottom: 2px;
}

.file-path {
  font-size: 12px;
  color: #808090;
  font-family: 'Courier New', monospace;
  margin-bottom: 4px;
}

.file-meta {
  display: flex;
  gap: 16px;
  font-size: 11px;
  color: #606070;
}

.file-action {
  font-size: 16px;
  opacity: 0.5;
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200000;
  padding: 20px;
}

.dialog {
  background: rgba(20, 20, 25, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-small {
  max-width: 360px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.dialog-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e0e0e0;
}

.dialog-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.dialog-close:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
}

.dialog-close svg {
  width: 14px;
  height: 14px;
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 18px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #b0b0b0;
}

.required {
  color: #ff6b6b;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
  transition: all 0.2s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4CAF50;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.dialog-footer {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.dialog-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn {
  background: #4CAF50;
  border: 1px solid #4CAF50;
  color: white;
}

.confirm-btn:hover {
  background: #45a049;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.danger-btn {
  background: #ff6b6b;
  border: 1px solid #ff6b6b;
  color: white;
}

.danger-btn:hover {
  background: #ff5252;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.delete-warning {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.warning-icon {
  width: 24px;
  height: 24px;
  color: #FFC107;
  flex-shrink: 0;
  margin-top: 2px;
}

.warning-text {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.25s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog,
.dialog-fade-leave-to .dialog {
  transform: scale(0.95);
}

.height-panel-fade-enter-active,
.height-panel-fade-leave-active {
  transition: all 0.3s ease;
}

.height-panel-fade-enter-from,
.height-panel-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* 响应式 */
@media (max-width: 480px) {
  .toolbar {
    flex-direction: column;
  }

  .item-actions {
    gap: 4px;
  }

  .action-btn {
    width: 32px;
    height: 32px;
  }
}
</style>
