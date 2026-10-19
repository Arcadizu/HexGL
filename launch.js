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
  });

  refreshBestTime();
})();
