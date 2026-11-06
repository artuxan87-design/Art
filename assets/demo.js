(function () {
  var root = document.getElementById('demo-shop');
  if (!root) return;
  var data = JSON.parse(root.getAttribute('data-demo'));
  var qty = data.products.map(function () { return 0; });
  var list = document.getElementById('cart-list'), totalEl = document.getElementById('cart-total');
  var toCheckout = document.getElementById('to-checkout'), checkout = document.getElementById('checkout');
  var payBtn = document.getElementById('pay'), done = document.getElementById('done'), result = document.getElementById('result');
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; };
  var total = function () { return data.products.reduce(function (s, p, i) { return s + p.price * qty[i]; }, 0); };

  function render() {
    list.textContent = '';
    var any = false;
    data.products.forEach(function (p, i) {
      if (!qty[i]) return;
      any = true;
      var li = document.createElement('li');
      li.textContent = p.name + ' × ' + qty[i] + ': ' + fmt(p.price * qty[i]) + ' ';
      var minus = document.createElement('button');
      minus.type = 'button'; minus.className = 'qty'; minus.textContent = '−'; minus.setAttribute('aria-label', 'Убрать ' + p.name);
      minus.addEventListener('click', function () { qty[i] = Math.max(0, qty[i] - 1); render(); });
      li.appendChild(minus);
      list.appendChild(li);
    });
    if (!any) { var e = document.createElement('li'); e.className = 'muted'; e.textContent = 'Пока пусто. Добавьте товар.'; list.appendChild(e); }
    totalEl.textContent = fmt(total());
    toCheckout.disabled = !any;
    if (!any) checkout.hidden = true;
  }

  root.querySelectorAll('[data-add]').forEach(function (b) {
    b.addEventListener('click', function () { qty[Number(b.getAttribute('data-add'))]++; done.hidden = true; result.hidden = true; render(); });
  });
  toCheckout.addEventListener('click', function () { checkout.hidden = false; checkout.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });

  payBtn.addEventListener('click', function () {
    var sum = total(), r = data.rates, pm = root.querySelector('input[name=pm]:checked').value;
    var n = 1000 + Math.floor(Math.random() * 9000);
    done.hidden = false;
    done.textContent = 'Тестовая оплата прошла (' + pm + '). Заказ №' + n + ' на ' + fmt(sum) + '.';
    var lines = ['1-я линия: партнёр, по чьей ссылке пришёл клиент', '2-я линия: пригласивший его партнёр', '3-я линия: следующий по цепочке'];
    result.hidden = false;
    result.textContent = '';
    var h = document.createElement('h3'); h.textContent = 'Что получат партнёры с этого заказа'; result.appendChild(h);
    lines.forEach(function (t, i) {
      var row = document.createElement('div'); row.className = 'demo-line';
      var a = document.createElement('span'); a.textContent = t;
      var b = document.createElement('b'); b.textContent = r[i] + ' % = ' + fmt(sum * r[i] / 100);
      row.appendChild(a); row.appendChild(b); result.appendChild(row);
    });
    var note = document.createElement('p'); note.className = 'small muted';
    note.textContent = 'Начисление появится сразу после подтверждения оплаты банком, доступно к выплате через ' + data.hold + ' дн. после сдачи заказа. В демо ничего не сохраняется.';
    result.appendChild(note);
    qty = qty.map(function () { return 0; }); render(); checkout.hidden = true;
  });
  render();
})();
