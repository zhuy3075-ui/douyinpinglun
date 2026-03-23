// Mock Wails bindings — replaced by real auto-generated file at build time

const delay = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms))

// ─── Comment Monitor ───────────────────────────────────────────────────────

export async function StartMonitor() {
  await delay()
  return null
}

export async function StopMonitor() {
  await delay()
  return null
}

export async function GetMonitorStatus() {
  await delay()
  return {
    running: true,
    current_round: 12,
    new_comments_this_round: 7,
    total_comments: 1842,
  }
}

export async function GetVideos() {
  await delay()
  return [
    {
      video_id: 'v001',
      title: '2024秋冬穿搭合集｜显高显瘦的搭配技巧分享',
      author_nickname: '时尚博主小美',
      cover_url: '',
      like_count: 48320,
      comment_count: 2156,
      status: 'active',
      total_comments_collected: 1240,
      last_check_at: '2024-01-15 14:32:00',
      added_at: '2024-01-10 09:00:00',
      source_keyword: '穿搭技巧',
    },
    {
      video_id: 'v002',
      title: '【探店】北京最火网红火锅店，排队2小时值得吗？',
      author_nickname: '吃货探店达人',
      cover_url: '',
      like_count: 23100,
      comment_count: 987,
      status: 'active',
      total_comments_collected: 654,
      last_check_at: '2024-01-15 14:28:00',
      added_at: '2024-01-11 11:00:00',
      source_keyword: '美食推荐',
    },
    {
      video_id: 'v003',
      title: '零基础学编程！Python入门30天打卡挑战',
      author_nickname: '程序员老陈',
      cover_url: '',
      like_count: 15600,
      comment_count: 432,
      status: 'paused',
      total_comments_collected: 210,
      last_check_at: '2024-01-14 20:00:00',
      added_at: '2024-01-12 08:30:00',
      source_keyword: undefined,
    },
  ]
}

export async function AddVideo(url) {
  await delay(500)
  return null
}

export async function DeleteVideo(videoId) {
  await delay()
  return null
}

export async function SetCommentFilter(filter) {
  await delay()
  return null
}

export async function GetComments(videoId, mode) {
  await delay()
  return [
    {
      comment_id: 'c001',
      video_id: videoId || 'v001',
      level: 1,
      uid: '7234891023456',
      sec_uid: 'MS4wLjABAAAAabc123',
      nickname: '爱买衣服的小林',
      content: '姐姐这套搭配太好看了！请问上衣是哪个品牌的？',
      region: '上海',
      like_count: 42,
      created_at: 1705282800,
      dm_status: 'pending',
    },
    {
      comment_id: 'c002',
      video_id: videoId || 'v001',
      level: 1,
      uid: '8901234567890',
      sec_uid: 'MS4wLjABAAAAdef456',
      nickname: '穿搭爱好者小云',
      content: '这个颜色搭配真的绝，收藏了下次去买！',
      region: '广州',
      like_count: 18,
      created_at: 1705279200,
      dm_status: 'sent',
    },
    {
      comment_id: 'c003',
      video_id: videoId || 'v001',
      level: 2,
      uid: '6678901234567',
      sec_uid: 'MS4wLjABAAAAghi789',
      nickname: '时髦辣妹Jane',
      content: '同问！我找了好久了，颜色好正',
      region: '北京',
      like_count: 5,
      created_at: 1705275600,
      dm_status: 'failed',
    },
    {
      comment_id: 'c004',
      video_id: videoId || 'v001',
      level: 1,
      uid: '5567890123456',
      sec_uid: 'MS4wLjABAAAAjkl012',
      nickname: '职场OL阿芳',
      content: '好看！博主身材也太好了，这裤子腿感绝了',
      region: '深圳',
      like_count: 33,
      created_at: 1705272000,
      dm_status: 'skip',
    },
    {
      comment_id: 'c005',
      video_id: videoId || 'v001',
      level: 1,
      uid: '4456789012345',
      sec_uid: 'MS4wLjABAAAAmno345',
      nickname: '时尚辣妈小红',
      content: '求链接！！已关注博主，等新视频',
      region: '杭州',
      like_count: 27,
      created_at: 1705268400,
      dm_status: 'blocked',
    },
  ]
}

