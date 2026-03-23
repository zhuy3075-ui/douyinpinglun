<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  Play,
  Square,
  Download,
  Plus,
  Trash2,
  PauseCircle,
  PlayCircle,
  Send,
} from 'lucide-vue-next'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import type { MonitorVideo, Comment, MonitorStatus, BrowserProfile, PagedResult } from '../types'

// ── Monitor status ───────────────────────────────────────────────────────────
const monitorStatus = ref<MonitorStatus>({
  running: false,
  current_round: 0,
  new_comments_this_round: 0,
  total_comments: 0,
})
const togglingMonitor = ref(false)

// ── Video list (left panel) ──────────────────────────────────────────────────
const videos = ref<MonitorVideo[]>([])
const videoTotal = ref(0)
const videoPage = ref(1)
const videoLoading = ref(false)
const selectedVideoId = ref<string | null>(null)

// ── Accounts (for binding window select) ────────────────────────────────────
const accounts = ref<BrowserProfile[]>([])

// ── Add Video modal ──────────────────────────────────────────────────────────
const addModalVisible = ref(false)
const addVideoUrl = ref('')
const addVideoBoundProfileId = ref<string | undefined>(undefined)
const addingVideo = ref(false)

// ── Export Videos modal ──────────────────────────────────────────────────────
const exportVideosVisible = ref(false)
const exportingVideos = ref(false)

// ── Comment list (right panel) ───────────────────────────────────────────────
const comments = ref<Comment[]>([])
const commentTotal = ref(0)
const commentPage = ref(1)
const commentLoading = ref(false)
const commentMode = ref<'new' | 'all'>('all')

// ── Export Comments modal ────────────────────────────────────────────────────
const exportCommentsVisible = ref(false)
const exportingComments = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────
const selectedVideo = computed(() =>
  videos.value.find(v => v.video_id === selectedVideoId.value) ?? null
)

const accountOptions = computed(() =>
  accounts.value.map(a => ({
    value: a.profile_id,
    label: `#${a.seq} ${a.nickname} (${a.cookie_status === 'valid' ? '有效' : a.cookie_status === 'expired' ? '已过期' : '未知'})`,
    status: a.cookie_status,
  }))
)

// ── DM status label map ──────────────────────────────────────────────────────
const dmStatusMap: Record<string, { text: string; color: string; bg: string }> = {
  pending_review: { text: '待审核', color: '#8C8C8C', bg: '#F5F5F5' },
  approved:       { text: '待发',   color: '#1677FF', bg: '#E6F4FF' },
  sending:        { text: '发送中', color: '#FA8C16', bg: '#FFF7E6' },
  sent:           { text: '已发',   color: '#00B96B', bg: '#F6FFED' },
  failed:         { text: '失败',   color: '#FF4D4F', bg: '#FFF1F0' },
  skip:           { text: '跳过',   color: '#8C8C8C', bg: '#F5F5F5' },
  blocked:        { text: '已拉黑', color: '#FA8C16', bg: '#FFF7E6' },
}

// ── Table column definitions ─────────────────────────────────────────────────
const videoColumns = [
  { key: 'info',         title: '视频信息' },
  { key: 'bound_window', title: '绑定窗口', width: 90 },
  { key: 'status',       title: '状态',    width: 72 },
  { key: 'collected',    title: '已采集',  width: 58 },
  { key: 'actions',      title: '操作',    width: 64 },
]

const commentColumns = [
  { key: 'user',      title: '用户',     width: 120 },
  { key: 'content',   title: '评论内容' },
  { key: 'likes',     title: '点赞',     width: 50 },
  { key: 'time',      title: '时间',     width: 76 },
  { key: 'dm_status', title: '私信状态', width: 72 },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000)  return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)      return `${diff}秒前`
  if (diff < 3600)    return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400)   return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

function boundWindowLabel(video: MonitorVideo): { text: string; valid: boolean } {
  const acc = accounts.value.find(a => a.profile_id === video.bound_profile_id)
  if (!acc) return { text: `#${video.bound_seq ?? '-'}`, valid: false }
  return {
    text: `#${acc.seq} ${acc.nickname}`,
    valid: acc.cookie_status === 'valid',
  }
}

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchVideos(page = videoPage.value) {
  videoLoading.value = true
  try {
    const result: PagedResult<MonitorVideo> = await App.GetVideos(page, 8)
    videos.value = result.items
    videoTotal.value = result.total
    videoPage.value = result.page
  } catch (e) {
    message.error('加载视频列表失败')
    console.error(e)
  } finally {
    videoLoading.value = false
  }
}

