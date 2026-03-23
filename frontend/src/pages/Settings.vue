<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import {
  Settings,
  Globe,
  Key,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  Monitor,
  Zap,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  HelpCircle,
  Edit3,
  Check,
  X,
  Clock,
} from 'lucide-vue-next'
import { message, Modal } from 'ant-design-vue'
import * as App from '../wailsjs/go/main/App'

// ── Types ───────────────────────────────────────────────────────────────────
interface BrowserWindow {
  id: string
  name: string
  seq: number
  conn_status: 'connected' | 'disconnected' | 'checking' | 'unknown'
  login_status: 'valid' | 'expired' | 'need_verify' | 'unknown'
  cookie_updated_at: string
  enabled: boolean
  created_at: string
}

interface RefreshItem {
  id: string
  name: string
  seq: number
  status: 'idle' | 'refreshing' | 'success' | 'fail' | 'login_invalid'
  message: string
}

// ── 服务状态 ─────────────────────────────────────────────────────────────────
const bitBrowserStatus = ref<'checking' | 'online' | 'offline'>('checking')
const signingStatus = ref<'checking' | 'online' | 'offline'>('checking')

// ── 端口配置 ─────────────────────────────────────────────────────────────────
const bitConfig = reactive({ api_port: 54345 })
const signingConfig = reactive({ port: 9527 })
const savingBit = ref(false)

// ── 窗口管理 ─────────────────────────────────────────────────────────────────
const windows = ref<BrowserWindow[]>([])
const loadingWindows = ref(false)

// Add modal
const addModalVisible = ref(false)
const addForm = reactive({ name: '', id: '' })
const addTesting = ref(false)
const addTestResult = ref<'idle' | 'success' | 'fail'>('idle')
const addSaving = ref(false)

// Per-row actions
const testingId = ref('')
const checkingLoginId = ref('')
const deletingId = ref('')
const editingId = ref('')
const editingName = ref('')

// ── Cookie 批量刷新 ──────────────────────────────────────────────────────────
const refreshingAll = ref(false)
const refreshResults = ref<RefreshItem[]>([])

// ── 全局参数 ─────────────────────────────────────────────────────────────────
const globalConfig = reactive({
  monitor_interval_sec: 60,
  monitor_retry_count: 3,
  comment_auto_clean_days: 7,
  auto_blacklist_threshold: 5,
  dingtalk_webhook: '',
})
const savingGlobal = ref(false)

// ── Computed ─────────────────────────────────────────────────────────────────
const activeWindows = computed(() => windows.value.filter(w => w.enabled))

function truncateId(id: string) {
  if (id.length <= 16) return id
  return id.slice(0, 8) + '…' + id.slice(-6)
}

function formatTime(iso: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '—' }
}

// ── Service check ────────────────────────────────────────────────────────────
async function checkServices() {
  bitBrowserStatus.value = 'checking'
  signingStatus.value = 'checking'
  try {
    const r = await App.CheckBitBrowserStatus()
    bitBrowserStatus.value = r?.online ? 'online' : 'offline'
  } catch { bitBrowserStatus.value = 'offline' }
  try {
    const r = await App.CheckSigningServiceStatus()
    signingStatus.value = r?.online ? 'online' : 'offline'
  } catch { signingStatus.value = 'offline' }
}

// ── Window management ────────────────────────────────────────────────────────
async function loadWindows() {
  loadingWindows.value = true
  try {
    windows.value = await App.GetBrowserWindows() || []
  } catch { windows.value = [] }
  finally { loadingWindows.value = false }
}

function openAddModal() {
  addForm.name = ''
  addForm.id = ''
  addTestResult.value = 'idle'
  addModalVisible.value = true
}

async function testAddConnection() {
  if (!addForm.id.trim()) { message.warning('请输入窗口 ID'); return }
  addTesting.value = true
  addTestResult.value = 'idle'
  try {
    await App.TestBrowserWindow(addForm.id.trim())
    addTestResult.value = 'success'
  } catch {
    addTestResult.value = 'fail'
  } finally {
    addTesting.value = false
  }
}

