<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { KeywordConfig, CollectHistory } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { message } from 'ant-design-vue'
import { Edit3, Trash2, Plus, Download } from 'lucide-vue-next'

const router = useRouter()

// ─── Status bar ────────────────────────────────────────────────────────────
const engineRunning = ref(false)
const nextCollectSec = ref(0)
const currentRoundVideos = ref(0)
const totalMonitored = ref(0)
const collectingNow = ref(false)
let countdownTimer: ReturnType<typeof setInterval> | null = null

// ─── Keywords ──────────────────────────────────────────────────────────────
const keywords = ref<KeywordConfig[]>([])
const kwLoading = ref(false)

// ─── Collect history ───────────────────────────────────────────────────────
interface PagedHistoryResult {
  list: CollectHistory[]
  total: number
}
const historyList = ref<CollectHistory[]>([])
const historyTotal = ref(0)
const historyPage = ref(1)
const historyPageSize = 8
const historyLoading = ref(false)

// ─── Config ────────────────────────────────────────────────────────────────
const minLikes = ref(0)
const maxLikes = ref(0)
const minComments = ref(0)
const maxComments = ref(0)
const intervalMin = ref(60)
const concurrency = ref(3)
const autoAddMonitor = ref(true)
const newVideoOnly = ref(false)
const savingConfig = ref(false)

// ─── Add/Edit keyword modal ────────────────────────────────────────────────
const modalVisible = ref(false)
const editingKeyword = ref<KeywordConfig | null>(null)
const modalKeyword = ref('')
const modalPriority = ref(3)
const modalTimeRange = ref('一周内')
const modalCountPerRun = ref(10)
const modalSubmitting = ref(false)

const timeRangeOptions = [
  { label: '不限', value: '不限' },
  { label: '一天内', value: '一天内' },
  { label: '一周内', value: '一周内' },
  { label: '半年内', value: '半年内' },
]

// ─── Export modal ──────────────────────────────────────────────────────────
const exportVisible = ref(false)
const exportFormat = ref<'csv' | 'txt'>('csv')
const exporting = ref(false)

// ─── Table column definitions ──────────────────────────────────────────────
const kwColumns = [
  { title: '启用', key: 'enabled', dataIndex: 'enabled', width: 52 },
  { title: '关键词', key: 'keyword', dataIndex: 'keyword', width: 90, ellipsis: true },
  { title: '优先级', key: 'priority', dataIndex: 'priority', width: 80 },
  { title: '采集配置', key: 'config', width: 110 },
  { title: '统计', key: 'stats', width: 90 },
  { title: '最后采集', key: 'last_run', width: 90 },
  { title: '操作', key: 'actions', width: 60 },
]

const histColumns = [
  { title: '关键词', key: 'keyword', dataIndex: 'keyword', width: 80 },
  { title: '采集时间', key: 'started_at', dataIndex: 'started_at', width: 120 },
  { title: '采集数量', key: 'collected', dataIndex: 'collected', width: 72 },
  { title: '过滤', key: 'filtered', width: 58 },
  { title: '已添加', key: 'added', dataIndex: 'added', width: 66 },
  { title: '耗时', key: 'duration', width: 60 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 66 },
]

// ─── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  setupEvents()
  await Promise.all([
    fetchKeywords(),
    fetchHistory(1),
    fetchStatus(),
  ])
  startCountdown()
})

onUnmounted(() => {
  EventsOff('collect:progress')
  EventsOff('collect:status-change')
  if (countdownTimer) clearInterval(countdownTimer)
})

function startCountdown() {
  countdownTimer = setInterval(() => {
    if (engineRunning.value && nextCollectSec.value > 0) {
      nextCollectSec.value--
    }
  }, 1000)
}

function setupEvents() {
  EventsOn('collect:status-change', (data: any) => {
    engineRunning.value = !!data?.running
    if (typeof data?.next_collect_in_sec === 'number') nextCollectSec.value = data.next_collect_in_sec
    if (typeof data?.current_round_videos === 'number') currentRoundVideos.value = data.current_round_videos
    if (typeof data?.total_monitored === 'number') totalMonitored.value = data.total_monitored
  })
  EventsOn('collect:progress', (data: any) => {
    if (typeof data?.collected === 'number') currentRoundVideos.value = data.collected
    if (typeof data?.total_monitored === 'number') totalMonitored.value = data.total_monitored
  })
}