async function fetchAccounts() {
  try {
    const result: PagedResult<BrowserProfile> = await App.GetAccounts(1, 100)
    accounts.value = result.items
  } catch (e) {
    console.error('GetAccounts failed:', e)
  }
}

async function fetchMonitorStatus() {
  try {
    monitorStatus.value = await App.GetMonitorStatus()
  } catch (e) {
    console.error('GetMonitorStatus failed:', e)
  }
}

async function fetchComments(page = commentPage.value) {
  if (!selectedVideoId.value) return
  commentLoading.value = true
  try {
    const result: PagedResult<Comment> = await App.GetComments(
      selectedVideoId.value,
      page,
      11,
    )
    comments.value = result.items
    commentTotal.value = result.total
    commentPage.value = result.page
  } catch (e) {
    message.error('加载评论失败')
    console.error(e)
  } finally {
    commentLoading.value = false
  }
}

// ── Video selection ──────────────────────────────────────────────────────────
function selectVideo(video: MonitorVideo) {
  selectedVideoId.value = video.video_id
  commentPage.value = 1
  fetchComments(1)
}

// ── Monitor toggle ───────────────────────────────────────────────────────────
async function handleToggleMonitor() {
  togglingMonitor.value = true
  try {
    if (monitorStatus.value.running) {
      await App.StopMonitor()
      message.success('监控已停止')
    } else {
      await App.StartMonitor()
      message.success('监控已启动')
    }
    await fetchMonitorStatus()
  } catch {
    message.error('操作失败，请重试')
  } finally {
    togglingMonitor.value = false
  }
}

// ── Add Video ────────────────────────────────────────────────────────────────
function openAddModal() {
  addVideoUrl.value = ''
  addVideoBoundProfileId.value = undefined
  addModalVisible.value = true
}

async function handleAddVideo() {
  if (!addVideoUrl.value.trim()) {
    message.warning('请输入视频链接或视频ID')
    return
  }
  if (!addVideoBoundProfileId.value) {
    message.warning('请选择绑定窗口')
    return
  }
  addingVideo.value = true
  try {
    await App.AddVideo(addVideoUrl.value.trim(), addVideoBoundProfileId.value)
    message.success('视频添加成功')
    addModalVisible.value = false
    await fetchVideos(1)
  } catch {
    message.error('添加失败，请检查链接是否正确')
  } finally {
    addingVideo.value = false
  }
}

// ── Toggle video pause/resume ─────────────────────────────────────────────────
async function handleToggleVideoStatus(video: MonitorVideo) {
  try {
    // The API is expected to be ToggleVideoStatus or similar; use AddVideo stub approach
    // No dedicated API in spec — optimistic UI update only
    video.status = video.status === 'active' ? 'paused' : 'active'
  } catch {
    message.error('操作失败')
  }
}

// ── Delete video ─────────────────────────────────────────────────────────────
function handleDeleteVideo(video: MonitorVideo) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除视频「${video.title}」吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await App.DeleteVideo(video.video_id)
        message.success('已删除')
        if (selectedVideoId.value === video.video_id) {
          selectedVideoId.value = null
          comments.value = []
          commentTotal.value = 0
        }
        await fetchVideos(videoPage.value)
      } catch {
        message.error('删除失败')
      }
    },
  })
}

// ── Export Videos ────────────────────────────────────────────────────────────
async function handleExportVideos(format: 'csv' | 'txt') {
  exportingVideos.value = true
  try {
    const path = await App.ExportVideos(format)
    message.success(`已导出到 ${path}`)
    exportVideosVisible.value = false
  } catch {
    message.error('导出失败')
  } finally {
    exportingVideos.value = false
  }
}

// ── Export Comments ──────────────────────────────────────────────────────────
async function handleExportComments(format: 'csv' | 'txt') {
  if (!selectedVideoId.value) return
  exportingComments.value = true
  try {
    const path = await App.ExportComments(selectedVideoId.value, format)
    message.success(`已导出到 ${path}`)
    exportCommentsVisible.value = false
  } catch {
    message.error('导出失败')
  } finally {
    exportingComments.value = false
  }
}

