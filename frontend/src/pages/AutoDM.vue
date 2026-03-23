<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { message } from 'ant-design-vue'
import {
  Plus,
  Trash2,
  RefreshCw,
  Folder,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  FileText,
} from 'lucide-vue-next'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'

// ─── Types ─────────────────────────────────────────────────────────────────

interface PendingReview {
  task_id: string
  target_nickname: string
  target_uid: string
  comment_content: string
  trigger_keyword: string
  source_video_title: string
  planned_message: string
}

interface DMTask {
  task_id: string
  target_nickname: string
  target_uid: string
  source_video_title: string
  trigger_comment: string
  executor_account_nickname: string
  executor_seq: number
  status: 'pending' | 'sending' | 'success' | 'failed' | 'blocked'
  sent_at: string
  created_at: string
}

interface BrowserProfile {
  profile_id: string
  display_name: string
  douyin_uid: string
  nickname: string
  cookie_status: 'valid' | 'expired' | 'unknown' | 'unverified'
  cookie_updated_at: string
  test_passed: boolean
  enabled: boolean
  daily_dm_sent: number
  daily_dm_limit: number
  consecutive_failures: number
}

interface DMKeyword {
  id: string
  keyword: string
  match_type: 'exact' | 'fuzzy' | 'semantic'
  category?: string
  enabled: boolean
}

interface DMConfig {
  template_path: string
  min_interval_sec: number
  max_interval_sec: number
  daily_limit_per_account: number
  daily_limit_total: number
  concurrency: number
  auto_add_to_monitor: boolean
  new_video_only: boolean
}

interface DMStatus {
  engine_running: boolean
  today_success: number
  today_failed: number
  pending_review_count: number
}

// ─── State ──────────────────────────────────────────────────────────────────

const activeTab = ref('pending')

// Engine
const engineRunning = ref(false)
const engineToggling = ref(false)
const todaySuccess = ref(0)
const todayFailed = ref(0)
const pendingReviewCount = ref(0)

// Tab 1: 待审核
const pendingList = ref<PendingReview[]>([])
const pendingTotal = ref(0)
const pendingPage = ref(1)
const pendingLoading = ref(false)
const pendingSelectedKeys = ref<string[]>([])
const pendingSelectedRows = ref<PendingReview[]>([])
const exportModalVisible = ref(false)
const exportLoading = ref(false)
const approveLoading = ref(false)
const skipLoading = ref(false)

// Tab 2: 发送队列
const taskList = ref<DMTask[]>([])
const taskTotal = ref(0)
const taskPage = ref(1)
const taskLoading = ref(false)
const taskStatusFilter = ref('')
const taskSearchNickname = ref('')

// Tab 3: 账号管理
const accounts = ref<BrowserProfile[]>([])
const accountTotal = ref(0)
const accountPage = ref(1)
const accountLoading = ref(false)
const addAccountVisible = ref(false)
const addAccountId = ref('')
const addAccountLoading = ref(false)
const testingAccount = ref<string | null>(null)
const extractingAccount = ref<string | null>(null)

// Tab 4: 频率控制
const config = reactive<DMConfig>({
  template_path: '',
  min_interval_sec: 60,
  max_interval_sec: 180,
  daily_limit_per_account: 100,
  daily_limit_total: 500,
  concurrency: 3,
  auto_add_to_monitor: false,
  new_video_only: false,
})
const configSaving = ref(false)
const templateStatus = ref('')
const dmKeywords = ref<DMKeyword[]>([])
const keywordsLoading = ref(false)
const fullModeEnabled = ref(false)
const addKeywordVisible = ref(false)
const addKeywordLoading = ref(false)
const newKeyword = reactive({
  keyword: '',
  match_type: 'exact' as 'exact' | 'fuzzy' | 'semantic',
  category: '',
  enabled: true,
})

// ─── Computed ────────────────────────────────────────────────────────────────

const onlineAccountCount = computed(
  () => accounts.value.filter(a => a.cookie_status === 'valid').length
)

const pendingRowSelection = computed(() => ({
  selectedRowKeys: pendingSelectedKeys.value,
  onChange: (keys: string[], rows: PendingReview[]) => {
    pendingSelectedKeys.value = keys
    pendingSelectedRows.value = rows
  },
}))

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadEngineStatus()
  await loadPendingReviews()
  await loadAccounts()
  await loadDMConfig()
  await loadDMKeywords()

  EventsOn('dm:stats-update', (data: DMStatus) => {
    engineRunning.value = data.engine_running
    todaySuccess.value = data.today_success
    todayFailed.value = data.today_failed
    pendingReviewCount.value = data.pending_review_count
  })
  EventsOn('dm:task-update', () => {
    if (activeTab.value === 'queue') loadTaskQueue()
  })
})

onUnmounted(() => {
  EventsOff('dm:stats-update')
  EventsOff('dm:task-update')
})

// ─── Data Loaders ────────────────────────────────────────────────────────────

async function loadEngineStatus() {
  try {
    const status = await App.GetDMStatus()
    engineRunning.value = status.engine_running
    todaySuccess.value = status.today_success
    todayFailed.value = status.today_failed
    pendingReviewCount.value = status.pending_review_count ?? 0
  } catch {
    // non-blocking
  }
}

async function loadPendingReviews() {
  pendingLoading.value = true
  try {
    const result = await App.GetPendingReviews(pendingPage.value, 9)
    pendingList.value = result?.items ?? []
    pendingTotal.value = result?.total ?? 0
    pendingReviewCount.value = result?.total ?? 0
  } catch {
    message.error('加载待审核列表失败')
  } finally {
    pendingLoading.value = false
  }
}

