# CLAUDE.md — 抖音截流私信获客系统

> 本文件是项目上下文文档，Claude Code 每次对话均自动加载。开发前必读。
> 当前版本：v2.2（含窗口管理重构、登录检测、Cookie批量刷新、软删除、数据清空）

---

## 项目概览

**产品名称**：抖音截流私信获客系统
**当前阶段**：POC / 研发中
**目标平台**：Windows 10/11 (64位) 桌面应用
**技术栈**：Wails v2（Go 后端 + Vue3 前端）
**核心功能**：评论监控 → 关键词触发 → 用户审核 → 自动私信转化

---

## 技术架构

```
前端（Vue3 + TypeScript）
  └── Wails IPC (window.go.*)
后端（Go）
  ├── 评论监控引擎   goroutine 并发轮询
  ├── 视频采集引擎   worker pool，带优先级队列
  ├── 私信发送引擎   生产者-消费者，多 worker，随机间隔
  ├── 触发词引擎     精确/模糊/语义匹配，词典扩展
  ├── 审核队列       pending_review → approved → sending
  ├── 账号管理       比特浏览器 CDP 集成，窗口序号绑定
  └── 数据层         SQLite (data/app.db) + AES-256-GCM 加密
外部依赖
  ├── 比特浏览器 API  http://127.0.0.1:54345  (多账号管理)
  ├── Node.js 签名服务  http://127.0.0.1:9527  (a_bogus 签名)
  └── 抖音 Web API    需 Cookie + a_bogus 签名
```

---

## 目录结构

```
.
├── CLAUDE.md                  # 本文件
├── PRD.md                     # 产品需求文档 v2.1
├── README.md                  # 项目说明
├── signing_server.js          # Node.js a_bogus 签名微服务 (port 9527)
├── package.json               # Node 依赖 (playwright)
├── go-backend/                # Go 后端（Wails app 根目录待建）
│   ├── go.mod                 # module: douyin-monitor, go 1.26
│   └── internal/
│       └── signer/            # 签名服务客户端
├── frontend/                  # Vue3 前端
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 公共组件（StartupCheck.vue 等）
│   │   ├── stores/            # Pinia stores
│   │   ├── types/             # TypeScript 类型
│   │   └── wailsjs/           # Wails 自动生成的绑定
│   └── ...
├── data/                      # 运行时数据（gitignore）
│   ├── app.db                 # SQLite 主数据库
│   ├── config.json            # 全局配置
│   └── cookies/               # 加密 Cookie 文件
├── docs/
│   ├── UI_SPEC.md             # UI 设计规范（1200×700px）
│   ├── api_research.md        # 抖音 API 研究
│   └── im_report.md          # IM 发送协议研究
└── ui-exports/                # Pencil 导出的 UI 截图
    ├── bi8Au.png              # P1 评论监控
    ├── vuiew.png              # P2 视频采集-手动搜索
    ├── xuwpc.png              # P3 视频采集-自动采集
    ├── uiSsB.png              # P4 自动私信
    └── gsVeZ.png              # P5 日志记录
```

---

## 前端规范

### 设计系统

| Token | 值 |
|-------|----|
| Primary | `#00B96B` |
| Danger  | `#FF4D4F` |
| Info    | `#1677FF` |
| Warning | `#FA8C16` |
| Page BG | `#F5F5F5` |
| Panel BG | `#FFFFFF` |
| Border  | `#E8E8E8` |
| Text Primary | `#1A1A1A` |
| Text Secondary | `#595959` |
| Text Placeholder | `#8C8C8C` |

**窗口尺寸**：1200 × 700px（固定，无需响应式）
**字体**：Inter（英文数字），系统 UI 字体（中文）
**图标库**：Lucide Vue Next
**UI 库**：Ant Design Vue 4.x

### 页面路由（Vue Router）

