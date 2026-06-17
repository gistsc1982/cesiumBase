<template>
  <TestPanelModule
    ref="panel"
    title="双画布查看器"
    title-icon="🖥️"
    :width="400"
    :max-height="'70vh'"
    :initial-x="'right'"
    :initial-y="0"
    :auto-register="true"
    registration-key="SetContentExample"
    :visible="!isDualCanvasViewerActive"
    v-bind="$attrs"
  >
    <template #content="slotProps">
      <SetContentMjsExampleContent
        :is-closed="slotProps.isClosed"
        :panel-instance-id="slotProps.panelInstanceId"
        @initialized="handleInitialized"
        @disposed="handleDisposed"
        @close="handleClose"
      />
    </template>
  </TestPanelModule>
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';
import SetContentMjsExampleContent from './SetContentMjsExampleContent.vue';

export default {
  name: 'SetContentExample',
  components: {
    TestPanelModule,
    SetContentMjsExampleContent
  },
  data() {
    return {
      isDualCanvasViewerActive: false
    };
  },
  methods: {
    handleInitialized() {
      console.log('[SetContentExample] DualCanvasViewer 已初始化');
      this.isDualCanvasViewerActive = true;
    },
    handleDisposed() {
      console.log('[SetContentExample] DualCanvasViewer 已清理');
      this.isDualCanvasViewerActive = false;
    },
    handleClose() {
      console.log('[SetContentExample] 收到关闭请求，同步关闭 DualCanvasViewer 和 SetContentExample 面板');

      // 先关闭 DualCanvasViewer
      this.isDualCanvasViewerActive = false;

      // 然后关闭 SetContentExample 面板
      // 通过 PanelSingletonManager 关闭面板
      if (window.panelSingletonManager) {
        window.panelSingletonManager.closePanel('SetContentExample');
      } else if (this.$refs.panel && this.$refs.panel.$refs.basePanel && this.$refs.panel.$refs.basePanel.close) {
        // 备用方案：直接调用面板的 close 方法
        this.$refs.panel.$refs.basePanel.close();
      }
    }
  }
};
</script>

<style scoped>
/* 样式由 SetContentMjsExampleContent 处理 */
</style>
