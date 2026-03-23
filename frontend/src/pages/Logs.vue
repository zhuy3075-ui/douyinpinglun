<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { LogEntry, DMSendLog, BrowserProfile, PagedResult } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { message } from 'ant-design-vue'
import { Download, Trash2 } from 'lucide-vue-next'

// ── Tab state ───────────────────────────────────────────────────────────────
const activeTab = ref<'system' | 'dm'>('system')

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toTimeString().slice(0, 8)
  } catch {
    return iso
  }
}

function fmtDatetime(iso: string): string {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = d.toTimeString().slice(0, 8)
    return `${mm}-${dd} ${hh}`
  } catch {
    return iso
  }
}

// ── Level styles ─────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, string> = {
  INFO:  '#1677FF',
  WARN:  '#FA8C16',
  ERROR: '#FF4D4F',
  DEBUG: '#8C8C8C',
}
const LEVEL_BG: Record<string, string> = {
  INFO:  '#E6F7FF',
  WARN:  '#FFF7E6',
  ERROR: '#FFF1F0',
  DEBUG: '#F5F5F5',
}

// ── DM status styles ─────────────────────────────────────────────────────────
const DM_STATUS_LABEL: Record<string, string> = {
  sent:         '成功',
  failed:       '失败',
  rate_limited: '限流',
}
const DM_STATUS_COLOR: Record<string, string> = {
  sent:         '#52C41A',
  failed:       '#FF4D4F',
  rate_limited: '#FA8C16',
}
const DM_STATUS_BG: Record<string, string> = {
  sent:         '#F6FFED',
  failed:       '#FFF1F0',
  rate_limited: '#FFF7E6',
}

// ════════════════════════════════════════════════════════════════════════════
//  Tab 1 — 系统日志
// ════════════════════════════════════════════════════════════════════════════
const sysLogs       = ref<LogEntry[]>([])
const sysTotal      = ref(0)
const sysPage       = ref(1)
const sysPageSize   = 11
const sysLoading    = ref(false)
const sysLevel      = ref('')
const sysKeyword    = ref('')
const sysExporting  = ref(false)

const sysLevelOptions = [
  { value: '',      label: '全部' },
  { value: 'INFO',  label: 'INFO' },
  { value: 'WARN',  label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'DEBUG', label: 'DEBUG' },
]

async function fetchSysLogs() {
  sysLoading.value = true
  try {
    const res: PagedResult<LogEntry> = await App.GetLogs(
      sysLevel.value,
      sysKeyword.value,
      sysPage.value,
      sysPageSize,
    )
    sysLogs.value  = res.items
    sysTotal.value = res.total
  } catch {
    message.error('加载系统日志失败')
  } finally {
    sysLoading.value = false
  }
}

function onSysLevelChange() {
  sysPage.value = 1
  fetchSysLogs()
}

function onSysKeywordChange() {
  sysPage.value = 1
  fetchSysLogs()
}

function onSysPageChange(page: number) {
  sysPage.value = page
  fetchSysLogs()
}

async function handleClearLogs() {
  try {
    await App.ClearLogs()
    sysLogs.value  = []
    sysTotal.value = 0
    message.success('日志已清空')
  } catch {
    message.error('清空失败')
  }
}

async function handleExportSysLogs() {
  sysExporting.value = true
  try {
    await App.ExportLogs('csv')
    message.success('系统日志已导出')
  } catch {
    message.error('导出失败')
  } finally {
    sysExporting.value = false
  }
}

const sysColumns = [
  { title: '时间',     key: 'time',    width: 90 },
  { title: '级别',     key: 'level',   width: 70 },
  { title: '日志内容', key: 'message' },
]

// ════════════════════════════════════════════════════════════════════════════
//  Tab 2 — 私信日志
// ════════════════════════════════════════════════════════════════════════════
const dmLogs          = ref<DMSendLog[]>([])
const dmTotal         = ref(0)
const dmPage          = ref(1)
const dmPageSize      = 11
const dmLoading       = ref(false)
const dmProfileFilter = ref('')
const dmStatusFilter  = ref('')
const dmExporting     = ref(false)
const accountOptions  = ref<{ value: string; label: string }[]>([])

