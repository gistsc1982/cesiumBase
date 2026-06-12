# SFC 组件使用示例（继承 SfcBase）

生成时间: 2026-06-12T03:36:36.942Z
基础类: SfcBase

## 组件列表

### TestSfc

**描述**: 继承 SfcBase 的组件: TestSfc

**继承**: SfcBase

**文件**: 
- ES Module: `TestSfc.mjs`
- UMD: `TestSfc.umd.js`

#### ES Module 使用示例

```javascript
import TestSfc from './TestSfc.mjs';

// 使用组件（已继承 SfcBase 的所有功能）
const app = Vue.createApp({
  components: {
    TestSfc
  }
});
```

#### UMD 使用示例

```html
<script src="./vue.global.prod.js"></script>
<script src="./TestSfc.umd.js"></script>

<div id="app">
  <TestSfc></TestSfc>
</div>

<script>
  const { createApp } = Vue;
  const app = createApp({
    components: {
      TestSfc: window.TestSfc
    }
  });
  app.mount('#app');
</script>
```

---

