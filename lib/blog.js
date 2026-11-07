'use strict';
// Блог и поисковые настройки сайта. Статьи правятся в админке и хранятся в базе.
const { imageUrl } = require('./media');
const str = (v, n = 300) => String(v ?? '').trim().slice(0, n);
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const slugify = s => String(s).toLowerCase().split('').map(c => TR[c] !== undefined ? TR[c] : c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
const today = () => new Date().toISOString().slice(0, 10);

module.exports = function install(Store) {
  const origSaveSite = Store.prototype.saveSite;
  Object.assign(Store.prototype, {
    // Дополняет уже созданную базу блогом и поисковыми полями. Ничего не затирает.
    ensureBlog(files) {
      if (!this.d.content) return;
      let ch = false;
      if (!this.c.posts) { this.c.posts = []; this.c.seededPosts = []; ch = true; }
      // Новые стартовые статьи и решения из файлов добавляются один раз; удалённые владельцем не возвращаются
      if (!this.c.seededPosts) { this.c.seededPosts = this.c.posts.map(p => p.slug); ch = true; }
      for (const p of (files.blog && files.blog.items) || []) if (!this.c.seededPosts.includes(p.slug)) { this.c.seededPosts.push(p.slug); if (!this.c.posts.some(x => x.slug === p.slug)) this.c.posts.push({ ...p }); ch = true; }
      if (!this.c.seededSolutions) { this.c.seededSolutions = this.c.solutions.map(x => x.slug); ch = true; }
      for (const f of (files.solutions && files.solutions.items) || []) if (!this.c.seededSolutions.includes(f.slug)) { this.c.seededSolutions.push(f.slug); if (!this.c.solutions.some(x => x.slug === f.slug)) this.c.solutions.push(this.solFromFile(f)); ch = true; }
      if (!this.c.site.seo) { this.c.site.seo = { title: '', description: '', ogImage: '', metrikaId: '', yandexVerification: '', googleVerification: '' }; ch = true; }
      if (ch) this.save();
    },
    saveSite(f) {
      const e = origSaveSite.call(this, f);
      if (e.length) return e;
      Object.assign(this.c.site.seo, {
        title: str(f.seoTitle, 120), description: str(f.seoDescription, 300), ogImage: imageUrl(f.ogImage),
        metrikaId: str(f.metrikaId, 20).replace(/\D/g, ''),
        yandexVerification: str(f.yandexVerification, 80).replace(/[^\w-]/g, ''), googleVerification: str(f.googleVerification, 80).replace(/[^\w-]/g, ''),
      });
      this.save();
      return [];
    },
    post(slug) { return (this.c.posts || []).find(p => p.slug === slug); },
    publishedPosts() { return (this.c.posts || []).filter(p => p.published && p.date <= today()).sort((a, b) => (a.date < b.date ? 1 : -1)); },
    savePost(slug, f) {
      const title = str(f.title, 160);
      if (title.length < 3) return ['Заголовок не короче 3 символов'];
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(f.date, 10)) ? str(f.date, 10) : today();
      const posts = this.c.posts || (this.c.posts = []);
      let it = slug && posts.find(p => p.slug === slug);
      let want = slugify(str(f.slug, 60) || title);
      if (!it || it.slug !== want) { let s = want, n = 2; while (posts.some(p => p.slug === s && p !== it)) s = want + '-' + n++; want = s; }
      if (!it) { it = {}; posts.push(it); }
      const sol = str(f.product, 80);
      Object.assign(it, { slug: want, title, date, updated: today(), cover: imageUrl(f.cover), excerpt: str(f.excerpt, 300), product: this.c.solutions.some(x => x.slug === sol) ? sol : '', tags: str(f.tags, 200).split(',').map(x => x.trim()).filter(Boolean).slice(0, 6), body: String(f.body ?? '').slice(0, 60000), seoTitle: str(f.seoTitle, 120), seoDesc: str(f.seoDesc, 300), published: f.published === '1' || f.published === true || f.published === 'on' });
      this.log('admin', 'статья сохранена', title); this.save();
      return [];
    },
    deletePost(slug) { const a = this.c.posts || [], i = a.findIndex(p => p.slug === slug); if (i >= 0) { this.log('admin', 'статья удалена', a[i].title); a.splice(i, 1); this.save(); } },
  });
};
