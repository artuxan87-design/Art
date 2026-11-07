'use strict';
// Публичные страницы сайта. Данные берутся из content/*.json при каждом запросе,
// поэтому правки в этих файлах видны сразу после обновления страницы.
const fs = require('fs');
const path = require('path');

const S = require('../lib/seo');
const R = require('../lib/richtext');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rub = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
const price = (p, from) => p == null ? '<span class="tbd">Цена уточняется</span>' : (from ? 'от ' : '') + rub(Math.round(p / 100));
const term = t => t == null ? 'срок уточняется' : esc(t);

function files() { return { site: read('site.json'), solutions: read('solutions.json'), services: read('services.json'), cases: read('cases.json'), blog: read('blog.json') }; }

function load(store) {
  const base = read('solutions.json');
  return { settings: store.s, site: { ...store.c.site, steps: files().site.steps }, sol: { categories: base.categories, base: base.base, items: store.c.solutions }, srv: { items: store.c.services }, cases: { items: store.c.cases }, posts: store.publishedPosts(), allPosts: store.c.posts || [] };
}

// Что владельцу осталось заполнить: список {text, href}
function missing(d, store, paySettings) {
  const out = [], s = d.site, c = s.contacts;
  const add = (text, href) => out.push({ text, href });
  if (!store.d.admin.passHash) add('Задать свой пароль администратора', '/admin/settings');
  if (!s.domain) add('Указать домен сайта (до этого сайт закрыт от поисковиков)', '/admin/site');
  if (!c.telegram && !c.whatsappPhone && !c.email) add('Указать контакты для связи: Telegram, WhatsApp или e-mail', '/admin/site');
  if (!s.operator.name || !s.operator.inn) add('Заполнить реквизиты оператора персональных данных (ФИО или название, ИНН)', '/admin/site');
  if (!d.allPosts.some(p => p.published)) add('Написать первую статью в блог: про каждое решение, для кого оно и чем полезно', '/admin/posts');
  if (!(s.seo && s.seo.metrikaId)) add('Подключить Яндекс Метрику: указать номер счётчика', '/admin/site');
  if (!(s.seo && s.seo.yandexVerification)) add('Подтвердить сайт в Яндекс Вебмастере: вставить код проверки', '/admin/site');
  const noPrice = d.sol.items.filter(i => i.price == null).length;
  if (noPrice) add(`Указать цены решений (без цены: ${noPrice})`, '/admin/solutions');
  const noSrv = d.srv.items.filter(i => i.price == null).length;
  if (noSrv) add(`Указать цены услуг (без цены: ${noSrv})`, '/admin/services');
  if (d.sol.items.some(i => i.status === 'ready' && !i.demoUrl)) add('Добавить ссылку на демо у готовых решений', '/admin/solutions');
  const real = paySettings.available.filter(p => p.id !== 'test');
  if (!real.length) add('Подключить оплату: ввести ключи ЮKassa, Робокассы или другого провайдера', '/admin/payments');
  if (paySettings.testMode && real.length) add('Выключить тестовый режим оплаты, когда проверите платёж', '/admin/payments');
  if (!paySettings.baseUrl && real.length) add('Указать адрес сайта (https://...) для уведомлений от банка', '/admin/payments');
  return out;
}

function layout(d, { title, rawTitle, desc, depth, active, body, noindex, image, type, jsonld, published, modified }) {
  const r = '/';
  const nav = [['solutions/', 'Решения'], ['services/', 'Доп. услуги'], ['blog/', 'Блог'], ['partners/', 'Партнёрам'], ['cases/', 'Кейсы'], ['about/', 'Обо мне']];
  const c = d.site.contacts;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${S.head({ site: d.site, base: d.base || '', path: d.path || '/', title: rawTitle || (title ? title + ' — ' + d.site.name : ((d.site.seo && d.site.seo.title) || d.site.name + ': ' + d.site.role)), desc: desc || (d.site.seo && d.site.seo.description), image, type, noindex: noindex || !d.open || /^\/(admin|partner|pay|demo)(\/|$)/.test(d.path || '/'), jsonld: jsonld || [], published, modified })}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r}assets/style.css">
