(function () {
  var b = document.querySelector('.burger'), n = document.querySelector('.nav');
  if (b && n) b.addEventListener('click', function () {
    var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
})();

(function () {
  var b = document.querySelector('.theme-btn'); if (!b) return;
  b.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', nx = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', nx);
    try { localStorage.setItem('theme', nx); } catch (e) {}
  });
})();
