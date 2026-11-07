'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../server');

function client(port) {
  const jar = {};
  return async (method, path, form) => new Promise((resolve, reject) => {
    const body = form ? new URLSearchParams(form).toString() : '';
    const req = http.request({ port, path, method, headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}) } }, res => {
      for (const c of res.headers['set-cookie'] || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      let t = ''; res.on('data', x => t += x); res.on('end', () => resolve({ status: res.statusCode, text: t, location: res.headers.location }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('сквозной сценарий: партнёр, заявка по ссылке, заказ, оплата, начисление', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'adm-pass', secret: 's3cret' } });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  try {
    const partner = client(port), visitor = client(port), admin = client(port);

    let r = await partner('POST', '/partner/register', { name: 'Анна Партнёр', phone: '+7 900 111-22-33', email: 'a@t.ru', password: 'secret1', adult: '1', rules: '1', pd: '1' });
    assert.equal(r.status, 303);
    const code = store.d.partners[0].code;
    assert.equal((await partner('GET', '/partner')).status, 200);

    r = await visitor('GET', '/?ref=' + code);
    assert.equal(r.status, 200);
    r = await visitor('POST', '/contact', { name: 'Клиент', contact: 'tg_client', solution: 'Магазин косметики и ухода', consent: '1' });
    assert.equal(r.status, 200);
    assert.match(r.text, /Заявка №1 принята/);
    assert.equal(store.d.leads[0].cookieCode, code);
    r = await visitor('POST', '/contact', { name: 'К', contact: 'x' });
    assert.equal(r.status, 400);

    assert.match((await admin('GET', '/admin')).text, /Пароль/);
    assert.equal((await admin('POST', '/admin/login', { password: 'wrong' })).status, 400);
    assert.equal((await admin('POST', '/admin/login', { password: 'adm-pass' })).status, 303);
    r = await admin('POST', '/admin/leads/1/order', { use0: '1', type0: 'solution', title0: 'Магазин', amount0: '100 000', use1: '1', type1: 'service', title1: 'Оплата', amount1: '20000' });
    assert.equal(r.location, '/admin/orders/1');
    assert.equal((await admin('POST', '/admin/orders/1/pay', {})).status, 303);
    assert.equal(store.d.accruals.length, 1);
    assert.equal(store.d.accruals[0].amount, 1200000);
    assert.match((await partner('GET', '/partner/accruals')).text, /12\s000/);

    r = await admin('POST', '/admin/settings/rates', { type: 'solution', l1: '20', l2: '5', l3: '5' });
    assert.equal(r.status, 400);
    assert.match(r.text, /выше потолка/);
  } finally { server.close(); }
});

test('кабинет и админка закрыты без входа, сайт закрыт от индексации без домена', async () => {
  const { server } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.equal((await c('GET', '/partner')).location, '/partner/login');
    assert.equal((await c('POST', '/admin/orders/1/pay', {})).status, 200);
    assert.match((await c('GET', '/robots.txt')).text, /Disallow: \/\n/);
  } finally { server.close(); }
});

test('служебный адрес /healthz и демо-страницы решений', async () => {
  const { server } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.equal((await c('GET', '/healthz')).text, 'ok');
    for (const u of ['/demo/shop-cosmetics/', '/demo/shop-cosmetics/cabinet/', '/demo/shop-cosmetics/admin/', '/solutions/', '/solutions/site-kinolog/', '/partners/', '/services/', '/']) {
      const r = await c('GET', u);
      assert.equal(r.status, 200, u);
      assert.ok(/<svg/.test(r.text), 'графика на ' + u);
    }
    const demo = (await c('GET', '/demo/shop-cosmetics/')).text;
    assert.match(demo, /noindex/);
    assert.match(demo, /data-demo=/);
    assert.equal((await c('GET', '/demo/nope/')).status, 404);
    // демо не пишет данные
    assert.equal((await c('POST', '/demo/shop-cosmetics/', {})).status, 404);
  } finally { server.close(); }
});

test('все иконки и обложки из контента существуют', () => {
  const V = require('../lib/visuals');
  const f = require('../src/pages').files();
  for (const i of f.solutions.items) { assert.ok(V.ICONS[i.icon], i.slug); assert.ok(V.COVERS[i.cover], i.slug); assert.ok(V.ACCENTS[i.accent], i.slug); for (const p of ((i.demo && i.demo.products) || [])) assert.ok(V.ICONS[p.icon], p.name); }
  for (const s of f.services.items) assert.ok(V.ICONS[s.icon], s.id);
  for (const s of f.site.steps) assert.ok(V.ICONS[s.icon]);
  for (const s of f.solutions.base.partnerFlow) assert.ok(V.ICONS[s.icon]);
});

