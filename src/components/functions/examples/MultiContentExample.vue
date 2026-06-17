<template>
  <TestPanelModule
    ref="panel"
    title="多内容面板"
    :auto-register="autoRegister !== undefined ? autoRegister : true"
    :registration-key="registrationKey || 'MultiContentExample'"
    :panel-instance-id="panelInstanceId"
    :initial-x="initialX"
    :initial-y="initialY"
    v-bind="$attrs"
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
  props: {
    // ⭐ 接收多实例面板的属性
    registrationKey: {
      type: String,
      default: 'MultiContentExample'
    },
    panelInstanceId: {
      type: Number,
      default: null
    },
    autoRegister: {
      type: Boolean,
      default: true
    },
    initialX: {
      type: [Number, String],
      default: 'center'
    },
    initialY: {
      type: Number,
      default: 280
    }
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