| 路径 | 组件 | 页面名 |
|------|------|--------|
| `/` | `CommentMonitor.vue` | 评论监控 |
| `/collect/manual` | `VideoCollectManual.vue` | 视频采集-手动搜索 |
| `/collect/auto` | `VideoCollectAuto.vue` | 视频采集-自动采集 |
| `/dm` | `AutoDM.vue` | 自动私信 |
| `/logs` | `Logs.vue` | 日志记录 |
| `/settings` | `Settings.vue` | 系统设置 |

### 布局规则

- 全局侧边栏（200px 宽）：5个导航项，激活状态用 Primary 色
- 主内容区：`flex: 1`，`height: 700px`，`overflow: hidden`
- 面板：`border-radius: 8px`，`padding: 16px`，白底 + `#E8E8E8` 边框

### 分页规范（v2.1）

所有表格使用 `<a-pagination>` 组件，不显示页码跳转输入框：
- 视频监控列表：每页 **8 条**（行高 52px，含缩略图）
- 评论列表：每页 **11 条**（行高 40px）
- 搜索结果视频：每页 **9 条**（行高 52px）
- 采集历史：每页 **8 条**（行高 40px）
- 待审核 / 发送队列：每页 **9 条**（行高 44px）
- 账号列表：每页 **6 条**（行高 48px）
- 私信日志：每页 **11 条**（行高 40px）

### 数据导出规范（v2.1）

所有列表标题栏右侧放「↓ 导出」按钮，点击弹出：
```
[CSV 文件]  [TXT 文件]     [取消]
```
调用 `App.ExportData(type, format, filters)` → 后端写文件 → 系统文件保存对话框。

---

## 后端规范

### Wails 绑定方法命名（Go → JS）

```
// 评论监控
StartMonitor() error
StopMonitor() error
GetMonitorStatus() MonitorStatus
GetVideos(page, pageSize int) PagedResult[MonitorVideo]
AddVideo(url string, profileId string) error          // v2.0: 必须指定绑定窗口
DeleteVideo(videoId string) error
ExportVideos(format string) string                    // v2.1: 导出，返回文件路径

// 评论
GetComments(videoId string, page, pageSize int) PagedResult[Comment]
ExportComments(videoId string, format string) string  // v2.1

// 视频采集
SearchVideos(keyword, sortType, publishTime, duration string, count int) []VideoSearchResult
StartAutoCollect() error
StopAutoCollect() error
GetKeywords() []KeywordConfig
AddKeyword(config KeywordConfig) error
UpdateKeyword(config KeywordConfig) error
DeleteKeyword(id string) error
GetCollectHistory(page, pageSize int) PagedResult[CollectHistory]
ExportCollectHistory(format string) string            // v2.1

// 比特浏览器窗口管理（v2.2 新增，Settings 页面核心）
GetBrowserWindows() []BrowserWindow
AddBrowserWindow(profileId, name string) error        // 仅在 TestBrowserWindow 通过后调用
TestBrowserWindow(profileId string) map                // 验证 BitBrowser API 连接，返回 {online}
CheckWindowLogin(profileId string) map                 // CDP 验证抖音 Cookie，返回 {status, message}
UpdateWindowName(profileId, name string) error         // 内联重命名
DeleteBrowserWindow(profileId string) error            // 软删除，enabled=false

// 私信账号（从 BrowserWindow 动态派生）
GetAccounts(page, pageSize int) PagedResult[BrowserProfile]
AddAccount(profileId string) error
ExtractAccountInfo(profileId string) error
TestSendDM(profileId, targetUID string) error
DeleteAccount(profileId string) error
ExportAccounts(format string) string
LoginBitBrowserWindow(profileId string) error
GetStartupCheckResult() []StartupCheckItem            // 读取 browserWindows，检测所有 enabled 窗口

// 私信触发词（v2.0 新增）
GetDMKeywords() []DMKeywordRule
AddDMKeyword(rule DMKeywordRule) error
UpdateDMKeyword(rule DMKeywordRule) error
DeleteDMKeyword(id string) error

// 私信审核（v2.1 新增）
GetPendingReviews(page, pageSize int) PagedResult[DMTask]
ApproveDMTasks(taskIds []string) error
SkipDMTasks(taskIds []string) error
ExportPendingReviews(format string) string

// 私信发送
StartDMEngine() error
StopDMEngine() error
GetDMStatus() DMStatus
GetDMTasks(status string, page, pageSize int) PagedResult[DMTask]
GetDMConfig() DMConfig
SaveDMConfig(config DMConfig) error
ExportDMTasks(status string, format string) string    // v2.1

// 私信日志（v2.0 新增）
GetDMSendLogs(profileId, status string, page, pageSize int) PagedResult[DMSendLog]
ExportDMSendLogs(format string) string

// 系统配置
CheckBitBrowserStatus() ServiceStatus
CheckSigningServiceStatus() ServiceStatus
RefreshCookieFromBitBrowser(browserId string) CookieRefreshResult
GetSystemConfig() SystemConfig
SaveBitBrowserConfig(config BitBrowserConfig) error
SaveGlobalConfig(config GlobalConfig) error

// 数据导出通用
ExportData(dataType, format string, filters map[string]string) string

// 日志
GetLogs(level, keyword string, page, pageSize int) PagedResult[LogEntry]
ClearLogs() error
ExportLogs(format string) string
```

