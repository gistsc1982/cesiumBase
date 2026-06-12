<template>
  <div
    class="test-sfc-modal"
    :class="{ 'is-dragging': isDragging }"
    :style="{
      left: position.x === 'auto' ? 'auto' : position.x + 'px',
      top: position.y + 'px',
      right: position.x === 'auto' ? right + 'px' : 'auto'
    }"
    ref="modalRef"
  >
    <div
      class="test-sfc-header"
      @mousedown="startDrag"
      :class="{ 'dragging': isDragging }"
    >
      <h3>🧪 TestSfc 测试组件</h3>
      <button @click="handleClose" class="close-btn">×</button>
    </div>
    <div class="test-sfc-body">
      <div class="location-form">
        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">📍</span>
            <span>经度</span>
          </label>
          <input
            v-model.number="longitude"
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            class="form-input"
            placeholder="输入经度 (-180 ~ 180)"
          >
        </div>
        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">🌐</span>
            <span>纬度</span>
          </label>
          <input
            v-model.number="latitude"
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            class="form-input"
            placeholder="输入纬度 (-90 ~ 90)"
          >
        </div>
        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">🔭</span>
            <span>高度</span>
          </label>
          <input
            v-model.number="height"
            type="number"
            step="0.1"
            class="form-input"
            placeholder="输入高度 (米)"
          >
        </div>
        <div class="form-group">
          <label class="form-label">
            <span class="label-icon">⤵</span>
            <span>俯仰角</span>
          </label>
          <input
            v-model.number="pitch"
            type="number"
            step="0.1"
            min="-90"
            max="0"
            class="form-input"
            placeholder="俯仰角 (-90 ~ 0)"
          >
        </div>
        <button @click="handleLocate" class="locate-btn">
          <span class="btn-icon">🎯</span>
          <span>定位</span>
        </button>
        <div v-if="locateMessage" :class="['locate-message', messageType]">
          {{ locateMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SfcBase from './SfcBase.vue';

export default {
  name: 'TestSfc',
  extends: SfcBase,
  props: {
    onClose: {
      type: Function,
      default: null
    }
  },
  inject: {
    closeEventName: {
      default: 'testSfcClose'
    },
    instanceId: {
      default: 1
    }
  },
  data() {
    return {
      // 组件名称（用于日志）
      componentName: 'TestSfc',
      // 经纬度定位数据
      longitude: 0,
      latitude: 0,
      height: 1000,
      pitch: -45,
      locateMessage: '',
      messageType: 'info',
      // 拖动相关 - 初始位置在右侧
      position: { x: 'auto', y: 0 },
      right: 20,
      isDragging: false,
      dragStart: { x: 0, y: 0 },
      initialPosition: { x: 0, y: 0 },
      // 绑定的事件处理器
      boundOnDrag: null,
      boundStopDrag: null
    };
  },
  methods: {
    // ==================== TestSfc 特有方法 ====================

    /**
     * 执行定位操作
     */
    executeLocate() {
      // 再次检查 Cesium 是否就绪
      if (!this.checkCesiumReady()) {
        this.showMessage('Cesium 未就绪，无法定位', 'error');
        return;
      }

      this.showMessage('正在定位...', 'info');

      // 使用基类的 flyToPosition 方法
      this.flyToPosition(
        this.longitude,
        this.latitude,
        this.height,
        {
          heading: 0,
          pitch: Cesium.Math.toRadians(this.pitch || -45),
          roll: 0
        },
        2.0
      )
        .then(() => {
          this.showMessage(`定位成功: 经度 ${this.longitude.toFixed(6)}, 纬度 ${this.latitude.toFixed(6)}`, 'success');
        })
        .catch((error) => {
          this.showMessage('定位失败: ' + error.message, 'error');
        });
    },

    /**
     * 处理定位按钮点击
     */
    handleLocate() {
      // 使用基类的 validateLonLat 方法验证坐标
      const validation = this.validateLonLat(this.longitude, this.latitude, this.height);
      if (!validation.valid) {
        this.showMessage(validation.message, 'error');
        return;
      }

      // 检查 Cesium 是否就绪
      if (!this.checkCesiumReady()) {
        this.showMessage('等待 Cesium 初始化...', 'info');
        // 等待 Cesium 就绪后再执行定位
        this.waitForCesium(() => {
          this.executeLocate();
        }, 20);
        return;
      }

      this.executeLocate();
    },

    /**
     * 覆盖基类的 showMessage 方法，使用 TestSfc 特有的消息显示方式
     */
    showMessage(message, type = 'info', duration = 3000) {
      // 调用基类的 showMessage（记录日志）
      super.showMessage(message, type, 0); // 不自动清除，由子类处理

      // TestSfc 特有的消息显示
      this.locateMessage = message;
      this.messageType = type;

      // 自动清除消息
      if (duration > 0 && typeof this.clearMessage === 'function') {
        setTimeout(() => this.clearMessage(), duration);
      }
    },

    /**
     * 覆盖基类的 clearMessage 方法
     */
    clearMessage() {
      this.locateMessage = '';
    },

    /**
     * 覆盖基类的 handleClose 方法，添加 TestSfc 特有的关闭逻辑
     */
    handleClose() {
      // 调用基类的 handleClose（触发事件和回调）
      super.handleClose();

      // TestSfc 特有的关闭逻辑
      if (typeof window !== 'undefined' &&
          this.closeEventName === 'testSfcClose' &&
          window.__testSfcOnClose &&
          typeof window.__testSfcOnClose === 'function') {
        window.__testSfcOnClose();
      }
    },

    // ==================== 拖动相关方法 ====================

    /**
     * 开始拖动
     */
    startDrag(event) {
      // 只在左键点击时开始拖动，且确保点击的是头部而非关闭按钮
      if (event.button !== 0) return;
      if (event.target.closest('.close-btn')) return;

      this.isDragging = true;
      this.dragStart = { x: event.clientX, y: event.clientY };

      // 如果当前使用 right 定位，先计算对应的 left 值
      if (this.position.x === 'auto') {
        const rect = this.$refs.modalRef.getBoundingClientRect();
        this.initialPosition = { x: rect.left, y: rect.top };
      } else {
        this.initialPosition = { ...this.position };
      }

      // 使用基类的事件绑定方法
      this.boundOnDrag = this.bindEventHandler('onDrag', this.onDrag);
      this.boundStopDrag = this.bindEventHandler('stopDrag', this.stopDrag);

      // 添加全局事件监听器
      document.addEventListener('mousemove', this.boundOnDrag);
      document.addEventListener('mouseup', this.boundStopDrag);

      // 防止选中文本
      event.preventDefault();
    },

    /**
     * 拖动中
     */
    onDrag(event) {
      if (!this.isDragging) return;

      const deltaX = event.clientX - this.dragStart.x;
      const deltaY = event.clientY - this.dragStart.y;

      // 计算新位置
      let newX = this.initialPosition.x + deltaX;
      let newY = this.initialPosition.y + deltaY;

      // 边界检查：确保组件不会被拖出屏幕
      const maxLeft = window.innerWidth - 350;
      const maxTop = window.innerHeight - 200;

      newX = Math.max(0, Math.min(newX, maxLeft));
      newY = Math.max(0, Math.min(newY, maxTop));

      this.position = {
        x: newX,
        y: newY
      };
    },

    /**
     * 停止拖动
     */
    stopDrag() {
      if (this.isDragging) {
        this.isDragging = false;

        // 移除全局事件监听器
        if (this.boundOnDrag) {
          document.removeEventListener('mousemove', this.boundOnDrag);
        }
        if (this.boundStopDrag) {
          document.removeEventListener('mouseup', this.boundStopDrag);
        }
      }
    }
  },
  mounted() {
    // 调用基类的 initCesium 方法（会初始化日志和等待 Cesium）
    this.initCesium(() => {
      // TestSfc 特有的初始化逻辑
      // 根据实例 ID 计算偏移量
      const offset = (this.instanceId - 1) * 30;
      this.right = 20 + offset;
      this.position.y = 100 + offset;
    });
  },
  beforeUnmount() {
    // 清理拖动相关的事件监听器
    if (this.isDragging) {
      if (this.boundOnDrag) {
        document.removeEventListener('mousemove', this.boundOnDrag);
      }
      if (this.boundStopDrag) {
        document.removeEventListener('mouseup', this.boundStopDrag);
      }
    }

    // 调用基类的 cleanup 方法
    this.cleanup();
  }
};
</script>

<style>
/* ⭐ TestSfc 主面板 - 橙色主题悬浮面板样式 */
.test-sfc-modal {
  position: fixed;
  top: 120px;
  /* 初始位置在右侧，通过 JavaScript 动态设置 */
  right: 20px;
  width: 360px;
  max-height: calc(100vh - 160px);
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid rgba(255, 152, 0, 0.5);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 152, 0, 0.1);
  z-index: 10001;
  overflow: hidden;
  backdrop-filter: blur(12px);
  /* 确保面板可交互 */
  pointer-events: auto;
  /* 拖动时的过渡效果 */
  transition: box-shadow 0.3s, border-color 0.3s;
}

.test-sfc-modal.is-dragging {
  box-shadow: 0 12px 32px rgba(255, 152, 0, 0.3), 0 0 0 1px rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.8);
}

