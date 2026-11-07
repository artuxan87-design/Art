'use strict';
// Админка блога, фото и поисковых настроек. adminSite дополняет страницу из pages-app.js полями SEO.
const A = require('./pages-app');
const P = require('./pages');
const { esc } = P;
const { adminShell, inp, flash, errs, POST } = A;
const SCRIPT = '<script src="/assets/admin.js"></script>';

const imgField = (label, name, v, hint) => `<div class="imgfield"><label>${label}<input name="${name}" value="${esc(v || '')}" placeholder="Загрузите файл или вставьте ссылку https://..."></label>
<div class="imgrow"><label class="btn btn-ghost btn-sm upl">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-upload="${name}"></label><span class="upl-status muted small"></span>${v ? `<img class="thumb" src="${esc(v)}" alt="">` : ''}</div>${hint ? `<small class="muted">${hint}</small>` : ''}</div>`;

function adminSite(d, ctx, msg, e = []) {
  const seo = d.site.seo || {};
  const html = A.adminSite(d, ctx, msg, e);
  const si = d.site, ct = si.contacts || {};
  const dom = (Array.isArray(si.domains) && si.domains.length ? si.domains : P.DOMAINS).map(x => [x.title, x.text, (x.tags || []).join(', ')].join(' | ')).join('\n');
  const block = `<h3>Главная: статус и направления</h3>
<label class="check"><input type="checkbox" name="statusOn" value="1"${si.statusOn !== false ? ' checked' : ''}> <span>Показывать зелёный статус над заголовком</span></label>
${inp('Текст статуса', 'status', si.status || 'Принимаю новые проекты', { hint: 'Пишите только то, что правда сейчас. Например: «Беру новые проекты с декабря».' })}
${inp('Направления (каждое с новой строки: название | описание | теги через запятую)', 'domains', dom, { textarea: 1, rows: 6 })}
<h3>Быстрые ссылки на главной</h3>
${inp('GitHub', 'github', ct.github, { ph: 'https://github.com/...', hint: 'Только ссылка с https://. Пусто: ссылка не показывается.' })}${inp('Календарь для созвона', 'calendar', ct.calendar, { ph: 'https://...', hint: 'Ссылка на запись, например Calendly или Яндекс Календарь.' })}
<h3>Поиск (SEO)</h3>
<p class="muted small">Заголовок и описание каждой страницы формируются автоматически. Здесь общие значения для главной и подключение статистики.</p>
${inp('Заголовок главной в поиске (до 70 знаков)', 'seoTitle', seo.title)}${inp('Описание главной в поиске (до 160 знаков)', 'seoDescription', seo.description, { textarea: 1, rows: 2 })}
${imgField('Картинка для ссылок в соцсетях и мессенджерах', 'ogImage', seo.ogImage, 'Рекомендуемый размер 1200×630.')}
${inp('Номер счётчика Яндекс Метрики', 'metrikaId', seo.metrikaId, { inputmode: 'numeric', hint: 'Только цифры. Счётчик создаётся на metrika.yandex.ru.' })}
${inp('Код подтверждения Яндекс Вебмастера', 'yandexVerification', seo.yandexVerification, { hint: 'Содержимое поля content из мета-тега yandex-verification.' })}${inp('Код подтверждения Google Search Console', 'googleVerification', seo.googleVerification)}
`;
  const marker = '<button class="btn">Сохранить</button></form>';
  return html.includes(marker) ? html.replace(marker, block + marker).replace('</section>', SCRIPT + '</section>') : html;
}

