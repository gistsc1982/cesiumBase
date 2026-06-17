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
    <template #content="slotProps">
      <SetContentExampleContent
        :is-closed="slotProps.isClosed"
        @initialized="handleInitialized"
        @disposed="handleDisposed"
      />
    </template>
  </TestPanelModule>
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';
import SetContentExampleContent from './SetContentExampleContent.vue';

export default {
  name: 'SetContentExample',
  components: {
    TestPanelModule,
    SetContentExampleContent
  },
  methods: {
    handleInitialized() {
      console.log('[SetContentExample] DualCanvasViewer 已初始化');
    },
    handleDisposed() {
      console.log('[SetContentExample] DualCanvasViewer 已清理');
    }
  }
};
</script>

<style scoped>
/* 样式由 SetContentExampleContent 处理 */
</style>
