<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
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
} from 'lucide-vue-next'
import { message } from 'ant-design-vue'
import * as App from '../wailsjs/go/main/App'

// ── 服务状态 ──────────────────────────────────────────────────────────────
const bitBrowserStatus = ref<'checking' | 'online' | 'offline'>('checking')
const signingStatus = ref<'checking' | 'online' | 'offline'>('checking')
const refreshingCookie = ref(false)
const savingGlobal = ref(false)
const savingBit = ref(false)

// ── 比特浏览器配置 ────────────────────────────────────────────────────────
const bitConfig = reactive({
  api_port: 54345,
  default_browser_id: '',
})

// ── 签名服务配置 ──────────────────────────────────────────────────────────
const signingConfig = reactive({
  port: 9527,
})

// ── Cookie 刷新 ───────────────────────────────────────────────────────────
const cookieState = reactive({
  browser_id: '',
  last_updated: '',
  cookie_length: 0,
  status: '' as '' | 'success' | 'error',
  message: '',
})

// ── 全局参数 ──────────────────────────────────────────────────────────────
const globalConfig = reactive({
  monitor_interval_sec: 60,
  monitor_retry_count: 3,
  comment_auto_clean_days: 7,
  auto_blacklist_threshold: 5,
  dingtalk_webhook: '',
})

async function checkServices() {
  bitBrowserStatus.value = 'checking'
  signingStatus.value = 'checking'
  try {
    const r = await App.CheckBitBrowserStatus()
    bitBrowserStatus.value = r?.online ? 'online' : 'offline'
  } catch {
    bitBrowserStatus.value = 'offline'
  }
  try {
    const r = await App.CheckSigningServiceStatus()
    signingStatus.value = r?.online ? 'online' : 'offline'
  } catch {
    signingStatus.value = 'offline'
  }
}

async function handleRefreshCookie() {
  if (!cookieState.browser_id.trim()) {
    message.warning('请输入比特浏览器窗口 ID')
    return
  }
  refreshingCookie.value = true
  cookieState.status = ''
  cookieState.message = ''
  try {
    const result = await App.RefreshCookieFromBitBrowser(cookieState.browser_id.trim())
    cookieState.status = 'success'
    cookieState.last_updated = result?.updated_at || new Date().toLocaleString()
    cookieState.cookie_length = result?.cookie_length || 0
    cookieState.message = `Cookie 提取成功，长度 ${cookieState.cookie_length} 字符，签名服务已同步`
    message.success('Cookie 已刷新')
  } catch (e: any) {
    cookieState.status = 'error'
    cookieState.message = e?.message || '提取失败，请确认比特浏览器已运行且窗口ID正确'
    message.error(cookieState.message)
  } finally {
    refreshingCookie.value = false
  }
}

async function handleSaveBitConfig() {
  savingBit.value = true
  try {
    await App.SaveBitBrowserConfig({ ...bitConfig, ...signingConfig })
    message.success('配置已保存')
    await checkServices()
  } catch {
    message.error('保存失败')
  } finally {
    savingBit.value = false
  }
}