// ── Comment mode toggle ──────────────────────────────────────────────────────
function handleCommentModeChange() {
  commentPage.value = 1
  fetchComments(1)
}

// ── Wails Events ─────────────────────────────────────────────────────────────
function setupEvents() {
  EventsOn('monitor:status-change', (newStatus: MonitorStatus) => {
    monitorStatus.value = newStatus
  })

  EventsOn('monitor:new-comments', (newComments: Comment[]) => {
    if (!newComments?.length) return
    if (commentMode.value === 'new') {
      // Prepend unique new comments, cap at 200
      const existingIds = new Set(comments.value.map(c => c.comment_id))
      const fresh = newComments.filter(c => !existingIds.has(c.comment_id))
      if (fresh.length) {
        comments.value = [...fresh, ...comments.value].slice(0, 200)
        commentTotal.value += fresh.length
      }
    } else {
      // Full refresh for "all" mode
      fetchComments(commentPage.value)
    }
  })
}

function teardownEvents() {
  EventsOff('monitor:status-change')
  EventsOff('monitor:new-comments')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  setupEvents()
  await Promise.all([fetchVideos(1), fetchAccounts(), fetchMonitorStatus()])
  if (videos.value.length > 0) {
    selectVideo(videos.value[0])
  }
})

onUnmounted(() => {
  teardownEvents()
})
</script>

