<template>
  <!-- 主面板 -->
  <FunctionPanelUIBase
    ref="basePanel"
    :title="panelTitle"
    :title-icon="panelIcon"
    :width="panelWidth"
    :max-height="panelMaxHeight"
    :initial-x="initialX"
    :initial-y="initialY"
    :allow-minimize="true"
    :close-event-name="closeEventName"
    :auto-register="autoRegister !== false"
    :registration-key="effectiveRegistrationKey"
    :panel-instance-id="panelInstanceId"
    :lazy-load="lazyLoad || getConfigLazyLoad()"
    @close="handleClose"
    @minimize="handleMinimize"
    @expand="handleExpand"
    @lazy-load="onLazyLoad"
  >
    <!-- 工具栏 -->
    <div class="toolbar">
      <!-- 添加按钮 -->
      <button
        v-if="toolbarButtons.add"
        @click="openAddDialog"
        class="tool-btn add-btn"
        title="添加配置项"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        添加
      </button>

      <!-- 导出按钮 -->
      <button
        v-if="toolbarButtons.export"
        @click="exportConfig"
        class="tool-btn export-btn"
        title="导出配置到服务器"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        导出
      </button>

      <!-- 导入按钮 -->
      <button
        v-if="toolbarButtons.import"
        @click="openImportDialog"
        class="tool-btn import-btn"
        title="从服务器导入配置"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        导入
      </button>

      <!-- 刷新按钮 -->
      <button
        v-if="toolbarButtons.refresh"
        @click="refreshConfig"
        class="tool-btn refresh-btn"
        title="刷新配置数据"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        刷新
      </button>

      <!-- 子类扩展：工具栏额外按钮 -->
      <slot name="toolbar-extra"></slot>
    </div>

    <!-- 子类扩展：列表前的内容 -->
    <slot name="before-list"></slot>

    <!-- 配置项列表 -->
    <div class="config-list">
      <template v-for="item in configList" :key="item[itemKeyField]">
        <div
          class="config-item"
          :class="getItemClass(item)"
        >
          <!-- 列表项主体 -->
          <div class="item-main">
            <!-- 子类扩展：列表项内容 -->
            <slot name="list-item" :item="item">
              <!-- 默认内容：显示字段值 -->
              <div class="item-info">
                <span class="item-name">{{ getItemDisplayName(item) }}</span>
                <span class="item-detail">{{ getItemDetailText(item) }}</span>
              </div>
            </slot>
          </div>

          <!-- 操作按钮组 -->
          <div class="item-actions">
            <!-- 子类扩展：额外操作按钮 -->
            <slot name="item-actions" :item="item"></slot>

            <!-- 编辑按钮 -->
            <button
              @click="openEditDialog(item)"
              class="action-btn edit-btn"
              type="button"
              :aria-label="`编辑 ${getItemDisplayName(item)}`"
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
              :aria-label="`删除 ${getItemDisplayName(item)}`"
              title="删除"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- 子类扩展：列表后的内容 -->
    <slot name="after-list"></slot>

    <!-- ==================== 对话框 ==================== -->

    <!-- 添加/编辑对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showAddDialog || showEditDialog" class="dialog-overlay" @click="closeDialog">
          <div class="dialog" @click.stop>
            <div class="dialog-header">
              <h3>{{ showEditDialog ? '编辑配置' : '添加配置' }}</h3>
              <button @click="closeDialog" class="close-btn">&times;</button>
            </div>

            <div class="dialog-body">
              <!-- 子类扩展：表单额外内容 -->
              <slot name="form-extra" :item="editingItem"></slot>

              <!-- 动态表单字段 -->
              <div class="form-fields">
                <div
                  v-for="field in fieldDefinitions"
                  :key="field.key"
                  class="form-field"
                >
                  <label :class="{ required: field.required }">{{ field.label }}</label>
                  <input
                    v-if="field.type === 'text' || field.type === 'url'"
                    v-model="formData[field.key]"
                    :type="field.type === 'url' ? 'url' : 'text'"
                    :placeholder="field.placeholder || `请输入${field.label}`"
                    @keydown.enter="submitForm"
                  />

                  <textarea
                    v-else-if="field.type === 'textarea'"
                    v-model="formData[field.key]"
                    :placeholder="field.placeholder || `请输入${field.label}`"
                    rows="3"
                  ></textarea>

                  <select
                    v-else-if="field.type === 'select'"
                    v-model="formData[field.key]"
                  >
                    <option value="">请选择</option>
                    <option
                      v-for="option in field.options"
                      :key="option.value"
                      :value="option.value"
                    >
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div class="dialog-footer">
              <button @click="closeDialog" class="btn cancel-btn">取消</button>
              <button @click="submitForm" class="btn confirm-btn">确定</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 删除确认对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showDeleteDialog" class="dialog-overlay" @click="showDeleteDialog = false">
          <div class="dialog dialog-small" @click.stop>
            <div class="dialog-header">
              <h3>确认删除</h3>
              <button @click="showDeleteDialog = false" class="close-btn">&times;</button>
            </div>

            <div class="dialog-body">
              <div class="delete-warning">
                <svg class="warning-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span class="warning-text">
                  确定要删除 "{{ deleteTarget ? getItemDisplayName(deleteTarget) : '' }}" 吗？
                  <slot name="delete-warning-extra" :item="deleteTarget"></slot>
                </span>
              </div>
            </div>

            <div class="dialog-footer">
              <button @click="showDeleteDialog = false" class="btn cancel-btn">取消</button>
              <button @click="executeDelete" class="btn danger-btn">删除</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 导入对话框 -->
    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="showImportDialog" class="dialog-overlay dialog-large" @click="closeImportDialog">
          <div class="dialog dialog-large" @click.stop>
            <div class="dialog-header">
              <h3>从服务器导入配置</h3>
              <button @click="closeImportDialog" class="close-btn">&times;</button>
            </div>

            <div class="dialog-body">
              <!-- 目录导航 -->
              <div class="file-browser">
                <div class="directory-nav">
                  <button @click="navigateToRoot" class="nav-btn" :disabled="loadingServerFiles">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    根目录
                  </button>

                  <button
                    @click="navigateToParentDirectory"
                    class="nav-btn"
                    :disabled="!canGoBack || loadingServerFiles"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    返回上级
                  </button>

                  <span class="current-dir">当前：{{ currentDirectoryDisplay }}</span>
                </div>

                <!-- 子目录列表 -->
                <div v-if="currentSubdirectories.length > 0" class="subdirectories">
                  <div class="section-title">子目录</div>
                  <div
                    v-for="dir in currentSubdirectories"
                    :key="dir"
                    @click="navigateToDirectory(dir)"
                    class="file-item directory-item"
                  >
                    <svg class="file-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                    <span class="file-name">{{ dir }}</span>
                    <svg class="arrow-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                  </div>
                </div>

                <!-- 文件列表 -->
                <div class="files">
                  <div class="section-title">
                    配置文件
                    <span v-if="loadingServerFiles" class="loading-text">加载中...</span>
                  </div>
                  <div
                    v-for="file in currentDirectoryFiles"
                    :key="file.filePath"
                    @click="selectFile(file)"
                    class="file-item"
                    :class="{ selected: selectedServerFile === file }"
                  >
                    <svg class="file-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                    <span class="file-name">{{ file.fileName }}</span>
                    <span class="file-size">{{ formatFileSize(file.fileSize) }}</span>
                  </div>

                  <div v-if="currentDirectoryFiles.length === 0 && !loadingServerFiles" class="empty-message">
                    此目录下没有配置文件
                  </div>
                </div>
              </div>
            </div>

            <div class="dialog-footer">
              <button @click="closeImportDialog" class="btn cancel-btn">取消</button>
              <button
                @click="importConfig"
                class="btn confirm-btn"
                :disabled="!selectedServerFile"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 子类扩展：额外对话框 -->
    <slot name="dialogs"></slot>
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from './FunctionPanelUIBase.vue';
import SfcBase from './SfcBase.vue';
import { dataManager } from '../utils/DataManager.js';
import { panelSingletonManager } from './utils/PanelSingletonManager.js';
const globalPanelSingletonManager = typeof window !== 'undefined' && window.__panelSingletonManager__ || panelSingletonManager;