### Wails Events（后端 → 前端推送）

```
monitor:status-change    // 监控状态变更
monitor:new-comments     // 新评论数组（payload: Comment[]）
collect:progress         // 采集进度
collect:status-change    // 采集引擎状态
dm:task-update           // 任务状态变更（payload: DMTask）
dm:stats-update          // 今日统计更新（payload: DMStats）
dm:review-new            // 新待审核任务（payload: DMTask，v2.1）
log:new-entry            // 新系统日志条目
dm:send-log              // 新私信发送日志（payload: DMSendLog，v2.0）
cookie:expired           // Cookie 过期告警（payload: profile_id）
```

---

## 数据模型（关键字段）

### MonitorVideo（v2.0 更新）
```typescript
interface MonitorVideo {
  video_id: string
  title: string
  author_nickname: string
  cover_url: string
  like_count: number
  comment_count: number
  status: 'active' | 'paused'
  total_comments_collected: number
  last_check_at: string
  added_at: string
  source_keyword?: string
  bound_profile_id: string   // v2.0: 绑定的比特浏览器窗口 ID
  bound_seq: number          // v2.0: 绑定窗口序号
}
```

### Comment（v2.1 更新）
```typescript
interface Comment {
  comment_id: string
  video_id: string
  level: 1 | 2
  uid: string
  sec_uid: string
  nickname: string
  content: string
  region: string
  like_count: number
  created_at: number  // Unix timestamp
  dm_status: 'pending_review' | 'approved' | 'sending' | 'sent' | 'failed' | 'skip' | 'blocked'
}
```

### BrowserWindow（v2.2 新增，Settings 页主数据模型）
```typescript
interface BrowserWindow {
  id: string                 // 比特浏览器 profile_id
  name: string               // 用户自定义窗口名称
  seq: number                // 自动递增序号 #1/#2…
  conn_status: 'connected' | 'disconnected' | 'checking' | 'unknown'
  login_status: 'valid' | 'expired' | 'need_verify' | 'unknown'
  cookie_updated_at: string  // 最近成功刷新 Cookie 的时间
  enabled: boolean           // false = 已停用（软删除）
  created_at: string
}
```

### BrowserProfile（v2.0，由 BrowserWindow 动态派生）
```typescript
interface BrowserProfile {
  seq: number                // 窗口序号 #1/#2...
  profile_id: string
  display_name: string
  douyin_uid: string
  nickname: string
  cookie_status: 'valid' | 'expired' | 'unknown' | 'unverified'
  cookie_updated_at: string
  test_passed: boolean
  enabled: boolean
  daily_dm_sent: number
  daily_dm_limit: number
  consecutive_failures: number
}
```

