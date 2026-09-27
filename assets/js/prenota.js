(function () {
  'use strict';

  // Prenotazione di un tavolo da La Marì Pizzeria.
  //
  // Il sito e' statico. Dove vanno le prenotazioni non e' ancora deciso
  // (backend Pubby, vedi _docs/form-pubby.md parte 2): finche' data-endpoint
  // e' vuoto il form non finge di aver salvato e mostra un errore.
  // Solo in locale (o con ?demo nell'indirizzo) simula un invio riuscito.

  // configurazione del locale: in futuro arriva dal backend (prenota.html?l=<slug>)
  var LOCALE = {
    nome: 'La Marì Pizzeria',
    // DA CONFERMARE col locale: fasce e giorno di chiusura
    fasce: ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30'],
    chiuso: [],          // giorni della settimana chiusi, 0 = domenica
    maxPersone: 12,
    giorniPrenotabili: 60,
    anticipoMinuti: 30   // oggi non si prenota una fascia che parte fra meno di mezz'ora
  };

  var form = document.getElementById('pr-form');
  if (!form) { return; }

  var endpoint = form.getAttribute('data-endpoint') || '';
  var demo = !endpoint && (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ||
    location.protocol === 'file:' || /[?&]demo\b/.test(location.search));

  var $ = function (id) { return document.getElementById(id); };
  var submit = $('pr-submit');
  var alertBox = $('pr-alert');
  var done = $('pr-done');

  var GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  var GIORNI_BREVI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

  // ---------- date nel fuso di Roma ----------
  // mai toISOString() su new Date(): e' in UTC e dopo mezzanotte da' il giorno prima
  function oggiRoma() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
  }
  function oraRoma() {
    return new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(new Date());
  }
  // le date "AAAA-MM-GG" si trattano a mezzogiorno UTC: nessun salto di fuso
  function aData(iso) { return new Date(iso + 'T12:00:00Z'); }
  function piuGiorni(iso, n) {
    var d = aData(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function giornoSett(iso) { return aData(iso).getUTCDay(); }
  function minuti(hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; }

  var OGGI = oggiRoma();
  var ULTIMO = piuGiorni(OGGI, LOCALE.giorniPrenotabili);

  function chiuso(iso) { return LOCALE.chiuso.indexOf(giornoSett(iso)) !== -1; }
  function fasceLibere(iso) {
    if (iso !== OGGI) { return LOCALE.fasce.slice(); }
    var ora = minuti(oraRoma()) + LOCALE.anticipoMinuti;
    return LOCALE.fasce.filter(function (f) { return minuti(f) >= ora; });
  }
  function prenotabile(iso) {
    return iso >= OGGI && iso <= ULTIMO && !chiuso(iso) && fasceLibere(iso).length > 0;
  }

  // ---------- giorni ----------
  var days = $('days');
  var altra = $('altra-data');
  altra.min = OGGI;
  altra.max = ULTIMO;

  function card(value, w, n, m, cls) {
    var label = document.createElement('label');
    label.className = 'pick day' + (cls ? ' ' + cls : '');
    var input = document.createElement('input');
    input.type = 'radio'; input.name = 'giorno'; input.value = value;
    var box = document.createElement('span');
    box.className = 'pick__box';
    [['day__w', w], ['day__n', n], ['day__m', m]].forEach(function (p) {
      var s = document.createElement('span');
      s.className = p[0]; s.textContent = p[1];
      box.appendChild(s);
    });
    label.appendChild(input);
    label.appendChild(box);
    days.appendChild(label);
    return input;
  }

  for (var i = 0; i < 7; i++) {
    var iso = piuGiorni(OGGI, i);
    var d = aData(iso);
    var w = i === 0 ? 'Oggi' : i === 1 ? 'Domani' : GIORNI_BREVI[d.getUTCDay()];
    var input = card(iso, w, String(d.getUTCDate()), chiuso(iso) ? 'chiuso' : MESI[d.getUTCMonth()].slice(0, 3));
    input.setAttribute('aria-label', (i < 2 ? w + ', ' : '') + GIORNI[d.getUTCDay()] + ' ' +
      d.getUTCDate() + ' ' + MESI[d.getUTCMonth()] + (chiuso(iso) ? ', chiuso' : ''));
    if (!prenotabile(iso)) { input.disabled = true; }
  }
  var altraRadio = card('altra', 'Altra', '…', 'data', 'day--other');
  altraRadio.setAttribute('aria-label', 'Altra data');

  // oggi di default; se oggi non si puo' (chiuso o orari finiti), il primo giorno libero
  var primo = days.querySelector('input:not(:disabled)');
  if (primo) { primo.checked = true; }

  // la riga sotto al titolo dice cosa e' successo davvero
  var nomePrimo = primo && primo.value === piuGiorni(OGGI, 1) ? 'domani' : 'il primo giorno libero';
  $('giorno-hint').textContent = prenotabile(OGGI)
    ? 'Oggi è già selezionato. Se vuoi prenotare per un altro giorno ti basta cliccarlo.'
    : (chiuso(OGGI) ? 'Oggi siamo chiusi' : 'Per stasera gli orari sono finiti') +
      ', quindi ti abbiamo messo ' + nomePrimo + '. Se vuoi prenotare per un altro giorno ti basta cliccarlo.';

  function giornoScelto() {
    var r = form.querySelector('input[name="giorno"]:checked');
    if (!r) { return ''; }
    return r.value === 'altra' ? altra.value : r.value;
  }

  // ---------- orari ----------
  var slots = $('slots');
  LOCALE.fasce.forEach(function (f) {
    var label = document.createElement('label');
    label.className = 'pick slot';
    var input = document.createElement('input');
    input.type = 'radio'; input.name = 'ora'; input.value = f;
    var box = document.createElement('span');
    box.className = 'pick__box';
    box.textContent = f;
    label.appendChild(input);
    label.appendChild(box);
    slots.appendChild(label);
  });

  function aggiornaFasce() {
    var g = giornoScelto();
    var libere = g ? fasceLibere(g) : LOCALE.fasce;
    var finite = g === OGGI && libere.length === 0;
    Array.prototype.forEach.call(slots.querySelectorAll('input'), function (input) {
      input.disabled = libere.indexOf(input.value) === -1;
      if (input.disabled) { input.checked = false; }
    });
    $('slots-none').hidden = !finite;
  }

  days.addEventListener('change', function () {
    var altraScelta = altraRadio.checked;
    $('other-day').hidden = !altraScelta;
    if (altraScelta && !altra.value) { altra.focus(); }
    aggiornaFasce();
  });
  altra.addEventListener('change', aggiornaFasce);
  aggiornaFasce();

  // ---------- persone ----------
  var persone = $('persone');
  function setPersone(n) {
    n = Math.max(1, Math.min(LOCALE.maxPersone, n));
    persone.value = String(n);
    $('persone-out').textContent = String(n);
    $('persone-meno').disabled = n <= 1;
    $('persone-piu').disabled = n >= LOCALE.maxPersone;
  }
  $('persone-meno').addEventListener('click', function () { setPersone(+persone.value - 1); });
  $('persone-piu').addEventListener('click', function () { setPersone(+persone.value + 1); });
  setPersone(2);

  // ---------- note ----------
  var note = $('note');
  note.addEventListener('input', function () {
    $('note-count').textContent = note.value.length + ' / 300';
  });

  // ---------- tastiera ----------
  // Safari su iPhone non chiude la tastiera se tocchi fuori dal campo:
  // la chiudiamo noi quando il tocco non cade su un altro controllo
  function scrive(el) {
    return el && (el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' && /^(text|tel|email|date|search|number)$/.test(el.type)));
  }
  // Su iPhone su una zona "vuota" non arrivano ne' click ne' pointer event
  // affidabili: si usano i touch, e si chiude solo se il dito non ha scrollato
  function chiudiSeFuori(target) {
    var el = document.activeElement;
    if (!scrive(el)) { return; }
    if (target.closest && target.closest('input, textarea, select, button, a, label')) { return; }
    el.blur();
  }
  var tocco = null;
  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    tocco = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    var t = e.changedTouches[0];
    if (!tocco || !t) { return; }
    var mosso = Math.abs(t.clientX - tocco.x) > 10 || Math.abs(t.clientY - tocco.y) > 10;
    tocco = null;
    if (!mosso) { chiudiSeFuori(e.target); }
  }, { passive: true });
  // col mouse (computer) basta il mousedown
  document.addEventListener('mousedown', function (e) { chiudiSeFuori(e.target); });

  // "Avanti" sulla tastiera passa al campo dopo invece di inviare il form.
  // Safari su iPhone a volte non manda il keydown dell'Invio e fa partire
  // direttamente l'invio implicito del form: per questo lo intercetto anche
  // nel submit (vedi avanti()), distinguendolo dal tocco vero sul pulsante
  var ordine = ['nome', 'telefono', 'email', 'note'];
  function avanti(el) {
    var i = ordine.indexOf(el && el.id);
    if (i === -1 || el.tagName !== 'INPUT') { return false; }
    $(ordine[i + 1]).focus();
    return true;
  }
  form.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.keyCode === 13) && avanti(e.target)) { e.preventDefault(); }
  });
  var toccatoInvia = false;
  ['touchstart', 'mousedown', 'keydown'].forEach(function (tipo) {
    submit.addEventListener(tipo, function () { toccatoInvia = true; }, { passive: true });
  });
  // un tocco sul pulsante seguito da uno scroll non deve valere per l'Invio dopo
  form.addEventListener('focusin', function (e) {
    if (e.target !== submit) { toccatoInvia = false; }
  });

  // ---------- invio ----------
  function setErr(id, msg) {
    var el = $('err-' + id);
    if (el) { el.textContent = msg || ''; }
    var input = $(id);
    if (input) { input.setAttribute('aria-invalid', msg ? 'true' : 'false'); }
  }

  function valori() {
    var ora = form.querySelector('input[name="ora"]:checked');
    return {
      giorno: giornoScelto(),
      ora: ora ? ora.value : '',
      persone: +persone.value,
      nome: $('nome').value.trim().replace(/\s+/g, ' '),
      telefono: $('telefono').value.replace(/[\s.\-\/()]/g, ''),
      email: $('email').value.trim().toLowerCase(),
      note: note.value.trim().slice(0, 300),
      marketing: $('marketing').checked,
      fonte: /instagram/i.test(navigator.userAgent) || /[?&]utm_source=ig/i.test(location.search) ? 'instagram' : 'sito'
    };
  }

  function valida(v) {
    var errori = {};
    if (!v.giorno) { errori.giorno = 'Scegli il giorno, sennò non sappiamo quando aspettarti.'; }
    else if (v.giorno < OGGI) { errori.giorno = 'Quel giorno è già passato.'; }
    else if (v.giorno > ULTIMO) { errori.giorno = 'Così avanti non prenotiamo ancora. Scegli una data più vicina.'; }
    else if (chiuso(v.giorno)) { errori.giorno = 'Quel giorno siamo chiusi.'; }
    if (!errori.giorno && fasceLibere(v.giorno).indexOf(v.ora) === -1) {
      errori.ora = "Scegli un orario, così ti teniamo il tavolo pronto.";
    }
    if (!v.nome) { errori.nome = 'A che nome teniamo il tavolo?'; }
    if (!/^\+?\d{8,15}$/.test(v.telefono)) { errori.telefono = 'Questo numero non ci torna.'; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) { errori.email = "Quest'email non ci torna."; }
    if (!$('consenso').checked) { errori.consenso = 'Ci serve il tuo ok per usare i dati.'; }
    return errori;
  }

  function mostraErrori(errori) {
    ['giorno', 'ora', 'nome', 'telefono', 'email', 'consenso'].forEach(function (k) {
      setErr(k, errori[k]);
    });
    var primo = (errori.giorno && form.querySelector('input[name="giorno"]:checked, input[name="giorno"]:not(:disabled)')) ||
      (errori.ora && slots.querySelector('input:not(:disabled)')) ||
      form.querySelector('[aria-invalid="true"]') ||
      (errori.consenso && $('consenso'));
    if (primo) { primo.focus(); }
  }

  // "oggi", "domani", "sabato", oltre la settimana "sabato 10 ottobre"
  function quando(iso) {
    if (iso === OGGI) { return 'oggi'; }
    if (iso === piuGiorni(OGGI, 1)) { return 'domani'; }
    var d = aData(iso);
    if (iso <= piuGiorni(OGGI, 6)) { return GIORNI[d.getUTCDay()]; }
    return GIORNI[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()];
  }
  function dataLunga(iso) {
    var d = aData(iso);
    var g = GIORNI[d.getUTCDay()];
    return g.charAt(0).toUpperCase() + g.slice(1) + ' ' + d.getUTCDate() + ' ' + MESI[d.getUTCMonth()];
  }

  function conferma(v) {
    $('done-when').textContent = 'Ti aspettiamo ' + quando(v.giorno) + ' alle ' + v.ora + '.';
    $('done-table').textContent = v.persone === 1 ? 'Tavolo per 1' : 'Tavolo per ' + v.persone;
    $('done-date').textContent = dataLunga(v.giorno) + ' · ' + v.ora;
    $('done-name').textContent = 'A nome di ' + v.nome;
    form.hidden = true;
    done.hidden = false;
    $('intro').hidden = true;
    window.scrollTo(0, 0);
    done.focus({ preventScroll: true });
  }

  function invia(v) {
    if (demo) {
      return new Promise(function (ok) {
        setTimeout(function () { ok({ status: 200, body: { ok: true } }); }, 500);
      });
    }
    if (!endpoint) {
      return Promise.reject(new Error('endpoint non configurato'));
    }
    // formato da concordare col backend Pubby
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { status: res.status, body: body };
      });
    });
  }

  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.name === 'giorno' || t.id === 'altra-data') { setErr('giorno', ''); setErr('ora', ''); }
    else if (t.name === 'ora' || t.name === 'consenso') { setErr(t.name, ''); }
    else if (t.id && t.getAttribute('aria-invalid') === 'true') { setErr(t.id, ''); }
    alertBox.textContent = '';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Invio dalla tastiera su un campo di testo: si va al campo dopo, non si invia
    var dalPulsante = toccatoInvia || e.submitter === submit && document.activeElement === submit;
    toccatoInvia = false;
    if (!dalPulsante && avanti(document.activeElement)) { return; }
    alertBox.textContent = '';
    if ($('sito').value) { return; }

    var v = valori();
    var errori = valida(v);
    mostraErrori(errori);
    if (Object.keys(errori).length) { return; }

    submit.disabled = true;
    submit.textContent = 'Un attimo…';

    invia(v).then(function (r) {
      if (r.status === 409) {
        alertBox.textContent = 'Hai già un tavolo a quell\'ora. Tranquillo, ti abbiamo.';
        return;
      }
      if (r.status < 200 || r.status >= 300) { throw new Error('HTTP ' + r.status); }
      conferma(v);
    }).catch(function () {
      alertBox.textContent = 'Qualcosa non è andato. Riprova tra poco, o scrivici su Instagram @pubbyit.';
    }).then(function () {
      submit.disabled = false;
      submit.textContent = 'Prenota il tavolo';
    });
  });
})();
