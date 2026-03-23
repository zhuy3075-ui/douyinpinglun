package signer

// ⚠️  备选路线（当前不在主方案中）
//
// 此文件实现 goja 内嵌 JS 引擎方案，用于在 Go 进程内直接生成 a_bogus 签名。
//
// 当前主签名路线：client.go（调用 signing_server.js Node.js HTTP 服务）
// 原因：内嵌 goja 方案需要完整的浏览器 DOM 环境模拟，而 SDK 在受限
//       沙盒中签名质量不稳定；Node.js 方案通过真实 Chromium 执行，更可靠。
//
// 如需切换回 goja 方案：
//   1. 确认 sdk_scripts/webmssdk.es5.js 存在
//   2. 验证 Sign() 返回值非空
//   3. 在主程序中替换 signer.GetClient() 为 signer.GetSigner()

import (
	"fmt"
	"os"
	"sync"

	"github.com/dop251/goja"
)

// Signer 使用 goja 内嵌 JS 引擎执行抖音 a_bogus 签名
type Signer struct {
	vm       *goja.Runtime
	signFunc goja.Callable
	mu       sync.Mutex
}

var instance *Signer
var once sync.Once

// GetSigner 返回单例 Signer
func GetSigner() (*Signer, error) {
	var initErr error
	once.Do(func() {
		s, err := newSigner()
		if err != nil {
			initErr = err
			return
		}
		instance = s
	})
	if initErr != nil {
		return nil, initErr
	}
	return instance, nil
}

func newSigner() (*Signer, error) {
	vm := goja.New()

	console := vm.NewObject()
	_ = console.Set("log", func(args ...interface{}) {})
	_ = console.Set("error", func(args ...interface{}) {})
	_ = vm.Set("console", console)

	_ = vm.Set("window", vm.GlobalObject())
	_ = vm.Set("global", vm.GlobalObject())
	_ = vm.Set("self", vm.GlobalObject())

	nav := vm.NewObject()
	_ = nav.Set("userAgent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	_ = nav.Set("language", "zh-CN")
	_ = nav.Set("platform", "Win32")
	_ = vm.Set("navigator", nav)

	loc := vm.NewObject()
	_ = loc.Set("href", "https://www.douyin.com/")
	_ = loc.Set("host", "www.douyin.com")
	_ = loc.Set("protocol", "https:")
	_ = vm.Set("location", loc)

	// 实际文件名为 webmssdk.es5.js（非 webmssdk.js）
	sdkPath := "sdk_scripts/webmssdk.es5.js"
	if _, err := os.Stat(sdkPath); os.IsNotExist(err) {
		if err := loadStubSigner(vm); err != nil {
			return nil, fmt.Errorf("加载 stub signer 失败: %w", err)
		}
	} else {
		sdkCode, err := os.ReadFile(sdkPath)
		if err != nil {
			return nil, fmt.Errorf("读取 SDK 文件失败: %w", err)
		}
		if _, err := vm.RunString(string(sdkCode)); err != nil {
			return nil, fmt.Errorf("执行 SDK JS 失败: %w", err)
		}
	}

	wrapperCode := `
function __sign_request(url, userAgent) {
  try {
    if (typeof window._byteSDK !== 'undefined' && window._byteSDK.sign) {
      return window._byteSDK.sign(url);
    }
    if (typeof byted_acrawler !== 'undefined' && byted_acrawler.sign) {
      return byted_acrawler.sign(url);
    }
    if (typeof __webmssdk_sign !== 'undefined') {
      return __webmssdk_sign(url);
    }
    return '';
  } catch(e) {
    return '';
  }
}
`
	if _, err := vm.RunString(wrapperCode); err != nil {
		return nil, fmt.Errorf("加载包装函数失败: %w", err)
	}

	signFn, ok := goja.AssertFunction(vm.Get("__sign_request"))
	if !ok {
		return nil, fmt.Errorf("__sign_request 不是函数")
	}

	return &Signer{vm: vm, signFunc: signFn}, nil
}

// Sign 对请求 URL 生成 a_bogus 签名
func (s *Signer) Sign(url, userAgent string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	result, err := s.signFunc(goja.Undefined(), s.vm.ToValue(url), s.vm.ToValue(userAgent))
	if err != nil {
		return "", fmt.Errorf("签名执行失败: %w", err)
	}
	return result.String(), nil
}

// loadStubSigner 在 SDK 文件不存在时加载空 stub，允许项目先编译
func loadStubSigner(vm *goja.Runtime) error {
	stub := `
window._byteSDK = { sign: function(url) { return ''; } };
`
	_, err := vm.RunString(stub)
	return err
}