### DMConfig（v2.0 更新）
```typescript
interface DMConfig {
  template_path: string
  min_interval_sec: number         // v2.0: 随机间隔下限，默认 60
  max_interval_sec: number         // v2.0: 随机间隔上限，默认 180
  daily_limit_per_account: number  // 单账号日限，默认 100
  daily_limit_total: number        // 总日限，默认 500
  concurrency: number              // 并发线程，默认 3
  auto_add_to_monitor: boolean
  new_video_only: boolean
  full_send_mode: boolean          // v2.0: true=全量发送，false=仅匹配触发词
}
```

### DMKeywordRule（v2.0 新增）
```typescript
interface DMKeywordRule {
  id: string
  keyword: string
  match_type: 'exact' | 'fuzzy' | 'semantic'
  category?: 'purchase_intent' | 'price_inquiry' | 'contact_request' | 'channel_source' | 'custom'
  enabled: boolean
  hit_count: number
  created_at: string
}
```

### DMTask（v2.1 更新）
```typescript
interface DMTask {
  task_id: string
  target_uid: string
  target_nickname: string
  target_sec_uid: string
  source_video_id: string
  source_video_title: string
  source_comment_content: string   // v2.1: 原始评论内容
  trigger_keyword: string          // v2.1: 命中的触发词
  message_preview: string          // v2.1: 变量替换后私信预览
  executed_profile_id: string
  executed_seq: number             // v2.0: 执行账号序号
  status: 'pending_review' | 'approved' | 'sending' | 'sent' | 'failed' | 'skip' | 'blocked'
  error_msg: string
  retry_count: number
  created_at: string
  sent_at: string
}
```

### DMSendLog（v2.0 新增）
```typescript
interface DMSendLog {
  id: string
  sent_at: string
  window_seq: number
  profile_id: string
  sender_nickname: string
  target_uid: string
  target_nickname: string
  source_video_id: string
  source_video_title: string
  comment_content: string
  trigger_keyword: string
  message_content: string
  status: 'sent' | 'failed' | 'rate_limited'
  error_msg: string
}
```

### PagedResult（通用分页容器）
```typescript
interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
```

### StartupCheckItem（v2.0 新增）
```typescript
interface StartupCheckItem {
  seq: number
  profile_id: string
  nickname: string
  cookie_status: 'valid' | 'expired' | 'unknown'
  message: string
}
```

### LogEntry
```typescript
interface LogEntry {
  id: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
  created_at: string  // ISO 8601
}
```

---

## 关键业务规则

### 窗口-视频-私信绑定关系（v2.0）
- 每个监控视频绑定一个比特浏览器窗口（`bound_profile_id`）
- DM 引擎发送时：评论 → `video.bound_profile_id` → 使用该账号发私信
- 不同视频可绑定不同窗口；一个窗口可被多个视频绑定
- 视频列表和私信日志都显示窗口序号（#1/#2...）

### 私信审核流程（v2.1）
1. 评论被采集 → 与触发词引擎匹配
2. 命中 → 生成 DMTask（`status: pending_review`）
3. 未命中 + 全量模式关闭 → 丢弃
4. 未命中 + 全量模式开启 → 生成低优先级 DMTask（`status: pending_review`）
5. 用户在「待审核」Tab 审核 → 批量通过（`approved`）或跳过（`skip`）
6. `approved` 的任务进入发送队列，引擎按随机间隔执行

### 随机间隔发送（v2.0）
- 实际间隔 = `rand(min_interval_sec, max_interval_sec)`（均匀随机）
- min 不可大于 max；UI 步进器步长 10 秒

### Cookie 批量刷新流程（v2.2 升级）
- 入口：Settings 页 → Cookie 一键刷新 → 「一键刷新所有窗口 Cookie」
- 对所有 `enabled=true` 的窗口依次执行：
  1. 调用 `POST http://127.0.0.1:54345/browser/open` 打开比特浏览器窗口
  2. 通过 CDP ws 连接 → 提取 `sessionid` / `sessionid_ss`
  3. 用 IM user info API 验证 Cookie 有效性
