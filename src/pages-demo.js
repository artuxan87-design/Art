'use strict';
// Демо-магазин по ссылке /demo/<slug>/. Только просмотр: корзина и «оплата» работают в браузере,
// на сервер ничего не отправляется и нигде не сохраняется. Все имена, товары и суммы вымышленные.
const P = require('./pages');
const V = require('../lib/visuals');
const { esc, layout, rub } = P;
const { icon } = V;
const rubK = k => rub(Math.round(k / 100));

function tabs(i, active) {
  const t = [['', 'Витрина магазина', 'shop'], ['cabinet/', 'Кабинет партнёра', 'users'], ['admin/', 'Админка владельца', 'sliders']];
  return `<nav class="tabs demo-tabs">${t.map(([k, n, ic]) => `<a href="/demo/${esc(i.slug)}/${k}"${k === active ? ' aria-current="page"' : ''}>${icon(ic, 16)} ${n}</a>`).join('')}</nav>`;
}

function wrap(d, i, active, inner) {
  return layout(d, { title: `Демо: ${i.title}`, depth: 2, noindex: true, body: `
<section class="demo-banner"><div class="wrap">${icon('shield', 18)} <b>Демо-версия.</b> Магазин, товары, партнёры и суммы вымышленные, оплата тестовая, ничего не сохраняется. <a href="/solutions/${esc(i.slug)}/">О решении</a> · <a href="/contact/?s=${encodeURIComponent(i.title)}">Заказать</a></div></section>
<section class="page-head acc-${V.accent(i.accent)}"><div class="wrap"><h1>${esc(i.demo.brand)}: пример магазина</h1>${tabs(i, active)}${inner}</div></section>` });
}

function ratesOf(d) { const r = d.settings.rates.solution; return [r.l1, r.l2, r.l3]; }

function shop(d, i) {
  const dm = i.demo, r = ratesOf(d);
  const data = esc(JSON.stringify({ products: dm.products.map(p => ({ name: p.name, price: Math.round(p.price / 100) })), rates: r, hold: d.settings.holdDays }));
  return wrap(d, i, '', `
<div id="demo-shop" class="demo-shop acc-${V.accent(i.accent)}" data-demo="${data}">
  <div class="demo-hero"><div><b>${esc(dm.brand)}</b><span>${esc(dm.tagline)}</span></div><span class="demo-ref">${icon('link', 16)} ${esc(dm.brand.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'))}.ru/?ref=DEMO01</span></div>
  <div class="demo-cols">
    <div class="demo-grid">${dm.products.map((p, n) => `<div class="demo-item"><div class="demo-pic">${icon(p.icon || 'box', 40)}</div><h3>${esc(p.name)}</h3><div class="price">${rubK(p.price)}</div><button class="btn btn-sm" type="button" data-add="${n}">В корзину</button></div>`).join('')}</div>
    <aside class="demo-cart" aria-live="polite"><h3>${icon('cart', 20)} Корзина</h3><ul id="cart-list" class="plain"><li class="muted">Пока пусто. Добавьте товар.</li></ul><div class="demo-total">Итого: <b id="cart-total">0 ₽</b></div>
      <button class="btn" type="button" id="to-checkout" disabled>Оформить заказ</button>
      <div id="checkout" hidden><h3>Оплата</h3><label class="check"><input type="radio" name="pm" value="Банковская карта" checked> <span>Банковская карта</span></label><label class="check"><input type="radio" name="pm" value="СБП"> <span>СБП</span></label><label class="check"><input type="radio" name="pm" value="SberPay"> <span>SberPay</span></label>
        <p class="small muted">Тестовая оплата: деньги не списываются.</p><button class="btn" type="button" id="pay">Оплатить (тест)</button></div>
      <div id="done" class="flash" hidden></div></aside>
  </div>
  <div id="result" class="demo-result" hidden></div>
</div>
<script src="/assets/demo.js" defer></script>`);
}

