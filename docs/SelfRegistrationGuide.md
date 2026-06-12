# 面板组件自注册使用指南

## 概述

本文档说明如何使用面板组件自注册功能，让 `FunctionPanelUIBase` 的子类能够自动注册到父组件（如 `CesiumMain.vue`）中。

## ⭐ 新功能：自动发现与渲染（推荐）

CesiumMain 现在支持**自动发现** `functions` 目录下的面板组件并自动渲染，无需手动导入和声明。

### 工作原理

```
1. 将面板组件放入 cesiumBase/src/components/functions/ 目录
2. 在组件中启用 auto-register="true"
3. CesiumMain 自动通过 import.meta.glob 导入
4. 组件挂载时自动注册到 CesiumMain
5. CesiumMain 动态渲染所有已注册的面板
```

### 使用方法（三步完成）

#### 步骤 1：创建面板组件

在 `cesiumBase/src/components/functions/` 目录下创建你的面板文件：

```vue
<!-- MyFeaturePanel.vue -->
<template>
  <FunctionPanelUIBase
    title="我的功能"
    title-icon="⭐"
    :auto-register="true"
    registration-key="MyFeaturePanel"
  >
    <div>面板内容</div>
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';

export default {
  name: 'MyFeaturePanel',
  components: { FunctionPanelUIBase }
};
</script>
```

#### 步骤 2：确保组件命名正确

组件必须有正确的 `name` 属性（用于自动识别）：

```javascript
export default {
  name: 'MyFeaturePanel', // ✅ 必须与文件名一致（PascalCase）
  // ...
};
```

#### 步骤 3：完成！

**无需其他操作**：
- ❌ 不需要在 CesiumMain.vue 中导入
- ❌ 不需要在 components 中声明
- ❌ 不需要在 template 中添加标签
- ✅ CesiumMain 会自动发现、导入和渲染

### 验证自动加载

打开浏览器控制台，查看日志：

```
[CesiumMain] 📦 自动加载面板组件: MyFeaturePanel (./functions/MyFeaturePanel.vue)
[FunctionPanelUIBase] MyFeaturePanel 已通过 inject 注册
```

### 可见性控制

面板默认可见。如需控制初始可见状态，在父组件中：

```javascript
// 在 CesiumMain 的 data 中
registeredPanels: {
  MyFeaturePanel: { visible: false } // 默认隐藏
}
```

## 工作原理

自注册机制基于 Vue 的 `provide/inject` API：

1. **父组件（CesiumMain.vue）**：通过 `provide` 提供注册方法，并自动导入 `functions` 目录下的组件
2. **子组件（如 ObliquePhotographyPanel）**：通过 `inject` 获取注册方法，在 `mounted` 时自动调用
3. **动态渲染**：CesiumMain 使用 `<component :is="...">` 动态渲染所有可见的已注册面板

## 文件结构

```
cesiumBase/src/
├── utils/
│   └── ComponentRegistry.js          # 组件注册管理器（可选，用于全局注册）
├── components/
│   ├── functionPanelUIBase.vue        # 基础面板组件（支持自注册）
│   ├── CesiumMain.vue                # 主组件（提供注册方法）
│   └── functions/
│       └── ObliquePhotographyPanel.vue  # 示例：倾斜摄影面板
```

## 使用方法

### 方式一：通过 inject/provide（推荐）

#### 1. 父组件提供注册方法

在父组件中添加 `provide` 和注册方法：

```javascript
export default {
  name: 'CesiumMain',
  data() {
    return {
      registeredPanels: {} // 存储已注册的面板
    };
  },
  provide() {
    return {
      registerPanelComponent: this.registerPanelComponent,
      unregisterPanelComponent: this.unregisterPanelComponent
    };
  },
  methods: {
    registerPanelComponent(key, config) {
      this.$set(this.registeredPanels, key, config);
    },
    unregisterPanelComponent(key) {
      this.$delete(this.registeredPanels, key);
    }
  }
}
```

