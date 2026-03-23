<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  MessageSquare,
  Video,
  Send,
  FileText,
  Settings,
} from 'lucide-vue-next'
import StartupCheck from './components/StartupCheck.vue'

const startupCheckRef = ref<InstanceType<typeof StartupCheck> | null>(null)

onMounted(() => {
  // Startup check auto-opens inside the component itself
})

const route = useRoute()
const router = useRouter()

interface NavItem {
  label: string
  icon: any
  path: string
  activePaths?: string[]
}

const navItems: NavItem[] = [
  {
    label: '评论监控',
    icon: MessageSquare,
    path: '/',
  },
  {
    label: '视频采集',
    icon: Video,
    path: '/collect/manual',
    activePaths: ['/collect/manual', '/collect/auto'],
  },
  {
    label: '自动私信',
    icon: Send,
    path: '/dm',
  },
  {
    label: '日志记录',
    icon: FileText,
    path: '/logs',
  },
  {
    label: '系统设置',
    icon: Settings,
    path: '/settings',
  },
]

function isActive(item: NavItem): boolean {
  if (item.activePaths) {
    return item.activePaths.includes(route.path)
  }
  return route.path === item.path
}

function navigate(item: NavItem) {
  router.push(item.path)
}
</script>

<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">
          <MessageSquare :size="18" color="#FFFFFF" />
        </div>
        <span class="logo-text">截流系统</span>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.path"
          class="nav-item"
          :class="{ active: isActive(item) }"
          @click="navigate(item)"
        >
          <component :is="item.icon" :size="16" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <span class="version-text">v1.0.0 POC</span>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>

  <!-- Startup cookie check modal -->
  <StartupCheck ref="startupCheckRef" />
</template>

<style scoped>
.app-shell {
  display: flex;
  width: 1200px;
  height: 700px;
  overflow: hidden;
  background: var(--color-page-bg);
}

.sidebar {
  width: 200px;
  min-width: 200px;
  height: 700px;
  background: #141414;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-logo {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.logo-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-size: 14px;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 0.5px;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.85);
}

.nav-item.active {
  background: rgba(0, 185, 107, 0.15);
  color: var(--color-primary);
}

.nav-item.active .nav-icon {
  color: var(--color-primary);
}

.nav-icon {
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.version-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
}

.main-content {
  flex: 1;
  height: 700px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