export default {
  name: 'JsonConfigPanelBase',

  components: {
    FunctionPanelUIBase
  },

  mixins: [SfcBase],

  inject: {
    // ⭐ 覆盖 SfcBase 的 inject，避免 closeEventName 与 props 冲突
    // ⚠️ 注意：不包含 closeEventName，因为在 props 中已定义
  },

  props: {
    initialX: {
      type: [Number, String],
      default: 'center'
    },
    initialY: {
      type: Number,
      default: 120
    },

    // ==================== 面板配置 ====================
    panelTitle: {
      type: String,
      default: '配置管理'
    },
    panelIcon: {
      type: String,
      default: '⚙️'
    },
    panelWidth: {
      type: [Number, String],
      default: 420
    },
    panelMaxHeight: {
      type: String,
      default: '70vh'
    },
    closeEventName: {
      type: String,
      default: 'jsonConfigPanelClose'
    },

    // ==================== 配置项定义 ====================
    configId: {
      type: String,
      required: true
    },
    panelName: {
      type: String,
      default: 'JsonConfigPanel'
    },

    // ⭐ 多实例面板相关 props（必须显式定义，因为 FunctionPanelUIBase 使用了 Teleport）
    autoRegister: {
      type: Boolean,
      default: true
    },
    panelInstanceId: {
      type: Number,
      default: null
    },
    registrationKey: {
      type: String,
      default: null
    },

    // 字段定义
    fieldDefinitions: {
      type: Array,
      default: () => [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'name', label: '名称', type: 'text', required: true },
        { key: 'url', label: 'URL', type: 'url', required: true }
      ]
    },

    // 表单默认值
    defaultFormValues: {
      type: Object,
      default: () => ({})
    },

    // 列表项的唯一标识字段
    itemKeyField: {
      type: String,
      default: 'id'
    },

    // 工具栏按钮配置
    toolbarButtons: {
      type: Object,
      default: () => ({
        add: true,
        import: true,
        export: true,
        refresh: true
      })
    },

    // ⭐ 延迟加载配置：是否在面板第一次打开时才加载配置
    lazyLoad: {
      type: Boolean,
      default: false
    }
  },

  data() {
    return {
      configList: [],

      // 对话框状态
      showAddDialog: false,
      showEditDialog: false,
      showDeleteDialog: false,
      showImportDialog: false,

      // 服务器文件浏览
      serverFiles: [],
      serverDirectories: {},
      selectedServerFile: null,
      loadingServerFiles: false,
      currentServerDirectory: '',
      allFilesMap: new Map(),

      // 表单数据
      formData: {},
      editingItem: null,
      deleteTarget: null,

      // 服务器配置
      serverBaseURL: '',
      apiServerURL: '',

      componentName: 'JsonConfigPanel'
    };
  },

  created() {
    // 从环境变量读取服务器配置
    this.serverBaseURL = process.env.VUE_APP_SERVER_BASE_URL || 'http://192.168.31.146:8080';

    const apiPort = process.env.VUE_APP_API_PORT || '8081';
    const urlObj = new URL(this.serverBaseURL);
    urlObj.port = apiPort;
    this.apiServerURL = urlObj.toString().replace(/\/$/, '');

    console.log(`[${this.panelName}] 🔧 服务器配置:`, {
      frontend: this.serverBaseURL,
      api: this.apiServerURL
    });
  },

  mounted() {
    const savedState = globalPanelSingletonManager.getPanelState(this.effectivePanelName);
    const hasCesiumObjects = savedState && savedState.cesiumObjects;

    if (hasCesiumObjects) {
      console.log(`[${this.effectivePanelName}] 📦 恢复保存的 Cesium 对象`);
      this.restoreCesiumObjects(savedState.cesiumObjects);
    }

    // ⭐ 检查是否启用延迟加载
    const config = this.getPanelConfig();
    const shouldLazyLoad = this.lazyLoad || (config && config.lazyLoad === true);

    if (shouldLazyLoad) {
      console.log(`[${this.effectivePanelName}] ⏸️ 延迟加载已启用，等待面板首次打开时加载配置`);
      // ⭐ lazy-load 事件将通过 FunctionPanelUIBase 的 @lazy-load 传递
      console.log(`[${this.effectivePanelName}] 📝 延迟加载事件将通过 @lazy-load 监听`);
    } else {
      console.log(`[${this.effectivePanelName}] ⏭️ 延迟加载未启用，将立即加载配置`);
    }

    // ⭐ 检查是否有保存的配置列表缓存（支持单例和多实例）
    const isMultiInstance = this.panelInstanceId !== null;
    let savedStateWithConfig = null;

    if (isMultiInstance) {
      // 多实例模式：从 MultiInstancePanelConfigManager 获取缓存
      if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__ && typeof window.__multiInstancePanelConfigManager__.getPanelInstanceCache === 'function') {
        savedStateWithConfig = window.__multiInstancePanelConfigManager__.getPanelInstanceCache(
          this.instanceId || 1,
          this.effectiveRegistrationKey,
          this.panelInstanceId
        );
      }
    } else {
      // 单例模式：从 PanelSingletonManager 获取缓存
      // ⭐ 修复：使用 effectiveRegistrationKey 而不是 effectivePanelName
      savedStateWithConfig = globalPanelSingletonManager.getPanelState(this.effectiveRegistrationKey);
    }

    let _configRestoredFromCache = false; // ⭐ 标记是否从缓存恢复了配置

    if (savedStateWithConfig && savedStateWithConfig.configList && savedStateWithConfig.configList.length > 0) {
      // 检查缓存是否过期（5分钟）
      const cacheAge = Date.now() - (savedStateWithConfig.timestamp || 0);
      // ⭐ 修复：移除 !shouldLazyLoad 条件
      // 理由：单例面板只在第一次挂载时执行 mounted，重新打开时不会再次执行
      // 如果启用延迟加载，缓存在 onLazyLoad 中恢复
      // 如果不启用延迟加载，应该在这里恢复缓存
      if (cacheAge < 5 * 60 * 1000) {
        console.log(`[${this.effectivePanelName}] 📦 从缓存恢复配置列表 (${savedStateWithConfig.configList.length} 条) ${isMultiInstance ? '(多实例)' : '(单例)'}`);
        this.configList = savedStateWithConfig.configList;
        _configRestoredFromCache = true; // ⭐ 标记已从缓存恢复
      } else {
        console.log(`[${this.effectivePanelName}] ⏭️ 缓存已过期，将重新加载`);
      }
    }

    this.initCesium(() => {
      if (!shouldLazyLoad) {
        // ⭐ 如果已经从缓存恢复了配置，就不需要重新加载
        if (_configRestoredFromCache) {
          console.log(`[${this.effectivePanelName}] ✅ 配置已从缓存恢复，跳过重新加载`);
          // 调用 onConfigLoaded 通知子类配置已加载完成
          this.onConfigLoaded();
        } else {
          console.log(`[${this.effectivePanelName}] Cesium 已就绪，开始加载配置`);
          this.loadConfig();
        }
      } else {
        console.log(`[${this.effectivePanelName}] Cesium 已就绪，等待延迟加载触发`);
      }
    });
  },

  beforeUnmount() {
    const cesiumObjects = this.getCesiumObjects();
    if (cesiumObjects) {
      // ⭐ 判断是单例还是多实例
      const isMultiInstance = this.panelInstanceId !== null;

      if (isMultiInstance) {
        // 多实例模式：每个实例独立缓存，使用 panelInstanceId 作为键
        if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__ && typeof window.__multiInstancePanelConfigManager__.savePanelInstanceCache === 'function') {
          window.__multiInstancePanelConfigManager__.savePanelInstanceCache(
            this.instanceId || 1,
            this.effectiveRegistrationKey,
            this.panelInstanceId,
            {
              cesiumObjects: cesiumObjects,
              configList: this.configList.map(item => ({
                id: item.id,
                name: item.name,
                url: item.url,
                loaded: false,
                loading: false
              })),
              timestamp: Date.now()
            }
          );
          console.log(`[${this.effectivePanelName}] 💾 多实例缓存已保存 (#${this.panelInstanceId})`);
        }
      } else {
        // 单例模式：使用 PanelSingletonManager
        globalPanelSingletonManager.savePanelState(this.effectiveRegistrationKey, {
          cesiumObjects: cesiumObjects,
          configList: this.configList.map(item => ({
            id: item.id,
            name: item.name,
            url: item.url,
            loaded: false,
            loading: false
          })),
          timestamp: Date.now()
        });
        console.log(`[${this.effectivePanelName}] 💾 单例缓存已保存 (configList: ${this.configList.length} 条)`);
      }
    }
  },

  computed: {
    /**
     * ⭐ 有效的面板名称（用于 PanelSingletonManager）
     * 对于多实例面板，使用 panelName_panelInstanceId 格式
     * 对于单例面板，直接使用 panelName
     */
    effectivePanelName() {
      if (this.panelInstanceId !== null) {
        return `${this.panelName}_${this.panelInstanceId}`;
      }
      return this.panelName;
    },
    /**
     * ⭐ 有效的注册键（用于 FunctionPanelUIBase）
     * 对于多实例面板，使用 registrationKey_panelInstanceId 格式
     * 对于单例面板，直接使用 registrationKey
     */
    effectiveRegistrationKey() {
      if (this.panelInstanceId !== null) {
        return `${this.registrationKey || this.panelName}_${this.panelInstanceId}`;
      }
      return this.registrationKey || this.panelName;
    },
    currentDirectoryFiles() {
      if (!this.currentServerDirectory) {
        return this.serverFiles;
      }

      return this.serverFiles.filter(file => {
        const filePath = file.filePath || file.path;
        if (!filePath) return false;

        const fileDir = filePath.includes('/')
          ? filePath.substring(0, filePath.lastIndexOf('/'))
          : '';

        if (fileDir === this.currentServerDirectory) return true;

        if (this.currentServerDirectory === '') {
          if (!filePath.includes('/')) return true;
          const firstSlash = filePath.indexOf('/');
          const secondSlash = filePath.indexOf('/', firstSlash + 1);
          if (secondSlash === -1) return false;
        }

        if (fileDir.startsWith(this.currentServerDirectory + '/')) {
          const firstSlash = fileDir.indexOf('/', this.currentServerDirectory.length + 1);
          return firstSlash === -1;
        }

        return false;
      });
    },

    currentSubdirectories() {
      const dirs = new Set();
      const currentDir = this.currentServerDirectory;

      this.serverFiles.forEach(file => {
        const filePath = file.filePath || file.path;
        if (!filePath) return;

        const fileDir = filePath.includes('/')
          ? filePath.substring(0, filePath.lastIndexOf('/'))
          : '';

        if (fileDir === currentDir) return;

        if (currentDir === '') {
          const firstSlash = filePath.indexOf('/');
          if (firstSlash !== -1) {
            const secondSlash = filePath.indexOf('/', firstSlash + 1);
            const dir = secondSlash === -1
              ? filePath.substring(firstSlash + 1)
              : filePath.substring(firstSlash + 1, secondSlash);
            dirs.add(dir);
          }
        } else {
          if (fileDir.startsWith(currentDir + '/')) {
            const remainingPath = fileDir.substring(currentDir.length + 1);
            const firstSlash = remainingPath.indexOf('/');
            if (firstSlash === -1) {
              dirs.add(remainingPath);
            } else {
              dirs.add(remainingPath.substring(0, firstSlash));
            }
          }
        }
      });

      return Array.from(dirs).sort();
    },

    currentDirectoryDisplay() {
      if (!this.currentServerDirectory) return '根目录';
      return this.currentServerDirectory;
    },

    canGoBack() {
      return this.currentServerDirectory !== '';
    }
  },

  methods: {
    // ==================== 延迟加载 ====================

    /**
     * 获取面板配置（从 functionPanels.config.json）
     * @returns {Object|null} 面板配置
     */
    getPanelConfig() {
      if (typeof window !== 'undefined' && window.__functionPanelsConfig__) {
        return window.__functionPanelsConfig__.panels.find(
          p => p.name === this.effectivePanelName
        );
      }
      return null;
    },

    /**
     * 获取面板的延迟加载配置
     * @returns {boolean} 是否启用延迟加载
     */
    getConfigLazyLoad() {
      if (typeof window !== 'undefined' && window.__functionPanelsConfig__) {
        const config = window.__functionPanelsConfig__.panels.find(
          p => p.name === this.effectiveRegistrationKey
        );
        return config ? config.lazyLoad === true : false;
      }
      return false;
    },

    /**
     * 处理延迟加载触发
     * 当面板首次打开时调用
     */
    onLazyLoad(eventData) {
      console.log(`[${this.panelName}] ⚡ 延迟加载触发，首次打开面板`, eventData);

      // ⭐ 检查当前是否已经有配置列表（可能已经从 mounted 缓存恢复）
      console.log(`[${this.panelName}] 🔍 当前 configList 状态:`, {
        length: this.configList.length,
        isEmpty: this.configList.length === 0
      });

      // ⭐ 检查是否有保存的配置列表缓存（支持单例和多实例）
      const isMultiInstance = this.panelInstanceId !== null;
      let savedStateWithConfig = null;

      if (isMultiInstance) {
        // 多实例模式：从 MultiInstancePanelConfigManager 获取缓存
        if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__ && typeof window.__multiInstancePanelConfigManager__.getPanelInstanceCache === 'function') {
          savedStateWithConfig = window.__multiInstancePanelConfigManager__.getPanelInstanceCache(
            this.instanceId || 1,
            this.effectiveRegistrationKey,
            this.panelInstanceId
          );
        }
      } else {
        // 单例模式：从 PanelSingletonManager 获取缓存
        savedStateWithConfig = globalPanelSingletonManager.getPanelState(this.effectiveRegistrationKey);
      }

      console.log(`[${this.panelName}] 🔍 缓存状态:`, {
        hasCache: !!savedStateWithConfig,
        hasConfigList: !!(savedStateWithConfig && savedStateWithConfig.configList),
        configListLength: savedStateWithConfig?.configList?.length || 0,
        timestamp: savedStateWithConfig?.timestamp ? new Date(savedStateWithConfig.timestamp).toLocaleTimeString() : 'N/A',
        age: savedStateWithConfig?.timestamp ? `${Math.round((Date.now() - savedStateWithConfig.timestamp) / 1000)}秒` : 'N/A'
      });

      // 加载配置
      this.initCesium(() => {
        // 检查 Cesium 对象缓存
        const savedState = globalPanelSingletonManager.getPanelState(this.effectiveRegistrationKey);
        const hasCesiumObjects = savedState && savedState.cesiumObjects;

        if (hasCesiumObjects) {
          console.log(`[${this.effectivePanelName}] 📦 恢复保存的 Cesium 对象（延迟加载）`);
          this.restoreCesiumObjects(savedState.cesiumObjects);
        }

        // 检查配置列表缓存
        if (savedStateWithConfig && savedStateWithConfig.configList && savedStateWithConfig.configList.length > 0) {
          // 检查缓存是否过期（5分钟）
          const cacheAge = Date.now() - (savedStateWithConfig.timestamp || 0);
          if (cacheAge < 5 * 60 * 1000) {
            console.log(`[${this.panelName}] 📦 从缓存恢复配置列表 (${savedStateWithConfig.configList.length} 条) ${isMultiInstance ? '(多实例)' : '(单例)'}`);
            this.configList = savedStateWithConfig.configList;
            console.log(`[${this.panelName}] ✅ 配置已从缓存恢复，跳过重新加载`);
            console.log(`[${this.panelName}] ✅ 恢复后的 configList 长度:`, this.configList.length);
            this.onConfigLoaded();
            return;
          } else {
            console.log(`[${this.panelName}] ⏭️ 缓存已过期 (${Math.round(cacheAge / 1000)}秒)，将重新加载`);
          }
        } else {
          console.log(`[${this.panelName}] ⏭️ 没有有效缓存，将重新加载`);
        }

        console.log(`[${this.panelName}] Cesium 已就绪，开始延迟加载配置`);
        this.loadConfig();
      });
    },

    // ==================== 生命周期钩子（子类覆盖） ====================

    initCesium(callback) {
      console.warn(`[${this.panelName}] initCesium 未被子类实现`);
      if (callback) callback();
    },

    getCesiumObjects() {
      return null;
    },

    restoreCesiumObjects(cesiumObjects) {
      console.warn(`[${this.panelName}] restoreCesiumObjects 未被子类实现`);
    },

    onConfigLoaded() {
      console.log(`[${this.panelName}] ✅ 配置加载完成，共 ${this.configList.length} 条`);
    },

    onConfigSaved() {
      console.log(`[${this.panelName}] ✅ 配置保存完成`);
    },

    onConfigDeleted() {
      console.log(`[${this.panelName}] ✅ 配置删除完成`);
    },

    /**
     * 清理组件状态
     * ⭐ 在单例模式面板关闭时调用，重置所有对话框状态
     */
    cleanup() {
      console.log(`[${this.panelName}] 🧹 清理组件状态（对话框等）`);

      // 重置所有对话框状态
      this.showAddDialog = false;
      this.showEditDialog = false;
      this.showDeleteDialog = false;
      this.showImportDialog = false;

      // 重置表单数据
      this.resetForm();
      this.editingItem = null;
      this.deleteTarget = null;

      // 重置服务器文件浏览状态
      this.selectedServerFile = null;
    },

    // ==================== UI 辅助方法（子类覆盖） ====================

    /**
     * 获取列表项的 CSS 类
     */
    getItemClass(item) {
      return {};
    },

    /**
     * 获取列表项显示名称
     */
    getItemDisplayName(item) {
      return item.name || item.id || '未命名';
    },

    /**
     * 获取列表项详情文本
     */
    getItemDetailText(item) {
      if (item.url) return item.url;
      const keys = Object.keys(item).filter(k => !['id', 'name', 'url'].includes(k));
      if (keys.length > 0) return item[keys[0]];
      return '';
    },

    // ==================== 配置 CRUD ====================

    async loadConfig() {
      try {
        console.log(`[${this.panelName}] 📂 开始加载配置: ${this.configId}`);

        let data = null;

        try {
          data = await dataManager.loadFromServer(this.configId);
          console.log(`[${this.panelName}] ✅ 从 API 加载成功`);
        } catch (apiError) {
          console.warn(`[${this.panelName}] ⚠️ API 加载失败:`, apiError.message);

          const config = dataManager.getConfigDefinition(this.configId);
          if (config) {
            const response = await fetch(dataManager.getDataURL(config.relativePath), {
              cache: 'no-cache'
            });

            if (response.ok) {
              data = await response.json();
              console.log(`[${this.panelName}] ✅ 从静态文件加载成功`);
            }
          }
        }

        if (!data) {
          console.warn(`[${this.panelName}] ⚠️ 无法加载配置`);
          this.configList = [];
          return;
        }

        const validation = dataManager.validateConfig(this.configId, data);
        if (!validation.valid) {
          console.error(`[${this.panelName}] ❌ 数据验证失败:`, validation.errors);
          this.configList = [];
          return;
        }

        this.configList = this.processLoadedData(data);

        console.log(`[${this.panelName}] 📦 共加载 ${this.configList.length} 条`);
        this.onConfigLoaded();
      } catch (error) {
        console.error(`[${this.panelName}] ❌ 加载失败:`, error);
        this.configList = [];
      }
    },

    processLoadedData(data) {
      return data.map(item => ({ ...item }));
    },

    async refreshConfig(forceRefresh = true) {
      if (forceRefresh) {
        console.log(`[${this.panelName}] 🔄 强制刷新配置 (绕过缓存)`);
        // 清除本地缓存
        this.configList = [];

        // 根据模式清除对应的缓存
        const isMultiInstance = this.panelInstanceId !== null;
        if (isMultiInstance) {
          // 多实例模式：清除 MultiInstancePanelConfigManager 中的缓存
          if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__ && typeof window.__multiInstancePanelConfigManager__.clearPanelInstanceCache === 'function') {
            window.__multiInstancePanelConfigManager__.clearPanelInstanceCache(
              this.instanceId || 1,
              this.effectiveRegistrationKey,
              this.panelInstanceId
            );
            console.log(`[${this.panelName}] 🗑️ 多实例缓存已清除 (#${this.panelInstanceId})`);
          }
        } else {
          // 单例模式：清除 PanelSingletonManager 中的缓存
          globalPanelSingletonManager.savePanelState(this.effectiveRegistrationKey, {
            cesiumObjects: { cesiumTilesets: new Map(), cesiumTransforms: new Map(), cesiumHeightOffsets: new Map() },
            configList: [],
            timestamp: 0
          });
          console.log(`[${this.panelName}] 🗑️ 单例缓存已清除`);
        }
      } else {
        console.log(`[${this.panelName}] 🔄 正常刷新配置`);
      }
      await this.loadConfig();
    },

    async saveConfig() {
      try {
        const saveData = this.configList.map(item => this.extractSaveData(item));

        const validation = dataManager.validateConfig(this.configId, saveData);
        if (!validation.valid) {
          console.error(`[${this.panelName}] ❌ 数据验证失败:`, validation.errors);
          alert(`数据验证失败:\n${validation.errors.join('\n')}`);
          return false;
        }

        const result = await dataManager.uploadToServer(this.configId, saveData);

        if (result.success) {
          console.log(`[${this.panelName}] ✅ 配置已保存`);
          this.onConfigSaved();
          return true;
        } else {
          console.error(`[${this.panelName}] ❌ 保存失败:`, result.error);
          alert(`保存失败！\n错误：${result.error}`);
          return false;
        }
      } catch (error) {
        console.error(`[${this.panelName}] ❌ 保存错误:`, error);
        alert(`保存失败！\n错误：${error.message}`);
        return false;
      }
    },

    extractSaveData(item) {
      const saveItem = {};
      this.fieldDefinitions.forEach(field => {
        if (item[field.key] !== undefined) {
          saveItem[field.key] = item[field.key];
        }
      });
      return saveItem;
    },

    openAddDialog() {
      this.showAddDialog = true;
      this.resetForm();
    },

    openEditDialog(item) {
      this.showEditDialog = true;
      this.editingItem = item;

      this.fieldDefinitions.forEach(field => {
        this.formData[field.key] = item[field.key];
      });
    },

    closeDialog() {
      this.showAddDialog = false;
      this.showEditDialog = false;
      this.resetForm();
      this.editingItem = null;
    },

    resetForm() {
      this.formData = { ...this.defaultFormValues };
      this.fieldDefinitions.forEach(field => {
        if (field.key && !this.formData[field.key]) {
          this.formData[field.key] = '';
        }
      });
    },

    validateForm() {
      for (const field of this.fieldDefinitions) {
        if (field.required && !this.formData[field.key]) {
          alert(`请填写${field.label}`);
          return false;
        }
      }

      if (this.showEditDialog && this.editingItem) {
        const existing = this.configList.find(item =>
          item[this.itemKeyField] === this.formData[this.itemKeyField] &&
          item[this.itemKeyField] !== this.editingItem[this.itemKeyField]
        );
        if (existing) {
          alert(`${this.itemKeyField} 已存在`);
          return false;
        }
      } else if (this.showAddDialog) {
        const existing = this.configList.find(item =>
          item[this.itemKeyField] === this.formData[this.itemKeyField]
        );
        if (existing) {
          alert(`${this.itemKeyField} 已存在`);
          return false;
        }
      }

      return true;
    },

    async submitForm() {
      if (!this.validateForm()) return;

      if (this.showEditDialog && this.editingItem) {
        const index = this.configList.findIndex(item =>
          item[this.itemKeyField] === this.editingItem[this.itemKeyField]
        );

        if (index !== -1) {
          const updatedItem = { ...this.configList[index] };
          this.fieldDefinitions.forEach(field => {
            updatedItem[field.key] = this.formData[field.key];
          });

          const processedItem = this.beforeUpdateItem(updatedItem);
          this.configList.splice(index, 1, processedItem);

          if (await this.saveConfig()) {
            this.closeDialog();
          }
        }
      } else {
        const newItem = {};
        this.fieldDefinitions.forEach(field => {
          newItem[field.key] = this.formData[field.key];
        });

        const processedItem = this.beforeAddItem(newItem);
        this.configList.push(processedItem);

        if (await this.saveConfig()) {
          this.closeDialog();
        }
      }
    },

    beforeAddItem(item) {
      return item;
    },

    beforeUpdateItem(item) {
      return item;
    },

    confirmDelete(item) {
      this.deleteTarget = item;
      this.showDeleteDialog = true;
    },

    async executeDelete() {
      if (!this.deleteTarget) return;

      const index = this.configList.findIndex(item =>
        item[this.itemKeyField] === this.deleteTarget[this.itemKeyField]
      );

      if (index !== -1) {
        const itemToDelete = this.configList[index];
        this.beforeDeleteItem(itemToDelete);

        this.configList.splice(index, 1);

        if (await this.saveConfig()) {
          this.onConfigDeleted();
        }
      }

      this.showDeleteDialog = false;
      this.deleteTarget = null;
    },

    beforeDeleteItem(item) {
      // 子类覆盖
    },

    // ==================== 导入/导出 ====================

    async openImportDialog() {
      console.log(`[${this.panelName}] 📂 打开导入对话框`);
      this.showImportDialog = true;
      await this.loadServerFiles();
    },

    closeImportDialog() {
      this.showImportDialog = false;
      this.selectedServerFile = null;
    },

    async importConfig() {
      if (!this.selectedServerFile) {
        alert('请选择要导入的文件');
        return;
      }

      const file = this.selectedServerFile;
      const fileName = file.fileName || file.name;
      const filePath = file.filePath || file.path;

      const confirmMsg = `确认要从服务器导入配置？\n\n文件：${fileName}\n\n注意：这将替换当前所有配置！`;

      if (!confirm(confirmMsg)) {
        return;
      }

      try {
        const data = await dataManager.loadFromServerByPath(filePath);

        if (!data) {
          alert(`加载文件失败！`);
          return;
        }

        const validation = dataManager.validateConfig(this.configId, data);
        if (!validation.valid) {
          alert(`数据验证失败:\n${validation.errors.join('\n')}`);
          return;
        }

        this.configList = this.processLoadedData(data);

        console.log(`[${this.panelName}] ✅ 导入成功，共 ${this.configList.length} 条`);

        this.closeImportDialog();

        alert(`配置已成功导入！\n共导入 ${this.configList.length} 条配置。`);
      } catch (error) {
        console.error(`[${this.panelName}] ❌ 导入失败:`, error);
        alert(`导入失败！\n错误：${error.message}`);
      }
    },

    async exportConfig() {
      console.log(`[${this.panelName}] 📤 准备导出配置`);

      const saveData = this.configList.map(item => this.extractSaveData(item));

      const validation = dataManager.validateConfig(this.configId, saveData);
      if (!validation.valid) {
        console.error(`[${this.panelName}] ❌ 数据验证失败:`, validation.errors);
        alert(`数据验证失败:\n${validation.errors.join('\n')}`);
        return false;
      }

      const result = await dataManager.uploadToServer(this.configId, saveData);

      if (result.success) {
        console.log(`[${this.panelName}] ✅ 配置已导出`);
        alert(`配置已成功导出到服务器！`);
      } else {
        console.error(`[${this.panelName}] ❌ 导出失败:`, result.error);
        alert(`导出失败！\n错误：${result.error}`);
      }

      return result.success;
    },

    // ==================== 服务器文件浏览 ====================

    async loadServerFiles() {
      try {
        this.loadingServerFiles = true;
        console.log(`[${this.panelName}] 📂 加载服务器文件列表`);

        const files = await dataManager.listServerFiles();

        this.serverFiles = files;
        this.allFilesMap.clear();

        files.forEach(file => {
          this.allFilesMap.set(file.filePath, file);
        });

        console.log(`[${this.panelName}] ✅ 加载了 ${files.length} 个文件`);
      } catch (error) {
        console.error(`[${this.panelName}] ❌ 加载文件失败:`, error);
        alert(`加载服务器文件失败！\n错误：${error.message}`);
      } finally {
        this.loadingServerFiles = false;
      }
    },

    navigateToDirectory(dirName) {
      const newDir = this.currentServerDirectory
        ? `${this.currentServerDirectory}/${dirName}`
        : dirName;
      this.currentServerDirectory = newDir;
      console.log(`[${this.panelName}] 📂 进入目录: ${this.currentDirectoryDisplay}`);
    },

    navigateToParentDirectory() {
      if (!this.currentServerDirectory) return;

      const lastSlash = this.currentServerDirectory.lastIndexOf('/');
      if (lastSlash !== -1) {
        this.currentServerDirectory = this.currentServerDirectory.substring(0, lastSlash);
      } else {
        this.currentServerDirectory = '';
      }

      console.log(`[${this.panelName}] 📂 返回上级: ${this.currentDirectoryDisplay}`);
    },

    navigateToRoot() {
      this.currentServerDirectory = '';
      console.log(`[${this.panelName}] 📂 返回根目录`);
    },

    selectFile(file) {
      this.selectedServerFile = file;
      console.log(`[${this.panelName}] 📄 选择文件:`, file.fileName);
    },

    formatDate(date) {
      if (!date) return '未知';
      const d = new Date(date);
      if (isNaN(d.getTime())) return '无效日期';
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getConfigStats() {
      const config = dataManager.getConfigDefinition(this.configId);
      if (!config) return null;
      return dataManager.getConfigStats(this.configId, this.configList);
    },

    // ==================== 事件处理 ====================

    handleClose() {
      console.log(`[${this.panelName}] 面板关闭`);

      // ⭐ 单例模式：在关闭时保存缓存（因为 beforeUnmount 不会被调用）
      const isMultiInstance = this.panelInstanceId !== null;
      console.log(`[${this.panelName}] 🔍 面板模式检查:`, {
        isMultiInstance: isMultiInstance,
        panelInstanceId: this.panelInstanceId,
        effectiveRegistrationKey: this.effectiveRegistrationKey,
        currentConfigListLength: this.configList.length
      });

      if (!isMultiInstance) {
        const cesiumObjects = this.getCesiumObjects();
        console.log(`[${this.panelName}] 🔍 Cesium 对象检查:`, {
          hasCesiumObjects: !!cesiumObjects
        });

        if (cesiumObjects) {
          // 单例模式：使用 PanelSingletonManager
          globalPanelSingletonManager.savePanelState(this.effectiveRegistrationKey, {
            cesiumObjects: cesiumObjects,
            configList: this.configList.map(item => ({
              id: item.id,
              name: item.name,
              url: item.url,
              loaded: false,
              loading: false
            })),
            timestamp: Date.now()
          });
          console.log(`[${this.panelName}] 💾 单例缓存已保存（关闭时）(configList: ${this.configList.length} 条, key: ${this.effectiveRegistrationKey})`);

          // 验证缓存是否正确保存
          const verifyState = globalPanelSingletonManager.getPanelState(this.effectiveRegistrationKey);
          console.log(`[${this.panelName}] 🔍 缓存验证:`, {
                hasState: !!verifyState,
                hasConfigList: !!(verifyState && verifyState.configList),
                configListLength: verifyState?.configList?.length || 0,
                timestamp: verifyState?.timestamp ? new Date(verifyState.timestamp).toLocaleTimeString() : 'N/A'
          });
        } else {
          console.warn(`[${this.panelName}] ⚠️ 没有 Cesium 对象，跳过缓存保存`);
        }

        // ⭐ 关键修复：重置父组件的 _contentLoaded 标志，以便下次打开时能重新触发延迟加载
        if (this.$refs.basePanel && this.$refs.basePanel._contentLoaded !== undefined) {
          const oldState = this.$refs.basePanel._contentLoaded;
          this.$refs.basePanel._contentLoaded = false;
          console.log(`[${this.panelName}] 🔄 重置 _contentLoaded 标志: ${oldState} -> false`);
        }
      } else {
        console.log(`[${this.panelName}] ℹ️ 多实例模式，跳过单例缓存保存`);
      }

      // ⭐ 不要重复触发 close 事件，因为父类 FunctionPanelUIBase 已经处理了
      // 这里只需要清理组件状态即可
      this.cleanup();

      if (typeof window !== 'undefined') {
        const event = new CustomEvent(this.closeEventName, {
          detail: { panelName: this.panelName }
        });
        window.dispatchEvent(event);
      }
    },

    handleMinimize() {
      console.log(`[${this.panelName}] 面板最小化`);
    },

    handleExpand() {
      console.log(`[${this.panelName}] 面板展开`);
    }
  }
};
</script>

