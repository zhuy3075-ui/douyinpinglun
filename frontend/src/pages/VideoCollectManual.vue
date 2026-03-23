<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as App from '../wailsjs/go/main/App'
import { message, Modal } from 'ant-design-vue'
import {
  Search,
  Download,
  Plus,
  MonitorCheck,
  PackageOpen,
} from 'lucide-vue-next'

// ── Types ────────────────────────────────────────────────────────────────────

interface VideoSearchResult {
  video_id: string
  title: string
  author_nickname: string
  cover_url: string
  like_count: number
  comment_count: number
  published_at: string
  source_keyword?: string
  already_added: boolean
}

interface BrowserProfile {
  seq: number
  profile_id: string
  display_name: string
  nickname: string
  cookie_status: string
  enabled: boolean
}

// ── Router ───────────────────────────────────────────────────────────────────

const router = useRouter()

// ── Search form state ─────────────────────────────────────────────────────────

const keyword = ref('')
const sortType = ref('comprehensive')
const publishTime = ref('0')
const duration = ref('0')
const collectCount = ref(50)
const searching = ref(false)

const sortOptions = [
  { value: 'comprehensive', label: '综合排序' },
  { value: 'most_likes', label: '最多点赞' },
  { value: 'most_comments', label: '最多评论' },
  { value: 'latest', label: '最新发布' },
]

const publishTimeOptions = [
  { value: '0', label: '不限' },
  { value: '1', label: '一天内' },
  { value: '7', label: '一周内' },
  { value: '180', label: '半年内' },
]

const durationOptions = [
  { value: '0', label: '不限' },
  { value: '60', label: '1分钟以下' },
  { value: '300', label: '1-5分钟' },
  { value: '99999', label: '5分钟以上' },
]

// ── Results state ─────────────────────────────────────────────────────────────

const allResults = ref<VideoSearchResult[]>([])
const hasSearched = ref(false)

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 9
const currentPage = ref(1)

const pagedResults = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return allResults.value.slice(start, start + PAGE_SIZE)
})

// ── Row selection ─────────────────────────────────────────────────────────────

const selectedRowKeys = ref<string[]>([])

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: string[]) => {
    selectedRowKeys.value = keys
  },
  getCheckboxProps: (record: VideoSearchResult) => ({
    disabled: record.already_added,
  }),
}))

// ── Accounts (for bind-window modal) ─────────────────────────────────────────

const accounts = ref<BrowserProfile[]>([])

