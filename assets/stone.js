// Renders the STONE demo from stone/data.json: one card per recording (player, waveform with
// per-syllable tone marks, syllable table with segment playback) and the reliability table.
// Page hooks: #cases, #reliability-table, and .copy buttons.
(function () {
  "use strict";

  var POSITIONS = {
    "word-internal": "Word-internal",
    "before-punct": "Before punctuation",
    "word-final": "Word-final",
    "before-neutral": "Before neutral tone",
    "neutral": "Neutral tone"
  };

  // Notable contrasts per recording, by syllable number and tone only. "#n" becomes a play button.
  var HIGHLIGHTS = {
    SuiSiann_0310: [
      "#1 keeps its citation tone 7 before a comma; #2, the same syllable inside a word, changes to 3.",
      "#10 changes from 1 to 7 inside a word; #11, the same syllable right after it, keeps 1 before the full stop."
    ],
    SuiSiann_2876: [
      "#9 changes from 8 to 4 inside a word; #10, the same syllable, is predicted as 8.",
      "#5 changes from 1 to 7 inside a word; #7 keeps 1 before a comma."
    ],
    SuiSiann_2812: [
      "#4 changes from 3 to 2 inside a word; #5 keeps its citation tone 1 before a comma.",
      "#8 and #9, two identical syllables, both change from 4 to 2 inside a word."
    ],
    SuiSiann_0382: [
      "#5 keeps its citation tone 1 before a neutral tone; #6 is the neutral tone itself (0)."
    ],
    SuiSiann_2441: [
      "#1 changes from 3 to 2 inside a word, while #12 keeps 3 at the end of the sentence (both are tone 3).",
      "#3 keeps 7 before a comma."
    ]
  };

  // Reliability groups from category_reliability.csv (level = group), in display order.
  var GROUPS = [
    ["WI-1", "Word-internal, 1 → 7"],
    ["WI-2", "Word-internal, 2 → 1 or 5"],
    ["WI-3", "Word-internal, 3 → 2"],
    ["WI-4", "Word-internal, 4 → 8 (final -p/-t/-k)"],
    ["WI-4h", "Word-internal, 4 → 2 (final -h)"],
    ["WI-5", "Word-internal, 5 → 7 or 3"],
    ["WI-7", "Word-internal, 7 → 3"],
    ["WI-8", "Word-internal, 8 → 4 (final -p/-t/-k)"],
    ["WI-8h", "Word-internal, 8 → 3 (final -h)"],
    ["PP", "Before punctuation, citation tone kept"],
    ["WF", "Word-final, citation or sandhi tone"],
    ["PW", "Before a neutral tone, citation tone kept"],
    ["W", "Neutral-tone syllable (0)"]
  ];

  var CONFIDENT = 0.7;
  var PX_PER_SECOND = 92; // minimum waveform width, so tone marks stay apart on phones

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

  function svgEl(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function fmtTime(t) {
    if (!isFinite(t) || t < 0) t = 0;
    return t.toFixed(1) + " s";
  }

  function playIcon() {
    var icon = el("span", { class: "p-icon" });
    icon.innerHTML =
      '<svg viewBox="0 0 12 12" aria-hidden="true">' +
      '<path class="i-play" d="M2.7 1.4 L10.6 6 L2.7 10.6 Z"></path>' +
      '<rect class="i-pause" x="2.4" y="1.4" width="2.5" height="9.2"></rect>' +
      '<rect class="i-pause" x="7.1" y="1.4" width="2.5" height="9.2"></rect>' +
      "</svg>";
    return icon;
  }

  /* --------------------------------------------------------------------
   * Playback. Whole recordings play through an <audio> element. Syllable
   * segments play the same original file through Web Audio, scheduled on the
   * audio clock with a start offset and duration, so they stop exactly at the
   * boundary even where timers and animation frames are throttled. Nothing is
   * cut or saved: the file is decoded once and a time range of it is played.
   * One sound plays at a time.
   * ------------------------------------------------------------------ */

  var cards = [];
  var audioCtx = null;
  var segmentSource = null; // { node, card }

  function context() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function decode(ctx, data) {
    return new Promise(function (resolve, reject) {
      var p = ctx.decodeAudioData(data, resolve, reject); // callback form for older Safari
      if (p && p.then) p.then(resolve, reject);
    });
  }

  function stopSegment() {
    if (!segmentSource) return;
    var s = segmentSource;
    segmentSource = null;
    s.node.onended = null;
    try { s.node.stop(); } catch (e) { /* already stopped */ }
    s.card.onSegmentEnd();
  }

  function stopAll(except) {
    stopSegment();
    cards.forEach(function (c) {
      if (c !== except && !c.audio.paused) c.audio.pause();
    });
  }

  // Segment i spans the midpoints between neighboring CTC spikes; the first and last extend
  // to the start and end of the recording.
  function segmentBounds(syllables, duration) {
    var centers = syllables.map(function (s) { return s.start_s + 0.01; });
    return centers.map(function (c, i) {
      return {
        from: i === 0 ? 0 : (centers[i - 1] + c) / 2,
        to: i === centers.length - 1 ? duration : (c + centers[i + 1]) / 2
      };
    });
  }

  function buildCard(clip) {
    var duration = clip.duration_s;
    var bounds = segmentBounds(clip.syllables, duration);
    var audio = el("audio", { preload: "metadata", src: clip.audio });
    var state = { audio: audio, segment: null, raf: 0, loading: null, token: null, onSegmentEnd: null };
    cards.push(state);

    /* Header */
    var head = el("div", { class: "sentence-head" }, [
      el("div", { class: "case-meta" }, [
        el("span", { class: "case-stat", text: clip.syllables.length + " syllables" }),
        el("span", { class: "case-stat", text: fmtTime(duration) }),
        el("span", { class: "case-stat", text: "Score_tone " + clip.score_tone.toFixed(2) }),
        el("span", { class: "case-stat", text: "Coverage " + clip.coverage.toFixed(2) })
      ]),
      el("span", { class: "sentence-id", text: clip.id })
    ]);

    /* Player: toggle + waveform with tone marks */
    var toggle = el("button", { type: "button", class: "p-toggle", "aria-label": "Play recording " + clip.id }, [playIcon()]);
    var time = el("span", { class: "p-time", text: "0.0 s / " + fmtTime(duration) });

    var W = clip.peaks.length;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " 100", preserveAspectRatio: "none", "aria-hidden": "true", class: "wave-svg" });
    var d = "";
    clip.peaks.forEach(function (p, i) {
      var y1 = 50 - p[1] * 46;
      var y2 = 50 - p[0] * 46;
      if (y2 - y1 < 0.8) { y1 -= 0.4; y2 += 0.4; }
      d += "M" + (i + 0.5) + " " + y1.toFixed(1) + "V" + y2.toFixed(1);
    });
    var clipId = "played-" + clip.id;
    var defs = svgEl("defs");
    var clipPath = svgEl("clipPath", { id: clipId });
    var playedRect = svgEl("rect", { x: "0", y: "0", width: "0", height: "100" });
    clipPath.appendChild(playedRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);
    svg.appendChild(svgEl("path", { d: d, class: "wave-base" }));
    svg.appendChild(svgEl("path", { d: d, class: "wave-played", "clip-path": "url(#" + clipId + ")" }));

    var segShade = el("span", { class: "wave-seg", "aria-hidden": "true" });
    var wave = el("div", {
      class: "wave",
      role: "slider",
      tabindex: "0",
      "aria-label": "Seek: recording " + clip.id,
      "aria-valuemin": "0",
      "aria-valuemax": String(duration),
      "aria-valuenow": "0"
    }, [svg, segShade]);
    wave.style.minWidth = Math.round(duration * PX_PER_SECOND) + "px";

    var marks = clip.syllables.map(function (s) {
      var pct = (s.start_s + 0.01) / duration * 100;
      var top1 = s.top3[0];
      var mark = el("span", {
        class: "tone-mark" + (s.lawful ? "" : " is-wrong") + (top1.score < CONFIDENT ? " is-low" : ""),
        "aria-hidden": "true"
      }, [
        el("span", { class: "tone-mark-num", text: String(top1.tone) }),
        el("span", { class: "tone-mark-idx", text: String(s.idx) })
      ]);
      mark.style.left = pct.toFixed(3) + "%";
      wave.appendChild(mark);
      return mark;
    });

    var waveScroll = el("div", { class: "wave-scroll" }, [wave]);
    var player = el("div", { class: "player case-player" }, [toggle, waveScroll, time]);
    player.appendChild(audio);

    /* Syllable table */
    var rows = [];
    var segButtons = [];
    var tbody = el("tbody");
    clip.syllables.forEach(function (s, i) {
      var top1 = s.top3[0];
      var segBtn = el("button", {
        type: "button",
        class: "seg-play",
        "aria-label": "Play syllable " + s.idx + " of " + clip.id
      }, [playIcon()]);
      segBtn.addEventListener("click", function () { playSegment(i); });
      segButtons.push(segBtn);

      var tr = el("tr", { class: s.lawful ? "" : "is-wrong" }, [
        el("td", { class: "c-idx" }, [segBtn, el("span", { class: "c-idx-num", text: String(s.idx) })]),
        el("td", { class: "c-pos", text: POSITIONS[s.position] }),
        el("td", { class: "c-num", text: String(s.citation_tone) }),
        el("td", { class: "c-num", text: s.lawful_tones.join(" / ") }),
        el("td", { class: "c-pred" + (top1.score < CONFIDENT ? " is-low" : "") }, [
          el("strong", { text: String(top1.tone) }),
          el("span", { class: "c-score", text: top1.score.toFixed(2) })
        ]),
        el("td", { class: "c-top3" }, s.top3.map(function (t) {
          return el("span", { class: "c-alt" }, [
            String(t.tone),
            el("span", { class: "c-score", text: t.score.toFixed(2) })
          ]);
        })),
        el("td", {
          class: "c-ok",
          "aria-label": s.lawful ? "lawful" : "not lawful",
          text: s.lawful ? "✓" : "✗"
        })
      ]);
      rows.push(tr);
      tbody.appendChild(tr);
    });

    var table = el("table", { class: "syl-table" }, [
      el("thead", null, [el("tr", null, [
        el("th", { scope: "col", text: "#" }),
        el("th", { scope: "col", text: "Position" }),
        el("th", { scope: "col", text: "Citation tone" }),
        el("th", { scope: "col", text: "Expected tone(s)" }),
        el("th", { scope: "col", text: "Predicted" }),
        el("th", { scope: "col", text: "Top-3" }),
        el("th", { scope: "col" }, [el("span", { "aria-hidden": "true", text: "✓ / ✗" }), el("span", { class: "visually-hidden", text: "Lawful" })])
      ])]),
      tbody
    ]);

    /* Highlights */
    var notes = (HIGHLIGHTS[clip.id] || []).map(function (text) {
      var li = el("li");
      text.split(/(#\d+)/).forEach(function (part) {
        var m = /^#(\d+)$/.exec(part);
        if (!m) { if (part) li.appendChild(document.createTextNode(part)); return; }
        var i = Number(m[1]) - 1;
        var b = el("button", { type: "button", class: "syl-ref", "aria-label": "Play syllable " + m[1], text: part });
        b.addEventListener("click", function () { playSegment(i); });
        li.appendChild(b);
      });
      return li;
    });

    /* Playback logic */
    function setActive(i, playing) {
      rows.forEach(function (r, k) { r.classList.toggle("is-active", k === i); });
      marks.forEach(function (m, k) { m.classList.toggle("is-active", k === i); });
      segButtons.forEach(function (b, k) { b.classList.toggle("is-playing", k === i && Boolean(playing)); });
      if (i === null || i === undefined) {
        segShade.style.display = "none";
      } else {
        segShade.style.display = "block";
        segShade.style.left = (bounds[i].from / duration * 100).toFixed(3) + "%";
        segShade.style.width = ((bounds[i].to - bounds[i].from) / duration * 100).toFixed(3) + "%";
      }
    }

    function drawProgress(t) {
      playedRect.setAttribute("width", (Math.min(1, t / duration) * W).toFixed(1));
      time.textContent = fmtTime(t) + " / " + fmtTime(duration);
    }

    // Whole-recording state from the <audio> element.
    function paint() {
      var t = audio.currentTime;
      var playing = !audio.paused;
      drawProgress(t);
      wave.setAttribute("aria-valuenow", t.toFixed(2));
      player.classList.toggle("is-playing", playing);
      toggle.setAttribute("aria-label", (playing ? "Pause" : "Play") + " recording " + clip.id);
      if (state.segment === null) {
        var cur = null;
        if (playing) bounds.forEach(function (b, k) { if (t >= b.from && t < b.to) cur = k; });
        setActive(cur, false);
      }
    }

    function loadBuffer(ctx) {
      if (!state.loading) {
        state.loading = fetch(clip.audio)
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.arrayBuffer();
          })
          .then(function (data) { return decode(ctx, data); });
        state.loading.catch(function () { state.loading = null; });
      }
      return state.loading;
    }

    state.onSegmentEnd = function () {
      cancelAnimationFrame(state.raf);
      state.segment = null;
      setActive(null, false);
      paint();
    };

    function playSegment(i) {
      var same = state.segment === i;
      stopAll(null);
      if (same) return; // second click on the playing segment stops it
      var ctx = context(); // created inside the click, so browsers allow sound
      var token = {};
      state.segment = i;
      state.token = token;
      setActive(i, true);
      drawProgress(bounds[i].from);
      segmentSource = { node: { stop: function () {} }, card: state }; // placeholder while decoding
      loadBuffer(ctx).then(function (buffer) {
        if (state.token !== token || !segmentSource || segmentSource.card !== state) return;
        var node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(ctx.destination);
        var from = bounds[i].from;
        var length = bounds[i].to - from;
        node.onended = function () {
          if (segmentSource && segmentSource.node === node) {
            segmentSource = null;
            state.onSegmentEnd();
          }
        };
        segmentSource = { node: node, card: state };
        var startedAt = ctx.currentTime;
        node.start(0, from, length);
        var tick = function () {
          if (!segmentSource || segmentSource.node !== node) return;
          drawProgress(from + Math.min(length, ctx.currentTime - startedAt));
          state.raf = requestAnimationFrame(tick);
        };
        state.raf = requestAnimationFrame(tick);
      }, function () {
        if (segmentSource && segmentSource.card === state) segmentSource = null;
        state.onSegmentEnd();
        player.classList.add("is-error");
      });
    }

    toggle.addEventListener("click", function () {
      stopAll(state);
      if (!audio.paused) { audio.pause(); return; }
      if (audio.currentTime >= duration - 0.05) audio.currentTime = 0;
      var started = audio.play();
      if (started && started.catch) started.catch(function () { player.classList.add("is-error"); });
    });

    function seekTo(clientX) {
      var rect = wave.getBoundingClientRect();
      if (!rect.width) return;
      if (segmentSource && segmentSource.card === state) stopSegment();
      audio.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration;
      paint();
    }
    wave.addEventListener("click", function (e) { seekTo(e.clientX); });
    wave.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        if (segmentSource && segmentSource.card === state) stopSegment();
        audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + (e.key === "ArrowLeft" ? -0.5 : 0.5)));
        paint();
      }
    });

    ["play", "pause", "ended", "timeupdate", "seeked"].forEach(function (ev) {
      audio.addEventListener(ev, function () {
        if (state.segment === null) paint();
      });
    });
    audio.addEventListener("error", function () {
      player.classList.add("is-error");
      toggle.disabled = true;
    });

    return el("article", { class: "sentence-card case-card", "aria-label": "Recording " + clip.id }, [
      head,
      player,
      notes.length ? el("div", { class: "case-notes" }, [
        el("p", { class: "case-notes-label", text: "Worth listening for" }),
        el("ul", null, notes)
      ]) : null,
      el("div", { class: "table-wrap syl-wrap" }, [table])
    ]);
  }

  /* --------------------------------------------------------------------
   * Reliability table
   * ------------------------------------------------------------------ */

  function reliabilityTable(groups) {
    var byKey = {};
    groups.forEach(function (g) { byKey[g.category] = g; });
    var body = el("tbody");
    GROUPS.forEach(function (row) {
      var g = byKey[row[0]];
      if (!g) return;
      var v = g.top1_lawful_if_confident;
      body.appendChild(el("tr", { class: v < 0.5 ? "is-low" : "" }, [
        el("th", { scope: "row", text: row[1] }),
        el("td", { class: "c-num", text: String(g.n) }),
        el("td", { class: "c-num", text: String(g.n_confident) }),
        el("td", { class: "score-cell" }, [
          el("span", { class: "num", text: (v * 100).toFixed(0) + "%" }),
          el("span", { class: "bar", "aria-hidden": "true" }, [
            el("span", { style: "width:" + (v * 100).toFixed(1) + "%" })
          ])
        ])
      ]));
    });
    var table = el("table", { class: "results reliability" }, [
      el("caption", { text: "300 SuíSiann sentences, strictly aligned syllables · share of confident syllables (score ≥ 0.7) whose top prediction is lawful" }),
      el("thead", null, [el("tr", null, [
        el("th", { scope: "col", text: "Position and sandhi" }),
        el("th", { scope: "col", text: "Syllables" }),
        el("th", { scope: "col", text: "Confident" }),
        el("th", { scope: "col", text: "Top-1 lawful" })
      ])]),
      body
    ]);
    return el("div", { class: "table-wrap" }, [table]);
  }

  function render(data) {
    var target = document.getElementById("cases");
    if (target) data.clips.forEach(function (c) { target.appendChild(buildCard(c)); });
    var rel = document.getElementById("reliability-table");
    if (rel) rel.appendChild(reliabilityTable(data.reliability));
  }

  function showError(err) {
    var target = document.getElementById("cases") || document.body;
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
  fetch(document.body.getAttribute("data-demo") || "data.json")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(showError);
})();