<link rel="icon" href="${r}assets/favicon.svg" type="image/svg+xml">
${S.metrika(d.site.seo && d.site.seo.metrikaId)}
</head>
<body>
<header class="top">
  <div class="wrap top-in">
    <a class="logo" href="/"><span class="logo-mark">ЕА</span><span>${esc(d.site.name)}</span></a>
    <button class="burger" aria-label="Меню" aria-expanded="false"><span></span><span></span></button>
    <nav class="nav">
      ${nav.map(([h, t]) => `<a href="${r}${h}"${active === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
      <a class="btn btn-sm" href="${r}contact/">Оставить заявку</a>
    </nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div>
      <div class="logo"><span class="logo-mark">ЕА</span><span>${esc(d.site.name)}</span></div>
      <p class="muted">${esc(d.site.role)}</p>
    </div>
    <div class="foot-links">
      ${nav.map(([h, t]) => `<a href="${r}${h}">${t}</a>`).join('')}
      <a href="${r}contact/">Заявка</a>
      <a href="${r}privacy/">Политика обработки персональных данных</a>
    </div>
    <div class="foot-links">
      ${c.telegram ? `<a href="https://t.me/${esc(c.telegram)}">Telegram</a>` : ''}
      ${c.phone ? `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>` : ''}
      ${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
      ${c.city ? `<span class="muted">${esc(c.city)}</span>` : ''}
    </div>
  </div>
  <div class="wrap muted small">© ${new Date().getFullYear()} ${esc(d.site.name)}</div>
</footer>
<script src="${r}assets/main.js"></script>
</body>
</html>
`;
}

const V = require('../lib/visuals');
const { icon, badge: ibadge } = V;
const statusBadge = i => i.status === 'ready' ? '<span class="badge ok">Готово</span>' : '<span class="badge">Демо готовится</span>';
const rubK = k => rub(Math.round(k / 100));
const solIcon = i => i.icon || 'shop';
const demoLink = i => (i.demoUrl ? esc(i.demoUrl) : (i.demo && i.demo.products && i.demo.products.length ? `/demo/${esc(i.slug)}/` : ''));

// Превью сайта в рамке браузера: схема витрины в цветах решения (пример, не скриншот чужого проекта)
function preview(i, { big = false } = {}) {
  const a = V.accent(i.accent), dm = i.demo;
  if (!dm || !dm.products || !dm.products.length) return V.cover(i.cover, a, solIcon(i));
  const tiles = dm.products.slice(0, 3).map(p => `<div class="pv-tile"><div class="pv-img">${icon(p.icon || solIcon(i), big ? 30 : 22)}</div><b>${esc(p.name)}</b><span>${rubK(p.price)}</span></div>`).join('');
  return `<div class="pv acc-${a}${big ? ' pv-big' : ''}" aria-hidden="true"><div class="pv-bar"><i></i><i></i><i></i><span>${esc((dm.brand || 'shop').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'))}.ru</span></div>
<div class="pv-body"><div class="pv-hero"><div><b>${esc(dm.brand)}</b><small>${esc(dm.tagline)}</small></div><em>В корзину</em></div><div class="pv-grid">${tiles}</div></div></div>`;
}

function card(i, r) {
  const link = demoLink(i);
  return `<a class="card sol" href="/solutions/${i.slug}/" data-cat="${esc(i.category)}">
    <div class="card-img acc-${V.accent(i.accent)}">${preview(i)}<span class="card-ico">${icon(solIcon(i), 22)}</span></div>
    <div class="card-top">${statusBadge(i)}<span class="muted small">${esc(i.niche)}</span></div>
    <h3>${esc(i.title)}</h3>
    <p>${esc(i.summary)}</p>
    ${link ? '<div class="demo-chip">' + icon('globe', 16) + ' Есть демо</div>' : ''}
    <div class="card-foot"><span class="price">${price(i.price)}</span><span class="muted small">${term(i.term)}</span></div>
  </a>`;
}

// Окно кабинета партнёра (пример)
const mock = `<div class="mock" aria-hidden="true">
  <div class="mock-bar"><i></i><i></i><i></i><span>кабинет партнёра, пример</span></div>
  <div class="mock-body">
    <div class="mock-row"><div class="mock-stat"><b>12 480 ₽</b><small>начислено за месяц</small></div><div class="mock-stat"><b>37</b><small>покупателей по ссылке</small></div></div>
    <div class="mock-tree">
      <div class="node me">Вы</div>
      <div class="lvl"><div class="node">10 %</div><div class="node">10 %</div><div class="node">10 %</div></div>
      <div class="lvl"><div class="node s">4 %</div><div class="node s">4 %</div><div class="node s">4 %</div><div class="node s">4 %</div></div>
      <div class="lvl"><div class="node xs">2 %</div><div class="node xs">2 %</div><div class="node xs">2 %</div><div class="node xs">2 %</div><div class="node xs">2 %</div></div>
    </div>
    <div class="mock-link"><span>shop.ru/?ref=A7K3P2</span><em>копировать</em></div>
  </div>
  <div class="float f1">${icon('check', 16)} Заказ оплачен</div><div class="float f2">${icon('wallet', 16)} +1 200 ₽ партнёру</div>
</div>`;

// Цифры из реальных настроек программы
function facts(d, extra = []) {
  const s = d.settings, r = s.rates.solution, sum = r.l1 + r.l2 + r.l3;
  const list = [
    { icon: 'tree', value: '3', label: 'линии партнёров' },
    { icon: 'percent', value: `${r.l1}/${r.l2}/${r.l3} %`, label: 'ставки по линиям, сумма не больше 25 %' },
    { icon: 'clock', value: `${s.holdDays} дн.`, label: 'удержание до выплаты' },
    { icon: 'wallet', value: rubK(s.minPayout), label: 'минимальная выплата' },
  ].concat(extra);
  return `<div class="facts-band">${list.map(f => `<div class="fact">${ibadge(f.icon, 'indigo', 22)}<b>${esc(f.value)}</b><span>${esc(f.label)}</span></div>`).join('')}</div>`;
}

// Схема пути денег и клиента
function flow(d) {
  const f = d.sol.base.partnerFlow || [];
  return `<ol class="flow">${f.map((s, n) => `<li>${ibadge(s.icon, 'indigo', 24)}<b>${esc(s.title)}</b><span>${esc(s.text)}</span>${n < f.length - 1 ? `<i class="flow-arrow">${icon('arrow', 18)}</i>` : ''}</li>`).join('')}</ol>`;
}

// Линии и ставки с расчётом на примере (пример считается по настройкам)
function commissionViz(d, type = 'solution', sample = 100000) {
  const s = d.settings, r = s.rates[type], cap = 25, sum = r.l1 + r.l2 + r.l3;
  const rows = [['1-я линия', 'Вы привели клиента', r.l1], ['2-я линия', 'Клиента привёл партнёр, которого пригласили вы', r.l2], ['3-я линия', 'Следующий уровень цепочки', r.l3]];
  return `<div class="viz"><div class="viz-bars">${rows.map(([t, x, v], n) => `<div class="viz-row"><div class="viz-lbl"><b>${t}</b><small>${x}</small></div><div class="viz-track"><div class="viz-fill l${n + 1}" style="width:${Math.max(4, v / cap * 100)}%"></div></div><div class="viz-val">${v} %</div></div>`).join('')}</div>
  <div class="viz-total"><div class="viz-track"><div class="viz-fill all" style="width:${sum / cap * 100}%"></div></div><small>Сумма ставок ${sum} % из возможных ${cap} %</small></div>
  <div class="viz-example"><b>Пример расчёта</b><span>Заказ на ${rub(sample)}: 1-я линия получает ${rub(Math.round(sample * r.l1 / 100))}, 2-я ${rub(Math.round(sample * r.l2 / 100))}, 3-я ${rub(Math.round(sample * r.l3 / 100))}. Это ${rub(Math.round(sample * sum / 100))} на всех, остальное остаётся у владельца.</span></div></div>`;
}

function home(d) {
  const ready = d.sol.items.filter(i => i.status === 'ready').length;
  const k = d.cases.items.find(x => x.public);
  const why = [['users', 'Продают люди, а не реклама', 'Покупатели и консультанты рекомендуют товар по своей ссылке и получают процент. Вы платите только за состоявшиеся продажи.'], ['zap', 'Всё считается само', 'Кто привёл покупателя, сколько начислить каждой линии, что делать при возврате, когда выплачивать. Без таблиц и ручных расчётов.'], ['shield', 'Без серых схем', 'Вход бесплатный, обязательных закупок нет, вознаграждение только с оплаченных покупок. Ставки ограничены потолком 25 %.']];
  return layout(d, { depth: 0, active: '', body: `
<section class="hero">
  <div class="wrap hero-in">
    <div>
      <p class="eyebrow">${esc(d.site.role)}</p>
      <h1>Готовые сайты и магазины с партнёрской программой под вашу нишу</h1>
      <p class="lead">${esc(d.site.tagline)} Подключение оплаты и другие настройки считаются отдельно и известны до старта.</p>
      <div class="actions"><a class="btn" href="/solutions/">Смотреть решения</a><a class="btn btn-ghost" href="/contact/">Обсудить задачу</a></div>
      <ul class="facts"><li><b>Фикс</b>цена решения заранее</li><li><b>1–3</b>линии партнёров</li><li><b>${ready}</b>${ready === 1 ? 'решение готово' : 'решения готовы'}</li></ul>
    </div>
    ${mock}
  </div>
</section>

<section class="sec tight"><div class="wrap">${facts(d)}</div></section>

<section class="sec">
  <div class="wrap">
    <div class="sec-head"><h2>Витрина решений</h2><a href="/solutions/">Все решения →</a></div>
    <div class="grid">${d.sol.items.map(i => card(i, '/')).join('')}</div>
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    <h2>Как это работает</h2>
    <p class="muted">Путь клиента и денег в магазине с партнёрской программой.</p>
    ${flow(d)}
  </div>
</section>

<section class="sec">
  <div class="wrap">
    <h2>Почему магазин с партнёрской программой</h2>
    <div class="grid3">${why.map(([ic, t, x], n) => `<div class="point">${ibadge(ic, ['indigo', 'teal', 'orange'][n], 26)}<h3>${t}</h3><p>${x}</p></div>`).join('')}</div>
  </div>
</section>

<section class="sec alt">
  <div class="wrap">
    <h2>Как работаем</h2>
    <ol class="steps">${d.site.steps.map((s, n) => `<li><span class="step-ico">${icon(s.icon || 'check', 22)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol>
  </div>
</section>

${k ? `<section class="sec">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Кейс</p>
      <h2>${esc(k.title)}</h2>
      <p>${esc(k.task)}</p>
      ${metrics(k)}
      <a class="btn btn-ghost" href="/cases/">Подробнее</a>
    </div>
    <ul class="checks">${k.done.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  </div>
</section>` : ''}

<section class="sec alt"><div class="wrap split about-strip">
  <img src="/assets/img/evgeny.jpg" alt="${esc(d.site.name)}" width="220" height="293" loading="lazy">
  <div><p class="eyebrow">Кто делает</p><h2>${esc(d.site.name)}</h2><p>Делаю решения, которые бизнес запускает за дни и за понятные деньги. Один человек отвечает за всё: от выбора решения до запуска и поддержки.</p><a class="btn btn-ghost" href="/about/">Обо мне</a></div>
</div></section>

${d.posts.length ? `<section class="sec"><div class="wrap"><div class="sec-head"><h2>Блог</h2><a href="/blog/">Все статьи →</a></div><div class="grid">${d.posts.slice(0, 3).map(postCard).join('')}</div></div></section>` : ''}

${cta('/')}
`, jsonld: [S.business(d.site, d.base)] });
}

function metrics(k) {
  return k.metrics && k.metrics.length ? `<div class="metrics">${k.metrics.map(m => `<div class="metric"><b>${esc(m.value)}</b><span>${esc(m.label)}</span></div>`).join('')}</div>` : '';
}

function cta(r) {
  return `<section class="sec">
  <div class="wrap"><div class="cta">
    <div><h2>Нужен магазин под вашу нишу?</h2><p>Расскажите, что продаёте. Отвечу, какое решение подойдёт и что нужно настроить дополнительно.</p></div>
    <a class="btn btn-light" href="${r}contact/">Оставить заявку</a>
  </div></div>
</section>`;
}

function solutionsPage(d) {
  const r = '/';
  return layout(d, { title: 'Решения', depth: 1, active: 'solutions/', desc: 'Готовые решения по фиксированной цене: магазины с партнёрской программой под разные ниши.', body: `
<section class="page-head"><div class="wrap">
  <h1>Готовые решения</h1>
  <p class="lead">Цена решения фиксированная. У каждого решения есть демо, которое можно открыть и потрогать. Подключение оплаты, доставки, домена и другие настройки выбираете отдельно на странице <a href="${r}services/">доп. услуг</a>.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  ${d.sol.categories.map(c => `<h2 class="h3">${esc(c.name)}</h2><div class="grid">${d.sol.items.filter(i => i.category === c.id).map(i => card(i, r)).join('')}</div>`).join('')}
</div></section>
${cta(r)}` });
}

function solutionPage(d, i) {
  const r = '/';
  const b = d.sol.base;
  const extra = b.notIncluded.map(id => d.srv.items.find(s => s.id === id)).filter(Boolean);
  const link = demoLink(i);
  const demo = link
    ? `<a class="btn btn-ghost" href="${link}" ${i.demoUrl ? 'target="_blank" rel="noopener"' : ''}>${icon('globe', 18)} Открыть демо</a>`
    : `<a class="btn btn-ghost" href="${r}contact/?s=${encodeURIComponent(i.title)}&demo=1">Запросить демо</a>`;
  return layout(d, { title: i.title, depth: 2, active: 'solutions/', desc: i.summary, jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Решения', '/solutions/'], [i.title, '/solutions/' + i.slug + '/']]), { '@context': 'https://schema.org', '@type': 'Service', name: i.title, description: i.summary, provider: { '@id': d.base + '/#business' }, ...(i.price != null ? { offers: { '@type': 'Offer', price: String(Math.round(i.price / 100)), priceCurrency: 'RUB' } } : {}) }], body: `
<section class="page-head"><div class="wrap sol-head">
  <div>
    <p class="crumbs"><a href="${r}solutions/">Решения</a> / ${esc(i.niche)}</p>
    <h1>${esc(i.title)}</h1>
    <p class="lead">${esc(i.summary)}</p>
    ${i.example ? `<p class="muted">${esc(i.example)}</p>` : ''}
    <div class="sol-preview acc-${V.accent(i.accent)}">${preview(i, { big: true })}</div>
    ${link ? `<p class="small muted">${i.demoUrl ? 'Демо работает на отдельном адресе. Данные в нём вымышленные. Доступ в админку демо дам по запросу.' : 'Демо открывается по ссылке: можно положить товары в корзину, пройти тестовую оплату и увидеть, сколько получит партнёр. Данные вымышленные.'}</p>` : ''}
  </div>
  <aside class="buy">
    ${statusBadge(i)}
    <div class="buy-price">${price(i.price)}</div>
    <div class="muted">Срок: ${term(i.term)}</div>
    <a class="btn" href="${r}contact/?s=${encodeURIComponent(i.title)}">Заказать</a>
    ${demo}
    <p class="small muted">Оплата, доставка, домен и хостинг не входят в цену и подключаются отдельно.</p>
  </aside>
</div></section>

<section class="sec tight"><div class="wrap">
  <h2>Что входит</h2>
  <div class="grid3">${Object.entries(i.features || b.features).map(([h, list]) => `<div class="box feat">${ibadge(((i.featureIcons || b.featureIcons) || {})[h] || 'check', V.accent(i.accent), 24)}<h3>${esc(h)}</h3><ul class="checks">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
</div></section>

<section class="sec alt"><div class="wrap">
  <h2>Как работает партнёрская программа</h2>
  <p class="muted">Ставки, число линий, сроки удержания и минимальная выплата настраиваются в админке.</p>
  ${flow(d)}
  <div class="split viz-split"><div>${commissionViz(d, 'solution', 50000)}</div><ul class="checks">${b.partnerSteps.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
</div></section>

<section class="sec"><div class="wrap">
  <div class="sec-head"><h2>Подключается отдельно</h2><a href="${r}services/">Все услуги →</a></div>
  <div class="grid">${extra.map(s => `<div class="box svc">${ibadge(s.icon || 'sliders', s.accent || 'indigo', 24)}<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><div class="price">${price(s.price, s.from)}</div></div>`).join('')}</div>
</div></section>

${d.posts.filter(x => x.product === i.slug).length ? `<section class="sec alt"><div class="wrap"><h2>Статьи об этом решении</h2><div class="grid">${d.posts.filter(x => x.product === i.slug).map(postCard).join('')}</div></div></section>` : ''}
<section class="sec alt"><div class="wrap narrow">
  <h2>Вопросы и ответы</h2>
  ${b.faq.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
</div></section>
${cta(r)}` });
}

function servicesPage(d) {
  const r = '/';
  return layout(d, { title: 'Дополнительные услуги', depth: 1, active: 'services/', body: `
<section class="page-head"><div class="wrap">
  <h1>Дополнительные услуги</h1>
  <p class="lead">Всё, что зависит от вашего выбора: платёжный сервис, касса, доставка, домен. Берёте только нужное, цена известна заранее.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  <div class="grid svc-grid">${d.srv.items.map(s => `<div class="box svc acc-${V.accent(s.accent)}"><div class="svc-head">${ibadge(s.icon || 'sliders', s.accent || 'indigo', 26)}<div class="price">${price(s.price, s.from)}</div></div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('')}</div>
</div></section>
<section class="sec alt"><div class="wrap">
  <h2>Как подключается оплата</h2>
  <ol class="steps">${[['sliders', 'Выбираете сервис', 'ЮKassa, Робокасса, Т-Банк или другой. Помогаю выбрать по комиссии и вашему статусу.'], ['lock', 'Вводите ключи в админке', 'Ключи хранятся в зашифрованном виде и не видны целиком.'], ['check', 'Проверка подключения', 'Кнопка «Проверить подключение» и тестовый платёж до приёма денег.'], ['rocket', 'Включаете приём оплаты', 'Тестовый режим выключается одной галочкой.']].map(([ic, t, x]) => `<li><span class="step-ico">${icon(ic, 22)}</span><h3>${t}</h3><p>${x}</p></li>`).join('')}</ol>
</div></section>
${cta(r)}` });
}

function casesPage(d) {
  const r = '/';
  const items = d.cases.items.filter(c => c.public);
  return layout(d, { title: 'Кейсы', depth: 1, active: 'cases/', body: `
<section class="page-head"><div class="wrap"><h1>Кейсы</h1></div></section>
<section class="sec tight"><div class="wrap">
  ${items.map(c => `<article class="case">
    <div><h2>${esc(c.title)}</h2><p class="muted">${esc(c.client)}</p>
    ${metrics(c)}
    <h3>Задача</h3><p>${esc(c.task)}</p>
    <h3>Статус</h3><p>${esc(c.status)}</p></div>
    <div><h3>Что сделано</h3><ul class="checks">${c.done.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
  </article>`).join('')}
</div></section>
${cta(r)}` });
}

function aboutPage(d) {
  const r = '/';
  return layout(d, { title: 'Обо мне', depth: 1, active: 'about/', body: `
<section class="page-head"><div class="wrap about">
  <img src="${r}assets/img/evgeny.jpg" alt="${esc(d.site.name)}" width="454" height="605">
  <div>
    <h1>${esc(d.site.name)}</h1>
    <p class="lead">${esc(d.site.role)}.</p>
    <p>Делаю решения, которые бизнес может запустить быстро и за понятные деньги: сначала готовый продукт с фиксированной ценой, потом настройка под конкретную компанию.</p>
    <p>Первое направление: интернет-магазины со встроенной партнёрской программой. Покупатели и консультанты продают товар по личной ссылке, а система сама считает начисления по линиям, возвраты и выплаты.</p>
    <div class="actions"><a class="btn" href="${r}contact/">Написать мне</a><a class="btn btn-ghost" href="${r}solutions/">Решения</a></div>
  </div>
</div></section>` });
}

function contactPage(d, { s = '', demo = false, ref = '', errs = [], form = {} } = {}) {
  const r = '/';
  const sel = form.solution || s || '';
  const opts = d.sol.items.map(i => i.title).concat(['Другая задача']);
  return layout(d, { title: 'Заявка', depth: 1, active: 'contact/', body: `
<section class="page-head"><div class="wrap narrow">
  <h1>Оставить заявку</h1>
  <p class="lead">Коротко опишите задачу. Отвечу в течение рабочего дня.</p>
  ${errs.length ? `<div class="alert">${errs.map(e => `<div>${esc(e)}</div>`).join('')}</div>` : ''}
  <form class="form" method="post" action="/contact">
    <label>Имя<input name="name" required autocomplete="name" value="${esc(form.name)}"></label>
    <label>Телефон или ник в мессенджере<input name="contact" required autocomplete="tel" value="${esc(form.contact)}"></label>
    <label>Решение<select name="solution"><option value="">Пока не выбрал</option>${opts.map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
    <label>Что нужно<textarea name="text" rows="4" placeholder="Например: продаём корма, нужен магазин и партнёры-заводчики, оплата через ЮKassa">${esc(form.text || (demo ? 'Хочу посмотреть демо.' : ''))}</textarea></label>
    <label>Код партнёра, если вас пригласили<input name="code" value="${esc(form.code || ref)}" placeholder="необязательно" maxlength="12"></label>
    <label class="check"><input type="checkbox" name="consent" value="1" required> <span>Согласен на обработку персональных данных по <a href="${r}privacy/" target="_blank">политике</a></span></label>
    <button class="btn" type="submit">Отправить заявку</button>
  </form>
</div></section>` });
}

function thanksPage(d, lead) {
  const c = d.site.contacts;
  const msg = encodeURIComponent(`Здравствуйте! Заявка №${lead.id} с сайта, ${lead.name}.`);
  const links = [
    c.telegram ? `<a class="btn btn-ghost" href="https://t.me/${esc(c.telegram)}">Написать в Telegram</a>` : '',
    c.whatsappPhone ? `<a class="btn btn-ghost" href="https://wa.me/${esc(c.whatsappPhone.replace(/\D/g, ''))}?text=${msg}">Написать в WhatsApp</a>` : '',
  ].join('');
  return layout(d, { title: 'Заявка принята', depth: 1, body: `
<section class="page-head"><div class="wrap narrow">
  <h1>Заявка №${lead.id} принята</h1>
  <p class="lead">Свяжусь с вами по контакту, который вы оставили.</p>
  ${links ? `<div class="actions">${links}</div>` : ''}
  <p><a href="/">На главную</a></p>
</div></section>` });
}

function privacyPage(d) {
  const o = d.site.operator;
  const v = x => x ? esc(x) : '<span class="tbd">уточняется</span>';
  return layout(d, { title: 'Политика обработки персональных данных', depth: 1, body: `
<section class="page-head"><div class="wrap narrow doc">
  <h1>Политика обработки персональных данных</h1>
  <p class="tbd-note">Черновик. Перед публикацией сайта заполнить реквизиты оператора и согласовать текст с юристом.</p>
  <h2>1. Оператор</h2>
  <p>${v(o.name)}, ИНН ${v(o.inn)}${o.ogrnip ? ', ОГРНИП ' + esc(o.ogrnip) : ''}, адрес: ${v(o.address)}. Политика опубликована во исполнение ч. 2 ст. 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».</p>
  <h2>2. Какие данные и зачем</h2>
  <p>Посетители, оставившие заявку: имя, телефон или ник в мессенджере, текст заявки, код партнёра. Цель: ответ на заявку, заключение и исполнение договора.</p>
  <p>Партнёры: ФИО, телефон, e-mail, пароль (хранится в виде хеша), сведения о налоговом статусе, ИНН и реквизиты для выплат. Цель: участие в партнёрской программе, расчёт и выплата вознаграждения, налоговый учёт.</p>
  <h2>3. Основание</h2>
  <p>Согласие субъекта, которое он даёт отметкой в форме (п. 1 ч. 1 ст. 6 и ст. 9 152-ФЗ), а также исполнение договора (п. 5 ч. 1 ст. 6).</p>
  <h2>4. Как обрабатываются</h2>
  <p>Данные хранятся в базе на сервере оператора на территории РФ (ч. 5 ст. 18 152-ФЗ). Передача третьим лицам: платёжному сервису и налоговым органам в объёме, необходимом для выплат и отчётности. Куки сайта хранят код пригласившего партнёра на срок, указанный в правилах программы, и сеанс входа в кабинет.</p>
  <h2>5. Срок</h2>
  <p>Заявки: до достижения цели или отзыва согласия, но не дольше 1 года. Данные партнёров: на время участия и далее в пределах сроков, установленных налоговым и бухгалтерским законодательством.</p>
  <h2>6. Права субъекта</h2>
  <p>Получить сведения об обработке, потребовать уточнения или удаления данных, отозвать согласие (ст. 14 и ч. 2 ст. 9 152-ФЗ). Запрос направляется по контактам на сайте.</p>
</div></section>` });
}


// ---------- Блог ----------
const dateRu = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const crumbs = items => `<p class="crumbs">${items.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : esc(t)).join(' / ')}</p>`;

function postCard(p) {
  return `<a class="card post-card" href="/blog/${esc(p.slug)}/">
    ${p.cover ? `<div class="card-img"><img class="photo" src="${esc(p.cover)}" alt="${esc(p.title)}" loading="lazy" decoding="async"></div>` : ''}
    <div class="card-top"><span class="muted small">${esc(dateRu(p.date))}</span></div>
    <h3>${esc(p.title)}</h3><p>${esc(p.excerpt || R.plain(p.body, 140))}</p>
  </a>`;
}

function blogPage(d, { tag = '' } = {}) {
  const posts = d.posts;
  return layout(d, { title: 'Блог', active: 'blog/', desc: 'Статьи о готовых решениях для бизнеса: что это, зачем нужно, для кого подходит и чем полезно.', body: `
<section class="page-head"><div class="wrap">
  ${crumbs([['Главная', '/'], ['Блог']])}
  <h1>Блог</h1>
  <p class="lead">О каждом решении: что это, зачем нужно, для кого и чем полезно.</p>
</div></section>
<section class="sec tight"><div class="wrap">
  ${posts.length ? `<div class="grid">${posts.map(postCard).join('')}</div>` : '<p class="lead">Статьи скоро появятся.</p>'}
</div></section>
${cta('/')}`, jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Блог', '/blog/']])] });
}

function postPage(d, p) {
  const site = d.site, url = `/blog/${p.slug}/`;
  const sol = p.product ? d.sol.items.find(x => x.slug === p.product) : null;
  const more = d.posts.filter(x => x.slug !== p.slug).slice(0, 3);
  const desc = p.seoDesc || p.excerpt || R.plain(p.body, 160);
  return layout(d, {
    rawTitle: (p.seoTitle || p.title) + ' — ' + site.name, desc, image: p.cover, type: 'article', published: p.date, modified: p.updated || p.date, active: 'blog/',
    body: `
<article class="page-head post"><div class="wrap narrow">
  ${crumbs([['Главная', '/'], ['Блог', '/blog/'], [p.title]])}
  <h1>${esc(p.title)}</h1>
  <p class="muted small"><time datetime="${esc(p.date)}">${esc(dateRu(p.date))}</time> · ${R.readMinutes(p.body)} мин чтения · ${esc(site.name)}</p>
  ${p.cover ? `<img class="photo wide" src="${esc(p.cover)}" alt="${esc(p.title)}" fetchpriority="high">` : ''}
  <div class="post-body">${R.render(p.body)}</div>
  ${(p.tags || []).length ? `<p class="tags">${p.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
</div></article>
${sol ? `<section class="sec"><div class="wrap narrow"><div class="cta"><div><h2>${esc(sol.title)}</h2><p>${esc(sol.summary)}</p></div><a class="btn btn-light" href="/solutions/${esc(sol.slug)}/">Смотреть решение</a></div></div></section>` : `<section class="sec"><div class="wrap narrow"><div class="cta"><div><h2>Нужен магазин под вашу нишу?</h2><p>Расскажите, что продаёте, и я подскажу подходящее решение.</p></div><a class="btn btn-light" href="/contact/">Оставить заявку</a></div></div></section>`}
${more.length ? `<section class="sec alt"><div class="wrap"><h2>Читайте также</h2><div class="grid">${more.map(postCard).join('')}</div></div></section>` : ''}`,
    jsonld: [S.breadcrumbs(d.base, [['Главная', '/'], ['Блог', '/blog/'], [p.title, url]]), {
      '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: desc, datePublished: p.date, dateModified: p.updated || p.date,
      ...(p.cover ? { image: S.abs(d.base, p.cover) } : {}),
      author: { '@type': 'Person', name: site.name }, publisher: { '@id': d.base + '/#business' }, mainEntityOfPage: d.base + url,
    }],
  });
}

function notFound(d) {
  return layout(d, { title: 'Страница не найдена', depth: 0, body: `<section class="page-head"><div class="wrap narrow"><h1>Страница не найдена</h1><p class="lead">Возможно, ссылка устарела.</p><a class="btn" href="/">На главную</a></div></section>` });
}

module.exports = { files, load, preview, facts, flow, commissionViz, demoLink, metrics, missing, layout, esc, rub, price, cta, home, solutionsPage, solutionPage, servicesPage, casesPage, blogPage, postPage, postCard, aboutPage, contactPage, thanksPage, privacyPage, notFound };