// ─── Data fetchers ─────────────────────────────────────────────────────────
async function fetchStatus() {
  try {
    const status = await App.GetAutoCollectStatus()
    engineRunning.value = !!status?.running
    if (typeof status?.next_collect_in_sec === 'number') nextCollectSec.value = status.next_collect_in_sec
    if (typeof status?.current_round_videos === 'number') currentRoundVideos.value = status.current_round_videos
    if (typeof status?.total_monitored === 'number') totalMonitored.value = status.total_monitored
  } catch {
    // status fetch is non-critical; ignore
  }
}

async function fetchKeywords() {
  kwLoading.value = true
  try {
    const result = await App.GetKeywords()
    keywords.value = result ?? []
  } catch {
    message.error('加载关键词失败')
  } finally {
    kwLoading.value = false
  }
}

async function fetchHistory(page: number) {
  historyLoading.value = true
  try {
    const result: PagedHistoryResult = await App.GetCollectHistory(page, historyPageSize)
    historyList.value = result?.list ?? []
    historyTotal.value = result?.total ?? 0
    historyPage.value = page
  } catch {
    message.error('加载采集历史失败')
  } finally {
    historyLoading.value = false
  }
}

// ─── Status bar actions ────────────────────────────────────────────────────
async function toggleEngine() {
  try {
    if (engineRunning.value) {
      await App.StopAutoCollect()
      engineRunning.value = false
      message.success('自动采集已停止')
    } else {
      await App.StartAutoCollect()
      engineRunning.value = true
      message.success('自动采集已启动')
    }
  } catch {
    message.error(engineRunning.value ? '停止失败' : '启动失败')
  }
}

async function collectNow() {
  collectingNow.value = true
  try {
    await App.StartAutoCollect()
    message.success('立即采集已触发')
  } catch {
    message.error('触发失败')
  } finally {
    collectingNow.value = false
  }
}

// ─── Keyword actions ───────────────────────────────────────────────────────
async function toggleKeywordEnabled(kw: KeywordConfig) {
  try {
    await App.UpdateKeyword({ ...kw, enabled: !kw.enabled })
    kw.enabled = !kw.enabled
  } catch {
    message.error('更新失败')
  }
}

function openAddModal() {
  editingKeyword.value = null
  modalKeyword.value = ''
  modalPriority.value = 3
  modalTimeRange.value = '一周内'
  modalCountPerRun.value = 10
  modalVisible.value = true
}

function openEditModal(kw: KeywordConfig) {
  editingKeyword.value = kw
  modalKeyword.value = kw.keyword
  modalPriority.value = kw.priority ?? 3
  modalTimeRange.value = kw.search_time_range ?? '一周内'
  modalCountPerRun.value = kw.count_per_run ?? 10
  modalVisible.value = true
}

async function submitKeywordModal() {
  if (!modalKeyword.value.trim()) {
    message.warning('请输入关键词')
    return
  }
  modalSubmitting.value = true
  try {
    if (editingKeyword.value) {
      await App.UpdateKeyword({
        ...editingKeyword.value,
        keyword: modalKeyword.value.trim(),
        priority: modalPriority.value,
        search_time_range: modalTimeRange.value,
        count_per_run: modalCountPerRun.value,
      })
      message.success('关键词已更新')
    } else {
      await App.AddKeyword({
        id: '',
        keyword: modalKeyword.value.trim(),
        priority: modalPriority.value,
        search_time_range: modalTimeRange.value,
        count_per_run: modalCountPerRun.value,
        enabled: true,
        stats: { total_collected: 0, total_monitored: 0 },
        last_run_at: '',
        created_at: new Date().toISOString(),
      })
      message.success('关键词已添加')
    }
    modalVisible.value = false
    await fetchKeywords()
  } catch {
    message.error(editingKeyword.value ? '更新失败' : '添加失败')
  } finally {
    modalSubmitting.value = false
  }
}

