<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { KeywordConfig, CollectHistory, AutoCollectConfig } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { message } from 'ant-design-vue'
import {
  Plus,
  Upload,
  Play,
  Square,
  Settings,
  Trash2,
  Edit3,
  Star,
} from 'lucide-vue-next'

const router = useRouter()

// State
const keywords = ref<KeywordConfig[]>([])
const history = ref<CollectHistory[]>([])
const config = ref<AutoCollectConfig>({
  interval_sec: 3600,
  concurrency: 3,
  auto_add_to_monitor: true,
  new_video_only: true,
  min_likes: 1000,
  max_likes: 0,
  min_comments: 50,
  max_comments: 0,
  exclude_authors: '',
  include_authors: '',
})

const engineRunning = ref(false)
const nextCollectSec = ref(40)
const currentRoundVideos = ref(0)
const totalMonitored = ref(0)
const loading = ref(false)
const savingConfig = ref(false)
const collectingNow = ref(false)
const authorTab = ref<'exclude' | 'include'>('exclude')

// Modal state
const addKeywordVisible = ref(false)
const newKeyword = ref({
  keyword: '',
  priority: 3,
  search_time_range: '7天内',
  count_per_run: 50,
})

let countdownTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await fetchAll()
  setupEvents()
  startCountdown()
})

onUnmounted(() => {
  teardownEvents()
  if (countdownTimer) clearInterval(countdownTimer)
})

