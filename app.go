package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the main application struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// ─── Common types ────────────────────────────────────────────────────────────

type PagedResult struct {
	Items    interface{} `json:"items"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

type ServiceStatus struct {
	Online bool `json:"online"`
}

// ─── Monitor Video ───────────────────────────────────────────────────────────

type MonitorVideo struct {
	VideoID                string `json:"video_id"`
	Title                  string `json:"title"`
	AuthorNickname         string `json:"author_nickname"`
	CoverURL               string `json:"cover_url"`
	LikeCount              int    `json:"like_count"`
	CommentCount           int    `json:"comment_count"`
	Status                 string `json:"status"`
	TotalCommentsCollected int    `json:"total_comments_collected"`
	LastCheckAt            string `json:"last_check_at"`
	AddedAt                string `json:"added_at"`
	SourceKeyword          string `json:"source_keyword"`
	BoundProfileID         string `json:"bound_profile_id"`
	BoundSeq               int    `json:"bound_seq"`
}

func (a *App) GetVideos(page, pageSize int) map[string]interface{} {
	videos := []MonitorVideo{}
	return map[string]interface{}{
		"items":     videos,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) AddVideo(url string, profileID string) error {
	runtime.LogInfo(a.ctx, fmt.Sprintf("AddVideo: %s bound to %s", url, profileID))
	return nil
}

func (a *App) DeleteVideo(videoID string) error {
	return nil
}

func (a *App) StartMonitor() error {
	runtime.EventsEmit(a.ctx, "monitor:status-change", map[string]interface{}{"running": true})
	return nil
}

func (a *App) StopMonitor() error {
	runtime.EventsEmit(a.ctx, "monitor:status-change", map[string]interface{}{"running": false})
	return nil
}

func (a *App) GetMonitorStatus() map[string]interface{} {
	return map[string]interface{}{
		"running":                   false,
		"current_round":             0,
		"new_comments_this_round":   0,
		"total_comments":            0,
	}
}

// ─── Comments ────────────────────────────────────────────────────────────────

type Comment struct {
	CommentID string `json:"comment_id"`
	VideoID   string `json:"video_id"`
	Level     int    `json:"level"`
	UID       string `json:"uid"`
	SecUID    string `json:"sec_uid"`
	Nickname  string `json:"nickname"`
	Content   string `json:"content"`
	Region    string `json:"region"`
	LikeCount int    `json:"like_count"`
	CreatedAt int64  `json:"created_at"`
	DMStatus  string `json:"dm_status"`
}

func (a *App) GetComments(videoID string, page, pageSize int) map[string]interface{} {
	comments := []Comment{}
	return map[string]interface{}{
		"items":     comments,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) ExportVideos(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/videos_export.%s", format)
}

func (a *App) ExportComments(videoID, format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/comments_%s.%s", videoID, format)
}

// ─── Browser Windows ─────────────────────────────────────────────────────────

type BrowserWindow struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Seq             int    `json:"seq"`
	ConnStatus      string `json:"conn_status"`
	LoginStatus     string `json:"login_status"`
	CookieUpdatedAt string `json:"cookie_updated_at"`
	Enabled         bool   `json:"enabled"`
	CreatedAt       string `json:"created_at"`
}

// In-memory store for demo; production uses SQLite
var browserWindows []BrowserWindow

func (a *App) GetBrowserWindows() []BrowserWindow {
	if browserWindows == nil {
		return []BrowserWindow{}
	}
	return browserWindows
}

func (a *App) AddBrowserWindow(profileID, name string) error {
	seq := len(browserWindows) + 1
	for _, w := range browserWindows {
		if w.Seq >= seq {
			seq = w.Seq + 1
		}
	}
	browserWindows = append(browserWindows, BrowserWindow{
		ID:          profileID,
		Name:        name,
		Seq:         seq,
		ConnStatus:  "connected",
		LoginStatus: "unknown",
		Enabled:     true,
		CreatedAt:   time.Now().Format(time.RFC3339),
	})
	runtime.LogInfo(a.ctx, fmt.Sprintf("Added browser window #%d: %s (%s)", seq, name, profileID))
	return nil
}

func (a *App) TestBrowserWindow(profileID string) map[string]interface{} {
	// Stub: in production, call BitBrowser API GET /browser/list and verify window exists
	runtime.LogInfo(a.ctx, fmt.Sprintf("TestBrowserWindow: %s", profileID))
	return map[string]interface{}{"online": true}
}

func (a *App) CheckWindowLogin(profileID string) map[string]interface{} {
	// Stub (POC): assumes login is valid when BitBrowser window is reachable.
	// Production: open CDP WS → read sessionid/sessionid_ss cookies → call Douyin IM user info API to verify.
	runtime.LogInfo(a.ctx, fmt.Sprintf("CheckWindowLogin: %s", profileID))
	// Update the in-memory window state
	for i := range browserWindows {
		if browserWindows[i].ID == profileID {
			browserWindows[i].LoginStatus = "valid"
			break
		}
	}
	return map[string]interface{}{"status": "valid", "message": "Cookie 检测通过（POC 模式，实际需 CDP 验证）"}
}

func (a *App) UpdateWindowName(profileID, name string) error {
	for i := range browserWindows {
		if browserWindows[i].ID == profileID {
			browserWindows[i].Name = name
			return nil
		}
	}
	return fmt.Errorf("window not found")
}

func (a *App) DeleteBrowserWindow(profileID string) error {
	for i := range browserWindows {
		if browserWindows[i].ID == profileID {
			browserWindows[i].Enabled = false
			return nil
		}
	}
	return fmt.Errorf("window not found")
}

// ─── Accounts ────────────────────────────────────────────────────────────────

type BrowserProfile struct {
	Seq                int    `json:"seq"`
	ProfileID          string `json:"profile_id"`
	DisplayName        string `json:"display_name"`
	DouyinUID          string `json:"douyin_uid"`
	Nickname           string `json:"nickname"`
	CookieStatus       string `json:"cookie_status"`
	CookieUpdatedAt    string `json:"cookie_updated_at"`
	TestPassed         bool   `json:"test_passed"`
	Enabled            bool   `json:"enabled"`
	DailyDMSent        int    `json:"daily_dm_sent"`
	DailyDMLimit       int    `json:"daily_dm_limit"`
	ConsecutiveFailures int   `json:"consecutive_failures"`
}

func (a *App) GetAccounts(page, pageSize int) map[string]interface{} {
	// Derive from browser windows so Settings → other pages stay in sync
	profiles := []BrowserProfile{}
	for _, w := range browserWindows {
		if !w.Enabled {
			continue
		}
		cookieStatus := "unknown"
		if w.LoginStatus == "valid" {
			cookieStatus = "valid"
		} else if w.LoginStatus == "expired" {
			cookieStatus = "expired"
		}
		profiles = append(profiles, BrowserProfile{
			Seq:             w.Seq,
			ProfileID:       w.ID,
			DisplayName:     w.Name,
			Nickname:        w.Name,
			CookieStatus:    cookieStatus,
			CookieUpdatedAt: w.CookieUpdatedAt,
			TestPassed:      w.ConnStatus == "connected",
			Enabled:         w.Enabled,
			DailyDMLimit:    100,
		})
	}
	start := (page - 1) * pageSize
	end := start + pageSize
	if end > len(profiles) {
		end = len(profiles)
	}
	if start > len(profiles) {
		start = len(profiles)
	}
	return map[string]interface{}{
		"items":     profiles[start:end],
		"total":     len(profiles),
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) AddAccount(profileID string) error { return nil }
func (a *App) DeleteAccount(profileID string) error { return nil }
func (a *App) ExtractAccountInfo(profileID string) error { return nil }
func (a *App) TestSendDM(profileID, targetUID string) error { return nil }

func (a *App) LoginBitBrowserWindow(profileID string) map[string]interface{} {
	return map[string]interface{}{"ws": fmt.Sprintf("ws://127.0.0.1:9222/%s", profileID)}
}

func (a *App) ExportAccounts(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/accounts.%s", format)
}

type StartupCheckItem struct {
	Seq          int    `json:"seq"`
	ProfileID    string `json:"profile_id"`
	Nickname     string `json:"nickname"`
	CookieStatus string `json:"cookie_status"`
	Message      string `json:"message"`
}

func (a *App) GetStartupCheckResult() []StartupCheckItem {
	time.Sleep(300 * time.Millisecond)
	items := []StartupCheckItem{}
	for _, w := range browserWindows {
		if !w.Enabled {
			continue
		}
		status := "unknown"
		msg := "未检测，请前往设置验证"
		if w.LoginStatus == "valid" {
			status = "valid"
			msg = "Cookie 有效"
		} else if w.LoginStatus == "expired" {
			status = "expired"
			msg = "Cookie 已过期，请刷新"
		}
		items = append(items, StartupCheckItem{
			Seq:          w.Seq,
			ProfileID:    w.ID,
			Nickname:     w.Name,
			CookieStatus: status,
			Message:      msg,
		})
	}
	return items
}

// ─── DM Keywords ─────────────────────────────────────────────────────────────

type DMKeywordRule struct {
	ID        string `json:"id"`
	Keyword   string `json:"keyword"`
	MatchType string `json:"match_type"`
	Category  string `json:"category"`
	Enabled   bool   `json:"enabled"`
	HitCount  int    `json:"hit_count"`
	CreatedAt string `json:"created_at"`
}

func (a *App) GetDMKeywords() []DMKeywordRule {
	return []DMKeywordRule{}
}

func (a *App) AddDMKeyword(ruleJSON string) error { return nil }
func (a *App) UpdateDMKeyword(ruleJSON string) error { return nil }
func (a *App) DeleteDMKeyword(id string) error { return nil }

// ─── DM Review ───────────────────────────────────────────────────────────────

type DMTask struct {
	TaskID               string `json:"task_id"`
	TargetUID            string `json:"target_uid"`
	TargetNickname       string `json:"target_nickname"`
	TargetSecUID         string `json:"target_sec_uid"`
	SourceVideoID        string `json:"source_video_id"`
	SourceVideoTitle     string `json:"source_video_title"`
	SourceCommentContent string `json:"source_comment_content"`
	TriggerKeyword       string `json:"trigger_keyword"`
	MessagePreview       string `json:"message_preview"`
	ExecutedProfileID    string `json:"executed_profile_id"`
	ExecutedSeq          int    `json:"executed_seq"`
	Status               string `json:"status"`
	ErrorMsg             string `json:"error_msg"`
	RetryCount           int    `json:"retry_count"`
	CreatedAt            string `json:"created_at"`
	SentAt               string `json:"sent_at"`
}

func (a *App) GetPendingReviews(page, pageSize int) map[string]interface{} {
	tasks := []DMTask{}
	return map[string]interface{}{
		"items":     tasks,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) ApproveDMTasks(taskIDsJSON string) error {
	var ids []string
	json.Unmarshal([]byte(taskIDsJSON), &ids)
	runtime.LogInfo(a.ctx, fmt.Sprintf("Approved %d tasks", len(ids)))
	return nil
}

func (a *App) SkipDMTasks(taskIDsJSON string) error {
	var ids []string
	json.Unmarshal([]byte(taskIDsJSON), &ids)
	runtime.LogInfo(a.ctx, fmt.Sprintf("Skipped %d tasks", len(ids)))
	return nil
}

func (a *App) ExportPendingReviews(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/pending_reviews.%s", format)
}

// ─── DM Queue ────────────────────────────────────────────────────────────────

func (a *App) GetDMTasks(status string, page, pageSize int) map[string]interface{} {
	tasks := []DMTask{}
	return map[string]interface{}{
		"items":     tasks,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) StartDMEngine() error {
	runtime.EventsEmit(a.ctx, "dm:stats-update", map[string]interface{}{"engine_running": true})
	return nil
}

func (a *App) StopDMEngine() error {
	runtime.EventsEmit(a.ctx, "dm:stats-update", map[string]interface{}{"engine_running": false})
	return nil
}

func (a *App) GetDMStatus() map[string]interface{} {
	return map[string]interface{}{
		"engine_running":       false,
		"today_success":        0,
		"today_failed":         0,
		"pending_review_count": 0,
	}
}

// ─── DM Config ───────────────────────────────────────────────────────────────

type DMConfig struct {
	TemplatePath         string `json:"template_path"`
	MinIntervalSec       int    `json:"min_interval_sec"`
	MaxIntervalSec       int    `json:"max_interval_sec"`
	DailyLimitPerAccount int    `json:"daily_limit_per_account"`
	DailyLimitTotal      int    `json:"daily_limit_total"`
	Concurrency          int    `json:"concurrency"`
	AutoAddToMonitor     bool   `json:"auto_add_to_monitor"`
	NewVideoOnly         bool   `json:"new_video_only"`
	FullSendMode         bool   `json:"full_send_mode"`
}

func (a *App) GetDMConfig() DMConfig {
	return DMConfig{
		TemplatePath:         "",
		MinIntervalSec:       60,
		MaxIntervalSec:       180,
		DailyLimitPerAccount: 100,
		DailyLimitTotal:      500,
		Concurrency:          3,
		AutoAddToMonitor:     true,
		NewVideoOnly:         false,
		FullSendMode:         false,
	}
}

func (a *App) SaveDMConfig(configJSON string) error { return nil }

func (a *App) ExportDMTasks(status, format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/dm_tasks.%s", format)
}

// ─── DM Send Logs ────────────────────────────────────────────────────────────

type DMSendLog struct {
	ID               string `json:"id"`
	SentAt           string `json:"sent_at"`
	WindowSeq        int    `json:"window_seq"`
	ProfileID        string `json:"profile_id"`
	SenderNickname   string `json:"sender_nickname"`
	TargetUID        string `json:"target_uid"`
	TargetNickname   string `json:"target_nickname"`
	SourceVideoID    string `json:"source_video_id"`
	SourceVideoTitle string `json:"source_video_title"`
	CommentContent   string `json:"comment_content"`
	TriggerKeyword   string `json:"trigger_keyword"`
	MessageContent   string `json:"message_content"`
	Status           string `json:"status"`
	ErrorMsg         string `json:"error_msg"`
}

func (a *App) GetDMSendLogs(profileID, status string, page, pageSize int) map[string]interface{} {
	logs := []DMSendLog{}
	return map[string]interface{}{
		"items":     logs,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) ExportDMSendLogs(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/dm_send_logs.%s", format)
}

// ─── Video Collect ───────────────────────────────────────────────────────────

type VideoSearchResult struct {
	VideoID        string `json:"video_id"`
	Title          string `json:"title"`
	AuthorNickname string `json:"author_nickname"`
	CoverURL       string `json:"cover_url"`
	LikeCount      int    `json:"like_count"`
	CommentCount   int    `json:"comment_count"`
	PublishedAt    string `json:"published_at"`
	SourceKeyword  string `json:"source_keyword"`
	AlreadyAdded   bool   `json:"already_added"`
}

func (a *App) SearchVideos(keyword, sortType, publishTime, duration string, count int) []VideoSearchResult {
	return []VideoSearchResult{}
}

type KeywordConfig struct {
	ID              string      `json:"id"`
	Keyword         string      `json:"keyword"`
	Enabled         bool        `json:"enabled"`
	Priority        int         `json:"priority"`
	SearchTimeRange string      `json:"search_time_range"`
	CountPerRun     int         `json:"count_per_run"`
	Stats           interface{} `json:"stats"`
	LastRunAt       string      `json:"last_run_at"`
	CreatedAt       string      `json:"created_at"`
}

func (a *App) GetKeywords() []KeywordConfig {
	return []KeywordConfig{}
}

func (a *App) AddKeyword(configJSON string) error    { return nil }
func (a *App) UpdateKeyword(configJSON string) error  { return nil }
func (a *App) DeleteKeyword(id string) error          { return nil }

type CollectHistory struct {
	ID          string `json:"id"`
	KeywordID   string `json:"keyword_id"`
	Keyword     string `json:"keyword"`
	StartedAt   string `json:"started_at"`
	FinishedAt  string `json:"finished_at"`
	DurationSec int    `json:"duration_sec"`
	Collected   int    `json:"collected"`
	FilteredOut int    `json:"filtered_out"`
	Added       int    `json:"added"`
	Status      string `json:"status"`
	ErrorMsg    string `json:"error_msg"`
}

func (a *App) GetCollectHistory(page, pageSize int) map[string]interface{} {
	history := []CollectHistory{}
	return map[string]interface{}{
		"items":     history,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) StartAutoCollect() error { return nil }
func (a *App) StopAutoCollect() error  { return nil }

func (a *App) GetAutoCollectStatus() map[string]interface{} {
	return map[string]interface{}{
		"running":              false,
		"next_collect_in_sec":  0,
		"current_round_videos": 0,
		"total_monitored":      0,
	}
}

func (a *App) ExportCollectHistory(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/collect_history.%s", format)
}

// ─── System Config ───────────────────────────────────────────────────────────

func (a *App) CheckBitBrowserStatus() ServiceStatus {
	return ServiceStatus{Online: false}
}

func (a *App) CheckSigningServiceStatus() ServiceStatus {
	return ServiceStatus{Online: false}
}

func (a *App) RefreshCookieFromBitBrowser(browserID string) map[string]interface{} {
	return map[string]interface{}{
		"browser_id":  browserID,
		"cookie_length": 0,
		"updated_at":  time.Now().Format(time.RFC3339),
	}
}

func (a *App) GetSystemConfig() map[string]interface{} {
	return map[string]interface{}{
		"bit_browser": map[string]interface{}{"port": 54345},
		"signing":     map[string]interface{}{"port": 9527},
		"global": map[string]interface{}{
			"monitor_interval_sec": 60,
			"max_retry":            3,
			"auto_clean_days":      7,
			"blacklist_threshold":  5,
			"dingtalk_webhook":     "",
		},
	}
}

func (a *App) SaveBitBrowserConfig(configJSON string) error { return nil }
func (a *App) SaveGlobalConfig(configJSON string) error     { return nil }

// ─── Logs ────────────────────────────────────────────────────────────────────

type LogEntry struct {
	ID        string `json:"id"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	CreatedAt string `json:"created_at"`
}

func (a *App) GetLogs(level, keyword string, page, pageSize int) map[string]interface{} {
	logs := []LogEntry{}
	return map[string]interface{}{
		"items":     logs,
		"total":     0,
		"page":      page,
		"page_size": pageSize,
	}
}

func (a *App) ClearLogs() error { return nil }

func (a *App) ExportLogs(format string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/system_logs.%s", format)
}

func (a *App) ExportData(dataType, format string, filtersJSON string) string {
	return fmt.Sprintf("C:/Users/43841/Downloads/%s_%d.%s", dataType, time.Now().Unix(), format)
}

