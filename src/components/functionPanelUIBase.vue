<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div
        v-if="!isClosed"
        class="function-panel"
        :class="{
          'is-dragging': isDragging,
          'is-minimized': isMinimized,
          'blur-enabled': enableBackdropFilter && enableBlur
        }"
        :style="panelStyles"
        ref="panelRef"
        @mousedown="onPanelMouseDown"
      >
        <!-- 面板头部 -->
        <div class="panel-header" @mousedown="onHeaderMouseDown">
          <div class="header-left">
            <div class="drag-indicator">
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
              <span class="grip-dot"></span>
            </div>
            <slot name="header">
              <h3 class="panel-title">{{ title }}</h3>
            </slot>
          </div>
          <div class="header-controls">
            <button
              v-if="allowMinimize"
              @click.stop="toggleMinimize"
              class="icon-btn minimize-btn"
              type="button"
              :aria-label="isMinimized ? '展开' : '最小化'"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path v-if="!isMinimized" d="M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path v-else d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button
              @click.stop="close"
              class="icon-btn close-btn"
              type="button"
              :aria-label="closeTooltip"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 面板内容 -->
        <Transition name="content-slide">
          <div v-show="!isMinimized" class="panel-body" :style="bodyStyles">
            <slot :is-closed="isClosed" :panel-instance-id="panelInstanceId" :is-singleton="isSingletonByConfig"></slot>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- 最小化时的浮动按钮 -->
    <Transition name="fab-fade">
      <button
        v-if="!isClosed && isMinimized"
        class="panel-fab"
        type="button"
        :style="fabStyles"
        @click="toggleMinimize"
        :title="title"
      >
        <span class="fab-icon">{{ titleIcon || '⚙️' }}</span>
        <span class="fab-text">{{ title }}</span>
      </button>
    </Transition>
  </Teleport>
</template>

<script>
import SfcBase from './SfcBase.vue';
import { panelSingletonManager } from './utils/PanelSingletonManager.js';

// 导入注册相关的工具（可选，如果子组件需要全局注册）
// import { getRegistry, createRegistrationMixin } from '../utils/ComponentRegistry.js';