async function deleteKeyword(id: string) {
  try {
    await App.DeleteKeyword(id)
    keywords.value = keywords.value.filter(k => k.id !== id)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

// ─── History actions ───────────────────────────────────────────────────────
async function clearHistory() {
  try {
    await App.ClearLogs()
    historyList.value = []
    historyTotal.value = 0
    historyPage.value = 1
    message.success('历史已清空')
  } catch {
    message.error('清空失败')
  }
}

function openExportModal() {
  exportFormat.value = 'csv'
  exportVisible.value = true
}

async function doExport() {
  exporting.value = true
  try {
    await App.ExportCollectHistory(exportFormat.value)
    message.success('导出成功')
    exportVisible.value = false
  } catch {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// ─── Config ────────────────────────────────────────────────────────────────
async function saveConfig() {
  savingConfig.value = true
  try {
    await App.SaveAutoCollectConfig({
      interval_sec: intervalMin.value * 60,
      concurrency: concurrency.value,
      auto_add_to_monitor: autoAddMonitor.value,
      new_video_only: newVideoOnly.value,
      min_likes: minLikes.value,
      max_likes: maxLikes.value,
      min_comments: minComments.value,
      max_comments: maxComments.value,
    })
    message.success('配置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    savingConfig.value = false
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function renderStars(n: number) {
  const count = Math.max(1, Math.min(5, n))
  return '★'.repeat(count) + '☆'.repeat(5 - count)
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  return iso.replace('T', ' ').slice(0, 16)
}

function formatDuration(sec: number): string {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m${sec % 60}s`
}

const priorityStarOptions = [1, 2, 3, 4, 5]

const histPagination = computed(() => ({
  current: historyPage.value,
  pageSize: historyPageSize,
  total: historyTotal.value,
  showSizeChanger: false,
  showTotal: (total: number) => `共 ${total} 条历史`,
  onChange: (page: number) => fetchHistory(page),
}))
</script>

<template>
  <div class="page-wrap">

    <!-- ── Status bar ───────────────────────────────────────────────────── -->
    <div class="status-bar">
      <!-- Left: status indicator -->
      <div class="status-left">
        <span :class="['status-dot', engineRunning ? 'dot-green' : 'dot-grey']" />
        <span :class="['status-label', engineRunning ? 'label-green' : 'label-grey']">
          {{ engineRunning ? '采集中' : '就绪' }}
        </span>
      </div>

      <!-- Center: stats -->
      <div class="status-center">
        <div class="stat-item">
          <span class="stat-label">下次采集</span>
          <span class="stat-val" :class="engineRunning ? 'val-red' : 'val-muted'">
            {{ nextCollectSec }}秒
          </span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-label">本轮采集</span>
          <span class="stat-val">{{ currentRoundVideos }}个</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-label">已加入监控</span>
          <span class="stat-val val-primary">{{ totalMonitored }}个</span>
        </div>
      </div>

      <!-- Right: action buttons -->
      <div class="status-right">
        <a-button size="small" :loading="collectingNow" @click="collectNow">
          立即采集
        </a-button>
        <a-button
          size="small"
          :type="engineRunning ? 'default' : 'primary'"
          :danger="engineRunning"
          @click="toggleEngine"
        >
          {{ engineRunning ? '停止' : '启动' }}
        </a-button>
      </div>
    </div>

    <!-- ── Middle row: keyword list + history ───────────────────────────── -->
    <div class="middle-row">

      <!-- Left: keyword management (420px) -->
      <div class="panel kw-panel">
        <div class="panel-header">
          <span class="panel-title">关键词管理</span>
          <a-button type="primary" size="small" @click="openAddModal">
            <template #icon><Plus :size="12" /></template>
            添加关键词
          </a-button>
        </div>

        <div class="table-wrap">
          <a-table
            :data-source="keywords"
            :columns="kwColumns"
            row-key="id"
            :pagination="false"
            size="small"
            :loading="kwLoading"
            :scroll="{ y: 240 }"
          >
            <template #bodyCell="{ column, record }">
              <!-- 启用 toggle -->
              <template v-if="column.key === 'enabled'">
                <a-switch
                  :checked="record.enabled"
                  size="small"
                  @change="() => toggleKeywordEnabled(record)"
                />
              </template>

              <!-- 关键词 -->
              <template v-else-if="column.key === 'keyword'">
                <span
                  class="kw-name"
                  :style="{ color: record.enabled ? '#1A1A1A' : '#BFBFBF' }"
                >{{ record.keyword }}</span>
              </template>

              <!-- 优先级 stars -->
              <template v-else-if="column.key === 'priority'">
                <span
                  class="stars"
                  :style="{ color: record.enabled ? '#FA8C16' : '#D9D9D9' }"
                >{{ renderStars(record.priority) }}</span>
              </template>

              <!-- 采集配置 brief -->
              <template v-else-if="column.key === 'config'">
                <span class="cell-secondary">
                  {{ record.search_time_range ?? '不限' }} · {{ record.count_per_run ?? 10 }}条
                </span>
              </template>

              <!-- 统计 -->
              <template v-else-if="column.key === 'stats'">
                <span class="cell-secondary">
                  采集 {{ record.stats?.total_collected ?? 0 }} /
                  <a class="link-blue">监控 {{ record.stats?.total_monitored ?? 0 }}</a>
                </span>
              </template>

              <!-- 最后采集 relative -->
              <template v-else-if="column.key === 'last_run'">
                <span class="cell-secondary">{{ formatRelativeTime(record.last_run_at) }}</span>
              </template>

              <!-- 操作 -->
              <template v-else-if="column.key === 'actions'">
                <div class="action-btns">
                  <a-tooltip title="编辑">
                    <a-button
                      type="text"
                      size="small"
                      class="icon-btn"
                      @click="openEditModal(record)"
                    >
                      <Edit3 :size="13" color="#595959" />
                    </a-button>
                  </a-tooltip>
                  <a-popconfirm
                    title="确认删除该关键词？"
                    ok-text="删除"
                    cancel-text="取消"
                    ok-type="danger"
                    @confirm="deleteKeyword(record.id)"
                  >
                    <a-tooltip title="删除">
                      <a-button type="text" size="small" class="icon-btn">
                        <Trash2 :size="13" color="#FF4D4F" />
                      </a-button>
                    </a-tooltip>
                  </a-popconfirm>
                </div>
              </template>
            </template>
          </a-table>
        </div>
      </div>

      <!-- Right: collect history (580px) -->
      <div class="panel hist-panel">
        <div class="panel-header">
          <span class="panel-title">采集历史</span>
          <div class="header-actions">
            <a-popconfirm
              title="确认清空全部历史记录？"
              ok-text="清空"
              cancel-text="取消"
              ok-type="danger"
              @confirm="clearHistory"
            >
              <a class="danger-link">清空历史</a>
            </a-popconfirm>
            <a-button size="small" @click="openExportModal">
              <template #icon><Download :size="12" /></template>
              导出
            </a-button>
          </div>
        </div>

        <div class="table-wrap">
          <a-table
            :data-source="historyList"
            :columns="histColumns"
            row-key="id"
            :pagination="histPagination"
            size="small"
            :loading="historyLoading"
            :scroll="{ y: 210 }"
          >
            <template #bodyCell="{ column, record }">
              <!-- 关键词 tag -->
              <template v-if="column.key === 'keyword'">
                <span class="kw-tag">{{ record.keyword }}</span>
              </template>

              <!-- 采集时间 -->
              <template v-else-if="column.key === 'started_at'">
                <span class="cell-secondary">{{ formatDateTime(record.started_at) }}</span>
              </template>

              <!-- 采集数量 -->
              <template v-else-if="column.key === 'collected'">
                <span class="num-val">{{ record.collected }}</span>
              </template>

              <!-- 过滤 -->
              <template v-else-if="column.key === 'filtered'">
                <span class="cell-secondary">
                  {{ record.filtered_out != null ? `-${record.filtered_out}` : '—' }}
                </span>
              </template>

              <!-- 已添加 -->
              <template v-else-if="column.key === 'added'">
                <a class="link-blue num-val">{{ record.added ?? 0 }}</a>
              </template>

              <!-- 耗时 -->
              <template v-else-if="column.key === 'duration'">
                <span class="cell-secondary">{{ formatDuration(record.duration_sec) }}</span>
              </template>

              <!-- 状态 badge -->
              <template v-else-if="column.key === 'status'">
                <span
                  :class="['status-badge', record.status === 'success' ? 'badge-success' : 'badge-fail']"
                >{{ record.status === 'success' ? '成功' : '失败' }}</span>
              </template>
            </template>
          </a-table>
        </div>
      </div>
    </div>

    <!-- ── Bottom: configuration panel ─────────────────────────────────── -->
    <div class="panel bottom-panel">
      <div class="bottom-sections">

        <!-- 过滤条件 -->
        <div class="config-section">
          <div class="section-title">过滤条件</div>
          <div class="config-field">
            <label class="field-label">点赞数范围</label>
            <div class="range-row">
              <a-input-number
                v-model:value="minLikes"
                :min="0"
                size="small"
                class="range-input"
                placeholder="最小"
                :controls="false"
              />
              <span class="range-sep">~</span>
              <a-input-number
                v-model:value="maxLikes"
                :min="0"
                size="small"
                class="range-input"
                placeholder="不限"
                :controls="false"
              />
            </div>
          </div>
          <div class="config-field">
            <label class="field-label">评论数范围</label>
            <div class="range-row">
              <a-input-number
                v-model:value="minComments"
                :min="0"
                size="small"
                class="range-input"
                placeholder="最小"
                :controls="false"
              />
              <span class="range-sep">~</span>
              <a-input-number
                v-model:value="maxComments"
                :min="0"
                size="small"
                class="range-input"
                placeholder="不限"
                :controls="false"
              />
            </div>
          </div>
        </div>

        <div class="section-divider" />

        <!-- 采集配置 -->
        <div class="config-section">
          <div class="section-title">采集配置</div>
          <div class="config-field inline-field">
            <label class="field-label">采集间隔</label>
            <a-input-number
              v-model:value="intervalMin"
              :min="1"
              :max="60"
              size="small"
              class="short-input"
              :controls="false"
            />
            <span class="unit-text">分钟</span>
          </div>
          <div class="config-field inline-field">
            <label class="field-label">最大并发数</label>
            <a-input-number
              v-model:value="concurrency"
              :min="1"
              :max="5"
              size="small"
              class="short-input"
            />
          </div>
          <div class="config-field">
            <a-checkbox v-model:checked="autoAddMonitor">
              <span class="checkbox-label">采集完自动加入监控</span>
            </a-checkbox>
          </div>
          <div class="config-field">
            <a-checkbox v-model:checked="newVideoOnly">
              <span class="checkbox-label">仅采集新视频</span>
            </a-checkbox>
          </div>
        </div>

        <div class="section-divider" />

        <!-- Save button -->
        <div class="config-section save-section">
          <a-button
            type="primary"
            :loading="savingConfig"
            @click="saveConfig"
          >
            保存配置
          </a-button>
        </div>

      </div>
    </div>

  </div>

  <!-- ── Add/Edit keyword modal ──────────────────────────────────────────── -->
  <a-modal
    v-model:open="modalVisible"
    :title="editingKeyword ? '编辑关键词' : '添加关键词'"
    :width="400"
    :confirm-loading="modalSubmitting"
    ok-text="确认"
    cancel-text="取消"
    @ok="submitKeywordModal"
  >
    <div class="modal-form">
      <div class="modal-field">
        <label class="modal-label">关键词</label>
        <a-input
          v-model:value="modalKeyword"
          placeholder="输入采集关键词"
          allow-clear
        />
      </div>

      <div class="modal-field">
        <label class="modal-label">优先级</label>
        <div class="star-selector">
          <span
            v-for="n in priorityStarOptions"
            :key="n"
            class="star-opt"
            :class="{ 'star-active': n <= modalPriority }"
            @click="modalPriority = n"
          >★</span>
          <span class="star-hint">{{ modalPriority }} 星</span>
        </div>
      </div>

      <div class="modal-field">
        <label class="modal-label">搜索时间范围</label>
        <a-select
          v-model:value="modalTimeRange"
          style="width: 100%"
          :options="timeRangeOptions"
        />
      </div>

      <div class="modal-field">
        <label class="modal-label">每次采集数量</label>
        <a-input-number
          v-model:value="modalCountPerRun"
          :min="1"
          :max="50"
          style="width: 100%"
          addon-after="条"
        />
      </div>
    </div>
  </a-modal>

  <!-- ── Export modal ────────────────────────────────────────────────────── -->
  <a-modal
    v-model:open="exportVisible"
    title="导出历史"
    :width="320"
    :confirm-loading="exporting"
    ok-text="导出"
    cancel-text="取消"
    @ok="doExport"
  >
    <div class="modal-form">
      <div class="modal-field">
        <label class="modal-label">导出格式</label>
        <a-radio-group v-model:value="exportFormat">
          <a-radio value="csv">CSV</a-radio>
          <a-radio value="txt">TXT</a-radio>
        </a-radio-group>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
/* ── Page layout ─────────────────────────────────────────────────────────── */
.page-wrap {
  width: 1000px;
  height: 700px;
  display: flex;
  flex-direction: column;
  background: #F5F5F5;
  overflow: hidden;
}

/* ── Status bar ──────────────────────────────────────────────────────────── */
.status-bar {
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #FFFFFF;
  border-bottom: 1px solid #E8E8E8;
  gap: 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green {
  background: #00B96B;
  box-shadow: 0 0 0 2px rgba(0, 185, 107, 0.2);
}

.dot-grey {
  background: #BFBFBF;
}

.status-label {
  font-size: 13px;
  font-weight: 500;
}

.label-green { color: #00B96B; }
.label-grey  { color: #8C8C8C; }

.status-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 16px;
}

.stat-label {
  font-size: 12px;
  color: #8C8C8C;
}

.stat-val {
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}

.val-primary { color: #1677FF; }
.val-red     { color: #FF4D4F; }
.val-muted   { color: #8C8C8C; }

.stat-divider {
  width: 1px;
  height: 16px;
  background: #E8E8E8;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
  justify-content: flex-end;
}

/* ── Middle row ──────────────────────────────────────────────────────────── */
.middle-row {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px 10px 6px;
  min-height: 0;
  overflow: hidden;
}

/* ── Panels ──────────────────────────────────────────────────────────────── */
.panel {
  background: #FFFFFF;
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.kw-panel {
  flex: 0 0 420px;
}

.hist-panel {
  flex: 1;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #E8E8E8;
  flex-shrink: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-wrap {
  flex: 1;
  overflow: auto;
  padding: 0;
}

/* ── Bottom config panel ─────────────────────────────────────────────────── */
.bottom-panel {
  flex: 0 0 140px;
  margin: 0 10px 10px;
}

.bottom-sections {
  display: flex;
  align-items: flex-start;
  height: 100%;
  padding: 12px 16px;
  gap: 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.save-section {
  flex: 0 0 auto;
  justify-content: center;
  align-self: center;
}

.section-divider {
  width: 1px;
  height: 100%;
  background: #E8E8E8;
  margin: 0 20px;
  flex-shrink: 0;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: #8C8C8C;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 2px;
}

.config-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inline-field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: #595959;
  min-width: 60px;
  flex-shrink: 0;
}

.range-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.range-input {
  width: 68px !important;
}

.range-sep {
  font-size: 12px;
  color: #8C8C8C;
  padding: 0 2px;
}

.short-input {
  width: 60px !important;
}

.unit-text {
  font-size: 12px;
  color: #8C8C8C;
}

.checkbox-label {
  font-size: 12px;
  color: #1A1A1A;
}

/* ── Table cell helpers ───────────────────────────────────────────────────── */
.kw-name {
  font-size: 13px;
  font-weight: 500;
}

.stars {
  font-size: 12px;
  letter-spacing: 1px;
}

.cell-secondary {
  font-size: 11px;
  color: #595959;
}

.kw-tag {
  display: inline-block;
  background: #E6F7FF;
  color: #1677FF;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.num-val {
  font-size: 13px;
  font-weight: 500;
  color: #1A1A1A;
}

.link-blue {
  color: #1677FF;
  cursor: pointer;
  font-size: 11px;
}
.link-blue:hover { text-decoration: underline; }

.danger-link {
  font-size: 12px;
  color: #FF4D4F;
  cursor: pointer;
  text-decoration: none;
}
.danger-link:hover { text-decoration: underline; }

.status-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge-success {
  background: #F6FFED;
  color: #52C41A;
  border: 1px solid #B7EB8F;
}

.badge-fail {
  background: #FFF2F0;
  color: #FF4D4F;
  border: 1px solid #FFA39E;
}

/* ── Action buttons ──────────────────────────────────────────────────────── */
.action-btns {
  display: flex;
  gap: 2px;
}

.icon-btn {
  width: 24px !important;
  height: 24px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* ── Modal form ──────────────────────────────────────────────────────────── */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 8px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-label {
  font-size: 12px;
  font-weight: 500;
  color: #595959;
}

/* ── Star selector ───────────────────────────────────────────────────────── */
.star-selector {
  display: flex;
  align-items: center;
  gap: 4px;
}

.star-opt {
  font-size: 20px;
  color: #D9D9D9;
  cursor: pointer;
  line-height: 1;
  transition: color 0.1s;
}

.star-opt:hover,
.star-active {
  color: #FA8C16;
}

.star-hint {
  font-size: 12px;
  color: #8C8C8C;
  margin-left: 4px;
}

/* ── Ant Design table size tweaks ────────────────────────────────────────── */
:deep(.ant-table-wrapper) {
  height: 100%;
}

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
  padding: 6px 8px !important;
}

:deep(.ant-table-tbody > tr > td) {
  padding: 6px 8px !important;
  font-size: 12px;
}

:deep(.ant-table-pagination.ant-pagination) {
  margin: 6px 8px !important;
}

:deep(.ant-pagination-total-text) {
  font-size: 12px;
  color: #8C8C8C;
}
</style>
