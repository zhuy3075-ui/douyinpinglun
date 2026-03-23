<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDMStore } from '../stores/dm'
import type { BrowserProfile, DMTask } from '../types'
import { message } from 'ant-design-vue'
import {
  Plus,
  Trash2,
  RefreshCw,
  Send,
  FileText,
  Folder,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  Shield,
} from 'lucide-vue-next'

const store = useDMStore()

const engineToggling = ref(false)
const addAccountId = ref('')
const addAccountVisible = ref(false)
const sensitiveWords = ref('')
const testingAccount = ref<string | null>(null)
const extractingAccount = ref<string | null>(null)

onMounted(async () => {
  store.setupEventListeners()
  await store.fetchAll()
  sensitiveWords.value = '微信\nqq\n加我\n联系\n广告\n推广'
})

onUnmounted(() => {
  store.teardownEventListeners()
})

async function handleToggleEngine() {
  engineToggling.value = true
  try {
    if (store.dmStatus.engine_running) {
      await store.stopEngine()
      message.success('引擎已停止')
    } else {
      await store.startEngine()
      message.success('引擎已启动')
    }
  } catch {
    message.error('操作失败')
  } finally {
    engineToggling.value = false
  }
}

async function handleAddAccount() {
  if (!addAccountId.value.trim()) {
    message.warning('请输入比特浏览器 Profile ID')
    return
  }
  try {
    await store.addAccount(addAccountId.value.trim())
    addAccountId.value = ''
    addAccountVisible.value = false
    message.success('账号已添加')
  } catch {
    message.error('添加失败，请检查 Profile ID')
  }
}

async function handleExtract(profileId: string) {
  extractingAccount.value = profileId
  try {
    await store.extractAccountInfo(profileId)
    message.success('账号信息已提取')
  } catch {
    message.error('提取失败，请检查比特浏览器是否运行')
  } finally {
    extractingAccount.value = null
  }
}

async function handleTest(profileId: string) {
  testingAccount.value = profileId
  try {
    await store.testSendDM(profileId, '7234891023456')
    message.success('测试私信发送成功')
  } catch {
    message.error('测试失败')
  } finally {
    testingAccount.value = null
  }
}

