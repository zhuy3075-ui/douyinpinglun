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
  dm_status: 'pending' | 'sent' | 'failed' | 'skip' | 'blocked'
}

export interface BrowserProfile {
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
  min_interval_sec: number
  daily_limit_per_account: number
  daily_limit_total: number
  concurrency: number
  auto_add_to_monitor: boolean
  new_video_only: boolean
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

export interface DMTask {
  task_id: string
  target_uid: string
  target_nickname: string
  source_video_id: string
  template_content: string
  executed_profile_id: string
  status: 'pending' | 'sending' | 'success' | 'failed' | 'blocked'
  error_msg: string
  retry_count: number
  created_at: string
  sent_at: string
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
