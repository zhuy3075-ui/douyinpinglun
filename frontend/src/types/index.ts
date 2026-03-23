export type DMStatusValue = 'pending_review' | 'approved' | 'sending' | 'sent' | 'failed' | 'skip' | 'blocked'

export interface MonitorVideo {
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
  bound_profile_id: string   // v2.0
  bound_seq: number          // v2.0
}

export interface Comment {
  comment_id: string
  video_id: string
  level: 1 | 2
  uid: string
  sec_uid: string
  nickname: string
  content: string
  region: string
  like_count: number
  created_at: number
  dm_status: DMStatusValue
}

export interface BrowserProfile {
  seq: number                // v2.0: 窗口序号
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

export interface DMConfig {
  template_path: string
  min_interval_sec: number         // v2.0: 随机间隔下限
  max_interval_sec: number         // v2.0: 随机间隔上限
  daily_limit_per_account: number
  daily_limit_total: number
  concurrency: number
  auto_add_to_monitor: boolean
  new_video_only: boolean
  full_send_mode: boolean          // v2.0: 全量模式
}

export interface DMKeywordRule {   // v2.0 新增
  id: string
  keyword: string
  match_type: 'exact' | 'fuzzy' | 'semantic'
  category?: 'purchase_intent' | 'price_inquiry' | 'contact_request' | 'channel_source' | 'custom'
  enabled: boolean
  hit_count: number
  created_at: string
}

export interface DMTask {
  task_id: string
  target_uid: string
  target_nickname: string
  target_sec_uid: string
  source_video_id: string
  source_video_title: string
  source_comment_content: string   // v2.1
  trigger_keyword: string          // v2.1
  message_preview: string          // v2.1: 变量替换后私信预览
  executed_profile_id: string
  executed_seq: number             // v2.0
  status: DMStatusValue
  error_msg: string
  retry_count: number
  created_at: string
  sent_at: string
}

export interface DMSendLog {       // v2.0 新增
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

export interface PagedResult<T> {  // v2.1 通用分页容器
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface StartupCheckItem { // v2.0 新增
  seq: number
  profile_id: string
  nickname: string
  cookie_status: 'valid' | 'expired' | 'unknown'
  message: string
}

export interface KeywordConfig {
  id: string
  keyword: string
  enabled: boolean
  priority: number
  search_time_range: string
  count_per_run: number
  stats: {
    total_collected: number
    total_monitored: number
  }
  last_run_at: string
  created_at: string
}

export interface CollectHistory {
  id: string
  keyword_id: string
  keyword: string
  started_at: string
  finished_at: string
  duration_sec: number
  collected: number
  filtered_out: number
  added: number
  status: 'success' | 'failed'
  error_msg: string
}

export interface LogEntry {
  id: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  message: string
  created_at: string
}

export interface DMStatus {
  engine_running: boolean
  today_success: number
  today_failed: number
  pending_review_count: number   // v2.1
}

export interface MonitorStatus {
  running: boolean
  current_round: number
  new_comments_this_round: number
  total_comments: number
}

export interface VideoSearchResult {
  video_id: string
  title: string
  author_nickname: string
  cover_url: string
  like_count: number
  comment_count: number
  published_at: string
  source_keyword: string
  already_added: boolean
}

export interface AutoCollectConfig {
  interval_sec: number
  concurrency: number
  auto_add_to_monitor: boolean
  new_video_only: boolean
  min_likes: number
  max_likes: number
  min_comments: number
  max_comments: number
  exclude_authors: string
  include_authors: string
}

export interface AutoCollectStatus {
  running: boolean
  next_collect_in_sec: number
  current_round_videos: number
  total_monitored: number
}
