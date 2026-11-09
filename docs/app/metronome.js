/* metronome.js - a steady click that stays in time (uses the audio clock) */
(function () {
  var S = (window.Strum = window.Strum || {});

  S.tempoName = function (bpm) {
    if (bpm < 40) return "Grave";
    if (bpm < 60) return "Largo";
    if (bpm < 66) return "Larghetto";
    if (bpm < 76) return "Adagio";
    if (bpm < 108) return "Andante";
    if (bpm < 120) return "Moderato";
    if (bpm < 156) return "Allegro";
    if (bpm < 176) return "Vivace";
    if (bpm < 200) return "Presto";
    return "Prestissimo";
  };

  S.initMetronome = function () {
    var $ = function (id) { return document.getElementById(id); };
    var bpm = 100, num = 4, den = 4, sub = false, running = false;
    var ctx = null, timer = 0, nextTime = 0, beatIndex = 0, queue = [], taps = [], lock = null;

    try {
      var saved = JSON.parse(localStorage.getItem("strum.metro") || "{}");
      if (saved.bpm) bpm = saved.bpm;
      if (saved.num) num = saved.num;
      if (saved.den) den = saved.den;
      sub = !!saved.sub;
    } catch (e) {}

    function persist() {
      try { localStorage.setItem("strum.metro", JSON.stringify({ bpm: bpm, num: num, den: den, sub: sub })); } catch (e) {}
    }
    function secPerBeat() { return (60 / bpm) * (4 / den); }

    function drawBeats(active) {
      var box = $("beats");
      if (box.children.length !== num) {
        box.innerHTML = "";
        for (var i = 0; i < num; i++) {
          var d = document.createElement("span");
          d.className = "beat" + (i === 0 ? " first" : "");
          box.appendChild(d);
        }
      }
      for (var j = 0; j < box.children.length; j++) box.children[j].classList.toggle("on", j === active);
    }

    function refresh() {
      $("bpmVal").textContent = bpm;
      $("tempoName").textContent = S.tempoName(bpm);
      $("bpmSlider").value = bpm;
      $("subBtn").classList.toggle("active", sub);
      $("sigSelect").value = num + "/" + den;
      drawBeats(-1);
      persist();
    }
    function setBpm(v) { bpm = Math.max(30, Math.min(300, Math.round(v))); refresh(); }

    function click(time, freq, vol) {
      var osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(vol * 0.35, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.06);
    }

    function schedule() {
      while (nextTime < ctx.currentTime + 0.12) {
        var strong = beatIndex === 0;
        click(nextTime, strong ? 1500 : 1000, strong ? 1 : 0.7);
        if (sub) click(nextTime + secPerBeat() / 2, 700, 0.3);
        queue.push({ t: nextTime, i: beatIndex });
        nextTime += secPerBeat();
        beatIndex = (beatIndex + 1) % num;
      }
    }

    function watch() {
      if (!running) return;
      while (queue.length && queue[0].t <= ctx.currentTime) drawBeats(queue.shift().i);
      requestAnimationFrame(watch);
    }

    async function start() {
      ctx = S.audio();
      running = true; beatIndex = 0; queue = [];
      nextTime = ctx.currentTime + 0.08;
      timer = setInterval(schedule, 25);
      schedule();
      requestAnimationFrame(watch);
      $("metBtn").textContent = "Stop";
      $("metBtn").classList.add("stop");
      try { if (navigator.wakeLock) lock = await navigator.wakeLock.request("screen"); } catch (e) {}
    }
    function stop() {
      running = false;
      clearInterval(timer);
      $("metBtn").textContent = "Start";
      $("metBtn").classList.remove("stop");
      drawBeats(-1);
      try { if (lock) lock.release(); } catch (e) {}
      lock = null;
    }

    $("metBtn").addEventListener("click", function () { running ? stop() : start(); });
    $("bpmMinus").addEventListener("click", function () { setBpm(bpm - 1); });
    $("bpmPlus").addEventListener("click", function () { setBpm(bpm + 1); });
    $("bpmMinus5").addEventListener("click", function () { setBpm(bpm - 5); });
    $("bpmPlus5").addEventListener("click", function () { setBpm(bpm + 5); });
    $("bpmSlider").addEventListener("input", function () { setBpm(Number($("bpmSlider").value)); });
    $("subBtn").addEventListener("click", function () { sub = !sub; refresh(); });
    $("sigSelect").addEventListener("change", function () {
      var p = $("sigSelect").value.split("/");
      num = Number(p[0]); den = Number(p[1]);
      beatIndex = 0; $("beats").innerHTML = "";
      refresh();
    });
    $("tapBtn").addEventListener("click", function () {
      var now = Date.now();
      if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
      taps.push(now);
      if (taps.length > 6) taps.shift();
      if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
    });
    refresh();
  };
})();