function adminPosts(d, ctx, msg, e = []) {
  const items = (ctx.store.c.posts || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const sols = ctx.store.c.solutions;
  const form = (it, action, btn) => `<form class="box form post-form" method="post" action="${action}"><h3>${esc(it.title || 'Новая статья')} ${it.slug && !it.published ? '<span class="badge">черновик</span>' : ''}</h3>
${inp('Заголовок', 'title', it.title)}
<div class="trio">${inp('Дата публикации', 'date', it.date || new Date().toISOString().slice(0, 10), { type: 'date' })}${inp('Адрес страницы', 'slug', it.slug, { ph: 'создастся из заголовка', hint: 'Латиница и дефисы. После публикации не меняйте.' })}${inp('Метки через запятую', 'tags', (it.tags || []).join(', '))}</div>
<label>О каком решении статья<select name="product"><option value="">Общая статья</option>${sols.map(x => `<option value="${esc(x.slug)}"${it.product === x.slug ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select><small class="muted">Статья появится на странице решения и получит кнопку «Смотреть решение».</small></label>
${imgField('Главное фото статьи', 'cover', it.cover)}
${inp('Короткое описание для списка статей', 'excerpt', it.excerpt, { textarea: 1, rows: 2 })}
<label>Текст статьи
<div class="toolbar"><label class="btn btn-ghost btn-sm upl">Вставить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-insert-photo="body"></label><button type="button" class="btn btn-ghost btn-sm" data-insert="body" data-text="\\n\\n## Подзаголовок\\n\\n">Подзаголовок</button><button type="button" class="btn btn-ghost btn-sm" data-insert="body" data-text="\\n- пункт списка\\n- второй пункт\\n">Список</button><button type="button" class="btn btn-ghost btn-sm" data-video="body">Вставить видео</button><span class="upl-status muted small"></span></div>
<textarea name="body" id="body" rows="18">${esc(it.body)}</textarea>
<small class="muted">Пишите обычным текстом, абзацы разделяйте пустой строкой. Подзаголовок: «## Заголовок». Список: строки с «- ». Жирный: **слово**. Ссылка: [текст](https://адрес). Фото и видео вставляются кнопками выше.</small></label>
<h4>Для поисковиков</h4>${inp('Заголовок в поиске (необязательно)', 'seoTitle', it.seoTitle)}${inp('Описание в поиске (необязательно)', 'seoDesc', it.seoDesc, { textarea: 1, rows: 2 })}
<label class="check"><input type="checkbox" name="published" value="1"${it.published !== false ? ' checked' : ''}> <span>Опубликована (если не отмечено, статья остаётся черновиком)</span></label>
<div class="actions"><button class="btn btn-sm">${btn}</button>${it.slug ? ` <a class="btn btn-ghost btn-sm" href="/blog/${esc(it.slug)}/" target="_blank">Посмотреть на сайте</a>` : ''}</div></form>`;
  return adminShell(d, ctx, 'posts', `${flash(msg)}${errs(e)}${SCRIPT}<p class="muted">Описывайте в блоге каждый продукт: что это, зачем нужно, для кого и чем полезно. Это приводит посетителей из поиска.</p>
<h2>Добавить статью</h2>${form({ published: true }, '/admin/posts/new', 'Опубликовать')}
<h2>Статьи (${items.length})</h2>
${items.map(it => form(it, `/admin/posts/${it.slug}`, 'Сохранить') + POST(`/admin/posts/${it.slug}/delete`, '<button class="btn btn-ghost btn-sm" onclick="return confirm(\'Удалить статью?\')">Удалить статью</button>')).join('')}`);
}

function adminMedia(d, ctx, msg, files = []) {
  return adminShell(d, ctx, 'media', `${flash(msg)}${SCRIPT}<p class="muted">Все загруженные фото. Нажмите на адрес, чтобы скопировать, и вставьте в нужное поле. Фото до 6 МБ, форматы JPG, PNG, WEBP, GIF.</p>
<div class="box"><label class="btn upl">Загрузить фото<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden multiple data-library="1"></label> <span class="upl-status muted small"></span></div>
<div class="media-grid">${files.length ? files.map(f => `<figure class="media-item"><img src="${esc(f.url)}" alt="" loading="lazy"><input class="copy" readonly value="${esc(f.url)}" onclick="this.select()">${POST(`/admin/media/${f.name}/delete`, '<button class="btn btn-ghost btn-sm" onclick="return confirm(\'Удалить файл? Если он где-то используется, там фото пропадёт.\')">Удалить</button>')}</figure>`).join('') : '<p class="muted">Фото ещё нет.</p>'}</div>
<p class="muted small">Внимание: на бесплатном тарифе Render загруженные файлы пропадают при перезапуске сервера. На постоянном сервере (VPS) они сохраняются.</p>`);
}

module.exports = { adminSite, adminPosts, adminMedia };
