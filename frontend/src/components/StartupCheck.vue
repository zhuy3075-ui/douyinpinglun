<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle, XCircle, HelpCircle, RefreshCw } from 'lucide-vue-next'
import * as App from '../wailsjs/go/main/App'
import type { StartupCheckItem } from '../types'

const router = useRouter()

const visible = ref(false)
const loading = ref(true)
const items = ref<StartupCheckItem[]>([])

const failedCount = computed(() => items.value.filter(i => i.cookie_status !== 'valid').length)
const allOk = computed(() => failedCount.value === 0)

async function runCheck() {
  loading.value = true
  items.value = []
  try {
    const result = await App.GetStartupCheckResult()
    items.value = result
  } catch {
    // If no accounts, show empty result
    items.value = []
  } finally {
    loading.value = false
  }
}

function open() {
  visible.value = true
  runCheck()
}

function close() {
  visible.value = false
}

function goSettings() {
  visible.value = false
  router.push('/settings')
}

onMounted(() => {
  // Auto-open on mount
  open()
})

defineExpose({ open })
</script>

<template>
  <a-modal
    v-model:open="visible"
    title="启动检测 — 比特浏览器窗口 Cookie 状态"
    :width="520"
    :footer="null"
    :closable="!loading"
    :mask-closable="!loading"
  >
    <div class="startup-check">
      <div v-if="loading" class="check-loading">
        <a-spin size="large" />
        <p class="loading-text">正在检测所有窗口 Cookie 有效性...</p>
      </div>

      <template v-else>
        <div v-if="items.length === 0" class="check-empty">
          <HelpCircle :size="40" color="#8C8C8C" />
          <p>暂未添加任何比特浏览器账号</p>
          <a-button type="primary" @click="goSettings">前往系统设置添加账号</a-button>
        </div>

        <template v-else>
          <div class="result-summary" :class="allOk ? 'all-ok' : 'has-error'">
            <CheckCircle v-if="allOk" :size="18" color="#00B96B" />
            <XCircle v-else :size="18" color="#FF4D4F" />
            <span v-if="allOk">所有窗口 Cookie 有效，可正常运行</span>
            <span v-else>{{ failedCount }} 个窗口 Cookie 已过期或未知，请刷新</span>
          </div>

          <div class="check-list">
            <div
              v-for="item in items"
              :key="item.profile_id"
              class="check-item"
              :class="item.cookie_status"
            >
              <div class="item-seq">#{{ item.seq }}</div>
              <div class="item-info">
                <span class="item-nickname">{{ item.nickname }}</span>
                <span class="item-pid">{{ item.profile_id.slice(0, 16) }}...</span>
              </div>
              <div class="item-status">
                <CheckCircle v-if="item.cookie_status === 'valid'" :size="16" color="#00B96B" />
                <XCircle v-else-if="item.cookie_status === 'expired'" :size="16" color="#FF4D4F" />
                <HelpCircle v-else :size="16" color="#8C8C8C" />
                <span class="status-text" :class="item.cookie_status">{{ item.message }}</span>
              </div>
            </div>
          </div>

          <div class="check-actions">
            <a-button :icon="h(RefreshCw, { size: 14 })" @click="runCheck">重新检测</a-button>
            <a-button v-if="failedCount > 0" type="link" danger @click="goSettings">
              前往设置刷新 Cookie →
            </a-button>
            <a-button type="primary" @click="close">{{ allOk ? '开始使用' : '忽略继续' }}</a-button>
          </div>
        </template>
      </template>
    </div>
  </a-modal>
</template>

<script lang="ts">
import { h } from 'vue'
export default { name: 'StartupCheck' }
</script>

<style scoped>
.startup-check {
  padding: 8px 0;
}

.check-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  gap: 16px;
}

.loading-text {
  color: #595959;
  font-size: 14px;
  margin: 0;
}

.check-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
  color: #8C8C8C;
}

.result-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
}

.result-summary.all-ok {
  background: rgba(0, 185, 107, 0.08);
  color: #00B96B;
}

.result-summary.has-error {
  background: rgba(255, 77, 79, 0.08);
  color: #FF4D4F;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #FAFAFA;
  border: 1px solid #E8E8E8;
  border-radius: 6px;
}

.check-item.expired {
  border-color: rgba(255, 77, 79, 0.3);
  background: rgba(255, 77, 79, 0.04);
}

.item-seq {
  width: 32px;
  height: 24px;
  background: #1A1A1A;
  color: #FFFFFF;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-nickname {
  font-size: 13px;
  font-weight: 500;
  color: #1A1A1A;
}

.item-pid {
  font-size: 11px;
  color: #8C8C8C;
  font-family: 'Courier New', monospace;
}

.item-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-text {
  font-size: 13px;
}

.status-text.valid { color: #00B96B; }
.status-text.expired { color: #FF4D4F; }
.status-text.unknown { color: #8C8C8C; }

.check-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}
</style>