// ─── Video Collect ─────────────────────────────────────────────────────────

export async function SearchVideos(keyword, sortType, publishTime, duration, count) {
  await delay(800)
  return [
    {
      video_id: 's001',
      title: '秋冬穿搭技巧，5套通勤look让你气质翻倍',
      author_nickname: '穿搭博主晓晓',
      cover_url: '',
      like_count: 62300,
      comment_count: 3200,
      published_at: '2024-01-14',
      source_keyword: keyword || '穿搭技巧',
      already_added: false,
    },
    {
      video_id: 's002',
      title: '显瘦穿搭公式！梨形身材必看的搭配指南',
      author_nickname: '时尚生活家阿米',
      cover_url: '',
      like_count: 45800,
      comment_count: 2140,
      published_at: '2024-01-13',
      source_keyword: keyword || '穿搭技巧',
      already_added: true,
    },
    {
      video_id: 's003',
      title: '今年流行什么颜色？时尚圈最新穿搭趋势分析',
      author_nickname: '时尚观察员Mark',
      cover_url: '',
      like_count: 31200,
      comment_count: 1560,
      published_at: '2024-01-12',
      source_keyword: keyword || '穿搭技巧',
      already_added: false,
    },
  ]
}

export async function StartAutoCollect() {
  await delay()
  return null
}

export async function StopAutoCollect() {
  await delay()
  return null
}

export async function GetKeywords() {
  await delay()
  return [
    {
      id: 'k001',
      keyword: '穿搭技巧',
      enabled: true,
      priority: 5,
      search_time_range: '7天内',
      count_per_run: 50,
      stats: { total_collected: 342, total_monitored: 28 },
      last_run_at: '2024-01-15 14:00:00',
      created_at: '2024-01-01 09:00:00',
    },
    {
      id: 'k002',
      keyword: '美食推荐',
      enabled: false,
      priority: 3,
      search_time_range: '3天内',
      count_per_run: 30,
      stats: { total_collected: 178, total_monitored: 15 },
      last_run_at: '2024-01-14 10:00:00',
      created_at: '2024-01-02 10:00:00',
    },
    {
      id: 'k003',
      keyword: '健身教程',
      enabled: true,
      priority: 4,
      search_time_range: '30天内',
      count_per_run: 40,
      stats: { total_collected: 256, total_monitored: 22 },
      last_run_at: '2024-01-15 12:00:00',
      created_at: '2024-01-03 11:00:00',
    },
    {
      id: 'k004',
      keyword: '护肤分享',
      enabled: true,
      priority: 5,
      search_time_range: '7天内',
      count_per_run: 60,
      stats: { total_collected: 412, total_monitored: 35 },
      last_run_at: '2024-01-15 13:30:00',
      created_at: '2024-01-04 08:00:00',
    },
    {
      id: 'k005',
      keyword: '母婴好物',
      enabled: false,
      priority: 2,
      search_time_range: '不限',
      count_per_run: 20,
      stats: { total_collected: 89, total_monitored: 7 },
      last_run_at: '2024-01-10 15:00:00',
      created_at: '2024-01-05 14:00:00',
    },
    {
      id: 'k006',
      keyword: '数码评测',
      enabled: true,
      priority: 3,
      search_time_range: '30天内',
      count_per_run: 25,
      stats: { total_collected: 133, total_monitored: 11 },
      last_run_at: '2024-01-15 11:00:00',
      created_at: '2024-01-06 16:00:00',
    },
  ]
}

export async function AddKeyword(config) {
  await delay()
  return null
}

export async function UpdateKeyword(config) {
  await delay()
  return null
}

export async function DeleteKeyword(id) {
  await delay()
  return null
}

export async function GetCollectHistory() {
  await delay()
  return [
    {
      id: 'h001',
      keyword_id: 'k001',
      keyword: '穿搭技巧',
      started_at: '2024-01-15 14:00:00',
      finished_at: '2024-01-15 14:02:18',
      duration_sec: 138,
      collected: 50,
      filtered_out: 12,
      added: 8,
      status: 'success',
      error_msg: '',
    },
    {
      id: 'h002',
      keyword_id: 'k004',
      keyword: '护肤分享',
      started_at: '2024-01-15 13:30:00',
      finished_at: '2024-01-15 13:32:45',
      duration_sec: 165,
      collected: 60,
      filtered_out: 20,
      added: 15,
      status: 'success',
      error_msg: '',
    },
    {
      id: 'h003',
      keyword_id: 'k002',
      keyword: '美食推荐',
      started_at: '2024-01-14 10:00:00',
      finished_at: '2024-01-14 10:01:30',
      duration_sec: 90,
      collected: 0,
      filtered_out: 0,
      added: 0,
      status: 'failed',
      error_msg: '签名服务连接超时',
    },
  ]
}

