(function () {
  var $ = function (id) { return document.getElementById(id); };

  var TRACK_KEY = 'Cityscape';
  var DIFF = 'casual';

  function formatBest(ms) {
    if (ms == null || isNaN(ms)) return '—';
    if (window.hexGL && hexGL.formatRaceTime) return hexGL.formatRaceTime(ms);
    var t = bkcore.Timer.msToTimeString(ms);
    var ms3 = ('000' + (parseInt(t.ms, 10) % 1000)).slice(-3);
    return t.m + "'" + t.s + "''" + ms3;
  }

  function refreshBestTime() {
    var el = $('best-time');
    if (!el) return;
    var raw = null;
    try { raw = localStorage['score-' + TRACK_KEY + '-' + DIFF]; } catch (e) {}
    if (raw != null) {
      el.innerHTML = 'Best: <strong>' + formatBest(parseFloat(raw)) + '</strong>';
    } else {
      el.innerHTML = 'Best: <strong>—</strong>';
    }
  }

  function goMainMenu() {
    window.location.reload();
  }

  function init(controlType, quality, hud, godmode) {
    var hexGL, progressbar, hint;
    try {
      hexGL = new bkcore.hexgl.HexGL({
        document: document,
        width: window.innerWidth,
        height: window.innerHeight,
        container: $('main'),
        overlay: $('overlay'),
        gameover: null,
        quality: quality,
        difficulty: 0,
        hud: hud === 1,
        controlType: controlType,
        godmode: godmode,
        track: TRACK_KEY
      });
    } catch (err) {
      console.error(err);
      window.location.href = 'webgl-check.html';
      return;
    }

    window.hexGL = hexGL;
    progressbar = $('progressbar');
    hint = $('race-hint');

    hexGL.load({
      onLoad: function () {
        hexGL.init();
        $('step-3').style.display = 'none';
        $('step-4').style.display = 'block';
        hexGL.start();
        hexGL.resize(window.innerWidth, window.innerHeight);
        if (hint) {
          hint.classList.add('is-visible');
          setTimeout(function () { hint.classList.remove('is-visible'); }, 4500);
        }
      },
      onError: function (s) {
        console.error('Error loading ' + s + '.');
      },
      onProgress: function (p) {
        progressbar.style.width = (p.loaded / p.total * 100) + '%';
      }
    });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.hexGL && typeof hexGL.resize === 'function') {
          hexGL.resize(window.innerWidth, window.innerHeight);
        }
      }, 100);
    });
  }

  // Utils must load before this file; keep a tiny fallback so menu clicks still bind.
  var Utils = (bkcore && bkcore.Utils) || {
    getURLParameter: function () { return null; },
    isTouchDevice: function () {
      return !!(typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0)));
    }
  };
  var u = Utils.getURLParameter;
  var defaultControls = Utils.isTouchDevice() ? 1 : 0;

  var s = [
    ['controlType', ['KEYBOARD', 'TOUCH', 'LEAP MOTION CONTROLLER', 'GAMEPAD'], defaultControls, defaultControls, 'Controls'],
    ['quality', ['LOW', 'MID', 'HIGH', 'VERY HIGH'], 2, 2, 'Quality'],
    ['hud', ['OFF', 'ON'], 1, 1, 'HUD'],
    ['godmode', ['OFF', 'ON'], 0, 1, 'Godmode']
  ];

  s.forEach(function (a) {
    var fromUrl = u(a[0]);
    a[3] = fromUrl != null ? fromUrl : a[2];
    var e = $('s-' + a[0]);
    if (!e) return;

    function paint() {
      var label = e.querySelector('.label');
      var value = e.querySelector('.value');
      if (label && value) {
        label.textContent = a[4];
        value.textContent = a[1][a[3]];
      } else {
        e.innerHTML = a[4] + ': ' + a[1][a[3]];
      }
    }
    paint();
    e.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      a[3] = (a[3] + 1) % a[1].length;
      paint();
    });
  });

  function hasWebGL() {
    var canvas = document.createElement('canvas');
    var opts = { failIfMajorPerformanceCaveat: false };
    var names = ['webgl', 'experimental-webgl', 'webkit-3d', 'moz-webgl'];
    for (var i = 0; i < names.length; i++) {
      try {
        if (canvas.getContext(names[i], opts)) return true;
      } catch (e) {}
    }
    return false;
  }

  function on(id, handler) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      handler(ev);
    });
  }

  on('start', function () {
    if (!hasWebGL()) console.warn('WebGL probe failed; trying anyway.');
    $('step-1').style.display = 'none';
    $('step-2').style.display = 'block';
    $('step-2').style.backgroundImage = 'url(css/help-' + s[0][3] + '.png)';
  });

  on('step-2', function () {
    $('step-2').style.display = 'none';
    $('step-3').style.display = 'block';
    init(s[0][3], s[1][3], s[2][3], s[3][3]);
  });

  on('s-credits', function () {
    $('step-1').style.display = 'none';
    $('credits').style.display = 'block';
  });

  on('credits', function () {
    $('step-1').style.display = 'block';
    $('credits').style.display = 'none';
  });

  // Sound controls: same markup rendered into every .hx-sound slot, kept in sync.
  var SOUND_ROWS = [['master', 'Master'], ['music', 'Music'], ['sfx', 'Effects']];

  function pct(v) { return Math.round(v * 100) + '%'; }

  function syncSound() {
    var st = bkcore.Audio.settings;
    var all = document.querySelectorAll('.hx-sound');
    for (var i = 0; i < all.length; i++) {
      SOUND_ROWS.forEach(function (r) {
        var input = all[i].querySelector('input[data-key="' + r[0] + '"]');
        if (!input) return;
        if (document.activeElement !== input) input.value = Math.round(st[r[0]] * 100);
        all[i].querySelector('output[data-key="' + r[0] + '"]').textContent = pct(st[r[0]]);
      });
      var mute = all[i].querySelector('.hx-mute');
      mute.textContent = st.muted ? 'Sound: Off' : 'Sound: On';
      mute.classList.toggle('is-off', st.muted);
      all[i].classList.toggle('is-muted', st.muted);
    }
    var label = $('s-sound-value');
    if (label) label.textContent = st.muted ? 'Off' : pct(st.master);
  }

  function buildSound(root) {
    var html = '';
    SOUND_ROWS.forEach(function (r) {
      html += '<div class="hx-slider">' +
        '<span class="lbl">' + r[1] + '</span>' +
        '<button type="button" class="step" data-key="' + r[0] + '" data-delta="-10" aria-label="' + r[1] + ' down">−</button>' +
        '<input type="range" min="0" max="100" step="1" data-key="' + r[0] + '" aria-label="' + r[1] + ' volume">' +
        '<button type="button" class="step" data-key="' + r[0] + '" data-delta="10" aria-label="' + r[1] + ' up">+</button>' +
        '<output data-key="' + r[0] + '"></output>' +
        '</div>';
    });
    html += '<button type="button" class="hx-mute"></button>';
    root.innerHTML = html;

    root.addEventListener('input', function (e) {
      var key = e.target.getAttribute('data-key');
      if (!key) return;
      bkcore.Audio.set(key, e.target.value / 100);
      if (key === 'master' && bkcore.Audio.settings.muted && e.target.value > 0) bkcore.Audio.set('muted', false);
      syncSound();
    });
    root.addEventListener('click', function (e) {
      e.stopPropagation();
      var t = e.target;
      if (t.classList.contains('hx-mute')) {
        bkcore.Audio.set('muted', !bkcore.Audio.settings.muted);
      } else if (t.classList.contains('step')) {
        var key = t.getAttribute('data-key');
        var next = Math.round(bkcore.Audio.settings[key] * 100) + parseInt(t.getAttribute('data-delta'), 10);
        bkcore.Audio.set(key, next / 100);
        if (key === 'master' && next > 0) bkcore.Audio.set('muted', false);
      } else {
        return;
      }
      e.preventDefault();
      syncSound();
    });
    // keep arrow/WASD from steering while a slider has focus
    root.addEventListener('keydown', function (e) {
      if (e.keyCode !== 27) e.stopPropagation();
    });
  }

  var soundSlots = document.querySelectorAll('.hx-sound');
  for (var si = 0; si < soundSlots.length; si++) buildSound(soundSlots[si]);
  syncSound();

  function setOverlay(id, open) {
    $(id).classList.toggle('is-open', open);
    $(id).setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  on('s-sound', function () { syncSound(); setOverlay('sound-menu', true); });
  on('sound-close', function () { setOverlay('sound-menu', false); });

  on('pause-resume', function () {
    if (window.hexGL) hexGL.resumeGame();
  });
  on('pause-restart', function () {
    if (window.hexGL) hexGL.restart();
  });
  on('pause-menu-btn', function () {
    goMainMenu();
  });

  on('finish-retry', function () {
    if (window.hexGL) hexGL.restart();
  });
  on('finish-home', function () {
    goMainMenu();
  });

  // ESC on pause overlay already handled in HexGL; block bubbling from buttons
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 27 && $('finish-menu').classList.contains('is-open')) {
      e.preventDefault();
    }
    if (e.keyCode === 27 && $('sound-menu').classList.contains('is-open')) {
      setOverlay('sound-menu', false);
    }
  });

  refreshBestTime();
})();