async function handleDeleteAccount(profileId: string) {
  try {
    await store.deleteAccount(profileId)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

async function handleLogin(profileId: string) {
  try {
    await App.LoginBitBrowserWindow(profileId)
    message.success('比特浏览器窗口已打开')
  } catch {
    message.error('打开失败，请确认比特浏览器已运行')
  }
}

function cookieStatusTag(status: string) {
  const map: Record<string, { text: string; color: string; bg: string }> = {
    valid: { text: '在线', color: '#52C41A', bg: '#F6FFED' },
    expired: { text: 'Cookie过期', color: '#FF4D4F', bg: '#FFF1F0' },
    unknown: { text: '未知', color: '#FA8C16', bg: '#FFF7E6' },
    unverified: { text: '未验证', color: '#8C8C8C', bg: '#F5F5F5' },
  }
  return map[status] || map.unknown
}

function taskStatusInfo(status: string) {
  const map: Record<string, { text: string; color: string; bg: string; icon: any }> = {
    pending: { text: '待发送', color: '#FA8C16', bg: '#FFF7E6', icon: Clock },
    sending: { text: '发送中', color: '#1677FF', bg: '#E6F7FF', icon: Loader },
    success: { text: '已成功', color: '#52C41A', bg: '#F6FFED', icon: CheckCircle },
    failed: { text: '失败', color: '#FF4D4F', bg: '#FFF1F0', icon: XCircle },
    blocked: { text: '已封锁', color: '#722ED1', bg: '#F9F0FF', icon: Shield },
  }
  return map[status] || map.pending
}

const accountColumns = [
  { title: '账号信息', key: 'account', width: 160, ellipsis: true },
  { title: '浏览器ID', key: 'profile_id', width: 160, ellipsis: true },
  { title: 'Cookie状态', key: 'cookie', width: 110 },
  { title: '今日已发', key: 'sent', width: 80 },
  { title: '日上限', key: 'limit', width: 72 },
  { title: '操作', key: 'actions', width: 190 },
]

const taskColumns = [
  { title: '目标用户', key: 'target', width: 130 },
  { title: '来源视频', key: 'source', ellipsis: true },
  { title: '状态', key: 'status', width: 80 },
  { title: '时间', key: 'time', width: 115 },
  { title: '操作', key: 'actions', width: 70 },
]

const onlineCount = computed(() =>
  store.accounts.filter(a => a.cookie_status === 'valid').length
)
</script>

<template>
  <div class="page-layout">
    <!-- Title bar -->
    <div class="title-bar">
      <span class="title-bar-title">自动私信</span>
      <div class="divider-v" />

      <div class="stat-item">
        <div :class="store.dmStatus.engine_running ? 'dot-running' : 'dot-stopped'" />
        <span :style="{ color: store.dmStatus.engine_running ? '#00B96B' : '#8C8C8C', fontWeight: 500 }">
          {{ store.dmStatus.engine_running ? '引擎运行中' : '引擎已停止' }}
        </span>
      </div>
      <div class="divider-v" />

      <div class="stat-item">
        今日成功
        <span class="stat-value" style="color: #52C41A;">{{ store.dmStatus.today_success }}</span>
      </div>
      <div class="stat-item">
        今日失败
        <span class="stat-value danger">{{ store.dmStatus.today_failed }}</span>
      </div>

      <div style="flex: 1" />

      <a-switch
        :checked="store.dmStatus.engine_running"
        :loading="engineToggling"
        @change="handleToggleEngine"
      />
    </div>

    <!-- Body split -->
    <div class="body-split">
      <!-- Left 62% -->
      <div class="left-col">
        <!-- Account management -->
        <div class="panel account-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span>账号管理</span>
              <span class="count-badge online">{{ onlineCount }}在线</span>
            </div>
            <div class="panel-header-right">
              <a-button size="small" type="primary" @click="addAccountVisible = true">
                <template #icon><Plus :size="12" /></template>
                新增
              </a-button>
              <a-button size="small" @click="store.fetchAccounts()">
                <template #icon><RefreshCw :size="12" /></template>
                清理
              </a-button>
            </div>
          </div>

          <div class="account-table-wrap">
            <a-table
              :data-source="store.accounts"
              :columns="accountColumns"
              row-key="profile_id"
              :pagination="false"
              size="small"
              :loading="store.loading"
              class="compact-table"
              :scroll="{ y: 'calc(100% - 32px)' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'account'">
                  <div class="account-info">
                    <div class="account-name">{{ record.display_name }}</div>
                    <div class="account-uid text-xs text-placeholder">
                      {{ record.nickname }} · {{ record.douyin_uid }}
                    </div>
                  </div>
                </template>

                <template v-else-if="column.key === 'profile_id'">
                  <span class="profile-id-cell">{{ record.profile_id }}</span>
                </template>

                <template v-else-if="column.key === 'cookie'">
                  <span
                    class="badge"
                    :style="{
                      background: cookieStatusTag(record.cookie_status).bg,
                      color: cookieStatusTag(record.cookie_status).color,
                    }"
                  >
                    {{ cookieStatusTag(record.cookie_status).text }}
                  </span>
                </template>

                <template v-else-if="column.key === 'sent'">
                  <span class="text-sm font-medium">{{ record.daily_dm_sent }}</span>
                </template>

                <template v-else-if="column.key === 'limit'">
                  <span class="text-sm text-secondary">{{ record.daily_dm_limit }}</span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <div class="action-btns">
                    <a-tooltip title="打开比特浏览器窗口（有头模式）">
                      <a-button type="text" size="small" class="icon-btn text-link-btn"
                        @click="handleLogin(record.profile_id)">
                        登录
                      </a-button>
                    </a-tooltip>
                    <span class="action-sep">|</span>
                    <a-tooltip title="从比特浏览器提取 Cookie">
                      <a-button
                        type="text"
                        size="small"
                        class="icon-btn text-link-btn"
                        :loading="extractingAccount === record.profile_id"
                        @click="handleExtract(record.profile_id)"
                      >
                        提取
                      </a-button>
                    </a-tooltip>
                    <span class="action-sep">|</span>
                    <a-tooltip title="测试发送私信">
                      <a-button
                        type="text"
                        size="small"
                        class="icon-btn text-link-btn"
                        :loading="testingAccount === record.profile_id"
                        @click="handleTest(record.profile_id)"
                      >
                        测试
                      </a-button>
                    </a-tooltip>
                    <span class="action-sep">|</span>
                    <a-tooltip title="查看该账号发送日志">
                      <a-button type="text" size="small" class="icon-btn text-link-btn">
                        日志
                      </a-button>
                    </a-tooltip>
                    <span class="action-sep">|</span>
                    <a-tooltip title="删除">
                      <a-button
                        type="text"
                        size="small"
                        class="icon-btn"
                        @click="handleDeleteAccount(record.profile_id)"
                      >
                        <Trash2 :size="13" color="#FF4D4F" />
                      </a-button>
                    </a-tooltip>
                  </div>
                </template>
              </template>
            </a-table>
          </div>
        </div>

        <!-- Task queue -->
        <div class="panel task-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span>任务队列</span>
              <span class="count-badge success">成功{{ store.successTaskCount }}</span>
              <span class="count-badge danger">失败{{ store.failedTaskCount }}</span>
              <span class="count-badge pending">待发{{ store.pendingTaskCount }}</span>
            </div>
            <a-button size="small" @click="store.clearCompletedTasks()">
              清除已完成
            </a-button>
          </div>

          <div class="task-table-wrap">
            <a-table
              :data-source="store.tasks"
              :columns="taskColumns"
              row-key="task_id"
              :pagination="false"
              size="small"
              class="compact-table"
              :scroll="{ y: 'calc(100% - 32px)' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'target'">
                  <div class="user-cell">
                    <div class="nickname">{{ record.target_nickname }}</div>
                    <div class="uid text-xs text-placeholder">{{ record.target_uid }}</div>
                  </div>
                </template>

                <template v-else-if="column.key === 'source'">
                  <span class="text-xs text-secondary truncate" style="max-width: 140px; display: block;">
                    {{ record.source_video_id }}
                  </span>
                </template>

                <template v-else-if="column.key === 'status'">
                  <span
                    class="badge"
                    :style="{
                      background: taskStatusInfo(record.status).bg,
                      color: taskStatusInfo(record.status).color,
                    }"
                  >
                    {{ taskStatusInfo(record.status).text }}
                  </span>
                </template>

                <template v-else-if="column.key === 'time'">
                  <span class="text-xs text-secondary">
                    {{ record.sent_at ? record.sent_at.slice(5, 16) : record.created_at.slice(5, 16) }}
                  </span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <a-tooltip title="重新发送">
                    <a-button type="text" size="small" class="icon-btn">
                      <RefreshCw :size="13" color="#1677FF" />
                    </a-button>
                  </a-tooltip>
                </template>
              </template>
            </a-table>
          </div>
        </div>
      </div>

      <!-- Right 38% -->
      <div class="right-col panel config-panel">
        <div class="panel-header">
          <span>参数配置</span>
          <a-button
            type="primary"
            size="small"
            :loading="store.configSaving"
            @click="store.saveConfig()"
          >
            保存
          </a-button>
        </div>

        <div class="config-body">
          <!-- Template path -->
          <div class="config-section">
            <div class="section-title">私信模板</div>
            <div class="config-row-v">
              <label>模板文件路径</label>
              <div class="path-input-row">
                <a-input
                  v-model:value="store.config.template_path"
                  size="small"
                  placeholder="选择模板文件..."
                  style="flex: 1"
                />
                <a-button size="small" class="icon-btn-sq">
                  <Folder :size="13" color="#595959" />
                </a-button>
              </div>
            </div>

            <div class="config-row-v">
              <label>敏感词过滤（每行一个）</label>
              <a-textarea
                v-model:value="sensitiveWords"
                :rows="5"
                size="small"
                placeholder="每行输入一个敏感词..."
                style="font-size: 12px; resize: none;"
              />
            </div>
          </div>

          <!-- Frequency control -->
          <div class="config-section">
            <div class="section-title">频率控制</div>
            <div class="config-row">
              <label>最小间隔</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="store.config.min_interval_sec"
                  :min="10"
                  :max="3600"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">秒</span>
              </div>
            </div>
            <div class="config-row">
              <label>单号日限</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="store.config.daily_limit_per_account"
                  :min="1"
                  :max="500"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">条</span>
              </div>
            </div>
            <div class="config-row">
              <label>总日限</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="store.config.daily_limit_total"
                  :min="1"
                  :max="9999"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">条</span>
              </div>
            </div>
            <div class="config-row">
              <label>并发线程</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="store.config.concurrency"
                  :min="1"
                  :max="10"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">个</span>
              </div>
            </div>
          </div>

          <!-- Other options -->
          <div class="config-section">
            <div class="section-title">其他选项</div>
            <div class="config-row">
              <label>自动添加到监控</label>
              <a-switch v-model:checked="store.config.auto_add_to_monitor" size="small" />
            </div>
            <div class="config-row">
              <label>仅发送新视频评论</label>
              <a-switch v-model:checked="store.config.new_video_only" size="small" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add account modal -->
    <a-modal
      v-model:visible="addAccountVisible"
      title="添加账号"
      :width="380"
      @ok="handleAddAccount"
    >
      <div style="padding: 12px 0;">
        <div style="margin-bottom: 8px; font-size: 12px; color: #595959;">
          输入比特浏览器的 Profile ID（在浏览器管理界面可找到）
        </div>
        <a-input
          v-model:value="addAccountId"
          placeholder="例: abc123def456"
          @press-enter="handleAddAccount"
        />
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.body-split {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
  min-height: 0;
}

