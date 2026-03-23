# 抖音 API 逆向研究报告

> 通过 Playwright 抓包分析，整理三大核心接口

---

## 一、评论监控接口

### 1.1 获取评论列表

```
GET https://www-hj.douyin.com/aweme/v1/web/comment/list/
```

**必要 Query 参数：**

| 参数 | 值/说明 |
|------|---------|
| `device_platform` | `webapp` |
| `aid` | `6383` |
| `channel` | `channel_pc_web` |
| `aweme_id` | 视频ID（必填） |
| `cursor` | 分页游标，初始为 `0` |
| `count` | 每页数量，建议 `10` |
| `item_type` | `0` |
| `version_code` | `170400` |
| `version_name` | `17.4.0` |
| `webid` | 设备ID（从登录cookie中提取） |
| `msToken` | 动态令牌（必填，每次请求不同） |
| `a_bogus` | 签名（必填，JS生成，见下方说明） |
| `verifyFp` | 指纹（从cookie中提取） |
| `fp` | 同 verifyFp |

**固定设备参数（可复用）：**
```
pc_client_type=1&pc_libra_divert=Windows&support_h265=1&support_dash=1
&cpu_core_num=18&cookie_enabled=true&screen_width=1920&screen_height=1080
&browser_language=zh-CN&browser_platform=Win32&browser_name=Chrome
&browser_version=132.0.0.0&browser_online=true&engine_name=Blink
&os_name=Windows&os_version=10&device_memory=8&platform=PC
&downlink=10&effective_type=4g&round_trip_time=50
```

**必要请求头：**
```
cookie: [登录后的完整cookie]
user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36
referer: https://www.douyin.com/
origin: https://www.douyin.com
```

**响应结构：**
```json
{
  "status_code": 0,
  "comments": [...],
  "cursor": 10,
  "has_more": 1,
  "total": 1725
}
```

**单条评论字段：**
```json
{
  "cid": "评论唯一ID",
  "text": "评论内容",
  "aweme_id": "视频ID",
  "create_time": 1234567890,
  "digg_count": 点赞数,
  "ip_label": "广东",
  "user": {
    "uid": "用户ID",
    "nickname": "昵称",
    "sec_uid": "安全uid",
    "avatar_thumb": {...}
  },
  "reply_comment_total": 回复数,
  "status": 1
}
```

### 1.2 获取评论回复

```
GET https://www-hj.douyin.com/aweme/v1/web/comment/list/reply/
```

**参数：**
- `item_id`: 视频ID
- `comment_id`: 父评论CID
- `cursor`: 分页游标
- `count`: 每页数量（建议3）
- 其余设备参数同上

---

## 二、视频搜索接口

### 2.1 关键词搜索视频（主接口）

```
GET https://www.douyin.com/aweme/v1/web/search/item/
```

**关键参数：**

| 参数 | 值/说明 |
|------|---------|
| `keyword` | 搜索关键词（必填） |
| `offset` | 分页偏移，初始 `0`，每次 +20 |
| `count` | 每页数量，建议 `20` |
| `search_channel` | `aweme_video_web` |
| `search_source` | `normal_search` 或 `switch_tab` |
| `enable_history` | `1` |
| `is_filter_search` | `0`（无筛选）或 `1`（有筛选） |
| `msToken` | 动态令牌 |
| `a_bogus` | 签名 |

**响应结构：**
```json
{
  "status_code": 0,
  "aweme_list": [
    {
      "type": 1,
      "aweme_info": {
        "aweme_id": "视频ID",
        "desc": "视频标题",
        "create_time": 时间戳,
        "author": {
          "uid": "作者UID",
          "nickname": "作者昵称",
          "sec_uid": "安全uid"
        },
        "statistics": {
          "digg_count": 点赞数,
          "comment_count": 评论数,
          "share_count": 分享数
        }
      }
    }
  ],
  "has_more": 1,
  "cursor": 20
}
```

### 2.2 综合搜索流接口（含视频+用户+话题）

```
GET https://www.douyin.com/aweme/v1/web/general/search/stream/
```

参数基本同上，`search_channel=aweme_general`

---

## 三、私信发送接口

### ⚠️ 重要发现

**私信发送使用 Protobuf 协议，不是 JSON！**

```
POST https://imapi.douyin.com/v1/message/send
Content-Type: application/x-protobuf
```

**URL 参数：**
```
verifyFp=xxx&fp=xxx&msToken=xxx&a_bogus=xxx
```

**请求体结构（Protobuf 解码后）：**
- 协议版本: `1.1.3`
- 消息Hash: `hash.Glwv4lWnsIBa5LCA2NsCqJX4IkOMC+emldHitDzyt5I=`
- 对话ID（to_user_id/conversation_id）
- 消息内容 JSON: `{"mention_users":[],"aweType":700,"richTextInfos":[],"text":"消息内容"}`
- `client_message_id`: UUID
- `stime`: 毫秒时间戳
- `identity_security_token`: 安全令牌（见下）
- `app_name`: `douyin_pc`
- 设备信息

**identity_security_token 获取：**
```
POST https://www-hj.douyin.com/aweme/v1/web/...  (需要进一步探测)
```
Token 格式示例：
```json
{"token":"Cj1l2sevc30Ch0XbAN..."}
```

**关键挑战：**
1. `a_bogus` 是 JS 动态计算的签名，需要在 Node.js 环境执行 JS 生成
2. `msToken` 需要从会话维护
3. 私信协议是 Protobuf，需要定义 `.proto` schema

