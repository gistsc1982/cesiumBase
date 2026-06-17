<template>
  <div v-show="!isClosed" ref="panelContent" class="set-content-mjs-example-content">
    <div class="loading-message">正在初始化双画布查看器（MJS模式）...</div>
  </div>
</template>

<script>
export default {
  name: 'SetContentMjsExampleContent',
  props: {
    // 面板的关闭状态
    isClosed: {
      type: Boolean,
      default: true  // 默认关闭，只有明确接收到 isClosed: false 时才初始化
    },
    // 多实例面板ID（支持多实例调用）
    panelInstanceId: {
      type: Number,
      default: null
    },
    // ⭐ 基于配置文件的单例/多实例模式判断（来自 functionPanels.config.json）
    isSingleton: {
      type: Boolean,
      default: true  // 默认为单例模式
    }
  },
  data() {
    return {
      vueApp: null,
      isMounted: false,
      hasInitializedOnce: false,
      mjsComponent: null  // 保存 MJS 组件引用
    };
  },
  computed: {
    /**
     * ⭐ 使用 isSingleton 配置判断模式，生成唯一的容器ID
     * - 单例模式 (isSingleton = true): 使用 baseId
     * - 多实例模式 (isSingleton = false): 使用 baseId-panelInstanceId
     */
    containerId() {
      const baseId = 'set-content-mjs-dual-canvas-container';
      // 多实例模式且 panelInstanceId 不为空时，添加后缀
      if (!this.isSingleton && this.panelInstanceId !== null) {
        return `${baseId}-${this.panelInstanceId}`;
      }
      return baseId;
    },
    closeBtnId() {
      return `${this.containerId}-close`;
    },
    /**
     * ⭐ 多实例模式判断（基于配置文件）
     * 与 isSingleton 相反
     */
    isMultiInstance() {
      return !this.isSingleton;
    }
  },
  created() {
    console.log('[SetContentMjsExampleContent] ✅ 组件已创建, isClosed:', this.isClosed, 'panelInstanceId:', this.panelInstanceId);
  },
  mounted() {
    console.log('[SetContentMjsExampleContent] ✅ 组件已挂载, isClosed:', this.isClosed);
  },
  watch: {
    // 监听面板的 isClosed 状态变化
    isClosed: {
      immediate: true,
      handler(newVal, oldVal) {
        console.log('[SetContentMjsExampleContent] isClosed 状态变化:', {
          oldVal,
          newVal,
          hasInitializedOnce: this.hasInitializedOnce,
          panelInstanceId: this.panelInstanceId,
          isSingleton: this.isSingleton,
          isMultiInstance: this.isMultiInstance
        });

        // ⭐ 使用基于配置文件的判断（isSingleton 来自 functionPanels.config.json）
        // 单例模式：只初始化一次
        // 多实例模式：每次显示都重新初始化
        const shouldInitialize = !newVal && (
          this.isMultiInstance || // 多实例模式：每次都初始化
          !this.hasInitializedOnce // 单例模式：只初始化一次
        );

        if (shouldInitialize) {
          console.log('[SetContentMjsExampleContent] 条件满足：准备初始化', {
            mode: this.isMultiInstance ? '多实例' : '单例',
            source: 'functionPanels.config.json',
            panelInstanceId: this.panelInstanceId
          });
          this.$nextTick(() => {
            console.log('[SetContentMjsExampleContent] $nextTick 回调执行，开始初始化 dualCanvasViewer (MJS)');
            this.initDualCanvasViewer();
          });
        } else {
          console.log('[SetContentMjsExampleContent] 条件不满足：', {
            isClosed: newVal,
            hasInitializedOnce: this.hasInitializedOnce,
            panelInstanceId: this.panelInstanceId,
            isSingleton: this.isSingleton,
            isMultiInstance: this.isMultiInstance,
            reason: newVal ? '面板关闭' : '已初始化（单例模式）'
          });
        }
        // 如果面板关闭且已初始化，则清理
        if (newVal && this.hasInitializedOnce) {
          console.log('[SetContentMjsExampleContent] 面板已关闭，清理 dualCanvasViewer (MJS)');
          this.disposeDualCanvasViewer();
        }
      }
    }
  },
  beforeUnmount() {
    this.disposeDualCanvasViewer();
  },
  methods: {
    async initDualCanvasViewer() {
      console.log('[SetContentMjsExampleContent] initDualCanvasViewer() 被调用 (MJS模式)');

      if (this.isMounted) {
        console.log('[SetContentMjsExampleContent] 已经挂载，跳过重复初始化');
        return;
      }

      try {
        // 检查 vue3-sfc-loader 是否可用
        if (typeof window === 'undefined' || !window['vue3-sfc-loader']) {
          console.error('[SetContentMjsExampleContent] vue3-sfc-loader 不可用');
          return;
        }

        const { loadModule } = window['vue3-sfc-loader'];
        // ⭐ 关键修复：使用动态导入 Vue，而不是全局 Vue
        const Vue = await import('vue');

        console.log('[SetContentMjsExampleContent] 开始加载 DualCanvasViewer MJS 组件...');

        // 资源路径解析函数
        const resolveResourcePath = async (relativePath) => {
          const pathPatterns = [
            `./test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`,
            `./public/test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`,
            `../test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`,
            `../../public/test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`
          ];

          for (const pattern of pathPatterns) {
            try {
              const testUrl = pattern.startsWith('http') ? pattern : `${window.location.origin}/${pattern.replace(/^\.\//, '').replace(/^\.\.\//, '')}`;
              const response = await fetch(testUrl);
              if (response.ok) {
                console.log(`[SetContentMjsExampleContent] 资源路径解析成功: ${pattern}`);
                return pattern;
              }
            } catch (e) {
              continue;
            }
          }
          console.warn(`[SetContentMjsExampleContent] 所有路径模式失败，使用默认路径`);
          return `./test-sfc/sfcLib/dist/dual-canvas-viewer-sfc/${relativePath}`;
        };

        // 解析 CSS 和组件文件路径
        const cssPattern = await resolveResourcePath('lib/dual-canvas-viewer.css');
        const componentPattern = await resolveResourcePath('lib/dual-canvas-viewer.mjs');

        console.log('[SetContentMjsExampleContent] 资源路径:', { css: cssPattern, component: componentPattern });

        // 加载 CSS
        const loadCSS = (href) => {
          return new Promise((resolve, reject) => {
            if (document.querySelector(`link[href="${href}"]`)) {
              resolve();
              return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
          });
        };

        await loadCSS(cssPattern);
        console.log('[SetContentMjsExampleContent] CSS 已加载');

        // ⭐ vue3-sfc-loader 配置（与 DualCanvasViewerMulti 一致）
        const options = {
          moduleCache: {
            vue: Vue
          },
          getFile: async (url) => {
            console.log('[SetContentMjsExampleContent] 获取文件:', url);
            try {
              const res = await fetch(url, {
                cache: 'no-cache',
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              console.log('[SetContentMjsExampleContent] fetch 响应状态:', res.status, res.statusText);
              if (!res.ok) {
                throw new Error('无法加载文件: ' + url + ' (' + res.status + ' ' + res.statusText + ')');
              }
              const content = await res.text();
              console.log('[SetContentMjsExampleContent] ✅ 文件内容获取成功，长度:', content.length);
              return content;
            } catch (error) {
              console.error('[SetContentMjsExampleContent] ❌ getFile 错误:', error);
              throw error;
            }
          },
          addStyle: (content) => {
            const style = document.createElement('style');
            style.textContent = content;
            document.head.appendChild(style);
          }
        };

        // ⭐ 使用 loadModule 加载 MJS 组件
        const componentPath = componentPattern;
        console.log('[SetContentMjsExampleContent] 加载 MJS 组件:', componentPath);

        try {
          const DualCanvasViewerComponent = await loadModule(componentPath, options);
          console.log('[SetContentMjsExampleContent] ✅ loadModule 成功:', DualCanvasViewerComponent);

          // ⭐ 关键修复：将容器直接添加到 body，而不是面板内容区域
          // 这样 DualCanvasViewer 才能真正全屏显示
          let container = document.getElementById(this.containerId);
          if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            container.className = 'dual-canvas-wrapper dual-canvas-overlay-single';
            // ⭐ 多实例模式：根据 panelInstanceId 调整 z-index（基于 isSingleton 配置）
            const zIndex = !this.isSingleton && this.panelInstanceId !== null
              ? 100000 + this.panelInstanceId * 100
              : 100000;
            container.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: ${zIndex}; background: transparent; pointer-events: auto;`;
            document.body.appendChild(container);
            console.log('[SetContentMjsExampleContent] 容器已添加到 body:', this.containerId, 'zIndex:', zIndex);
          } else {
            console.log('[SetContentMjsExampleContent] 容器已存在:', this.containerId);
          }

          // ⭐ 添加关闭按钮（与 CesiumMain 中的实现一致）
          let closeBtn = document.getElementById(this.closeBtnId);
          if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.id = this.closeBtnId;
            closeBtn.textContent = '× 关闭';
            closeBtn.className = 'dual-canvas-instance-close';
            // ⭐ 多实例模式：调整关闭按钮的 z-index（基于 isSingleton 配置）
            const closeBtnZIndex = !this.isSingleton && this.panelInstanceId !== null
              ? 101500 + this.panelInstanceId * 100
              : 101500;
            closeBtn.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              z-index: ${closeBtnZIndex};
              padding: 8px 16px;
              background: rgba(244, 67, 54, 0.9);
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              pointer-events: auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            `;
            closeBtn.onclick = () => this.handleExitFullscreen();
            document.body.appendChild(closeBtn);
            console.log('[SetContentMjsExampleContent] 关闭按钮已添加到 body:', this.closeBtnId, 'zIndex:', closeBtnZIndex);
          } else {
            console.log('[SetContentMjsExampleContent] 关闭按钮已存在:', this.closeBtnId);
          }

          // ⭐ 清空面板内容，避免同时显示两份内容
          const panelContent = this.$refs.panelContent;
          if (panelContent) {
            console.log('[SetContentMjsExampleContent] 开始更新面板内容...');
            console.log('[SetContentMjsExampleContent] panelContent 原始内容:', panelContent.innerHTML);
            panelContent.innerHTML = '<div class="fullscreen-hint">DualCanvasViewer 已全屏显示</div>';
            console.log('[SetContentMjsExampleContent] panelContent 更新后内容:', panelContent.innerHTML);
            console.log('[SetContentMjsExampleContent] 面板内容已清空，显示提示信息');
          } else {
            console.warn('[SetContentMjsExampleContent] panelContent 引用未找到');
          }

          console.log('[SetContentMjsExampleContent] 容器已创建，等待 DOM 布局完成...');
          console.log('[SetContentMjsExampleContent] 容器初始尺寸:', container.offsetWidth, 'x', container.offsetHeight);

          // 等待 DOM 布局完成后再挂载组件
          // 使用多次 requestAnimationFrame 确保浏览器已完成渲染布局
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));

          console.log('[SetContentMjsExampleContent] DOM 布局完成，容器尺寸:', container.offsetWidth, 'x', container.offsetHeight);
          console.log('[SetContentMjsExampleContent] 开始挂载组件...');

          // 创建 Vue 应用实例
          const DualCanvasApp = Vue.createApp(DualCanvasViewerComponent.default);

          // 挂载组件
          const appInstance = DualCanvasApp.mount(container);

          this.vueApp = DualCanvasApp;
          this.mjsComponent = appInstance;
          this.isMounted = true;
          this.hasInitializedOnce = true;

          console.log('[SetContentMjsExampleContent] ✅ DualCanvasViewer 已挂载 (MJS):', this.containerId);

          // 通知父组件已初始化
          this.$emit('initialized');

        } catch (loadError) {
          console.error('[SetContentMjsExampleContent] ❌ loadModule 失败:', loadError);
          console.error('[SetContentMjsExampleContent] 错误堆栈:', loadError.stack);
          console.error('[SetContentMjsExampleContent] 错误详情:', loadError.message);
        }

      } catch (error) {
        console.error('[SetContentMjsExampleContent] MJS 加载失败:', error);
        console.error('[SetContentMjsExampleContent] 错误详情:', error.stack);
      }
    },

    handleExitFullscreen() {
      console.log('[SetContentMjsExampleContent] 退出全屏模式');

      // 清理 DualCanvasViewer 和关闭按钮
      this.disposeDualCanvasViewer();

      // 重置初始化标志，允许重新打开
      this.hasInitializedOnce = false;

      // 触发关闭事件，让父组件处理面板关闭
      this.$emit('close');
    },

    disposeDualCanvasViewer() {
      if (!this.isMounted) {
        console.log('[SetContentMjsExampleContent] 未挂载，无需清理');
        return;
      }

      try {
        const container = document.getElementById(this.containerId);
        if (container && this.vueApp) {
          // 先卸载 Vue 应用
          this.vueApp.unmount();
          this.vueApp = null;
          this.mjsComponent = null;

          // 清理容器 DOM 元素
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }

          // ⭐ 清理关闭按钮（使用计算属性）
          const closeBtn = document.getElementById(this.closeBtnId);
          if (closeBtn && closeBtn.parentNode) {
            closeBtn.parentNode.removeChild(closeBtn);
            console.log('[SetContentMjsExampleContent] ✅ 关闭按钮已清理:', this.closeBtnId);
          }

          this.isMounted = false;
          console.log('[SetContentMjsExampleContent] ✅ DualCanvasViewer 已卸载 (MJS)，容器已清理:', this.containerId);

          // 通知父组件已清理
          this.$emit('disposed');
        }
      } catch (error) {
        console.error('[SetContentMjsExampleContent] 清理失败:', error);
      }
    }
  }
};
</script>

<style scoped>
.set-content-mjs-example-content {
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