test('блог и SEO: страницы статей, карта сайта, закрытие без домена, микроразметка', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.match((await c('GET', '/')).text, /noindex/);
    for (const u of ['/blog/', '/blog/magazin-kosmetiki-s-partnerskoj-programmoj/', '/blog/kak-rabotaet-partnerskaya-programma-na-tri-linii/']) {
      const r = await c('GET', u);
      assert.equal(r.status, 200, u);
      assert.match(r.text, /<h1/); assert.match(r.text, /rel="canonical"/);
    }
    assert.equal((await c('GET', '/blog/net-takoj/')).status, 404);
    // статья показана на странице своего решения
    assert.match((await c('GET', '/solutions/shop-cosmetics/')).text, /Статьи об этом решении/);
    store.c.site.domain = 'ivan.ru'; store.c.site.seo.metrikaId = '777';
    const home = (await c('GET', '/')).text;
    assert.doesNotMatch(home, /content="noindex/);
    assert.match(home, /rel="canonical" href="https:\/\/ivan\.ru\/"/);
    assert.match(home, /"@type":"LocalBusiness"/);
    assert.match(home, /ym\(777/);
    const sm = (await c('GET', '/sitemap.xml')).text;
    assert.match(sm, /https:\/\/ivan\.ru\/blog\/kak-rabotaet-partnerskaya-programma-na-tri-linii\//);
    assert.doesNotMatch(sm, /admin|partner\/|pay\//);
    assert.match((await c('GET', '/blog/magazin-kosmetiki-s-partnerskoj-programmoj/')).text, /"@type":"Article"/);
    assert.match((await c('GET', '/partner/login')).text, /noindex/);
  } finally { server.close(); }
});

test('разметка статей экранирует опасное и встраивает видео только с разрешённых сайтов', () => {
  const R = require('../lib/richtext');
  const h = R.render('## Заголовок\n\n<script>alert(1)</script> **жирный**\n\n![подпись](javascript:alert(1))\n![ок](https://a.ru/x.jpg)\n@видео https://youtu.be/dQw4w9WgXcQ\n@видео https://evil.example/video\n[ссылка](javascript:alert(1))');
  assert.doesNotMatch(h, /<script/);
  assert.doesNotMatch(h, /(href|src)="javascript/);
  assert.match(h, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.doesNotMatch(h, /<iframe[^>]*evil/);
});

test('админка: статьи, черновики, загрузка фото с проверкой типа файла', async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-'));
  const { server, store } = createApp({ dataFile: path.join(dir, 'db.json'), config: { port: 0, adminPassword: 'adm', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const admin = client(port), visitor = client(port);
  try {
    await admin('POST', '/admin/login', { password: 'adm' });
    let r = await admin('POST', '/admin/posts/new', { title: 'Новая статья', body: '## Раздел\n\nТекст.', published: '1', product: 'shop-cosmetics' });
    assert.equal(r.status, 303);
    const slug = store.c.posts.at(-1).slug;
    assert.equal(slug, 'novaya-statya');
    assert.equal(store.post(slug).product, 'shop-cosmetics');
    assert.match((await visitor('GET', `/blog/${slug}/`)).text, /Текст\./);
    await admin('POST', `/admin/posts/${slug}`, { title: 'Новая статья', body: 'x', date: '2026-01-01' });
    assert.equal((await visitor('GET', `/blog/${slug}/`)).status, 404);
    assert.equal((await admin('GET', `/blog/${slug}/`)).status, 200);
    const login = await new Promise(resolve => { const q = http.request({ port, path: '/admin/login', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, res => resolve(res.headers['set-cookie'].map(x => x.split(';')[0]).join('; '))); q.end('password=adm'); });
    const upload = (buf, cookie) => new Promise((resolve, reject) => {
      const q = http.request({ port, path: '/admin/upload', method: 'POST', headers: { cookie, 'Content-Type': 'application/octet-stream', 'Content-Length': buf.length } }, res => { let t = ''; res.on('data', x => t += x); res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(t) })); });
      q.on('error', reject); q.end(buf);
    });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
    const ok = await upload(png, login);
    assert.equal(ok.status, 200);
    assert.equal((await visitor('GET', ok.json.url)).status, 200);
    assert.equal((await upload(Buffer.from('<script>alert(1)</script>'.repeat(5)), login)).status, 400);
    assert.equal((await upload(png, '')).status, 403);
    assert.equal((await visitor('GET', '/uploads/../server.js')).status, 404);
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('витрина: сайты для кинолога и агента, демо-ссылки, статьи о сегодняшней работе; новые позиции доходят до уже созданной базы', async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vit-'));
  const file = path.join(dir, 'db.json');
  // старая база: только прежние решения, без блога
  const first = createApp({ dataFile: file, config: { port: 0, adminPassword: 'x', secret: 's' } });
  first.store.c.solutions = first.store.c.solutions.filter(x => x.slug.startsWith('shop-'));
  delete first.store.c.seededSolutions; delete first.store.c.seededPosts;
  first.store.c.posts = [first.store.c.posts[first.store.c.posts.length - 1]];
  first.store.save();
  const { server, store } = createApp({ dataFile: file, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    assert.ok(store.c.solutions.some(x => x.slug === 'site-kinolog'));
    assert.ok(store.c.posts.some(x => x.slug === 'import-obyavlenij-s-avito-na-sajt-agenta'));
    const sol = (await c('GET', '/solutions/')).text;
    assert.match(sol, /Сайт кинолога и тренера/); assert.match(sol, /Сайт агента по недвижимости/);
    const k = (await c('GET', '/solutions/site-kinolog/')).text;
    assert.match(k, /https:\/\/kinolog-site-demo\.onrender\.com/);
    assert.match(k, /Блог и поиск/);
    assert.doesNotMatch(k, /корзину/);
    assert.match((await c('GET', '/solutions/site-realtor/')).text, /realtor-site-demo\.onrender\.com/);
    assert.match((await c('GET', '/blog/chto-sdelano-shablony-saitov-dlya-kinologa-i-agenta-nedvizhimosti/')).text, /Сайт агента/);
    // удалённая владельцем статья не возвращается после перезапуска
    store.deletePost('import-obyavlenij-s-avito-na-sajt-agenta');
    const again = createApp({ dataFile: file, config: { port: 0, adminPassword: 'x', secret: 's' } });
    assert.equal(again.store.post('import-obyavlenij-s-avito-na-sajt-agenta'), undefined);
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('убранные с витрины позиции удаляются и из старой базы, статьи о них тоже', async () => {
  const os = require('os'), fs = require('fs'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-'));
  const file = path.join(dir, 'db.json');
  const first = createApp({ dataFile: file, config: { port: 0, adminPassword: 'x', secret: 's' } });
  first.store.c.solutions.push({ slug: 'shop-tea', title: 'Чай', category: 'shop', status: 'soon' });
  first.store.c.posts.push({ slug: 'magazin-chaya-i-kofe-s-podpiskoj', title: 'Чай', date: '2026-01-01', body: 'x', published: true });
  first.store.save();
  const { store } = createApp({ dataFile: file, config: { port: 0, adminPassword: 'x', secret: 's' } });
  try {
    assert.equal(store.c.solutions.some(x => /shop-(tea|pets|handmade)/.test(x.slug)), false);
    assert.equal(store.c.posts.some(x => /chaya|zhivotn|handmade/.test(x.slug)), false);
    assert.ok(store.c.solutions.some(x => x.slug === 'shop-cosmetics'));
    assert.ok(store.c.solutions.some(x => x.slug === 'site-kinolog') && store.c.solutions.some(x => x.slug === 'site-realtor'));
    assert.equal(store.c.posts.length, 5);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('главная: статус, направления, кейс; быстрые ссылки только с https', async () => {
  const { server, store } = createApp({ dataFile: null, config: { port: 0, adminPassword: 'x', secret: 's' } });
  await new Promise(r => server.listen(0, r));
  const c = client(server.address().port);
  try {
    let t = (await c('GET', '/')).text;
    assert.match(t, /class="status"/); assert.match(t, /Проблема/); assert.match(t, /Три направления/);
    assert.doesNotMatch(t, /github\.com/);
    const base = { name: 'Евгений', role: 'р', tagline: 'т', statusOn: '', status: 'Беру проекты с декабря', domains: 'Один | Описание | a, b' };
    assert.ok(store.saveSite({ ...base, github: 'javascript:alert(1)' }).length);
    assert.deepEqual(store.saveSite({ ...base, github: 'https://github.com/x', calendar: 'https://cal.example/y' }), []);
    t = (await c('GET', '/')).text;
    assert.doesNotMatch(t, /class="status"/);
    assert.match(t, /href="https:\/\/github\.com\/x"/); assert.match(t, /Один/);
  } finally { server.close(); }
});