async function fetchAll() {
  loading.value = true
  try {
    const [kws, hist, cfg] = await Promise.all([
      App.GetKeywords(),
      App.GetCollectHistory(),
      App.GetAutoCollectConfig(),
    ])
    keywords.value = kws
    history.value = hist
    config.value = cfg
  } catch {
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

function startCountdown() {
  countdownTimer = setInterval(() => {
    if (engineRunning.value && nextCollectSec.value > 0) {
      nextCollectSec.value--
    }
  }, 1000)
}

function setupEvents() {
  EventsOn('collect:status-change', (data: any) => {
    engineRunning.value = data.running
    nextCollectSec.value = data.next_collect_in_sec
    currentRoundVideos.value = data.current_round_videos
    totalMonitored.value = data.total_monitored
  })
  EventsOn('collect:progress', (data: any) => {
    currentRoundVideos.value = data.collected
  })
}

function teardownEvents() {
  EventsOff('collect:status-change')
  EventsOff('collect:progress')
}

async function toggleEngine() {
  try {
    if (engineRunning.value) {
      await App.StopAutoCollect()
      engineRunning.value = false
      message.success('自动采集已停止')
    } else {
      await App.StartAutoCollect()
      engineRunning.value = true
      nextCollectSec.value = config.value.interval_sec
      message.success('自动采集已启动')
    }
  } catch {
    message.error('操作失败')
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

async function toggleKeyword(kw: KeywordConfig) {
  try {
    await App.UpdateKeyword({ ...kw, enabled: !kw.enabled })
    kw.enabled = !kw.enabled
  } catch {
    message.error('更新失败')
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

async function addKeyword() {
  if (!newKeyword.value.keyword.trim()) {
    message.warning('请输入关键词')
    return
  }
  try {
    await App.AddKeyword({
      id: '',
      ...newKeyword.value,
      enabled: true,
      stats: { total_collected: 0, total_monitored: 0 },
      last_run_at: '',
      created_at: new Date().toISOString(),
    })
    await fetchAll()
    addKeywordVisible.value = false
    newKeyword.value = { keyword: '', priority: 3, search_time_range: '7天内', count_per_run: 50 }
    message.success('关键词已添加')
  } catch {
    message.error('添加失败')
  }
}

async function saveConfig() {
  savingConfig.value = true
  try {
    await App.SaveAutoCollectConfig(config.value)
    message.success('配置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    savingConfig.value = false
  }
}

function renderStars(n: number) {
  return '★'.repeat(Math.min(n, 5)) + '☆'.repeat(Math.max(0, 5 - n))
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`
  return `${Math.floor(sec / 60)}分${sec % 60}秒`
}

const timeRangeOptions = ['不限', '1天内', '3天内', '7天内', '30天内', '180天内']

const kwColumns = [
  { title: '状态', key: 'status', width: 60 },
  { title: '关键词', key: 'keyword', width: 120 },
  { title: '优先级', key: 'priority', width: 80 },
  { title: '配置', key: 'config', width: 130 },
  { title: '统计', key: 'stats', width: 100 },
  { title: '最后采集', key: 'last_run', width: 110 },
  { title: '操作', key: 'actions', width: 70 },
]

const histColumns = [
  { title: '关键词', key: 'keyword', width: 80 },
  { title: '采集时间', key: 'time', width: 115 },
  { title: '采集数', key: 'collected', width: 60 },
  { title: '过滤后', key: 'filtered', width: 60 },
  { title: '已添加', key: 'added', width: 60 },
  { title: '耗时', key: 'duration', width: 70 },
  { title: '状态', key: 'status', width: 64 },
  { title: '错误', key: 'error', ellipsis: true },
]
</script>

<template>
  <div class="page-layout">
    <!-- Tab bar -->
    <div class="tab-bar">
      <button class="tab-btn" @click="router.push('/collect/manual')">手动搜索</button>
      <button class="tab-btn active">自动采集</button>
    </div>

    <!-- Title bar -->
    <div class="title-bar">
      <div class="stat-item">
        <div :class="engineRunning ? 'dot-running' : 'dot-stopped'" />
        <span :style="{ color: engineRunning ? '#00B96B' : '#8C8C8C', fontWeight: 500 }">
          {{ engineRunning ? '运行中' : '已停止' }}
        </span>
      </div>
      <div class="divider-v" />

      <div class="stat-item">
        下次采集
        <span class="stat-value" :style="{ color: engineRunning ? '#FF4D4F' : '#8C8C8C' }">
          {{ nextCollectSec }}秒
        </span>
      </div>
      <div class="stat-item">
        本轮视频 <span class="stat-value">{{ currentRoundVideos }}</span>
      </div>
      <div class="stat-item">
        已采监控 <span class="stat-value primary">{{ totalMonitored }}</span>
      </div>

      <div style="flex: 1" />

      <a-button
        :type="engineRunning ? 'default' : 'primary'"
        :danger="engineRunning"
        size="small"
        @click="toggleEngine"
      >
        <template #icon>
          <Square v-if="engineRunning" :size="13" />
          <Play v-else :size="13" />
        </template>
        {{ engineRunning ? '停止采集' : '启动采集' }}
      </a-button>
    </div>

    <!-- Body split -->
    <div class="body-split">
      <!-- Left 65% -->
      <div class="left-col">
        <!-- Keyword management -->
        <div class="panel keyword-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span>关键词管理</span>
              <span class="count-badge">{{ keywords.length }}个</span>
            </div>
            <div class="panel-header-right">
              <a-button size="small" type="primary" @click="addKeywordVisible = true">
                <template #icon><Plus :size="12" /></template>
                添加
              </a-button>
              <a-button size="small">
                <template #icon><Upload :size="12" /></template>
                导入
              </a-button>
              <a-button size="small" :loading="collectingNow" @click="collectNow">
                <template #icon><Play :size="12" /></template>
                立即采集
              </a-button>
            </div>
          </div>

          <div class="kw-table-wrap">
            <a-table
              :data-source="keywords"
              :columns="kwColumns"
              row-key="id"
              :pagination="false"
              size="small"
              :loading="loading"
              class="compact-table"
              :scroll="{ y: 'calc(100% - 32px)' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'status'">
                  <a-switch
                    :checked="record.enabled"
                    size="small"
                    @change="() => toggleKeyword(record)"
                  />
                </template>

                <template v-else-if="column.key === 'keyword'">
                  <span
                    class="kw-name"
                    :style="{ color: record.enabled ? '#1A1A1A' : '#BFBFBF' }"
                  >
                    {{ record.keyword }}
                  </span>
                </template>

                <template v-else-if="column.key === 'priority'">
                  <span
                    class="stars"
                    :style="{ color: record.enabled ? '#FA8C16' : '#D9D9D9' }"
                  >
                    {{ renderStars(record.priority) }}
                  </span>
                </template>

                <template v-else-if="column.key === 'config'">
                  <div class="config-cell text-xs text-secondary">
                    <div>{{ record.search_time_range }} · {{ record.count_per_run }}条/次</div>
                  </div>
                </template>

                <template v-else-if="column.key === 'stats'">
                  <div class="stats-cell text-xs">
                    <span>采集 {{ record.stats.total_collected }}</span>
                    <span style="color: #00B96B"> 监控 {{ record.stats.total_monitored }}</span>
                  </div>
                </template>

                <template v-else-if="column.key === 'last_run'">
                  <span class="text-xs text-secondary">
                    {{ record.last_run_at ? record.last_run_at.slice(5, 16) : '—' }}
                  </span>
                </template>

                <template v-else-if="column.key === 'actions'">
                  <div class="action-btns">
                    <a-tooltip title="编辑">
                      <a-button type="text" size="small" class="icon-btn">
                        <Edit3 :size="13" color="#595959" />
                      </a-button>
                    </a-tooltip>
                    <a-tooltip title="删除">
                      <a-button type="text" size="small" class="icon-btn" @click="deleteKeyword(record.id)">
                        <Trash2 :size="13" color="#FF4D4F" />
                      </a-button>
                    </a-tooltip>
                  </div>
                </template>
              </template>
            </a-table>
          </div>
        </div>

        <!-- Collect history -->
        <div class="panel history-panel">
          <div class="panel-header">
            <div class="panel-header-left">
              <span>采集历史</span>
              <span class="count-badge">{{ history.length }}条</span>
            </div>
            <div class="panel-header-right">
              <a-button size="small" danger @click="history = []">清空</a-button>
            </div>
          </div>

          <div class="hist-table-wrap">
            <a-table
              :data-source="history"
              :columns="histColumns"
              row-key="id"
              :pagination="false"
              size="small"
              class="compact-table"
              :scroll="{ y: 'calc(100% - 32px)' }"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'keyword'">
                  <span class="kw-tag">{{ record.keyword }}</span>
                </template>
                <template v-else-if="column.key === 'time'">
                  <span class="text-xs text-secondary">{{ record.started_at.slice(5, 16) }}</span>
                </template>
                <template v-else-if="column.key === 'collected'">
                  <span class="text-sm font-medium">{{ record.collected }}</span>
                </template>
                <template v-else-if="column.key === 'filtered'">
                  <span class="text-sm">{{ record.collected - record.filtered_out }}</span>
                </template>
                <template v-else-if="column.key === 'added'">
                  <span class="text-sm" style="color: #00B96B; font-weight: 500;">{{ record.added }}</span>
                </template>
                <template v-else-if="column.key === 'duration'">
                  <span class="text-xs text-secondary">{{ formatDuration(record.duration_sec) }}</span>
                </template>
                <template v-else-if="column.key === 'status'">
                  <span
                    class="badge"
                    :class="record.status === 'success' ? 'badge-success' : 'badge-danger'"
                  >
                    {{ record.status === 'success' ? '成功' : '失败' }}
                  </span>
                </template>
                <template v-else-if="column.key === 'error'">
                  <span class="text-xs" style="color: #FF4D4F">{{ record.error_msg || '—' }}</span>
                </template>
              </template>
            </a-table>
          </div>
        </div>
      </div>

      <!-- Right 35% -->
      <div class="right-col panel config-panel">
        <div class="panel-header">
          <div class="panel-header-left">
            <Settings :size="14" />
            <span>配置</span>
          </div>
          <a-button
            type="primary"
            size="small"
            :loading="savingConfig"
            @click="saveConfig"
          >
            保存
          </a-button>
        </div>

        <div class="config-body">
          <!-- 基础配置 -->
          <div class="config-section">
            <div class="section-title">基础配置</div>
            <div class="config-row">
              <label>采集间隔</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="config.interval_sec"
                  :min="60"
                  :max="86400"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">秒</span>
              </div>
            </div>
            <div class="config-row">
              <label>最大并发</label>
              <div class="config-control">
                <a-input-number
                  v-model:value="config.concurrency"
                  :min="1"
                  :max="10"
                  size="small"
                  style="width: 90px"
                />
                <span class="unit-label">个</span>
              </div>
            </div>
            <div class="config-row">
              <label>自动添加监控</label>
              <a-switch v-model:checked="config.auto_add_to_monitor" size="small" />
            </div>
            <div class="config-row">
              <label>仅采集新视频</label>
              <a-switch v-model:checked="config.new_video_only" size="small" />
            </div>
          </div>

          <!-- 数据过滤 -->
          <div class="config-section">
            <div class="section-title">数据过滤</div>
            <div class="config-row">
              <label>点赞数范围</label>
              <div class="config-control range-control">
                <a-input-number
                  v-model:value="config.min_likes"
                  :min="0"
                  size="small"
                  style="width: 72px"
                  placeholder="最小"
                />
                <span class="range-sep">~</span>
                <a-input-number
                  v-model:value="config.max_likes"
                  :min="0"
                  size="small"
                  style="width: 72px"
                  placeholder="不限"
                />
              </div>
            </div>
            <div class="config-row">
              <label>评论数范围</label>
              <div class="config-control range-control">
                <a-input-number
                  v-model:value="config.min_comments"
                  :min="0"
                  size="small"
                  style="width: 72px"
                  placeholder="最小"
                />
                <span class="range-sep">~</span>
                <a-input-number
                  v-model:value="config.max_comments"
                  :min="0"
                  size="small"
                  style="width: 72px"
                  placeholder="不限"
                />
              </div>
            </div>
          </div>

          <!-- 作者设置 -->
          <div class="config-section">
            <div class="section-title">作者设置</div>
            <div class="author-tabs">
              <button
                class="author-tab"
                :class="{ active: authorTab === 'exclude' }"
                @click="authorTab = 'exclude'"
              >
                排除作者
              </button>
              <button
                class="author-tab"
                :class="{ active: authorTab === 'include' }"
                @click="authorTab = 'include'"
              >
                仅包含作者
              </button>
            </div>
            <a-textarea
              v-if="authorTab === 'exclude'"
              v-model:value="config.exclude_authors"
              placeholder="每行一个作者昵称或UID，精确匹配"
              :rows="4"
              size="small"
              class="author-textarea"
            />
            <a-textarea
              v-else
              v-model:value="config.include_authors"
              placeholder="每行一个作者昵称或UID，仅采集这些作者的视频"
              :rows="4"
              size="small"
              class="author-textarea"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Add keyword modal -->
    <a-modal
      v-model:visible="addKeywordVisible"
      title="添加关键词"
      :width="400"
      @ok="addKeyword"
    >
      <div class="modal-form">
        <div class="form-row">
          <label>关键词</label>
          <a-input v-model:value="newKeyword.keyword" placeholder="输入采集关键词" />
        </div>
        <div class="form-row">
          <label>优先级 (1-5)</label>
          <a-slider v-model:value="newKeyword.priority" :min="1" :max="5" :marks="{ 1: '1', 3: '3', 5: '5' }" />
        </div>
        <div class="form-row">
          <label>时间范围</label>
          <a-select v-model:value="newKeyword.search_time_range" style="width: 100%">
            <a-select-option v-for="t in timeRangeOptions" :key="t" :value="t">{{ t }}</a-select-option>
          </a-select>
        </div>
        <div class="form-row">
          <label>每次采集数量</label>
          <a-input-number v-model:value="newKeyword.count_per_run" :min="10" :max="500" style="width: 100%" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--color-panel-bg);
  border-bottom: 1px solid var(--color-border);
  padding: 0 16px;
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

.tab-btn:hover { color: var(--color-text-primary); }
.tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

.body-split {
  flex: 1;
  display: flex;
  gap: 10px;
  padding: 10px;
  overflow: hidden;
  min-height: 0;
}

.left-col {
  flex: 0 0 65%;
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

.keyword-panel {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.history-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.kw-table-wrap,
.hist-table-wrap {
  flex: 1;
  overflow: hidden;
}

.count-badge {
  background: #F0F0F0;
  color: #595959;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 400;
}

.kw-name {
  font-size: 13px;
  font-weight: 500;
}

.stars {
  font-size: 13px;
  letter-spacing: 1px;
}

.config-cell, .stats-cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.kw-tag {
  display: inline-block;
  background: #E6F7FF;
  color: #1677FF;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
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

/* Config panel */
.config-panel {
  min-height: 0;
}

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
  min-width: 70px;
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

.range-control {
  display: flex;
  align-items: center;
}

.range-sep {
  padding: 0 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.author-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 6px;
}

.author-tab {
  padding: 4px 12px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.author-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.author-textarea {
  font-size: 12px !important;
}

/* Modal form */
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
</style>
