<template>
  <TestPanelModule
    ref="panel"
    title="多内容面板"
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

// ==================== 静态配置管理方法 ====================

/**
 * 添加单例面板配置（静态方法）
 */
MultiContentExample.addSingletonPanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addSingletonPanelConfig } = await import('../PanelConfigManager.js');
  return await addSingletonPanelConfig({
    name: 'MultiContentExample',
    file: 'examples/MultiContentExample.vue',
    title: '多内容切换示例',
    description: 'TestPanelModule 动态切换内容示例',
    icon: '🔄',
    category: 'test',
    position: { initialX: 'right', initialY: 280 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 添加多实例面板配置（静态方法）
 */
MultiContentExample.addMultiInstancePanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addMultiInstancePanelConfig } = await import('../PanelConfigManager.js');
  return await addMultiInstancePanelConfig({
    name: 'MultiContentExample',
    file: 'examples/MultiContentExample.vue',
    title: '多内容切换示例（多实例）',
    description: 'TestPanelModule 动态切换内容示例（多实例）',
    icon: '🔀',
    category: 'test',
    position: { initialX: 'center', initialY: 360 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 同时添加单例和多实例面板配置（静态方法）
 */
MultiContentExample.addBothPanelConfigs = async function(config = {}, saveAndDownload = false) {
  const { addBothPanelConfigs } = await import('../PanelConfigManager.js');
  return await addBothPanelConfigs({
    name: 'MultiContentExample',
    file: 'examples/MultiContentExample.vue',
    title: '多内容切换示例',
    description: 'TestPanelModule 动态切换内容示例',
    icon: '🔄',
    category: 'test',
    singletonPosition: { initialX: 'right', initialY: 280 },
    multiInstancePosition: { initialX: 'center', initialY: 360 },
    ...config
  }, saveAndDownload);
};

/**
 * 删除面板配置（静态方法）
 */
MultiContentExample.removePanelConfig = async function(name = null, saveAndDownload = false) {
  const { removePanelConfig } = await import('../PanelConfigManager.js');
  return await removePanelConfig(name || 'MultiContentExample', saveAndDownload);
};
</script>