<style scoped>
/* ==================== 工具栏 ==================== */
.toolbar {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-wrap: wrap;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.tool-btn svg {
  width: 16px;
  height: 16px;
}

/* ==================== 配置列表 ==================== */
.config-list {
  padding: 8px;
  max-height: calc(70vh - 120px);
  overflow-y: auto;
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.2s;
}

.config-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.item-main {
  flex: 1;
  min-width: 0;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: #e0e0e0;
}

.item-detail {
  font-size: 12px;
  color: #a0a0a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

/* 定位按钮样式 */
.action-btn.locate-btn:hover {
  background: rgba(33, 150, 243, 0.2);
  border-color: rgba(33, 150, 243, 0.4);
  color: #2196F3;
}

/* 高度调整按钮样式 */
.action-btn.height-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

/* 编辑按钮样式 */
.action-btn.edit-btn:hover {
  background: rgba(255, 193, 7, 0.2);
  border-color: rgba(255, 193, 7, 0.4);
  color: #FFC107;
}

/* 删除按钮样式 */
.action-btn.delete-btn:hover {
  background: rgba(255, 107, 107, 0.2);
  border-color: rgba(255, 107, 107, 0.4);
  color: #ff6b6b;
}

/* ==================== 对话框 ==================== */
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
  /* ⭐ 确保对话框在面板之上（面板 z-index: 100000） */
  z-index: 200001;
}

.dialog {
  background: #2a2a2a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-large {
  max-width: 700px;
}

.dialog-small {
  max-width: 400px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
  color: #e0e0e0;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #a0a0a0;
  font-size: 24px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

/* ==================== 表单 ==================== */
.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-size: 14px;
  color: #e0e0e0;
  font-weight: 500;
}

.form-field label.required::after {
  content: ' *';
  color: #ff6b6b;
}

.form-field input,
.form-field textarea,
.form-field select {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  transition: all 0.2s;
}

.form-field input:focus,
.form-field textarea:focus,
.form-field select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.08);
}

