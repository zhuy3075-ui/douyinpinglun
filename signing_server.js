/**
 * 签名微服务 (Signing Microservice)
 * 维护一个常驻 Playwright 浏览器，对外提供 HTTP 签名接口
 * Go 调用 GET http://localhost:9527/sign?url=xxx 获取 a_bogus
 */
const { chromium } = require('playwright');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 9527;
const COOKIE_FILE  = path.join(__dirname, 'data/captured_apis.json');
const COOKIE_STORE = path.join(__dirname, 'data/cookie_store.json');  // 一键刷新后保存到这里

let page = null;
let browser = null;
let isReady = false;

// ─── 启动浏览器 ───────────────────────────────────
async function startBrowser() {
  console.log('🚀 启动签名浏览器...');

  // 读取保存的 cookie：优先用 cookie_store.json（一键刷新后写入），其次从 captured_apis.json 提取
  let savedCookie = '';
  try {
    const store = JSON.parse(fs.readFileSync(COOKIE_STORE, 'utf-8'));
    if (store.cookie && store.cookie.length > 100) {
      savedCookie = store.cookie;
      console.log(`✅ 从 cookie_store.json 加载 Cookie（${store.updated_at}）`);
    }
  } catch(e) {}

  if (!savedCookie) {
    try {
      const data = require(COOKIE_FILE);
      const all = [...(data.comments||[]), ...(data.videoSearch||[]), ...(data.dmSend||[])];
      savedCookie = all.find(c => c.requestHeaders?.cookie?.length > 100)?.requestHeaders?.cookie || '';
      if (savedCookie) console.log('ℹ️  从 captured_apis.json 加载历史 Cookie（建议运行 npm run refresh 更新）');
    } catch(e) {}
  }

  browser = await chromium.launch({
    headless: true,   // 后台无头模式
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  if (savedCookie) {
    await context.addCookies(parseCookieString(savedCookie, '.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'www.douyin.com'));
    console.log('✅ Cookie 注入完成，长度:', savedCookie.length);
  }

  page = await context.newPage();

  // 屏蔽不必要的资源加载（加速初始化）
  await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,woff,woff2,ico}', r => r.abort());
  await page.route('**/webcast/**', r => r.abort());

  console.log('📂 加载抖音...');
  try {
    await page.goto('https://www.douyin.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
  } catch(e) {
    console.log('⚠️ 页面加载超时，继续...');
  }

  // 等待 webmssdk 加载完毕
  await page.waitForTimeout(3000);

  // 确认签名 SDK 已就绪
  const sdkReady = await page.evaluate(() => {
    return typeof window.byted_acrawler !== 'undefined';
  });

  if (sdkReady) {
    console.log('✅ byted_acrawler SDK 已加载');
    isReady = true;
  } else {
    console.log('⚠️ byted_acrawler 未加载，尝试手动加载 SDK...');
    await loadSDKManually();
  }
}

// 手动注入 SDK（当页面未自动加载时）
async function loadSDKManually() {
  const sdkPath = path.join(__dirname, 'sdk_scripts', 'webmssdk.es5.js');
  if (fs.existsSync(sdkPath)) {
    const sdkCode = fs.readFileSync(sdkPath, 'utf-8');
    await page.evaluate(sdkCode);
    console.log('✅ 手动注入 webmssdk.es5.js 完成');
    isReady = true;
  } else {
    console.log('❌ SDK 文件不存在，签名将返回空值');
    isReady = true; // 还是允许服务启动
  }
}

// ─── 签名缓存（复用同参数的最近签名）───────────────
const signCache = new Map(); // urlKey → { a_bogus, ts }
const CACHE_TTL = 30 * 1000; // 30 秒内复用

// ─── 核心签名函数 ───────────────────────────────────
async function signUrl(targetUrl) {
  if (!page || !isReady) throw new Error('签名浏览器未就绪');

  // 简单缓存 key（只取 path+固定参数）
  const urlObj = new URL(targetUrl);
  const cacheKey = urlObj.pathname + '|' + urlObj.searchParams.get('aweme_id');
  const cached = signCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { a_bogus: cached.a_bogus, method: 'cache' };
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      page.removeListener('request', onRequest);
      resolve({ a_bogus: '', method: 'timeout' });
    }, 6000);

    // 用 Playwright request 事件拦截 SDK 签名后的真实请求
    function onRequest(req) {
      const reqUrl = req.url();
      if (reqUrl.includes(urlObj.pathname) && reqUrl.includes('a_bogus=')) {
        clearTimeout(timer);
        page.removeListener('request', onRequest);
        const match = reqUrl.match(/[?&]a_bogus=([^&]+)/);
        const abogus = match ? decodeURIComponent(match[1]) : '';
        signCache.set(cacheKey, { a_bogus: abogus, ts: Date.now() });
        resolve({ a_bogus: abogus, method: 'request-intercept' });
      }
    }

    page.on('request', onRequest);

    // 在页面内触发 fetch，SDK 会自动签名
    page.evaluate((u) => {
      fetch(u).catch(() => {});
    }, targetUrl).catch(e => {
      clearTimeout(timer);
      page.removeListener('request', onRequest);
      reject(e);
    });
  });
}

// ─── HTTP 服务器 ───────────────────────────────────
function startServer() {
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    // 健康检查
    if (parsed.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ready: isReady }));
      return;
    }

    // 签名接口
    // GET /sign?url=<encoded_url>&ua=<encoded_ua>
    if (parsed.pathname === '/sign') {
      const targetUrl = parsed.query.url;
      const ua = parsed.query.ua || '';

      if (!targetUrl) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'url 参数必填' }));
        return;
      }

      try {
        const result = await signUrl(targetUrl);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // 更新 Cookie（Go 提交新 cookie 时调用）
    if (parsed.pathname === '/update-cookie' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { cookie } = JSON.parse(body);
          const context = page.context();
          await context.clearCookies();
          await context.addCookies(parseCookieString(cookie, '.douyin.com'));
          await context.addCookies(parseCookieString(cookie, 'www.douyin.com'));
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
        } catch(e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`\n✅ 签名服务已启动: http://127.0.0.1:${PORT}`);
    console.log('接口说明:');
    console.log(`  GET  /sign?url=<url>  → 返回 {a_bogus, method}`);
    console.log(`  GET  /health          → 服务健康检查`);
    console.log(`  POST /update-cookie   → 更新 Cookie\n`);
  });

  // 优雅退出
  process.on('SIGINT', async () => {
    console.log('\n关闭服务...');
    if (browser) await browser.close();
    server.close();
    process.exit(0);
  });
}

// ─── 入口 ───────────────────────────────────────────
(async () => {
  startServer();
  await startBrowser();
  console.log('\n🎉 签名微服务就绪！');
  console.log('测试命令:');
  console.log(`  curl "http://127.0.0.1:${PORT}/sign?url=https%3A%2F%2Fwww-hj.douyin.com%2Faweme%2Fv1%2Fweb%2Fcomment%2Flist%2F%3Fdevice_platform%3Dwebapp%26aid%3D6383%26aweme_id%3D7615062955545169202%26cursor%3D0%26count%3D10"`);
})();

function parseCookieString(str, domain) {
  return str.split(';').map(p => {
    const [n, ...r] = p.trim().split('=');
    return { name: n.trim(), value: r.join('=').trim(), domain, path: '/' };
  }).filter(c => c.name && c.value && c.name.length < 100 && c.value.length < 4096);
}
