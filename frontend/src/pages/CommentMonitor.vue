<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMonitorStore } from '../stores/monitor'
import type { Comment, MonitorVideo } from '../types'
import { message } from 'ant-design-vue'
import {
  Play,
  Square,
  Upload,
  LayoutDashboard,
  Trash2,
  PauseCircle,
  PlayCircle,
  Send,
  Search,
} from 'lucide-vue-next'

const store = useMonitorStore()

const addVideoUrl = ref('')
const addingVideo = ref(false)
const togglingMonitor = ref(false)
const selectedRowKeys = ref<string[]>([])

onMounted(async () => {
  await store.init()
  if (store.videos.length > 0) {
    store.selectVideo(store.videos[0].video_id)
  }
})

onUnmounted(() => {
  store.teardownEventListeners()
})

async function handleToggleMonitor() {
  togglingMonitor.value = true
  try {
    if (store.status.running) {
      await store.stopMonitor()
      message.success('监控已停止')
    } else {
      await store.startMonitor()
      message.success('监控已启动')
    }
  } catch {
    message.error('操作失败')
  } finally {
    togglingMonitor.value = false
  }
}

async function handleAddVideo() {
  if (!addVideoUrl.value.trim()) {
    message.warning('请输入视频链接')
    return
  }
  addingVideo.value = true
  try {
    await store.addVideo(addVideoUrl.value.trim())
    addVideoUrl.value = ''
    message.success('视频添加成功')
  } catch {
    message.error('添加失败，请检查链接是否正确')
  } finally {
    addingVideo.value = false
  }
}