async function loadAccounts() {
  try {
    const res = await App.GetAccounts(1, 100)
    accounts.value = (res?.items ?? res) as BrowserProfile[]
  } catch {
    // non-fatal; modal will show empty dropdown
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

async function handleSearch() {
  if (!keyword.value.trim()) {
    message.warning('请输入关键词')
    return
  }
  searching.value = true
  selectedRowKeys.value = []
  currentPage.value = 1
  try {
    const res = await App.SearchVideos(
      keyword.value.trim(),
      sortType.value,
      publishTime.value,
      duration.value,
      collectCount.value,
    )
    allResults.value = (res ?? []) as VideoSearchResult[]
    hasSearched.value = true
  } catch (e) {
    message.error('采集失败，请重试')
  } finally {
    searching.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function formatRelativeTime(iso: string): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}天前`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month}个月前`
  return `${Math.floor(month / 12)}年前`
}

// ── Bind-window modal (used by single add + bulk add) ─────────────────────────

const bindModalVisible = ref(false)
const bindModalLoading = ref(false)
const selectedProfileId = ref<string>('')
/** video_ids queued for the current modal confirm */
const pendingVideoIds = ref<string[]>([])

function accountLabel(a: BrowserProfile): string {
  return `#${a.seq} ${a.nickname || a.display_name}`
}

function openBindModal(videoIds: string[]) {
  if (videoIds.length === 0) {
    message.warning('请先选择要添加的视频')
    return
  }
  pendingVideoIds.value = videoIds
  selectedProfileId.value = accounts.value.length > 0 ? accounts.value[0].profile_id : ''
  bindModalVisible.value = true
}

async function confirmBindAndAdd() {
  if (!selectedProfileId.value) {
    message.warning('请选择绑定窗口')
    return
  }
  bindModalLoading.value = true
  let successCount = 0
  const ids = pendingVideoIds.value
  for (const id of ids) {
    try {
      await App.AddVideo(id, selectedProfileId.value)
      const item = allResults.value.find(r => r.video_id === id)
      if (item) item.already_added = true
      successCount++
    } catch {
      // continue adding others
    }
  }
  bindModalLoading.value = false
  bindModalVisible.value = false
  selectedRowKeys.value = []
  pendingVideoIds.value = []
  if (successCount > 0) {
    message.success(`成功添加 ${successCount} 条视频到监控`)
  } else {
    message.error('添加失败，请重试')
  }
}

// ── Add single video ──────────────────────────────────────────────────────────

function handleAddSingle(record: VideoSearchResult) {
  openBindModal([record.video_id])
}

// ── Add all results ───────────────────────────────────────────────────────────

function handleAddAllToMonitor() {
  const ids = allResults.value.filter(r => !r.already_added).map(r => r.video_id)
  if (ids.length === 0) {
    message.info('所有视频均已添加到监控')
    return
  }
  openBindModal(ids)
}

// ── Batch add selected ────────────────────────────────────────────────────────

function handleBatchAdd() {
  const ids = selectedRowKeys.value.filter(id => {
    const item = allResults.value.find(r => r.video_id === id)
    return item && !item.already_added
  })
  openBindModal(ids)
}

// ── Export modal ──────────────────────────────────────────────────────────────

const exportModalVisible = ref(false)
const exportFormat = ref<'csv' | 'txt'>('csv')
const exporting = ref(false)

async function confirmExport() {
  exporting.value = true
  try {
    const path = await App.ExportData('search_results', exportFormat.value, {})
    message.success(`已导出至 ${path}`)
    exportModalVisible.value = false
  } catch {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

// ── Table columns ─────────────────────────────────────────────────────────────

const columns = [
  { key: 'video_info', title: '视频信息', ellipsis: true },
  { key: 'like_count', title: '点赞数', width: 80, align: 'right' as const },
  { key: 'comment_count', title: '评论数', width: 80, align: 'right' as const },
  { key: 'published_at', title: '发布时间', width: 90, align: 'center' as const },
  { key: 'status', title: '状态', width: 80, align: 'center' as const },
  { key: 'actions', title: '操作', width: 100, align: 'center' as const },
]

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(() => {
  loadAccounts()
})
</script>

<template>
  <div class="page-layout">

    <!-- ── Top: search bar panel ───────────────────────────────────────────── -->
    <div class="search-bar-panel">
      <a-input
        v-model:value="keyword"
        placeholder="输入关键词..."
        allow-clear
        style="flex: 1; min-width: 160px; max-width: 280px;"
        @press-enter="handleSearch"
      >
        <template #prefix>
          <Search :size="13" color="#8C8C8C" />
        </template>
      </a-input>

      <div class="divider-v" />

      <span class="filter-label">排序</span>
      <a-select v-model:value="sortType" size="small" style="width: 110px">
        <a-select-option v-for="o in sortOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <span class="filter-label">发布时间</span>
      <a-select v-model:value="publishTime" size="small" style="width: 90px">
        <a-select-option v-for="o in publishTimeOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <span class="filter-label">视频时长</span>
      <a-select v-model:value="duration" size="small" style="width: 100px">
        <a-select-option v-for="o in durationOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <span class="filter-label">采集数量</span>
      <a-input-number
        v-model:value="collectCount"
        :min="1"
        :max="200"
        size="small"
        style="width: 72px"
      />

      <a-button
        type="primary"
        :loading="searching"
        style="margin-left: 4px;"
        @click="handleSearch"
      >
        <template #icon><Search :size="13" /></template>
        开始采集
      </a-button>
    </div>

    <!-- ── Results area ────────────────────────────────────────────────────── -->
    <div class="results-wrapper">

      <!-- Results panel header -->
      <div class="panel-header">
        <div class="panel-header-left">
          <span class="section-title">搜索结果</span>
          <a-badge
            v-if="allResults.length > 0"
            :count="allResults.length"
            :overflow-count="999"
            :number-style="{ backgroundColor: '#00B96B', fontSize: '11px' }"
          />
          <a-button
            v-if="allResults.length > 0"
            size="small"
            style="margin-left: 8px;"
            @click="handleAddAllToMonitor"
          >
            <template #icon><MonitorCheck :size="12" /></template>
            全部添加监控
          </a-button>
        </div>
        <div class="panel-header-right">
          <a-button
            size="small"
            :disabled="allResults.length === 0"
            @click="exportModalVisible = true"
          >
            <template #icon><Download :size="12" /></template>
            导出
          </a-button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-scroll-area">
        <a-table
          :data-source="pagedResults"
          :columns="columns"
          row-key="video_id"
          :pagination="false"
          size="small"
          :loading="searching"
          :row-selection="rowSelection"
          class="compact-table search-table"
          :scroll="{ y: 'calc(100% - 39px)' }"
        >
          <template #bodyCell="{ column, record }">

            <!-- 视频信息 -->
            <template v-if="column.key === 'video_info'">
              <div class="video-info-cell">
                <div class="cover-thumb">
                  <img
                    v-if="record.cover_url"
                    :src="record.cover_url"
                    alt="cover"
                    class="cover-img"
                  />
                  <span v-else class="cover-placeholder-char">
                    {{ (record.title || '?').charAt(0) }}
                  </span>
                </div>
                <div class="video-meta">
                  <div class="video-title truncate" :title="record.title">
                    {{ record.title }}
                  </div>
                  <div class="video-author text-secondary text-xs">
                    {{ record.author_nickname }}
                  </div>
                </div>
              </div>
            </template>

            <!-- 点赞数 -->
            <template v-else-if="column.key === 'like_count'">
              <span class="text-sm font-medium">{{ formatNumber(record.like_count) }}</span>
            </template>

            <!-- 评论数 -->
            <template v-else-if="column.key === 'comment_count'">
              <span class="text-sm font-medium">{{ formatNumber(record.comment_count) }}</span>
            </template>

            <!-- 发布时间 -->
            <template v-else-if="column.key === 'published_at'">
              <span class="text-xs text-secondary">{{ formatRelativeTime(record.published_at) }}</span>
            </template>

            <!-- 状态 -->
            <template v-else-if="column.key === 'status'">
              <span v-if="record.already_added" class="badge badge-default" style="font-size: 11px;">
                已监控
              </span>
            </template>

            <!-- 操作 -->
            <template v-else-if="column.key === 'actions'">
              <a-button
                v-if="!record.already_added"
                type="primary"
                size="small"
                @click="handleAddSingle(record)"
              >
                <template #icon><Plus :size="12" /></template>
                添加监控
              </a-button>
              <span v-else class="text-xs text-placeholder">已添加</span>
            </template>

          </template>

          <!-- Empty state -->
          <template #emptyText>
            <div class="empty-state">
              <PackageOpen :size="36" color="#D9D9D9" />
              <div class="empty-text">
                {{ hasSearched ? '暂无搜索结果' : '请输入关键词后点击采集' }}
              </div>
            </div>
          </template>
        </a-table>
      </div>

      <!-- Pagination + bottom toolbar -->
      <div class="bottom-bar">
        <div class="bottom-left">
          <span class="text-sm text-secondary">
            共 <strong style="color: var(--color-text-primary);">{{ allResults.length }}</strong> 条结果
          </span>
          <template v-if="selectedRowKeys.length > 0">
            <div class="divider-v" />
            <span class="text-sm" style="color: var(--color-primary);">
              已选 {{ selectedRowKeys.length }} 条
            </span>
            <a-button
              type="primary"
              size="small"
              @click="handleBatchAdd"
            >
              <template #icon><Plus :size="12" /></template>
              批量添加监控
            </a-button>
          </template>
        </div>

        <a-pagination
          v-if="allResults.length > 0"
          v-model:current="currentPage"
          :total="allResults.length"
          :page-size="PAGE_SIZE"
          :show-size-changer="false"
          size="small"
          :show-total="(total: number) => `共 ${total} 条结果`"
        />
      </div>
    </div>

    <!-- ── Bind-window modal ───────────────────────────────────────────────── -->
    <a-modal
      v-model:open="bindModalVisible"
      title="添加到监控"
      :confirm-loading="bindModalLoading"
      ok-text="确认添加"
      cancel-text="取消"
      :width="400"
      @ok="confirmBindAndAdd"
    >
      <div style="padding: 8px 0 4px;">
        <div class="modal-field-label">绑定窗口</div>
        <a-select
          v-model:value="selectedProfileId"
          placeholder="选择账号窗口"
          style="width: 100%;"
        >
          <a-select-option
            v-for="acc in accounts"
            :key="acc.profile_id"
            :value="acc.profile_id"
          >
            {{ accountLabel(acc) }}
          </a-select-option>
        </a-select>
        <div v-if="accounts.length === 0" class="text-xs text-placeholder" style="margin-top: 6px;">
          暂无可用账号，请先在私信模块添加账号
        </div>
        <div class="modal-hint text-xs text-secondary" style="margin-top: 10px;">
          将添加 <strong>{{ pendingVideoIds.length }}</strong> 条视频到监控列表，并绑定至所选窗口
        </div>
      </div>
    </a-modal>

    <!-- ── Export modal ────────────────────────────────────────────────────── -->
    <a-modal
      v-model:open="exportModalVisible"
      title="导出搜索结果"
      :confirm-loading="exporting"
      ok-text="导出"
      cancel-text="取消"
      :width="360"
      @ok="confirmExport"
    >
      <div style="padding: 8px 0 4px;">
        <div class="modal-field-label">导出格式</div>
        <a-radio-group v-model:value="exportFormat">
          <a-radio value="csv">CSV</a-radio>
          <a-radio value="txt">TXT</a-radio>
        </a-radio-group>
      </div>
    </a-modal>

  </div>
</template>

<style scoped>
/* ── Search bar panel ────────────────────────────────────────────────────── */
.search-bar-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 16px;
  background: var(--color-panel-bg);
  border-bottom: 1px solid var(--color-border);
  min-height: 52px;
}

.filter-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

/* ── Results wrapper ─────────────────────────────────────────────────────── */
.results-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 12px 16px;
  background: var(--color-panel-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* ── Table scroll area ───────────────────────────────────────────────────── */
.table-scroll-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.search-table) {
  height: 100%;
}

:deep(.search-table .ant-spin-nested-loading),
:deep(.search-table .ant-spin-container),
:deep(.search-table .ant-table),
:deep(.search-table .ant-table-container) {
  height: 100%;
}

:deep(.search-table .ant-table-body) {
  overflow-y: auto !important;
}

/* ── Video info cell ─────────────────────────────────────────────────────── */
.video-info-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cover-thumb {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(0, 185, 107, 0.12), rgba(0, 185, 107, 0.25));
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder-char {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-primary);
}

.video-meta {
  min-width: 0;
  flex: 1;
}

.video-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.4;
  max-width: 360px;
}

.video-author {
  margin-top: 2px;
}

/* ── Bottom bar ──────────────────────────────────────────────────────────── */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-bg);
  min-height: 44px;
  flex-shrink: 0;
}

.bottom-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-placeholder);
}

/* ── Modal fields ────────────────────────────────────────────────────────── */
.modal-field-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.modal-hint {
  line-height: 1.5;
}
</style>
