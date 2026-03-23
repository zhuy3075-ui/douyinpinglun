const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 保存抓到的接口
const captured = {
  comments: [],
  videoSearch: [],
  dmSend: [],
  dmList: [],
  userInfo: [],
  other: []
};

// 关键词匹配规则
const RULES = [
  { key: 'comments',   patterns: ['comment', 'aweme/comment', 'reply'] },
  { key: 'videoSearch',patterns: ['search', 'aweme/search', 'challenge/search'] },
  { key: 'dmSend',     patterns: ['im/send', 'direct_message', 'im/create', 'message/send'] },
  { key: 'dmList',     patterns: ['im/inbox', 'im/conversation', 'direct_message/list'] },
  { key: 'userInfo',   patterns: ['user/detail', 'user/profile'] },
];

function classify(url) {
  const lower = url.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some(p => lower.includes(p))) return rule.key;
  }
  return 'other';
}

function saveCaptures() {
  const out = path.join(__dirname, 'captured_apis.json');
  fs.writeFileSync(out, JSON.stringify(captured, null, 2), 'utf-8');
  // 统计
  const summary = Object.entries(captured).map(([k,v]) => `  ${k}: ${v.length} 条`).join('\n');
  console.log(`\n📦 已保存到 captured_apis.json\n${summary}`);
}

(async () => {
  console.log('🚀 启动浏览器...');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',  // 优先用本机 Chrome（有更好的抖音兼容性）
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized'
    ]
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  // ====== 拦截所有网络请求 ======
  page.on('response', async (response) => {
    const url = response.url();
    // 只关注抖音 API 请求（非静态资源）
    if (!url.includes('douyin.com') && !url.includes('tiktok.com')) return;
    if (url.match(/\.(js|css|png|jpg|gif|woff|ico|svg)(\?|$)/)) return;

    const category = classify(url);
    if (category === 'other' && !url.includes('/api/') && !url.includes('aweme')) return;

    try {
      const status = response.status();
      let body = null;
      try {
        const text = await response.text();
        body = JSON.parse(text);
      } catch (_) {}

      const request = response.request();
      const entry = {
        url,
        method: request.method(),
        status,
        requestHeaders: await request.allHeaders(),
        postData: request.postData(),
        responseBody: body,
        capturedAt: new Date().toISOString()
      };

      if (category !== 'other') {
        captured[category].push(entry);
        console.log(`✅ [${category.toUpperCase()}] ${request.method()} ${url.split('?')[0]}`);
      } else {
        // other 只记录包含 api 字样的
        captured.other.push({ url, method: request.method(), status });
        console.log(`📌 [OTHER] ${url.split('?')[0].substring(0, 100)}`);
      }

      // 每捕获到关键接口就立即保存
      if (['comments','videoSearch','dmSend'].includes(category)) {
        saveCaptures();
      }
    } catch (e) {
      // 忽略读取失败
    }
  });

  // ====== 打开抖音 ======
  console.log('🌐 正在打开抖音...');
  await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded' });

  console.log(`
╔════════════════════════════════════════════╗
║           请按以下步骤操作：               ║
║                                            ║
║  1. 先扫码或手机号登录抖音账号             ║
║  2. 登录后，打开任意一个视频               ║
║  3. 滚动浏览评论区（向下滚动多次）         ║
║  4. 然后去搜索页搜一个关键词               ║
║  5. 最后去私信页面（消息中心）             ║
║                                            ║
║  完成后回到这里按 Enter 保存结果           ║
╚════════════════════════════════════════════╝
  `);

  // 等待用户操作，10分钟后自动保存（或检测到足够数据时提前保存）
  console.log('\n⏳ 等待你操作浏览器，最多等待 10 分钟后自动保存...\n');
  await new Promise((resolve) => {
    // 定时检查：每15秒检查一次，如果3类核心接口都有数据就提前结束
    const check = setInterval(() => {
      const hasComments = captured.comments.length > 0;
      const hasSearch = captured.videoSearch.length > 0;
      const hasDm = captured.dmList.length > 0 || captured.dmSend.length > 0;
      console.log(`📊 当前进度 - 评论:${captured.comments.length} 搜索:${captured.videoSearch.length} 私信:${captured.dmSend.length+captured.dmList.length}`);
      if (hasComments && hasSearch && hasDm) {
        console.log('✅ 三类核心接口均已捕获，自动保存！');
        clearInterval(check);
        clearTimeout(timeout);
        resolve();
      }
    }, 15000);
    // 最多等10分钟
    const timeout = setTimeout(() => {
      clearInterval(check);
      resolve();
    }, 10 * 60 * 1000);
  });

  saveCaptures();

  // 生成可读报告
  generateReport();

  await browser.close();
  process.exit(0);
})();

function generateReport() {
  const lines = ['# 抖音 API 抓包报告', ''];

  for (const [category, entries] of Object.entries(captured)) {
    if (entries.length === 0) continue;
    lines.push(`## ${category} (${entries.length} 条)`);
    for (const e of entries.slice(0, 3)) { // 每类最多展示3条
      lines.push(`\n### ${e.method} ${e.url ? e.url.split('?')[0] : ''}`);
      if (e.requestHeaders) {
        const importantHeaders = ['cookie', 'x-bogus', 'ms-token', 'x-tt-token', 'x-secsdk-csrf-token', 'referer', 'user-agent'];
        const filtered = Object.entries(e.requestHeaders)
          .filter(([k]) => importantHeaders.includes(k.toLowerCase()))
          .map(([k, v]) => `  ${k}: ${v.substring(0, 100)}`).join('\n');
        if (filtered) lines.push('**关键 Headers:**\n```\n' + filtered + '\n```');
      }
      if (e.postData) lines.push('**请求体:**\n```json\n' + e.postData.substring(0, 500) + '\n```');
      if (e.responseBody) {
        lines.push('**响应体（前500字符）:**\n```json\n' + JSON.stringify(e.responseBody).substring(0, 500) + '\n```');
      }
    }
    lines.push('');
  }

  fs.writeFileSync(path.join(__dirname, 'api_report.md'), lines.join('\n'), 'utf-8');
  console.log('📄 可读报告已生成: api_report.md');
}