---

## 四、认证体系分析

### 核心凭证字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `cookie` | 登录后浏览器 | 含 `sessionid`、`ttwid`、`msToken` 等 |
| `msToken` | cookie 中提取 / 动态刷新 | 短期令牌，每次请求携带 |
| `a_bogus` | JS 动态生成 | 请求签名，每次不同，无法静态生成 |
| `verifyFp` / `fp` | cookie 中 | 设备指纹，相对稳定 |
| `webid` | cookie 中 | 设备唯一ID |
| `uifid` | cookie 中 | 用户设备绑定ID |
| `identity_security_token` | IM 相关接口返回 | 私信发送时需要 |

### a_bogus 签名问题（最大挑战）

`a_bogus` 是抖音 Web 端的请求签名参数，由 JS 混淆代码生成。

**实现方案：**

**方案A（推荐）：Go + Node.js 桥接**
- Go 程序通过 `exec.Command` 调用本地 Node.js 脚本
- Node.js 脚本加载抖音 JS SDK 生成 `a_bogus`
- 性能开销：每次签名约 5~20ms

**方案B：内嵌 V8（goja）**
- 使用 Go 的 JS 引擎库 `github.com/dop251/goja`
- 直接在 Go 进程内执行抖音 JS 签名代码
- 无需外部依赖，推荐生产环境使用

**方案C：比特浏览器代理（原版方案）**
- 通过比特浏览器（Chromium 内核）执行 JS
- 最稳定，自动处理所有签名逻辑
- 需要本地安装比特浏览器

---

## 五、实现路线建议

### 阶段一：验证可行性
1. 用 Go `net/http` 携带抓取的 cookie 手动请求评论接口
2. 确认 `a_bogus` 参与验证的程度（部分接口可能可以不带）

### 阶段二：评论监控
1. 实现 cookie 管理模块（从 Playwright session 导出）
2. 实现 `a_bogus` 签名模块（goja 方案）
3. 实现评论轮询引擎

### 阶段三：私信发送
1. 逆向 Protobuf schema
2. 实现 `identity_security_token` 获取
3. 实现私信发送

---

## 六、IM 接口完整清单（imapi.douyin.com）

### 认证方式

> ⚠️ **矛盾说明（2026-03-23）**：本文档在两处对 IM 认证方式有不同描述，以下是当前已知情况的澄清：
>
> - **已知**：`imapi.douyin.com` POST 请求头部确实不含 `a_bogus` 参数（从抓包 `captured_im.json` 确认）
> - **已知**：`/v1/message/send` 的 Protobuf 体中包含 `identity_security_token` 字段（从抓包体结构分析）
> - **未知**：`identity_security_token` 的具体获取接口和获取时机（见第七节）
> - **结论**：IM 读取类接口（会话列表/消息历史）可能只需 cookie；**发送类接口**需要额外的 `identity_security_token`，该 token 如何获取是 Phase 3 的前置技术闸门

**已确认的认证方式（读取接口）**：

```
POST https://imapi.douyin.com/v1/xxx
Content-Type: application/x-protobuf
Cookie: [登录后完整 cookie]
```

**私信发送接口的额外依赖（待验证）**：
- `identity_security_token`：从某个 IM 初始化接口返回，具体接口待探测

### Protobuf 公共头结构（所有接口通用）
```
版本: "1.1.3"
device_id: "8aa2dcb:Detached:8aa2dcb88b41538885168e4afbbd2b6bac8aefb2"
app_name: "douyin_pc"
session_aid: "6383"
session_did: "0"
priority_region: "cn"
user_agent: "Mozilla/5.0 ..."
```

### 接口列表

| 接口 | 说明 |
|------|------|
| `POST /v1/conversation/list` | 获取全部会话列表 |
| `POST /v1/stranger/get_conversation_list` | 获取陌生人会话列表 |
| `POST /v1/message/get_message_by_init` | 消息初始化（首次拉取） |
| `POST /v1/message/get_user_message` | 获取与指定用户的消息历史 |
| `POST /v1/client/unread_count` | 获取未读消息数 |
| `POST /v1/message/send` | **发送私信**（核心接口） |

### 辅助接口（www-hj.douyin.com）

| 接口 | 说明 |
|------|------|
| `POST /aweme/v1/web/im/user/info/` | 获取 IM 用户信息（昵称、头像等） |
| `GET /aweme/v1/web/im/spotlight/relation/` | 关注关系查询 |
| `GET /aweme/v1/web/im/user/active/update/` | 心跳保活 |

### 发送私信接口（已逆向）

```
POST https://imapi.douyin.com/v1/message/send
```

消息内容 JSON（嵌在 Protobuf 中）：
```json
{"mention_users":[],"aweType":700,"richTextInfos":[],"text":"消息内容"}
```

关键字段：
- `client_message_id`: UUID（每次唯一）
- `stime`: 毫秒时间戳
- `identity_security_token`: `{"token":"..."}`（从 IM 初始化接口获取）

## 七、下一步需要抓包的接口

| 接口 | 用途 | 如何触发 |
|------|------|---------|
| `identity_security_token` 获取接口 | 私信发送前获取安全令牌 | 待探测 |
| 会话列表接口 | 获取私信对话列表 | 进入消息中心 |
| 用户信息接口（通过UID查询） | 根据评论UID查用户信息 | 点击评论者头像 |
| `msToken` 刷新接口 | 保持 token 有效 | 自动轮询 |
