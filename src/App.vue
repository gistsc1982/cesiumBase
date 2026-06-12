<template>
  <div id="app">
    <CesiumMain />
  </div>
</template>

<script>
import CesiumMain from "./components/CesiumMain.vue";

export default {
  name: "App",
  components: {
    CesiumMain,
  },
};
</script>

<style>
html,
body,
#app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
