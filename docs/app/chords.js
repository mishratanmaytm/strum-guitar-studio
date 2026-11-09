/* chords.js - chord library with finger-position diagrams and a strum button */
(function () {
  var S = (window.Strum = window.Strum || {});
  var ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var TYPES = [
    { id: "maj", label: "Major", suffix: "" },
    { id: "min", label: "Minor", suffix: "m" },
    { id: "7", label: "7", suffix: "7" },
    { id: "maj7", label: "Maj7", suffix: "maj7" },
    { id: "m7", label: "m7", suffix: "m7" },
    { id: "sus2", label: "sus2", suffix: "sus2" },
    { id: "sus4", label: "sus4", suffix: "sus4" }
  ];
  var OPEN_MIDI = [40, 45, 50, 55, 59, 64];   // E2 A2 D3 G3 B3 E4 (standard tuning)

  // Shapes with the root on the 6th string (E shape) or the 5th string (A shape).
  // -1 = don't play that string, 0 = open string, other numbers = fret.
  var E_SHAPES = {
    maj: [0, 2, 2, 1, 0, 0], min: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0],
    maj7: [0, 2, 1, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0]
  };
  var A_SHAPES = {
    maj: [-1, 0, 2, 2, 2, 0], min: [-1, 0, 2, 2, 1, 0], "7": [-1, 0, 2, 0, 2, 0],
    maj7: [-1, 0, 2, 1, 2, 0], m7: [-1, 0, 2, 0, 1, 0], sus2: [-1, 0, 2, 2, 0, 0],
    sus4: [-1, 0, 2, 2, 3, 0]
  };
  // Extra open chords that the shapes above can't make.
  var OPEN = {
    "C maj": [-1, 3, 2, 0, 1, 0], "C 7": [-1, 3, 2, 3, 1, 0], "C maj7": [-1, 3, 2, 0, 0, 0],
    "D maj": [-1, -1, 0, 2, 3, 2], "D min": [-1, -1, 0, 2, 3, 1], "D 7": [-1, -1, 0, 2, 1, 2],
    "D maj7": [-1, -1, 0, 2, 2, 2], "D m7": [-1, -1, 0, 2, 1, 1], "D sus2": [-1, -1, 0, 2, 3, 0],
    "D sus4": [-1, -1, 0, 2, 3, 3], "G maj": [3, 2, 0, 0, 0, 3], "G 7": [3, 2, 0, 0, 0, 1],
    "G maj7": [3, 2, 0, 0, 0, 2], "F maj": [-1, -1, 3, 2, 1, 1], "F maj7": [-1, -1, 3, 2, 1, 0]
  };

  function shift(shape, n) { return shape.map(function (f) { return f < 0 ? f : f + n; }); }
  function same(a, b) { return a.join() === b.join(); }
  function maxFret(f) { return Math.max.apply(null, f); }

  // All the ways to play a chord, easiest first.
  S.voicings = function (rootIdx, type) {
    var list = [];
    function add(label, frets) {
      if (!list.some(function (v) { return same(v.frets, frets); })) list.push({ label: label, frets: frets });
    }
    var open = OPEN[ROOTS[rootIdx] + " " + type];
    if (open) add("Open", open);
    var nE = (rootIdx - 4 + 12) % 12, nA = (rootIdx - 9 + 12) % 12;
    var shapes = [];
    if (E_SHAPES[type]) shapes.push({ f: shift(E_SHAPES[type], nE), n: nE, name: "E shape" });
    if (A_SHAPES[type]) shapes.push({ f: shift(A_SHAPES[type], nA), n: nA, name: "A shape" });
    shapes.sort(function (a, b) { return maxFret(a.f) - maxFret(b.f); });
    shapes.forEach(function (s) {
      add(s.n === 0 ? "Open" : "Barre " + s.name + " (fret " + s.n + ")", s.f);
    });
    return list;
  };

  S.chordNotes = function (frets) {
    var names = [];
    frets.forEach(function (f, i) {
      if (f < 0) return;
      var n = S.NOTE_NAMES[(OPEN_MIDI[i] + f) % 12];
      if (names.indexOf(n) < 0) names.push(n);
    });
    return names;
  };

  S.diagramSvg = function (frets) {
    var left = 40, gap = 28, top = 60, rowH = 36, rows = 5, i, r, y, x;
    var fretted = frets.filter(function (f) { return f > 0; });
    var min = fretted.length ? Math.min.apply(null, fretted) : 1;
    var max = fretted.length ? Math.max.apply(null, fretted) : 1;
    var base = max <= 5 ? 1 : min;
    var w = 5 * gap;
    var s = '<svg viewBox="0 0 220 270" class="chord" role="img" aria-label="Chord diagram">';
    for (r = 0; r <= rows; r++) {
      y = top + r * rowH;
      s += '<line class="fretline" x1="' + left + '" y1="' + y + '" x2="' + (left + w) + '" y2="' + y + '"/>';
    }
    if (base === 1) s += '<rect class="nut" x="' + (left - 2) + '" y="' + (top - 5) + '" width="' + (w + 4) + '" height="6" rx="2"/>';
    else s += '<text class="lbl" x="' + (left - 12) + '" y="' + (top + rowH * 0.62) + '" text-anchor="end">' + base + 'fr</text>';
    for (i = 0; i < 6; i++) {
      x = left + i * gap;
      s += '<line class="stringline" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + rows * rowH) + '"/>';
    }
    // barre bar
    var barre = false;
    if (fretted.length) {
      var idx = [];
      frets.forEach(function (f, k) { if (f === min) idx.push(k); });
      var a = idx[0], b = idx[idx.length - 1], ok = b - a >= 2;
      for (i = a; ok && i <= b; i++) if (frets[i] < min) ok = false;
      if (ok) {
        barre = true;
        y = top + (min - base) * rowH + rowH / 2;
        s += '<rect class="dot" x="' + (left + a * gap - 11) + '" y="' + (y - 11) + '" width="' + ((b - a) * gap + 22) + '" height="22" rx="11"/>';
      }
    }
    frets.forEach(function (f, k) {
      x = left + k * gap;
      if (f < 0) {
        s += '<path class="mark" d="M' + (x - 6) + ' ' + (top - 26) + 'l12 12m0 -12l-12 12"/>';
      } else if (f === 0) {
        s += '<circle class="open" cx="' + x + '" cy="' + (top - 20) + '" r="6.5"/>';
      } else if (!(barre && f === min)) {
        s += '<circle class="dot" cx="' + x + '" cy="' + (top + (f - base) * rowH + rowH / 2) + '" r="11"/>';
      }
    });
    return s + "</svg>";
  };

  S.initChords = function () {
    var $ = function (id) { return document.getElementById(id); };
    var root = 0, type = "maj", pick = 0, current = null;

    ROOTS.forEach(function (name, i) {
      var b = document.createElement("button");
      b.textContent = name;
      b.addEventListener("click", function () { root = i; pick = 0; render(); });
      $("roots").appendChild(b);
    });
    TYPES.forEach(function (t) {
      var b = document.createElement("button");
      b.textContent = t.label;
      b.addEventListener("click", function () { type = t.id; pick = 0; render(); });
      $("types").appendChild(b);
    });

    function render() {
      var rs = $("roots").children, ts = $("types").children, i;
      for (i = 0; i < rs.length; i++) rs[i].classList.toggle("on", i === root);
      for (i = 0; i < ts.length; i++) ts[i].classList.toggle("on", TYPES[i].id === type);
      var t = TYPES.filter(function (x) { return x.id === type; })[0];
      var list = S.voicings(root, type);
      var box = $("voicings");
      box.innerHTML = "";
      if (!list.length) {
        $("chordName").textContent = ROOTS[root] + t.suffix;
        $("chordNotes").textContent = "";
        $("chordSvg").innerHTML = '<p class="dim">No shape saved for this one yet – try another type.</p>';
        $("playChord").disabled = true;
        current = null;
        return;
      }
      $("playChord").disabled = false;
      pick = Math.min(pick, list.length - 1);
      current = list[pick].frets;
      list.forEach(function (v, k) {
        var b = document.createElement("button");
        b.textContent = v.label;
        b.className = k === pick ? "on" : "";
        b.addEventListener("click", function () { pick = k; render(); });
        box.appendChild(b);
      });
      $("chordName").textContent = ROOTS[root] + t.suffix;
      $("chordNotes").textContent = "Notes: " + S.chordNotes(current).join("  ");
      $("chordSvg").innerHTML = S.diagramSvg(current);
    }

    $("playChord").addEventListener("click", function () {
      if (!current) return;
      var c = S.audio(), t = c.currentTime + 0.02, k = 0;
      current.forEach(function (f, i) {
        if (f < 0) return;
        S.pluck(S.midiToFreq(OPEN_MIDI[i] + f, 440), t + k * 0.05, 0.45);
        k++;
      });
    });
    render();
  };
})();