/* audio.js - shared sound helpers for Strum */
(function () {
  var S = (window.Strum = window.Strum || {});
  var ctx = null;

  S.NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  S.audio = function () {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  S.midiToFreq = function (midi, a4) {
    return (a4 || 440) * Math.pow(2, (midi - 69) / 12);
  };

  // A plucked-string sound (Karplus-Strong). Pure maths: returns the samples.
  S.karplus = function (freq, sampleRate, seconds) {
    var n = Math.max(2, Math.round(sampleRate / freq));
    var len = Math.floor(sampleRate * seconds);
    var out = new Float32Array(len);
    var i;
    for (i = 0; i < n && i < len; i++) out[i] = Math.random() * 2 - 1;
    for (i = 1; i < n && i < len; i++) out[i] = (out[i] + out[i - 1]) / 2; // softer pluck
    for (i = n; i < len; i++) out[i] = 0.996 * 0.5 * (out[i - n] + out[i - n + 1]);
    return out;
  };

  S.pluck = function (freq, when, volume) {
    var c = S.audio();
    var data = S.karplus(freq, c.sampleRate, 2.4);
    var buffer = c.createBuffer(1, data.length, c.sampleRate);
    buffer.getChannelData(0).set(data);
    var src = c.createBufferSource();
    src.buffer = buffer;
    var gain = c.createGain();
    gain.gain.value = volume || 0.6;
    src.connect(gain);
    gain.connect(c.destination);
    src.start(when || c.currentTime);
  };

  // A steady reference tone, used by the tuner string buttons.
  S.tone = function (freq, seconds) {
    var c = S.audio();
    var t = c.currentTime;
    var osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    var gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  };
})();