export default {
  name: 'FunctionPanelUIBase',
  mixins: [SfcBase],
  inject: {
    // 父组件提供的注册方法（可选）
    registerPanelComponent: {
      type: Function,
      default: null
    },
    unregisterPanelComponent: {
      type: Function,
      default: null
    },
    // 父组件提供的获取已注册面板的方法（可选）
    getRegisteredPanels: {
      type: Function,
      default: null
    },
    // ⭐ 父组件提供的设置面板可见性的方法（可选）
    setPanelVisible: {
      type: Function,
      default: null
    },
    // ⭐ 获取当前实例ID的函数（多实例支持）
    getInstanceId: {
      type: Function,
      default: () => 1
    },
    // ==================== 多实例面板管理 ====================
    // ⭐ 多实例面板管理器（可选）
    multiInstanceManager: {
      type: Object,
      default: null
    },
    // ⭐ 注册面板实例的方法（可选）
    registerPanelInstance: {
      type: Function,
      default: null
    },
    // ⭐ 注销面板实例的方法（可选）
    unregisterPanelInstance: {
      type: Function,
      default: null
    },
    // ⭐ 设置面板实例可见性的方法（可选）
    setPanelInstanceVisible: {
      type: Function,
      default: null
    }
  },
  props: {
    // 自注册配置
    autoRegister: { type: Boolean, default: false },
    registrationKey: { type: String, default: null },
    // ⭐ 面板实例ID（多实例面板使用）
    panelInstanceId: { type: Number, default: null },
    title: { type: String, default: '面板' },
    titleIcon: { type: String, default: '⚙️' },
    closeTooltip: { type: String, default: '关闭 (ESC)' },
    width: { type: Number, default: 360 },
    height: { type: [Number, String], default: 'auto' },
    maxHeight: { type: [Number, String], default: '70vh' },
    initialX: { type: [Number, String], default: 'center' },
    initialY: { type: Number, default: 80 },
    bodyPadding: { type: String, default: '20px' },
    allowMinimize: { type: Boolean, default: true },
    closeEventName: { type: String, default: 'functionPanelClose' },
    // 性能优化相关配置
    enableBlur: { type: Boolean, default: false }, // 默认禁用模糊效果
    blurAmount: { type: String, default: '8px' }, // 降低默认模糊值
    enableBackdropFilter: { type: Boolean, default: false }, // 是否启用 backdrop-filter（性能敏感）
    // ⭐ 延迟加载配置：是否在面板第一次打开时才加载内容
    lazyLoad: { type: Boolean, default: false }
  },
  data() {
    return {
      componentName: 'FunctionPanelUIBase',
      // 自注册状态
      _registryRegistered: false,
      // 位置状态 - 使用响应式数字
      x: 0,
      y: 0,
      // 拖动状态
      isDragging: false,
      dragOffsetX: 0,
      dragOffsetY: 0,
      // 面板状态
      isMinimized: false,
      isClosed: true,  // 默认关闭，只有当配置 visible: true 时才打开
      // ⭐ 延迟加载状态：标记内容是否已加载
      _contentLoaded: false,
      // 事件处理器引用
      boundMouseMove: null,
      boundMouseUp: null,
      // 性能优化：缓存面板尺寸
      cachedPanelWidth: null,
      cachedPanelHeight: null
    };
  },
  computed: {
    /**
     * ⭐ 有效的 registrationKey
     * 如果传递了 registrationKey 就使用它，否则使用 componentName
     * 这样子类可以不传递 registrationKey，自动使用组件名称
     */
    effectiveRegistrationKey() {
      return this.registrationKey || this.componentName;
    },
    /**
     * ⭐ 基于配置文件的单例/多实例判断
     * 从 functionPanels.config.json 中读取 singleton 配置
     * 这是唯一的真实来源，确保运行时行为与配置一致
     */
    isSingletonByConfig() {
      // 尝试从全局配置获取
      if (typeof window !== 'undefined' && window.__functionPanelsConfig__) {
        const config = window.__functionPanelsConfig__.panels.find(
          p => p.name === this.effectiveRegistrationKey
        );
        // 如果找到配置，使用配置中的 singleton 值
        // 如果没找到配置，默认为 true（单例模式）
        return config ? config.singleton !== false : true;
      }
      // 如果没有全局配置，回退到运行时判断
      return this.panelInstanceId === null || this.panelInstanceId === undefined;
    },
    panelStyles() {
      const styles = {
        width: typeof this.width === 'number' ? `${this.width}px` : this.width,
        height: typeof this.height === 'number' ? `${this.height}px` : this.height,
        maxHeight: typeof this.maxHeight === 'number' ? `${this.maxHeight}px` : this.maxHeight,
        transform: `translate(${this.x}px, ${this.y}px)`,
        transition: this.isDragging ? 'none' : 'transform 0.2s ease-out, opacity 0.3s ease'
      };

      // 只在调试模式下输出日志（避免过多日志）
      if (this.panelInstanceId === 1 || this.panelInstanceId === 2) {
        console.log(`[FunctionPanelUIBase] 🎨 面板样式: ${this.effectiveRegistrationKey} #${this.panelInstanceId || 'singleton'}`, {
          ...styles,
          isClosed: this.isClosed,
          x: this.x,
          y: this.y
        });
      }

      return styles;
    },
    bodyStyles() {
      return {
        padding: this.bodyPadding
      };
    },
    fabStyles() {
      return {
        transform: `translate(${this.x + this.width / 2 - 40}px, ${this.y}px)`
      };
    }
  },
  mounted() {
    // 🔍 调试：打印所有接收到的 props
    console.log(`[FunctionPanelUIBase] 🔍 接收到的 props:`, {
      panelName: this.componentName || this.effectiveRegistrationKey,
      所有Props: {
        autoRegister: this.autoRegister,
        registrationKey: this.registrationKey,
        panelInstanceId: this.panelInstanceId,
        componentName: this.componentName,
        title: this.title,
        initialX: this.initialX,
        initialY: this.initialY,
        registrationKey_value: this.registrationKey,
        effectiveRegistrationKey: this.effectiveRegistrationKey
      }
    });

    // 自注册逻辑 - 检查是否已注册，避免重复注册
    // 使用 effectiveRegistrationKey，因为即使没有传递 registrationKey，也可以使用 componentName
    if (this.autoRegister && this.effectiveRegistrationKey && !this._registryRegistered) {
      this.registerToParent();
    }

    // ⭐ 判断是否为多实例面板
    const isMultiInstance = this.panelInstanceId !== null;

    console.log(`[FunctionPanelUIBase] 🔍 多实例面板检查:`, {
      panelName: this.effectiveRegistrationKey,
      panelInstanceId: this.panelInstanceId,
      isMultiInstance: isMultiInstance,
      typeofPanelInstanceId: typeof this.panelInstanceId
    });

    // ⭐ 从 PanelSingletonManager 同步 isClosed 状态（仅限单例面板）
    // 多实例面板不应该从 PanelSingletonManager 同步状态，因为它们由 MultiInstancePanelConfigManager 管理
    if (!isMultiInstance) {
      const panelName = this.effectiveRegistrationKey;
      if (panelSingletonManager.hasPanel(panelName)) {
        const panel = panelSingletonManager.getPanel(panelName);
        if (panel) {
          const oldIsClosed = this.isClosed;
          this.isClosed = panel.isClosed;
          console.log(`[FunctionPanelUIBase] 🔓 从 PanelSingletonManager 同步面板状态: ${panelName}, isClosed: ${oldIsClosed} -> ${this.isClosed}`);
        }
      }
    } else {
      // ⭐ 多实例面板：默认显示（因为它们被创建时就是可见的）
      const oldIsClosed = this.isClosed;
      this.isClosed = false;
      console.log(`[FunctionPanelUIBase] ✅ 多实例面板默认显示: ${this.effectiveRegistrationKey} #${this.panelInstanceId}, isClosed: ${oldIsClosed} -> ${this.isClosed}`);
    }

    // ⭐ 添加事件监听器，监听 PanelSingletonManager 中的状态变化
    // （单例面板组件不会被销毁，需要持续同步状态）
    // 多实例面板不需要监听 PanelSingletonManager 事件
    if (!isMultiInstance) {
      this._panelStateChangeListener = (eventData) => {
        // ⭐ 检查事件是否针对当前面板实例
        // 优先匹配 registrationKey（如果有），其次匹配 componentName
        const targetPanelName = this.effectiveRegistrationKey;
        if (eventData.panelName !== targetPanelName) {
          return; // 不是当前面板的事件，忽略
        }
        console.log(`[FunctionPanelUIBase] 🔔 监听到 PanelSingletonManager 事件: ${targetPanelName}`, eventData);
        if (eventData.type === 'visibleChange') {
          // ⭐ 强制更新 isClosed 状态，不进行条件检查
          const oldIsClosed = this.isClosed;
          this.isClosed = eventData.isClosed;
          console.log(`[FunctionPanelUIBase] 🔄 更新 isClosed 状态: ${oldIsClosed} -> ${this.isClosed}`);
          console.log(`[FunctionPanelUIBase] 🔍 延迟加载检查: oldIsClosed=${oldIsClosed}, !this.isClosed=${!this.isClosed}, this.lazyLoad=${this.lazyLoad}, !this._contentLoaded=${!this._contentLoaded}`);

          // ⭐ 如果面板从关闭变为打开，强制 Vue 更新
          if (oldIsClosed && !this.isClosed) {
            this.$forceUpdate();
            console.log(`[FunctionPanelUIBase] ✅ 强制重新渲染面板: ${targetPanelName}`);

            // ⭐ 延迟加载：如果启用了延迟加载且内容未加载，触发内容加载
            if (this.lazyLoad && !this._contentLoaded) {
              console.log(`[FunctionPanelUIBase] ⚡ 触发延迟加载: ${targetPanelName}`);
              this._contentLoaded = true;
              // 通知子组件加载内容
              this.$nextTick(() => {
                console.log(`[FunctionPanelUIBase] 📤 发送 lazy-load 事件`);
                this.$emit('lazy-load', { firstOpen: true });
              });
            } else {
              console.log(`[FunctionPanelUIBase] ⏭️ 跳过延迟加载: lazyLoad=${this.lazyLoad}, _contentLoaded=${this._contentLoaded}`);
            }
          } else {
            console.log(`[FunctionPanelUIBase] ⏭️ 不触发延迟加载: 状态不是从关闭变为打开`);
          }
        }
      };
      panelSingletonManager.addEventListener(this.effectiveRegistrationKey, this._panelStateChangeListener);
    }

    // ⭐ 检查面板初始状态是否为打开（处理面板在组件挂载前就被设置为可见的情况）
    if (!this.isClosed && this.lazyLoad && !this._contentLoaded) {
      console.log(`[FunctionPanelUIBase] 🔍 面板初始状态为打开，触发延迟加载: ${this.effectiveRegistrationKey}`);
      this._contentLoaded = true;
      this.$nextTick(() => {
        console.log(`[FunctionPanelUIBase] 📤 发送 lazy-load 事件（初始状态）`);
        this.$emit('lazy-load', { firstOpen: true });
      });
    }

    this.initCesium(() => {
      this.$nextTick(() => {
        this.initPosition();
      });
    });

    // ESC 键关闭
    this.boundHandleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.boundHandleKeydown);
  },
  beforeUnmount() {
    // 自注销逻辑
    if (this.autoRegister && this.effectiveRegistrationKey) {
      this.unregisterFromParent();
    }

    // 清理事件监听
    if (this.boundMouseMove) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundHandleMouseUp);
    }
    if (this.boundHandleKeydown) {
      document.removeEventListener('keydown', this.boundHandleKeydown);
    }

    // ⭐ 移除 PanelSingletonManager 事件监听器（仅限单例面板）
    // 多实例面板不需要监听 PanelSingletonManager 事件
    const isMultiInstance = this.panelInstanceId !== null;
    if (!isMultiInstance && this._panelStateChangeListener) {
      panelSingletonManager.removeEventListener(this.effectiveRegistrationKey, this._panelStateChangeListener);
    }

    this.cleanup();
  },
  methods: {
    /**
     * 获取实例特定的配置
     * @returns {Object|null} 实例配置
     */
    getInstanceConfig() {
      // ⭐ 判断是单例面板还是多实例面板
      const isMultiInstance = this.panelInstanceId !== null;

      if (isMultiInstance) {
        // 多实例面板：从 MultiInstancePanelConfigManager 获取实例配置
        if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__) {
          return window.__multiInstancePanelConfigManager__.getPanelConfig(
            this.instanceId,
            this.registrationKey
          );
        }
      } else {
        // 单例面板：从 FunctionPanelsConfigManager 获取面板配置
        if (typeof window !== 'undefined' && window.__functionPanelsConfigManager__) {
          return window.__functionPanelsConfigManager__.getPanel(this.effectiveRegistrationKey);
        }
      }
      return null;
    },

    /**
     * 注册到父组件（自注册方法）
     */
    registerToParent() {
      if (!this.effectiveRegistrationKey) {
        console.warn('[FunctionPanelUIBase] 缺少 registrationKey 和 componentName，无法自动注册');
        return;
      }

      // ⭐ 判断是单例面板还是多实例面板
      // 复用现有逻辑：panelInstanceId !== null 表示多实例面板
      const isMultiInstance = this.panelInstanceId !== null;

      // ⭐ 多实例面板：使用 inject 提供的 registerPanelInstance 方法
      if (isMultiInstance && this.registerPanelInstance && typeof this.registerPanelInstance === 'function') {
        // ⭐ 检查是否已经存在于 MultiInstancePanelConfigManager（防止覆盖手动创建的实例）
        if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__) {
          const instanceId = this.instanceId || 1;
          const existingInstance = window.__multiInstancePanelConfigManager__.getPanelInstance(
            instanceId,
            this.effectiveRegistrationKey,
            this.panelInstanceId
          );
          if (existingInstance) {
            console.log(`[FunctionPanelUIBase #${instanceId}] ${this.effectiveRegistrationKey} #${this.panelInstanceId} 实例已存在，跳过重复注册`);
            this._registryRegistered = true;
            return;
          }
        }

        const instanceConfig = this.getInstanceConfig();

        // 合并props：实例配置优先，然后是组件自身的props
        const mergedProps = {
          ...this.$props,
          ...(instanceConfig?.position || {})
        };

        this.registerPanelInstance(this.effectiveRegistrationKey, {
          component: this, // 多实例面板需要传递组件实例
          props: mergedProps,
          visible: true
        }, this.panelInstanceId);

        this._registryRegistered = true;
        console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.effectiveRegistrationKey} 多实例注册完成`);
        return;
      }

      // ⭐ 单例面板：使用 inject 提供的 registerPanelComponent 方法
      if (!isMultiInstance && this.registerPanelComponent && typeof this.registerPanelComponent === 'function') {
        // ⭐ 获取实例特定的配置
        const instanceConfig = this.getInstanceConfig();

        // 合并props：实例配置优先，然后是组件自身的props
        const mergedProps = {
          ...this.$props,
          ...(instanceConfig?.position || {})
        };

        // ⭐ 单例面板：不传递组件实例（组件已在预加载时加载）
        // ⭐ 关键修复：优先使用 PanelSingletonManager 中的状态（用户点击按钮时设置）
        let actualVisible = false;
        const panelSingletonManager = window.panelSingletonManager || window.__panelSingletonManager__;
        if (panelSingletonManager) {
          const existingPanel = panelSingletonManager.getPanel(this.effectiveRegistrationKey);
          console.log(`[FunctionPanelUIBase] 🔍 检查面板 ${this.effectiveRegistrationKey}:`, {
            existingPanel: existingPanel ? {
              visible: existingPanel.visible,
              isClosed: existingPanel.isClosed,
              _visibilityExplicitlySet: existingPanel._visibilityExplicitlySet
            } : null,
            instanceConfig: instanceConfig ? {
              visible: instanceConfig.visible
            } : null
          });

          // ⭐ 如果面板已存在且有明确的可见性设置（包括 false），使用管理器中的状态
          // 这确保了用户通过工具栏按钮设置的状态被正确保留
          if (existingPanel && existingPanel._visibilityExplicitlySet) {
            actualVisible = existingPanel.visible;
            console.log(`[FunctionPanelUIBase] 🎯 使用管理器中的可见性状态: ${actualVisible} (用户已设置)`);
          } else if (existingPanel && existingPanel.visible === true) {
            // 兼容旧逻辑：如果面板已显示，保持显示状态
            actualVisible = true;
            console.log(`[FunctionPanelUIBase] 🎯 保持现有的 visible: true`);
          } else {
            // 使用实例配置的可见性，如果没有则默认为false（默认关闭）
            actualVisible = instanceConfig ? (instanceConfig.visible !== false) : false;
            console.log(`[FunctionPanelUIBase] 📋 使用实例配置可见性: ${actualVisible}`);
          }
        } else {
          // 管理器不存在，使用实例配置
          actualVisible = instanceConfig ? (instanceConfig.visible !== false) : false;
          console.log(`[FunctionPanelUIBase] ⚠️ 管理器不存在，使用实例配置: ${actualVisible}`);
        }

        this.registerPanelComponent(this.effectiveRegistrationKey, {
          props: mergedProps,
          visible: actualVisible
        });
        this._registryRegistered = true;
        console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.effectiveRegistrationKey} 单例注册完成, visible: ${actualVisible}`);
        return;
      }

      // 方式2: 触发自定义事件，通知父组件
      const eventData = {
        key: this.effectiveRegistrationKey,
        props: this.$props
      };

      if (isMultiInstance) {
        // 多实例面板需要传递组件实例
        eventData.component = this;
      }

      this.$emit('register-panel', eventData);
      this._registryRegistered = true;
      console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.registrationKey} 已通过事件${isMultiInstance ? '（多实例）' : ''}注册`);
    },

    /**
     * 从父组件注销（自注销方法）
     */
    unregisterFromParent() {
      if (!this.effectiveRegistrationKey) return;

      // 方式1: 通过 inject 的注销方法（优先）
      if (this.unregisterPanelComponent && typeof this.unregisterPanelComponent === 'function') {
        this.unregisterPanelComponent(this.effectiveRegistrationKey);
        console.log(`[FunctionPanelUIBase] ${this.effectiveRegistrationKey} 已通过 inject 注销`);
        return;
      }

      // 方式2: 触发自定义事件，通知父组件
      this.$emit('unregister-panel', {
        key: this.effectiveRegistrationKey
      });
      console.log(`[FunctionPanelUIBase] ${this.effectiveRegistrationKey} 已通过事件注销`);
    },

    /**
     * 初始化面板位置
     */
    initPosition() {
      console.log(`[FunctionPanelUIBase] 🔧 初始化面板位置: ${this.effectiveRegistrationKey} #${this.panelInstanceId || 'singleton'}`, {
        initialX: this.initialX,
        initialY: this.initialY,
        panelRef: !!this.$refs.panelRef,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        panelWidth: this.width
      });

      let x = this.initialX;

      if (x === 'center') {
        const panel = this.$refs.panelRef;
        const panelWidth = panel ? panel.offsetWidth : this.width;
        x = Math.round((window.innerWidth - panelWidth) / 2);
        console.log(`[FunctionPanelUIBase] 📍 居中计算:`, { panelWidth, calculatedX: x });
      } else if (x === 'right') {
        const panel = this.$refs.panelRef;
        const panelWidth = panel ? panel.offsetWidth : this.width;
        x = Math.round(window.innerWidth - panelWidth - 20);
        console.log(`[FunctionPanelUIBase] 📍 右侧对齐计算:`, { panelWidth, calculatedX: x });
      } else if (typeof x !== 'number') {
        x = 20;
        console.log(`[FunctionPanelUIBase] 📍 使用默认 x 值: 20`);
      }

      // 确保 x 在可见范围内
      x = Math.max(20, Math.min(x, window.innerWidth - this.width - 20));

      this.x = x;
      this.y = Math.max(20, Math.min(this.initialY, window.innerHeight - 100));

      console.log(`[FunctionPanelUIBase] ✅ 面板位置已设置: ${this.effectiveRegistrationKey} #${this.panelInstanceId || 'singleton'}`, {
        x: this.x,
        y: this.y,
        transform: `translate(${this.x}px, ${this.y}px)`
      });
    },

    /**
     * 头部 mousedown - 开始拖动
     */
    onHeaderMouseDown(event) {
      // 只响应左键
      if (event.button !== 0) return;
      // 忽略按钮点击
      if (event.target.closest('.icon-btn')) return;

      event.preventDefault();
      this.startDrag(event);
    },

    /**
     * 面板 mousedown - 阻止默认拖动行为
     */
    onPanelMouseDown(event) {
      // 只在头部区域允许拖动
    },

    /**
     * 开始拖动
     */
    startDrag(event) {
      this.isDragging = true;

      // 计算鼠标点击位置相对于面板左上角的偏移
      const rect = this.$refs.panelRef.getBoundingClientRect();
      this.dragOffsetX = event.clientX - rect.left;
      this.dragOffsetY = event.clientY - rect.top;

      // 性能优化：缓存面板尺寸
      this.cachedPanelWidth = rect.width;
      this.cachedPanelHeight = rect.height;

      // 绑定拖动事件
      this.boundMouseMove = this.onMouseMove.bind(this);
      this.boundHandleMouseUp = this.onMouseUp.bind(this);

      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundHandleMouseUp);

      // 添加全局样式
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
    },

    /**
     * 鼠标移动 - 拖动中
     */
    onMouseMove(event) {
      if (!this.isDragging) return;

      // 计算新位置
      let newX = event.clientX - this.dragOffsetX;
      let newY = event.clientY - this.dragOffsetY;

      // 边界限制 - 保持至少部分可见
      // 性能优化：使用缓存的尺寸，避免频繁 DOM 查询
      const panelWidth = this.cachedPanelWidth || this.width;
      const panelHeight = this.cachedPanelHeight || 200;
      const minVisible = 40; // 至少保留40像素可见

      // X 方向边界
      const minX = -panelWidth + minVisible;
      const maxX = window.innerWidth - minVisible;
      newX = Math.max(minX, Math.min(newX, maxX));

      // Y 方向边界
      const minY = 0;
      const maxY = window.innerHeight - 60;
      newY = Math.max(minY, Math.min(newY, maxY));

      // 更新位置
      this.x = Math.round(newX);
      this.y = Math.round(newY);
    },

    /**
     * 鼠标释放 - 结束拖动
     */
    onMouseUp() {
      if (!this.isDragging) return;

      this.isDragging = false;

      // 移除事件监听
      if (this.boundMouseMove) {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
        this.boundMouseMove = null;
        this.boundHandleMouseUp = null;
      }

      // 恢复全局样式
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // 边缘吸附（可选）
      this.snapToEdge();
    },

    /**
     * 边缘吸附
     */
    snapToEdge() {
      const threshold = 30;
      const panel = this.$refs.panelRef;
      if (!panel) return;

      // 性能优化：使用缓存的尺寸
      const rect = panel.getBoundingClientRect();
      let snapped = false;

      // 左边缘
      if (Math.abs(rect.left) < threshold && rect.left >= -20) {
        this.x = 0;
        snapped = true;
      }
      // 右边缘
      else if (Math.abs(rect.right - window.innerWidth) < threshold) {
        this.x = window.innerWidth - (this.cachedPanelWidth || rect.width);
        snapped = true;
      }
      // 顶部边缘
      if (rect.top < threshold && rect.top >= -20) {
        this.y = 0;
        snapped = true;
      }

      if (snapped) {
        // 添加吸附动画
        setTimeout(() => {
          this.$refs.panelRef?.classList.add('snapped');
          setTimeout(() => {
            this.$refs.panelRef?.classList.remove('snapped');
          }, 300);
        }, 0);
      }

      // 清除缓存
      this.cachedPanelWidth = null;
      this.cachedPanelHeight = null;
    },

    /**
     * 切换最小化
     */
    toggleMinimize() {
      this.isMinimized = !this.isMinimized;
      this.$emit(this.isMinimized ? 'minimize' : 'expand');
    },

    /**
     * 关闭面板
     * ⭐ 根据单例/多实例模式执行不同的关闭逻辑
     * - 单例模式（通过配置加载）：假关闭（隐藏面板，不销毁组件）
     * - 多实例模式（动态创建）：真关闭（销毁组件并注销实例）
     *
     * ⭐ 面板自己管理关闭状态判断和验证注销
     */
    close() {
      // ⭐ 优先检查是否为多实例面板
      // 多实例面板有 panelInstanceId（从 props 或 inject 获取）
      const panelInstanceId = this.panelInstanceId || null;

      // ⭐ 自动判断是否为单例模式
      // 单例模式：通过 functionPanels.config.json 配置自动加载 且 不是多实例
      // 判断依据：autoRegister === true 且有 registrationKey 且没有 panelInstanceId
      const isSingleton = this.autoRegister && this.registrationKey && !panelInstanceId;

      // ⭐ 检查是否为多实例面板实例
      const isMultiInstance = !isSingleton && panelInstanceId !== null;

      if (isSingleton) {
        // ⭐ 单例模式：假关闭（只隐藏面板）
        console.log(`[FunctionPanelUIBase] 🔄 面板假关闭（单例模式）: ${this.effectiveRegistrationKey}`);
        this.isClosed = true;

        // ⭐ 清理子类状态（包括对话框等）
        if (this.cleanup && typeof this.cleanup === 'function') {
          this.cleanup();
        }

        // ⭐ 使用 PanelSingletonManager 更新面板注册表状态（统一使用 updatePanelVisible）
        panelSingletonManager.updatePanelVisible(this.effectiveRegistrationKey, false);
        console.log(`[FunctionPanelUIBase] ✅ 已通过 PanelSingletonManager 更新面板 ${this.effectiveRegistrationKey} 可见性为 false`);

        // ⭐ 更新面板可见性（通过 inject 的 setPanelVisible 方法）
        if (this.setPanelVisible && typeof this.setPanelVisible === 'function') {
          this.setPanelVisible(this.effectiveRegistrationKey, false);
          console.log(`[FunctionPanelUIBase] ✅ 已设置面板 ${this.effectiveRegistrationKey} 可见性为 false`);
        } else if (this.getRegisteredPanels && typeof this.getRegisteredPanels === 'function') {
          // 回退方案：直接获取 registeredPanels 并更新
          const panels = this.getRegisteredPanels();
          if (panels && panels[this.effectiveRegistrationKey]) {
            // Vue 3: 直接赋值即可（Proxy 自动处理响应式）
            panels[this.effectiveRegistrationKey].visible = false;
            console.log(`[FunctionPanelUIBase] ✅ 已设置面板 ${this.effectiveRegistrationKey} 可见性为 false（直接修改）`);
          }
        }

        // ⭐ 触发假关闭事件，通知父组件只隐藏面板而不销毁
        if (typeof window !== 'undefined') {
          const fakeCloseEvent = new CustomEvent(`${this.closeEventName}FakeClose`, {
            detail: {
              componentName: this.componentName,
              registrationKey: this.effectiveRegistrationKey,
              preserveData: true
            }
          });
          window.dispatchEvent(fakeCloseEvent);
        }

        // 等待关闭动画完成
        setTimeout(() => {
          this.$emit('close', { preserveData: true });

          if (typeof window !== 'undefined') {
            const event = new CustomEvent(this.closeEventName, {
              detail: { componentName: this.componentName }
            });
            window.dispatchEvent(event);
          }

          if (this.onClose && typeof this.onClose === 'function') {
            this.onClose();
          }

          // ⚠️ 单例模式：不注销组件，只隐藏
          // 面板将保持关闭状态，直到通过 visible prop 重新打开
        }, 300);
      } else if (isMultiInstance) {
        // ⭐ 多实例面板模式：面板自己注销
        console.log(`[FunctionPanelUIBase] 🗑️ 多实例面板注销: ${this.effectiveRegistrationKey} #${panelInstanceId}`);
        this.isClosed = true;

        // ⭐ 清理子类状态
        if (this.cleanup && typeof this.cleanup === 'function') {
          this.cleanup();
        }

        // ⭐ 生成正确的 panelKey（格式：registrationKey_panelInstanceId）
        const panelKey = `${this.effectiveRegistrationKey}_${panelInstanceId}`;
        console.log(`[FunctionPanelUIBase] 🎯 多实例面板关闭，panelKey: ${panelKey}`);

        // ⭐ 面板自己注销：调用 multiInstancePanelConfigManager 注销自己
        if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__) {
          const instanceId = this.instanceId || 1;
          window.__multiInstancePanelConfigManager__.unregisterPanelInstance(
            instanceId,
            this.effectiveRegistrationKey,
            panelInstanceId
          );
          console.log(`[FunctionPanelUIBase] ✅ 面板已自己注销实例: ${this.effectiveRegistrationKey} #${panelInstanceId}`);
        }

        // 等待关闭动画完成
        setTimeout(() => {
          // ⭐ 传递正确的 panelKey 给父组件
          this.$emit('close', { preserveData: false, panelKey: panelKey });

          if (typeof window !== 'undefined') {
            const event = new CustomEvent(this.closeEventName, {
              detail: {
                componentName: this.componentName,
                panelInstanceId: panelInstanceId,
                panelKey: panelKey
              }
            });
            window.dispatchEvent(event);
          }

          if (this.onClose && typeof this.onClose === 'function') {
            this.onClose();
          }
        }, 300);
      } else {
        // ⭐ 普通多实例模式：真关闭（销毁组件）
        console.log(`[FunctionPanelUIBase] ❌ 面板真关闭（多实例模式）: ${this.effectiveRegistrationKey}`);
        this.isClosed = true;

        // ⭐ 清理子类状态
        if (this.cleanup && typeof this.cleanup === 'function') {
          this.cleanup();
        }

        // ⭐ 生成 panelKey（如果没有 panelInstanceId，则使用 effectiveRegistrationKey）
        // 注意：这种情况下，关闭操作会影响到所有同名面板实例
        const panelInstanceId = this.panelInstanceId;
        const panelKey = panelInstanceId !== null
          ? `${this.effectiveRegistrationKey}_${panelInstanceId}`
          : this.effectiveRegistrationKey;

        console.log(`[FunctionPanelUIBase] 🎯 多实例面板关闭，panelKey: ${panelKey}, panelInstanceId: ${panelInstanceId}`);

        // 等待关闭动画完成
        setTimeout(() => {
          // ⭐ 传递正确的 panelKey 给父组件
          this.$emit('close', { preserveData: false, panelKey: panelKey });

          if (typeof window !== 'undefined') {
            const event = new CustomEvent(this.closeEventName, {
              detail: {
                componentName: this.componentName,
                panelInstanceId: panelInstanceId,
                panelKey: panelKey
              }
            });
            window.dispatchEvent(event);
          }

          if (this.onClose && typeof this.onClose === 'function') {
            this.onClose();
          }

          // ⭐ 多实例模式：触发注销逻辑
          if (this.autoRegister && this.registrationKey) {
            this.unregisterFromParent();
          }
        }, 300);
      }
    },

    /**
     * 键盘事件处理
     */
    handleKeydown(event) {
      if (event.key === 'Escape') {
        this.close();
      }
    }
  }
};
</script>

