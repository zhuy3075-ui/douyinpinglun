<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { LogEntry } from '../types'
import * as App from '../wailsjs/go/main/App'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { message } from 'ant-design-vue'
import { Search, Download, Trash2 } from 'lucide-vue-next'

const logs = ref<LogEntry[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const levelFilter = ref('ALL')
const exporting = ref(false)

const levelOptions = [
  { value: 'ALL', label: '全部级别' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
  { value: 'ERROR', label: 'ERROR' },
  { value: 'DEBUG', label: 'DEBUG' },
]

const levelStyle: Record<string, { color: string; bg: string }> = {
  INFO: { color: '#1677FF', bg: '#E6F7FF' },
  WARN: { color: '#FA8C16', bg: '#FFF7E6' },
  ERROR: { color: '#FF4D4F', bg: '#FFF1F0' },
  DEBUG: { color: '#8C8C8C', bg: '#F5F5F5' },
  SUCCESS: { color: '#52C41A', bg: '#F6FFED' },
}

// Some INFO logs appear as "success" style (green)
function getLevelStyle(entry: LogEntry) {
  if (entry.level === 'INFO' && entry.message.includes('成功')) {
    return levelStyle.SUCCESS
  }
  return levelStyle[entry.level] || levelStyle.DEBUG
}

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchLevel = levelFilter.value === 'ALL' || log.level === levelFilter.value
    const matchKeyword = !searchKeyword.value.trim() ||
      log.message.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      log.created_at.includes(searchKeyword.value)
    return matchLevel && matchKeyword
  })
})

async function fetchLogs() {
  loading.value = true
  try {
    logs.value = await App.GetLogs(
      levelFilter.value === 'ALL' ? '' : levelFilter.value,
      searchKeyword.value,
      500
    )
  } catch {
    message.error('加载日志失败')
  } finally {
    loading.value = false
  }
}

async function handleClear() {
  try {
    await App.ClearLogs()
    logs.value = []
    message.success('日志已清空')
  } catch {
    message.error('清空失败')
  }
}

async function handleExport() {
  exporting.value = true
  try {
    await App.ExportLogs('logs_export.txt')
    message.success('日志已导出')
  } catch {
    message.error('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await fetchLogs()

  EventsOn('log:new-entry', (entry: LogEntry) => {
    logs.value.unshift(entry)
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(0, 1000)
    }
  })
})

onUnmounted(() => {
  EventsOff('log:new-entry')
})

const columns = [
  {
    title: '时间',
    dataIndex: 'created_at',
    key: 'time',
    width: 160,
  },
  {
    title: '级别',
    key: 'level',
    width: 70,
  },
  {
    title: '内容',
    key: 'message',
  },
]
</script>

<template>
  <div class="page-layout">
    <!-- Title bar -->
    <div class="title-bar">
      <span class="title-bar-title">日志记录</span>
      <div class="divider-v" />

      <a-input
        v-model:value="searchKeyword"
        placeholder="搜索日志内容..."
        size="small"
        style="width: 220px"
        allow-clear
        @change="fetchLogs"
      >
        <template #prefix><Search :size="12" color="#8C8C8C" /></template>
      </a-input>

      <a-select
        v-model:value="levelFilter"
        size="small"
        style="width: 110px"
        @change="fetchLogs"
      >
        <a-select-option
          v-for="opt in levelOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </a-select-option>
      </a-select>

      <div style="flex: 1" />

      <a-button size="small" :loading="exporting" @click="handleExport">
        <template #icon><Download :size="13" /></template>
        导出
      </a-button>

      <a-popconfirm
        title="确认清空所有日志？"
        ok-text="清空"
        ok-type="danger"
        cancel-text="取消"
        @confirm="handleClear"
      >
        <a-button size="small" danger>
          <template #icon><Trash2 :size="13" /></template>
          清空
        </a-button>
      </a-popconfirm>
    </div>

    <!-- Log stats bar -->
    <div class="stats-bar">
      <div class="log-stat-item">
        共 <strong>{{ filteredLogs.length }}</strong> 条
        <span v-if="levelFilter !== 'ALL' || searchKeyword" class="text-secondary">（已过滤）</span>
      </div>
      <div class="log-level-counts">
        <span
          v-for="level in ['INFO', 'WARN', 'ERROR', 'DEBUG']"
          :key="level"
          class="level-count-tag"
          :style="{ background: levelStyle[level].bg, color: levelStyle[level].color }"
          @click="levelFilter = level; fetchLogs()"
        >
          {{ level }} {{ logs.filter(l => l.level === level).length }}
        </span>
      </div>
    </div>

    <!-- Log table -->
    <div class="log-table-wrap">
      <a-table
        :data-source="filteredLogs"
        :columns="columns"
        row-key="id"
        :pagination="false"
        size="small"
        :loading="loading"
        class="compact-table log-table"
        :scroll="{ y: 'calc(100% - 32px)' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'time'">
            <span class="time-cell text-secondary">{{ record.created_at }}</span>
          </template>

          <template v-else-if="column.key === 'level'">
            <span
              class="level-badge"
              :style="{
                background: getLevelStyle(record).bg,
                color: getLevelStyle(record).color,
              }"
            >
              {{ record.level }}
            </span>
          </template>

          <template v-else-if="column.key === 'message'">
            <span
              class="msg-cell"
              :class="{
                'msg-error': record.level === 'ERROR',
                'msg-warn': record.level === 'WARN',
                'msg-debug': record.level === 'DEBUG',
              }"
            >{{ record.message }}</span>
          </template>
        </template>

        <template #emptyText>
          <div style="padding: 60px 0; color: #8C8C8C; font-size: 13px;">
            暂无日志记录
          </div>
        </template>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  background: var(--color-panel-bg);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
}

.log-stat-item {
  color: var(--color-text-secondary);
}

.log-level-counts {
  display: flex;
  gap: 6px;
}

.level-count-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.level-count-tag:hover {
  opacity: 0.75;
}

.log-table-wrap {
  flex: 1;
  overflow: hidden;
  padding: 10px;
}

:deep(.log-table) .ant-table-wrapper,
:deep(.log-table) .ant-spin-nested-loading,
:deep(.log-table) .ant-spin-container,
:deep(.log-table) .ant-table,
:deep(.log-table) .ant-table-container,
:deep(.log-table) .ant-table-body {
  height: 100%;
}

.time-cell {
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  white-space: nowrap;
}

.level-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Courier New', Courier, monospace;
  min-width: 44px;
  text-align: center;
}

.msg-cell {
  font-size: 12px;
  font-family: 'Courier New', Courier, monospace;
  color: var(--color-text-primary);
  word-break: break-all;
}

.msg-error {
  color: #CF1322;
}

.msg-warn {
  color: #AD6800;
}

.msg-debug {
  color: #8C8C8C;
}
</style>