async function handleAddWindow() {
  if (!addForm.name.trim()) { message.warning('请输入窗口名称'); return }
  if (!addForm.id.trim()) { message.warning('请输入窗口 ID'); return }
  if (addTestResult.value !== 'success') { message.warning('请先测试连接并确保成功'); return }
  addSaving.value = true
  try {
    await App.AddBrowserWindow(addForm.id.trim(), addForm.name.trim())
    message.success('窗口已添加')
    addModalVisible.value = false
    await loadWindows()
  } catch (e: any) {
    message.error(e?.message || '添加失败，请检查窗口 ID 是否正确')
  } finally {
    addSaving.value = false
  }
}

async function testWindowConn(w: BrowserWindow) {
  testingId.value = w.id
  w.conn_status = 'checking'
  try {
    await App.TestBrowserWindow(w.id)
    w.conn_status = 'connected'
    message.success(`#${w.seq} ${w.name} 连接正常`)
  } catch {
    w.conn_status = 'disconnected'
    message.error(`#${w.seq} ${w.name} 连接失败，请确认比特浏览器已运行`)
  } finally {
    testingId.value = ''
  }
}

async function checkWindowLogin(w: BrowserWindow) {
  checkingLoginId.value = w.id
  try {
    const result = await App.CheckWindowLogin(w.id)
    w.login_status = result?.status || 'unknown'
    if (result?.status === 'valid') {
      message.success(`#${w.seq} ${w.name} 抖音登录有效`)
    } else if (result?.status === 'need_verify' || result?.status === 'expired') {
      Modal.warning({
        title: `窗口 #${w.seq} ${w.name} 需要重新验证`,
        content: '抖音登录已失效，请打开对应的比特浏览器窗口，手动完成验证或重新登录后再刷新 Cookie。',
        okText: '知道了',
      })
    } else {
      message.warning(`#${w.seq} ${w.name} 登录状态未知`)
    }
  } catch {
    w.login_status = 'unknown'
    message.error('检测失败，请确认比特浏览器连接正常')
  } finally {
    checkingLoginId.value = ''
  }
}

function startEditName(w: BrowserWindow) {
  editingId.value = w.id
  editingName.value = w.name
}

function cancelEditName() {
  editingId.value = ''
  editingName.value = ''
}

async function saveEditName(w: BrowserWindow) {
  const newName = editingName.value.trim()
  if (!newName) { cancelEditName(); return }
  try {
    await App.UpdateWindowName(w.id, newName)
    w.name = newName
  } catch { message.error('更新失败') }
  editingId.value = ''
}

async function deleteWindow(w: BrowserWindow) {
  Modal.confirm({
    title: `停用窗口 #${w.seq}「${w.name}」？`,
    content: '停用后该窗口不再参与采集和私信发送，但已有数据仍会保留，历史记录不受影响。',
    okText: '确认停用',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      deletingId.value = w.id
      try {
        await App.DeleteBrowserWindow(w.id)
        w.enabled = false
        message.success(`#${w.seq} ${w.name} 已停用`)
      } catch { message.error('操作失败') }
      finally { deletingId.value = '' }
    },
  })
}

// ── Cookie batch refresh ──────────────────────────────────────────────────────
async function refreshAllCookies() {
  const active = activeWindows.value
  if (!active.length) { message.warning('没有可用的活跃窗口'); return }
  refreshingAll.value = true
  refreshResults.value = active.map(w => ({
    id: w.id, name: w.name, seq: w.seq, status: 'idle', message: '',
  }))

  for (const item of refreshResults.value) {
    item.status = 'refreshing'
    try {
      const result = await App.RefreshCookieFromBitBrowser(item.id)
      if (result?.login_invalid) {
        item.status = 'login_invalid'
        item.message = '抖音登录已失效，请手动验证后重试'
        const w = windows.value.find(x => x.id === item.id)
        if (w) w.login_status = 'expired'
      } else {
        item.status = 'success'
        item.message = `Cookie 已更新（${result?.cookie_length || 0} 字符）`
        const w = windows.value.find(x => x.id === item.id)
        if (w) w.cookie_updated_at = result?.updated_at || new Date().toISOString()
      }
    } catch (e: any) {
      item.status = 'fail'
      item.message = e?.message || '提取失败，请检查比特浏览器连接'
    }
  }
  refreshingAll.value = false
}