export async function GetAutoCollectConfig() {
  await delay()
  return {
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
  }
}

export async function SaveAutoCollectConfig(config) {
  await delay()
  return null
}

// ─── DM Engine ─────────────────────────────────────────────────────────────

export async function StartDMEngine() {
  await delay()
  return null
}

export async function StopDMEngine() {
  await delay()
  return null
}

export async function GetDMStatus() {
  await delay()
  return {
    engine_running: true,
    today_success: 2,
    today_failed: 0,
  }
}

export async function GetAccounts() {
  await delay()
  return [
    {
      profile_id: 'p001',
      display_name: '营销号A',
      douyin_uid: '7234891023456',
      nickname: '时尚好物推荐官',
      cookie_status: 'valid',
      cookie_updated_at: '2024-01-15 10:00:00',
      test_passed: true,
      enabled: true,
      daily_dm_sent: 23,
      daily_dm_limit: 100,
      consecutive_failures: 0,
    },
    {
      profile_id: 'p002',
      display_name: '营销号B',
      douyin_uid: '8901234567890',
      nickname: '每日穿搭灵感',
      cookie_status: 'expired',
      cookie_updated_at: '2024-01-10 08:00:00',
      test_passed: false,
      enabled: false,
      daily_dm_sent: 0,
      daily_dm_limit: 100,
      consecutive_failures: 3,
    },
  ]
}

export async function AddAccount(profileId) {
  await delay()
  return null
}

export async function DeleteAccount(profileId) {
  await delay()
  return null
}

export async function ExtractAccountInfo(profileId) {
  await delay(1000)
  return null
}

export async function TestSendDM(profileId, targetUID) {
  await delay(1500)
  return null
}

export async function GetDMTasks() {
  await delay()
  return [
    {
      task_id: 't001',
      target_uid: '7234891023456',
      target_nickname: '爱买衣服的小林',
      source_video_id: 'v001',
      template_content: '你好！看到你对穿搭很感兴趣，我们有专业的穿搭顾问为你服务～',
      executed_profile_id: 'p001',
      status: 'success',
      error_msg: '',
      retry_count: 0,
      created_at: '2024-01-15 14:35:00',
      sent_at: '2024-01-15 14:35:42',
    },
    {
      task_id: 't002',
      target_uid: '8901234567890',
      target_nickname: '穿搭爱好者小云',
      source_video_id: 'v001',
      template_content: '你好！看到你对穿搭很感兴趣，我们有专业的穿搭顾问为你服务～',
      executed_profile_id: 'p001',
      status: 'success',
      error_msg: '',
      retry_count: 0,
      created_at: '2024-01-15 14:36:00',
      sent_at: '2024-01-15 14:36:58',
    },
    {
      task_id: 't003',
      target_uid: '6678901234567',
      target_nickname: '时髦辣妹Jane',
      source_video_id: 'v001',
      template_content: '你好！看到你对穿搭很感兴趣，我们有专业的穿搭顾问为你服务～',
      executed_profile_id: '',
      status: 'pending',
      error_msg: '',
      retry_count: 0,
      created_at: '2024-01-15 14:37:00',
      sent_at: '',
    },
    {
      task_id: 't004',
      target_uid: '5567890123456',
      target_nickname: '职场OL阿芳',
      source_video_id: 'v002',
      template_content: '你好！看到你对穿搭很感兴趣，我们有专业的穿搭顾问为你服务～',
      executed_profile_id: '',
      status: 'pending',
      error_msg: '',
      retry_count: 0,
      created_at: '2024-01-15 14:38:00',
      sent_at: '',
    },
    {
      task_id: 't005',
      target_uid: '4456789012345',
      target_nickname: '时尚辣妈小红',
      source_video_id: 'v002',
      template_content: '你好！看到你对穿搭很感兴趣，我们有专业的穿搭顾问为你服务～',
      executed_profile_id: '',
      status: 'pending',
      error_msg: '',
      retry_count: 0,
      created_at: '2024-01-15 14:39:00',
      sent_at: '',
    },
  ]
}

