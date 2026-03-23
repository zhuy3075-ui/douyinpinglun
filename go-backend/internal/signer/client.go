package signer

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

const signerServerURL = "http://127.0.0.1:9527"

// SignResult 签名服务返回结果
type SignResult struct {
	ABogus    string `json:"a_bogus"`
	Method    string `json:"method"`
	SignedURL string `json:"signedUrl,omitempty"`
	Error     string `json:"error,omitempty"`
}

// Client 签名服务客户端（单例）
type Client struct {
	httpClient *http.Client
	ready      bool
	mu         sync.RWMutex
}

var (
	defaultClient *Client
	clientOnce    sync.Once
)

// GetClient 返回默认签名客户端单例
func GetClient() *Client {
	clientOnce.Do(func() {
		defaultClient = &Client{
			httpClient: &http.Client{Timeout: 5 * time.Second},
		}
	})
	return defaultClient
}

// Sign 对 URL 生成 a_bogus 签名，返回 a_bogus 值
func (c *Client) Sign(targetURL string) (string, error) {
	endpoint := fmt.Sprintf("%s/sign?url=%s", signerServerURL, url.QueryEscape(targetURL))

	resp, err := c.httpClient.Get(endpoint)
	if err != nil {
		return "", fmt.Errorf("签名服务不可用: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取签名响应失败: %w", err)
	}

	var result SignResult
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析签名响应失败: %w", err)
	}

	if result.Error != "" {
		return "", fmt.Errorf("签名服务错误: %s", result.Error)
	}

	return result.ABogus, nil
}

// IsReady 检查签名服务是否就绪
func (c *Client) IsReady() bool {
	resp, err := c.httpClient.Get(signerServerURL + "/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	var health struct {
		Status string `json:"status"`
		Ready  bool   `json:"ready"`
	}
	body, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(body, &health)
	return health.Status == "ok" && health.Ready
}

// WaitReady 等待签名服务就绪（最多等 30 秒）
func (c *Client) WaitReady(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if c.IsReady() {
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}
	return fmt.Errorf("签名服务在 %v 内未就绪", timeout)
}

// AppendSign 给 URL 追加 a_bogus 参数，返回签名后的完整 URL
func (c *Client) AppendSign(rawURL string) (string, error) {
	abogus, err := c.Sign(rawURL)
	if err != nil {
		// 签名失败时返回原 URL（允许降级）
		return rawURL, err
	}
	if abogus == "" {
		return rawURL, nil
	}

	sep := "?"
	if len(rawURL) > 0 {
		for _, ch := range rawURL {
			if ch == '?' {
				sep = "&"
				break
			}
		}
	}
	return rawURL + sep + "a_bogus=" + url.QueryEscape(abogus), nil
}
