/**
 * 视频搜索筛选参数抓包验证脚本
 * 目标：确认 publish_time / sort_type / duration 三个参数的实际枚举值
 *
 * 使用方法：
 *   1. 确保比特浏览器已启动，且有已登录抖音的窗口
 *   2. 修改下方 BROWSER_ID 为实际窗口ID
 *   3. node tools/capture_search_params.js
 *   4. 脚本会自动执行6次搜索（覆盖三个参数的不同枚举值）
 *   5. 结果保存到 data/search_params_result.json
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── 配置 ───────────────────────────────────────────
const BITBROWSER_API = 'http://127.0.0.1:54345';
const BROWSER_ID = 'YOUR_BROWSER_PROFILE_ID'; // 替换为实际的比特浏览器窗口ID
const KEYWORD = '旅游'; // 测试关键词
const OUTPUT = path.join(__dirname, '../data/search_params_result.json');

// 待验证的测试用例
const TEST_CASES = [
  { label: '时间-一天内',   params: { publish_time: '?', time_range: 1 } },
  { label: '时间-一周内',   params: { publish_time: '?', time_range: 7 } },
  { label: '时间-一个月',   params: { publish_time: '?', time_range: 30 } },
  { label: '排序-最多点赞', params: { sort_type: '?', sort: 'digg' } },
  { label: '排序-最多评论', params: { sort_type: '?', sort: 'comment' } },
  { label: '排序-最新发布', params: { sort_type: '?', sort: 'new' } },
  { label: '时长-1分钟以内', params: { duration: '?', dur: 1 } },
  { label: '时长-1-5分钟',  params: { duration: '?', dur: 2 } },
  { label: '时长-5分钟以上', params: { duration: '?', dur: 3 } },
];

// ─── 工具函数 ─────────────────────────────────────
function bitRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: 54345, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── 主流程 ─────────────────────────────────────
(async () => {
  console.log('📡 打开比特浏览器窗口...');
  const openRes = await bitRequest('/browser/open', { id: BROWSER_ID });
  if (!openRes.success) {
    console.error('❌ 打开失败:', openRes);
    process.exit(1);
  }
  const ws = openRes.data.ws;
  console.log('✅ CDP 地址:', ws);

  const browser = await chromium.connectOverCDP(ws);
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // 屏蔽无关资源
  await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,woff,woff2,ico}', r => r.abort());

  const capturedParams = {};

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/aweme/v1/web/search/item/') && url.includes('keyword=')) {
      const u = new URL(url);
      const key = [
        u.searchParams.get('publish_time'),
        u.searchParams.get('sort_type'),
        u.searchParams.get('duration'),
        u.searchParams.get('keyword')
      ].join('|');
      capturedParams[key] = {
        publish_time: u.searchParams.get('publish_time'),
        sort_type:    u.searchParams.get('sort_type'),
        duration:     u.searchParams.get('duration'),
        count:        u.searchParams.get('count'),
        is_filter:    u.searchParams.get('is_filter_search'),
        keyword:      u.searchParams.get('keyword'),
        fullUrl:      url.substring(0, 300),
      };
      console.log('🎯 捕获搜索请求:', capturedParams[key]);
    }
  });

  // 打开抖音搜索页
  console.log('\n⏳ 打开抖音...');
  await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('\n📋 请在浏览器中手动进行以下操作，脚本将自动抓取参数：');
  console.log('─'.repeat(60));
  TEST_CASES.forEach((tc, i) => console.log(`  ${i + 1}. 搜索"${KEYWORD}"，设置筛选：${tc.label}`));
  console.log('─'.repeat(60));
  console.log('\n操作完成后，按 Ctrl+C 保存结果');

  // 等待用户操作，每5秒报告一次捕获数量
  const interval = setInterval(() => {
    console.log(`📊 已捕获 ${Object.keys(capturedParams).length} 个不同参数组合`);
  }, 5000);

  process.on('SIGINT', async () => {
    clearInterval(interval);
    const result = {
      captured_at: new Date().toISOString(),
      total: Object.keys(capturedParams).length,
      params: capturedParams,
      summary: {
        publish_time_values: [...new Set(Object.values(capturedParams).map(p => p.publish_time))].filter(Boolean),
        sort_type_values: [...new Set(Object.values(capturedParams).map(p => p.sort_type))].filter(Boolean),
        duration_values: [...new Set(Object.values(capturedParams).map(p => p.duration))].filter(Boolean),
      }
    };
    fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
    console.log(`\n✅ 结果已保存到: ${OUTPUT}`);
    console.log('\n📊 参数汇总:');
    console.log('  publish_time:', result.summary.publish_time_values.join(', '));
    console.log('  sort_type:   ', result.summary.sort_type_values.join(', '));
    console.log('  duration:    ', result.summary.duration_values.join(', '));
    console.log('\n📝 请将以上值填入 PRD 第 10.3 节的参数表格，并删除 ⚠️ 警告。');
    await browser.close().catch(() => {});
    process.exit(0);
  });
})();
