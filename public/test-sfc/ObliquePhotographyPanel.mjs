import { Fragment as e, Teleport as t, Transition as n, createBlock as r, createCommentVNode as i, createElementBlock as a, createElementVNode as o, createTextVNode as s, createVNode as c, normalizeClass as l, normalizeStyle as u, openBlock as d, renderList as f, renderSlot as p, resolveComponent as ee, toDisplayString as m, vShow as h, withCtx as g, withDirectives as _, withModifiers as v } from "vue";
var y = new class {
	constructor() {
		this.isReady = !1, this.listeners = /* @__PURE__ */ new Set(), this.cesiumInstance = null, this.viewerInstance = null, this.checkInterval = null, this.checkAttempts = 0, this.maxAttempts = 50;
	}
	init() {
		if (!(typeof window > "u")) {
			if (this.checkCesiumReady()) {
				this.setReady();
				return;
			}
			this.setupGlobalListener(), this.startPolling();
		}
	}
	checkCesiumReady() {
		if (typeof window > "u") return !1;
		let e = window.Cesium !== void 0, t = window.__cesiumViewer__ !== void 0;
		return e && t;
	}
	setupGlobalListener() {
		window.addEventListener("cesium-ready", this.handleCesiumReady), window.addEventListener("cesium-viewer-ready", this.handleViewerReady);
	}
	removeGlobalListener() {
		typeof window > "u" || (window.removeEventListener("cesium-ready", this.handleCesiumReady), window.removeEventListener("cesium-viewer-ready", this.handleViewerReady));
	}
	handleCesiumReady = () => {
		console.log("[CesiumEventManager] 📡 收到 cesium-ready 事件"), this.cesiumInstance = window.Cesium, window.__cesiumViewer__ && this.setReady();
	};
	handleViewerReady = () => {
		console.log("[CesiumEventManager] 📡 收到 cesium-viewer-ready 事件"), this.viewerInstance = window.__cesiumViewer__, window.Cesium && this.setReady();
	};
	startPolling() {
		this.checkInterval ||= (this.checkAttempts = 0, setInterval(() => {
			this.checkAttempts++, this.checkCesiumReady() ? (this.setReady(), this.stopPolling()) : this.checkAttempts >= this.maxAttempts && (console.warn("[CesiumEventManager] ⏰ Cesium 初始化检查超时"), this.stopPolling());
		}, 100));
	}
	stopPolling() {
		this.checkInterval &&= (clearInterval(this.checkInterval), null);
	}
	setReady() {
		this.isReady || (this.isReady = !0, this.cesiumInstance = window.Cesium, this.viewerInstance = window.__cesiumViewer__, console.log("[CesiumEventManager] ✅ Cesium 已就绪"), this.stopPolling(), this.notifyListeners(), this.dispatchGlobalEvent());
	}
	notifyListeners() {
		this.listeners.forEach((e) => {
			try {
				e(this.cesiumInstance, this.viewerInstance);
			} catch (e) {
				console.error("[CesiumEventManager] ❌ 监听器执行失败:", e);
			}
		});
	}
	dispatchGlobalEvent() {
		if (typeof window > "u") return;
		let e = new CustomEvent("cesium-all-ready", { detail: {
			cesium: this.cesiumInstance,
			viewer: this.viewerInstance
		} });
		window.dispatchEvent(e);
	}
	onReady(e) {
		if (typeof e != "function") return console.warn("[CesiumEventManager] ⚠️ 监听器必须是函数"), () => {};
		if (this.isReady) try {
			e(this.cesiumInstance, this.viewerInstance);
		} catch (e) {
			console.error("[CesiumEventManager] ❌ 监听器执行失败:", e);
		}
		else this.listeners.add(e);
		return () => {
			this.listeners.delete(e);
		};
	}
	async ready() {
		return new Promise((e) => {
			let t = this.onReady((n, r) => {
				t(), e({
					cesium: n,
					viewer: r
				});
			});
		});
	}
	getCesium() {
		return this.cesiumInstance;
	}
	getViewer() {
		return this.viewerInstance;
	}
	reset() {
		this.isReady = !1, this.cesiumInstance = null, this.viewerInstance = null, this.listeners.clear(), this.stopPolling();
	}
	destroy() {
		this.stopPolling(), this.removeGlobalListener(), this.listeners.clear(), this.isReady = !1, this.cesiumInstance = null, this.viewerInstance = null;
	}
}();
typeof window < "u" && (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => {
	y.init();
}) : y.init(), window.__cesiumEventManager__ = y);
//#endregion
//#region \0plugin-vue:export-helper
var b = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, x = {
	name: "SfcBase",
	props: { onClose: {
		type: Function,
		default: null
	} },
	inject: {
		closeEventName: { default: "sfcBaseClose" },
		instanceId: { default: 1 }
	},
	data() {
		return {
			cesiumReady: !1,
			componentName: "SfcBase",
			boundEventHandlers: {},
			cesiumUnsubscribe: null
		};
	},
	methods: {
		checkCesiumReady() {
			return typeof window < "u" && window.Cesium !== void 0 && window.__cesiumViewer__ ? (this.cesiumReady = !0, this.$logger?.info?.("[SfcBase] Cesium 已就绪"), !0) : !1;
		},
		waitForCesium(e, t = 5e3) {
			if (this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.checkCesiumReady()) {
				e && typeof e == "function" && e();
				return;
			}
			let n = null;
			t > 0 && (n = setTimeout(() => {
				this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.$logger?.warn?.(`[${this.componentName}] Cesium 初始化超时 (${t}ms)`);
			}, t)), this.cesiumUnsubscribe = y.onReady((t, r) => {
				n &&= (clearTimeout(n), null), this.cesiumReady = !0, this.$logger?.info?.(`[${this.componentName}] Cesium 已就绪（事件驱动）`), e && typeof e == "function" && e(t, r);
			});
		},
		getCesiumViewer() {
			return this.checkCesiumReady() ? window.__cesiumViewer__ : (this.$logger?.warn?.(`[${this.componentName}] Cesium 未就绪，无法获取 Viewer`), null);
		},
		getCesium() {
			return typeof window < "u" && window.Cesium !== void 0 ? window.Cesium : (this.$logger?.warn?.(`[${this.componentName}] Cesium 全局对象不存在`), null);
		},
		isValidCoordinate(e, t, n) {
			return typeof e == "number" && !isNaN(e) && e >= t && e <= n;
		},
		validateLonLat(e, t, n = null) {
			return this.isValidCoordinate(e, -180, 180) ? this.isValidCoordinate(t, -90, 90) ? n !== null && !this.isValidCoordinate(n, -1e3, 1e5) ? {
				valid: !1,
				message: "高度必须在合理范围内"
			} : {
				valid: !0,
				message: "坐标有效"
			} : {
				valid: !1,
				message: "纬度必须在 -90 到 90 之间"
			} : {
				valid: !1,
				message: "经度必须在 -180 到 180 之间"
			};
		},
		showMessage(e, t = "info", n = 3e3) {
			this.$logger?.info?.(`[${this.componentName}] ${t.toUpperCase()}: ${e}`), this.messageContent !== void 0 && (this.messageContent = e), this.messageType !== void 0 && (this.messageType = t), n > 0 && typeof this.clearMessage == "function" && setTimeout(() => this.clearMessage(), n);
		},
		clearMessage() {
			this.messageContent !== void 0 && (this.messageContent = "");
		},
		handleClose() {
			if (typeof window < "u") {
				let e = new CustomEvent(this.closeEventName, { detail: {
					componentName: this.componentName,
					instanceId: this.instanceId
				} });
				window.dispatchEvent(e), this.onClose && typeof this.onClose == "function" && this.onClose(), this.$logger?.info?.(`[${this.componentName}] 关闭事件已触发`);
			}
		},
		bindEventHandler(e, t) {
			if (typeof t != "function") return this.$logger?.warn?.(`[${this.componentName}] 事件处理器必须是函数`), null;
			let n = t.bind(this);
			return this.boundEventHandlers[e] = n, n;
		},
		getBoundHandler(e) {
			return this.boundEventHandlers[e] || null;
		},
		clearBoundHandlers() {
			this.boundEventHandlers = {};
		},
		flyToPosition(e, t, n, r = {}, i = 2) {
			return new Promise((a, o) => {
				let s = this.getCesiumViewer();
				if (!s) {
					o(/* @__PURE__ */ Error("Cesium Viewer 不可用"));
					return;
				}
				let c = this.getCesium();
				if (!c) {
					o(/* @__PURE__ */ Error("Cesium 全局对象不可用"));
					return;
				}
				try {
					let l = c.Cartesian3.fromDegrees(e, t, n), u = {
						heading: c.Math.toRadians(0),
						pitch: c.Math.toRadians(-45),
						roll: 0
					};
					s.camera.flyTo({
						destination: l,
						orientation: {
							...u,
							...r
						},
						duration: i,
						complete: () => a(),
						cancel: () => o(/* @__PURE__ */ Error("飞行操作被取消"))
					});
				} catch (e) {
					o(e);
				}
			});
		},
		viewGround(e, t, n = 0) {
			return this.flyToPosition(e, t, n, {
				heading: 0,
				pitch: -90,
				roll: 0
			}, 1.5);
		},
		createLogger() {
			let e = `[${this.componentName}]`;
			return {
				info: (t) => console.log(`${e} ${t}`),
				warn: (t) => console.warn(`${e} ⚠️ ${t}`),
				error: (t) => console.error(`${e} ❌ ${t}`),
				debug: (t) => console.debug(`${e} 🔍 ${t}`)
			};
		},
		initCesium(e) {
			this.$logger = this.createLogger(), this.$logger?.info?.("组件初始化"), this.checkCesiumReady() ? (this.cesiumReady = !0, e && e()) : (this.$logger?.info?.("等待 Cesium 初始化（事件驱动）..."), this.waitForCesium((t, n) => {
				this.$logger?.info?.("Cesium 已就绪"), e && e(t, n);
			}));
		},
		cleanup() {
			this.cesiumUnsubscribe &&= (this.cesiumUnsubscribe(), null), this.clearBoundHandlers(), this.$logger?.info?.("资源已清理");
		}
	},
	mounted() {},
	beforeUnmount() {
		this.cleanup();
	}
}, S = {
	class: "sfc-base",
	style: { display: "none" }
};
function C(t, n, r, s, c, l) {
	return d(), a(e, null, [i(" 基础组件无界面元素，仅作为逻辑基类 "), o("div", S)], 2112);
}
var w = /*#__PURE__*/ b(x, [["render", C]]), T = {
	name: "FunctionPanelUIBase",
	mixins: [w],
	inject: {
		registerPanelComponent: {
			type: Function,
			default: null
		},
		unregisterPanelComponent: {
			type: Function,
			default: null
		},
		getRegisteredPanels: {
			type: Function,
			default: null
		}
	},
	props: {
		autoRegister: {
			type: Boolean,
			default: !1
		},
		registrationKey: {
			type: String,
			default: null
		},
		title: {
			type: String,
			default: "面板"
		},
		titleIcon: {
			type: String,
			default: "⚙️"
		},
		closeTooltip: {
			type: String,
			default: "关闭 (ESC)"
		},
		width: {
			type: Number,
			default: 360
		},
		height: {
			type: [Number, String],
			default: "auto"
		},
		maxHeight: {
			type: [Number, String],
			default: "70vh"
		},
		initialX: {
			type: [Number, String],
			default: "center"
		},
		initialY: {
			type: Number,
			default: 80
		},
		bodyPadding: {
			type: String,
			default: "20px"
		},
		allowMinimize: {
			type: Boolean,
			default: !0
		},
		closeEventName: {
			type: String,
			default: "functionPanelClose"
		},
		enableBlur: {
			type: Boolean,
			default: !1
		},
		blurAmount: {
			type: String,
			default: "8px"
		},
		enableBackdropFilter: {
			type: Boolean,
			default: !1
		}
	},
	data() {
		return {
			componentName: "FunctionPanelUIBase",
			_registryRegistered: !1,
			x: 0,
			y: 0,
			isDragging: !1,
			dragOffsetX: 0,
			dragOffsetY: 0,
			isMinimized: !1,
			isClosed: !1,
			boundMouseMove: null,
			boundMouseUp: null,
			cachedPanelWidth: null,
			cachedPanelHeight: null
		};
	},
	computed: {
		panelStyles() {
			return {
				width: typeof this.width == "number" ? `${this.width}px` : this.width,
				height: typeof this.height == "number" ? `${this.height}px` : this.height,
				maxHeight: typeof this.maxHeight == "number" ? `${this.maxHeight}px` : this.maxHeight,
				transform: `translate(${this.x}px, ${this.y}px)`,
				transition: this.isDragging ? "none" : "transform 0.2s ease-out, opacity 0.3s ease"
			};
		},
		bodyStyles() {
			return { padding: this.bodyPadding };
		},
		fabStyles() {
			return { transform: `translate(${this.x + this.width / 2 - 40}px, ${this.y}px)` };
		}
	},
	mounted() {
		this.autoRegister && this.registrationKey && this.registerToParent(), this.initCesium(() => {
			this.$nextTick(() => {
				this.initPosition();
			});
		}), this.boundHandleKeydown = this.handleKeydown.bind(this), document.addEventListener("keydown", this.boundHandleKeydown);
	},
	beforeUnmount() {
		this.autoRegister && this.registrationKey && this.unregisterFromParent(), this.boundMouseMove && (document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundHandleMouseUp)), this.boundHandleKeydown && document.removeEventListener("keydown", this.boundHandleKeydown), this.cleanup();
	},
	methods: {
		registerToParent() {
			if (!this.registrationKey) {
				console.warn("[FunctionPanelUIBase] 缺少 registrationKey，无法自动注册");
				return;
			}
			if (this.registerPanelComponent && typeof this.registerPanelComponent == "function") {
				let e = !0;
				if (this.getRegisteredPanels && typeof this.getRegisteredPanels == "function") {
					let t = this.getRegisteredPanels(), n = t && t[this.registrationKey];
					n && n.visible !== void 0 && (e = n.visible);
				}
				this.registerPanelComponent(this.registrationKey, {
					component: this,
					props: this.$props,
					visible: e
				}), this._registryRegistered = !0, console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过 inject 注册, visible: ${e}`);
				return;
			}
			this.$emit("register-panel", {
				key: this.registrationKey,
				component: this,
				props: this.$props
			}), this._registryRegistered = !0, console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过事件注册`);
		},
		unregisterFromParent() {
			if (this.registrationKey) {
				if (this.unregisterPanelComponent && typeof this.unregisterPanelComponent == "function") {
					this.unregisterPanelComponent(this.registrationKey), console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过 inject 注销`);
					return;
				}
				this.$emit("unregister-panel", { key: this.registrationKey }), console.log(`[FunctionPanelUIBase] ${this.registrationKey} 已通过事件注销`);
			}
		},
		initPosition() {
			let e = this.initialX;
			if (e === "center") {
				let t = this.$refs.panelRef, n = t ? t.offsetWidth : this.width;
				e = Math.round((window.innerWidth - n) / 2);
			} else if (e === "right") {
				let t = this.$refs.panelRef, n = t ? t.offsetWidth : this.width;
				e = Math.round(window.innerWidth - n - 20);
			} else typeof e != "number" && (e = 20);
			e = Math.max(20, Math.min(e, window.innerWidth - this.width - 20)), this.x = e, this.y = Math.max(20, Math.min(this.initialY, window.innerHeight - 100));
		},
		onHeaderMouseDown(e) {
			e.button === 0 && (e.target.closest(".icon-btn") || (e.preventDefault(), this.startDrag(e)));
		},
		onPanelMouseDown(e) {},
		startDrag(e) {
			this.isDragging = !0;
			let t = this.$refs.panelRef.getBoundingClientRect();
			this.dragOffsetX = e.clientX - t.left, this.dragOffsetY = e.clientY - t.top, this.cachedPanelWidth = t.width, this.cachedPanelHeight = t.height, this.boundMouseMove = this.onMouseMove.bind(this), this.boundHandleMouseUp = this.onMouseUp.bind(this), document.addEventListener("mousemove", this.boundMouseMove), document.addEventListener("mouseup", this.boundHandleMouseUp), document.body.style.userSelect = "none", document.body.style.cursor = "grabbing";
		},
		onMouseMove(e) {
			if (!this.isDragging) return;
			let t = e.clientX - this.dragOffsetX, n = e.clientY - this.dragOffsetY, r = this.cachedPanelWidth || this.width;
			this.cachedPanelHeight;
			let i = -r + 40, a = window.innerWidth - 40;
			t = Math.max(i, Math.min(t, a));
			let o = window.innerHeight - 60;
			n = Math.max(0, Math.min(n, o)), this.x = Math.round(t), this.y = Math.round(n);
		},
		onMouseUp() {
			this.isDragging && (this.isDragging = !1, this.boundMouseMove && (document.removeEventListener("mousemove", this.boundMouseMove), document.removeEventListener("mouseup", this.boundHandleMouseUp), this.boundMouseMove = null, this.boundHandleMouseUp = null), document.body.style.userSelect = "", document.body.style.cursor = "", this.snapToEdge());
		},
		snapToEdge() {
			let e = this.$refs.panelRef;
			if (!e) return;
			let t = e.getBoundingClientRect(), n = !1;
			Math.abs(t.left) < 30 && t.left >= -20 ? (this.x = 0, n = !0) : Math.abs(t.right - window.innerWidth) < 30 && (this.x = window.innerWidth - (this.cachedPanelWidth || t.width), n = !0), t.top < 30 && t.top >= -20 && (this.y = 0, n = !0), n && setTimeout(() => {
				this.$el?.classList.add("snapped"), setTimeout(() => {
					this.$el?.classList.remove("snapped");
				}, 300);
			}, 0), this.cachedPanelWidth = null, this.cachedPanelHeight = null;
		},
		toggleMinimize() {
			this.isMinimized = !this.isMinimized, this.$emit(this.isMinimized ? "minimize" : "expand");
		},
		close() {
			this.isClosed = !0, setTimeout(() => {
				if (this.$emit("close"), typeof window < "u") {
					let e = new CustomEvent(this.closeEventName, { detail: { componentName: this.componentName } });
					window.dispatchEvent(e);
				}
				this.onClose && typeof this.onClose == "function" && this.onClose();
			}, 300);
		},
		handleKeydown(e) {
			e.key === "Escape" && this.close();
		}
	}
}, E = { class: "header-left" }, D = { class: "panel-title" }, O = { class: "header-controls" }, k = ["aria-label"], A = {
	width: "14",
	height: "14",
	viewBox: "0 0 14 14",
	fill: "none"
}, j = {
	key: 0,
	d: "M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, M = {
	key: 1,
	d: "M7 2V12M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, N = ["aria-label"], P = ["title"], F = { class: "fab-icon" }, I = { class: "fab-text" };
function L(e, s, f, ee, y, b) {
	return d(), r(t, { to: "body" }, [
		c(n, { name: "panel-fade" }, {
			default: g(() => [y.isClosed ? i("v-if", !0) : (d(), a("div", {
				key: 0,
				class: l(["function-panel", {
					"is-dragging": y.isDragging,
					"is-minimized": y.isMinimized,
					"blur-enabled": f.enableBackdropFilter && f.enableBlur
				}]),
				style: u(b.panelStyles),
				ref: "panelRef",
				onMousedown: s[3] ||= (...e) => b.onPanelMouseDown && b.onPanelMouseDown(...e)
			}, [
				i(" 面板头部 "),
				o("div", {
					class: "panel-header",
					onMousedown: s[2] ||= (...e) => b.onHeaderMouseDown && b.onHeaderMouseDown(...e)
				}, [o("div", E, [s[5] ||= o("div", { class: "drag-indicator" }, [
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" })
				], -1), p(e.$slots, "header", {}, () => [o("h3", D, m(f.title), 1)], !0)]), o("div", O, [f.allowMinimize ? (d(), a("button", {
					key: 0,
					onClick: s[0] ||= v((...e) => b.toggleMinimize && b.toggleMinimize(...e), ["stop"]),
					class: "icon-btn minimize-btn",
					type: "button",
					"aria-label": y.isMinimized ? "展开" : "最小化"
				}, [(d(), a("svg", A, [y.isMinimized ? (d(), a("path", M)) : (d(), a("path", j))]))], 8, k)) : i("v-if", !0), o("button", {
					onClick: s[1] ||= v((...e) => b.close && b.close(...e), ["stop"]),
					class: "icon-btn close-btn",
					type: "button",
					"aria-label": f.closeTooltip
				}, [...s[6] ||= [o("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none"
				}, [o("path", {
					d: "M2 2L12 12M12 2L2 12",
					stroke: "currentColor",
					"stroke-width": "2",
					"stroke-linecap": "round"
				})], -1)]], 8, N)])], 32),
				i(" 面板内容 "),
				c(n, {
					name: "content-slide",
					persisted: ""
				}, {
					default: g(() => [_(o("div", {
						class: "panel-body",
						style: u(b.bodyStyles)
					}, [p(e.$slots, "default", {}, void 0, !0)], 4), [[h, !y.isMinimized]])]),
					_: 3
				})
			], 38))]),
			_: 3
		}),
		i(" 最小化时的浮动按钮 "),
		c(n, { name: "fab-fade" }, {
			default: g(() => [!y.isClosed && y.isMinimized ? (d(), a("button", {
				key: 0,
				class: "panel-fab",
				type: "button",
				style: u(b.fabStyles),
				onClick: s[4] ||= (...e) => b.toggleMinimize && b.toggleMinimize(...e),
				title: f.title
			}, [o("span", F, m(f.titleIcon || "⚙️"), 1), o("span", I, m(f.title), 1)], 12, P)) : i("v-if", !0)]),
			_: 1
		})
	]);
}
//#endregion
//#region src/components/functions/ObliquePhotographyPanel.vue
var R = {
	name: "ObliquePhotographyPanel",
	components: { FunctionPanelUIBase: /* @__PURE__ */ b(T, [["render", L], ["__scopeId", "data-v-5551e28d"]]) },
	props: {
		initialX: {
			type: [Number, String],
			default: "center"
		},
		initialY: {
			type: Number,
			default: 120
		}
	},
	mixins: [w],
	inject: {
		closeEventName: { default: "obliquePhotographyPanelClose" },
		instanceId: { default: 1 }
	},
	data() {
		return {
			componentName: "ObliquePhotographyPanel",
			obliquePhotographyList: [{
				id: "bridge3d",
				name: "桥梁3D",
				url: "https://wckj2020.obs.myhuaweicloud.com/wckj/senge/bridge3D/tileset.json",
				loaded: !1,
				tileset: null,
				heightOffset: 0,
				initialTransform: null,
				recommendedOffset: null,
				loading: !1
			}, {
				id: "jian1",
				name: "吉安1号",
				url: "https://wckj2020.obs.cn-south-1.myhuaweicloud.com/wckj/senge/wckj2_merge/Scene/JiAn1_merge.json",
				loaded: !1,
				tileset: null,
				heightOffset: 0,
				initialTransform: null,
				recommendedOffset: null,
				loading: !1
			}],
			cesiumViewer: null,
			Cesium: null
		};
	},
	mounted() {
		this.initCesium(() => {
			console.log(`[${this.componentName}] Cesium 已就绪，面板初始化完成`);
		});
	},
	beforeUnmount() {
		this.obliquePhotographyList.forEach((e) => {
			e.loaded && e.tileset && this.unloadObliquePhotography(e);
		});
	},
	methods: {
		handleMinimize() {
			console.log(`[${this.componentName}] 面板已最小化`);
		},
		handleExpand() {
			console.log(`[${this.componentName}] 面板已展开`);
		},
		handleClose() {
			console.log(`[${this.componentName}] 面板关闭`), this.$emit("close");
		},
		async toggleObliquePhotography(e) {
			if (!this.getCesiumViewer()) {
				console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
				return;
			}
			e.loaded ? await this.unloadObliquePhotography(e) : await this.loadObliquePhotography(e);
		},
		async loadObliquePhotography(e) {
			let t = this.getCesiumViewer(), n = this.getCesium();
			if (!t || !n) {
				console.error(`[${this.componentName}] Cesium 未就绪`);
				return;
			}
			console.log(`[${this.componentName}] 🏗️ 加载倾斜摄影: ${e.name}`), console.log(`[${this.componentName}] 📍 URL: ${e.url}`), this.$set(e, "loading", !0);
			try {
				let r = new n.Cesium3DTileset({
					url: e.url,
					show: !0,
					maximumScreenSpaceError: 2,
					skipLevelOfDetail: !0,
					baseScreenSpaceError: 1024,
					skipScreenSpaceErrorFactor: 16,
					skipLevels: 1,
					immediatelyLoadDesiredLevelOfDetail: !0,
					loadSiblings: !1
				});
				t.scene.primitives.add(r);
				let i = () => {
					if (console.log(`[${this.componentName}] ✅ 倾斜摄影加载完成: ${e.name}`), r.boundingSphere) {
						let t = r.boundingSphere;
						console.log(`[${this.componentName}] 📊 ${e.name} 边界球:`, {
							中心X: t.center.x.toFixed(2),
							中心Y: t.center.y.toFixed(2),
							中心Z: t.center.z.toFixed(2),
							半径: t.radius.toFixed(2) + "米"
						});
					}
					this.$set(e, "loading", !1), this.$set(e, "loaded", !0), this.$set(e, "tileset", r), r.root && r.root.transform && (this.$set(e, "initialTransform", n.Matrix4.clone(r.root.transform)), console.log(`[${this.componentName}] 💾 已保存初始变换矩阵: ${e.name}`)), !this.obliquePhotographyList.some((t) => t.id !== e.id && t.loaded) && r.boundingSphere && (t.camera.flyToBoundingSphere(r.boundingSphere, {
						duration: 2,
						offset: new n.HeadingPitchRange(0, -45, r.boundingSphere.radius * 2)
					}), console.log(`[${this.componentName}] ✅ 自动定位到倾斜摄影位置: ${e.name}`));
				}, a = (t) => {
					console.error(`[${this.componentName}] ❌ 倾斜摄影加载失败: ${e.name}`, t), this.$set(e, "loading", !1), this.$set(e, "loaded", !1);
				};
				r.readyPromise && (typeof Promise < "u" && r.readyPromise instanceof Promise ? r.readyPromise.then(i).catch(a) : typeof r.readyPromise.then == "function" && (r.readyPromise.then(i), typeof r.readyPromise.otherwise == "function" && r.readyPromise.otherwise(a))), r.tileFailed && r.tileFailed.addEventListener(a);
			} catch (t) {
				console.error(`[${this.componentName}] ❌ 倾斜摄影加载失败: ${e.name}`, t), this.$set(e, "loading", !1), this.$set(e, "loaded", !1);
			}
		},
		unloadObliquePhotography(e) {
			let t = this.getCesiumViewer();
			if (!t) {
				console.error(`[${this.componentName}] Cesium Viewer 未初始化`);
				return;
			}
			if (console.log(`[${this.componentName}] 🗑️ 卸载倾斜摄影: ${e.name}`), e.tileset) try {
				t.scene.primitives.remove(e.tileset), this.$set(e, "tileset", null), this.$set(e, "loaded", !1), console.log(`[${this.componentName}] ✅ 倾斜摄影已卸载: ${e.name}`);
			} catch (t) {
				console.error(`[${this.componentName}] ❌ 倾斜摄影卸载失败: ${e.name}`, t);
			}
		},
		onHeightOffsetChange(e, t) {
			let n = parseFloat(t.target.value);
			this.$set(e, "heightOffset", n), console.log(`[${this.componentName}] 📏 ${e.name} 高度偏移调整为: ${n.toFixed(1)} 米`), this.applyObliqueHeightOffset(e);
		},
		onHeightInputChange(e, t) {
			let n = parseFloat(t.target.value);
			isNaN(n) || (this.$set(e, "heightOffset", n), console.log(`[${this.componentName}] 📏 ${e.name} 高度偏移设置为: ${n.toFixed(1)} 米`), this.applyObliqueHeightOffset(e));
		},
		applyObliqueHeightOffset(e) {
			let t = this.getCesiumViewer(), n = this.getCesium();
			if (!t || !n || !e.tileset || !e.loaded) {
				console.warn(`[${this.componentName}] ⚠️ 倾斜摄影未加载，无法应用高度偏移: ${e.name}`);
				return;
			}
			if (!e.initialTransform) {
				console.warn(`[${this.componentName}] ⚠️ 未找到初始变换矩阵，无法应用相对偏移: ${e.name}`);
				return;
			}
			console.log(`[${this.componentName}] 🔧 应用高度偏移到 ${e.name}: ${e.heightOffset.toFixed(1)} 米`);
			try {
				let t = e.tileset;
				if (t.root) {
					let r = t.root, i = n.Matrix4.clone(e.initialTransform), a = new n.Cartesian3();
					n.Matrix4.getTranslation(i, a);
					let o = n.Cartesian3.magnitude(a);
					if (!isFinite(o) || o === 0) {
						console.warn(`[${this.componentName}] ⚠️ 从变换矩阵提取的位置无效: ${e.name}`);
						return;
					}
					let s = new n.Cartesian3(0, 0, e.heightOffset), c = n.Matrix4.fromTranslation(s);
					n.Matrix4.multiply(i, c, i), r.transform = i, console.log(`[${this.componentName}] ✅ ${e.name} 高度偏移已应用`);
				}
			} catch (t) {
				console.error(`[${this.componentName}] ❌ 应用高度偏移失败: ${e.name}`, t);
			}
		},
		applyRecommendedOffset(e) {
			if (e.recommendedOffset === null || e.recommendedOffset === void 0) {
				console.warn(`[${this.componentName}] ⚠️ ${e.name} 没有推荐偏移值`);
				return;
			}
			console.log(`[${this.componentName}] 🎯 应用推荐偏移值: ${e.name} = ${e.recommendedOffset.toFixed(1)} 米`), this.$set(e, "heightOffset", e.recommendedOffset), this.applyObliqueHeightOffset(e);
		},
		locateToObliquePhotography(e) {
			let t = this.getCesiumViewer(), n = this.getCesium();
			if (!t || !n) {
				console.error(`[${this.componentName}] ❌ Cesium 未就绪`);
				return;
			}
			if (console.log(`[${this.componentName}] 🎯 手动定位到倾斜摄影: ${e.name}`), !e.tileset || !e.loaded) {
				console.warn(`[${this.componentName}] ⚠️ 倾斜摄影未加载，无法定位: ${e.name}`);
				return;
			}
			try {
				if (e.tileset.boundingSphere) {
					let r = e.tileset.boundingSphere;
					console.log(`[${this.componentName}] 📊 倾斜摄影边界球:`, {
						中心X: r.center.x.toFixed(2),
						中心Y: r.center.y.toFixed(2),
						中心Z: r.center.z.toFixed(2),
						半径: r.radius.toFixed(2) + "米"
					}), t.camera.flyToBoundingSphere(r, {
						duration: 2,
						offset: new n.HeadingPitchRange(0, -45, r.radius * 2)
					}), console.log(`[${this.componentName}] ✅ 相机已定位到倾斜摄影位置: ${e.name}`);
				} else console.warn(`[${this.componentName}] ⚠️ 倾斜摄影边界球信息不可用: ${e.name}`);
			} catch (t) {
				console.error(`[${this.componentName}] ❌ 定位到倾斜摄影失败: ${e.name}`, t);
			}
		}
	}
}, z = {
	key: 0,
	class: "recommended-offset-banner"
}, B = { class: "banner-content" }, te = { class: "banner-text" }, V = { class: "banner-suggestion" }, H = { class: "highlight" }, U = ["onClick", "disabled"], W = {
	key: 0,
	class: "oblique-height-control-panel"
}, G = { class: "height-control-title" }, K = { class: "current-height" }, q = { class: "value" }, J = { class: "height-control" }, Y = ["value", "onInput"], X = { class: "height-input" }, Z = ["value", "onChange"], Q = {
	key: 0,
	class: "no-loaded-hint"
}, ne = { class: "oblique-list" }, re = {
	key: 0,
	class: "oblique-item"
}, ie = { class: "item-main" }, ae = { class: "oblique-checkbox" }, oe = [
	"checked",
	"onChange",
	"disabled"
], $ = { class: "oblique-name" }, se = {
	key: 0,
	class: "loading-indicator"
}, ce = { class: "item-actions" }, le = ["onClick", "title"], ue = {
	key: 1,
	class: "status-indicator loaded"
}, de = {
	key: 2,
	class: "status-indicator unloaded"
}, fe = {
	key: 0,
	class: "oblique-url"
};
function pe(t, n, c, l, u, p) {
	let h = ee("FunctionPanelUIBase");
	return d(), r(h, {
		title: "倾斜摄影加载",
		"title-icon": "📷",
		width: 380,
		"max-height": "65vh",
		"initial-x": c.initialX,
		"initial-y": c.initialY,
		"allow-minimize": !0,
		"close-event-name": "obliquePhotographyPanelClose",
		"auto-register": !0,
		"registration-key": "ObliquePhotographyPanel",
		onClose: p.handleClose,
		onMinimize: p.handleMinimize,
		onExpand: p.handleExpand
	}, {
		default: g(() => [
			i(" 推荐偏移值提示 "),
			(d(!0), a(e, null, f(u.obliquePhotographyList, (t) => (d(), a(e, { key: "recommend-" + t.id }, [t && t.loaded && t.recommendedOffset !== void 0 && t.recommendedOffset !== null ? (d(), a("div", z, [o("div", B, [
				n[3] ||= o("span", { class: "banner-icon" }, "💡", -1),
				o("span", te, [n[2] ||= s(" 检测到倾斜摄影地形高度较低 ", -1), o("span", V, [
					n[0] ||= s(" ，建议向上偏移 ", -1),
					o("strong", H, m(t.recommendedOffset.toFixed(1)) + " 米", 1),
					n[1] ||= s(" 以与大坐标模型底部对齐 ", -1)
				])]),
				o("button", {
					onClick: (e) => p.applyRecommendedOffset(t),
					class: "apply-recommended-btn",
					disabled: Math.abs(t.heightOffset - t.recommendedOffset) < .1
				}, m(Math.abs(t.heightOffset - t.recommendedOffset) < .1 ? "✓ 已应用" : "应用推荐值"), 9, U)
			])])) : i("v-if", !0)], 64))), 128)),
			i(" 地形高度调整控件 "),
			(d(!0), a(e, null, f(u.obliquePhotographyList, (t) => (d(), a(e, { key: "height-" + t.id }, [t && t.loaded ? (d(), a("div", W, [
				o("div", G, "🌏 " + m(t.name) + " 地形高度调整", 1),
				i(" 当前高度偏移显示 "),
				o("div", K, [
					n[4] ||= o("span", { class: "label" }, "倾斜摄影地形向上偏移：", -1),
					o("span", q, m((t.heightOffset || 0).toFixed(2)) + " 米", 1),
					n[5] ||= o("span", {
						class: "hint",
						title: "调整倾斜摄影的整体高度，正值向上，负值向下"
					}, "💡", -1)
				]),
				i(" 高度调整滑块 "),
				o("div", J, [
					n[6] ||= o("label", null, "调整偏移：", -1),
					o("input", {
						type: "range",
						min: "-2000",
						max: "2000",
						step: "1",
						value: t.heightOffset || 0,
						onInput: (e) => p.onHeightOffsetChange(t, e),
						class: "height-slider"
					}, null, 40, Y),
					n[7] ||= o("div", { class: "height-usage-info" }, [o("span", null, "调整后使倾斜摄影与大坐标模型高度对齐")], -1)
				]),
				i(" 精确输入 "),
				o("div", X, [n[8] ||= o("label", null, "精确设置偏移（米）：", -1), o("input", {
					type: "number",
					value: t.heightOffset || 0,
					onChange: (e) => p.onHeightInputChange(t, e),
					class: "number-input",
					step: "0.1"
				}, null, 40, Z)])
			])) : i("v-if", !0)], 64))), 128)),
			i(" 无加载提示 "),
			u.obliquePhotographyList && u.obliquePhotographyList.length > 0 && !u.obliquePhotographyList.some((e) => e && e.loaded) ? (d(), a("div", Q, " 请先加载倾斜摄影数据 ")) : i("v-if", !0),
			i(" 倾斜摄影列表 "),
			o("div", ne, [(d(!0), a(e, null, f(u.obliquePhotographyList, (t) => (d(), a(e, { key: t && t.id }, [t ? (d(), a("div", re, [
				o("div", ie, [i(" 加载/卸载复选框 "), o("label", ae, [
					o("input", {
						type: "checkbox",
						checked: t.loaded || !1,
						onChange: (e) => p.toggleObliquePhotography(t),
						disabled: t.loading || !1
					}, null, 40, oe),
					o("span", $, m(t.name || "未知"), 1),
					t.loading ? (d(), a("span", se, "加载中...")) : i("v-if", !0)
				])]),
				i(" 操作按钮组 "),
				o("div", ce, [
					i(" 定位按钮（仅已加载时显示） "),
					t.loaded && t.tileset ? (d(), a("button", {
						key: 0,
						onClick: (e) => p.locateToObliquePhotography(t),
						class: "action-btn locate-btn",
						type: "button",
						title: `定位到 ${t.name} 位置`
					}, " 📍 ", 8, le)) : i("v-if", !0),
					i(" 加载状态指示 "),
					t.loaded ? (d(), a("span", ue, "✓")) : (d(), a("span", de, "○"))
				]),
				t.loaded ? (d(), a("div", fe, m(t.url), 1)) : i("v-if", !0)
			])) : i("v-if", !0)], 64))), 128))])
		]),
		_: 1
	}, 8, [
		"initial-x",
		"initial-y",
		"onClose",
		"onMinimize",
		"onExpand"
	]);
}
var me = /*#__PURE__*/ b(R, [["render", pe], ["__scopeId", "data-v-b1e51afb"]]);
//#endregion
export { me as default };
