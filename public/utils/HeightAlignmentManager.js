/**
 * HeightAlignmentManager - 统一高度对齐管理器
 *
 * 功能：
 * - 统一管理倾斜摄影和Dual模型的高度参数
 * - 提供统一的高度计算接口
 * - 支持多种对齐模式
 */
export class HeightAlignmentManager {
  constructor() {
    // 高度参数
    this.terrainHeight = 0;           // 地形高度（采样得到）
    this.obliqueOffset = 0;            // 倾斜摄影偏移
    this.modelAltitude = 0;            // 模型海拔
    this.dualFloorHeight = 0;         // Dual地板高度

    // 对齐模式: 'terrain' | 'model' | 'smart'
    this.alignmentMode = 'terrain';

    // 状态
    this.obliqueLoaded = false;
    this.dualModelLoaded = false;

    console.log('[HeightAlignmentManager] ✅ 初始化完成');
  }

  /**
   * 设置地形高度
   * @param {number} height - 地形高度（米）
   */
  setTerrainHeight(height) {
    this.terrainHeight = height;
    console.log('[HeightAlignmentManager] 🌍 地形高度已更新:', height.toFixed(2) + '米');
  }

  /**
   * 设置倾斜摄影偏移
   * @param {number} offset - 偏移量（米）
   */
  setObliqueOffset(offset) {
    this.obliqueOffset = offset;
    console.log('[HeightAlignmentManager] 📷 倾斜摄影偏移已更新:', offset.toFixed(2) + '米');
  }

  /**
   * 设置模型海拔
   * @param {number} altitude - 模型海拔（米）
   */
  setModelAltitude(altitude) {
    this.modelAltitude = altitude;
    console.log('[HeightAlignmentManager] 🏗️ 模型海拔已更新:', altitude.toFixed(2) + '米');
  }

  /**
   * 设置Dual地板高度
   * @param {number} height - 地板高度（米）
   */
  setDualFloorHeight(height) {
    this.dualFloorHeight = height;
    console.log('[HeightAlignmentManager] 📊 Dual地板高度已更新:', height.toFixed(2) + '米');
  }

  /**
   * 设置对齐模式
   * @param {string} mode - 对齐模式 ('terrain' | 'model' | 'smart')
   */
  setAlignmentMode(mode) {
    this.alignmentMode = mode;
    console.log('[HeightAlignmentManager] 🎯 对齐模式已切换:', mode);
  }

  /**
   * 设置倾斜摄影加载状态
   * @param {boolean} loaded - 是否已加载
   */
  setObliqueLoaded(loaded) {
    this.obliqueLoaded = loaded;
    console.log('[HeightAlignmentManager] 📷 倾斜摄影状态:', loaded ? '已加载' : '未加载');
  }

  /**
   * 设置Dual模型加载状态
   * @param {boolean} loaded - 是否已加载
   */
  setDualModelLoaded(loaded) {
    this.dualModelLoaded = loaded;
    console.log('[HeightAlignmentManager] 🏗️ Dual模型状态:', loaded ? '已加载' : '未加载');
  }

  /**
   * 计算统一对齐高度
   * @return {number} 对齐高度（米）
   */
  calculateAlignmentHeight() {
    switch (this.alignmentMode) {
      case 'terrain':
        // 地形对齐：使用倾斜摄影地形高度 + 偏移
        return this.terrainHeight + this.obliqueOffset;

      case 'model':
        // 模型对齐：使用模型海拔
        return this.modelAltitude;

      case 'smart':
        // 智能对齐：自动选择最高点
        const terrainAlignHeight = this.terrainHeight + this.obliqueOffset;
        const modelAlignHeight = this.modelAltitude;
        return Math.max(terrainAlignHeight, modelAlignHeight);

      default:
        return this.terrainHeight + this.obliqueOffset;
    }
  }

  /**
   * 计算Dual模型的anchorContainer高度
   * @return {number} anchorContainer高度（米）
   */
  calculateAnchorContainerHeight() {
    const alignmentHeight = this.calculateAlignmentHeight();

    // anchorContainer应该位于对齐高度
    // 这样模型的Y=0平面就会和对齐高度一致
    return alignmentHeight;
  }

  /**
   * 获取当前对齐状态信息
   * @return {Object} 对齐状态信息
   */
  getAlignmentInfo() {
    const alignmentHeight = this.calculateAlignmentHeight();

    return {
      '地形高度': this.terrainHeight.toFixed(2) + '米',
      '倾斜摄影偏移': this.obliqueOffset.toFixed(2) + '米',
      '模型海拔': this.modelAltitude.toFixed(2) + '米',
      'Dual地板高度': this.dualFloorHeight.toFixed(2) + '米',
      '对齐模式': this.alignmentMode,
      '统一对齐高度': alignmentHeight.toFixed(2) + '米',
      'anchorContainer高度': this.calculateAnchorContainerHeight().toFixed(2) + '米',
      '倾斜摄影状态': this.obliqueLoaded ? '已加载' : '未加载',
      'Dual模型状态': this.dualModelLoaded ? '已加载' : '未加载',
      '计算公式': this.getCalculationFormula()
    };
  }

  /**
   * 获取计算公式说明
   * @return {string} 计算公式
   */
  getCalculationFormula() {
    switch (this.alignmentMode) {
      case 'terrain':
        return `统一对齐高度 = ${this.terrainHeight.toFixed(2)} + ${this.obliqueOffset.toFixed(2)} = ${(this.terrainHeight + this.obliqueOffset).toFixed(2)}`;
      case 'model':
        return `统一对齐高度 = 模型海拔 = ${this.modelAltitude.toFixed(2)}`;
      case 'smart':
        const terrainHeight = this.terrainHeight + this.obliqueOffset;
        return `统一对齐高度 = max(${terrainHeight.toFixed(2)}, ${this.modelAltitude.toFixed(2)}) = ${Math.max(terrainHeight, this.modelAltitude).toFixed(2)}`;
      default:
        return '未知计算公式';
    }
  }

  /**
   * 重置所有参数
   */
  reset() {
    this.terrainHeight = 0;
    this.obliqueOffset = 0;
    this.modelAltitude = 0;
    this.dualFloorHeight = 0;
    this.alignmentMode = 'terrain';
    this.obliqueLoaded = false;
    this.dualModelLoaded = false;
    console.log('[HeightAlignmentManager] 🔄 已重置所有参数');
  }
}
