/**
 * 一键刷新抖音 Cookie
 *
 * 使用方法：
 *   node tools/refresh_cookie.js
 *   node tools/refresh_cookie.js <比特浏览器窗口ID>
 *
 * 功能：
 *   1. 连接比特浏览器窗口（通过 CDP）
 *   2. 检测当前登录状态
 *   3. 未登录时：打开窗口等待用户扫码，自动检测登录成功
 *   4. 提取完整 Cookie
 *   5. 保存到 data/cookie_store.json
 *   6. 推送到签名服务（如果正在运行）
 */

const { chromium } = require('playwright');
const http = require('http');
const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── 配置 ─────────────────────────────────────────
const BITBROWSER_API = 'http://127.0.0.1:54345';
const SIGNING_SERVER  = 'http://127.0.0.1:9527';
const COOKIE_STORE    = path.join(__dirname, '../data/cookie_store.json');
const VALIDATE_URL    = 'https://www-hj.douyin.com/aweme/v1/web/im/user/info/?device_platform=webapp&aid=6383&channel=channel_pc_web';

// ─── 工具：HTTP POST（给比特浏览器 API 用）──────────
function bitPost(apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1', port: 54345,
      path: apiPath, method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch(e) { reject(new Error('比特浏览器返回格式异常: ' + buf.slice(0,100))); }
      });
    });
    req.on('error', e => reject(new Error('比特浏览器API不可达（请确认比特浏览器已启动）: ' + e.message)));
    req.write(data);
    req.end();
  });
}

// ─── 工具：HTTP GET（用于验证 Cookie 有效性）──────
function httpGet(url, cookieStr) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'Referer': 'https://www.douyin.com/',
      }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
        catch(e) { resolve({ status: res.statusCode, data: null }); }
      });
    });
    req.on('error', () => resolve({ status: 0, data: null }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, data: null }); });
  });
}

// ─── 工具：询问用户输入 ────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── 工具：推送 Cookie 到签名服务 ─────────────────
function pushToSigningServer(cookieStr) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ cookie: cookieStr });
    const req = http.request({
      host: '127.0.0.1', port: 9527,
      path: '/update-cookie', method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false)); // 签名服务未启动不影响保存
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.write(data);
    req.end();
  });
}

// ─── 读取/保存配置 ─────────────────────────────────
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(COOKIE_STORE, 'utf-8'));
  } catch { return {}; }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(COOKIE_STORE), { recursive: true });
  fs.writeFileSync(COOKIE_STORE, JSON.stringify(store, null, 2), 'utf-8');
}