const dmStatusOptions = [
  { value: '',             label: '全部' },
  { value: 'sent',         label: '成功' },
  { value: 'failed',       label: '失败' },
  { value: 'rate_limited', label: '限流' },
]

async function fetchAccounts() {
  try {
    const res: PagedResult<BrowserProfile> = await App.GetAccounts(1, 100)
    accountOptions.value = [
      { value: '', label: '全部' },
      ...res.items.map(p => ({
        value: p.profile_id,
        label: `#${p.seq} ${p.nickname}`,
      })),
    ]
  } catch {
    // silently ignore; filter just won't be populated
  }
}

async function fetchDMLogs() {
  dmLoading.value = true
  try {
    const res: PagedResult<DMSendLog> = await App.GetDMSendLogs(
      dmProfileFilter.value,
      dmStatusFilter.value,
      dmPage.value,
      dmPageSize,
    )
    dmLogs.value  = res.items
    dmTotal.value = res.total
  } catch {
    message.error('加载私信日志失败')
  } finally {
    dmLoading.value = false
  }
}

function onDMFilterChange() {
  dmPage.value = 1
  fetchDMLogs()
}

function onDMPageChange(page: number) {
  dmPage.value = page
  fetchDMLogs()
}

async function handleExportDMLogs() {
  dmExporting.value = true
  try {
    await App.ExportDMSendLogs('csv')
    message.success('私信日志已导出')
  } catch {
    message.error('导出失败')
  } finally {
    dmExporting.value = false
  }
}

const dmColumns = [
  { title: '发送时间', key: 'sent_at',        width: 112 },
  { title: '窗口',     key: 'window_seq',      width: 58  },
  { title: '发送账号', key: 'sender_nickname', width: 90  },
  { title: '目标用户', key: 'target',          width: 120 },
  { title: '来源视频', key: 'source_video',    width: 130 },
  { title: '触发评论', key: 'comment_content', width: 120 },
  { title: '触发词',   key: 'trigger_keyword', width: 80  },
  { title: '私信内容', key: 'message_content', width: 150 },
  { title: '状态',     key: 'status',          width: 64  },
]

// ── Tab switch ───────────────────────────────────────────────────────────────
function onTabChange(key: string) {
  activeTab.value = key as 'system' | 'dm'
  if (key === 'dm') {
    fetchDMLogs()
  }
}

// ── Event listeners ──────────────────────────────────────────────────────────
function handleNewSysLog(entry: LogEntry) {
  if (activeTab.value === 'system' && sysPage.value === 1) {
    sysLogs.value.unshift(entry)
    if (sysLogs.value.length > sysPageSize) {
      sysLogs.value = sysLogs.value.slice(0, sysPageSize)
    }
    sysTotal.value += 1
  }
}

function handleNewDMLog(entry: DMSendLog) {
  if (activeTab.value === 'dm' && dmPage.value === 1) {
    dmLogs.value.unshift(entry)
    if (dmLogs.value.length > dmPageSize) {
      dmLogs.value = dmLogs.value.slice(0, dmPageSize)
    }
    dmTotal.value += 1
  }
}

onMounted(async () => {
  await Promise.all([fetchSysLogs(), fetchAccounts()])
  EventsOn('log:new-entry', handleNewSysLog)
  EventsOn('dm:send-log',   handleNewDMLog)
})

onUnmounted(() => {
  EventsOff('log:new-entry', handleNewSysLog)
  EventsOff('dm:send-log',   handleNewDMLog)
})
</script>

