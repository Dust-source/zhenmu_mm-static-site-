/* ============================================================
   珍木科研园 · 一树一码
   路由：#/  #/species/:id  #/tree/:code  #/notes  #/qr
   ============================================================ */
(function () {
  "use strict";

  var D = window.DATA;
  var RANK = { "国家一级": 1, "国家二级": 2, "珍稀乡土树种": 3 };
  D.species.sort(function (a, b) { return (RANK[a.level] || 9) - (RANK[b.level] || 9); });
  var TREES = [];
  D.species.forEach(function (s) {
    s.individuals.forEach(function (i) {
      TREES.push({
        id: i.id, no: i.no, rows: i.rows,
        species: s, speciesId: s.id, speciesName: s.name,
        level: s.level, levelRank: s.levelRank, measure: s.measure,
        latin: s.latin
      });
    });
  });

  var DATES = D.meta.dates;
  var app = document.getElementById("app");

  /* ---------------- 工具 ---------------- */
  function fmt(v, d) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var s = v.toFixed(d === undefined ? 3 : d);
    return s.replace(/\.?0+$/, "");
  }
  function mmdd(date) {
    var p = date.split("-");
    return p[1] + "." + p[2];
  }
  function signed(v, d) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var a = Math.abs(v).toFixed(d === undefined ? 2 : d);
    if (Number(a) === 0) return "0.00";
    return (v > 0 ? "+" : "-") + a;
  }
  function mean(arr) {
    var a = arr.filter(function (v) { return v !== null && v !== undefined && !isNaN(v); });
    if (!a.length) return null;
    return a.reduce(function (x, y) { return x + y; }, 0) / a.length;
  }
  function rowsOf(v) { return v ? v.rows : []; }
  function firstVal(rows, k) {
    for (var i = 0; i < rows.length; i++) if (rows[i][k] != null) return rows[i][k];
    return null;
  }
  function lastVal(rows, k) {
    for (var i = rows.length - 1; i >= 0; i--) if (rows[i][k] != null) return rows[i][k];
    return null;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function statusOf(tree) {
    var rows = tree.rows;
    var dead = rows.some(function (r) { return r.note && r.note.indexOf("死亡") >= 0; });
    var bare = rows.some(function (r) { return r.status && r.status.indexOf("无叶片") >= 0; });
    var bug = rows.some(function (r) { return (r.note && r.note.indexOf("虫害") >= 0) || (r.status && r.status.indexOf("虫害") >= 0); });
    var leaf = rows.some(function (r) { return r.status && r.status.indexOf("落叶") >= 0; });
    if (dead) return { key: "warn", text: "疑似死亡", detail: "9 月复查无叶片" };
    if (bug) return { key: "warn", text: "曾有虫害", detail: "5 月记录" };
    if (leaf) return { key: "ok", text: "正常·落叶中", detail: "9 月开始落叶" };
    return { key: "ok", text: "生长正常", detail: "" };
  }
  function levelClass(r) { return r === 1 ? "" : (r === 2 ? "b2" : "b0"); }

  /* ---------------- 二维码 ---------------- */
  function qrSvg(text, opts) {
    opts = opts || {};
    var qr = qrcode(0, opts.ec || "M");
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = opts.quiet === undefined ? 2 : opts.quiet;
    var total = n + quiet * 2;
    var d = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          d += "M" + (c + quiet) + " " + (r + quiet) + "h1v1h-1z";
        }
      }
    }
    return '<svg viewBox="0 0 ' + total + " " + total + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="二维码">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + (opts.bg || "#FCFAF3") + '"/>' +
      '<path d="' + d + '" fill="' + (opts.fg || "#1E2B23") + '"/></svg>';
  }

  function isLocal() { return location.protocol === "file:"; }
  function baseUrl() {
    if (isLocal()) return "https://zhenmu.example/tree";
    return location.origin + location.pathname.replace(/index\.html$/, "");
  }
  function treeUrl(id) { return baseUrl() + "#/tree/" + id; }

  /* ---------------- 图表 ---------------- */
  function chartFrame(host, h) {
    var w = Math.max(host.clientWidth || 640, 280);
    host.innerHTML = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '"></svg><div class="tip"></div>';
    return {
      svg: host.querySelector("svg"),
      tip: host.querySelector(".tip"),
      w: w, h: h
    };
  }

  function drawSingle(host, series, unit) {
    var pts = series.points.filter(function (p) { return p.v != null; });
    if (!pts.length) {
      host.innerHTML = '<p style="color:var(--ink-3);font-size:14px;padding:26px 0">这一项没有读数。</p>';
      return;
    }
    var h = host.clientWidth < 520 ? 210 : 268;
    var f = chartFrame(host, h);
    var L = 46, R = 18, T = 26, B = 38;
    var iw = f.w - L - R, ih = h - T - B;
    var vals = pts.map(function (p) { return p.v; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 0.001) { max = max + 0.5; min = Math.max(0, min - 0.5); }
    var pad = (max - min) * 0.35;
    min = Math.max(0, min - pad); max = max + pad;
    var xs = function (i) { return L + 10 + (iw - 20) * (pts.length === 1 ? 0.5 : i / (pts.length - 1)); };
    var ys = function (v) { return T + ih * (1 - (v - min) / (max - min)); };
    var s = "";

    // 竖向参考线
    pts.forEach(function (p, i) {
      s += '<line x1="' + xs(i) + '" y1="' + T + '" x2="' + xs(i) + '" y2="' + (T + ih) + '" stroke="rgba(30,43,35,.05)"/>';
    });

    // 网格
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = min + (max - min) * t / ticks;
      var y = ys(v);
      s += '<line x1="' + L + '" y1="' + y + '" x2="' + (f.w - R) + '" y2="' + y + '" stroke="' + (t === 0 ? "rgba(30,43,35,.20)" : "rgba(30,43,35,.08)") + '" stroke-dasharray="' + (t === 0 ? "0" : "2 4") + '"/>';
      s += '<text x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="#6B7A6C" font-family="-apple-system,PingFang SC,sans-serif">' + fmt(v, 2) + "</text>";
    }

    // 面积
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + xs(i) + " " + ys(p.v); }).join(" ");
    var area = line + " L" + xs(pts.length - 1) + " " + (T + ih) + " L" + xs(0) + " " + (T + ih) + " Z";
    s += '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A6B51" stop-opacity=".22"/><stop offset="1" stop-color="#4A6B51" stop-opacity="0"/></linearGradient></defs>';
    s += '<path d="' + area + '" fill="url(#ag)"/>';
    s += '<path d="' + line + '" fill="none" stroke="#2C4636" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';

    pts.forEach(function (p, i) {
      s += '<circle cx="' + xs(i) + '" cy="' + ys(p.v) + '" r="4.5" fill="#FCFAF3" stroke="#9C3B2E" stroke-width="1.6"/>';
      s += '<text x="' + xs(i) + '" y="' + (h - 14) + '" text-anchor="middle" font-size="11" fill="#3A4C3F" font-family="-apple-system,PingFang SC,sans-serif">' + mmdd(p.label) + "</text>";
    });

    // 单位
    s += '<text x="' + L + '" y="' + (T - 10) + '" font-size="10" fill="#8A9A83" font-family="-apple-system,PingFang SC,sans-serif">' + unit + "</text>";

    // 悬停热区
    pts.forEach(function (p, i) {
      var cx = xs(i), half = iw / Math.max(1, pts.length - 1) / 2;
      s += '<rect x="' + (cx - half) + '" y="' + T + '" width="' + (half * 2) + '" height="' + ih + '" fill="transparent" class="hit" data-i="' + i + '"/>';
    });

    f.svg.innerHTML = s;
    var active = null;
    f.svg.querySelectorAll(".hit").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        var i = +el.dataset.i, p = pts[i];
        active = i;
        f.tip.style.left = xs(i) + "px";
        f.tip.style.top = ys(p.v) + "px";
        f.tip.style.opacity = 1;
        f.tip.innerHTML = mmdd(p.label) + " <b>" + fmt(p.v, 3) + " " + unit + "</b>";
      });
      el.addEventListener("mouseleave", function () { f.tip.style.opacity = 0; active = null; });
    });
    f.svg.addEventListener("touchstart", function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains("hit")) {
        var i = +t.dataset.i, p = pts[i];
        f.tip.style.left = xs(i) + "px";
        f.tip.style.top = ys(p.v) + "px";
        f.tip.style.opacity = 1;
        f.tip.innerHTML = mmdd(p.label) + " <b>" + fmt(p.v, 3) + " " + unit + "</b>";
      }
    }, { passive: true });
  }

  function drawMulti(host, seriesList, unit, labels) {
    var h = host.clientWidth < 520 ? 230 : 300;
    var f = chartFrame(host, h);
    var L = 46, R = 16, T = 26, B = 36;
    var iw = f.w - L - R, ih = h - T - B;
    var all = [];
    seriesList.forEach(function (s) {
      s.points.forEach(function (p) { if (p.v != null) all.push(p.v); });
    });
    if (!all.length) { host.innerHTML = "<p>无读数</p>"; return; }
    var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
    var pad = (max - min) * 0.18 || 0.5;
    min = Math.max(0, min - pad); max = max + pad;
    var xs = function (i) { return L + 12 + (iw - 24) * i / Math.max(1, labels.length - 1); };
    var ys = function (v) { return T + ih * (1 - (v - min) / (max - min)); };
    var s = "";

    for (var t = 0; t <= 4; t++) {
      var v = min + (max - min) * t / 4, y = ys(v);
      s += '<line x1="' + L + '" y1="' + y + '" x2="' + (f.w - R) + '" y2="' + y + '" stroke="rgba(30,43,35,.08)" stroke-dasharray="2 4"/>';
      s += '<text x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="#6B7A6C" font-family="-apple-system,PingFang SC,sans-serif">' + fmt(v, 2) + "</text>";
    }
    labels.forEach(function (lb, i) {
      s += '<line x1="' + xs(i) + '" y1="' + T + '" x2="' + xs(i) + '" y2="' + (T + ih) + '" stroke="rgba(30,43,35,.05)"/>';
      s += '<text x="' + xs(i) + '" y="' + (h - 12) + '" text-anchor="middle" font-size="11" fill="#3A4C3F" font-family="-apple-system,PingFang SC,sans-serif">' + mmdd(lb) + "</text>";
    });

    // 平均线
    var means = labels.map(function (_, i) {
      var vs = [];
      seriesList.forEach(function (se) {
        var p = se.points[i];
        if (p && p.v != null) vs.push(p.v);
      });
      return mean(vs);
    });
    var mPath = means.map(function (m, i) { return m == null ? null : (i ? "L" : "M") + xs(i) + " " + ys(m); })
      .filter(Boolean).join(" ").replace(/^L/, "M");
    if (mPath) s += '<path d="' + mPath + '" fill="none" stroke="#B08A4F" stroke-width="1.4" stroke-dasharray="5 3"/>';

    seriesList.forEach(function (se) {
      var d = "";
      se.points.forEach(function (p, i) {
        if (p.v == null) return;
        d += (d ? "L" : "M") + xs(i) + " " + ys(p.v);
      });
      if (!d) return;
      s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="' + (se.on ? 1.7 : 1.2) + '" opacity="' + (se.on ? 1 : 0.16) + '" stroke-linejoin="round"/>';
      se.points.forEach(function (p, i) {
        if (p.v == null) return;
        s += '<circle cx="' + xs(i) + '" cy="' + ys(p.v) + '" r="3.4" fill="' + (se.on ? se.color : "#EFE8D7") + '" stroke="#FCFAF3" stroke-width="1"/>';
      });
    });

    s += '<text x="' + L + '" y="' + (T - 10) + '" font-size="10" fill="#8A9A83" font-family="-apple-system,PingFang SC,sans-serif">' + unit + "</text>";

    labels.forEach(function (lb, i) {
      var half = iw / Math.max(1, labels.length - 1) / 2;
      s += '<rect x="' + (xs(i) - half) + '" y="' + T + '" width="' + (half * 2) + '" height="' + ih + '" fill="transparent" class="hit" data-i="' + i + '"/>';
    });

    f.svg.innerHTML = s;
    f.svg.querySelectorAll(".hit").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        var i = +el.dataset.i;
        var rows = seriesList.map(function (se) {
          return '<div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.7">' + se.name + "</span><span>" + (se.points[i].v == null ? "—" : fmt(se.points[i].v, 3)) + "</span></div>";
        }).join("");
        f.tip.innerHTML = "<b>" + labels[i] + "</b>" + rows;
        f.tip.style.left = Math.min(Math.max(xs(i), 60), f.w - 70) + "px";
        f.tip.style.top = (T + ih * 0.35) + "px";
        f.tip.style.opacity = 1;
      });
      el.addEventListener("mouseleave", function () { f.tip.style.opacity = 0; });
    });
  }

  /* ---------------- 复用片段 ---------------- */
  function sealHtml(level, rank, big) {
    var cls = "seal " + levelClass(rank) + (big ? " seal-lg" : "");
    var txt = rank === 1 ? "国家<br>一级" : (rank === 2 ? "国家<br>二级" : "乡土<br>树种");
    return '<span class="' + cls + '">' + txt + "</span>";
  }
  function statusChip(tree) {
    var st = statusOf(tree);
    return '<span class="chip ' + (st.key === "warn" ? "warn" : "ok") + '">' + st.text + "</span>";
  }
  function speciesCard(s) {
    var latest = s.individuals.map(function (i) {
      var l = lastVal(i.rows, "d");
      return l;
    });
    var avg = mean(latest);
    return '<a class="scard rise" href="#/species/' + s.id + '">' +
      '<div class="scard-img">' + sealHtml(s.level, s.levelRank) +
      '<img src="assets/img/' + s.img + '" alt="' + esc(s.name) + '插画" loading="lazy">' +
      "</div>" +
      '<div class="scard-body">' +
      "<h3>" + s.name + "</h3>" +
      '<p class="latin">' + s.latin + "</p>" +
      '<p class="fam">' + s.family + "</p>" +
      '<div class="scard-foot"><span>' + s.count + " 株 · 最新" + s.measure + "均值 " + fmt(avg, 2) + " cm</span>" +
      '<span class="go">查看</span></div>' +
      "</div></a>";
  }

  /* ---------------- 首页 ---------------- */
  function viewHome() {
    var sp = D.species;
    var html = "";

    html += '<header class="hero"><div class="wrap hero-grid">' +
      '<div class="rise">' +
      '<p class="eyebrow">Zhenmu Arboretum · Tree Archive</p>' +
      '<h1 class="hero-title">一树一码<span class="thin">珍木科研园 · 电子树牌</span></h1>' +
      '<p class="hero-lede">华东师范大学闵行校区里种着 20 株珍稀树，2026 年 3 月 31 日种下。这里存着每一株的科属、来历、<em>为什么值得保护</em>，以及三轮实测的粗细与高矮。扫树牌上的码，看到的就是你面前这一株。</p>' +
      '<div class="hero-meta">' +
      '<div><b>' + D.meta.speciesCount + "</b><span>树种</span></div>" +
      '<div><b>' + D.meta.individualCount + "</b><span>株个体</span></div>" +
      '<div><b>' + D.meta.rounds + "</b><span>轮监测</span></div>" +
      '<div><b>2026</b><span>建园年份</span></div>' +
      "</div></div>" +
      '<div class="hero-visual rise">' +
      '<div class="hero-stamp"><b>珍木</b><small>MMXXVI</small></div>' +
      '<figure class="hero-photo"><img src="assets/img/scene-sign.jpg" alt="珍木科研园园区总牌">' +
      "<figcaption><span>园区总牌</span><span>闵行校区 · 生态岛旁</span></figcaption></figure>" +
      "</div></div></header>";

    html += '<section class="section" style="padding-top:18px"><div class="wrap">' +
      '<div class="section-head rise"><div><p class="num">壹</p><h2>树种名录</h2>' +
      "<p>五种树，二十株。三种国家一级、一种国家二级，还有一种被特意留下的乡土树。</p></div>" +
      '<div><a class="btn" href="#/qr">二维码打印页 →</a></div></div>' +
      '<div class="species-grid">' + sp.map(speciesCard).join("") + "</div>" +
      "</div></section>";

    html += '<section class="section"><div class="wrap"><div class="stats rise">' +
      "<div><b>5</b><span>树种：银缕梅、天目铁木、普陀鹅耳枥、舟山新木姜子、小果冬青</span></div>" +
      "<div><b>20</b><span>株个体，逐株编号建档</span></div>" +
      "<div><b>3</b><span>轮实测：" + DATES.map(mmdd).join(" / ") + "</span></div>" +
      "<div><b>4</b><span>项指标：径值、树高、冠幅、生长状况</span></div>" +
      "</div></div></section>";

    html += '<section class="section"><div class="wrap story">' +
      '<div class="story-text rise"><p class="eyebrow">The Garden</p><h2 style="font-size:clamp(26px,3.2vw,34px);color:var(--green);letter-spacing:.06em;margin-bottom:18px">这片园子</h2>' +
      "<p>种源来自浙江天童森林生态系统国家野外科学观测研究站、浙江天目山森林生态系统国家野外科学观测研究站、自然资源部浙江舟山岛屿生态系统野外科学观测研究站，以及安徽天马国家级自然保护区。园区紧邻校园“生态岛”，既是野外台站的延伸样地，也是给中小学生看树的地方。</p>" +
      "<p>园子不大，20 株，一株一棵编号。难点不在种下去，而在种下去之后：这一年里哪一株缓过来了、哪一株被虫咬了、哪一株始终没发芽。这些问题只能靠一次一次去量来回答。</p>" +
      '<div class="quote">种下去只是开始。能不能活、长成什么样，要靠一年一年的记录来回答。</div>' +
      "<p>于是有了这份档案，也有了树牌上的二维码。每一株的页面里都有它的三次实测数据，包括那些不太好看的读数。</p></div>" +
      '<div class="photo-stack rise">' +
      '<figure><img src="assets/img/scene-open.jpg" alt="2026年3月31日珍木科研园揭牌"><figcaption>2026.03.31 揭牌</figcaption></figure>' +
      '<figure><img src="assets/img/scene-tour.jpg" alt="暑期营带队讲解"><figcaption>暑期营讲解</figcaption></figure>' +
      '<figure><img src="assets/img/scene-measure.jpg" alt="胸径测量现场"><figcaption>胸径测量</figcaption></figure>' +
      "</div></div></section>";

    html += '<section class="qr-band"><div class="wrap">' +
      '<div class="rise"><p class="eyebrow">One Tree · One Code</p>' +
      "<h2>一株树，一个码</h2>" +
      "<p>每株树挂一块牌，牌上印它自己的二维码。手机对着扫，直接进这一株的页面：编号、树种、三次读数、生长曲线，还有它这一轮的状态。</p>" +
      "<p style='margin-bottom:22px'>二十个码可以一次打出来，A4 一页，剪开就能上牌。码里带的是本站地址，换页面内容不用重印。</p>" +
      '<a class="btn" href="#/qr">打开二维码打印页 →</a></div>' +
      '<div class="qr-demo rise" id="homeqr"><div class="cap">珍木科研园 · 树种名录</div></div>' +
      "</div></section>";

    html += '<section class="section" id="notes"><div class="wrap">' +
      '<div class="section-head rise"><div><p class="num">贰</p><h2>数据怎么来的</h2>' +
      "<p>页面上的每个数字都对应记录表里的一格。三轮读数、两种量法、几处需要说明的偏差，都写在这里。</p></div></div>" +
      '<div class="notes">' +
      '<div class="note rise"><span class="tag">指标</span><h4>量什么，怎么量</h4>' +
      "<p>银缕梅与天目铁木已长到可量胸径，取离地 1.3 m 处直径；小果冬青、舟山新木姜子、普陀鹅耳枥苗还小，取地径。树高、冠幅以米计，冠幅记东西、南北两个读数，取平均。</p></div>" +
      '<div class="note rise"><span class="tag">轮次</span><h4>什么时候量的</h4>' +
      "<p>前三轮由项目组逐株实测，固定在同一批树上。第四轮安排在 10 月下旬，数据尚未并入本页。</p>" +
      '<div class="date-list">' + DATES.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "<span>第四轮 · 待并</span></div></div>" +
      '<div class="note rise"><span class="tag">偏差</span><h4>三处要说明的读数</h4>' +
      "<p>天目铁木 7 月 2 日的树高读到 5.4–6.7 m，与同期冠幅不相称，已列入复核；小果冬青三株 9 月 18 日复查均无叶片，记录为“疑似死亡”；部分个体径值在 5 月至 7 月间出现“缩小”，是三次卡尺位置不统一所致。为此制定了测量规范：固定位置并做标记、统一离地高度、同一人读数、误差控制在 ±0.1 cm。</p></div>" +
      "</div></div></section>";

    return html;
  }

  /* ---------------- 物种页 ---------------- */
  function speciesInsight(s) {
    var k = "d";
    var f = mean(s.individuals.map(function (i) { return firstVal(i.rows, k); }));
    var l = mean(s.individuals.map(function (i) { return lastVal(i.rows, k); }));
    if (f == null || l == null) return "";
    var diff = l - f;
    var word = diff >= 0 ? "增加" : "减少";
    var txt = "截至 " + DATES[DATES.length - 1] + "，" + s.count + " 株的" + s.measure + "均值 " + fmt(l, 2) + " cm，比首测" + word + " " + fmt(Math.abs(diff), 2) + " cm。";
    if (diff < 0) {
      txt += "径值不会真的变小，出现负值说明三次卡尺卡的位置不一样，这也是后来制定测量规范的原因。";
    }
    return txt;
  }

  function viewSpecies(id) {
    var s = D.species.filter(function (x) { return x.id === id; })[0];
    if (!s) return null;
    var colors = ["#2C4636", "#4A6B51", "#7D8F6E", "#B08A4F", "#9C3B2E", "#6E5C33"];
    var series = s.individuals.map(function (i, idx) {
      return {
        name: i.id, color: colors[idx % colors.length], on: true,
        points: DATES.map(function (d) {
          var row = i.rows.filter(function (r) { return r.date === d; })[0];
          return { label: d, v: row ? row.d : null };
        })
      };
    });

    var html = '<div class="wrap"><nav class="subnav"><a href="#/">名录</a><span class="sep">/</span><span>' + s.name + "</span></nav></div>";
    html += '<header class="sp-hero wrap">' +
      '<div class="rise"><p class="eyebrow">' + s.code + " · " + s.measure + "组</p>" +
      "<h1>" + s.name + "</h1>" +
      '<p class="la">' + s.latin + "</p>" +
      '<p class="fam">' + s.family + " ｜ " + s.genus + "</p>" +
      '<div class="tag-row">' + sealHtml(s.level, s.levelRank, true) +
      "<span>" + s.habit + "</span><span>" + s.height + "</span><span>园内 " + s.count + " 株</span></div>" +
      '<p style="margin-top:24px;color:var(--ink-2);font-size:16px;max-width:34em">' + s.story + "</p>" +
      "</div>" +
      '<figure class="fig-frame rise"><img src="assets/img/' + s.img + '" alt="' + esc(s.name) + '植物插画">' +
      "<figcaption><span>水墨植物图 · " + s.name + "</span><span>" + s.season + "</span></figcaption></figure>" +
      "</header>";

    html += '<section class="section" style="padding-top:52px"><div class="wrap two-col">' +
      '<div class="prose rise"><h3>形态特征</h3><ul class="block-list">' +
      s.traits.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul></div>" +
      '<div class="prose rise"><h3>分布与生境</h3>' +
      '<div class="tag-row" style="margin:0 0 16px">' + s.distribution.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div>" +
      "<p>" + s.habitat + "</p>" +
      '<div class="breadcrumb-note">野外分布以产地记载为准。园内个体为迁地栽培，用于观测它对本地水土的适应性，并不能替代野生种群。</div>' +
      "</div></div></section>";

    html += '<section class="section" style="padding-top:10px"><div class="wrap two-col">' +
      '<div class="prose rise"><p class="eyebrow">Why Protect</p><h3>为什么要保护</h3><ul class="block-list">' +
      s.why.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul></div>" +
      '<div class="rise"><p class="eyebrow">If Not</p><h3 style="font-size:20px;color:var(--green);letter-spacing:.08em;margin:0 0 14px">不保护的后果</h3>' +
      '<div class="risk-card"><h4>后果</h4><p>' + s.risk + "</p></div></div>" +
      "</div></section>";

    html += '<section class="section"><div class="wrap">' +
      '<div class="section-head rise"><div><p class="num">生长状况</p><h2 style="font-size:clamp(24px,2.8vw,30px)">园内 ' + s.count + " 株的实测记录</h2>" +
      "<p>" + esc(speciesInsight(s)) + "</p></div></div>" +
      '<div class="chart-card rise"><div class="chart-head"><h4>' + s.measure + '曲线对比（园内全部个体）</h4><span class="unit">单位 cm ｜ 虚线为均值</span></div>' +
      '<div class="chart-host" id="spchart"></div><div class="legend" id="splegend"></div></div>' +
      '<div class="tree-grid" style="margin-top:26px">' +
      s.individuals.map(function (i) {
        var t = TREES.filter(function (x) { return x.id === i.id; })[0];
        var lv = lastVal(i.rows, "d"), fv = firstVal(i.rows, "d");
        var st = statusOf(t);
        return '<a class="tcard rise" href="#/tree/' + i.id + '"><span class="dot ' + (st.key === "warn" ? "warn" : "") + '"></span>' +
          '<span class="code">' + i.id + "</span>" +
          '<span class="val">' + fmt(lv, 2) + "<small>cm</small></span>" +
          '<span class="sub">' + s.measure + " ｜ " + (fv != null && lv != null ? signed(lv - fv, 2) + " cm" : "—") + "</span>" +
          '<span class="sub">' + st.text + "</span>" +
          '<span class="go">看这一株 →</span></a>';
      }).join("") + "</div>" +
      "</div></section>";

    return { html: html, after: function () {
      var host = document.getElementById("spchart");
      var legend = document.getElementById("splegend");
      var render = function () {
        drawMulti(host, series, "cm", DATES);
        legend.innerHTML = series.map(function (se, i) {
          return '<button aria-pressed="' + se.on + '" data-i="' + i + '"><i style="background:' + se.color + '"></i>' + se.name + "</button>";
        }).join("") + '<span style="color:var(--ink-3);letter-spacing:.06em">虚线 · 均值</span>';
        legend.querySelectorAll("button").forEach(function (b) {
          b.addEventListener("click", function () {
            var i = +b.dataset.i;
            series[i].on = !series[i].on;
            render();
          });
        });
      };
      render();
      observeResize(host, render);
    } };
  }

  /* ---------------- 单株页 ---------------- */
  function viewTree(id) {
    var t = TREES.filter(function (x) { return x.id === id; })[0];
    if (!t) return null;
    var s = t.species;
    var rows = t.rows;
    var last = rows[rows.length - 1];
    var lv = lastVal(rows, "d"), fv = firstVal(rows, "d");
    var lh = lastVal(rows, "h"), lc = lastVal(rows, "cw");
    var st = statusOf(t);
    var idx = TREES.indexOf(t);
    var sibs = TREES.filter(function (x) { return x.speciesId === s.id; });
    var si = sibs.indexOf(t);
    var prev = sibs[si - 1], next = sibs[si + 1];

    var metrics = [
      { k: "d", label: s.measure, unit: "cm" },
      { k: "h", label: "树高", unit: "m" },
      { k: "cw", label: "冠幅", unit: "m" }
    ];

    var html = '<div class="wrap"><nav class="subnav"><a href="#/">名录</a><span class="sep">/</span>' +
      '<a href="#/species/' + s.id + '">' + s.name + "</a><span class=\"sep\">/</span><span>" + t.id + "</span></nav></div>";

    html += '<header class="tree-hero wrap">' +
      '<div class="rise"><p class="idbig">' + t.id + " ｜ 第 " + t.no + " 株 / 共 " + s.count + " 株</p>" +
      "<h1>" + s.name + "</h1>" +
      '<p class="la" style="font-style:italic;color:var(--ink-3);margin-top:6px">' + s.latin + " ｜ " + s.family + "</p>" +
      '<div class="meta">' + sealHtml(s.level, s.levelRank, true) +
      '<span class="chip">' + s.measure + "组</span>" +
      '<span class="chip">' + rows.length + " 次记录</span>" +
      statusChip(t) + "</div></div>" +
      '<div class="qr-side rise" id="tqr"><div class="cap">扫这块牌，回到本页</div>' +
      (isLocal()
        ? '<div class="localnote">本地预览模式<br>站点上线后，这里显示这一株的二维码</div>'
        : qrSvg(treeUrl(t.id), { quiet: 1 }) +
          '<div class="url">' + esc(treeUrl(t.id).replace(/^https?:\/\//, "")) + "</div>" +
          '<button class="btn" data-copy="' + esc(treeUrl(t.id)) + '">复制本页链接</button>') +
      "</div>" +
      "</header>";

    html += '<div class="wrap"><div class="kpi-row rise">' +
      '<div class="kpi"><span>最新' + s.measure + "</span><b>" + fmt(lv, 3) + "<small>cm</small></b>" +
      "<em>" + last.date + " 实测 ｜ 首测 " + fmt(fv, 3) + " cm</em></div>" +
      '<div class="kpi"><span>树高</span><b>' + fmt(lh, 2) + "<small>m</small></b><em>" + (lh == null ? "本轮未记" : "最近一次读数") + "</em></div>" +
      '<div class="kpi"><span>冠幅</span><b>' + fmt(lc, 2) + "<small>m</small></b><em>两读数均值</em></div>" +
      '<div class="kpi"><span>较首测</span><b style="color:' + ((lv - fv) >= 0 ? "var(--green)" : "var(--seal)") + '">' + (fv == null || lv == null ? "—" : signed(lv - fv, 2)) + "<small>cm</small></b>" +
      "<em>" + (st.key === "warn" ? "读数待复核" : "净生长") + "</em></div>" +
      "</div>";

    if (st.key === "warn") {
      var notes = rows.filter(function (r) { return r.status || r.note; }).map(function (r) {
        return r.date + "：" + [r.status, r.note].filter(Boolean).join("，");
      });
      html += '<div class="risk-card rise" style="margin-top:16px"><h4>现场记录</h4><p>' + notes.join("；") +
        "。这一株已列入重点观察名单，等第四轮复查确认。" + "</p></div>";
    }

    html += '<section class="section" style="padding-top:40px">' +
      '<div class="chart-card rise"><div class="chart-head"><h4>生长曲线</h4>' +
      '<div class="tabs" id="mtabs">' + metrics.map(function (m, i) {
        return '<button data-k="' + m.k + '" aria-selected="' + (i === 0) + '">' + m.label + "</button>";
      }).join("") + "</div></div>" +
      '<div class="chart-host" id="tchart"></div></div>';

    html += '<div class="tbl-wrap rise" style="margin-top:26px"><table class="data"><thead><tr>' +
      "<th>监测日期</th><th>" + s.measure + "（cm）</th><th>树高（m）</th><th>冠幅（m）</th><th>生长状况</th><th>备注</th>" +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        var cls = [];
        if (r.status && r.status.indexOf("无叶片") >= 0) cls.push("warn");
        else if (r.status) cls.push("ok");
        return "<tr><td>" + r.date + "</td>" +
          "<td>" + fmt(r.d, 3) + "</td>" +
          '<td class="' + (r.h == null ? "muted" : "") + '">' + fmt(r.h, 2) + "</td>" +
          '<td class="' + (r.cw == null ? "muted" : "") + '">' + fmt(r.cw, 2) + "</td>" +
          "<td>" + (r.status ? '<span class="chip ' + cls.join(" ") + '">' + r.status + "</span>" : '<span class="muted">—</span>') + "</td>" +
          "<td>" + (r.note ? '<span class="chip warn">' + r.note + "</span>" : '<span class="muted">—</span>') + "</td></tr>";
      }).join("") +
      "</tbody></table></div>";

    html += '<p class="breadcrumb-note" style="margin-top:22px">' + s.measure + "的量取位置：" +
      (s.measure === "胸径" ? "离地 1.3 m 处树干直径" : "苗木基部地径，贴近地面处") +
      "。第四轮监测已固定测量点并作标记，后续读数可直接与本次比较。</p>";

    html += '<div class="pager">' +
      (prev ? '<a href="#/tree/' + prev.id + '">← ' + prev.id + "</a>" : "<span></span>") +
      '<a href="#/species/' + s.id + '">返回 ' + s.name + " 一览</a>" +
      (next ? '<a href="#/tree/' + next.id + '">' + next.id + " →</a>" : "<span></span>") +
      "</div></section></div>";

    return { html: html, after: function () {
      var host = document.getElementById("tchart");
      var cur = "d";
      var unitMap = { d: "cm", h: "m", cw: "m" };
      var render = function () {
        var pts = rows.map(function (r) { return { label: r.date, v: r[cur] }; });
        drawSingle(host, { points: pts }, unitMap[cur]);
      };
      render();
      document.getElementById("mtabs").querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          cur = b.dataset.k;
          document.getElementById("mtabs").querySelectorAll("button").forEach(function (x) {
            x.setAttribute("aria-selected", x === b);
          });
          render();
        });
      });
      observeResize(host, render);

      var cbtn = document.querySelector("#tqr button");
      if (cbtn) cbtn.addEventListener("click", function () { copy(this.dataset.copy, this); });
    } };
  }

  /* ---------------- 数据说明 ---------------- */
  function viewNotes() {
    var html = '<div class="wrap"><nav class="subnav"><a href="#/">名录</a><span class="sep">/</span><span>数据说明</span></nav></div>';
    html += '<header class="sp-hero wrap" style="grid-template-columns:1fr"><div class="rise">' +
      '<p class="eyebrow">Data Notes</p><h1 style="font-size:clamp(32px,4.4vw,52px)">数据说明</h1>' +
      '<p class="hero-lede">这份档案里的每个数字都来自同一张记录表。表里有多少格，这里就有多少数；表里没量到的，这里就写"未记"，不留空想。</p></div></header>';
    html += '<section class="section" style="padding-top:20px"><div class="wrap">' +
      '<div class="tbl-wrap rise"><table class="data"><thead><tr><th>树种</th><th>株数</th><th>量取方式</th><th>首测均值</th><th>末测均值</th><th>净变化</th></tr></thead><tbody>' +
      D.species.map(function (s) {
        var f = mean(s.individuals.map(function (i) { return firstVal(i.rows, "d"); }));
        var l = mean(s.individuals.map(function (i) { return lastVal(i.rows, "d"); }));
        return "<tr><td>" + s.name + "</td><td>" + s.count + "</td><td>" + s.measure + "</td>" +
          "<td>" + fmt(f, 2) + " cm</td><td>" + fmt(l, 2) + " cm</td>" +
          '<td style="color:' + (l - f >= 0 ? "var(--green-2)" : "var(--seal)") + '">' + (l - f >= 0 ? "+" : "") + fmt(l - f, 2) + " cm</td></tr>";
      }).join("") + "</tbody></table></div>";
    html += '<div class="notes" style="margin-top:26px">' +
      '<div class="note rise"><span class="tag">来源</span><h4>记录表</h4><p>' + D.meta.source + "。共 " + D.meta.rounds + " 轮、20 株、60 条读数，本站直接读取该表生成，未做数值修匀。</p></div>" +
      '<div class="note rise"><span class="tag">口径</span><h4>三项指标的读法</h4><p>径值单位厘米，保留三位小数，与卡尺读数一致；树高、冠幅单位米。冠幅两列读数取算术平均后显示。</p></div>' +
      '<div class="note rise"><span class="tag">说明</span><h4>看不懂的读数</h4><p>表里出现的"缩小"和异常高值都照原样保留，并在对应株的页面标注。数据不改，问题写清楚，下一轮再校正。</p></div>' +
      "</div></div></section>";
    return html;
  }

  /* ---------------- 二维码打印页 ---------------- */
  function viewQR() {
    var html = '<div class="wrap"><nav class="subnav"><a href="#/">名录</a><span class="sep">/</span><span>二维码</span></nav></div>';
    html += '<header class="sp-hero wrap" style="grid-template-columns:1fr"><div class="rise">' +
      '<p class="eyebrow">Print Sheet</p><h1 style="font-size:clamp(32px,4.4vw,52px)">一树一码 · 打印页</h1>' +
      '<p class="hero-lede">下面是 20 株树的二维码，每块牌配一个。用浏览器打印（A4、100% 比例如实尺寸），沿虚线剪开，贴上牌即可。二维码指向本站当前地址，页面内容更新后不用重印。</p>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px"><button class="btn" onclick="window.print()">打印这一页</button>' +
      '<a class="btn" href="#/">回到名录</a></div></div></header>';
    html += '<section class="section" style="padding-top:26px"><div class="wrap">' +
      (isLocal() ? '<p class="breadcrumb-note" style="margin:0 0 18px;border-left-color:rgba(156,59,46,.5);color:var(--seal)">当前是本机打开的文件，二维码里还不会有真实地址。把站点放到公网后打开本页，码会自动按新域名生成。</p>' : "") +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px" id="qgrid"></div>' +
      '<p class="breadcrumb-note" style="margin-top:24px">扫码后进入的是这一株的页面，页面里能看到它的编号、树名、三次读数和生长曲线。若要改地址，只需改站点部署位置，二维码里的路径不变。</p>' +
      "</div></section>";
    return { html: html, after: function () {
      var grid = document.getElementById("qgrid");
      grid.innerHTML = TREES.map(function (t) {
        return '<div class="tcard" style="padding:14px;align-items:center;text-align:center;background:#fff">' +
          '<div style="width:100%;background:#fff;padding:2px">' + qrSvg(treeUrl(t.id), { quiet: 1, bg: "#ffffff" }) + "</div>" +
          '<span class="code" style="margin-top:10px">' + t.id + "</span>" +
          '<span class="val" style="font-size:17px;margin-top:2px">' + t.speciesName + "</span>" +
          '<span class="sub">' + (t.species.level || "") + "</span></div>";
      }).join("");
    } };
  }

  /* ---------------- 通用行为 ---------------- */
  function copy(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "已复制";
      setTimeout(function () { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "复制失败"; }
      document.body.removeChild(ta);
    }
  }

  var resizeHandlers = [];
  function observeResize(host, fn) {
    resizeHandlers.push({ host: host, fn: fn });
  }
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      resizeHandlers.forEach(function (h) {
        if (document.body.contains(h.host)) h.fn();
      });
    }, 220);
  });

  var io;
  function reveal() {
    var items = [].slice.call(document.querySelectorAll(".rise:not(.in)"));
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.02 });
    items.forEach(function (el) { io.observe(el); });
    // 兜底：首屏内的元素若未在 400ms 内被观察到，直接显示
    setTimeout(function () {
      items.forEach(function (el) {
        if (el.classList.contains("in")) return;
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.1) el.classList.add("in");
      });
    }, 400);
  }

  /* ---------------- 路由 ---------------- */
  function setNav(hash) {
    document.querySelectorAll(".nav a.link").forEach(function (a) {
      var h = a.getAttribute("href").replace(/^#/, "");
      a.classList.toggle("on", h === hash || (h === "/" && (hash === "" || hash.indexOf("/species/") === 0 || hash.indexOf("/tree/") === 0)));
    });
  }

  function render() {
    var hash = location.hash.replace(/^#/, "") || "/";
    resizeHandlers = [];
    var out = null;

    if (hash === "/" || hash === "") { out = { html: viewHome() }; }
    else if (hash.indexOf("/species/") === 0) { out = viewSpecies(hash.split("/")[2]); }
    else if (hash.indexOf("/tree/") === 0) { out = viewTree(hash.split("/")[2].toUpperCase()); }
    else if (hash === "/notes") { out = viewNotes(); }
    else if (hash === "/qr") { out = viewQR(); }
    else { out = { html: '<div class="wrap section"><h1 style="font-size:32px">没有这个页面</h1><p><a href="#/">回到名录</a></p></div>' }; }

    if (!out) {
      out = { html: '<div class="wrap section"><h1 style="font-size:32px">找不到这株树</h1><p style="color:var(--ink-3)">编号可能写错了。<a href="#/" style="color:var(--seal)">回到名录</a></p></div>' };
    }
    if (typeof out === "string") out = { html: out };
    app.innerHTML = out.html;
    document.title = (hash === "/" || hash === "" ? "一树一码 · 珍木科研园" : "珍木科研园 · 一树一码");

    if (out.after) out.after();
    if (hash === "/" || hash === "") {
      var hq = document.getElementById("homeqr");
      if (hq) hq.insertAdjacentHTML("afterbegin", qrSvg(baseUrl() + "#/", { quiet: 2 }));
    }
    setNav(hash);
    reveal();
    window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  }

  window.addEventListener("hashchange", render);
  if (/[?&]noanim/.test(location.search)) document.documentElement.classList.add("noanim");
  render();
})();
