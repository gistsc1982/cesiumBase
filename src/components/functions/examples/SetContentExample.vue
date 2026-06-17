<template>
  <TestPanelModule
    ref="panel"
    title="双画布查看器"
    title-icon="🖥️"
    :width="100"
    :initial-x="'right'"
    :initial-y="0"
    :auto-register="true"
    registration-key="SetContentExample"
  >
    <template #content>
      <div ref="panelContent" class="set-content-example-content">
        <div class="loading-message">正在初始化双画布查看器...</div>
      </div>
    </template>
  </TestPanelModule>
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';

export default {
  name: 'SetContentExample',
  components: {
    TestPanelModule
  },
  data() {
    return {
      containerId: 'set-content-dual-canvas-container',
      vueApp: null,
      isMounted: false
    };
  },
  mounted() {
    console.log('[SetContentExample] mounted 钩子被触发');

    // 使用 $nextTick 确保 DOM 已准备好
    this.$nextTick(() => {
      console.log('[SetContentExample] $nextTick 回调执行');
      this.initDualCanvasViewer();
    });
  },
  beforeUnmount() {
    this.disposeDualCanvasViewer();
  },
  methods: {
    initDualCanvasViewer() {
      console.log('[SetContentExample] initDualCanvasViewer() 被调用');

      if (this.isMounted) {
        console.log('[SetContentExample] 已经挂载，跳过重复初始化');
        return;
      }

      console.log('[SetContentExample] 检查 window.DualCanvasViewerPlugin...');
      // 检查全局 DualCanvasViewerPlugin 是否已加载
      if (typeof window !== 'undefined' && window.DualCanvasViewerPlugin) {
        console.log('[SetContentExample] DualCanvasViewerPlugin 已就绪，开始挂载...');
        this.mountDualCanvasViewer();
      } else {
        console.warn('[SetContentExample] DualCanvasViewerPlugin 未就绪，等待加载...');

        // 等待脚本加载完成
        setTimeout(() => {
          console.log('[SetContentExample] 重新检查 DualCanvasViewerPlugin...');
          this.initDualCanvasViewer();
        }, 500);
      }
    },

    mountDualCanvasViewer() {
      if (this.isMounted) return;

      try {
        console.log('[SetContentExample] 开始设置面板内容...');

        // 获取面板内容容器
        const panelContent = this.$refs.panelContent;
        if (!panelContent) {
          console.error('[SetContentExample] panelContent 引用未找到');
          return;
        }

        // 创建容器元素
        const container = document.createElement('div');
        container.id = this.containerId;
        container.className = 'dual-canvas-wrapper';
        container.style.cssText = 'width: 100vw; height: 100vh; position: fixed; top: 0; left: 0; background: #000; z-index: 99995; pointer-events: auto;';

        // 清空面板内容并添加容器
        panelContent.innerHTML = '';
        panelContent.appendChild(container);

        console.log('[SetContentExample] 容器已创建，开始挂载组件...');
        this.createVueApp();
      } catch (error) {
        console.error('[SetContentExample] 挂载失败:', error);
      }
    },

    createVueApp() {
      if (this.isMounted) return;

      try {
        console.log('[SetContentExample] 开始创建 Vue 应用...');
        const iifeComponent = window.DualCanvasViewerPlugin;

        if (!iifeComponent) {
          console.error('[SetContentExample] DualCanvasViewerPlugin 未找到');
          return;
        }

        // 获取容器元素
        const container = document.getElementById(this.containerId);
        if (!container) {
          console.error('[SetContentExample] 容器未找到:', this.containerId);
          return;
        }

        console.log('[SetContentExample] 容器已找到，开始挂载组件...');

        // 导入 Vue
        import('vue').then((Vue) => {
          const { createApp } = Vue;

          // ⭐ 使用与 CesiumMain.vue 相同的方式挂载组件
          // 1. 创建一个空的 Vue 应用
          const app = createApp({
            data() {
              return { loaded: true };
            }
          });

          // 2. 注册 DualCanvasViewer 组件
          const componentTagName = 'dual-canvas-viewer-plugin';
          app.component(componentTagName, iifeComponent);
          console.log(`[SetContentExample] ✓ 已注册组件: ${componentTagName}`);

          // 3. 清空容器并添加组件标签
          container.innerHTML = `<${componentTagName}></${componentTagName}>`;

          // 4. 挂载 Vue 应用
          app.mount(container);
          this.vueApp = app;
          this.isMounted = true;

          console.log(`[SetContentExample] ✅ DualCanvasViewer 已挂载: ${this.containerId}`);
        });
      } catch (error) {
        console.error('[SetContentExample] 创建 Vue 应用失败:', error);
      }
    },

    disposeDualCanvasViewer() {
      if (!this.isMounted) {
        console.log('[SetContentExample] 未挂载，无需清理');
        return;
      }

      try {
        const container = document.getElementById(this.containerId);
        if (container && this.vueApp) {
          this.vueApp.unmount();
          this.vueApp = null;
          this.isMounted = false;
          console.log('[SetContentExample] ✅ DualCanvasViewer 已卸载');
        }
      } catch (error) {
        console.error('[SetContentExample] 清理失败:', error);
      }
    }
  }
};
</script>

<style scoped>
.set-content-example-content {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-message {
  padding: 20px;
  text-align: center;
  color: #888;
}

.dual-canvas-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 99995;
  pointer-events: auto;
}
</style>
