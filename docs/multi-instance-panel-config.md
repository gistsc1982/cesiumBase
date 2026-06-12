# 多实例模式下功能面板配置兼容方案

## 问题分析

### 当前流程

1. **配置文件**：`functionPanels.config.json`
   ```json
   {
     "panels": [
       {
         "name": "TestPanel",
         "file": "TestPanel.vue",
         "enabled": true,
         "visible": true,
         "position": {
           "initialX": "left",
           "initialY": 100
         }
       }
     ]
   }
   ```

2. **加载流程**：
   - CesiumMain 从配置文件读取面板配置
   - 预加载启用的面板组件
   - 根据 `visible` 和 `position` 预注册面板
   - 子组件通过 `autoRegister` 自注册到父组件

3. **多实例模式需求**：
   - 每个实例需要有独立的配置
   - position 配置需要根据实例ID偏移（避免重叠）
   - visible 配置应该独立控制

## 解决方案

### 方案一：实例感知的配置管理器（推荐）

创建一个实例感知的配置管理器，为每个实例维护独立的配置状态。

#### 1. 创建 `MultiInstancePanelConfigManager.js`

```javascript
/**
 * 多实例面板配置管理器
 * 为每个 CesiumMain 实例维护独立的面板配置
 */
class MultiInstancePanelConfigManager {
  constructor() {
    // 全局配置（从 functionPanels.config.json 读取）
    this.globalConfig = null;

    // 实例配置映射
    // instanceId -> { panelName -> { visible, position, ... } }
    this.instanceConfigs = new Map();

    // 实例计数器
    this.instanceCounter = 0;
  }

  /**
   * 初始化全局配置
   */
  initGlobalConfig(config) {
    this.globalConfig = config;
  }

  /**
   * 创建新实例配置
   * @returns {number} 实例ID
   */
  createInstance() {
    const instanceId = ++this.instanceCounter;

    // 为新实例创建默认配置
    const instanceConfig = {};

    if (this.globalConfig && this.globalConfig.panels) {
      this.globalConfig.panels.forEach(panel => {
        instanceConfig[panel.name] = {
          visible: panel.visible !== false, // 默认为 true
          position: this._calculateInstancePosition(panel.position, instanceId),
          title: panel.title,
          icon: panel.icon,
          // 复制其他配置
          ...panel
        };
      });
    }

    this.instanceConfigs.set(instanceId, instanceConfig);

    console.log(`[MultiInstancePanelConfigManager] 创建实例 #${instanceId}，配置面板数:`, Object.keys(instanceConfig).length);

    return instanceId;
  }

  /**
   * 计算实例位置偏移
   * @private
   */
  _calculateInstancePosition(basePosition, instanceId) {
    if (!basePosition) {
      return { initialX: 'center', initialY: 80 };
    }

    const offset = (instanceId - 1) * 40; // 每个实例偏移 40px

    return {
      initialX: basePosition.initialX !== 'center' ?
        (typeof basePosition.initialX === 'number' ? basePosition.initialX + offset : basePosition.initialX) :
        basePosition.initialX,
      initialY: (basePosition.initialY || 80) + offset
    };
  }

  /**
   * 获取实例的面板配置
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @returns {Object|null} 面板配置
   */
  getPanelConfig(instanceId, panelName) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      console.warn(`[MultiInstancePanelConfigManager] 实例 #${instanceId} 不存在`);
      return null;
    }
    return instanceConfig[panelName] || null;
  }

  /**
   * 设置面板可见性
   * @param {number} instanceId - 实例ID
   * @param {string} panelName - 面板名称
   * @param {boolean} visible - 是否可见
   */
  setPanelVisible(instanceId, panelName, visible) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig || !instanceConfig[panelName]) {
      return;
    }
    instanceConfig[panelName].visible = visible;
  }

  /**
   * 获取实例所有可见的面板
   * @param {number} instanceId - 实例ID
   * @returns {Array} 可见面板列表
   */
  getVisiblePanels(instanceId) {
    const instanceConfig = this.instanceConfigs.get(instanceId);
    if (!instanceConfig) {
      return [];
    }

    return Object.entries(instanceConfig)
      .filter(([name, config]) => config.visible)
      .map(([name, config]) => ({ name, ...config }));
  }

  /**
   * 销毁实例配置
   * @param {number} instanceId - 实例ID
   */
  destroyInstance(instanceId) {
    this.instanceConfigs.delete(instanceId);
    console.log(`[MultiInstancePanelConfigManager] 销毁实例 #${instanceId}`);
  }
}

// 导出全局单例
export const multiInstancePanelConfigManager = new MultiInstancePanelConfigManager();
export default multiInstancePanelConfigManager;
```

#### 2. 修改 `CesiumMain.vue` 使用配置管理器

在 `CesiumMain.vue` 中：

```javascript
import { multiInstancePanelConfigManager } from './utils/MultiInstancePanelConfigManager.js';