.form-field textarea {
  resize: vertical;
  min-height: 80px;
}

/* ==================== 按钮 ==================== */
.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.confirm-btn {
  background: #4CAF50;
  border-color: #4CAF50;
  color: white;
}

.confirm-btn:hover {
  background: #45a049;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.confirm-btn:disabled {
  background: #3a3a3a;
  border-color: #3a3a3a;
  color: #666;
  cursor: not-allowed;
  box-shadow: none;
}

.danger-btn {
  background: #ff6b6b;
  border-color: #ff6b6b;
  color: white;
}

.danger-btn:hover {
  background: #ff5252;
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

/* ==================== 删除警告 ==================== */
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
}

.warning-text {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
  line-height: 1.5;
}

/* ==================== 文件浏览器 ==================== */
.file-browser {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.directory-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.current-dir {
  font-size: 14px;
  color: #a0a0a0;
}

.subdirectories,
.files {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-text {
  color: #4CAF50;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.file-item.selected {
  background: rgba(76, 175, 80, 0.15);
  border-color: rgba(76, 175, 80, 0.4);
}

.directory-item {
  background: rgba(100, 150, 255, 0.08);
}

.directory-item:hover {
  background: rgba(100, 150, 255, 0.15);
}

.file-icon {
  width: 20px;
  height: 20px;
  color: #4CAF50;
  flex-shrink: 0;
}

.directory-item .file-icon {
  color: #6496FF;
}

.file-name {
  flex: 1;
  font-size: 14px;
  color: #e0e0e0;
}

.file-size {
  font-size: 12px;
  color: #a0a0a0;
}

.arrow-icon {
  width: 16px;
  height: 16px;
  color: #a0a0a0;
}

.empty-message {
  padding: 24px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

/* ==================== 过渡动画 ==================== */
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

/* ==================== 滚动条样式 ==================== */
.config-list::-webkit-scrollbar,
.dialog-body::-webkit-scrollbar {
  width: 8px;
}

.config-list::-webkit-scrollbar-track,
.dialog-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.config-list::-webkit-scrollbar-thumb,
.dialog-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.config-list::-webkit-scrollbar-thumb:hover,
.dialog-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
