<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { VideoSearchResult } from '../types'
import * as App from '../wailsjs/go/main/App'
import { message } from 'ant-design-vue'
import { Search, Plus, Download, CheckCircle } from 'lucide-vue-next'

const router = useRouter()

const keyword = ref('')
const sortType = ref('hot')
const publishTime = ref('0')
const duration = ref('0')
const count = ref('50')
const searching = ref(false)
const results = ref<VideoSearchResult[]>([])
const selectedKeys = ref<string[]>([])

const sortOptions = [
  { value: 'hot', label: '最热' },
  { value: 'new', label: '最新' },
  { value: 'follow', label: '关注' },
]

const publishTimeOptions = [
  { value: '0', label: '不限时间' },
  { value: '1', label: '1天内' },
  { value: '7', label: '7天内' },
  { value: '30', label: '30天内' },
  { value: '180', label: '180天内' },
]

const durationOptions = [
  { value: '0', label: '不限时长' },
  { value: '60', label: '1分钟内' },
  { value: '300', label: '1-5分钟' },
  { value: '1200', label: '5-20分钟' },
  { value: '99999', label: '20分钟以上' },
]

const countOptions = [
  { value: '20', label: '20条' },
  { value: '50', label: '50条' },
  { value: '100', label: '100条' },
  { value: '200', label: '200条' },
]

async function handleSearch() {
  if (!keyword.value.trim()) {
    message.warning('请输入搜索关键词')
    return
  }
  searching.value = true
  selectedKeys.value = []
  try {
    results.value = await App.SearchVideos(
      keyword.value.trim(),
      sortType.value,
      publishTime.value,
      duration.value,
      parseInt(count.value)
    )
  } catch (e) {
    message.error('搜索失败，请重试')
  } finally {
    searching.value = false
  }
}

async function handleAddToMonitor(videoId: string) {
  try {
    await App.AddVideo(videoId)
    const item = results.value.find(r => r.video_id === videoId)
    if (item) item.already_added = true
    message.success('已添加到监控列表')
  } catch {
    message.error('添加失败')
  }
}