async function handleSaveGlobal() {
  savingGlobal.value = true
  try {
    await App.SaveGlobalConfig({ ...globalConfig })
    message.success('全局配置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    savingGlobal.value = false
  }
}

onMounted(async () => {
  await checkServices()
  try {
    const cfg = await App.GetSystemConfig()
    if (cfg) {
      Object.assign(bitConfig, cfg.bit_browser || {})
      Object.assign(signingConfig, cfg.signing || {})
      Object.assign(globalConfig, cfg.global || {})
      if (cfg.cookie_store) {
        cookieState.browser_id = cfg.cookie_store.browser_id || ''
        cookieState.last_updated = cfg.cookie_store.updated_at || ''
        cookieState.cookie_length = cfg.cookie_store.cookie_length || 0
      }
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

      <!-- ── 服务状态卡片 ─────────────────────────────────────────────────── -->
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
              <span v-if="bitBrowserStatus === 'checking'" class="status-dot checking" />
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
              <span v-if="signingStatus === 'checking'" class="status-dot checking" />
              <CheckCircle v-else-if="signingStatus === 'online'" :size="14" color="#52C41A" />
              <XCircle v-else :size="14" color="#FF4D4F" />
              <span>{{ { checking: '检测中…', online: '运行中', offline: '未运行' }[signingStatus] }}</span>
            </div>
          </div>
          <div class="service-divider" />
          <div class="service-tip" v-if="signingStatus === 'offline'">
            <AlertCircle :size="13" color="#FA8C16" />
            <span>在项目根目录执行 <code>npm run sign</code> 启动签名服务</span>
          </div>
        </div>
      </div>

      <!-- ── 比特浏览器配置 ──────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Globe :size="14" color="#595959" />
          比特浏览器 &amp; 签名服务配置
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
          <div class="form-row">
            <label class="form-label">默认窗口 ID</label>
            <div class="form-control">
              <a-input
                v-model:value="bitConfig.default_browser_id"
                placeholder="粘贴比特浏览器 profile_id（选填，自动填充到 Cookie 刷新）"
                style="width:360px"
                allow-clear
              />
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

      <!-- ── Cookie 一键刷新 ─────────────────────────────────────────────── -->
      <div class="section-card">
        <div class="section-title">
          <Key :size="14" color="#595959" />
          Cookie 一键刷新
          <span class="section-desc">— 从比特浏览器窗口提取最新 Cookie 并同步到签名服务</span>
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

        <div class="form-row" style="margin-top:12px">
          <label class="form-label">窗口 ID</label>
          <div class="form-control gap-8">
            <a-input
              v-model:value="cookieState.browser_id"
              placeholder="比特浏览器 profile_id，如 9023104163bd47ffa78466d1944d0338"
              style="width:360px"
              allow-clear
            />
            <a-button
              type="primary"
              :loading="refreshingCookie"
              @click="handleRefreshCookie"
            >
              <template #icon><RefreshCw :size="13" /></template>
              一键刷新 Cookie
            </a-button>
          </div>
        </div>

        <!-- 状态提示 -->
        <div v-if="cookieState.status" class="cookie-result" :class="cookieState.status">
          <CheckCircle v-if="cookieState.status === 'success'" :size="14" />
          <XCircle v-else :size="14" />
          <span>{{ cookieState.message }}</span>
          <span v-if="cookieState.last_updated" class="result-time">
            更新于 {{ cookieState.last_updated }}
          </span>
        </div>
        <div v-else-if="cookieState.last_updated" class="cookie-result last">
          <CheckCircle :size="14" color="#8C8C8C" />
          <span>上次更新：{{ cookieState.last_updated }}（Cookie 长度 {{ cookieState.cookie_length }} 字符）</span>
        </div>

        <div class="cookie-tip">
          <AlertCircle :size="12" color="#FA8C16" />
          <span>Cookie 通常 24 小时内有效。如遇采集失败或私信发送失败，请先点此刷新 Cookie。</span>
        </div>
      </div>

      <!-- ── 全局参数配置 ────────────────────────────────────────────────── -->
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
  gap: 0;
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
  width: 120px;
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

.form-control.gap-8 { gap: 8px; }

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

/* ── Cookie Flow ── */
.cookie-flow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 0 6px;
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

.flow-arrow {
  color: #D9D9D9;
  font-size: 14px;
}

/* Cookie result */
.cookie-result {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  margin-top: 10px;
}
.cookie-result.success { background: #F6FFED; color: #52C41A; border: 1px solid #B7EB8F; }
.cookie-result.error   { background: #FFF1F0; color: #FF4D4F; border: 1px solid #FFA39E; }
.cookie-result.last    { background: #FAFAFA; color: var(--color-text-placeholder); border: 1px solid #F0F0F0; }

.result-time {
  margin-left: auto;
  opacity: 0.7;
}

.cookie-tip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-top: 10px;
}
</style>
