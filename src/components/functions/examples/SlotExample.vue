<template>
  <TestPanelModule
    ref="panel"
    title="自定义面板示例"
    title-icon="🚀"
    :width="400"
    registration-key="SlotExample"
  >
    <!-- 替换主内容 -->
    <template #content>
      <div class="custom-content">
        <h3>自定义内容区域</h3>
        <p>这是通过插槽替换的内容</p>
        <button @click="handleClick">点击测试</button>
      </div>
    </template>
  </TestPanelModule>
</template>

<script>
import TestPanelModule from '../TestPanelModule.vue';

export default {
  name: 'SlotExample',
  components: {
    TestPanelModule
  },
  methods: {
    handleClick() {
      console.log('自定义按钮点击');
      alert('自定义内容工作正常！');
    }
  }
};

// ==================== 静态配置管理方法 ====================

/**
 * 添加单例面板配置（静态方法）
 */
SlotExample.addSingletonPanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addSingletonPanelConfig } = await import('../PanelConfigManager.js');
  return await addSingletonPanelConfig({
    name: 'SlotExample',
    file: 'examples/SlotExample.vue',
    title: '插槽示例',
    description: 'TestPanelModule 插槽使用示例',
    icon: '🎨',
    category: 'test',
    position: { initialX: 'right', initialY: 360 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 添加多实例面板配置（静态方法）
 */
SlotExample.addMultiInstancePanelConfig = async function(config = {}, saveAndDownload = false) {
  const { addMultiInstancePanelConfig } = await import('../PanelConfigManager.js');
  return await addMultiInstancePanelConfig({
    name: 'SlotExample',
    file: 'examples/SlotExample.vue',
    title: '插槽示例（多实例）',
    description: 'TestPanelModule 插槽使用示例（多实例）',
    icon: '🖼️',
    category: 'test',
    position: { initialX: 'center', initialY: 440 },
    enabled: true,
    visible: false,
    ...config
  }, saveAndDownload);
};

/**
 * 同时添加单例和多实例面板配置（静态方法）
 */
SlotExample.addBothPanelConfigs = async function(config = {}, saveAndDownload = false) {
  const { addBothPanelConfigs } = await import('../PanelConfigManager.js');
  return await addBothPanelConfigs({
    name: 'SlotExample',
    file: 'examples/SlotExample.vue',
    title: '插槽示例',
    description: 'TestPanelModule 插槽使用示例',
    icon: '🎨',
    category: 'test',
    singletonPosition: { initialX: 'right', initialY: 360 },
    multiInstancePosition: { initialX: 'center', initialY: 440 },
    ...config
  }, saveAndDownload);
};

/**
 * 删除面板配置（静态方法）
 */
SlotExample.removePanelConfig = async function(name = null, saveAndDownload = false) {
  const { removePanelConfig } = await import('../PanelConfigManager.js');
  return await removePanelConfig(name || 'SlotExample', saveAndDownload);
};
</script>

<style scoped>
.custom-content {
  padding: 20px;
  text-align: center;
}

.custom-content h3 {
  color: #4CAF50;
  margin-bottom: 12px;
}

.custom-content p {
  color: #b0b0b0;
  margin-bottom: 16px;
}

.custom-content button {
  padding: 10px 20px;
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  border-radius: 6px;
  color: #4CAF50;
  cursor: pointer;
  transition: all 0.2s;
}

.custom-content button:hover {
  background: rgba(76, 175, 80, 0.3);
  transform: translateY(-1px);
}
</style>