async function loadTaskQueue() {
  taskLoading.value = true
  try {
    const result = await App.GetDMTasks(taskStatusFilter.value, taskPage.value, 9)
    taskList.value = result?.items ?? []
    taskTotal.value = result?.total ?? 0
  } catch {
    message.error('加载发送队列失败')
  } finally {
    taskLoading.value = false
  }
}

async function loadAccounts(page = accountPage.value) {
  accountLoading.value = true
  try {
    const result = await App.GetAccounts(page, 6)
    accounts.value = result?.items ?? result ?? []
    accountTotal.value = result?.total ?? (result?.length ?? 0)
  } catch {
    message.error('加载账号列表失败')
  } finally {
    accountLoading.value = false
  }
}

async function loadDMConfig() {
  try {
    const cfg = await App.GetDMConfig()
    if (cfg) Object.assign(config, cfg)
  } catch {
    // non-blocking
  }
}

async function loadDMKeywords() {
  keywordsLoading.value = true
  try {
    const kws = await App.GetDMKeywords()
    dmKeywords.value = kws ?? []
  } catch {
    // non-blocking
  } finally {
    keywordsLoading.value = false
  }
}

// ─── Tab change ──────────────────────────────────────────────────────────────

async function onTabChange(key: string) {
  activeTab.value = key
  if (key === 'pending') await loadPendingReviews()
  else if (key === 'queue') await loadTaskQueue()
  else if (key === 'accounts') await loadAccounts()
}

// ─── Engine ──────────────────────────────────────────────────────────────────

async function handleToggleEngine() {
  engineToggling.value = true
  try {
    if (engineRunning.value) {
      await App.StopDMEngine()
      engineRunning.value = false
      message.success('引擎已停止')
    } else {
      await App.StartDMEngine()
      engineRunning.value = true
      message.success('引擎已启动')
    }
  } catch {
    message.error('操作失败')
  } finally {
    engineToggling.value = false
  }
}

// ─── Tab 1: Pending Reviews ───────────────────────────────────────────────────

async function handleApproveBatch() {
  if (!pendingSelectedKeys.value.length) {
    message.warning('请先勾选记录')
    return
  }
  approveLoading.value = true
  try {
    await App.ApproveDMTasks(pendingSelectedKeys.value)
    message.success(`已通过 ${pendingSelectedKeys.value.length} 条`)
    pendingSelectedKeys.value = []
    pendingSelectedRows.value = []
    await loadPendingReviews()
  } catch {
    message.error('批量通过失败')
  } finally {
    approveLoading.value = false
  }
}

async function handleSkipBatch() {
  if (!pendingSelectedKeys.value.length) {
    message.warning('请先勾选记录')
    return
  }
  skipLoading.value = true
  try {
    await App.SkipDMTasks(pendingSelectedKeys.value)
    message.success(`已跳过 ${pendingSelectedKeys.value.length} 条`)
    pendingSelectedKeys.value = []
    pendingSelectedRows.value = []
    await loadPendingReviews()
  } catch {
    message.error('批量跳过失败')
  } finally {
    skipLoading.value = false
  }
}

async function handleExport(format: 'csv' | 'txt') {
  exportLoading.value = true
  try {
    await App.ExportPendingReviews(format)
    message.success(`已导出为 ${format.toUpperCase()}`)
    exportModalVisible.value = false
  } catch {
    message.error('导出失败')
  } finally {
    exportLoading.value = false
  }
}

async function onPendingPageChange(page: number) {
  pendingPage.value = page
  pendingSelectedKeys.value = []
  await loadPendingReviews()
}

// ─── Tab 2: Task Queue ────────────────────────────────────────────────────────

async function onTaskStatusChange() {
  taskPage.value = 1
  await loadTaskQueue()
}

async function onTaskPageChange(page: number) {
  taskPage.value = page
  await loadTaskQueue()
}

async function handleRetryTask(taskId: string) {
  try {
    await App.RetryDMTask(taskId)
    message.success('已重新加入队列')
    await loadTaskQueue()
  } catch {
    message.error('重试失败')
  }
}

async function handleDeleteTask(taskId: string) {
  try {
    await App.DeleteDMTask(taskId)
    message.success('已删除')
    await loadTaskQueue()
  } catch {
    message.error('删除失败')
  }
}

// ─── Tab 3: Accounts ─────────────────────────────────────────────────────────

async function handleAddAccount() {
  if (!addAccountId.value.trim()) {
    message.warning('请输入比特浏览器 Profile ID')
    return
  }
  addAccountLoading.value = true
  try {
    await App.AddAccount(addAccountId.value.trim())
    addAccountId.value = ''
    addAccountVisible.value = false
    message.success('账号已添加')
    await loadAccounts(1)
  } catch {
    message.error('添加失败，请检查 Profile ID')
  } finally {
    addAccountLoading.value = false
  }
}

async function handleExtract(profileId: string) {
  extractingAccount.value = profileId
  try {
    await App.ExtractAccountInfo(profileId)
    message.success('账号信息已提取')
    await loadAccounts()
  } catch {
    message.error('提取失败，请检查比特浏览器是否运行')
  } finally {
    extractingAccount.value = null
  }
}

async function handleTest(profileId: string) {
  testingAccount.value = profileId
  try {
    await App.TestSendDM(profileId, '7234891023456')
    message.success('测试私信发送成功（stub）')
  } catch {
    message.error('测试失败')
  } finally {
    testingAccount.value = null
  }
}