async function handleAddSelected() {
  if (selectedKeys.value.length === 0) {
    message.warning('请先选择视频')
    return
  }
  let success = 0
  for (const id of selectedKeys.value) {
    try {
      await App.AddVideo(id)
      const item = results.value.find(r => r.video_id === id)
      if (item) item.already_added = true
      success++
    } catch { /* continue */ }
  }
  message.success(`成功添加 ${success} 条视频`)
  selectedKeys.value = []
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const resultColumns = [
  { title: '', key: 'cover', width: 56 },
  { title: '视频标题', key: 'title', ellipsis: true },
  { title: '作者', dataIndex: 'author_nickname', key: 'author', width: 100 },
  { title: '点赞', key: 'likes', width: 70 },
  { title: '评论', key: 'comments', width: 70 },
  { title: '发布时间', dataIndex: 'published_at', key: 'date', width: 100 },
  { title: '关键词', key: 'keyword', width: 90 },
  { title: '操作', key: 'actions', width: 90 },
]

const rowSelection = {
  selectedRowKeys: selectedKeys,
  onChange: (keys: string[]) => { selectedKeys.value = keys },
  getCheckboxProps: (record: VideoSearchResult) => ({
    disabled: record.already_added,
  }),
}

onMounted(() => {
  // Load some default results
  handleSearch()
})
</script>

<template>
  <div class="page-layout">
    <!-- Tab bar -->
    <div class="tab-bar">
      <button class="tab-btn active">手动搜索</button>
      <button class="tab-btn" @click="router.push('/collect/auto')">自动采集</button>
    </div>

    <!-- Title / Search bar -->
    <div class="title-bar" style="height: 52px; flex-wrap: wrap; gap: 8px;">
      <span class="title-bar-title">视频采集</span>
      <div class="divider-v" />

      <a-input
        v-model:value="keyword"
        placeholder="搜索关键词..."
        size="small"
        style="width: 160px"
        allow-clear
        @press-enter="handleSearch"
      >
        <template #prefix><Search :size="12" color="#8C8C8C" /></template>
      </a-input>

      <a-select v-model:value="publishTime" size="small" style="width: 100px">
        <a-select-option v-for="o in publishTimeOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="sortType" size="small" style="width: 80px">
        <a-select-option v-for="o in sortOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="duration" size="small" style="width: 96px">
        <a-select-option v-for="o in durationOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-select v-model:value="count" size="small" style="width: 72px">
        <a-select-option v-for="o in countOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>

      <a-button
        type="primary"
        size="small"
        :loading="searching"
        @click="handleSearch"
      >
        <template #icon><Search :size="13" /></template>
        开始搜索
      </a-button>
    </div>

    <!-- Results table -->
    <div class="results-area">
      <a-table
        :data-source="results"
        :columns="resultColumns"
        row-key="video_id"
        :pagination="false"
        size="small"
        :loading="searching"
        :row-selection="rowSelection"
        class="compact-table result-table"
        :scroll="{ y: 'calc(100% - 32px)' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'cover'">
            <div class="cover-placeholder">
              <span>{{ record.title.charAt(0) }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'title'">
            <div class="result-title-cell">
              <div class="video-title truncate">{{ record.title }}</div>
            </div>
          </template>

          <template v-else-if="column.key === 'likes'">
            <span class="text-sm">{{ formatNumber(record.like_count) }}</span>
          </template>

          <template v-else-if="column.key === 'comments'">
            <span class="text-sm">{{ formatNumber(record.comment_count) }}</span>
          </template>

          <template v-else-if="column.key === 'keyword'">
            <span
              class="keyword-tag"
              style="background: #E6F7FF; color: #1677FF; padding: 2px 6px; border-radius: 4px; font-size: 11px;"
            >
              {{ record.source_keyword }}
            </span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <span v-if="record.already_added" class="badge badge-success">
              <CheckCircle :size="11" />
              已添加
            </span>
            <a-button
              v-else
              type="primary"
              size="small"
              @click="handleAddToMonitor(record.video_id)"
            >
              <template #icon><Plus :size="12" /></template>
              添加监控
            </a-button>
          </template>
        </template>

        <template #emptyText>
          <div style="padding: 60px 0; color: #8C8C8C; font-size: 13px;">
            输入关键词搜索视频
          </div>
        </template>
      </a-table>
    </div>

    <!-- Bottom bar -->
    <div class="bottom-bar">
      <span class="result-count text-secondary text-sm">
        共 <strong style="color: #1A1A1A">{{ results.length }}</strong> 条结果
        <span v-if="selectedKeys.length > 0" style="color: #00B96B; margin-left: 8px;">
          已选 {{ selectedKeys.length }} 条
        </span>
      </span>
      <div style="display: flex; gap: 8px;">
        <a-button size="small" @click="selectedKeys = results.filter(r => !r.already_added).map(r => r.video_id)">
          批量选择
        </a-button>
        <a-button
          type="primary"
          size="small"
          :disabled="selectedKeys.length === 0"
          @click="handleAddSelected"
        >
          <template #icon><Plus :size="12" /></template>
          添加选中 ({{ selectedKeys.length }})
        </a-button>
        <a-button size="small">
          <template #icon><Download :size="12" /></template>
          导出
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--color-panel-bg);
  border-bottom: 1px solid var(--color-border);
  padding: 0 16px;
  gap: 0;
}

.tab-btn {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--color-text-primary);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.results-area {
  flex: 1;
  overflow: hidden;
  padding: 0 10px;
  margin-top: 10px;
}

:deep(.result-table) .ant-table-wrapper,
:deep(.result-table) .ant-spin-nested-loading,
:deep(.result-table) .ant-spin-container,
:deep(.result-table) .ant-table,
:deep(.result-table) .ant-table-container,
:deep(.result-table) .ant-table-body {
  height: 100%;
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

.result-title-cell {
  max-width: 300px;
}

.video-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.bottom-bar {
  height: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--color-panel-bg);
  border-top: 1px solid var(--color-border);
}
</style>
