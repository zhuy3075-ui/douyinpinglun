# CLAUDE.md — 抖音截流私信获客系统

> 本文件是项目上下文文档，Claude Code 每次对话均自动加载。开发前必读。

---

## 项目概览

**产品名称**：抖音截流私信获客系统
**当前阶段**：POC / 研发中
**目标平台**：Windows 10/11 (64位) 桌面应用
**技术栈**：Wails v2（Go 后端 + Vue3 前端）
**核心功能**：评论监控 → 用户识别 → 自动私信转化

---

## 技术架构

```
前端（Vue3 + TypeScript）
  └── Wails IPC (window.go.*)
后端（Go）
  ├── 评论监控引擎   goroutine 并发轮询
  ├── 视频采集引擎   worker pool，带优先级队列
  ├── 私信发送引擎   生产者-消费者，多 worker
  ├── 账号管理       比特浏览器 CDP 集成
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
├── PRD.md                     # 产品需求文档 v1.4
├── README.md                  # 项目说明
├── signing_server.js          # Node.js a_bogus 签名微服务 (port 9527)
├── package.json               # Node 依赖 (playwright)
├── go-backend/                # Go 后端（Wails app 根目录待建）
│   ├── go.mod                 # module: douyin-monitor, go 1.26
│   └── internal/
│       └── signer/            # 签名服务客户端
├── frontend/                  # Vue3 前端（待建）
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   ├── components/        # 公共组件
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
**UI 库**：Ant Design Vue 3.x

### 页面路由（Vue Router）

| 路径 | 组件 | 页面名 |
|------|------|--------|
| `/` | `CommentMonitor.vue` | 评论监控 |
| `/collect/manual` | `VideoCollectManual.vue` | 视频采集-手动搜索 |
| `/collect/auto` | `VideoCollectAuto.vue` | 视频采集-自动采集 |
| `/dm` | `AutoDM.vue` | 自动私信 |
| `/logs` | `Logs.vue` | 日志记录 |

### 布局规则

- 全局侧边栏（200px 宽）：4个导航项，激活状态用 Primary 色
- 全局标题栏（52px 高）：Logo + 页面名 + 功能操作按钮
- 主内容区：`calc(100vh - 52px)`，`overflow: auto`
- 面板：`border-radius: 8px`，`padding: 16px`，白底 + `#E8E8E8` 边框

---

## 后端规范

### Wails 绑定方法命名（Go → JS）

所有暴露给前端的 Go 方法放在 `app.go` 的 `App` struct 中：

```
// 评论监控
StartMonitor() error
StopMonitor() error
GetMonitorStatus() MonitorStatus
GetVideos() []MonitorVideo
AddVideo(url string) error
DeleteVideo(videoId string) error

// 视频采集
SearchVideos(keyword, sortType, publishTime, duration string, count int) []VideoSearchResult
StartAutoCollect() error
StopAutoCollect() error
GetKeywords() []KeywordConfig
AddKeyword(config KeywordConfig) error
UpdateKeyword(config KeywordConfig) error
DeleteKeyword(id string) error
GetCollectHistory() []CollectHistory

// 私信发送
StartDMEngine() error
StopDMEngine() error
GetDMStatus() DMStatus
GetAccounts() []BrowserProfile
AddAccount(profileId string) error
ExtractAccountInfo(profileId string) error
TestSendDM(profileId, targetUID string) error
GetDMTasks() []DMTask
GetDMConfig() DMConfig
SaveDMConfig(config DMConfig) error

// 日志
GetLogs(level, keyword string, limit int) []LogEntry
ClearLogs() error
ExportLogs(path string) error
```

### Wails Events（后端 → 前端推送）

```
monitor:status-change    // 监控状态变更
monitor:new-comments     // 新评论数组
collect:progress         // 采集进度
collect:status-change    // 采集引擎状态
dm:task-update           // 任务状态变更
dm:stats-update          // 今日统计更新
log:new-entry            // 新日志条目
cookie:expired           // Cookie 过期告警
```

---

## 数据模型（关键字段）

### MonitorVideo
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
}
```

### Comment
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
  dm_status: 'pending' | 'sent' | 'failed' | 'skip' | 'blocked'
}
```

### BrowserProfile
```typescript
interface BrowserProfile {
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

### DMConfig
```typescript
interface DMConfig {
  template_path: string
  min_interval_sec: number   // 最小发送间隔（秒），默认 60
  daily_limit_per_account: number  // 单账号日限，默认 100
  daily_limit_total: number        // 总日限，默认 500
  concurrency: number              // 并发线程，默认 3
  auto_add_to_monitor: boolean
  new_video_only: boolean
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

### Cookie 刷新流程（§16 / §10.5）
1. 调用 `POST http://127.0.0.1:54345/browser/open` 打开比特浏览器窗口
2. 通过 CDP ws 连接 → 提取 `sessionid` / `sessionid_ss`
3. 用 IM user info API 验证 Cookie 有效性
4. 写入 `data/cookies/{profile_id}.enc`（AES-256-GCM 加密）
5. 通知签名服务更新 Cookie
6. Wails Event 推送前端更新状态

### 私信发送流程（POC 阶段）
- 依赖 Node.js 签名服务（port 9527）提供 `a_bogus` 签名
- 当前 IM Protobuf 发送链路**未验证**，UI 流程正常展示，后端实现为 stub
- 连续失败 ≥3 次的账号自动暂停

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

### 当前已知限制（POC）
- IM 发送链路未验证 → `TestSendDM` 为 stub，返回 mock 成功
- SQLite 迁移脚本待建
- 比特浏览器 Cookie 提取依赖本地安装 BitBrowser

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
