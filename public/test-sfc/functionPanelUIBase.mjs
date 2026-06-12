import { Fragment as e, Teleport as t, Transition as n, createBlock as r, createCommentVNode as i, createElementBlock as a, createElementVNode as o, createVNode as s, normalizeClass as c, normalizeStyle as l, openBlock as u, renderSlot as d, toDisplayString as f, vShow as p, withCtx as m, withDirectives as h, withModifiers as g } from "vue";
var _ = new class {
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
	_.init();
}) : _.init(), window.__cesiumEventManager__ = _);
//#endregion
//#region \0plugin-vue:export-helper
var v = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, y = {
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
			}, t)), this.cesiumUnsubscribe = _.onReady((t, r) => {
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
}, b = {
	class: "sfc-base",
	style: { display: "none" }
};
function x(t, n, r, s, c, l) {
	return u(), a(e, null, [i(" 基础组件无界面元素，仅作为逻辑基类 "), o("div", b)], 2112);
}
//#endregion
//#region src/components/functionPanelUIBase.vue
var S = {
	name: "FunctionPanelUIBase",
	mixins: [/* @__PURE__ */ v(y, [["render", x]])],
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
}, C = { class: "header-left" }, w = { class: "panel-title" }, T = { class: "header-controls" }, E = ["aria-label"], D = {
	width: "14",
	height: "14",
	viewBox: "0 0 14 14",
	fill: "none"
}, O = {
	key: 0,
	d: "M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, k = {
	key: 1,
	d: "M7 2V12M2 7H12",
	stroke: "currentColor",
	"stroke-width": "2",
	"stroke-linecap": "round"
}, A = ["aria-label"], j = ["title"], M = { class: "fab-icon" }, N = { class: "fab-text" };
function P(e, _, v, y, b, x) {
	return u(), r(t, { to: "body" }, [
		s(n, { name: "panel-fade" }, {
			default: m(() => [b.isClosed ? i("v-if", !0) : (u(), a("div", {
				key: 0,
				class: c(["function-panel", {
					"is-dragging": b.isDragging,
					"is-minimized": b.isMinimized,
					"blur-enabled": v.enableBackdropFilter && v.enableBlur
				}]),
				style: l(x.panelStyles),
				ref: "panelRef",
				onMousedown: _[3] ||= (...e) => x.onPanelMouseDown && x.onPanelMouseDown(...e)
			}, [
				i(" 面板头部 "),
				o("div", {
					class: "panel-header",
					onMousedown: _[2] ||= (...e) => x.onHeaderMouseDown && x.onHeaderMouseDown(...e)
				}, [o("div", C, [_[5] ||= o("div", { class: "drag-indicator" }, [
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" }),
					o("span", { class: "grip-dot" })
				], -1), d(e.$slots, "header", {}, () => [o("h3", w, f(v.title), 1)], !0)]), o("div", T, [v.allowMinimize ? (u(), a("button", {
					key: 0,
					onClick: _[0] ||= g((...e) => x.toggleMinimize && x.toggleMinimize(...e), ["stop"]),
					class: "icon-btn minimize-btn",
					type: "button",
					"aria-label": b.isMinimized ? "展开" : "最小化"
				}, [(u(), a("svg", D, [b.isMinimized ? (u(), a("path", k)) : (u(), a("path", O))]))], 8, E)) : i("v-if", !0), o("button", {
					onClick: _[1] ||= g((...e) => x.close && x.close(...e), ["stop"]),
					class: "icon-btn close-btn",
					type: "button",
					"aria-label": v.closeTooltip
				}, [..._[6] ||= [o("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none"
				}, [o("path", {
					d: "M2 2L12 12M12 2L2 12",
					stroke: "currentColor",
					"stroke-width": "2",
					"stroke-linecap": "round"
				})], -1)]], 8, A)])], 32),
				i(" 面板内容 "),
				s(n, {
					name: "content-slide",
					persisted: ""
				}, {
					default: m(() => [h(o("div", {
						class: "panel-body",
						style: l(x.bodyStyles)
					}, [d(e.$slots, "default", {}, void 0, !0)], 4), [[p, !b.isMinimized]])]),
					_: 3
				})
			], 38))]),
			_: 3
		}),
		i(" 最小化时的浮动按钮 "),
		s(n, { name: "fab-fade" }, {
			default: m(() => [!b.isClosed && b.isMinimized ? (u(), a("button", {
				key: 0,
				class: "panel-fab",
				type: "button",
				style: l(x.fabStyles),
				onClick: _[4] ||= (...e) => x.toggleMinimize && x.toggleMinimize(...e),
				title: v.title
			}, [o("span", M, f(v.titleIcon || "⚙️"), 1), o("span", N, f(v.title), 1)], 12, j)) : i("v-if", !0)]),
			_: 1
		})
	]);
}
var F = /*#__PURE__*/ v(S, [["render", P], ["__scopeId", "data-v-5551e28d"]]);
//#endregion
export { F as default };
