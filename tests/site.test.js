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
    for (const u of ['/demo/shop-cosmetics/', '/demo/shop-cosmetics/cabinet/', '/demo/shop-cosmetics/admin/', '/solutions/', '/solutions/shop-pets/', '/partners/', '/services/', '/']) {
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
  for (const i of f.solutions.items) { assert.ok(V.ICONS[i.icon], i.slug); assert.ok(V.COVERS[i.cover], i.slug); assert.ok(V.ACCENTS[i.accent], i.slug); for (const p of i.demo.products) assert.ok(V.ICONS[p.icon], p.name); }
  for (const s of f.services.items) assert.ok(V.ICONS[s.icon], s.id);
  for (const s of f.site.steps) assert.ok(V.ICONS[s.icon]);
  for (const s of f.solutions.base.partnerFlow) assert.ok(V.ICONS[s.icon]);
});
