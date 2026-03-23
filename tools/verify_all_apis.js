/**
 * 全量 API 可行性验证脚本
 * 覆盖：评论接口 / 视频搜索（全部筛选条件）/ IM 接口
 *
 * 运行方式：node tools/verify_all_apis.js
 * 前置条件：node_modules 已安装 (npm install)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── 配置 ────────────────────────────────────────
const COOKIE_FILE  = path.join(__dirname, '../data/captured_apis.json');
const REPORT_FILE  = path.join(__dirname, '../data/api_verify_report.json');
const TEST_VIDEO_ID = '7615062955545169202';
const TEST_KEYWORD  = '旅游';
const TIMEOUT_MS    = 15000;

// ─── 加载已保存 Cookie ────────────────────────────
let savedCookie = '';
try {
  const d = require(COOKIE_FILE);
  const all = [...(d.comments||[]), ...(d.videoSearch||[]), ...(d.dmSend||[]), ...(d.userInfo||[])];
  savedCookie = all.find(c => c.requestHeaders?.cookie?.length > 100)?.requestHeaders?.cookie || '';
} catch(e) {}

function parseCookieString(str, domain) {
  return str.split(';').map(p => {
    const [n, ...r] = p.trim().split('=');
    return { name: n.trim(), value: r.join('=').trim(), domain, path: '/' };
  }).filter(c => c.name && c.value && c.name.length < 100 && c.value.length < 4096);
}

// ─── 测试用例定义 ─────────────────────────────────
const COMMENT_CASES = [
  {
    id: 'comment_list_basic',
    label: '评论列表接口（基础）',
    url: `https://www-hj.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${TEST_VIDEO_ID}&cursor=0&count=10&item_type=0&version_code=170400&version_name=17.4.0`,
    check: r => r.status_code === 0 && Array.isArray(r.comments),
    extract: r => ({ total: r.total, count: r.comments?.length, has_more: r.has_more, cursor: r.cursor })
  },
  {
    id: 'comment_list_page2',
    label: '评论列表接口（翻页 cursor=10）',
    url: `https://www-hj.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${TEST_VIDEO_ID}&cursor=10&count=10&item_type=0&version_code=170400&version_name=17.4.0`,
    check: r => r.status_code === 0 && Array.isArray(r.comments),
    extract: r => ({ cursor_now: r.cursor, count: r.comments?.length, has_more: r.has_more })
  },
  {
    id: 'comment_reply',
    label: '评论回复接口（二级评论）',
    urlBuilder: async (page) => {
      // 先拉评论，找第一个有回复的评论ID
      const res = await page.evaluate(async (vid) => {
        try {
          const r = await fetch(`https://www-hj.douyin.com/aweme/v1/web/comment/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&aweme_id=${vid}&cursor=0&count=20&item_type=0&version_code=170400`);
          const text = await r.text();
          if (!text || !text.trim()) return null;
          return JSON.parse(text);
        } catch(e) { return null; }
      }, TEST_VIDEO_ID);
      const parent = res?.comments?.find(c => c.reply_comment_total > 0);
      if (!parent) return null;
      return `https://www-hj.douyin.com/aweme/v1/web/comment/list/reply/?device_platform=webapp&aid=6383&channel=channel_pc_web&item_id=${TEST_VIDEO_ID}&comment_id=${parent.cid}&cursor=0&count=3&version_code=170400`;
    },
    check: r => r.status_code === 0,
    extract: r => ({ reply_count: r.comments?.length, has_more: r.has_more })
  },
];

const SEARCH_CASES = [
  // ── 基础搜索 ──────────────────────────────
  { id: 'search_basic',         label: '视频搜索（默认，无筛选）',
    params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', search_source: 'normal_search', enable_history: 1, is_filter_search: 0 } },

  // ── 时间筛选（每次单独变化，其他为默认）──
  { id: 'search_time_1day',     label: '时间筛选=一天内',    params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 1 } },
  { id: 'search_time_1week',    label: '时间筛选=一周内',    params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 7 } },
  { id: 'search_time_1month',   label: '时间筛选=一个月',    params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 30 } },
  { id: 'search_time_6month',   label: '时间筛选=半年',      params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 180 } },
  { id: 'search_time_1year',    label: '时间筛选=一年',      params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 365 } },

  // ── 排序筛选 ──────────────────────────────
  { id: 'search_sort_digg',     label: '排序=最多点赞',      params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, sort_type: 1 } },
  { id: 'search_sort_comment',  label: '排序=最多评论',      params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, sort_type: 2 } },
  { id: 'search_sort_new',      label: '排序=最新发布',      params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, sort_type: 3 } },

  // ── 时长筛选 ──────────────────────────────
  { id: 'search_dur_1min',      label: '时长=1分钟以内',     params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, duration: 1 } },
  { id: 'search_dur_1_5min',    label: '时长=1-5分钟',       params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, duration: 2 } },
  { id: 'search_dur_5min_plus', label: '时长=5分钟以上',     params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, duration: 3 } },

  // ── 组合筛选 ──────────────────────────────
  { id: 'search_combo_1',       label: '组合：一周内+最多评论+1-5分钟',
    params: { keyword: TEST_KEYWORD, offset: 0, count: 10, search_channel: 'aweme_video_web', is_filter_search: 1, publish_time: 7, sort_type: 2, duration: 2 } },

  // ── 翻页验证 ──────────────────────────────
  { id: 'search_page2',         label: '翻页（offset=10）',  params: { keyword: TEST_KEYWORD, offset: 10, count: 10, search_channel: 'aweme_video_web', is_filter_search: 0 } },
  { id: 'search_count_20',      label: '每页数量=20',        params: { keyword: TEST_KEYWORD, offset: 0, count: 20, search_channel: 'aweme_video_web', is_filter_search: 0 } },
  { id: 'search_count_50',      label: '每页数量=50',        params: { keyword: TEST_KEYWORD, offset: 0, count: 50, search_channel: 'aweme_video_web', is_filter_search: 0 } },
];

const IM_CASES = [
  { id: 'im_unread',       label: 'IM未读消息数',        url: 'https://imapi.douyin.com/v1/client/unread_count',       method: 'POST', body: '{}' },
  { id: 'im_conv_list',    label: 'IM会话列表',          url: 'https://imapi.douyin.com/v1/conversation/list',          method: 'POST', body: '{}' },
  { id: 'im_stranger',     label: 'IM陌生人会话列表',    url: 'https://imapi.douyin.com/v1/stranger/get_conversation_list', method: 'POST', body: '{}' },
  { id: 'im_msg_init',     label: 'IM消息初始化',        url: 'https://imapi.douyin.com/v1/message/get_message_by_init', method: 'POST', body: '{}' },
  { id: 'im_user_info',    label: 'IM用户信息查询',      url: `https://www-hj.douyin.com/aweme/v1/web/im/user/info/?device_platform=webapp&aid=6383`, method: 'GET' },
  { id: 'im_heartbeat',    label: 'IM心跳保活',          url: `https://www-hj.douyin.com/aweme/v1/web/im/user/active/update/?device_platform=webapp&aid=6383`, method: 'GET' },
];

// ─── 核心执行函数 ─────────────────────────────────
async function callViaPage(page, url, method = 'GET', body = null) {
  return page.evaluate(async ({ url, method, body }) => {
    try {
      const opts = {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      };
      if (body) opts.body = body;
      const r = await fetch(url, opts);
      const ct = r.headers.get('content-type') || '';
      let data;
      if (ct.includes('json')) {
        data = await r.json();
      } else if (ct.includes('protobuf') || ct.includes('octet-stream')) {
        const buf = await r.arrayBuffer();
        data = { __protobuf: true, byteLength: buf.byteLength };
      } else {
        data = { __text: await r.text().then(t => t.substring(0, 500)) };
      }
      return { ok: r.ok, status: r.status, data, finalUrl: r.url };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }, { url, method, body });
}

function buildSearchUrl(params) {
  const base = 'https://www.douyin.com/aweme/v1/web/search/item/';
  const fixed = 'device_platform=webapp&aid=6383&channel=channel_pc_web&version_code=170400&version_name=17.4.0';
  const p = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${base}?${fixed}&${p}`;
}

function analyzeSearchResult(data, caseId) {
  if (!data || typeof data !== 'object') return { ok: false, reason: '响应不是JSON' };
  if (data.status_code !== 0) return { ok: false, reason: `status_code=${data.status_code}` };
  const list = data.aweme_list || [];
  const videos = list.filter(i => i.aweme_info).map(i => i.aweme_info);
  if (videos.length === 0) return { ok: true, warn: '返回0条视频（可能无结果）', count: 0 };

  // 提取第一个视频验证字段
  const v = videos[0];
  const coverUrl = v.video?.cover?.url_list?.[0] || v.cover?.url_list?.[0] || null;
  return {
    ok: true,
    count: videos.length,
    has_more: data.has_more,
    cursor: data.cursor,
    sample: {
      aweme_id: v.aweme_id,
      desc_len: v.desc?.length,
      like_count: v.statistics?.digg_count,
      comment_count: v.statistics?.comment_count,
      published_at: v.create_time,
      cover_url_found: !!coverUrl,
      cover_url_prefix: coverUrl?.substring(0, 60),
      tags: v.cha_list?.map(c => c.cha_name)?.slice(0,3),
      author_uid: v.author?.uid,
    }
  };
}

// ─── 主函数 ──────────────────────────────────────
(async () => {
  const report = {
    generated_at: new Date().toISOString(),
    cookie_length: savedCookie.length,
    results: {},
    summary: { total: 0, passed: 0, failed: 0, warned: 0 },
    confirmed_params: {}
  };

  console.log('\n🚀 启动 Playwright 浏览器...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });

  if (savedCookie) {
    await context.addCookies(parseCookieString(savedCookie, '.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'www.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'www-hj.douyin.com'));
    await context.addCookies(parseCookieString(savedCookie, 'imapi.douyin.com'));
    console.log(`✅ Cookie 注入完成 (${savedCookie.length} 字节)`);
  }

  const page = await context.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,svg,mp4,woff,woff2,ico}', r => r.abort());
  await page.route('**/webcast/**', r => r.abort());

  // 捕获所有请求，用于验证实际参数
  const capturedSearchRequests = [];
  page.on('request', req => {
    if (req.url().includes('/aweme/v1/web/search/item/')) {
      capturedSearchRequests.push(req.url());
    }
  });

  console.log('📂 加载抖音主页...');
  try {
    await page.goto('https://www.douyin.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch(e) {
    console.log('⚠️ 主页加载超时，继续测试');
  }

  // 验证登录状态
  const loginCheck = await callViaPage(page,
    'https://www-hj.douyin.com/aweme/v1/web/im/user/info/?device_platform=webapp&aid=6383&channel=channel_pc_web'
  );
  console.log('\n🔐 登录状态检查:', loginCheck.status, JSON.stringify(loginCheck.data)?.substring(0, 100));
  report.login_status = {
    http_status: loginCheck.status,
    status_code: loginCheck.data?.status_code,
    is_logged_in: loginCheck.data?.status_code === 0
  };

  // ── 评论接口验证 ──────────────────────────────────
  console.log('\n━━━ 评论接口验证 ━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const tc of COMMENT_CASES) {
    let url = tc.url;
    if (tc.urlBuilder) {
      url = await tc.urlBuilder(page);
      if (!url) { console.log(`⏭  ${tc.label}: 跳过（找不到有回复的评论）`); continue; }
    }

    await page.waitForTimeout(1500 + Math.random() * 1000);
    const res = await callViaPage(page, url);
    const ok = res.ok && !res.error && tc.check?.(res.data);
    const detail = ok ? tc.extract?.(res.data) : res.data?.status_code;
    const icon = ok ? '✅' : (res.data?.status_code === -2 ? '🔐' : '❌');

    console.log(`${icon} ${tc.label}`);
    console.log(`   HTTP: ${res.status}  status_code: ${res.data?.status_code}  detail: ${JSON.stringify(detail)}`);
    report.results[tc.id] = { label: tc.label, ok, status: res.status, api_status: res.data?.status_code, detail };
    report.summary.total++;
    ok ? report.summary.passed++ : (res.data?.status_code === -2 ? report.summary.failed++ : report.summary.failed++);
  }

  // ── 视频搜索接口验证（全部筛选条件）─────────────────
  console.log('\n━━━ 视频搜索接口验证（含全部筛选条件）━━━━━━━━');

  for (const tc of SEARCH_CASES) {
    await page.waitForTimeout(2000 + Math.random() * 1500); // 随机延迟
    const url = buildSearchUrl(tc.params);
    const res = await callViaPage(page, url);
    const analysis = analyzeSearchResult(res.data, tc.id);
    const icon = !res.ok ? '❌' : (analysis.ok ? (analysis.warn ? '⚠️' : '✅') : '❌');

    console.log(`${icon} ${tc.label}`);
    if (res.ok && res.data?.status_code !== undefined) {
      console.log(`   HTTP: ${res.status}  status_code: ${res.data.status_code}  count: ${analysis.count ?? '-'}  has_more: ${analysis.has_more ?? '-'}`);
      if (analysis.sample) {
        console.log(`   sample: aweme_id=${analysis.sample.aweme_id}  like=${analysis.sample.like_count}  cover_url=${analysis.sample.cover_url_found}`);
        console.log(`   tags: ${JSON.stringify(analysis.sample.tags)}  cover_prefix: ${analysis.sample.cover_url_prefix}`);
      }
      if (analysis.warn) console.log(`   ⚠️  ${analysis.warn}`);
    } else {
      console.log(`   HTTP: ${res.status}  error: ${res.error || JSON.stringify(res.data)?.substring(0, 100)}`);
    }

    // 收集实际参数值
    if (tc.params.publish_time !== undefined && analysis.ok) {
      report.confirmed_params.publish_time = report.confirmed_params.publish_time || {};
      report.confirmed_params.publish_time[tc.params.publish_time] = tc.label.split('=')[1];
    }
    if (tc.params.sort_type !== undefined && analysis.ok) {
      report.confirmed_params.sort_type = report.confirmed_params.sort_type || {};
      report.confirmed_params.sort_type[tc.params.sort_type] = tc.label.split('=')[1];
    }
    if (tc.params.duration !== undefined && analysis.ok) {
      report.confirmed_params.duration = report.confirmed_params.duration || {};
      report.confirmed_params.duration[tc.params.duration] = tc.label.split('=')[1];
    }

    report.results[tc.id] = {
      label: tc.label,
      params: tc.params,
      ok: !!(res.ok && analysis.ok),
      warn: analysis.warn,
      http_status: res.status,
      api_status: res.data?.status_code,
      count: analysis.count,
      has_more: analysis.has_more,
      sample: analysis.sample,
    };
    report.summary.total++;
    (!res.ok || !analysis.ok) ? report.summary.failed++ : (analysis.warn ? report.summary.warned++ : report.summary.passed++);
  }

  // ── IM 接口验证 ────────────────────────────────────
  console.log('\n━━━ IM 接口验证 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const tc of IM_CASES) {
    await page.waitForTimeout(1000 + Math.random() * 500);
    const res = await callViaPage(page, tc.url, tc.method, tc.body);
    const apiCode = res.data?.status_code ?? res.data?.code;
    const isProto = res.data?.__protobuf;
    const ok = res.ok && (isProto || apiCode === 0);
    const icon = ok ? '✅' : (apiCode === -2 ? '🔐' : '❌');

    console.log(`${icon} ${tc.label}`);
    if (isProto) {
      console.log(`   Protobuf 响应 ✅  大小: ${res.data.byteLength} bytes`);
    } else {
      console.log(`   HTTP: ${res.status}  status_code: ${apiCode}  resp: ${JSON.stringify(res.data)?.substring(0, 120)}`);
    }

    report.results[tc.id] = {
      label: tc.label,
      ok,
      http_status: res.status,
      api_status: apiCode,
      is_protobuf: isProto,
      proto_size: isProto ? res.data.byteLength : null,
      error: res.error
    };
    report.summary.total++;
    ok ? report.summary.passed++ : report.summary.failed++;
  }

  // ── 最终汇总 ──────────────────────────────────────
  await browser.close();

  // 从实际捕获的请求中补充参数验证
  report.actual_captured_search_urls = capturedSearchRequests.slice(0, 5);

  // 打印汇总
  console.log('\n' + '═'.repeat(60));
  console.log('📊 验证结果汇总');
  console.log('═'.repeat(60));
  console.log(`  总测试数: ${report.summary.total}`);
  console.log(`  ✅ 通过:  ${report.summary.passed}`);
  console.log(`  ⚠️  警告:  ${report.summary.warned}`);
  console.log(`  ❌ 失败:  ${report.summary.failed}`);

  if (Object.keys(report.confirmed_params).length > 0) {
    console.log('\n📋 已确认的搜索参数枚举值:');
    Object.entries(report.confirmed_params).forEach(([param, vals]) => {
      console.log(`  ${param}:`);
      Object.entries(vals).forEach(([k, v]) => console.log(`    ${k} = ${v}`));
    });
  }

  // 识别关键问题
  const failed = Object.entries(report.results).filter(([,v]) => !v.ok);
  if (failed.length > 0) {
    console.log('\n❌ 失败接口列表:');
    failed.forEach(([id, v]) => console.log(`  - ${v.label}: status=${v.api_status} http=${v.http_status}`));
  }

  // 保存报告
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 完整报告已保存到: ${REPORT_FILE}`);
})();