async function handleLoginAccount(profileId: string) {
  try {
    await App.LoginBitBrowserWindow(profileId)
    message.success('比特浏览器窗口已打开')
  } catch {
    message.error('打开失败，请确认比特浏览器已运行')
  }
}

async function handleToggleAccount(profileId: string, enabled: boolean) {
  try {
    await App.SetAccountEnabled(profileId, enabled)
  } catch {
    message.error('操作失败')
    await loadAccounts()
  }
}

async function handleDeleteAccount(profileId: string) {
  try {
    await App.DeleteAccount(profileId)
    message.success('已删除')
    await loadAccounts()
  } catch {
    message.error('删除失败')
  }
}

async function onAccountPageChange(page: number) {
  accountPage.value = page
  await loadAccounts(page)
}

// ─── Tab 4: Config ────────────────────────────────────────────────────────────

async function handleSaveConfig() {
  configSaving.value = true
  try {
    await App.SaveDMConfig({ ...config })
    message.success('配置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    configSaving.value = false
  }
}

async function handleReloadTemplate() {
  try {
    const status = await App.ReloadDMTemplate()
    templateStatus.value = status ?? ''
    message.success('模板已重新加载')
  } catch {
    message.error('重新加载失败')
  }
}

async function handlePreviewTemplate() {
  try {
    await App.PreviewDMTemplate()
  } catch {
    message.error('预览失败')
  }
}

// Keywords
async function handleAddKeyword() {
  if (!newKeyword.keyword.trim()) {
    message.warning('请输入关键词')
    return
  }
  addKeywordLoading.value = true
  try {
    await App.AddDMKeyword({
      keyword: newKeyword.keyword.trim(),
      match_type: newKeyword.match_type,
      category: newKeyword.category,
      enabled: true,
    })
    message.success('关键词已添加')
    Object.assign(newKeyword, { keyword: '', match_type: 'exact', category: '', enabled: true })
    addKeywordVisible.value = false
    await loadDMKeywords()
  } catch {
    message.error('添加失败')
  } finally {
    addKeywordLoading.value = false
  }
}

async function handleDeleteKeyword(id: string) {
  try {
    await App.DeleteDMKeyword(id)
    await loadDMKeywords()
  } catch {
    message.error('删除失败')
  }
}

async function handleToggleKeyword(id: string, enabled: boolean) {
  try {
    await App.SetDMKeywordEnabled(id, enabled)
    const kw = dmKeywords.value.find(k => k.id === id)
    if (kw) kw.enabled = enabled
  } catch {
    message.error('操作失败')
    await loadDMKeywords()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cookieStatusTag(status: string) {
  const map: Record<string, { text: string; color: string; bg: string }> = {
    valid:      { text: '在线',       color: '#52C41A', bg: '#F6FFED' },
    expired:    { text: 'Cookie过期', color: '#FF4D4F', bg: '#FFF1F0' },
    unknown:    { text: '未知',       color: '#FA8C16', bg: '#FFF7E6' },
    unverified: { text: '未验证',     color: '#8C8C8C', bg: '#F5F5F5' },
  }
  return map[status] ?? map.unknown
}

function taskStatusInfo(status: string) {
  const map: Record<string, { text: string; color: string; bg: string }> = {
    pending:  { text: '待发送', color: '#FA8C16', bg: '#FFF7E6' },
    sending:  { text: '发送中', color: '#1677FF', bg: '#E6F7FF' },
    success:  { text: '已成功', color: '#52C41A', bg: '#F6FFED' },
    failed:   { text: '失败',   color: '#FF4D4F', bg: '#FFF1F0' },
    blocked:  { text: '已封锁', color: '#722ED1', bg: '#F9F0FF' },
  }
  return map[status] ?? map.pending
}

function matchTypeLabel(t: string) {
  const m: Record<string, string> = {
    exact:    '精确包含',
    fuzzy:    '模糊匹配',
    semantic: '语义匹配',
  }
  return m[t] ?? t
}

function matchTypeColor(t: string) {
  return t === 'exact' ? '#1677FF' : t === 'fuzzy' ? '#FA8C16' : '#722ED1'
}

function categoryLabel(c: string) {
  const m: Record<string, string> = {
    purchase_intent:  '购买意向',
    price_inquiry:    '价格询问',
    contact_request:  '联系方式',
    channel_source:   '渠道来源',
  }
  return m[c] ?? c
}

function formatTime(s: string) {
  if (!s) return '—'
  return s.slice(5, 16).replace('T', ' ')
}

function truncate(s: string, n = 40) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}
</script>

<template>
  <div class="page-layout">
    <!-- ── Header Bar ─────────────────────────────────────────────────── -->
    <div class="title-bar">
      <span class="title-bar-title">自动私信</span>
      <div class="divider-v" />

      <!-- Engine dot -->
      <div class="stat-item gap-4">
        <span
          class="engine-dot"
          :class="engineRunning ? 'dot-on' : 'dot-off'"
        />
        <span :style="{ color: engineRunning ? '#00B96B' : '#8C8C8C', fontWeight: 500, fontSize: '13px' }">
          {{ engineRunning ? '引擎运行中' : '引擎已停止' }}
        </span>
      </div>

      <div class="divider-v" />

      <!-- Stats -->
      <div class="stat-item gap-6">
        <span class="stat-chip success">✅ {{ todaySuccess }}</span>
        <span class="stat-chip danger">❌ {{ todayFailed }}</span>
      </div>

      <!-- Pending badge -->
      <a-badge :count="pendingReviewCount" :overflow-count="999" color="#FA8C16">
        <span
          class="pending-badge-label"
          :class="activeTab === 'pending' ? 'active' : ''"
          @click="onTabChange('pending')"
        >
          待审核
        </span>
      </a-badge>

      <div style="flex: 1" />

      <a-switch
        :checked="engineRunning"
        :loading="engineToggling"
        checked-children="运行"
        un-checked-children="停止"
        @change="handleToggleEngine"
        style="--ant-switch-color: #00B96B"
      />
    </div>

    <!-- ── Tabs Body ──────────────────────────────────────────────────── -->
    <div class="tabs-body">
      <a-tabs
        v-model:active-key="activeTab"
        class="main-tabs"
        @change="onTabChange"
        :tab-bar-style="{ margin: 0, paddingLeft: '16px', background: '#fff', borderBottom: '1px solid #E8E8E8' }"
      >
        <!-- ══ Tab 1: 待审核 ═══════════════════════════════════════════ -->
        <a-tab-pane key="pending">
          <template #tab>
            <a-badge :count="pendingReviewCount" :overflow-count="999" color="#FA8C16">
              <span class="tab-label">待审核</span>
            </a-badge>
          </template>

          <div class="tab-content">
            <!-- Toolbar -->
            <div class="toolbar">
              <a-checkbox
                :indeterminate="pendingSelectedKeys.length > 0 && pendingSelectedKeys.length < pendingList.length"
                :checked="pendingSelectedKeys.length > 0 && pendingSelectedKeys.length === pendingList.length"
                @change="(e: any) => {
                  if (e.target.checked) {
                    pendingSelectedKeys = pendingList.map(r => r.task_id)
                    pendingSelectedRows = [...pendingList]
                  } else {
                    pendingSelectedKeys = []
                    pendingSelectedRows = []
                  }
                }"
              >
                全选
              </a-checkbox>

              <span class="select-count">已选 {{ pendingSelectedKeys.length }} 条</span>

              <a-button
                size="small"
                :loading="approveLoading"
                :disabled="!pendingSelectedKeys.length"
                style="background: #00B96B; border-color: #00B96B; color: #fff;"
                @click="handleApproveBatch"
              >
                ✅ 批量通过
              </a-button>

              <a-button
                size="small"
                :loading="skipLoading"
                :disabled="!pendingSelectedKeys.length"
                danger
                @click="handleSkipBatch"
              >
                ⛔ 批量跳过
              </a-button>

              <div style="flex: 1" />

              <a-button size="small" @click="exportModalVisible = true">
                <template #icon><Download :size="12" /></template>
                导出
              </a-button>
            </div>

            <!-- Table -->
            <div class="table-wrap">
              <a-table
                :data-source="pendingList"
                row-key="task_id"
                :loading="pendingLoading"
                :pagination="false"
                size="small"
                class="compact-table"
                :row-selection="pendingRowSelection"
                :scroll="{ y: 'calc(100% - 32px)' }"
              >
                <a-table-column title="目标用户" key="target" :width="140">
                  <template #default="{ record }">
                    <div class="user-cell">
                      <span class="user-name">{{ record.target_nickname }}</span>
                      <span class="user-uid">{{ record.target_uid }}</span>
                    </div>
                  </template>
                </a-table-column>

                <a-table-column title="原始评论内容" key="comment" :ellipsis="true">
                  <template #default="{ record }">
                    <a-tooltip :title="record.comment_content">
                      <span class="text-line1">{{ truncate(record.comment_content, 35) }}</span>
                    </a-tooltip>
                  </template>
                </a-table-column>

                <a-table-column title="触发关键词" key="keyword" :width="110">
                  <template #default="{ record }">
                    <a-tag color="blue" style="font-size: 11px;">{{ record.trigger_keyword }}</a-tag>
                  </template>
                </a-table-column>

                <a-table-column title="来源视频" key="source" :ellipsis="true">
                  <template #default="{ record }">
                    <a-tooltip :title="record.source_video_title">
                      <span class="text-line1 text-secondary">{{ truncate(record.source_video_title, 25) }}</span>
                    </a-tooltip>
                  </template>
                </a-table-column>

                <a-table-column title="计划发送私信" key="message" :ellipsis="true">
                  <template #default="{ record }">
                    <a-tooltip :title="record.planned_message">
                      <span class="text-line1">{{ truncate(record.planned_message, 30) }}</span>
                    </a-tooltip>
                  </template>
                </a-table-column>
              </a-table>
            </div>

            <!-- Pagination -->
            <div class="pagination-row">
              <a-pagination
                v-model:current="pendingPage"
                :total="pendingTotal"
                :page-size="9"
                :show-size-changer="false"
                :show-total="(total: number) => `共 ${total} 条`"
                size="small"
                @change="onPendingPageChange"
              />
            </div>
          </div>
        </a-tab-pane>

        <!-- ══ Tab 2: 发送队列 ════════════════════════════════════════ -->
        <a-tab-pane key="queue" tab="发送队列">
          <div class="tab-content">
            <!-- Filter bar -->
            <div class="toolbar">
              <a-select
                v-model:value="taskStatusFilter"
                size="small"
                style="width: 110px"
                placeholder="全部状态"
                allow-clear
                @change="onTaskStatusChange"
              >
                <a-select-option value="">全部</a-select-option>
                <a-select-option value="pending">待发</a-select-option>
                <a-select-option value="success">已发</a-select-option>
                <a-select-option value="failed">失败</a-select-option>
              </a-select>

              <a-input
                v-model:value="taskSearchNickname"
                size="small"
                placeholder="搜索昵称…"
                allow-clear
                style="width: 150px"
                @change="onTaskStatusChange"
              />

              <div style="flex: 1" />

              <a-button size="small" @click="loadTaskQueue">
                <template #icon><RefreshCw :size="12" /></template>
                刷新
              </a-button>
            </div>

            <!-- Table -->
            <div class="table-wrap">
              <a-table
                :data-source="taskList"
                row-key="task_id"
                :loading="taskLoading"
                :pagination="false"
                size="small"
                class="compact-table"
                :scroll="{ y: 'calc(100% - 32px)' }"
              >
                <a-table-column title="目标用户" key="target" :width="130">
                  <template #default="{ record }">
                    <div class="user-cell">
                      <span class="user-name">{{ record.target_nickname }}</span>
                      <span class="user-uid">{{ record.target_uid }}</span>
                    </div>
                  </template>
                </a-table-column>

                <a-table-column title="来源视频" key="source" :ellipsis="true">
                  <template #default="{ record }">
                    <a-tooltip :title="record.source_video_title">
                      <span class="text-line1 text-secondary">{{ truncate(record.source_video_title, 22) }}</span>
                    </a-tooltip>
                  </template>
                </a-table-column>

                <a-table-column title="触发评论" key="comment" :ellipsis="true">
                  <template #default="{ record }">
                    <a-tooltip :title="record.trigger_comment">
                      <span class="text-line1 text-secondary">{{ truncate(record.trigger_comment, 20) }}</span>
                    </a-tooltip>
                  </template>
                </a-table-column>

                <a-table-column title="执行账号" key="executor" :width="130">
                  <template #default="{ record }">
                    <span class="text-sm">#{{ record.executor_seq }} {{ record.executor_account_nickname }}</span>
                  </template>
                </a-table-column>

                <a-table-column title="状态" key="status" :width="80">
                  <template #default="{ record }">
                    <span
                      class="status-badge"
                      :style="{
                        background: taskStatusInfo(record.status).bg,
                        color: taskStatusInfo(record.status).color,
                      }"
                    >
                      {{ taskStatusInfo(record.status).text }}
                    </span>
                  </template>
                </a-table-column>

                <a-table-column title="发送时间" key="time" :width="110">
                  <template #default="{ record }">
                    <span class="text-xs text-secondary">{{ formatTime(record.sent_at || record.created_at) }}</span>
                  </template>
                </a-table-column>

                <a-table-column title="操作" key="actions" :width="80">
                  <template #default="{ record }">
                    <div class="action-btns">
                      <a-tooltip v-if="record.status === 'failed'" title="重试">
                        <a-button type="text" size="small" @click="handleRetryTask(record.task_id)">
                          <RefreshCw :size="12" color="#1677FF" />
                        </a-button>
                      </a-tooltip>
                      <a-tooltip title="删除">
                        <a-button type="text" size="small" @click="handleDeleteTask(record.task_id)">
                          <Trash2 :size="12" color="#FF4D4F" />
                        </a-button>
                      </a-tooltip>
                    </div>
                  </template>
                </a-table-column>
              </a-table>
            </div>

            <!-- Pagination -->
            <div class="pagination-row">
              <a-pagination
                v-model:current="taskPage"
                :total="taskTotal"
                :page-size="9"
                :show-size-changer="false"
                :show-total="(total: number) => `共 ${total} 条`"
                size="small"
                @change="onTaskPageChange"
              />
            </div>
          </div>
        </a-tab-pane>

        <!-- ══ Tab 3: 账号管理 ════════════════════════════════════════ -->
        <a-tab-pane key="accounts" tab="账号管理">
          <div class="tab-content">
            <!-- Toolbar -->
            <div class="toolbar">
              <span class="count-badge online">{{ onlineAccountCount }} 在线</span>

              <a-button
                size="small"
                type="primary"
                @click="addAccountVisible = true"
                style="background: #00B96B; border-color: #00B96B;"
              >
                <template #icon><Plus :size="12" /></template>
                添加账号
              </a-button>

              <div style="flex: 1" />

              <a-button size="small" @click="loadAccounts()">
                <template #icon><Download :size="12" /></template>
                导出
              </a-button>
            </div>

            <!-- Table -->
            <div class="table-wrap">
              <a-table
                :data-source="accounts"
                row-key="profile_id"
                :loading="accountLoading"
                :pagination="false"
                size="small"
                class="compact-table"
                :scroll="{ y: 'calc(100% - 32px)' }"
              >
                <a-table-column title="序号" key="seq" :width="48">
                  <template #default="{ index }">
                    <span class="seq-label">#{{ index + 1 + (accountPage - 1) * 6 }}</span>
                  </template>
                </a-table-column>

                <a-table-column title="账号信息" key="account" :width="160">
                  <template #default="{ record }">
                    <div class="user-cell">
                      <span class="user-name">{{ record.nickname || record.display_name }}</span>
                      <span class="user-uid">{{ record.douyin_uid }}</span>
                    </div>
                  </template>
                </a-table-column>

                <a-table-column title="浏览器ID" key="profile_id" :width="150">
                  <template #default="{ record }">
                    <span class="profile-id-cell">{{ record.profile_id }}</span>
                  </template>
                </a-table-column>

                <a-table-column title="Cookie状态" key="cookie" :width="100">
                  <template #default="{ record }">
                    <span
                      class="status-badge"
                      :style="{
                        background: cookieStatusTag(record.cookie_status).bg,
                        color: cookieStatusTag(record.cookie_status).color,
                      }"
                    >
                      {{ cookieStatusTag(record.cookie_status).text }}
                    </span>
                  </template>
                </a-table-column>

                <a-table-column title="今日已发/日上限" key="daily" :width="110">
                  <template #default="{ record }">
                    <span class="text-sm">
                      <span style="color: #00B96B; font-weight: 600;">{{ record.daily_dm_sent }}</span>
                      <span class="text-secondary"> / {{ record.daily_dm_limit }}</span>
                    </span>
                  </template>
                </a-table-column>

                <a-table-column title="启用" key="enabled" :width="60">
                  <template #default="{ record }">
                    <a-switch
                      :checked="record.enabled"
                      size="small"
                      @change="(v: boolean) => handleToggleAccount(record.profile_id, v)"
                    />
                  </template>
                </a-table-column>

                <a-table-column title="操作" key="actions">
                  <template #default="{ record }">
                    <div class="action-btns">
                      <a-button type="link" size="small" class="action-link" @click="handleLoginAccount(record.profile_id)">
                        登录
                      </a-button>
                      <span class="sep">|</span>
                      <a-button
                        type="link"
                        size="small"
                        class="action-link"
                        :loading="extractingAccount === record.profile_id"
                        @click="handleExtract(record.profile_id)"
                      >
                        提取
                      </a-button>
                      <span class="sep">|</span>
                      <a-button
                        type="link"
                        size="small"
                        class="action-link"
                        :loading="testingAccount === record.profile_id"
                        @click="handleTest(record.profile_id)"
                      >
                        测试
                      </a-button>
                      <span class="sep">|</span>
                      <a-button type="link" size="small" class="action-link">日志</a-button>
                      <span class="sep">|</span>
                      <a-button
                        type="link"
                        size="small"
                        style="color: #FF4D4F !important;"
                        @click="handleDeleteAccount(record.profile_id)"
                      >
                        删除
                      </a-button>
                    </div>
                  </template>
                </a-table-column>
              </a-table>
            </div>

            <!-- Pagination -->
            <div class="pagination-row">
              <a-pagination
                v-model:current="accountPage"
                :total="accountTotal"
                :page-size="6"
                :show-size-changer="false"
                :show-total="(total: number) => `共 ${total} 个账号`"
                size="small"
                @change="onAccountPageChange"
              />
            </div>
          </div>
        </a-tab-pane>

        <!-- ══ Tab 4: 频率控制 ════════════════════════════════════════ -->
        <a-tab-pane key="config" tab="频率控制">
          <div class="tab-content config-scroll">

            <!-- Section: 私信触发关键词 -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">私信触发关键词</span>
              </div>

              <div class="config-row">
                <a-checkbox v-model:checked="fullModeEnabled">
                  全量模式（未命中关键词也发送）
                </a-checkbox>
              </div>

              <div class="keyword-list" v-if="!keywordsLoading">
                <div
                  v-for="kw in dmKeywords"
                  :key="kw.id"
                  class="keyword-tag"
                  :class="{ 'kw-disabled': !kw.enabled }"
                >
                  <span class="kw-text">{{ kw.keyword }}</span>
                  <span
                    class="kw-type"
                    :style="{ background: matchTypeColor(kw.match_type) + '20', color: matchTypeColor(kw.match_type) }"
                  >
                    {{ matchTypeLabel(kw.match_type) }}
                  </span>
                  <span v-if="kw.category" class="kw-cat">{{ categoryLabel(kw.category) }}</span>
                  <span
                    class="kw-dot"
                    :style="{ background: kw.enabled ? '#00B96B' : '#D9D9D9' }"
                    @click="handleToggleKeyword(kw.id, !kw.enabled)"
                  />
                  <span class="kw-del" @click="handleDeleteKeyword(kw.id)">×</span>
                </div>

                <a-button
                  size="small"
                  type="dashed"
                  class="add-kw-btn"
                  @click="addKeywordVisible = true"
                >
                  <template #icon><Plus :size="11" /></template>
                  添加关键词
                </a-button>
              </div>

              <a-spin v-else size="small" />
            </div>

            <!-- Section: 发送频率设置 -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">发送频率设置</span>
              </div>

              <div class="config-row row-inline">
                <label>随机间隔</label>
                <div class="interval-control">
                  <span class="unit-text">最小间隔</span>
                  <a-input-number
                    v-model:value="config.min_interval_sec"
                    :min="10" :max="3600" :step="10"
                    size="small"
                    style="width: 80px"
                  />
                  <span class="unit-text">s ~ 最大间隔</span>
                  <a-input-number
                    v-model:value="config.max_interval_sec"
                    :min="10" :max="7200" :step="10"
                    size="small"
                    style="width: 80px"
                  />
                  <span class="unit-text">s</span>
                </div>
              </div>

              <div class="config-row row-inline">
                <label>单账号日上限</label>
                <div class="num-control">
                  <a-input-number
                    v-model:value="config.daily_limit_per_account"
                    :min="1" :max="500" :step="10"
                    size="small"
                    style="width: 90px"
                  />
                  <span class="unit-text">条</span>
                </div>
              </div>

              <div class="config-row row-inline">
                <label>总日上限</label>
                <div class="num-control">
                  <a-input-number
                    v-model:value="config.daily_limit_total"
                    :min="1" :max="9999" :step="50"
                    size="small"
                    style="width: 90px"
                  />
                  <span class="unit-text">条</span>
                </div>
              </div>

              <div class="config-row row-inline">
                <label>并发线程</label>
                <div class="num-control">
                  <a-input-number
                    v-model:value="config.concurrency"
                    :min="1" :max="10" :step="1"
                    size="small"
                    style="width: 90px"
                  />
                  <span class="unit-text">个</span>
                </div>
              </div>
            </div>

            <!-- Section: 私信模板 -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">私信模板</span>
              </div>

              <div class="config-row row-inline">
                <label>模板文件</label>
                <div class="path-row">
                  <a-input
                    v-model:value="config.template_path"
                    size="small"
                    placeholder="选择模板文件…"
                    style="flex: 1;"
                  />
                  <a-button size="small" class="icon-btn-sq">
                    <Folder :size="13" color="#595959" />
                  </a-button>
                  <a-button size="small" @click="handleReloadTemplate">重新加载</a-button>
                </div>
              </div>

              <div v-if="templateStatus" class="template-status">
                <FileText :size="12" color="#00B96B" />
                <span>{{ templateStatus }}</span>
                <a class="preview-link" @click="handlePreviewTemplate">预览内容</a>
              </div>
            </div>

            <!-- Section: 其他设置 -->
            <div class="config-section">
              <div class="section-header">
                <span class="section-title">其他设置</span>
              </div>

              <div class="config-row">
                <a-checkbox v-model:checked="config.auto_add_to_monitor">
                  采集完自动加入监控
                </a-checkbox>
              </div>
              <div class="config-row">
                <a-checkbox v-model:checked="config.new_video_only">
                  仅采集新视频
                </a-checkbox>
              </div>
            </div>

            <!-- Save button -->
            <div class="save-row">
              <a-button
                type="primary"
                :loading="configSaving"
                style="background: #00B96B; border-color: #00B96B; width: 120px;"
                @click="handleSaveConfig"
              >
                保存配置
              </a-button>
            </div>

          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- ── Export Modal ───────────────────────────────────────────────── -->
    <a-modal
      v-model:open="exportModalVisible"
      title="导出待审核列表"
      :footer="null"
      :width="320"
    >
      <div class="export-modal-body">
        <p style="color: #595959; font-size: 13px; margin-bottom: 16px;">选择导出格式：</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <a-button
            type="primary"
            :loading="exportLoading"
            style="background: #00B96B; border-color: #00B96B; width: 110px;"
            @click="handleExport('csv')"
          >
            导出 CSV
          </a-button>
          <a-button
            :loading="exportLoading"
            style="width: 110px;"
            @click="handleExport('txt')"
          >
            导出 TXT
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- ── Add Account Modal ──────────────────────────────────────────── -->
    <a-modal
      v-model:open="addAccountVisible"
      title="添加账号"
      :width="380"
      :confirm-loading="addAccountLoading"
      @ok="handleAddAccount"
    >
      <div style="padding: 12px 0;">
        <p style="font-size: 12px; color: #595959; margin-bottom: 8px;">
          输入比特浏览器的 Profile ID（在浏览器管理界面可找到）
        </p>
        <a-input
          v-model:value="addAccountId"
          placeholder="例: abc123def456"
          @press-enter="handleAddAccount"
        />
      </div>
    </a-modal>

    <!-- ── Add Keyword Modal ──────────────────────────────────────────── -->
    <a-modal
      v-model:open="addKeywordVisible"
      title="添加触发关键词"
      :width="400"
      :confirm-loading="addKeywordLoading"
      @ok="handleAddKeyword"
    >
      <div class="kw-modal-body">
        <div class="kw-form-row">
          <label>关键词</label>
          <a-input
            v-model:value="newKeyword.keyword"
            placeholder="输入关键词…"
            @press-enter="handleAddKeyword"
          />
        </div>

        <div class="kw-form-row">
          <label>匹配方式</label>
          <a-select v-model:value="newKeyword.match_type" style="width: 100%;">
            <a-select-option value="exact">精确包含</a-select-option>
            <a-select-option value="fuzzy">模糊匹配</a-select-option>
            <a-select-option value="semantic">语义匹配</a-select-option>
          </a-select>
        </div>

        <div v-if="newKeyword.match_type === 'semantic'" class="kw-form-row">
          <label>语义分类</label>
          <a-select v-model:value="newKeyword.category" style="width: 100%;" placeholder="选择分类…">
            <a-select-option value="purchase_intent">购买意向</a-select-option>
            <a-select-option value="price_inquiry">价格询问</a-select-option>
            <a-select-option value="contact_request">联系方式</a-select-option>
            <a-select-option value="channel_source">渠道来源</a-select-option>
          </a-select>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
