import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'CommentMonitor',
    component: () => import('../pages/CommentMonitor.vue'),
    meta: { title: '评论监控' },
  },
  {
    path: '/collect/manual',
    name: 'VideoCollectManual',
    component: () => import('../pages/VideoCollectManual.vue'),
    meta: { title: '视频采集-手动搜索' },
  },
  {
    path: '/collect/auto',
    name: 'VideoCollectAuto',
    component: () => import('../pages/VideoCollectAuto.vue'),
    meta: { title: '视频采集-自动采集' },
  },
  {
    path: '/dm',
    name: 'AutoDM',
    component: () => import('../pages/AutoDM.vue'),
    meta: { title: '自动私信' },
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../pages/Logs.vue'),
    meta: { title: '日志记录' },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../pages/Settings.vue'),
    meta: { title: '系统设置' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