async function handleDeleteVideo(videoId: string) {
  try {
    await store.deleteVideo(videoId)
    message.success('已删除')
  } catch {
    message.error('删除失败')
  }
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${mo}-${day} ${h}:${m}`
}

const dmStatusMap: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: '待发', color: '#FA8C16', bg: '#FFF7E6' },
  sent: { text: '已发', color: '#52C41A', bg: '#F6FFED' },
  failed: { text: '失败', color: '#FF4D4F', bg: '#FFF1F0' },
  skip: { text: '跳过', color: '#8C8C8C', bg: '#F5F5F5' },
  blocked: { text: '已封', color: '#722ED1', bg: '#F9F0FF' },
}

const videoColumns = [
  { title: '', dataIndex: 'cover', key: 'cover', width: 56 },
  { title: '视频信息', dataIndex: 'info', key: 'info', ellipsis: true },
  { title: '点赞', dataIndex: 'like_count', key: 'likes', width: 60 },
  { title: '评论', dataIndex: 'comment_count', key: 'comments', width: 60 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 68 },
  { title: '操作', key: 'actions', width: 72 },
]

const commentColumns = [
  { title: 'UID / 昵称', key: 'user', width: 130 },
  { title: '评论内容', key: 'content', ellipsis: true },
  { title: '地区', dataIndex: 'region', key: 'region', width: 60 },
  { title: '点赞', dataIndex: 'like_count', key: 'likes', width: 50 },
  { title: '私信状态', key: 'dm_status', width: 70 },
  { title: '时间', key: 'time', width: 80 },
  { title: '操作', key: 'actions', width: 60 },
]

const selectedVideo = computed(() =>
  store.videos.find(v => v.video_id === store.selectedVideoId)
)

const rowSelection = {
  selectedRowKeys,
  onChange: (keys: string[]) => {
    selectedRowKeys.value = keys
  },
}
</script>

<template>
  <div class="page-layout">
    <!-- Title bar -->
    <div class="title-bar">
      <span class="title-bar-title">评论监控</span>
      <div class="divider-v" />

      <!-- Status indicator -->
      <div class="stat-item">
        <div :class="store.status.running ? 'dot-running' : 'dot-stopped'" />
        <span :style="{ color: store.status.running ? '#00B96B' : '#8C8C8C', fontWeight: 500 }">
          {{ store.status.running ? '运行中' : '已停止' }}
        </span>
      </div>
      <div class="divider-v" />
      <div class="stat-item">
        轮次 <span class="stat-value">{{ store.status.current_round }}</span>
      </div>
      <div class="stat-item">
        新评论
        <span class="stat-value primary">{{ store.status.new_comments_this_round }}</span>
      </div>
      <div class="stat-item">
        总评论
        <span class="stat-value">{{ store.status.total_comments }}</span>
      </div>

      <div style="flex: 1" />

      <a-button size="small">
        <template #icon><Upload :size="13" /></template>
        导入
      </a-button>
      <a-button size="small">
        <template #icon><LayoutDashboard :size="13" /></template>
        监控中心
      </a-button>
      <a-button
        :type="store.status.running ? 'default' : 'primary'"
        size="small"
        :loading="togglingMonitor"
        :danger="store.status.running"
        @click="handleToggleMonitor"
      >
        <template #icon>
          <Square v-if="store.status.running" :size="13" />
          <Play v-else :size="13" />
        </template>
        {{ store.status.running ? '停止监控' : '开始监控' }}
      </a-button>
    </div>

    <!-- Body split -->
    <div class="body-split">
      <!-- Left: Video list -->
      <div class="left-panel panel">
        <!-- Search -->
        <div class="left-search">
          <a-input
            v-model:value="store.searchKeyword"
            placeholder="搜索视频/作者..."
            size="small"
            allow-clear
          >
            <template #prefix><Search :size="12" color="#8C8C8C" /></template>
          </a-input>
        </div>

        <!-- Add video -->
        <div class="add-video-row">
          <a-input
            v-model:value="addVideoUrl"
            placeholder="粘贴抖音视频链接..."
            size="small"
            style="flex: 1"
            @press-enter="handleAddVideo"
          />
          <a-button
            type="primary"
            size="small"
            :loading="addingVideo"
            @click="handleAddVideo"
          >
            添加
          </a-button>
        </div>

        <!-- Video table -->
        <div class="video-table-wrap">
          <a-table
            :data-source="store.filteredVideos"
            :columns="videoColumns"
            :row-key="r => r.video_id"
            :pagination="false"
            size="small"
            :loading="store.loading"
            :row-selection="rowSelection"
            :custom-row="(record: MonitorVideo) => ({
              onClick: () => store.selectVideo(record.video_id),
              class: record.video_id === store.selectedVideoId ? 'selected-row' : '',
              style: 'cursor: pointer',
            })"
            class="compact-table video-table"
            :scroll="{ y: 'calc(100% - 32px)' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'cover'">
                <div class="video-cover">
                  <div v-if="record.cover_url" class="cover-img">
                    <img :src="record.cover_url" alt="封面" />
                  </div>
                  <div v-else class="cover-placeholder">
                    <span>{{ record.title.charAt(0) }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'info'">
                <div class="video-info">
                  <div class="video-title truncate">{{ record.title }}</div>
                  <div class="video-author">{{ record.author_nickname }}</div>
                </div>
              </template>
              <template v-else-if="column.key === 'likes'">
                <span class="text-sm">{{ formatNumber(record.like_count) }}</span>
              </template>
              <template v-else-if="column.key === 'comments'">
                <span class="text-sm">{{ formatNumber(record.comment_count) }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <span
                  class="badge"
                  :class="record.status === 'active' ? 'badge-success' : 'badge-default'"
                >
                  {{ record.status === 'active' ? '监控中' : '已暂停' }}
                </span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <div class="action-btns">
                  <a-tooltip :title="record.status === 'active' ? '暂停' : '启动'">
                    <a-button type="text" size="small" class="icon-btn">
                      <PauseCircle v-if="record.status === 'active'" :size="14" color="#FA8C16" />
                      <PlayCircle v-else :size="14" color="#00B96B" />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip title="删除">
                    <a-button
                      type="text"
                      size="small"
                      class="icon-btn"
                      @click.stop="handleDeleteVideo(record.video_id)"
                    >
                      <Trash2 :size="14" color="#FF4D4F" />
                    </a-button>
                  </a-tooltip>
                </div>
              </template>
            </template>
          </a-table>
        </div>

        <!-- Footer -->
        <div class="left-footer">
          <a-button size="small">
            <template #icon><Upload :size="12" /></template>
            导入
          </a-button>
          <a-button size="small">
            <template #icon><LayoutDashboard :size="12" /></template>
            监控中心
          </a-button>
          <a-button type="primary" size="small">
            <template #icon><Play :size="12" /></template>
            批量启动
          </a-button>
        </div>
      </div>

      <!-- Right: Comment stream -->
      <div class="right-panel panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <span>实时评论流</span>
            <span v-if="selectedVideo" class="selected-video-title truncate">
              — {{ selectedVideo.title }}
            </span>
          </div>
          <div class="panel-header-right">
            <span class="text-xs text-secondary">显示模式</span>
            <a-radio-group
              v-model:value="store.commentMode"
              size="small"
              button-style="solid"
              @change="() => store.fetchComments()"
            >
              <a-radio-button value="new">仅新增</a-radio-button>
              <a-radio-button value="all">全部</a-radio-button>
            </a-radio-group>
          </div>
        </div>

        <div class="comment-table-wrap">
          <a-table
            :data-source="store.comments"
            :columns="commentColumns"
            row-key="comment_id"
            :pagination="false"
            size="small"
            :loading="store.commentLoading"
            class="compact-table comment-table"
            :scroll="{ y: 'calc(100% - 32px)' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <div class="user-cell">
                  <div class="nickname truncate">{{ record.nickname }}</div>
                  <div class="uid truncate text-xs text-placeholder">{{ record.uid }}</div>
                </div>
              </template>
              <template v-else-if="column.key === 'content'">
                <div class="comment-content truncate">
                  <span v-if="record.level === 2" class="reply-tag">回复 </span>
                  {{ record.content }}
                </div>
              </template>
              <template v-else-if="column.key === 'dm_status'">
                <span
                  class="badge"
                  :style="{
                    background: dmStatusMap[record.dm_status]?.bg,
                    color: dmStatusMap[record.dm_status]?.color,
                  }"
                >
                  {{ dmStatusMap[record.dm_status]?.text }}
                </span>
              </template>
              <template v-else-if="column.key === 'time'">
                <span class="text-xs text-secondary">{{ formatTime(record.created_at) }}</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-tooltip title="发私信">
                  <a-button type="text" size="small" class="icon-btn">
                    <Send :size="13" color="#1677FF" />
                  </a-button>
                </a-tooltip>
              </template>
            </template>

            <template #emptyText>
              <div class="empty-hint">
                {{ store.selectedVideoId ? '暂无评论数据' : '请选择左侧视频以查看评论' }}
              </div>
            </template>
          </a-table>
        </div>
      </div>
    </div>
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

.left-panel {
  width: 35%;
  min-width: 340px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-search {
  padding: 10px 10px 6px;
  border-bottom: 1px solid var(--color-border);
}

.add-video-row {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
}

.video-table-wrap {
  flex: 1;
  overflow: hidden;
}

:deep(.video-table) .ant-table-wrapper,
:deep(.video-table) .ant-spin-nested-loading,
:deep(.video-table) .ant-spin-container,
:deep(.video-table) .ant-table,
:deep(.video-table) .ant-table-container,
:deep(.video-table) .ant-table-body {
  height: 100%;
}

:deep(.comment-table) .ant-table-wrapper,
:deep(.comment-table) .ant-spin-nested-loading,
:deep(.comment-table) .ant-spin-container,
:deep(.comment-table) .ant-table,
:deep(.comment-table) .ant-table-container,
:deep(.comment-table) .ant-table-body {
  height: 100%;
}

.left-footer {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid var(--color-border);
  justify-content: flex-end;
}

.video-cover {
  width: 40px;
  height: 40px;
}

.cover-img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
}

.cover-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background: linear-gradient(135deg, #00B96B22, #00B96B44);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.video-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.video-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  max-width: 140px;
}

.video-author {
  font-size: 11px;
  color: var(--color-text-placeholder);
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

:deep(.selected-row) td {
  background: #F9FFF8 !important;
}

.selected-video-title {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-secondary);
  max-width: 220px;
}

.comment-table-wrap {
  flex: 1;
  overflow: hidden;
}

.user-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nickname {
  font-size: 12px;
  font-weight: 500;
  max-width: 120px;
}

.uid {
  max-width: 120px;
}

.comment-content {
  font-size: 12px;
  max-width: 260px;
}

.reply-tag {
  color: var(--color-info);
  font-size: 11px;
}

.empty-hint {
  padding: 40px 0;
  color: var(--color-text-placeholder);
  font-size: 13px;
}
</style>
