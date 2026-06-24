/* admin.js
 * Internal submissions viewer. Activates ONLY when the URL query string
 * contains "admin" (e.g. http://…/index.html?admin). Prompts for a passphrase,
 * then GETs all three expo endpoints and renders the submissions in tables,
 * 3 rows at a time with "Load More", plus per-section "Download CSV".
 *
 * SECURITY NOTE: the passphrase ships in this file's source, so it only keeps
 * casual visitors out — it is NOT real access control. The GET endpoints are
 * also reachable by anyone who knows the URL. For genuine protection, add
 * authentication to the listing endpoints on the Django side.
 * ES5-compatible. Load AFTER expoService.js.
 */
(function () {
  'use strict';

  var PASSPHRASE = 'otvedu#@098';
  var PAGE_SIZE = 3; // rows revealed per "Load More" click

  // Only run in admin mode.
  if (window.location.search.toLowerCase().indexOf('admin') === -1) return;

  var SOURCES = [
    { label: 'Attendees', endpoint: 'attend' },
    { label: 'Stall Bookings', endpoint: 'stall' },
    { label: 'Sponsors', endpoint: 'sponsor' }
  ];

  // Holds fetched rows + how many are currently shown, keyed by endpoint.
  var STATE = {};

  /* ---------------- networking ---------------- */

  function getJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 15000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
      cb(xhr.status >= 200 && xhr.status < 300, data, xhr.status);
    };
    xhr.onerror = function () { cb(false, null, 0); };
    xhr.ontimeout = function () { cb(false, null, 0); };
    xhr.send();
  }

  // DRF may return an array, or { results: [...] } when paginated.
  function rowsOf(data) {
    if (!data) return [];
    if (Object.prototype.toString.call(data) === '[object Array]') return data;
    if (data.results && Object.prototype.toString.call(data.results) === '[object Array]') return data.results;
    return [];
  }

  /* ---------------- helpers ---------------- */

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Column keys gathered across every row (so partial rows still align).
  function columnsOf(rows) {
    var cols = [], seen = {};
    for (var i = 0; i < rows.length; i++) {
      for (var k in rows[i]) {
        if (rows[i].hasOwnProperty(k) && !seen[k]) { seen[k] = true; cols.push(k); }
      }
    }
    return cols;
  }

  /* ---------------- CSV export (full dataset) ---------------- */

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    var cols = columnsOf(rows);
    var lines = [cols.map(csvCell).join(',')];
    for (var r = 0; r < rows.length; r++) {
      var line = [];
      for (var c = 0; c < cols.length; c++) line.push(csvCell(rows[r][cols[c]]));
      lines.push(line.join(','));
    }
    return lines.join('\r\n');
  }

  function downloadCSV(filename, rows) {
    var csv = '\ufeff' + toCSV(rows); // BOM so Excel reads UTF-8 correctly
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { (window.URL || window.webkitURL).revokeObjectURL(url); }, 1000);
  }

  /* ---------------- rendering ---------------- */

  // Renders the table showing only the first `shown` rows, plus Load More.
  function renderSection(src) {
    var sec = document.getElementById('admin-sec-' + src.endpoint);
    if (!sec) return;

    var st = STATE[src.endpoint];

    if (st.failed) {
      sec.innerHTML =
        '<div class="admin-sec-head"><h3>' + esc(src.label) + '</h3></div>' +
        '<p class="admin-empty">Failed to load (' +
        (st.status === 0 ? 'network/timeout' : st.status) +
        '). The endpoint may not support GET, or needs CORS.</p>';
      return;
    }

    var rows = st.rows;
    var total = rows.length;
    var shown = Math.min(st.shown, total);

    var head =
      '<div class="admin-sec-head">' +
        '<h3>' + esc(src.label) + ' <span class="admin-count">(' + total + ')</span></h3>' +
        (total ? '<button type="button" class="admin-csv">Download CSV</button>' : '') +
      '</div>';

    if (!total) {
      sec.innerHTML = head + '<p class="admin-empty">No records.</p>';
      return;
    }

    var cols = columnsOf(rows);

    var table = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>';
    for (var c = 0; c < cols.length; c++) table += '<th>' + esc(cols[c]) + '</th>';
    table += '</tr></thead><tbody>';
    for (var r = 0; r < shown; r++) {
      table += '<tr>';
      for (var c2 = 0; c2 < cols.length; c2++) table += '<td>' + esc(rows[r][cols[c2]]) + '</td>';
      table += '</tr>';
    }
    table += '</tbody></table></div>';

    var footer = '';
    if (shown < total) {
      var remaining = total - shown;
      var next = Math.min(PAGE_SIZE, remaining);
      footer = '<div class="admin-more-wrap">' +
                 '<button type="button" class="admin-more">Load ' + next + ' more (' + remaining + ' left)</button>' +
               '</div>';
    } else if (total > PAGE_SIZE) {
      footer = '<div class="admin-more-wrap"><span class="admin-allshown">All ' + total + ' shown</span></div>';
    }

    sec.innerHTML = head + table + footer;

    // Wire CSV (full dataset).
    var csvBtn = sec.querySelector('.admin-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        var stamp = new Date().toISOString().slice(0, 10);
        downloadCSV('expo-' + src.endpoint + '-' + stamp + '.csv', rows);
      });
    }

    // Wire Load More.
    var moreBtn = sec.querySelector('.admin-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        st.shown = Math.min(st.shown + PAGE_SIZE, total);
        renderSection(src);
      });
    }
  }

  function loadAll() {
    var endpoints = (window.ExpoService && window.ExpoService.ENDPOINTS) || {};

    for (var i = 0; i < SOURCES.length; i++) {
      (function (src) {
        var sec = document.getElementById('admin-sec-' + src.endpoint);
        if (sec) {
          sec.innerHTML = '<div class="admin-sec-head"><h3>' + esc(src.label) + '</h3></div>' +
                          '<p class="admin-empty">Loading…</p>';
        }
        getJSON(endpoints[src.endpoint], function (ok, data, status) {
          STATE[src.endpoint] = {
            rows: ok ? rowsOf(data) : [],
            shown: PAGE_SIZE,
            failed: !ok,
            status: status
          };
          renderSection(src);
        });
      })(SOURCES[i]);
    }
  }

  /* ---------------- panel + gate ---------------- */

  function buildPanel() {
    var panel = document.createElement('div');
    panel.className = 'admin-panel';

    var head = '<div class="admin-head"><div><h2>Expo Submissions</h2>' +
               '<span class="admin-sub">Internal viewer · OTV Education Conclave 2026</span></div>' +
               '<button type="button" class="admin-reload">Reload</button></div>';

    var secs = '';
    for (var i = 0; i < SOURCES.length; i++) {
      secs += '<section class="admin-sec" id="admin-sec-' + SOURCES[i].endpoint + '">' +
              '<div class="admin-sec-head"><h3>' + SOURCES[i].label + '</h3></div>' +
              '<p class="admin-empty">Loading…</p></section>';
    }

    panel.innerHTML = head + secs;
    document.body.appendChild(panel);

    panel.querySelector('.admin-reload').addEventListener('click', loadAll);
    loadAll();
  }

  function buildGate() {
    var gate = document.createElement('div');
    gate.className = 'admin-gate';
    gate.innerHTML =
      '<div class="admin-gate-box">' +
        '<h2>Restricted</h2>' +
        '<p>Enter passphrase to view submissions.</p>' +
        '<input type="password" class="admin-gate-input" autocomplete="off" placeholder="Passphrase">' +
        '<button type="button" class="admin-gate-btn">Enter</button>' +
        '<p class="admin-gate-err" style="display:none;">Incorrect passphrase.</p>' +
      '</div>';
    document.body.appendChild(gate);

    var input = gate.querySelector('.admin-gate-input');
    var btn   = gate.querySelector('.admin-gate-btn');
    var err   = gate.querySelector('.admin-gate-err');

    function tryEnter() {
      if (input.value === PASSPHRASE) {
        gate.parentNode.removeChild(gate);
        buildPanel();
      } else {
        err.style.display = 'block';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryEnter);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryEnter(); });
    input.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildGate);
  } else {
    buildGate();
  }
})();