.test-sfc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 152, 0, 0.2);
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 152, 0, 0.08) 100%);
  /* 确保头部可交互 */
  pointer-events: auto;
  /* 拖动光标 */
  cursor: move;
  user-select: none;
  transition: background 0.3s;
  position: relative;
}

.test-sfc-header::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #FF9800, #F57C00);
  border-radius: 12px 0 0 0;
}

.test-sfc-header:hover {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.22) 0%, rgba(255, 152, 0, 0.12) 100%);
}

.test-sfc-header.dragging {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.3) 0%, rgba(255, 152, 0, 0.18) 100%);
  cursor: grabbing;
}

.test-sfc-header h3 {
  margin: 0;
  color: #FF9800;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  text-shadow: 0 0 10px rgba(255, 152, 0, 0.3);
}

.close-btn {
  background: rgba(255, 59, 48, 0.15);
  border: 1px solid rgba(255, 59, 48, 0.6);
  color: #ff3b30;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  /* 确保按钮可点击 */
  pointer-events: auto;
  font-weight: 300;
}

.close-btn:hover {
  background: rgba(255, 59, 48, 0.3);
  border-color: #ff3b30;
  transform: scale(1.15) rotate(90deg);
  box-shadow: 0 0 12px rgba(255, 59, 48, 0.5);
}