#### 2. 子组件启用自注册

在模板中添加 `auto-register` 和 `registration-key` 属性：

```vue
<template>
  <FunctionPanelUIBase
    title="我的面板"
    :auto-register="true"
    registration-key="MyPanel"
  >
    <!-- 面板内容 -->
  </FunctionPanelUIBase>
</template>
```

### 方式二：通过事件监听

子组件触发事件，父组件监听处理：

```vue
<!-- 父组件模板 -->
<template>
  <div>
    <ChildComponent @register-panel="handleRegister" />
  </div>
</template>

<script>
export default {
  methods: {
    handleRegister({ key, component, props }) {
      this.registeredPanels[key] = { component, props, visible: true };
    }
  }
}
</script>
```

### 方式三：使用全局注册表（可选）

对于需要跨组件共享注册信息的场景，可以使用 `ComponentRegistry.js`：

```javascript
import { getRegistry } from '../utils/ComponentRegistry.js';

// 子组件
export default {
  mounted() {
    const registry = getRegistry('my-namespace');
    registry.register('MyPanel', {
      component: this,
      props: this.$props
    });
  }
}
```

## API 参考

### FunctionPanelUIBase Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `auto-register` | Boolean | `false` | 是否启用自动注册 |
| `registration-key` | String | `null` | 组件唯一标识，必需 |

### 注册方法

#### registerPanelComponent(key, config)

注册面板组件。

**参数：**
- `key` (String) - 组件唯一标识
- `config` (Object) - 组件配置
  - `component` (Component) - Vue 组件
  - `props` (Object) - 组件属性
  - `visible` (Boolean) - 是否可见

#### unregisterPanelComponent(key)

注销面板组件。

**参数：**
- `key` (String) - 组件唯一标识

## 示例

### 完整示例：创建新的功能面板

1. **创建面板组件**

```vue
<!-- MyFeaturePanel.vue -->
<template>
  <FunctionPanelUIBase
    title="我的功能"
    title-icon="⭐"
    :auto-register="true"
    registration-key="MyFeaturePanel"
    @close="handleClose"
  >
    <div class="panel-content">
      <!-- 功能内容 -->
    </div>
  </FunctionPanelUIBase>
</template>

<script>
import FunctionPanelUIBase from '../functionPanelUIBase.vue';

export default {
  name: 'MyFeaturePanel',
  components: { FunctionPanelUIBase },
  methods: {
    handleClose() {
      this.$emit('close');
    }
  }
};
</script>
```

2. **在父组件中使用**

```vue
<!-- CesiumMain.vue -->
<template>
  <div>
    <MyFeaturePanel
      v-if="registeredPanels['MyFeaturePanel']?.visible"
    />
  </div>
</template>

<script>
import MyFeaturePanel from './functions/MyFeaturePanel.vue';

export default {
  components: { MyFeaturePanel },
  data() {
    return {
      registeredPanels: {}
    };
  },
  provide() {
    return {
      registerPanelComponent: this.registerPanelComponent,
      unregisterPanelComponent: this.unregisterPanelComponent
    };
  },
  methods: {
    registerPanelComponent(key, config) {
      this.$set(this.registeredPanels, key, {
        component: config.component,
        props: config.props || {},
        visible: config.visible !== false
      });
    },
    unregisterPanelComponent(key) {
      this.$delete(this.registeredPanels, key);
    }
  }
}
</script>
```

## 注意事项

1. **registration-key 唯一性**：确保每个面板的 `registration-key` 是唯一的
2. **自动注册时机**：组件在 `mounted` 钩子中自动注册
3. **清理**：组件在 `beforeUnmount` 时自动注销
4. **兼容性**：如果不启用 `auto-register`，组件照常工作，只是不会自动注册

## 迁移现有组件

现有组件只需要添加两个属性即可启用自注册：

```diff
<FunctionPanelUIBase
  title="我的面板"
+  :auto-register="true"
+  registration-key="MyPanel"
>
```

无需修改其他代码。
