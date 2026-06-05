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
  // 本地优先：扫描源码中用到的 i-lucide-* 图标并打入客户端 bundle，
  // 避免运行时联网拉取图标（消除 [Icon] loading ... timed out 警告，离线可用）。
  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true, sizeLimitKb: 512 }
  },
  compatibilityDate: '2025-06-01'
})