<template>
  <div class="page-root">
    <!-- ── Monitor control bar ────────────────────────────────────────── -->
    <div class="control-bar">
      <div class="control-left">
        <span
          class="status-dot"
          :class="monitorStatus.running ? 'dot-green' : 'dot-grey'"
        />
        <span
          class="status-text"
          :style="{ color: monitorStatus.running ? '#00B96B' : '#8C8C8C' }"
        >
          {{ monitorStatus.running ? '监控中' : '已停止' }}
        </span>
        <a-divider type="vertical" style="margin: 0 8px" />
        <span class="stat-label">今日采集</span>
        <span class="stat-value">{{ monitorStatus.total_comments }}</span>
        <span class="stat-unit">条</span>
      </div>
      <div class="control-right">
        <a-button
          :type="monitorStatus.running ? 'default' : 'primary'"
          :danger="monitorStatus.running"
          size="small"
          :loading="togglingMonitor"
          @click="handleToggleMonitor"
        >
          <template #icon>
            <Square v-if="monitorStatus.running" :size="12" />
            <Play v-else :size="12" />
          </template>
          {{ monitorStatus.running ? '停止监控' : '启动监控' }}
        </a-button>
      </div>
    </div>

    <!-- ── Two-panel body ─────────────────────────────────────────────── -->
    <div class="panel-row">
      <!-- ── LEFT: video list ──────────────────────────────────────── -->
      <div class="left-panel">
        <!-- Header -->
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">监控视频列表</span>
            <a-badge
              :count="videoTotal"
              :overflow-count="9999"
              :number-style="{ backgroundColor: '#00B96B', fontSize: '11px' }"
            />
          </div>
          <div class="panel-header-right">
            <a-button type="primary" size="small" @click="openAddModal">
              <template #icon><Plus :size="12" /></template>
              添加视频
            </a-button>
            <a-button size="small" @click="exportVideosVisible = true">
              <template #icon><Download :size="12" /></template>
              导出
            </a-button>
          </div>
        </div>

        <!-- Video table -->
        <div class="table-wrap">
          <a-table
            :data-source="videos"
            :columns="videoColumns"
            :row-key="r => r.video_id"
            :pagination="false"
            :loading="videoLoading"
            size="small"
            class="inner-table"
            :scroll="{ y: 'calc(100% - 38px)' }"
            :custom-row="(record: MonitorVideo) => ({
              onClick: () => selectVideo(record),
              class: record.video_id === selectedVideoId ? 'row-selected' : '',
              style: 'cursor: pointer',
            })"
          >
            <template #bodyCell="{ column, record }">
              <!-- 视频信息 -->
              <template v-if="column.key === 'info'">
                <div class="video-info-cell">
                  <div class="cover-box">
                    <img
                      v-if="record.cover_url"
                      :src="record.cover_url"
                      class="cover-img"
                      alt=""
                    />
                    <div v-else class="cover-placeholder">
                      {{ record.title.charAt(0) }}
                    </div>
                  </div>
                  <div class="video-meta">
                    <a-tooltip :title="record.title">
                      <div class="video-title">{{ record.title }}</div>
                    </a-tooltip>
                    <div class="video-author">{{ record.author_nickname }}</div>
                  </div>
                </div>
              </template>

              <!-- 绑定窗口 -->
              <template v-else-if="column.key === 'bound_window'">
                <span
                  class="window-tag"
                  :style="{
                    color: boundWindowLabel(record).valid ? '#00B96B' : '#FF4D4F',
                    background: boundWindowLabel(record).valid ? '#F6FFED' : '#FFF1F0',
                    border: `1px solid ${boundWindowLabel(record).valid ? '#B7EB8F' : '#FFA39E'}`,
                  }"
                >
                  {{ boundWindowLabel(record).text }}
                </span>
              </template>

              <!-- 状态 -->
              <template v-else-if="column.key === 'status'">
                <span
                  class="status-badge"
                  :class="record.status === 'active' ? 'badge-green' : 'badge-grey'"
                >
                  <span
                    class="badge-dot"
                    :class="record.status === 'active' ? 'dot-green' : 'dot-grey'"
                  />
                  {{ record.status === 'active' ? '监控中' : '已暂停' }}
                </span>
              </template>

              <!-- 已采集 -->
              <template v-else-if="column.key === 'collected'">
                <span class="num-text">{{ formatNumber(record.total_comments_collected) }}</span>
              </template>

              <!-- 操作 -->
              <template v-else-if="column.key === 'actions'">
                <div class="action-cell">
                  <a-tooltip :title="record.status === 'active' ? '暂停' : '启动'">
                    <a-button
                      type="text"
                      size="small"
                      class="icon-btn"
                      @click.stop="handleToggleVideoStatus(record)"
                    >
                      <PauseCircle v-if="record.status === 'active'" :size="15" color="#FA8C16" />
                      <PlayCircle v-else :size="15" color="#00B96B" />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="删除">
                    <a-button
                      type="text"
                      size="small"
                      class="icon-btn"
                      @click.stop="handleDeleteVideo(record)"
                    >
                      <Trash2 :size="15" color="#FF4D4F" />
                    </a-button>
                  </a-tooltip>
                </div>
              </template>
            </template>

            <template #emptyText>
              <div class="empty-state">暂无监控视频，点击「添加视频」开始</div>
            </template>
          </a-table>
        </div>

        <!-- Pagination -->
        <div class="panel-footer">
          <a-pagination
            v-model:current="videoPage"
            :total="videoTotal"
            :page-size="8"
            :show-size-changer="false"
            size="small"
            :show-total="(total: number) => `共 ${total} 个视频`"
            @change="(page: number) => fetchVideos(page)"
          />
        </div>
      </div>

      <!-- ── RIGHT: comment stream ──────────────────────────────────── -->
      <div class="right-panel">
        <!-- Header -->
        <div class="panel-header">
          <div class="panel-header-left">
            <span class="panel-title">
              {{ selectedVideo ? selectedVideo.title : '请选择左侧视频' }}
            </span>
          </div>
          <div class="panel-header-right">
            <a-radio-group
              v-model:value="commentMode"
              size="small"
              button-style="solid"
              @change="handleCommentModeChange"
            >
              <a-radio-button value="new">仅新增</a-radio-button>
              <a-radio-button value="all">全部</a-radio-button>
            </a-radio-group>
            <a-button
              size="small"
              :disabled="!selectedVideoId"
              @click="exportCommentsVisible = true"
            >
              <template #icon><Download :size="12" /></template>
              导出
            </a-button>
          </div>
        </div>

        <!-- Comment table -->
        <div class="table-wrap">
          <a-table
            :data-source="comments"
            :columns="commentColumns"
            row-key="comment_id"
            :pagination="false"
            :loading="commentLoading"
            size="small"
            class="inner-table"
            :scroll="{ y: 'calc(100% - 38px)' }"
          >
            <template #bodyCell="{ column, record }">
              <!-- 用户 -->
              <template v-if="column.key === 'user'">
                <div class="user-cell">
                  <div class="user-nickname">{{ record.nickname }}</div>
                  <a-tag
                    v-if="record.region"
                    :bordered="false"
                    color="default"
                    style="font-size: 10px; padding: 0 4px; line-height: 16px; height: 16px"
                  >
                    {{ record.region }}
                  </a-tag>
                </div>
              </template>

              <!-- 评论内容 -->
              <template v-else-if="column.key === 'content'">
                <a-tooltip :title="record.content" placement="topLeft">
                  <div class="comment-content">
                    <span v-if="record.level === 2" class="reply-mark">回复 </span>
                    {{ record.content }}
                  </div>
                </a-tooltip>
              </template>

              <!-- 点赞 -->
              <template v-else-if="column.key === 'likes'">
                <span class="num-text">{{ formatNumber(record.like_count) }}</span>
              </template>

              <!-- 时间 -->
              <template v-else-if="column.key === 'time'">
                <span class="time-text">{{ relativeTime(record.created_at) }}</span>
              </template>

              <!-- 私信状态 -->
              <template v-else-if="column.key === 'dm_status'">
                <span
                  class="dm-badge"
                  :style="{
                    color: dmStatusMap[record.dm_status]?.color ?? '#8C8C8C',
                    background: dmStatusMap[record.dm_status]?.bg ?? '#F5F5F5',
                  }"
                >
                  {{ dmStatusMap[record.dm_status]?.text ?? record.dm_status }}
                </span>
              </template>
            </template>

            <template #emptyText>
              <div class="empty-state">
                {{ selectedVideoId ? '暂无评论数据' : '请选择左侧视频以查看评论' }}
              </div>
            </template>
          </a-table>
        </div>

        <!-- Pagination -->
        <div class="panel-footer">
          <a-pagination
            v-model:current="commentPage"
            :total="commentTotal"
            :page-size="11"
            :show-size-changer="false"
            size="small"
            :show-total="(total: number) => `共 ${total} 条评论`"
            @change="(page: number) => fetchComments(page)"
          />
        </div>
      </div>
    </div>

    <!-- ── Add Video Modal ────────────────────────────────────────────── -->
    <a-modal
      v-model:open="addModalVisible"
      title="添加监控视频"
      :footer="null"
      width="420px"
      @cancel="addModalVisible = false"
    >
      <div class="modal-form">
        <div class="form-item">
          <div class="form-label">视频链接或视频ID <span class="required">*</span></div>
          <a-input
            v-model:value="addVideoUrl"
            placeholder="粘贴抖音视频链接或输入视频ID"
            allow-clear
            @press-enter="handleAddVideo"
          />
        </div>
        <div class="form-item">
          <div class="form-label">绑定窗口 <span class="required">*</span></div>
          <a-select
            v-model:value="addVideoBoundProfileId"
            placeholder="选择绑定账号窗口"
            style="width: 100%"
            :options="accountOptions"
          >
            <template #option="{ value: val, label, status }">
              <span
                :style="{
                  color: status === 'valid' ? '#00B96B' : status === 'expired' ? '#FF4D4F' : '#8C8C8C',
                }"
              >
                {{ label }}
              </span>
            </template>
          </a-select>
        </div>
        <div class="modal-actions">
          <a-button @click="addModalVisible = false">取消</a-button>
          <a-button type="primary" :loading="addingVideo" @click="handleAddVideo">
            确认添加
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- ── Export Videos Modal ────────────────────────────────────────── -->
    <a-modal
      v-model:open="exportVideosVisible"
      title="导出视频列表"
      :footer="null"
      width="320px"
      @cancel="exportVideosVisible = false"
    >
      <div class="export-modal">
        <p class="export-hint">选择导出格式：</p>
        <div class="export-btns">
          <a-button
            :loading="exportingVideos"
            @click="handleExportVideos('csv')"
          >
            CSV 格式
          </a-button>
          <a-button
            :loading="exportingVideos"
            @click="handleExportVideos('txt')"
          >
            TXT 格式
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- ── Export Comments Modal ──────────────────────────────────────── -->
    <a-modal
      v-model:open="exportCommentsVisible"
      title="导出评论数据"
      :footer="null"
      width="320px"
      @cancel="exportCommentsVisible = false"
    >
      <div class="export-modal">
        <p class="export-hint">选择导出格式：</p>
        <div class="export-btns">
          <a-button
            :loading="exportingComments"
            @click="handleExportComments('csv')"
          >
            CSV 格式
          </a-button>
          <a-button
            :loading="exportingComments"
            @click="handleExportComments('txt')"
          >
            TXT 格式
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────── */
.page-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F5F5F5;
  overflow: hidden;
}