- 登录失效（`login_invalid: true`）时：前端显示橙色警告，提示用户手动验证
- 原单窗口输入ID刷新方式已废弃

### 窗口管理业务规则（v2.2 新增）
- 用户必须在 Settings 先添加并测试连接，才能在其他页面使用该窗口
- 添加流程：输入名称+ID → 测试连接通过 → 保存（保存按钮在测试前禁用）
- 停用（软删除）：`enabled=false`，历史数据保留，下拉选择器中不再显示
- `GetAccounts` 从内存中的 `browserWindows` 动态派生，Settings 配置立即同步到其他页面

### Cookie 刷新流程（§16 / §10.5，单窗口）
4. 写入 `data/cookies/{profile_id}.enc`（AES-256-GCM 加密）
5. 通知签名服务更新 Cookie
6. Wails Event 推送前端更新状态

### 私信发送流程（POC 阶段）
- 依赖 Node.js 签名服务（port 9527）提供 `a_bogus` 签名
- 当前 IM Protobuf 发送链路**未验证**，UI 流程正常展示，后端实现为 stub
- 连续失败 ≥3 次的账号自动暂停
- 每次发送后写入 `dm_send_logs` 表

### 软件启动检测（v2.0）
- `App.vue` `onMounted` 调用 `GetStartupCheckResult()`
- 读取所有 `enabled=true` 的 `BrowserWindow`，展示其 `login_status`
- 结果以 `StartupCheck.vue` 模态弹窗展示
- 若无已注册窗口：弹窗提示「请前往设置添加比特浏览器窗口」
- 过期账号显示红色 ❌，提供"前往设置"快捷跳转

### 评论监控引擎
- 每个视频一个独立 goroutine，channel 传递结果
- 轮询间隔：30~120 秒可配置
- CID 去重，防止重复采集
- 采集字段：1级评论 + 2级回复（不采集3级）

### 视频采集过滤逻辑
- 点赞数范围：`min_likes ≤ like_count ≤ max_likes`（0 = 不限）
- 评论数范围：同上
- 发布时长：`hours_since_published ≤ max_age_hours`（0 = 不限）
- 已在监控列表的视频：`new_video_only=true` 时跳过

---

## 开发注意事项

### 不要做的事
- 不要在前端硬编码抖音 API URL（由 Go 后端调用）
- 不要在前端存储 Cookie 或账号凭证（由 Go AES 加密存储）
- 不要修改 `signing_server.js`（独立 Node.js 进程，不属于 Wails app）
- 不要为私信发送实现真实的 Protobuf 序列化（POC 阶段，用 stub）

### 必须做的事
- 所有 Wails 绑定调用需要 `try/catch` 错误处理
- 评论流使用 Wails Events 实时推送，不要轮询
- 日志条目通过 Event 追加到列表，不要全量刷新
- 表格超出高度时内部滚动（`overflow-y: auto`）
- 分页组件统一使用 `<a-pagination>` 不显示 `showSizeChanger` 和 `showQuickJumper`
- 所有导出调用后端 `ExportData`，不要在前端拼接文件内容

### 当前已知限制（POC）
- IM 发送链路未验证 → `TestSendDM` 为 stub，返回 mock 成功
- SQLite 迁移脚本待建
- 比特浏览器 Cookie 提取依赖本地安装 BitBrowser
- 语义匹配使用词典扩展实现，非 NLP embedding

---

## UI 参考图

所有界面截图见 `ui-exports/` 目录：

| 文件 | 页面 |
|------|------|
| `bi8Au.png` | 评论监控主页面 |
| `vuiew.png` | 视频采集-手动搜索 |
| `xuwpc.png` | 视频采集-自动采集 |
| `uiSsB.png` | 自动私信 |
| `gsVeZ.png` | 日志记录 |

原始 Pencil 设计文件：`pencil-new.pen`（需 Pencil MCP 插件打开）
