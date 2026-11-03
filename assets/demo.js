// Renders the results table and audio sample cards from a demo page's data.json.
// Page hooks: #results, #featured, #more (each optional), and .copy buttons.
(function () {
  "use strict";

  // Display order: best-sounding condition first; the human recording follows.
  var CONDITIONS = [
    { key: "both", label: "Han-ji + Tâi-lô" },
    { key: "tl", label: "Tâi-lô only" },
    { key: "han", label: "Han-ji only" }
  ];
  var HUMAN = { key: "human", label: "Human recording", short: "Human · SuíSiann" };
  var ASPECTS = [
    { key: "pron", label: "Pronunciation" },
    { key: "nat", label: "Naturalness" },
    { key: "acc", label: "Accent" }
  ];
  // Mean of the three aspects, as used in the paper (e.g. "3.799 overall").
  var MEAN = { key: "overall", label: "Mean" };
  var SUISIANN_URL = "https://suisiann-dataset.ithuan.tw/";
  var CC_BY_SA_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else if (k === "class") node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function fmt(x) {
    return Number(x).toFixed(2);
  }

  function fmtTime(t) {
    if (!isFinite(t) || t < 0) return "0:00";
    var m = Math.floor(t / 60);
    var s = Math.round(t % 60);
    if (s === 60) { m += 1; s = 0; }
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* --------------------------------------------------------------------
   * Custom audio player: toggle button, tick-meter progress, timecode.
   * Purely decorative meter heights, derived from the clip's own path so
   * they stay stable between renders. One clip plays at a time.
   * ------------------------------------------------------------------ */

  var TICKS = 26;
  var livePlayers = [];

  function meterHeights(seed, n) {
    var heights = [];
    var x = seed || 1;
    for (var i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      var r = x / 233280;
      var wave = 0.5 + 0.5 * Math.sin(i * 0.62 + r * 6.2832);
      heights.push(0.32 + 0.68 * (0.35 * r + 0.65 * wave));
    }
    return heights;
  }

  function seedFromString(s) {
    var h = 7;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h) || 7;
  }

  function condMarker(key) {
    return el("span", { class: "cond-mark cond-" + key, "aria-hidden": "true" });
  }

  function buildPlayer(src, ariaLabel, condKey) {
    var audio = el("audio", { preload: "metadata", src: src });

    var icon = el("span", { class: "p-icon" });
    icon.innerHTML =
      '<svg viewBox="0 0 12 12" aria-hidden="true">' +
      '<path class="i-play" d="M2.7 1.4 L10.6 6 L2.7 10.6 Z"></path>' +
      '<rect class="i-pause" x="2.4" y="1.4" width="2.5" height="9.2"></rect>' +
      '<rect class="i-pause" x="7.1" y="1.4" width="2.5" height="9.2"></rect>' +
      "</svg>";

    var toggle = el("button", { type: "button", class: "p-toggle", "aria-label": "Play: " + ariaLabel }, [icon]);

    var track = el("div", {
      class: "p-track",
      role: "slider",
      tabindex: "0",
      "aria-label": "Seek: " + ariaLabel,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": "0"
    });

    var ticks = [];
    meterHeights(seedFromString(src), TICKS).forEach(function (h) {
      var tick = el("span", { class: "p-tick" });
      tick.style.height = Math.round(h * 100) + "%";
      track.appendChild(tick);
      ticks.push(tick);
    });
    var cursor = el("span", { class: "p-cursor", "aria-hidden": "true" });
    track.appendChild(cursor);

    var time = el("span", { class: "p-time", text: "0:00" });

    var player = el("div", { class: "player" }, [toggle, track, time]);
    player.appendChild(audio);

    var playing = false;

    function paint() {
      var d = audio.duration;
      var frac = isFinite(d) && d > 0 ? Math.min(1, audio.currentTime / d) : 0;
      var lit = Math.round(frac * TICKS);
      ticks.forEach(function (t, i) { t.classList.toggle("is-on", i < lit); });
      cursor.style.left = (frac * 100).toFixed(2) + "%";
      time.textContent = isFinite(d) && d > 0
        ? fmtTime(audio.currentTime) + " / " + fmtTime(d)
        : fmtTime(audio.currentTime);
      track.setAttribute("aria-valuenow", String(Math.round(frac * 100)));
      track.setAttribute("aria-valuetext", fmtTime(audio.currentTime) + " of " + fmtTime(d));
      toggle.setAttribute("aria-label", (playing ? "Pause: " : "Play: ") + ariaLabel);
      player.classList.toggle("is-playing", playing);
      player.classList.toggle("is-seekable", isFinite(d) && d > 0);
    }

    function pauseAllOthers() {
      livePlayers.forEach(function (p) {
        if (p.audio !== audio && !p.audio.paused) p.audio.pause();
      });
    }

    toggle.addEventListener("click", function () {
      pauseAllOthers();
      if (audio.paused) {
        var started = audio.play();
        if (started && started.catch) started.catch(function () { player.classList.add("is-error"); });
      } else {
        audio.pause();
      }
    });

    function seekTo(clientX) {
      var rect = track.getBoundingClientRect();
      if (!rect.width || !isFinite(audio.duration) || audio.duration <= 0) return;
      var frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audio.currentTime = frac * audio.duration;
      paint();
    }

    track.addEventListener("click", function (e) { seekTo(e.clientX); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        var step = e.key === "ArrowLeft" ? -2 : 2;
        if (isFinite(audio.duration)) {
          audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + step));
          paint();
        }
      }
    });

    ["play", "pause", "ended", "timeupdate", "loadedmetadata", "durationchange"].forEach(function (ev) {
      audio.addEventListener(ev, function () {
        if (ev === "play") playing = true;
        if (ev === "pause" || ev === "ended") playing = false;
        paint();
      });
    });

    audio.addEventListener("error", function () {
      player.classList.remove("is-playing");
      player.classList.add("is-error");
      toggle.disabled = true;
    });

    var entry = {
      audio: audio,
      player: player,
      condKey: condKey || null
    };
    livePlayers.push(entry);

    return player;
  }

  /* --------------------------------------------------------------------
   * Cards
   * ------------------------------------------------------------------ */

  function scoreList(clip) {
    var dl = el("dl", { class: "scores" });
    ASPECTS.forEach(function (a) {
      var row = el("div", null, [
        el("dt", { text: a.label }),
        el("dd", null, [
          fmt(clip[a.key]),
          el("span", { class: "sd", text: "± " + fmt(clip[a.key + "_sd"]) })
        ])
      ]);
      dl.appendChild(row);
    });
    return dl;
  }

  function clipColumn(sentence, cond, isHuman) {
    var clip = sentence.clips[cond.key];
    var label = isHuman ? (HUMAN.short || HUMAN.label) : cond.label;
    var col = el("section", { class: "clip" + (isHuman ? " human" : "") });

    col.appendChild(el("p", { class: "clip-label" }, [
      condMarker(cond.key),
      label
    ]));
    col.appendChild(el("p", { class: "clip-mean" }, [
      el("span", { class: "clip-mean-label", text: "Mean" }),
      el("span", { class: "clip-mean-num", text: fmt(clip.overall) })
    ]));
    if (clip.audio) {
      col.appendChild(buildPlayer(clip.audio, label + ": " + sentence.hanji, cond.key));
    }
    col.appendChild(scoreList(clip));
    if (isHuman) {
      col.appendChild(el("p", { class: "license" }, [
        "Source: ",
        el("a", { href: SUISIANN_URL, text: "SuíSiann Dataset" }),
        " · ",
        el("a", { href: CC_BY_SA_URL, text: "CC BY-SA 4.0" })
      ]));
    }
    return col;
  }

  function humanReference(clip) {
    var parts = ASPECTS.map(function (a) {
      return a.label + " " + fmt(clip[a.key]) + " ± " + fmt(clip[a.key + "_sd"]);
    });
    parts.unshift("Mean " + fmt(clip.overall));
    return el("p", { class: "human-ref" }, [
      "Human recording (SuíSiann, not included here): " + parts.join(" · ")
    ]);
  }

  function sentenceCard(s) {
    var human = s.clips[HUMAN.key];
    var hasHuman = Boolean(human && human.audio);

    var head = el("div", { class: "sentence-head" }, [
      el("div", { class: "sentence-text" }, [
        el("p", { class: "hanji", lang: "nan-Hant-TW", text: s.hanji }),
        el("p", { class: "tailo", lang: "nan-Latn-tailo", text: s.tailo }),
        s.english ? el("p", { class: "english", lang: "en", text: s.english }) : null
      ]),
      el("span", { class: "sentence-id", text: s.sentence_id })
    ]);

    var grid = el("div", { class: "clip-grid" + (hasHuman ? " has-human" : "") });
    CONDITIONS.forEach(function (c) {
      grid.appendChild(clipColumn(s, c, false));
    });
    if (hasHuman) grid.appendChild(clipColumn(s, HUMAN, true));

    return el("article", { class: "sentence-card", "aria-label": s.hanji }, [
      head,
      grid,
      !hasHuman && human ? humanReference(human) : null
    ]);
  }

  /* --------------------------------------------------------------------
   * Results table
   * ------------------------------------------------------------------ */

  function resultsTable(summary) {
    var rows = [HUMAN].concat(CONDITIONS);
    var table = el("table", { class: "results" });
    table.appendChild(el("caption", {
      text: "Mean ratings (1–5) over all " + summary.n_sentences +
        " sentences · bar length is proportional to the score on a 1–5 scale"
    }));
    var head = el("tr", null, [el("th", { scope: "col", text: "Condition" })]);
    ASPECTS.concat([MEAN]).forEach(function (a) {
      head.appendChild(el("th", { scope: "col", class: a === MEAN ? "mean-col" : "", text: a.label }));
    });
    table.appendChild(el("thead", null, [head]));

    var body = el("tbody");
    rows.forEach(function (c) {
      var scores = summary.conditions[c.key];
      var name = el("span", { class: "cond-name" }, [
        condMarker(c.key),
        c.key === HUMAN.key ? "Human recording" : c.label
      ]);
      var tr = el("tr", {
        class: c.key === HUMAN.key ? "human-row" : "",
        "data-cond": c.key
      }, [el("th", { scope: "row" }, [name])]);
      ASPECTS.concat([MEAN]).forEach(function (a) {
        var v = scores[a.key];
        var pct = Math.max(0, Math.min(100, ((v - 1) / 4) * 100));
        tr.appendChild(el("td", { class: "score-cell" + (a === MEAN ? " mean-col" : "") }, [
          el("span", { class: "num", text: v.toFixed(2) }),
          el("span", { class: "bar", "aria-hidden": "true" }, [
            el("span", { style: "width:" + pct.toFixed(1) + "%" })
          ])
        ]));
      });
      body.appendChild(tr);
    });
    table.appendChild(body);
    return el("div", { class: "table-wrap" }, [table]);
  }

  function render(data) {
    var results = document.getElementById("results");
    if (results && data.summary) results.appendChild(resultsTable(data.summary));

    ["featured", "more"].forEach(function (group) {
      var target = document.getElementById(group);
      if (!target) return;
      data.sentences
        .filter(function (s) { return s.group === group; })
        .forEach(function (s) { target.appendChild(sentenceCard(s)); });
    });
  }

  function showError(err) {
    var target = document.getElementById("featured") || document.body;
    target.appendChild(el("p", {
      class: "muted",
      text: "Could not load data.json (" + err.message + "). If you opened this file directly, " +
        "serve the folder with `python -m http.server` instead."
    }));
  }

  function setupCopyButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
      btn.addEventListener("click", function () {
        var source = document.getElementById(btn.getAttribute("data-copy"));
        var text = source ? source.textContent : "";
        var done = function () {
          var original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(function () { btn.textContent = original; }, 1500);
        };
        var fallback = function () {
          var ta = el("textarea", { readonly: "" });
          ta.value = text;
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          done();
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else {
          fallback();
        }
      });
    });
  }

  setupCopyButtons();
  var src = document.body.getAttribute("data-demo") || "data.json";
  fetch(src)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(showError);
})();
