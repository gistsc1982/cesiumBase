<template>
  <div v-show="!isClosed" ref="panelContent" class="set-content-example-content">
    <div class="loading-message">正在初始化双画布查看器...</div>
  </div>
</template>

<script>
export default {
  name: 'SetContentIifeExampleContent',
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
      hasInitializedOnce: false,
      iifeComponent: null  // 保存全局组件引用
    };
  },
  mounted() {
    console.log('[SetContentIifeExampleContent] mounted, isClosed:', this.isClosed);
  },
  watch: {
    // 监听面板的 isClosed 状态变化
    isClosed: {
      immediate: true,
      handler(newVal, oldVal) {
        console.log('[SetContentIifeExampleContent] isClosed 状态变化:', { oldVal, newVal, hasInitializedOnce: this.hasInitializedOnce });
        // 只有当面板显示（isClosed 为 false）且尚未初始化时才初始化
        if (!newVal && !this.hasInitializedOnce) {
          console.log('[SetContentIifeExampleContent] 条件满足：面板显示且未初始化，准备初始化');
          this.$nextTick(() => {
            console.log('[SetContentIifeExampleContent] $nextTick 回调执行，开始初始化 dualCanvasViewer');
            this.initDualCanvasViewer();
          });
        } else {
          console.log('[SetContentIifeExampleContent] 条件不满足：', {
            isClosed: newVal,
            hasInitializedOnce: this.hasInitializedOnce,
            reason: newVal ? '面板关闭' : '已初始化'
          });
        }
        // 如果面板关闭且已初始化，则清理
        if (newVal && this.hasInitializedOnce) {
          console.log('[SetContentIifeExampleContent] 面板已关闭，清理 dualCanvasViewer');
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
      console.log('[SetContentIifeExampleContent] initDualCanvasViewer() 被调用');

      if (this.isMounted) {
        console.log('[SetContentIifeExampleContent] 已经挂载，跳过重复初始化');
        return;
      }

      console.log('[SetContentIifeExampleContent] 检查 window.DualCanvasViewerPlugin...');
      // 检查全局 DualCanvasViewerPlugin 是否已加载
      if (typeof window !== 'undefined' && window.DualCanvasViewerPlugin) {
        console.log('[SetContentIifeExampleContent] DualCanvasViewerPlugin 已就绪，开始挂载...');
        this.mountDualCanvasViewer();
      } else {
        console.warn('[SetContentIifeExampleContent] DualCanvasViewerPlugin 未就绪，等待加载...');

        // 等待脚本加载完成
        setTimeout(() => {
          console.log('[SetContentIifeExampleContent] 重新检查 DualCanvasViewerPlugin...');
          this.initDualCanvasViewer();
        }, 500);
      }
    },

    mountDualCanvasViewer() {
      if (this.isMounted) return;

      try {
        console.log('[SetContentIifeExampleContent] 开始设置面板内容...');

        // ⭐ 再次检查 isClosed 状态，防止重复初始化
        if (this.isClosed) {
          console.warn('[SetContentIifeExampleContent] 面板已关闭，取消初始化');
          return;
        }

        // 获取面板内容容器
        const panelContent = this.$refs.panelContent;
        if (!panelContent) {
          console.error('[SetContentIifeExampleContent] panelContent 引用未找到');
          return;
        }

        // 创建容器元素
        const container = document.createElement('div');
        container.id = this.containerId;
        container.className = 'dual-canvas-wrapper';
        // ⭐ 不设置内联样式，让 CSS 类控制全屏显示
        // 这样 DualCanvasViewer 可以全屏显示

        // 清空面板内容并添加容器
        panelContent.innerHTML = '';
        panelContent.appendChild(container);

        console.log('[SetContentIifeExampleContent] 容器已创建，开始挂载组件...');
        this.createVueApp();
      } catch (error) {
        console.error('[SetContentIifeExampleContent] 挂载失败:', error);
      }
    },

    createVueApp() {
      if (this.isMounted) return;

      try {
        // ⭐ 再次检查 isClosed 状态，防止重复初始化
        if (this.isClosed) {
          console.warn('[SetContentIifeExampleContent] 面板已关闭，取消创建 Vue 应用');
          return;
        }

        console.log('[SetContentIifeExampleContent] 开始创建 Vue 应用...');

        // ⭐ 检查全局 DualCanvasViewerPlugin 是否存在
        const iifeComponent = window.DualCanvasViewerPlugin;
        if (!iifeComponent) {
          console.error('[SetContentIifeExampleContent] DualCanvasViewerPlugin 未找到');
          return;
        }

        // ⭐ 检查是否有冲突的全局状态
        if (iifeComponent.__isInUse) {
          console.warn('[SetContentIifeExampleContent] DualCanvasViewerPlugin 已被其他实例使用，尝试重置状态');
          // 重置状态
          delete iifeComponent.__isInUse;
        }

        // 标记为正在使用
        iifeComponent.__isInUse = true;
        this.iifeComponent = iifeComponent;

        if (!iifeComponent) {
          console.error('[SetContentIifeExampleContent] DualCanvasViewerPlugin 未找到');
          return;
        }

        // 获取容器元素
        const container = document.getElementById(this.containerId);
        if (!container) {
          console.error('[SetContentIifeExampleContent] 容器未找到:', this.containerId);
          return;
        }

        console.log('[SetContentIifeExampleContent] 容器已找到，开始挂载组件...');

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

          // 2. 注册 DualCanvasViewer 组件（作为根组件）
          const componentTagName = 'dual-canvas-viewer-plugin';
          app.component(componentTagName, iifeComponent);
          console.log(`[SetContentIifeExampleContent] ✓ 已注册组件: ${componentTagName}`);

          // 3. 清空容器并添加组件根元素
          container.innerHTML = `<${componentTagName}></${componentTagName}>`;

          // 4. 挂载 Vue 应用（DualCanvasViewer 会自己渲染内部结构）
          app.mount(container);
          this.vueApp = app;
          this.isMounted = true;
          this.hasInitializedOnce = true;

          console.log(`[SetContentIifeExampleContent] ✅ DualCanvasViewer 已挂载: ${this.containerId}`);

          // 通知父组件已初始化
          this.$emit('initialized');
        });
      } catch (error) {
        console.error('[SetContentIifeExampleContent] 创建 Vue 应用失败:', error);
      }
    },

    disposeDualCanvasViewer() {
      if (!this.isMounted) {
        console.log('[SetContentIifeExampleContent] 未挂载，无需清理');
        return;
      }

      try {
        const container = document.getElementById(this.containerId);
        if (container && this.vueApp) {
          // 先卸载 Vue 应用
          this.vueApp.unmount();
          this.vueApp = null;

          // 清理容器 DOM 元素
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }

          // ⭐ 清理全局状态
          if (this.iifeComponent && this.iifeComponent.__isInUse) {
            delete this.iifeComponent.__isInUse;
            console.log('[SetContentIifeExampleContent] ✅ 已清理全局状态');
          }
          this.iifeComponent = null;

          this.isMounted = false;
          console.log('[SetContentIifeExampleContent] ✅ DualCanvasViewer 已卸载，容器已清理');

          // 通知父组件已清理
          this.$emit('disposed');
        }
      } catch (error) {
        console.error('[SetContentIifeExampleContent] 清理失败:', error);
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
