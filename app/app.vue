<template>
  <UApp>
    <div class="app-shell">
    <nav class="app-nav">
      <div class="app-brand" title="Yggdrasil">
        <UIcon name="i-lucide-sprout" class="brand-icon" />
      </div>
      <div class="nav-links">
        <NuxtLink to="/" class="nav-link" active-class="nav-active" title="War">
          <UIcon name="i-lucide-radar" class="nav-icon" />
          <span class="nav-label">War</span>
        </NuxtLink>
        <NuxtLink to="/team" class="nav-link" active-class="nav-active" title="团队">
          <UIcon name="i-lucide-users" class="nav-icon" />
          <span class="nav-label">Team</span>
        </NuxtLink>
        <NuxtLink to="/stats" class="nav-link" active-class="nav-active" title="统计">
          <UIcon name="i-lucide-chart-column" class="nav-icon" />
          <span class="nav-label">Stats</span>
        </NuxtLink>
      </div>
    </nav>
    <main class="app-main">
      <NuxtPage />
    </main>
    </div>
  </UApp>
</template>

<style>
.app-shell { display: flex; height: 100vh; background: var(--color-bg); }
.app-nav { width: 84px; background: var(--color-surface-2); border-right: 1px solid var(--color-border); display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 16px; flex-shrink: 0; }
.app-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

/* Brand mark — Yggdrasil world tree */
.app-brand { width: 44px; height: 44px; border-radius: 12px; background: var(--gradient-green); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(34,197,94,.28); }
.brand-icon { font-size: 1.5rem; color: #fff; }

.nav-links { display: flex; flex-direction: column; gap: 6px; width: 100%; align-items: center; padding-top: 4px; border-top: 1px solid var(--color-border); }
.nav-link { position: relative; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 6px; border-radius: 12px; color: var(--color-text-muted); text-decoration: none; font-size: .7rem; transition: color .15s, background .15s; width: 68px; }
.nav-link:hover { background: var(--color-surface-hover); color: var(--color-text); }
.nav-active { color: var(--color-primary-strong); background: var(--gradient-green-soft); }
.nav-active:hover { color: var(--color-primary-strong); background: var(--gradient-green-soft); }
.nav-active::before { content: ""; position: absolute; left: -12px; top: 50%; transform: translateY(-50%); width: 3px; height: 22px; border-radius: 0 3px 3px 0; background: var(--gradient-green); }
.nav-icon { font-size: 1.35rem; }
.nav-label { text-transform: uppercase; letter-spacing: .03em; font-weight: 600; }
</style>
