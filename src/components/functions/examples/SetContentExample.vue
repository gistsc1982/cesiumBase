<template>
  <TestPanelModule
    ref="panel"
    title="高度调整面板"
    title-icon="🌏"
    :width="360"
    :initial-x="'right'"
    :initial-y="200"
    registration-key="SetContentExample"
  />
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';
import ObliqueHeightAdjustPanel from '../ObliqueHeightAdjustPanel.vue';

export default {
  name: 'SetContentExample',
  components: {
    TestPanelModule
  },
  data() {
    return {
      selectedLayer: null,
      computedHeightPanelX: 'right',
      initialY: 200,
      showHeightPanel: true
    };
  },
  mounted() {
    // 方式1: 使用组件对象
    this.$refs.panel.setContent(ObliqueHeightAdjustPanel, {
      props: {
        'initial-x': this.computedHeightPanelX,
        'initial-y': this.initialY,
        'selected-layer': this.selectedLayer
      },
      events: {
        'height-preview': this.onHeightPreview,
        'height-change': this.onHeightChange,
        'close': () => { this.showHeightPanel = false; }
      },
      title: '倾斜摄影高度调整',
      titleIcon: '🌏'
    });
  },
  methods: {
    onHeightPreview({ layer, value }) {
      console.log('高度预览:', layer, value);
    },
    onHeightChange({ layer, value }) {
      console.log('高度变化:', layer, value);
    }
  }
};

// ==================== 静态配置管理方法 ====================

/**
 * 添加单例面板配置（静态方法）
 */
SetContentExample.addSingletonPanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addSingletonPanelConfig } = await import('../PanelConfigManager.js');
  return await addSingletonPanelConfig({
    name: 'SetContentExample',
    file: 'examples/SetContentExample.vue',
    title: 'SetContent 示例',
    description: 'TestPanelModule setContent 方法使用示例',
    icon: '📦',
    category: 'test',
    position: { initialX: 'right', initialY: 200 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 添加多实例面板配置（静态方法）
 */
SetContentExample.addMultiInstancePanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addMultiInstancePanelConfig } = await import('../PanelConfigManager.js');
  return await addMultiInstancePanelConfig({
    name: 'SetContentExample',
    file: 'examples/SetContentExample.vue',
    title: 'SetContent 示例（多实例）',
    description: 'TestPanelModule setContent 方法使用示例（多实例）',
    icon: '🧬',
    category: 'test',
    position: { initialX: 'center', initialY: 280 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 同时添加单例和多实例面板配置（静态方法）
 */
SetContentExample.addBothPanelConfigs = async function(config = {}, saveAndDownload = false) {
  const { addBothPanelConfigs } = await import('../PanelConfigManager.js');
  return await addBothPanelConfigs({
    name: 'SetContentExample',
    file: 'examples/SetContentExample.vue',
    title: 'SetContent 示例',
    description: 'TestPanelModule setContent 方法使用示例',
    icon: '📦',
    category: 'test',
    singletonPosition: { initialX: 'right', initialY: 200 },
    multiInstancePosition: { initialX: 'center', initialY: 280 },
    ...config
  }, saveAndDownload);
};

/**
 * 删除面板配置（静态方法）
 */
SetContentExample.removePanelConfig = async function(name = null, saveAndDownload = false) {
  const { removePanelConfig } = await import('../PanelConfigManager.js');
  return await removePanelConfig(name || 'SetContentExample', saveAndDownload);
};
</script>
