/**
 * 专项抓包：IM 会话列表 + security_token 获取接口
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let savedCookie = '';
try {
  const data = require('./captured_apis.json');
  const all = [...data.comments, ...data.videoSearch, ...data.dmSend, ...data.userInfo, ...data.other];
  const found = all.find(c => c.requestHeaders?.cookie?.length > 100);
  savedCookie = found?.requestHeaders?.cookie || '';
  console.log('✅ 已加载 Cookie，长度:', savedCookie.length);
} catch(e) {}

const captured = { imConversation: [], imHistory: [], securityToken: [], imSend: [], other: [] };

const RULES = [
  { key: 'imConversation', patterns: ['im/inbox', 'im/conversation', 'im/session', 'im/thread'] },
  { key: 'imHistory',      patterns: ['im/msg', 'im/message', 'im/history', 'im/chat'] },
  { key: 'securityToken',  patterns: ['security_token', 'identity_security', 'im/token', 'im/auth'] },
  { key: 'imSend',         patterns: ['message/send', 'imapi.douyin', 'im/send'] },
];

function classify(url) {
  const lower = url.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some(p => lower.includes(p))) return rule.key;
  }
  return 'other';
}

function save() {
  fs.writeFileSync(path.join(__dirname, 'captured_im.json'), JSON.stringify(captured, null, 2));
  const s = Object.entries(captured).map(([k,v]) => `${k}:${v.length}`).join(' | ');
  console.log(`💾 已保存 → ${s}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  if (savedCookie) {
    await context.addCookies(parseCookieString(savedCookie, 'www.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, '.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'www-hj.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'imapi.douyin.com'));
    console.log('✅ Cookie 注入完成');
  }

  const page = await context.newPage();

  // 拦截所有请求
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('douyin.com')) return;
    if (url.match(/\.(js|css|png|jpg|gif|woff|ico|svg)(\?|$)/)) return;

    const cat = classify(url);
    const urlBase = url.split('?')[0];

    // 特别关注：所有 imapi.douyin.com 和所有 IM 相关
    const isIM = url.includes('imapi.douyin') || url.includes('/im/') || url.includes('/message');
    if (!isIM && cat === 'other') return;

    try {
      let body = null;
      try { body = await response.json(); } catch(_) {
        try { body = await response.text(); } catch(__) {}
      }

      const req = response.request();
      const entry = {
        url,
        method: req.method(),
        status: response.status(),
        requestHeaders: await req.allHeaders(),
        postData: req.postData(),
        responseBody: body,
        capturedAt: new Date().toISOString()
      };

      if (cat !== 'other') {
        captured[cat].push(entry);
        console.log(`✅ [${cat.toUpperCase()}] ${req.method()} ${urlBase}`);
        save();
      } else if (isIM) {
        captured.other.push({ url, method: req.method(), status: response.status(), body });
        console.log(`📌 [IM-OTHER] ${req.method()} ${urlBase}`);
      }
    } catch(e) {}
  });

  console.log('🌐 打开抖音...');
  await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded' });

  console.log(`
╔══════════════════════════════════════════════════════╗
║          IM 接口专项抓包 — 请按步骤操作               ║
║                                                      ║
║  1. 确认已登录（如未登录请扫码）                      ║
║  2. 点击顶部【消息】图标，进入消息中心                 ║
║  3. 在左侧会话列表向下滚动（触发会话列表分页）         ║
║  4. 依次点开 3~5 个不同的对话                        ║
║  5. 在每个对话里向上滚动查看历史消息                  ║
║  6. 发送一条消息（触发 send 接口）                    ║
║  7. 在搜索框搜索一个联系人（触发用户搜索接口）         ║
║                                                      ║
║  脚本每发现新接口自动保存，等待 8 分钟后结束           ║
╚══════════════════════════════════════════════════════╝
  `);

  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 15;
    const s = Object.entries(captured).map(([k,v])=>`${k}:${v.length}`).join(' ');
    process.stdout.write(`\r⏱ ${elapsed}s | ${s}   `);
  }, 15000);

  await new Promise(resolve => setTimeout(resolve, 8 * 60 * 1000));
  clearInterval(interval);

  save();
  generateIMReport();
  await browser.close();
  console.log('\n✅ 抓包完成');
})();

function generateIMReport() {
  const lines = ['# IM 接口抓包报告', ''];
  for (const [cat, entries] of Object.entries(captured)) {
    if (!entries.length) continue;
    lines.push(`## ${cat} (${entries.length}条)`);
    entries.slice(0, 2).forEach(e => {
      lines.push(`\n### ${e.method || ''} ${(e.url||'').split('?')[0]}`);
      if (e.postData) lines.push('**Body:**\n```\n' + String(e.postData).substring(0,300) + '\n```');
      if (e.responseBody) {
        const s = typeof e.responseBody === 'string' ? e.responseBody : JSON.stringify(e.responseBody);
        lines.push('**Response:**\n```json\n' + s.substring(0,400) + '\n```');
      }
    });
    lines.push('');
  }
  fs.writeFileSync(path.join(__dirname, 'im_report.md'), lines.join('\n'));
  console.log('\n📄 im_report.md 已生成');
}

function parseCookieString(cookieStr, domain) {
  return cookieStr.split(';').map(part => {
    const [name, ...rest] = part.trim().split('=');
    return { name: name.trim(), value: rest.join('=').trim(), domain, path: '/' };
  }).filter(c => c.name && c.value && c.name.length < 100 && c.value.length < 4096);
}
