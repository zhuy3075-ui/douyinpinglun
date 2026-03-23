/**
 * 策略：在已登录的页面内直接评估 JS 上下文，
 * 定位并导出 a_bogus 签名函数，保存为 goja 可运行的独立 JS。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let savedCookie = '';
try {
  const d = require('./captured_apis.json');
  const all = [...d.comments, ...d.videoSearch, ...d.dmSend, ...d.userInfo, ...d.other];
  savedCookie = all.find(c => c.requestHeaders?.cookie?.length > 100)?.requestHeaders?.cookie || '';
} catch(e) {}

const sdkDir = path.join(__dirname, 'sdk_scripts');
if (!fs.existsSync(sdkDir)) fs.mkdirSync(sdkDir);

const foundSDKs = new Map();

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  if (savedCookie) {
    await ctx.addCookies(parseCookieString(savedCookie, '.douyin.com'));
    await ctx.addCookies(parseCookieString(savedCookie, 'www.douyin.com'));
  }

  const page = await ctx.newPage();

  // ─── 捕获所有 JS 文件内容 ───
  await page.route('**', async (route) => {
    const req = route.request();
    const url = req.url();
    const res = await route.fetch();
    const ct = res.headers()['content-type'] || '';

    if (ct.includes('javascript') || url.match(/\.js(\?|$)/)) {
      try {
        const body = await res.text();
        const hits = ['a_bogus', 'webmssdk', 'byted_acrawler', 'msToken'].filter(k => body.includes(k));
        if (hits.length >= 2 && !foundSDKs.has(url)) {
          foundSDKs.set(url, body);
          const fname = (url.split('/').pop().split('?')[0] || 'sdk.js').replace(/[^a-z0-9._-]/gi, '_');
          fs.writeFileSync(path.join(sdkDir, fname), body);
          console.log(`🎯 SDK: ${fname} (${(body.length/1024).toFixed(0)}KB) hits=${hits.join(',')}`);
        }
      } catch(_) {}
    }
    await route.fulfill({ response: res });
  });

  console.log('📂 打开抖音...');
  try {
    await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch(e) { console.log('加载超时，继续...'); }

  await page.waitForTimeout(4000);

  // ─── 搜索 window 上的签名对象 ───
  const stage1 = await page.evaluate(() => {
    const found = {};
    // 已知抖音签名挂载点
    const checks = [
      'window._byteSDK', 'window.byted_acrawler', 'window.__SIGN_SDK__',
      'window.webmssdk', 'window._JSSDK', 'window.__tea_sdk__'
    ];
    for (const expr of checks) {
      try {
        const v = eval(expr);
        if (v != null) {
          found[expr] = {
            type: typeof v,
            keys: typeof v === 'object' ? Object.keys(v).slice(0, 15) : String(v).substring(0, 100)
          };
        }
      } catch(_) {}
    }
    // 遍历 window 找 sign 相关
    found._matchedKeys = Object.keys(window).filter(k =>
      /sign|bogus|sdk|acrawler|byted|msdk/i.test(k)
    );
    return found;
  });
  console.log('\n=== Stage1: window 签名对象 ===');
  console.log(JSON.stringify(stage1, null, 2));

  // ─── 触发评论页，让 SDK 完全初始化 ───
  console.log('\n🎬 打开视频页...');
  try {
    await page.goto('https://www.douyin.com/video/7615062955545169202', {
      waitUntil: 'domcontentloaded', timeout: 20000
    });
  } catch(e) { console.log('超时，继续...'); }
  await page.waitForTimeout(5000);

  // ─── 再次搜索，并尝试调用 ───
  const stage2 = await page.evaluate(() => {
    const res = {
      matchedKeys: Object.keys(window).filter(k => /sign|bogus|sdk|acrawler|byted|msdk/i.test(k)),
      signAttempts: {}
    };

    // 尝试各种调用方式
    const testUrl = 'https://www-hj.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&aweme_id=7615062955545169202&cursor=0&count=10';

    const attempts = {
      byteSDK: () => window._byteSDK?.sign?.(testUrl),
      acrawler: () => window.byted_acrawler?.sign?.(testUrl),
      jssdk: () => window._JSSDK?.sign?.(testUrl),
      webmssdk: () => window.webmssdk?.sign?.(testUrl),
    };

    for (const [name, fn] of Object.entries(attempts)) {
      try {
        const r = fn();
        if (r) res.signAttempts[name] = { result: String(r).substring(0, 200), success: true };
      } catch(e) {
        res.signAttempts[name] = { error: e.message };
      }
    }

    // 搜索所有 window 对象的 sign 方法
    for (const key of res.matchedKeys) {
      try {
        const obj = window[key];
        if (obj && typeof obj.sign === 'function') {
          const r = obj.sign(testUrl);
          res.signAttempts[key] = { result: String(r).substring(0, 200), source: 'window.' + key + '.sign' };
        }
      } catch(e) {}
    }

    return res;
  });

  console.log('\n=== Stage2: 签名函数调用尝试 ===');
  console.log('matchedKeys:', stage2.matchedKeys.join(', '));
  console.log('signAttempts:', JSON.stringify(stage2.signAttempts, null, 2));

  // ─── 如果找到了可调用的签名函数，导出它 ───
  const workingSign = Object.entries(stage2.signAttempts).find(([_, v]) => v.success || v.result);
  if (workingSign) {
    console.log(`\n✅ 找到有效签名: ${workingSign[0]}`);

    // 提取签名函数的完整 JS 源代码
    const funcSource = await page.evaluate((key) => {
      try {
        const obj = window[key] || eval(key);
        if (obj && obj.sign) return obj.sign.toString();
      } catch(e) {}
      return null;
    }, workingSign[0]);

    if (funcSource) {
      console.log('函数源码(前500):', funcSource.substring(0, 500));
      fs.writeFileSync(path.join(sdkDir, 'sign_func.js'), `
// 抖音 a_bogus 签名函数 (从 ${workingSign[0]} 提取)
const sign = ${funcSource};
module.exports = { sign };
`);
    }
  } else {
    console.log('\n⚠️ 未能直接调用签名函数，分析已保存的 SDK 文件...');
  }

  // ─── 保存报告 ───
  const report = {
    sdkFilesFound: [...foundSDKs.keys()].map(u => u.split('/').pop().split('?')[0]),
    stage1, stage2, workingSign: workingSign?.[0] || null
  };
  fs.writeFileSync(path.join(__dirname, 'abogus_report.json'), JSON.stringify(report, null, 2));

  console.log(`\n📦 已保存 ${foundSDKs.size} 个 SDK 文件到 sdk_scripts/`);
  fs.readdirSync(sdkDir).forEach(f => {
    const sz = fs.statSync(path.join(sdkDir, f)).size;
    console.log(`  ${f}: ${(sz/1024).toFixed(0)}KB`);
  });

  await browser.close();
  console.log('\n完成！');
})();

function parseCookieString(str, domain) {
  return str.split(';').map(p => {
    const [n, ...r] = p.trim().split('=');
    return { name: n.trim(), value: r.join('=').trim(), domain, path: '/' };
  }).filter(c => c.name && c.value && c.name.length < 100 && c.value.length < 4096);
}