function cabinet(d, i) {
  const dm = i.demo, r = ratesOf(d), pr = dm.products;
  const orders = [[pr[0]], [pr[1] || pr[0], pr[2] || pr[0]], [pr[0], pr[1] || pr[0]]].map(x => x.reduce((s, p) => s + p.price, 0));
  const rows = orders.map((base, n) => ({ n: 1041 + n, base, amount: Math.round(base * r[0] / 100), st: n === 0 ? 'выплачено' : n === 1 ? 'к выплате' : 'в удержании' }));
  const sum = st => rows.filter(x => x.st === st).reduce((s, x) => s + x.amount, 0);
  return wrap(d, i, 'cabinet/', `
<div class="demo-note">Так выглядит кабинет партнёра вашего магазина. Цифры примерные и считаются по ставкам решения.</div>
<div class="stats"><div class="stat"><b>${rubK(sum('к выплате'))}</b><span>к выплате сейчас</span></div><div class="stat"><b>${rubK(sum('в удержании'))}</b><span>в удержании (${d.settings.holdDays} дн.)</span></div><div class="stat"><b>${rubK(sum('выплачено'))}</b><span>выплачено</span></div><div class="stat"><b>3 / 2 / 1</b><span>партнёров по линиям</span></div></div>
<div class="box"><h3>Ваша ссылка</h3><input class="copy" readonly value="https://${esc(dm.brand.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-'))}.ru/?ref=DEMO01"><p class="muted small">Клиент закрепляется за партнёром по ссылке или коду.</p></div>
<div class="tblwrap"><table class="tbl"><thead><tr><th>Заказ</th><th>Линия</th><th>База</th><th>Ставка</th><th>Начислено</th><th>Статус</th></tr></thead><tbody>${rows.map(x => `<tr><td>№${x.n}</td><td>1</td><td>${rubK(x.base)}</td><td>${r[0]} %</td><td>${rubK(x.amount)}</td><td>${x.st}</td></tr>`).join('')}</tbody></table></div>
<h2>Как считаются линии</h2>${P.commissionViz(d, 'solution', 10000)}`);
}

function admin(d, i) {
  const pr = i.demo.products, r = ratesOf(d);
  const o = [[1043, 'Анна К.', pr[0].price + (pr[1] || pr[0]).price, 'ждёт оплаты'], [1042, 'Игорь П.', pr[0].price, 'оплачен'], [1041, 'Мария С.', (pr[2] || pr[0]).price, 'работа сдана']];
  return wrap(d, i, 'admin/', `
<div class="demo-note">Так выглядит админка владельца: заказы, партнёры, выплаты, ставки, ключи банков. В демо данные только для просмотра.</div>
<div class="stats"><div class="stat"><b>3</b><span>заказа</span></div><div class="stat"><b>${rubK(o.reduce((s, x) => s + x[2], 0))}</b><span>сумма заказов</span></div><div class="stat"><b>1</b><span>заявка на выплату</span></div><div class="stat"><b>4</b><span>партнёра</span></div></div>
<div class="tblwrap"><table class="tbl"><thead><tr><th>№</th><th>Клиент</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${o.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td><td>${rubK(x[2])}</td><td>${x[3]}</td></tr>`).join('')}</tbody></table></div>
<div class="grid3"><div class="box"><h3>${icon('percent', 20)} Ставки партнёрам</h3><p>1-я линия ${r[0]} %, 2-я ${r[1]} %, 3-я ${r[2]} %. Сумма не больше 25 %.</p></div><div class="box"><h3>${icon('card', 20)} Оплата</h3><p>Ключи ЮKassa, Робокассы и других банков вводятся в форме. Есть кнопка «Проверить подключение».</p></div><div class="box"><h3>${icon('box', 20)} Товары</h3><p>Каталог, цены и фото редактируются владельцем без программиста.</p></div></div>`);
}

module.exports = { shop, cabinet, admin };