.close-btn:active {
  transform: scale(1.05) rotate(90deg);
}

.test-sfc-body {
  padding: 18px;
  max-height: calc(100vh - 240px);
  overflow-y: auto;
  /* 确保主体内容可交互 */
  pointer-events: auto;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.4) 100%);
}

/* 自定义滚动条 */
.test-sfc-body::-webkit-scrollbar {
  width: 6px;
}

.test-sfc-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.test-sfc-body::-webkit-scrollbar-thumb {
  background: rgba(255, 152, 0, 0.4);
  border-radius: 3px;
  transition: background 0.3s;
}

.test-sfc-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 152, 0, 0.7);
}

.test-info {
  background: rgba(156, 39, 176, 0.1);
  border-left: 3px solid #9C27B0;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 0 6px 6px 0;
}

.test-info p {
  margin: 4px 0;
  color: #b0c4de;
  font-size: 13px;
}

.test-info strong {
  color: #9C27B0;
}

.test-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.test-btn {
  flex: 1;
  padding: 8px 12px;
  background: linear-gradient(135deg, #9C27B0, #6A1B9A);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  /* 确保按钮可点击 */
  pointer-events: auto;
}

.test-btn:hover {
  background: linear-gradient(135deg, #AB47BC, #7B1FA2);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(156, 39, 176, 0.4);
}

.test-btn-secondary {
  background: linear-gradient(135deg, #ff9500, #ff5e00);
}

.test-btn-secondary:hover {
  background: linear-gradient(135deg, #ffa500, #ff6e00);
  box-shadow: 0 2px 8px rgba(255, 149, 0, 0.4);
}

.test-display {
  margin-bottom: 12px;
}

.counter-box {
  background: rgba(156, 39, 176, 0.1);
  border: 1px solid rgba(156, 39, 176, 0.3);
  border-radius: 6px;
  padding: 12px;
  text-align: center;
}

.counter-label {
  color: #b0c4de;
  font-size: 13px;
  margin-right: 8px;
}

.counter-value {
  color: #9C27B0;
  font-size: 28px;
  font-weight: bold;
}

.test-log {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(156, 39, 176, 0.2);
}

.log-title {
  padding: 8px 12px;
  background: rgba(156, 39, 176, 0.15);
  color: #9C27B0;
  font-size: 12px;
  font-weight: 500;
  border-bottom: 1px solid rgba(156, 39, 176, 0.2);
}

.log-content {
  max-height: 120px;
  overflow-y: auto;
  padding: 8px;
}

.log-item {
  color: #b0c4de;
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.log-item:last-child {
  border-bottom: none;
}

/* 日志滚动条样式 */
.log-content::-webkit-scrollbar {
  width: 4px;
}

.log-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.log-content::-webkit-scrollbar-thumb {
  background: rgba(156, 39, 176, 0.5);
  border-radius: 2px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 39, 176, 0.7);
}

/* 经纬度定位表单样式 */
.location-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c5d9e8;
  font-size: 13px;
  font-weight: 500;
  text-shadow: 0 0 10px rgba(255, 152, 0, 0.2);
}

.label-icon {
  font-size: 14px;
}

.form-input {
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 152, 0, 0.25);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.form-input:focus {
  outline: none;
  border-color: #FF9800;
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.15), 0 0 20px rgba(255, 152, 0, 0.1);
  transform: translateY(-1px);
}

.form-input::placeholder {
  color: rgba(176, 196, 222, 0.4);
}

.form-input:hover:not(:focus) {
  border-color: rgba(255, 152, 0, 0.4);
  background: rgba(0, 0, 0, 0.5);
}

.locate-btn {
  padding: 14px;
  background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
  border: none;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.locate-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.locate-btn:hover::before {
  left: 100%;
}

.locate-btn:hover {
  background: linear-gradient(135deg, #66BB6A 0%, #43A047 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(76, 175, 80, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2);
}

.locate-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.4);
}

.btn-icon {
  font-size: 16px;
}

.locate-message {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.locate-message.info {
  background: rgba(33, 150, 243, 0.15);
  border: 1px solid rgba(33, 150, 243, 0.4);
  color: #64B5F6;
  box-shadow: 0 0 12px rgba(33, 150, 243, 0.2);
}

.locate-message.success {
  background: rgba(76, 175, 80, 0.15);
  border: 1px solid rgba(76, 175, 80, 0.4);
  color: #81C784;
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.2);
}

.locate-message.error {
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244, 67, 54, 0.4);
  color: #E57373;
  box-shadow: 0 0 12px rgba(244, 67, 54, 0.2);
}
</style>
