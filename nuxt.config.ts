/// <reference types="nuxt" />
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui'
  ],
  devtools: {
    enabled: true
  },
  css: ['~/assets/css/main.css'],
  // 白色主题：强制 light 模式，禁止跟随系统深色（否则 Nuxt UI 组件渲染成深色）。
  // 用专属 storageKey 让旧的 nuxt-color-mode 持久化值失效，老访客也直接生效。
  colorMode: {
    preference: 'light',
    fallback: 'light',
    storageKey: 'yggdrasil-color-mode'
  },
  // 本地优先：扫描源码中用到的 i-lucide-* 图标并打入客户端 bundle，
  // 避免运行时联网拉取图标（消除 [Icon] loading ... timed out 警告，离线可用）。
  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true, sizeLimitKb: 512 }
  },
  compatibilityDate: '2025-06-01'
})