<template>
  <div class="page-layout">
    <!-- Title bar -->
    <div class="title-bar">
      <span class="title-bar-title">日志记录</span>
    </div>

    <!-- Tabs -->
    <div class="tabs-wrap">
      <a-tabs
        :active-key="activeTab"
        size="small"
        class="logs-tabs"
        @change="onTabChange"
      >

        <!-- ══════════════ Tab 1: 系统日志 ══════════════ -->
        <a-tab-pane key="system" tab="系统日志">
          <!-- Header toolbar -->
          <div class="tab-toolbar">
            <div class="toolbar-left">
              <a-select
                v-model:value="sysLevel"
                size="small"
                style="width: 100px"
                :options="sysLevelOptions"
                @change="onSysLevelChange"
              />
              <a-input
                v-model:value="sysKeyword"
                size="small"
                placeholder="关键词搜索…"
                allow-clear
                style="width: 200px"
                @change="onSysKeywordChange"
              />
            </div>
            <div class="toolbar-right">
              <a-popconfirm
                title="确认清空所有系统日志？"
                ok-text="清空"
                ok-type="danger"
                cancel-text="取消"
                @confirm="handleClearLogs"
              >
                <a-button size="small" danger>
                  <template #icon><Trash2 :size="13" /></template>
                  清空日志
                </a-button>
              </a-popconfirm>
              <a-button size="small" :loading="sysExporting" @click="handleExportSysLogs">
                <template #icon><Download :size="13" /></template>
                导出
              </a-button>
            </div>
          </div>

          <!-- Table -->
          <div class="table-wrap">
            <a-table
              :data-source="sysLogs"
              :columns="sysColumns"
              row-key="id"
              size="small"
              :loading="sysLoading"
              :pagination="false"
              :scroll="{ y: 490 }"
              class="inner-table"
            >
              <template #bodyCell="{ column, record }">

                <template v-if="column.key === 'time'">
                  <span class="mono text-secondary">{{ fmtTime(record.created_at) }}</span>
                </template>

                <template v-else-if="column.key === 'level'">
                  <span
                    class="level-badge"
                    :style="{
                      color:      LEVEL_COLOR[record.level] ?? '#8C8C8C',
                      background: LEVEL_BG[record.level]   ?? '#F5F5F5',
                    }"
                  >{{ record.level }}</span>
                </template>

                <template v-else-if="column.key === 'message'">
                  <a-tooltip :title="record.message" placement="topLeft">
                    <span
                      class="mono msg-text"
                      :style="{ color: LEVEL_COLOR[record.level] ?? 'var(--color-text-primary)' }"
                    >{{ record.message }}</span>
                  </a-tooltip>
                </template>

              </template>

              <template #emptyText>
                <div class="empty-tip">暂无系统日志</div>
              </template>
            </a-table>
          </div>

          <!-- Pagination -->
          <div class="pagination-bar">
            <a-pagination
              :current="sysPage"
              :total="sysTotal"
              :page-size="sysPageSize"
              :show-size-changer="false"
              size="small"
              :show-total="(total: number) => `共 ${total} 条日志`"
              @change="onSysPageChange"
            />
          </div>
        </a-tab-pane>

        <!-- ══════════════ Tab 2: 私信日志 ══════════════ -->
        <a-tab-pane key="dm" tab="私信日志">
          <!-- Header toolbar -->
          <div class="tab-toolbar">
            <div class="toolbar-left">
              <a-select
                v-model:value="dmProfileFilter"
                size="small"
                style="width: 150px"
                :options="accountOptions"
                placeholder="窗口筛选"
                @change="onDMFilterChange"
              />
              <a-select
                v-model:value="dmStatusFilter"
                size="small"
                style="width: 100px"
                :options="dmStatusOptions"
                @change="onDMFilterChange"
              />
            </div>
            <div class="toolbar-right">
              <a-button size="small" :loading="dmExporting" @click="handleExportDMLogs">
                <template #icon><Download :size="13" /></template>
                导出
              </a-button>
            </div>
          </div>

          <!-- Table -->
          <div class="table-wrap">
            <a-table
              :data-source="dmLogs"
              :columns="dmColumns"
              row-key="id"
              size="small"
              :loading="dmLoading"
              :pagination="false"
              :scroll="{ y: 490 }"
              class="inner-table"
            >
              <template #bodyCell="{ column, record }">

                <template v-if="column.key === 'sent_at'">
                  <span class="mono text-secondary">{{ fmtDatetime(record.sent_at) }}</span>
                </template>

                <template v-else-if="column.key === 'window_seq'">
                  <span class="window-badge">#{{ record.window_seq }}</span>
                </template>

                <template v-else-if="column.key === 'sender_nickname'">
                  <span class="cell-text">{{ record.sender_nickname }}</span>
                </template>

                <template v-else-if="column.key === 'target'">
                  <div class="target-cell">
                    <span class="cell-text">{{ record.target_nickname }}</span>
                    <span class="uid-text">{{ record.target_uid }}</span>
                  </div>
                </template>

                <template v-else-if="column.key === 'source_video'">
                  <a-tooltip :title="record.source_video_title" placement="topLeft">
                    <span class="truncate-cell">{{ record.source_video_title }}</span>
                  </a-tooltip>
                </template>

                <template v-else-if="column.key === 'comment_content'">
                  <a-tooltip :title="record.comment_content" placement="topLeft">
                    <span class="truncate-cell">{{ record.comment_content }}</span>
                  </a-tooltip>
                </template>

                <template v-else-if="column.key === 'trigger_keyword'">
                  <a-tag color="blue" style="font-size: 11px; margin: 0; padding: 0 5px;">
                    {{ record.trigger_keyword }}
                  </a-tag>
                </template>

                <template v-else-if="column.key === 'message_content'">
                  <a-tooltip :title="record.message_content" placement="topLeft">
                    <span class="truncate-cell">{{ record.message_content }}</span>
                  </a-tooltip>
                </template>

                <template v-else-if="column.key === 'status'">
                  <span
                    class="status-badge"
                    :style="{
                      color:      DM_STATUS_COLOR[record.status] ?? '#8C8C8C',
                      background: DM_STATUS_BG[record.status]    ?? '#F5F5F5',
                    }"
                  >
                    <span class="status-dot"
                      :style="{ background: DM_STATUS_COLOR[record.status] ?? '#8C8C8C' }"
                    />
                    {{ DM_STATUS_LABEL[record.status] ?? record.status }}
                  </span>
                </template>

              </template>

              <template #emptyText>
                <div class="empty-tip">暂无私信日志</div>
              </template>
            </a-table>
          </div>

          <!-- Pagination -->
          <div class="pagination-bar">
            <a-pagination
              :current="dmPage"
              :total="dmTotal"
              :page-size="dmPageSize"
              :show-size-changer="false"
              size="small"
              :show-total="(total: number) => `共 ${total} 条私信日志`"
              @change="onDMPageChange"
            />
          </div>
        </a-tab-pane>

      </a-tabs>
    </div>
  </div>