<style scoped>
/* ==================== 主面板 ==================== */
.function-panel {
  position: fixed;
  top: 0;
  left: 0;
  /* 优化：使用更高效的纯色背景，避免 backdrop-filter 性能消耗 */
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  /* 优化：简化阴影层数，减少 GPU 负担 */
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(0, 0, 0, 0.2);
  z-index: 100000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  will-change: transform;
  /* 优化：移除硬件加速以减少合成层创建 */
  /* will-change: transform; */
}

/* 仅在启用 backdrop-filter 时应用（可选） */
.function-panel.blur-enabled {
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
}

.function-panel.is-dragging {
  box-shadow:
    0 0 0 1px rgba(76, 175, 80, 0.3) inset,
    0 1px 3px rgba(76, 175, 80, 0.2) inset,
    0 30px 80px rgba(0, 0, 0, 0.6),
    0 0 120px rgba(76, 175, 80, 0.25);
  border-color: rgba(76, 175, 80, 0.4);
  cursor: grabbing;
}

.function-panel.snapped {
  transition: transform 0.2s ease-out !important;
}

/* ==================== 面板头部 ==================== */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  /* 优化：使用纯色背景替代渐变，减少渲染开销 */
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
  position: relative;
}

.panel-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #4CAF50, #2E7D32);
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.6);
}