.left-col {
  flex: 0 0 62%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.right-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.account-panel {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.account-table-wrap,
.task-table-wrap {
  flex: 1;
  overflow: hidden;
}

.count-badge {
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: #F0F0F0;
  color: #595959;
}
.count-badge.online { background: #F6FFED; color: #52C41A; }
.count-badge.success { background: #F6FFED; color: #52C41A; }
.count-badge.danger { background: #FFF1F0; color: #FF4D4F; }
.count-badge.pending { background: #FFF7E6; color: #FA8C16; }

.account-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.account-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.account-uid {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-btns {
  display: flex;
  gap: 2px;
}
.icon-btn {
  padding: 2px 4px !important;
  width: 24px !important;
  height: 24px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.nickname {
  font-size: 12px;
  font-weight: 500;
}
.uid {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Config panel */
.config-panel { min-height: 0; }

.config-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.config-row label {
  font-size: 12px;
  color: var(--color-text-primary);
  min-width: 80px;
}

.config-row-v {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.config-row-v label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.profile-id-cell {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-text-placeholder);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.text-link-btn {
  font-size: 12px !important;
  color: #1677FF !important;
  padding: 0 3px !important;
}
.text-link-btn:hover { color: #4096ff !important; }

.action-sep {
  color: #D9D9D9;
  font-size: 12px;
  user-select: none;
}

.path-input-row {
  display: flex;
  gap: 4px;
}
.icon-btn-sq {
  width: 28px !important;
  height: 24px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.config-control {
  display: flex;
  align-items: center;
  gap: 4px;
}
.unit-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