export async function GetDMConfig() {
  await delay()
  return {
    template_path: 'C:\\Users\\43841\\Documents\\dm_template.txt',
    min_interval_sec: 60,
    daily_limit_per_account: 100,
    daily_limit_total: 500,
    concurrency: 3,
    auto_add_to_monitor: true,
    new_video_only: false,
  }
}

export async function SaveDMConfig(config) {
  await delay()
  return null
}

// ─── Logs ──────────────────────────────────────────────────────────────────

export async function GetLogs(level, keyword, limit) {
  await delay()
  return [
    {
      id: 'l001',
      level: 'INFO',
      message: '监控引擎已启动，当前监控视频数：3',
      created_at: '2024-01-15 14:30:00',
    },
    {
      id: 'l002',
      level: 'INFO',
      message: '第12轮评论采集完成，新增评论：7条，耗时：2.3s',
      created_at: '2024-01-15 14:32:18',
    },
    {
      id: 'l003',
      level: 'INFO',
      message: '私信发送成功: 目标用户 爱买衣服的小林 (UID: 7234891023456)',
      created_at: '2024-01-15 14:35:42',
    },
    {
      id: 'l004',
      level: 'WARN',
      message: 'Cookie 即将过期: 营销号B (profile_id: p002)，请及时更新',
      created_at: '2024-01-15 14:36:00',
    },
    {
      id: 'l005',
      level: 'ERROR',
      message: '视频采集失败: 关键词"美食推荐" — 签名服务连接超时 (timeout after 10s)',
      created_at: '2024-01-15 14:38:05',
    },
    {
      id: 'l006',
      level: 'DEBUG',
      message: 'API请求: GET /aweme/v1/web/comment/list/ video_id=v001 cursor=0 count=20',
      created_at: '2024-01-15 14:39:12',
    },
    {
      id: 'l007',
      level: 'INFO',
      message: '视频采集完成: 关键词"穿搭技巧" 采集50条，过滤12条，新增8条到监控列表',
      created_at: '2024-01-15 14:02:18',
    },
    {
      id: 'l008',
      level: 'WARN',
      message: '账号 营销号A 今日私信已发送 23 条，距日限 100 条还剩 77 条',
      created_at: '2024-01-15 14:36:58',
    },
  ]
}

export async function ClearLogs() {
  await delay()
  return null
}

export async function ExportLogs(path) {
  await delay(500)
  return null
}

// ─── System Settings ────────────────────────────────────────────────────────

export async function CheckBitBrowserStatus() {
  await delay(400)
  // Simulate: try to reach localhost:54345
  return { online: false }
}

export async function CheckSigningServiceStatus() {
  await delay(300)
  // Simulate: try to reach localhost:9527
  return { online: false }
}

export async function RefreshCookieFromBitBrowser(browserId) {
  await delay(2000)
  // Simulate successful cookie extraction
  return {
    browser_id: browserId,
    cookie_length: 8421,
    updated_at: new Date().toLocaleString('zh-CN'),
  }
}

export async function GetSystemConfig() {
  await delay()
  return {
    bit_browser: { api_port: 54345, default_browser_id: '' },
    signing: { port: 9527 },
    global: {
      monitor_interval_sec: 60,
      monitor_retry_count: 3,
      comment_auto_clean_days: 7,
      auto_blacklist_threshold: 5,
      dingtalk_webhook: '',
    },
    cookie_store: {
      browser_id: '',
      cookie_length: 0,
      updated_at: '',
    },
  }
}

export async function SaveBitBrowserConfig(config) {
  await delay()
  return null
}

export async function SaveGlobalConfig(config) {
  await delay()
  return null
}

export async function LoginBitBrowserWindow(profileId) {
  await delay(800)
  // Calls POST http://127.0.0.1:54345/browser/open {"id": profileId}
  return { ws: 'ws://127.0.0.1:9222/devtools/browser/mock' }
}
