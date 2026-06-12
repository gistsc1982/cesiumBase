/**
 * 组件自注册管理器
 * 用于 FunctionPanelUIBase 及其子类的自动注册
 */

class ComponentRegistry {
  constructor() {
    this.registeredComponents = new Map();
    this.componentInstances = new Map();
  }

  /**
   * 注册组件类（在组件定义时调用）
   * @param {string} key - 组件唯一标识
   * @param {Object} componentConfig - 组件配置
   */
  register(key, componentConfig) {
    if (!key || typeof key !== 'string') {
      console.warn('[ComponentRegistry] 无效的组件 key:', key);
      return;
    }

    this.registeredComponents.set(key, {
      component: componentConfig.component,
      props: componentConfig.props || {},
      visible: componentConfig.visible !== false,
      ...componentConfig
    });

    console.log(`[ComponentRegistry] 组件已注册: ${key}`);
  }

  /**
   * 注销组件
   * @param {string} key - 组件唯一标识
   */
  unregister(key) {
    if (this.registeredComponents.has(key)) {
      this.registeredComponents.delete(key);
      console.log(`[ComponentRegistry] 组件已注销: ${key}`);
    }
  }

  /**
   * 获取已注册的组件配置
   * @param {string} key - 组件唯一标识
   * @returns {Object|null}
   */
  get(key) {
    return this.registeredComponents.get(key) || null;
  }

  /**
   * 获取所有已注册的组件
   * @returns {Array}
   */
  getAll() {
    return Array.from(this.registeredComponents.entries()).map(([key, config]) => ({
      key,
      ...config
    }));
  }

  /**
   * 显示组件（设置 visible 状态）
   * @param {string} key - 组件唯一标识
   * @param {boolean} visible - 是否可见
   */
  setVisible(key, visible) {
    const config = this.registeredComponents.get(key);
    if (config) {
      config.visible = visible;
    }
  }

  /**
   * 切换组件显示状态
   * @param {string} key - 组件唯一标识
   */
  toggle(key) {
    const config = this.registeredComponents.get(key);
    if (config) {
      config.visible = !config.visible;
    }
  }

  /**
   * 存储组件实例（组件 mounted 时调用）
   * @param {string} key - 组件唯一标识
   * @param {Object} instance - 组件实例
   */
  setInstance(key, instance) {
    this.componentInstances.set(key, instance);
  }

  /**
   * 获取组件实例
   * @param {string} key - 组件唯一标识
   * @returns {Object|null}
   */
  getInstance(key) {
    return this.componentInstances.get(key) || null;
  }

  /**
   * 移除组件实例（组件 beforeUnmount 时调用）
   * @param {string} key - 组件唯一标识
   */
  removeInstance(key) {
    this.componentInstances.delete(key);
  }

  /**
   * 清空所有注册
   */
  clear() {
    this.registeredComponents.clear();
    this.componentInstances.clear();
  }
}

// 创建全局单例
let globalRegistry = null;

/**
 * 获取全局注册表实例
 * @param {string} namespace - 命名空间（可选，用于多实例隔离）
 * @returns {ComponentRegistry}
 */
export function getRegistry(namespace = 'default') {
  if (typeof window === 'undefined') return new ComponentRegistry();

  if (!window.__componentRegistries__) {
    window.__componentRegistries__ = {};
  }

  if (!window.__componentRegistries__[namespace]) {
    window.__componentRegistries__[namespace] = new ComponentRegistry();
  }

  return window.__componentRegistries__[namespace];
}

/**
 * 创建组件注册 Mixin
 * @param {Object} options - 配置选项
 * @returns {Object}
 */
export function createRegistrationMixin(options = {}) {
  const {
    registryNamespace = 'default',
    registrationKey = null, // 由组件提供
    autoRegister = true
  } = options;

  return {
    data() {
      return {
        // 自注册相关
        _registryRegistered: false
      };
    },

    mounted() {
      if (autoRegister && registrationKey) {
        this.registerToParent();
      }
    },

    beforeUnmount() {
      if (registrationKey) {
        this.unregisterFromParent();
      }
    },

    methods: {
      /**
       * 注册到父组件
       */
      registerToParent() {
        // 方式1: 通过 inject 的注册方法
        if (this.registerPanelComponent && typeof this.registerPanelComponent === 'function') {
          this.registerPanelComponent(registrationKey, {
            component: this.$options.__self || this.constructor,
            props: this.$props,
            instance: this
          });
          this._registryRegistered = true;
          return;
        }

        // 方式2: 通过全局注册表
        const registry = getRegistry(registryNamespace);
        registry.register(registrationKey, {
          component: this.$options.__self || this.constructor,
          props: this.$props,
          instance: this
        });
        registry.setInstance(registrationKey, this);
        this._registryRegistered = true;

        console.log(`[RegistrationMixin] ${registrationKey} 已注册`);
      },

      /**
       * 从父组件注销
       */
      unregisterFromParent() {
        // 方式1: 通过 inject 的注销方法
        if (this.unregisterPanelComponent && typeof this.unregisterPanelComponent === 'function') {
          this.unregisterPanelComponent(registrationKey);
          return;
        }

        // 方式2: 通过全局注册表
        const registry = getRegistry(registryNamespace);
        registry.removeInstance(registrationKey);
        console.log(`[RegistrationMixin] ${registrationKey} 实例已移除`);
      }
    }
  };
}

export default ComponentRegistry;