/* ── Control bar ─────────────────────────────────────────────────────────── */
.control-bar {
  height: 40px;
  flex-shrink: 0;
  background: #FFFFFF;
  border-bottom: 1px solid #E8E8E8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.control-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-green  { background: #00B96B; box-shadow: 0 0 0 2px #d9f7be; }
.dot-grey   { background: #D9D9D9; }

.status-text {
  font-size: 13px;
  font-weight: 500;
}

.stat-label {
  font-size: 12px;
  color: #8C8C8C;
}

.stat-value {
  font-size: 13px;
  font-weight: 600;
  color: #00B96B;
}

.stat-unit {
  font-size: 12px;
  color: #8C8C8C;
}

/* ── Panel row ───────────────────────────────────────────────────────────── */
.panel-row {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
  min-height: 0;
}

/* ── Shared panel chrome ─────────────────────────────────────────────────── */
.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  overflow: hidden;
}

.left-panel  { width: 35%; min-width: 320px; flex-shrink: 0; }
.right-panel { flex: 1; min-width: 0; }

.panel-header {
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #E8E8E8;
}

.panel-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-footer {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 12px;
  border-top: 1px solid #E8E8E8;
}

/* ── Table wrap ──────────────────────────────────────────────────────────── */
.table-wrap {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.inner-table {
  height: 100%;
}

:deep(.inner-table) .ant-table-wrapper,
:deep(.inner-table) .ant-spin-nested-loading,
:deep(.inner-table) .ant-spin-container,
:deep(.inner-table) .ant-table,
:deep(.inner-table) .ant-table-container {
  height: 100%;
}

:deep(.inner-table) .ant-table-body {
  overflow-y: auto !important;
}

:deep(.inner-table) .ant-table-thead > tr > th {
  background: #FAFAFA;
  font-size: 12px;
  font-weight: 600;
  color: #595959;
  padding: 6px 8px;
}

:deep(.inner-table) .ant-table-tbody > tr > td {
  padding: 6px 8px;
  font-size: 12px;
}

:deep(.row-selected) td {
  background: #F6FFED !important;
}

:deep(.row-selected):hover td {
  background: #EDFAF0 !important;
}

/* ── Video info cell ─────────────────────────────────────────────────────── */
.video-info-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cover-box {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
}

.cover-img {
  width: 40px;
  height: 40px;
  object-fit: cover;
}

.cover-placeholder {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #d9f7be, #b7eb8f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #00B96B;
}

.video-meta {
  min-width: 0;
  flex: 1;
}

.video-title {
  font-size: 12px;
  font-weight: 500;
  color: #1A1A1A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.video-author {
  font-size: 11px;
  color: #8C8C8C;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

/* ── Window tag ──────────────────────────────────────────────────────────── */
.window-tag {
  display: inline-block;
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
  font-weight: 500;
}

/* ── Status badge ────────────────────────────────────────────────────────── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
}

.badge-green { color: #00B96B; background: #F6FFED; }
.badge-grey  { color: #8C8C8C; background: #F5F5F5; }

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Action cell ─────────────────────────────────────────────────────────── */
.action-cell {
  display: flex;
  align-items: center;
  gap: 2px;
}

.icon-btn {
  width: 26px !important;
  height: 26px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* ── Num / time text ─────────────────────────────────────────────────────── */
.num-text  { font-size: 12px; color: #595959; }
.time-text { font-size: 11px; color: #8C8C8C; }

/* ── User cell ───────────────────────────────────────────────────────────── */
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-nickname {
  font-size: 12px;
  font-weight: 500;
  color: #1A1A1A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

/* ── Comment content ─────────────────────────────────────────────────────── */
.comment-content {
  font-size: 12px;
  color: #1A1A1A;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.reply-mark {
  color: #1677FF;
  font-size: 11px;
}

/* ── DM badge ────────────────────────────────────────────────────────────── */
.dm-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  padding: 40px 0;
  text-align: center;
  color: #8C8C8C;
  font-size: 13px;
}

/* ── Modal form ──────────────────────────────────────────────────────────── */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 8px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  color: #1A1A1A;
  font-weight: 500;
}

.required {
  color: #FF4D4F;
  margin-left: 2px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

/* ── Export modal ────────────────────────────────────────────────────────── */
.export-modal {
  padding: 4px 0 8px;
}

.export-hint {
  font-size: 13px;
  color: #595959;
  margin-bottom: 12px;
}

.export-btns {
  display: flex;
  gap: 10px;
}
</style>