export default {
  data() {
    return {
      // 当前实例ID
      instanceId: null,
      // ... 其他数据
    };
  },

  mounted() {
    // 创建新实例配置
    this.instanceId = multiInstancePanelConfigManager.createInstance();
    console.log(`[CesiumMain] 实例 ID: ${this.instanceId}`);

    // 提供给子组件
    this.provideInstanceId();
  },

  methods: {
    provideInstanceId() {
      // 通过 provide 向子组件提供实例ID
      this.$parent.$provide = this.$parent.$provide || {};
      this.$parent.$provide.instanceId = this.instanceId;
    },

    // 修改 registerPanelComponent 方法
    registerPanelComponent(key, config) {
      console.log(`[CesiumMain #${this.instanceId}] 注册面板组件: ${key}`, config);

      // 从配置管理器获取实例特定的配置
      const panelConfig = multiInstancePanelConfigManager.getPanelConfig(this.instanceId, key);

      this.$set(this.registeredPanels, key, {
        component: config.component,
        props: {
          ...config.props,
          // 使用实例特定的配置覆盖默认配置
          ...(panelConfig?.position || {})
        },
        visible: panelConfig?.visible !== false
      });
    }
  },

  beforeUnmount() {
    // 销毁实例配置
    if (this.instanceId) {
      multiInstancePanelConfigManager.destroyInstance(this.instanceId);
    }
  }
}
```

#### 3. 修改 `functionPanelUIBase.vue` 接收实例ID

在 `functionPanelUIBase.vue` 中：

```javascript
export default {
  inject: {
    // 接收实例ID
    instanceId: {
      default: 1 // 默认为第一个实例
    }
  },

  methods: {
    registerToParent() {
      if (!this.registrationKey) {
        console.warn('[FunctionPanelUIBase] 缺少 registrationKey，无法自动注册');
        return;
      }

      if (this.registerPanelComponent && typeof this.registerPanelComponent === 'function') {
        // 获取实例特定的配置
        const instanceConfig = this.getInstanceConfig();

        this.registerPanelComponent(this.registrationKey, {
          component: this,
          props: {
            ...this.$props,
            // 使用实例特定的位置配置
            ...(instanceConfig?.position || {})
          },
          visible: instanceConfig?.visible !== false
        });

        this._registryRegistered = true;
        console.log(`[FunctionPanelUIBase #${this.instanceId}] ${this.registrationKey} 已注册`);
        return;
      }
    },

    getInstanceConfig() {
      // 从配置管理器获取实例特定的配置
      if (typeof window !== 'undefined' && window.__multiInstancePanelConfigManager__) {
        return window.__multiInstancePanelConfigManager__.getPanelConfig(
          this.instanceId,
          this.registrationKey
        );
      }
      return null;
    }
  }
}
```

### 方案二：配置文件增强（替代方案）

修改 `functionPanels.config.json` 支持多实例配置：

```json
{
  "description": "功能面板组件配置文件",
  "version": "2.0.0",
  "multiInstance": {
    "enabled": true,
    "positionOffset": {
      "x": 40,
      "y": 40
    },
    "defaultVisible": true
  },
  "panels": [
    {
      "name": "TestPanel",
      "file": "TestPanel.vue",
      "title": "测试面板",
      "enabled": true,
      "visible": true,
      "icon": "🧪",
      "position": {
        "initialX": "left",
        "initialY": 100
      },
      "instanceConfig": {
        "inheritPosition": true,
        "inheritVisible": true
      }
    }
  ]
}
```

## 使用示例

### 创建多实例

```javascript
// 在 HelloWorld.vue 中
methods: {
  createDualCanvasInstance() {
    // 创建新的 CesiumMain 实例
    // 实例会自动调用 multiInstancePanelConfigManager.createInstance()
    // 获取独立的实例ID和配置

    const instanceId = ++this.dualCanvasInstanceCounter;
    console.log(`创建 DualCanvasViewer 实例 #${instanceId}`);

    // 每个实例的面板会根据实例ID自动偏移位置
    // 实例 #1: TestPanel at (left, 100)
    // 实例 #2: TestPanel at (left, 140)
    // 实例 #3: TestPanel at (left, 180)
  }
}
```

### 动态控制面板可见性

```javascript
// 控制特定实例的面板可见性
multiInstancePanelConfigManager.setPanelVisible(instanceId, 'TestPanel', true);
```

## 迁移步骤

1. ✅ 创建 `MultiInstancePanelConfigManager.js`
2. ⚙️ 修改 `CesiumMain.vue` 导入并使用配置管理器
3. ⚙️ 修改 `functionPanelUIBase.vue` 接收实例ID
4. 🧪 测试多实例场景
5. 📝 更新文档

## 注意事项

1. **向后兼容**：单实例模式下仍然使用原有的配置流程
2. **位置偏移**：确保不同实例的面板不会重叠
3. **默认值**：visible 默认为 true，position 使用配置文件中的值
4. **生命周期**：实例销毁时清理对应的配置
