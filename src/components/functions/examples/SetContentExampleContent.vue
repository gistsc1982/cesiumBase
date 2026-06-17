<template>
  <div v-show="!isClosed" ref="panelContent" class="set-content-example-content">
    <div class="loading-message">正在初始化双画布查看器...</div>
  </div>
</template>

<script>
export default {
  name: 'SetContentExampleContent',
  props: {
    // 面板的关闭状态
    isClosed: {
      type: Boolean,
      default: true  // 默认关闭，只有明确接收到 isClosed: false 时才初始化
    }
  },
  data() {
    return {
      containerId: 'set-content-dual-canvas-container',
      vueApp: null,
      isMounted: false,
      hasInitializedOnce: false
    };
  },
  mounted() {
    console.log('[SetContentExampleContent] mounted, isClosed:', this.isClosed);
  },
  watch: {
    // 监听面板的 isClosed 状态变化
    isClosed: {
      immediate: true,
      handler(newVal, oldVal) {
        console.log('[SetContentExampleContent] isClosed 状态变化:', { oldVal, newVal, hasInitializedOnce: this.hasInitializedOnce });
        // 只有当面板显示（isClosed 为 false）且尚未初始化时才初始化
        if (!newVal && !this.hasInitializedOnce) {
          console.log('[SetContentExampleContent] 条件满足：面板显示且未初始化，准备初始化');
          this.$nextTick(() => {
            console.log('[SetContentExampleContent] $nextTick 回调执行，开始初始化 dualCanvasViewer');
            this.initDualCanvasViewer();
          });
        } else {
          console.log('[SetContentExampleContent] 条件不满足：', {
            isClosed: newVal,
            hasInitializedOnce: this.hasInitializedOnce,
            reason: newVal ? '面板关闭' : '已初始化'
          });
        }
        // 如果面板关闭且已初始化，则清理
        if (newVal && this.hasInitializedOnce) {
          console.log('[SetContentExampleContent] 面板已关闭，清理 dualCanvasViewer');
          this.disposeDualCanvasViewer();
        }
      }
    }
  },
  beforeUnmount() {
    this.disposeDualCanvasViewer();
  },
  methods: {
    initDualCanvasViewer() {
      console.log('[SetContentExampleContent] initDualCanvasViewer() 被调用');

      if (this.isMounted) {
        console.log('[SetContentExampleContent] 已经挂载，跳过重复初始化');
        return;
      }

      console.log('[SetContentExampleContent] 检查 window.DualCanvasViewerPlugin...');
      // 检查全局 DualCanvasViewerPlugin 是否已加载
      if (typeof window !== 'undefined' && window.DualCanvasViewerPlugin) {
        console.log('[SetContentExampleContent] DualCanvasViewerPlugin 已就绪，开始挂载...');
        this.mountDualCanvasViewer();
      } else {
        console.warn('[SetContentExampleContent] DualCanvasViewerPlugin 未就绪，等待加载...');

        // 等待脚本加载完成
        setTimeout(() => {
          console.log('[SetContentExampleContent] 重新检查 DualCanvasViewerPlugin...');
          this.initDualCanvasViewer();
        }, 500);
      }
    },

    mountDualCanvasViewer() {
      if (this.isMounted) return;

      try {
        console.log('[SetContentExampleContent] 开始设置面板内容...');

        // ⭐ 再次检查 isClosed 状态，防止重复初始化
        if (this.isClosed) {
          console.warn('[SetContentExampleContent] 面板已关闭，取消初始化');
          return;
        }

        // 获取面板内容容器
        const panelContent = this.$refs.panelContent;
        if (!panelContent) {
          console.error('[SetContentExampleContent] panelContent 引用未找到');
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

        console.log('[SetContentExampleContent] 容器已创建，开始挂载组件...');
        this.createVueApp();
      } catch (error) {
        console.error('[SetContentExampleContent] 挂载失败:', error);
      }
    },

    createVueApp() {
      if (this.isMounted) return;

      try {
        // ⭐ 再次检查 isClosed 状态，防止重复初始化
        if (this.isClosed) {
          console.warn('[SetContentExampleContent] 面板已关闭，取消创建 Vue 应用');
          return;
        }

        console.log('[SetContentExampleContent] 开始创建 Vue 应用...');
        const iifeComponent = window.DualCanvasViewerPlugin;

        if (!iifeComponent) {
          console.error('[SetContentExampleContent] DualCanvasViewerPlugin 未找到');
          return;
        }

        // 获取容器元素
        const container = document.getElementById(this.containerId);
        if (!container) {
          console.error('[SetContentExampleContent] 容器未找到:', this.containerId);
          return;
        }

        console.log('[SetContentExampleContent] 容器已找到，开始挂载组件...');

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
          console.log(`[SetContentExampleContent] ✓ 已注册组件: ${componentTagName}`);

          // 3. 清空容器并添加组件标签
          container.innerHTML = `<${componentTagName}></${componentTagName}>`;

          // 4. 挂载 Vue 应用
          app.mount(container);
          this.vueApp = app;
          this.isMounted = true;
          this.hasInitializedOnce = true;

          console.log(`[SetContentExampleContent] ✅ DualCanvasViewer 已挂载: ${this.containerId}`);

          // 通知父组件已初始化
          this.$emit('initialized');
        });
      } catch (error) {
        console.error('[SetContentExampleContent] 创建 Vue 应用失败:', error);
      }
    },

    disposeDualCanvasViewer() {
      if (!this.isMounted) {
        console.log('[SetContentExampleContent] 未挂载，无需清理');
        return;
      }

      try {
        const container = document.getElementById(this.containerId);
        if (container && this.vueApp) {
          this.vueApp.unmount();
          this.vueApp = null;
          this.isMounted = false;
          console.log('[SetContentExampleContent] ✅ DualCanvasViewer 已卸载');

          // 通知父组件已清理
          this.$emit('disposed');
        }
      } catch (error) {
        console.error('[SetContentExampleContent] 清理失败:', error);
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