// ─── 主流程 ────────────────────────────────────────
(async () => {
  console.log('\n🍪 抖音 Cookie 一键刷新工具\n' + '─'.repeat(45));

  // 1. 确定要使用的比特浏览器窗口 ID
  const store = loadStore();
  let browserId = process.argv[2] || store.browser_id || '';

  if (!browserId) {
    console.log('首次使用，需要输入比特浏览器窗口 ID。');
    console.log('在比特浏览器中打开窗口列表，复制对应账号的"ID"列的值。');
    browserId = await ask('请输入窗口 ID: ');
    if (!browserId) {
      console.error('❌ 未输入窗口 ID，退出。');
      process.exit(1);
    }
  }

  console.log(`\n📋 使用窗口 ID: ${browserId}`);

  // 2. 通过比特浏览器 API 打开窗口
  console.log('⏳ 正在打开比特浏览器窗口...');
  let openRes;
  try {
    openRes = await bitPost('/browser/open', { id: browserId });
  } catch(e) {
    console.error('\n❌ ' + e.message);
    console.error('   请检查：');
    console.error('   1. 比特浏览器是否已启动（不是浏览器窗口，是比特浏览器主程序）');
    console.error('   2. 窗口 ID 是否正确');
    process.exit(1);
  }

  if (!openRes.success) {
    console.error('❌ 打开窗口失败:', JSON.stringify(openRes));
    console.error('   请确认窗口 ID 是否存在。');
    process.exit(1);
  }

  const ws = openRes.data?.ws;
  if (!ws) {
    console.error('❌ 未获取到 CDP 地址，API 返回:', JSON.stringify(openRes.data));
    process.exit(1);
  }
  console.log('✅ 窗口已打开');

  // 3. 通过 CDP 连接到浏览器
  console.log('⏳ 正在连接浏览器...');
  let browser, context, page;
  try {
    browser = await chromium.connectOverCDP(ws);
    context  = browser.contexts()[0];
    if (!context) {
      // 比特浏览器窗口可能还没有打开任何页面
      context = await browser.newContext();
    }
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  } catch(e) {
    console.error('❌ 连接浏览器失败:', e.message);
    process.exit(1);
  }
  console.log('✅ 浏览器连接成功');

  // 4. 检测当前登录状态
  console.log('\n🔍 正在检测登录状态...');

  const checkLogin = async () => {
    try {
      const cookies = await context.cookies(['https://www.douyin.com', 'https://www-hj.douyin.com']);
      const sessionid = cookies.find(c => c.name === 'sessionid');
      if (!sessionid || !sessionid.value) return { ok: false, reason: '无 sessionid' };

      // 拼成 cookie 字符串
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // 调用接口验证
      const result = await httpGet(VALIDATE_URL, cookieStr);
      if (result.status === 200 && result.data?.status_code === 0) {
        return { ok: true, cookieStr };
      }
      if (result.data?.status_code === -2) {
        return { ok: false, reason: 'session 已过期（status_code=-2）' };
      }
      return { ok: false, reason: `API 返回 status_code=${result.data?.status_code ?? result.status}` };
    } catch(e) {
      return { ok: false, reason: e.message };
    }
  };

  let loginCheck = await checkLogin();

  // 5. 未登录：引导用户在窗口中扫码登录
  if (!loginCheck.ok) {
    console.log(`\n⚠️  当前未登录或 Cookie 已过期 (${loginCheck.reason})`);
    console.log('📱 请在已打开的比特浏览器窗口中登录抖音（扫码/账号密码均可）');
    console.log('   登录完成后，本脚本会自动检测并提取 Cookie\n');

    // 先打开抖音首页，方便用户登录
    try {
      await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch { /* 超时不影响 */ }

    // 每 3 秒检测一次，最多等 5 分钟
    const maxWait = 300; // 秒
    const interval = 3;
    let waited = 0;
    process.stdout.write('⏳ 等待登录');

    while (waited < maxWait) {
      await new Promise(r => setTimeout(r, interval * 1000));
      waited += interval;
      process.stdout.write('.');
      loginCheck = await checkLogin();
      if (loginCheck.ok) break;
    }
    console.log('');

    if (!loginCheck.ok) {
      console.error(`\n❌ 等待超时（${maxWait} 秒），未检测到登录成功。`);
      await browser.close().catch(() => {});
      process.exit(1);
    }
  }

  // 6. 提取完整 Cookie
  console.log('\n✅ 登录状态正常，正在提取 Cookie...');
  const { cookieStr } = loginCheck;
  console.log(`   Cookie 长度: ${cookieStr.length} 字节`);

  // 打印关键字段
  const keyFields = ['sessionid', 'ttwid', 'odin_tt', 'msToken'];
  keyFields.forEach(k => {
    const found = cookieStr.includes(k + '=');
    console.log(`   ${found ? '✅' : '❌'} ${k}`);
  });

  // 7. 保存到 cookie_store.json
  const newStore = {
    ...store,
    browser_id:  browserId,
    cookie:      cookieStr,
    updated_at:  new Date().toISOString(),
    cookie_length: cookieStr.length,
  };
  saveStore(newStore);
  console.log(`\n💾 Cookie 已保存到: data/cookie_store.json`);

  // 8. 推送到签名服务（如果在运行）
  const pushed = await pushToSigningServer(cookieStr);
  if (pushed) {
    console.log('🔄 签名服务 Cookie 已同步更新');
  } else {
    console.log('ℹ️  签名服务未运行，下次启动时会自动读取新 Cookie');
  }

  // 9. 完成
  console.log('\n' + '─'.repeat(45));
  console.log('✅ Cookie 刷新完成！');
  console.log(`   窗口 ID: ${browserId}`);
  console.log(`   更新时间: ${newStore.updated_at}`);
  console.log('\n下次运行直接执行 node tools/refresh_cookie.js（无需重新输入 ID）\n');

  await browser.close().catch(() => {});
})();