// ── Save configs ──────────────────────────────────────────────────────────────
async function handleSaveBitConfig() {
  savingBit.value = true
  try {
    await App.SaveBitBrowserConfig({ ...bitConfig, ...signingConfig })
    message.success('配置已保存')
    await checkServices()
  } catch { message.error('保存失败') }
  finally { savingBit.value = false }
}

async function handleSaveGlobal() {
  savingGlobal.value = true
  try {
    await App.SaveGlobalConfig({ ...globalConfig })
    message.success('全局配置已保存')
  } catch { message.error('保存失败') }
  finally { savingGlobal.value = false }
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([checkServices(), loadWindows()])
  try {
    const cfg = await App.GetSystemConfig()
    if (cfg) {
      if (cfg.bit_browser) bitConfig.api_port = cfg.bit_browser.port || 54345
      if (cfg.signing) signingConfig.port = cfg.signing.port || 9527
      if (cfg.global) Object.assign(globalConfig, cfg.global)
    }
  } catch { /* use defaults */ }
})
</script>

<template>
  <div class="page-layout">
    <!-- Title bar -->
    <div class="title-bar">
      <Settings :size="16" color="#00B96B" />
      <span class="title-bar-title">系统设置</span>
      <div style="flex:1" />
      <a-button size="small" @click="checkServices">
        <template #icon><RefreshCw :size="12" /></template>
        刷新服务状态
      </a-button>
    </div>

    <!-- Scrollable body -->
    <div class="settings-body">

      <!-- ── 1. 服务状态 ──────────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Monitor :size="14" color="#595959" />
          服务状态
        </div>
        <div class="service-row">
          <div class="service-item">
            <div class="service-label">
              <Globe :size="14" />
              比特浏览器 API
              <span class="service-port">:{{ bitConfig.api_port }}</span>
            </div>
            <div class="service-status" :class="bitBrowserStatus">
              <span v-if="bitBrowserStatus === 'checking'" class="status-dot" />
              <CheckCircle v-else-if="bitBrowserStatus === 'online'" :size="14" color="#52C41A" />
              <XCircle v-else :size="14" color="#FF4D4F" />
              <span>{{ { checking: '检测中…', online: '运行中', offline: '未运行' }[bitBrowserStatus] }}</span>
            </div>
          </div>
          <div class="service-divider" />
          <div class="service-item">
            <div class="service-label">
              <Zap :size="14" />
              签名服务 (Node.js)
              <span class="service-port">:{{ signingConfig.port }}</span>
            </div>
            <div class="service-status" :class="signingStatus">
              <span v-if="signingStatus === 'checking'" class="status-dot" />
              <CheckCircle v-else-if="signingStatus === 'online'" :size="14" color="#52C41A" />
              <XCircle v-else :size="14" color="#FF4D4F" />
              <span>{{ { checking: '检测中…', online: '运行中', offline: '未运行' }[signingStatus] }}</span>
            </div>
          </div>
          <div class="service-divider" />
          <div v-if="signingStatus === 'offline'" class="service-tip">
            <AlertCircle :size="13" color="#FA8C16" />
            <span>在项目根目录执行 <code>npm run sign</code> 启动签名服务</span>
          </div>
        </div>
      </div>

      <!-- ── 2. 比特浏览器窗口管理 ────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Globe :size="14" color="#595959" />
          比特浏览器窗口管理
          <span class="section-desc">— 窗口与抖音账号绑定，采集和私信均通过窗口执行</span>
          <div style="flex:1" />
          <a-button type="primary" size="small" @click="openAddModal">
            <template #icon><Plus :size="12" /></template>
            添加窗口
          </a-button>
        </div>

        <!-- Empty state -->
        <div v-if="!loadingWindows && windows.length === 0" class="empty-windows">
          <Globe :size="32" color="#D9D9D9" />
          <p>暂无窗口配置，点击「添加窗口」录入比特浏览器窗口 ID</p>
        </div>

        <!-- Loading -->
        <div v-else-if="loadingWindows" class="empty-windows">
          <a-spin />
        </div>

        <!-- Windows table -->
        <div v-else class="windows-table-wrap">
          <table class="windows-table">
            <thead>
              <tr>
                <th class="col-seq">#</th>
                <th class="col-name">窗口名称</th>
                <th class="col-id">窗口 ID</th>
                <th class="col-conn">连接状态</th>
                <th class="col-login">抖音登录</th>
                <th class="col-cookie">Cookie 更新</th>
                <th class="col-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="w in windows"
                :key="w.id"
                :class="{ 'row-disabled': !w.enabled }"
              >
                <!-- # -->
                <td class="col-seq">
                  <span class="seq-badge">#{{ w.seq }}</span>
                </td>

                <!-- 窗口名称 -->
                <td class="col-name">
                  <div v-if="editingId !== w.id" class="name-cell">
                    <span :class="{ 'text-disabled': !w.enabled }">{{ w.name }}</span>
                    <button
                      v-if="w.enabled"
                      class="icon-btn"
                      @click="startEditName(w)"
                      title="重命名"
                    >
                      <Edit3 :size="12" color="#8C8C8C" />
                    </button>
                  </div>
                  <div v-else class="name-edit">
                    <input
                      v-model="editingName"
                      class="name-input"
                      @keyup.enter="saveEditName(w)"
                      @keyup.escape="cancelEditName"
                      autofocus
                    />
                    <button class="icon-btn confirm" @click="saveEditName(w)">
                      <Check :size="12" color="#00B96B" />
                    </button>
                    <button class="icon-btn cancel" @click="cancelEditName">
                      <X :size="12" color="#FF4D4F" />
                    </button>
                  </div>
                </td>

                <!-- 窗口 ID -->
                <td class="col-id">
                  <span
                    class="id-text"
                    :title="w.id"
                    @click="() => { navigator.clipboard?.writeText(w.id); message.info('已复制') }"
                  >{{ truncateId(w.id) }}</span>
                </td>

                <!-- 连接状态 -->
                <td class="col-conn">
                  <span v-if="testingId === w.id" class="status-chip checking">
                    <span class="dot-pulse" />检测中
                  </span>
                  <span v-else-if="w.conn_status === 'connected'" class="status-chip connected">
                    <Wifi :size="11" />已连接
                  </span>
                  <span v-else-if="w.conn_status === 'disconnected'" class="status-chip disconnected">
                    <WifiOff :size="11" />未连接
                  </span>
                  <span v-else class="status-chip unknown">
                    <HelpCircle :size="11" />未测试
                  </span>
                </td>

                <!-- 抖音登录 -->
                <td class="col-login">
                  <span v-if="checkingLoginId === w.id" class="status-chip checking">
                    <span class="dot-pulse" />检测中
                  </span>
                  <span v-else-if="w.login_status === 'valid'" class="status-chip connected">
                    <UserCheck :size="11" />有效
                  </span>
                  <span v-else-if="w.login_status === 'expired'" class="status-chip disconnected">
                    <UserX :size="11" />已失效
                  </span>
                  <span v-else-if="w.login_status === 'need_verify'" class="status-chip warning">
                    <AlertCircle :size="11" />需验证
                  </span>
                  <span v-else class="status-chip unknown">
                    <HelpCircle :size="11" />未检测
                  </span>
                </td>

                <!-- Cookie 更新时间 -->
                <td class="col-cookie">
                  <span class="cookie-time">
                    <Clock :size="11" color="#8C8C8C" style="flex-shrink:0" />
                    {{ formatTime(w.cookie_updated_at) }}
                  </span>
                </td>

                <!-- 操作 -->
                <td class="col-actions">
                  <template v-if="w.enabled">
                    <a-button
                      size="small"
                      :loading="testingId === w.id"
                      @click="testWindowConn(w)"
                    >测试连接</a-button>
                    <a-button
                      size="small"
                      :loading="checkingLoginId === w.id"
                      @click="checkWindowLogin(w)"
                    >检测登录</a-button>
                    <a-button
                      size="small"
                      danger
                      :loading="deletingId === w.id"
                      @click="deleteWindow(w)"
                    >
                      <template #icon><Trash2 :size="11" /></template>
                    </a-button>
                  </template>
                  <span v-else class="disabled-tag">已停用</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── 3. 服务端口配置 ────────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Globe :size="14" color="#595959" />
          服务端口配置
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label">比特浏览器 API 端口</label>
            <div class="form-control">
              <a-input-number
                v-model:value="bitConfig.api_port"
                :min="1024" :max="65535"
                style="width:120px"
              />
              <span class="form-hint">默认 54345，比特浏览器本地监听端口</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">签名服务端口</label>
            <div class="form-control">
              <a-input-number
                v-model:value="signingConfig.port"
                :min="1024" :max="65535"
                style="width:120px"
              />
              <span class="form-hint">默认 9527，Node.js 签名微服务端口（npm run sign）</span>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <a-button type="primary" :loading="savingBit" @click="handleSaveBitConfig">
            <template #icon><Save :size="13" /></template>
            保存配置
          </a-button>
        </div>
      </div>

      <!-- ── 4. Cookie 一键刷新 ────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Key :size="14" color="#595959" />
          Cookie 一键刷新
          <span class="section-desc">— 对所有活跃窗口依次提取最新 Cookie 并同步到签名服务</span>
        </div>

        <div class="cookie-flow">
          <div class="flow-step"><span class="step-num">1</span>打开比特浏览器窗口</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step"><span class="step-num">2</span>CDP 提取 Cookie</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step"><span class="step-num">3</span>验证账号有效性</div>
          <div class="flow-arrow">→</div>
          <div class="flow-step"><span class="step-num">4</span>同步签名服务</div>
        </div>

        <div class="cookie-actions">
          <a-button
            type="primary"
            :loading="refreshingAll"
            :disabled="activeWindows.length === 0"
            @click="refreshAllCookies"
          >
            <template #icon><RefreshCw :size="13" /></template>
            一键刷新所有窗口 Cookie
          </a-button>
          <span v-if="activeWindows.length > 0" class="cookie-count-tip">
            共 {{ activeWindows.length }} 个活跃窗口
          </span>
          <span v-else class="form-hint">请先在上方添加窗口</span>
        </div>

        <!-- Refresh progress -->
        <div v-if="refreshResults.length" class="refresh-list">
          <div
            v-for="item in refreshResults"
            :key="item.id"
            class="refresh-row"
            :class="item.status"
          >
            <span class="refresh-seq">#{{ item.seq }}</span>
            <span class="refresh-name">{{ item.name }}</span>
            <div class="refresh-status">
              <span v-if="item.status === 'idle'" class="text-placeholder">等待中…</span>
              <span v-else-if="item.status === 'refreshing'" class="text-info">
                <span class="dot-pulse" />刷新中…
              </span>
              <span v-else-if="item.status === 'success'" class="text-success">
                <CheckCircle :size="13" />{{ item.message }}
              </span>
              <span v-else-if="item.status === 'login_invalid'" class="text-warning">
                <AlertCircle :size="13" />{{ item.message }}
              </span>
              <span v-else class="text-danger">
                <XCircle :size="13" />{{ item.message }}
              </span>
            </div>
          </div>
        </div>

        <div class="cookie-tip">
          <AlertCircle :size="12" color="#FA8C16" />
          <span>Cookie 通常 24 小时内有效。如遇采集失败或私信发送失败，请先点此刷新 Cookie。若提示登录失效，请打开对应比特浏览器窗口手动验证。</span>
        </div>
      </div>

      <!-- ── 5. 全局参数 ────────────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Settings :size="14" color="#595959" />
          全局参数
        </div>
        <div class="form-grid">
          <div class="form-row">
            <label class="form-label">评论监控间隔</label>
            <div class="form-control">
              <a-input-number
                v-model:value="globalConfig.monitor_interval_sec"
                :min="10" :max="3600"
                addon-after="秒"
                style="width:140px"
              />
              <span class="form-hint">每轮轮询间隔，建议 30~120 秒</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">API 失败重试次数</label>
            <div class="form-control">
              <a-input-number
                v-model:value="globalConfig.monitor_retry_count"
                :min="0" :max="10"
                addon-after="次"
                style="width:140px"
              />
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">评论自动清理</label>
            <div class="form-control">
              <a-input-number
                v-model:value="globalConfig.comment_auto_clean_days"
                :min="0" :max="365"
                addon-after="天"
                style="width:140px"
              />
              <span class="form-hint">0 = 不自动清理</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">自动拉黑阈值</label>
            <div class="form-control">
              <a-input-number
                v-model:value="globalConfig.auto_blacklist_threshold"
                :min="1" :max="100"
                addon-after="次"
                style="width:140px"
              />
              <span class="form-hint">同一用户出现 N 次后自动加入黑名单</span>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">钉钉 Webhook</label>
            <div class="form-control">
              <a-input
                v-model:value="globalConfig.dingtalk_webhook"
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                style="width:420px"
                allow-clear
              />
            </div>
          </div>
        </div>
        <div class="form-actions">
          <a-button type="primary" :loading="savingGlobal" @click="handleSaveGlobal">
            <template #icon><Save :size="13" /></template>
            保存全局配置
          </a-button>
        </div>
      </div>

    </div>
  </div>

  <!-- ── 添加窗口 Modal ──────────────────────────────────────────────────── -->
  <a-modal
    v-model:open="addModalVisible"
    title="添加比特浏览器窗口"
    :footer="null"
    :mask-closable="false"
    width="480px"
  >
    <div class="add-modal-body">
      <div class="add-form-row">
        <label class="add-label">窗口名称 <span class="required">*</span></label>
        <a-input
          v-model:value="addForm.name"
          placeholder="如：主账号、备用号1、矩阵账号A"
          style="width:100%"
          allow-clear
        />
      </div>

      <div class="add-form-row">
        <label class="add-label">窗口 ID <span class="required">*</span></label>
        <a-input
          v-model:value="addForm.id"
          placeholder="比特浏览器 profile_id，如 9023104163bd47ffa784..."
          style="width:100%"
          allow-clear
          @change="addTestResult = 'idle'"
        />
        <div class="add-hint">在比特浏览器 → 我的浏览器 → 对应窗口处查看 ID</div>
      </div>

      <!-- Test connection -->
      <div class="add-test-row">
        <a-button
          :loading="addTesting"
          @click="testAddConnection"
        >
          <template #icon><Wifi :size="13" /></template>
          测试连接
        </a-button>

        <div v-if="addTestResult === 'success'" class="test-result success">
          <CheckCircle :size="14" color="#52C41A" />
          <span>连接成功，可以保存</span>
        </div>
        <div v-else-if="addTestResult === 'fail'" class="test-result fail">
          <XCircle :size="14" color="#FF4D4F" />
          <span>连接失败，请确认比特浏览器已运行且 ID 正确</span>
        </div>
        <div v-else class="test-result idle">
          <HelpCircle :size="14" color="#8C8C8C" />
          <span>请先测试连接</span>
        </div>
      </div>

      <div class="add-modal-footer">
        <a-button @click="addModalVisible = false">取消</a-button>
        <a-button
          type="primary"
          :loading="addSaving"
          :disabled="addTestResult !== 'success'"
          @click="handleAddWindow"
        >
          <template #icon><Plus :size="13" /></template>
          保存窗口
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.page-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-page-bg);
  overflow: hidden;
}