/* ── Page Shell ──────────────────────────────────────────────────────────── */

.page-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #F5F5F5;
}

/* ── Title Bar ───────────────────────────────────────────────────────────── */

.title-bar {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #E8E8E8;
  flex-shrink: 0;
}

.title-bar-title {
  font-size: 15px;
  font-weight: 600;
  color: #1A1A1A;
}

.divider-v {
  width: 1px;
  height: 16px;
  background: #E8E8E8;
}

.stat-item {
  display: flex;
  align-items: center;
}

.gap-4 { gap: 4px; }
.gap-6 { gap: 6px; }

.engine-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-on  { background: #00B96B; box-shadow: 0 0 0 2px #00B96B33; }
.dot-off { background: #D9D9D9; }

.stat-chip {
  font-size: 12px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
}
.stat-chip.success { background: #F6FFED; color: #52C41A; }
.stat-chip.danger  { background: #FFF1F0; color: #FF4D4F; }

.pending-badge-label {
  font-size: 13px;
  color: #595959;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}
.pending-badge-label:hover { color: #1A1A1A; }
.pending-badge-label.active { color: #00B96B; font-weight: 500; }

/* ── Tabs Body ───────────────────────────────────────────────────────────── */

.tabs-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.main-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.ant-tabs-content-holder) {
  flex: 1;
  overflow: hidden;
}

:deep(.ant-tabs-content) {
  height: 100%;
}

:deep(.ant-tabs-tabpane) {
  height: 100%;
}

.tab-label {
  padding: 0 2px;
}

/* ── Tab Content ─────────────────────────────────────────────────────────── */

.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  gap: 8px;
  overflow: hidden;
}

.config-scroll {
  overflow-y: auto;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.select-count {
  font-size: 12px;
  color: #595959;
  min-width: 60px;
}

/* ── Table wrap ──────────────────────────────────────────────────────────── */

.table-wrap {
  flex: 1;
  overflow: hidden;
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  background: #fff;
}

.compact-table {
  height: 100%;
}

:deep(.ant-table-wrapper),
:deep(.ant-spin-nested-loading),
:deep(.ant-spin-container),
:deep(.ant-table),
:deep(.ant-table-container) {
  height: 100%;
}

:deep(.ant-table-body) {
  overflow-y: auto !important;
}

:deep(.ant-table-thead > tr > th) {
  background: #FAFAFA;
  font-size: 12px;
  font-weight: 600;
  color: #595959;
  padding: 8px 10px;
}

:deep(.ant-table-tbody > tr > td) {
  padding: 7px 10px;
  font-size: 12px;
  color: #1A1A1A;
}

:deep(.ant-table-tbody > tr:hover > td) {
  background: #F5F5F5;
}

/* ── Pagination ──────────────────────────────────────────────────────────── */

.pagination-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
}

/* ── User cell ───────────────────────────────────────────────────────────── */

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  font-size: 12px;
  font-weight: 500;
  color: #1A1A1A;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-uid {
  font-size: 11px;
  color: #8C8C8C;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Status badge ────────────────────────────────────────────────────────── */

.status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
}

/* ── Count badge ─────────────────────────────────────────────────────────── */

.count-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  background: #F0F0F0;
  color: #595959;
}
.count-badge.online { background: #F6FFED; color: #52C41A; }

/* ── Seq label ───────────────────────────────────────────────────────────── */

.seq-label {
  font-size: 12px;
  color: #8C8C8C;
  font-weight: 500;
}

/* ── Profile ID ──────────────────────────────────────────────────────────── */

.profile-id-cell {
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  color: #8C8C8C;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

/* ── Action buttons ──────────────────────────────────────────────────────── */

.action-btns {
  display: flex;
  align-items: center;
  gap: 0;
}

.action-link {
  font-size: 12px !important;
  padding: 0 4px !important;
  height: auto !important;
  color: #1677FF !important;
}

.action-link:hover { color: #4096ff !important; }

.sep {
  color: #D9D9D9;
  font-size: 12px;
  user-select: none;
  line-height: 1;
}

/* ── Text helpers ────────────────────────────────────────────────────────── */

.text-xs       { font-size: 11px; }
.text-sm       { font-size: 12px; }
.text-secondary { color: #595959; }
.text-line1 {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Config tab ──────────────────────────────────────────────────────────── */

.config-section {
  background: #fff;
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
}

.section-header {
  padding-bottom: 8px;
  border-bottom: 1px solid #F0F0F0;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #595959;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.config-row.row-inline {
  justify-content: space-between;
}

.config-row label {
  font-size: 13px;
  color: #1A1A1A;
  min-width: 90px;
}

.interval-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.num-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unit-text {
  font-size: 12px;
  color: #595959;
  white-space: nowrap;
}

.path-row {
  display: flex;
  gap: 6px;
  flex: 1;
  align-items: center;
}

.icon-btn-sq {
  width: 28px !important;
  height: 24px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.template-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #595959;
}

.preview-link {
  color: #1677FF;
  cursor: pointer;
  margin-left: 4px;
}
.preview-link:hover { text-decoration: underline; }

/* ── Keywords ────────────────────────────────────────────────────────────── */

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.keyword-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  background: #F5F5F5;
  border: 1px solid #E8E8E8;
  font-size: 12px;
  color: #1A1A1A;
  transition: opacity 0.15s;
}

.keyword-tag.kw-disabled {
  opacity: 0.45;
}

.kw-text {
  font-weight: 500;
}

.kw-type {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 6px;
}

.kw-cat {
  font-size: 10px;
  color: #8C8C8C;
  background: #F0F0F0;
  padding: 0 4px;
  border-radius: 6px;
}

.kw-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.kw-del {
  font-size: 13px;
  color: #BFBFBF;
  cursor: pointer;
  line-height: 1;
  margin-left: 1px;
}
.kw-del:hover { color: #FF4D4F; }

.add-kw-btn {
  border-style: dashed !important;
  font-size: 12px !important;
  height: 26px !important;
}

/* ── Save row ────────────────────────────────────────────────────────────── */

.save-row {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 12px;
}

/* ── Modals ──────────────────────────────────────────────────────────────── */

.export-modal-body {
  padding: 8px 0 4px;
  text-align: center;
}

.kw-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0;
}

.kw-form-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.kw-form-row label {
  font-size: 12px;
  color: #595959;
}
</style>
