<template>
  <TestPanelModule
    ref="panel"
    title="多内容面板"
    :auto-register="true"
    registration-key="MultiContentExample"
  >
    <template #toolbar-extra>
      <button @click="switchToHeightPanel">高度调整</button>
      <button @click="switchToPhotoPanel">倾斜摄影</button>
    </template>
  </TestPanelModule>
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';
import ObliqueHeightAdjustPanel from '../ObliqueHeightAdjustPanel.vue';
import ObliquePhotographyPanel from '../ObliquePhotographyPanel.vue';

export default {
  name: 'MultiContentExample',
  components: {
    TestPanelModule
  },
  data() {
    return {
      selectedLayer: null
    };
  },
  methods: {
    switchToHeightPanel() {
      this.$refs.panel.setContent(ObliqueHeightAdjustPanel, {
        props: {
          'selected-layer': this.selectedLayer
        },
        events: {
          'height-change': this.handleHeightChange
        },
        title: '高度调整',
        titleIcon: '🌏'
      });
    },
    switchToPhotoPanel() {
      this.$refs.panel.setContent(ObliquePhotographyPanel, {
        props: {
          'initial-x': 'center',
          'initial-y': 120
        },
        events: {
          'layer-loaded': this.handleLayerLoaded
        },
        title: '倾斜摄影',
        titleIcon: '📷'
      });
    },
    handleHeightChange(data) {
      console.log('高度变化:', data);
    },
    handleLayerLoaded(data) {
      console.log('图层加载:', data);
    }
  }
};
</script>
