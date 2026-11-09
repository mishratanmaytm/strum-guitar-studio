/* tuner.js - listens through the microphone and shows how in tune a string is */
(function () {
  var S = (window.Strum = window.Strum || {});

  S.TUNINGS = [
    { name: "Standard (E A D G B E)", midi: [40, 45, 50, 55, 59, 64] },
    { name: "Drop D", midi: [38, 45, 50, 55, 59, 64] },
    { name: "Half step down", midi: [39, 44, 49, 54, 58, 63] },
    { name: "DADGAD", midi: [38, 45, 50, 55, 57, 62] },
    { name: "Open G", midi: [38, 43, 50, 55, 59, 62] },
    { name: "Open D", midi: [38, 45, 50, 54, 57, 62] }
  ];

  function noteName(m) { return S.NOTE_NAMES[((m % 12) + 12) % 12]; }
  function octave(m) { return Math.floor(m / 12) - 1; }
  S.noteLabel = function (m) { return noteName(m) + octave(m); };

  // YIN pitch detection: finds the repeating period in the sound wave.
  S.yin = function (buf, sampleRate) {
    var n = buf.length, half = Math.floor(n / 2), i, tau;
    var rms = 0;
    for (i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.008) return null;                       // too quiet

    var minTau = Math.floor(sampleRate / 1100);
    var maxTau = Math.min(Math.floor(sampleRate / 60), half - 1);
    var diff = new Float32Array(maxTau + 1);
    for (tau = 1; tau <= maxTau; tau++) {
      var sum = 0;
      for (i = 0; i < half; i++) { var x = buf[i] - buf[i + tau]; sum += x * x; }
      diff[tau] = sum;
    }
    var cmnd = new Float32Array(maxTau + 1), running = 0;
    cmnd[0] = 1;
    for (tau = 1; tau <= maxTau; tau++) {
      running += diff[tau];
      cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
    }
    var found = -1;
    for (tau = Math.max(2, minTau); tau < maxTau; tau++) {
      if (cmnd[tau] < 0.12) {
        while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
        found = tau;
        break;
      }
    }
    if (found < 0) return null;
    var a = cmnd[found - 1], b = cmnd[found], c = cmnd[found + 1];
    var denom = a - 2 * b + c;
    var better = denom !== 0 ? found + (a - c) / (2 * denom) : found;
    return sampleRate / better;
  };

  // Which string is the sound closest to, and how many cents sharp or flat?
  S.analyse = function (freq, midiList, a4) {
    var best = null;
    midiList.forEach(function (m, i) {
      var target = S.midiToFreq(m, a4);
      var cents = (1200 * Math.log(freq / target)) / Math.LN2;
      if (!best || Math.abs(cents) < Math.abs(best.cents)) {
        best = { mode: "string", string: i, midi: m, target: target, cents: cents };
      }
    });
    if (Math.abs(best.cents) <= 150) return best;
    var nm = Math.round(69 + (12 * Math.log(freq / a4)) / Math.LN2);
    var t = S.midiToFreq(nm, a4);
    return { mode: "note", string: -1, midi: nm, target: t,
             cents: (1200 * Math.log(freq / t)) / Math.LN2 };
  };

  S.stopTuner = function () {};

  S.initTuner = function () {
    var $ = function (id) { return document.getElementById(id); };
    var a4 = 440, tuning = S.TUNINGS[0];
    var running = false, stream = null, analyser = null, buf = null, ctx = null;
    var recent = [], misses = 0, lastTick = 0, target = 0, shown = 0, rafId = 0;

    // draw the gauge ticks
    var ticks = "";
    for (var c = -50; c <= 50; c += 10) {
      var ang = (c * 0.9 * Math.PI) / 180, long = c % 50 === 0;
      var r1 = long ? 104 : 110, r2 = 120;
      ticks += '<line class="tick' + (c === 0 ? " zero" : "") + '" x1="' + (150 + r1 * Math.sin(ang)).toFixed(1) +
        '" y1="' + (150 - r1 * Math.cos(ang)).toFixed(1) + '" x2="' + (150 + r2 * Math.sin(ang)).toFixed(1) +
        '" y2="' + (150 - r2 * Math.cos(ang)).toFixed(1) + '"/>';
    }
    $("ticks").innerHTML = ticks;

    S.TUNINGS.forEach(function (t, i) {
      var o = document.createElement("option");
      o.value = i; o.textContent = t.name;
      $("tuneSelect").appendChild(o);
    });

    function renderStrings(active) {
      var box = $("strings");
      box.innerHTML = "";
      tuning.midi.forEach(function (m, i) {
        var b = document.createElement("button");
        b.className = "str" + (i === active ? " on" : "");
        b.innerHTML = "<small>" + (6 - i) + "</small>" + S.noteLabel(m);
        b.addEventListener("click", function () { S.tone(S.midiToFreq(m, a4), 2.2); });
        box.appendChild(b);
      });
    }

    function setNeedle() {
      shown += (target - shown) * 0.25;
      $("needle").setAttribute("transform", "rotate(" + shown.toFixed(2) + " 150 150)");
    }
    function animate() {
      if (!running) return;
      setNeedle();
      rafId = requestAnimationFrame(animate);
    }

    function idle() {
      target = 0;
      $("noteBig").textContent = "–";
      $("noteOct").textContent = "";
      $("tuneStatus").textContent = running ? "Play a string…" : "Tap Start";
      $("tuneStatus").className = "status";
      $("centsTxt").textContent = "";
      $("freqTxt").textContent = "";
      $("gauge").classList.remove("good");
      renderStrings(-1);
    }

    function show(res, freq) {
      var cents = Math.max(-50, Math.min(50, res.cents));
      target = cents * 0.9;
      var good = Math.abs(res.cents) <= 5;
      $("noteBig").textContent = S.NOTE_NAMES[((res.midi % 12) + 12) % 12];
      $("noteOct").textContent = String(Math.floor(res.midi / 12) - 1);
      $("tuneStatus").textContent = good ? "In tune ✓" : res.cents < 0 ? "Too low – tune up" : "Too high – tune down";
      $("tuneStatus").className = "status " + (good ? "good" : "bad");
      $("centsTxt").textContent = (res.cents > 0 ? "+" : "") + res.cents.toFixed(0) + " cents";
      $("freqTxt").textContent = freq.toFixed(1) + " Hz";
      $("gauge").classList.toggle("good", good);
      var buttons = $("strings").children;
      for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle("on", i === res.string);
    }

    function median(list) {
      var s = list.slice().sort(function (x, y) { return x - y; });
      return s[Math.floor(s.length / 2)];
    }

    function tick(ts) {
      if (!running) return;
      requestAnimationFrame(tick);
      if (ts - lastTick < 45) return;
      lastTick = ts;
      analyser.getFloatTimeDomainData(buf);
      var f = S.yin(buf, ctx.sampleRate);
      if (f && f > 60 && f < 1100) {
        misses = 0;
        recent.push(f);
        if (recent.length > 5) recent.shift();
        var m = median(recent);
        show(S.analyse(m, tuning.midi, a4), m);
      } else if (++misses > 8) {
        recent = [];
        idle();
      }
    }

    async function start() {
      $("tuneMsg").textContent = "";
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        $("tuneMsg").textContent = "The microphone needs a secure page (https or localhost).";
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
      } catch (e) {
        $("tuneMsg").textContent = "Microphone is blocked. Allow it in your browser or phone settings, then try again.";
        return;
      }
      ctx = S.audio();
      var src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      running = true; recent = []; misses = 0;
      $("tuneBtn").textContent = "Stop";
      $("tuneBtn").classList.add("stop");
      idle();
      requestAnimationFrame(tick);
      rafId = requestAnimationFrame(animate);
    }

    function stop() {
      running = false;
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
      $("tuneBtn").textContent = "Start";
      $("tuneBtn").classList.remove("stop");
      target = 0; shown = 0; setNeedle();
      idle();
    }
    S.stopTuner = function () { if (running) stop(); };

    $("tuneBtn").addEventListener("click", function () { running ? stop() : start(); });
    $("tuneSelect").addEventListener("change", function () {
      tuning = S.TUNINGS[Number($("tuneSelect").value)];
      renderStrings(-1);
    });
    function setA4(v) {
      a4 = Math.max(430, Math.min(450, v));
      $("a4Val").textContent = a4;
    }
    $("a4Minus").addEventListener("click", function () { setA4(a4 - 1); });
    $("a4Plus").addEventListener("click", function () { setA4(a4 + 1); });
    idle();
  };
})();