.panel-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.drag-indicator {
  display: flex;
  gap: 3px;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.panel-header:hover .drag-indicator {
  opacity: 0.7;
}

.grip-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
  padding: 0;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.95);
  transform: scale(1.08);
}

.icon-btn:active {
  transform: scale(0.95);
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.2);
  border-color: rgba(255, 59, 48, 0.4);
  color: #ff6b6b;
  box-shadow: 0 0 16px rgba(255, 59, 48, 0.4);
}

.minimize-btn:hover {
  background: rgba(76, 175, 80, 0.2);
  border-color: rgba(76, 175, 80, 0.4);
  color: #4CAF50;
}

/* ==================== 面板内容 ==================== */
.panel-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* 优化：使用纯色背景替代渐变 */
  background: rgba(0, 0, 0, 0.25);
}

.panel-body::-webkit-scrollbar {
  width: 6px;
}

.panel-body::-webkit-scrollbar-track {
  background: transparent;
}

.panel-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.6), rgba(76, 175, 80, 0.3));
  border-radius: 3px;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.5));
}

/* ==================== 浮动按钮 ==================== */
.panel-fab {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  /* 优化：使用纯色背景替代 backdrop-filter */
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(76, 175, 80, 0.5);
  border-radius: 50px;
  /* 优化：简化阴影 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 12px rgba(76, 175, 80, 0.15);
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  z-index: 99999;
  transition: all 0.2s ease;
}

.panel-fab:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(76, 175, 80, 0.35);
  border-color: rgba(76, 175, 80, 0.7);
}

.panel-fab:active {
  transform: scale(0.98);
}

.fab-icon {
  font-size: 16px;
  line-height: 1;
}

.fab-text {
  white-space: nowrap;
}

/* ==================== 过渡动画 ==================== */
.panel-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.panel-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.panel-fade-enter-from {
  opacity: 0;
  transform: translate(var(--x, 0), calc(var(--y, 0) + 20px)) scale(0.95);
}

.panel-fade-leave-to {
  opacity: 0;
  transform: translate(var(--x, 0), calc(var(--y, 0) - 10px)) scale(0.98);
}

.content-slide-enter-active,
.content-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.content-slide-enter-from,
.content-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: translate(var(--x, 0), var(--y, 0)) scale(0.8);
}

/* ==================== 响应式 ==================== */
@media (max-width: 480px) {
  .function-panel {
    width: calc(100vw - 16px) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .function-panel,
  .panel-fab,
  .icon-btn,
  * {
    transition-duration: 0.01ms !important;
  }
}
</style>
