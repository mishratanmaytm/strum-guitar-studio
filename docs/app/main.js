/* main.js - tabs and start-up */
document.addEventListener("DOMContentLoaded", function () {
  var S = window.Strum;
  var titles = { tuner: "Tuner", metronome: "Metronome", chords: "Chords", practice: "Practice" };
  var tabs = document.querySelectorAll("#nav button");

  function show(name) {
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.toggle("active", s.id === "tab-" + name);
    });
    tabs.forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    document.getElementById("screenTitle").textContent = titles[name];
    if (name !== "tuner") S.stopTuner();
    try { localStorage.setItem("strum.tab", name); } catch (e) {}
  }
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { show(b.dataset.tab); });
  });

  ["initTuner", "initMetronome", "initChords", "initPractice"].forEach(function (name) {
    try { S[name](); } catch (e) { console.error(name, e); }
  });

  var start = "tuner";
  try { start = localStorage.getItem("strum.tab") || "tuner"; } catch (e) {}
  show(titles[start] ? start : "tuner");

  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol) && !window.Capacitor) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
});