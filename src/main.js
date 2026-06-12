/*
 * @Author: Zhang Yuling
 * @Date: 2021-12-07 16:25:15
 * @LastEditors: Zhang Yuling
 * @LastEditTime: 2021-12-14 11:27:35
 * @Description: Vue 3 入口文件（使用 Vue 3 语法）
 */
import { createApp } from 'vue'
import App from './App.vue'

// 引入cesium相关文件
var cesium = require('cesium/Cesium')
var widgets = require('cesium/Widgets/widgets.css')

// ⭐ Vue 3 语法：使用 createApp 创建应用实例
const app = createApp(App)

// ⭐ Vue 3 语法：使用 app.config.globalProperties 替代 Vue.prototype
app.config.globalProperties.cesium = cesium
app.config.globalProperties.widgets = widgets

// 挂载应用
app.mount('#app')