</template>

<style scoped>
/* ── Tabs wrapper ─────────────────────────────────────────────────────────── */
.tabs-wrap {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 0 12px 0;
}

:deep(.logs-tabs) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

:deep(.logs-tabs .ant-tabs-nav) {
  margin-bottom: 0;
}

:deep(.logs-tabs .ant-tabs-content-holder) {
  flex: 1;
  overflow: hidden;
}

:deep(.logs-tabs .ant-tabs-content),
:deep(.logs-tabs .ant-tabs-tabpane) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* ── Toolbar ──────────────────────────────────────────────────────────────── */
.tab-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 8px;
  gap: 8px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Table wrap ───────────────────────────────────────────────────────────── */
.table-wrap {
  flex: 1;
  overflow: hidden;
}

:deep(.inner-table .ant-table-body) {
  overflow-y: auto !important;
}

/* ── Pagination bar ───────────────────────────────────────────────────────── */
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 4px;
  flex-shrink: 0;
}

/* ── Cell styles ──────────────────────────────────────────────────────────── */
.mono {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
}

.level-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Courier New', Courier, monospace;
  min-width: 46px;
  text-align: center;
}

.msg-text {
  font-size: 12px;
  word-break: break-all;
  white-space: normal;
}

/* DM table */
.window-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  background: #E6F4FF;
  color: #1677FF;
}

.target-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.3;
}

.cell-text {
  font-size: 12px;
  color: var(--color-text-primary);
}

.uid-text {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-family: 'Courier New', Courier, monospace;
}

.truncate-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: default;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Empty state */
.empty-tip {
  padding: 48px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: center;
}
</style>