.title-bar {
  height: 52px;
  background: #fff;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  flex-shrink: 0;
}

.title-bar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Section Card ── */
.section-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  padding: 16px 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 14px;
}

.section-desc {
  font-weight: 400;
  color: var(--color-text-placeholder);
  font-size: 12px;
}

/* ── Service Status ── */
.service-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: 8px;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.service-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.service-port {
  font-size: 11px;
  color: var(--color-text-placeholder);
  font-family: monospace;
}

.service-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
}
.service-status.online { color: #52C41A; }
.service-status.offline { color: #FF4D4F; }
.service-status.checking { color: #8C8C8C; }

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8C8C8C;
  animation: pulse 1s infinite;
  display: inline-block;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.service-divider {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  margin: 0 20px;
}

.service-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #FA8C16;
}

.service-tip code {
  background: #FFF7E6;
  border: 1px solid #FFD591;
  border-radius: 3px;
  padding: 1px 5px;
  font-family: monospace;
  font-size: 11px;
}

/* ── Windows Table ── */
.empty-windows {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  gap: 10px;
  color: var(--color-text-placeholder);
  font-size: 13px;
}

.windows-table-wrap {
  overflow-x: auto;
}

.windows-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.windows-table th {
  background: #FAFAFA;
  color: var(--color-text-secondary);
  font-weight: 600;
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.windows-table td {
  padding: 9px 10px;
  border-bottom: 1px solid #F5F5F5;
  vertical-align: middle;
}

.windows-table tr:last-child td { border-bottom: none; }

.row-disabled td { opacity: 0.45; }

.col-seq { width: 44px; }
.col-name { width: 140px; }
.col-id { width: 180px; }
.col-conn { width: 96px; }
.col-login { width: 96px; }
.col-cookie { width: 110px; }
.col-actions { width: 180px; }

.seq-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  background: #F5F5F5;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary);
  font-family: monospace;
}

/* Name cell */
.name-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.text-disabled { color: var(--color-text-placeholder); }

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.name-cell:hover .icon-btn { opacity: 1; }
.name-edit { display: flex; align-items: center; gap: 3px; }

.name-input {
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  outline: none;
  width: 100px;
}

/* ID cell */
.id-text {
  font-family: monospace;
  font-size: 11px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
}
.id-text:hover { background: #F5F5F5; }

/* Status chips */
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.status-chip.connected { background: #F6FFED; color: #52C41A; }
.status-chip.disconnected { background: #FFF1F0; color: #FF4D4F; }
.status-chip.checking { background: #F5F5F5; color: #8C8C8C; }
.status-chip.warning { background: #FFF7E6; color: #FA8C16; }
.status-chip.unknown { background: #FAFAFA; color: #8C8C8C; border: 1px solid #F0F0F0; }

.dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1s infinite;
  display: inline-block;
}

/* Cookie time */
.cookie-time {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text-placeholder);
  font-size: 11px;
}

/* Actions */
.col-actions .ant-btn + .ant-btn { margin-left: 4px; }
.disabled-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: #F5F5F5;
  color: #8C8C8C;
  border-radius: 4px;
  font-size: 11px;
}

/* ── Form ── */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.form-label {
  width: 130px;
  font-size: 13px;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.form-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-placeholder);
}

.form-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #F0F0F0;
  display: flex;
  gap: 8px;
}

/* ── Cookie section ── */
.cookie-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 6px;
}

.flow-step {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.step-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flow-arrow { color: #D9D9D9; font-size: 14px; }

.cookie-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 0;
}

.cookie-count-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Refresh list */
.refresh-list {
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.refresh-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid #F5F5F5;
  font-size: 12px;
}
.refresh-row:last-child { border-bottom: none; }
.refresh-row.success { background: #FAFFFE; }
.refresh-row.fail { background: #FFF9F9; }
.refresh-row.login_invalid { background: #FFFBF0; }

.refresh-seq {
  width: 28px;
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.refresh-name {
  width: 100px;
  font-weight: 500;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.refresh-status {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
}

.text-placeholder { color: var(--color-text-placeholder); }
.text-info { color: #1677FF; display: flex; align-items: center; gap: 5px; }
.text-success { color: #52C41A; display: flex; align-items: center; gap: 5px; }
.text-warning { color: #FA8C16; display: flex; align-items: center; gap: 5px; }
.text-danger { color: #FF4D4F; display: flex; align-items: center; gap: 5px; }

.cookie-tip {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-top: 12px;
  line-height: 1.5;
}

/* ── Add Modal ── */
.add-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.add-form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.required { color: #FF4D4F; }

.add-hint {
  font-size: 11px;
  color: var(--color-text-placeholder);
}

.add-test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #FAFAFA;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.test-result {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.test-result.success { color: #52C41A; }
.test-result.fail { color: #FF4D4F; }
.test-result.idle { color: #8C8C8C; }

.add-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #F0F0F0;
}
</style>
