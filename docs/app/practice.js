/* Practice Studio 2.0 — guided routines, session timer, history and local progress. */
(function () {
  "use strict";
  var S = (window.Strum = window.Strum || {});
  var ENTRIES_KEY = "strum.practice.v1";       // Keep the original key so existing logs survive.
  var GOAL_KEY = "strum.goal";
  var PLAN_KEY = "strum.practice.plan.v2";
  var SESSION_KEY = "strum.practice.session.v2";
  var DEFAULT_PLAN = [
    { id: "warmup", name: "Warm-up", minutes: 5 },
    { id: "chords", name: "Chord changes", minutes: 10 },
    { id: "rhythm", name: "Rhythm", minutes: 10 }
  ];
  var HINTS = {
    "Warm-up": "Loosen up, play gently, and get comfortable with your instrument.",
    "Chords": "Focus on clean notes. Let each chord ring before moving on.",
    "Chord changes": "Move slowly between shapes first, then build speed without losing clarity.",
    "Scales": "Keep your notes even and use a relaxed picking hand.",
    "Rhythm": "Stay steady with the beat. Accuracy matters more than speed.",
    "Songs": "Work on a small section and repeat it until it feels comfortable.",
    "Technique": "Keep your movements relaxed, controlled, and consistent.",
    "Ear training": "Listen carefully before playing. Try to recognise the sound first.",
    "Improvisation": "Explore ideas freely while staying aware of the rhythm and key.",
    "Other": "Give this part of your practice your full attention."
  };
  var timer = null;
  var plan = [];
  var entries = [];
  var goal = 20;
  var session = null;

  function $(id) { return document.getElementById(id); }
  function read(key, fallback) {
    try { var raw = localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function dayKey(date) {
    var d = date || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDays(date, amount) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount); }
  function safeMinutes(value, fallback, max) {
    var n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 1 && n <= (max || 600) ? n : fallback;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function formatClock(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(total / 60)) + ":" + pad(total % 60);
  }
  function formatLongDate(key) {
    var p = String(key || "").split("-");
    if (p.length !== 3) return key || "";
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  function totalMinutes(list) {
    return list.reduce(function (sum, e) { return sum + (Number(e.min) || 0); }, 0);
  }
  function dayTotals(list) {
    var totals = {};
    list.forEach(function (e) { if (e.day) totals[e.day] = (totals[e.day] || 0) + (Number(e.min) || 0); });
    return totals;
  }
  function streakCount(totals, today) {
    var d = today || new Date(), count = 0;
    if (!(totals[dayKey(d)] > 0)) d = addDays(d, -1);
    while (totals[dayKey(d)] > 0 && count < 3660) { count++; d = addDays(d, -1); }
    return count;
  }
  S.dayKey = dayKey;
  S.dayTotals = dayTotals;
  S.streak = streakCount;
  S.formatTime = formatClock;

  function normaliseEntries(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (e) {
      return e && typeof e === "object" && Number(e.min) > 0 && e.day;
    }).map(function (e) {
      return {
        id: e.id || (Date.now() + Math.random()), day: String(e.day),
        min: Math.max(1, Math.round(Number(e.min))), cat: String(e.cat || "Other"),
        note: String(e.note || "").slice(0, 100),
        activities: Array.isArray(e.activities) ? e.activities : null,
        kind: e.kind || "manual", durationMs: Number(e.durationMs) || 0
      };
    });
  }
  function normalisePlan(raw) {
    if (!Array.isArray(raw) || !raw.length) return DEFAULT_PLAN.map(function (x) { return Object.assign({}, x); });
    return raw.slice(0, 12).filter(function (x) { return x && x.name; }).map(function (x, i) {
      return { id: String(x.id || ("activity-" + i)), name: String(x.name).slice(0, 32), minutes: safeMinutes(x.minutes, 5, 120) };
    });
  }
  function saveEntries() { write(ENTRIES_KEY, entries); }
  function planDuration() { return plan.reduce(function (sum, x) { return sum + x.minutes; }, 0); }

  function renderStats() {
    var totals = dayTotals(entries), today = totals[dayKey()] || 0;
    var week = 0, days = [], max = goal, i;
    for (i = 6; i >= 0; i--) {
      var d = addDays(new Date(), -i), minutes = totals[dayKey(d)] || 0;
      week += minutes; max = Math.max(max, minutes);
      days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), minutes: minutes, today: i === 0 });
    }
    var percent = Math.min(100, Math.round((today / goal) * 100));
    $("streakVal").textContent = streakCount(totals);
    $("todayVal").textContent = today;
    $("weekVal").textContent = week;
    $("sessionCount").textContent = entries.filter(function (e) { return e.kind === "guided"; }).length;
    $("goalInput").value = goal;
    $("goalTxt").textContent = today + " / " + goal + " min";
    $("goalBar").style.width = percent + "%";
    $("goalPercent").textContent = percent + "%";
    $("goalRemaining").textContent = today >= goal ? "Daily target reached — nicely done." : (goal - today) + " minutes to reach your goal";
    var bars = $("weekBars");
    bars.innerHTML = "";
    days.forEach(function (x) {
      var col = document.createElement("div"); col.className = "practice-day" + (x.today ? " is-today" : "");
      var value = document.createElement("span"); value.className = "practice-day-value"; value.textContent = x.minutes ? x.minutes + "m" : "";
      var track = document.createElement("div"); track.className = "practice-day-track";
      var bar = document.createElement("div"); bar.className = "practice-day-bar";
      bar.style.height = Math.max(x.minutes ? 5 : 2, (x.minutes / max) * 100) + "%";
      track.appendChild(bar);
      var label = document.createElement("span"); label.className = "practice-day-label"; label.textContent = x.label;
      col.appendChild(value); col.appendChild(track); col.appendChild(label); bars.appendChild(col);
    });
    renderFocus();
  }

  function renderFocus() {
    var totals = {};
    entries.forEach(function (e) {
      if (Array.isArray(e.focus) && e.focus.length) {
        e.focus.forEach(function (part) {
          var key = part.name || "Other";
          totals[key] = (totals[key] || 0) + (Number(part.ms) > 0 ? Number(part.ms) / 60000 : (Number(part.min) || 0));
        });
      } else {
        var key = e.cat || "Other"; totals[key] = (totals[key] || 0) + e.min;
      }
    });
    var sorted = Object.keys(totals).map(function (key) { return { name: key, min: totals[key] }; })
      .sort(function (a, b) { return b.min - a.min; }).slice(0, 6);
    var root = $("focusBreakdown"); root.innerHTML = "";
    if (!sorted.length) {
      root.innerHTML = '<p class="empty-state">Your practice focus will appear here after your first session.</p>';
      return;
    }
    var max = sorted[0].min;
    sorted.forEach(function (x) {
      var row = document.createElement("div"); row.className = "focus-row";
      var top = document.createElement("div"); top.className = "focus-row-top";
      var name = document.createElement("span"); name.textContent = x.name;
      var amount = document.createElement("b"); amount.textContent = Math.round(x.min) + " min";
      var track = document.createElement("div"); track.className = "focus-track";
      var fill = document.createElement("div"); fill.className = "focus-fill"; fill.style.width = (x.min / max * 100) + "%";
      top.appendChild(name); top.appendChild(amount); track.appendChild(fill); row.appendChild(top); row.appendChild(track); root.appendChild(row);
    });
  }

  function renderPlan() {
    var root = $("planList"); root.innerHTML = "";
    plan.forEach(function (item, index) {
      var row = document.createElement("div"); row.className = "plan-item";
      var number = document.createElement("span"); number.className = "plan-number"; number.textContent = pad(index + 1);
      var name = document.createElement("div"); name.className = "plan-item-name"; name.textContent = item.name;
      var duration = document.createElement("label"); duration.className = "plan-duration";
      var input = document.createElement("input"); input.type = "number"; input.min = "1"; input.max = "120"; input.value = item.minutes;
      input.setAttribute("aria-label", item.name + " duration in minutes");
      input.addEventListener("change", function () {
        item.minutes = safeMinutes(input.value, item.minutes, 120); input.value = item.minutes;
        write(PLAN_KEY, plan); $("planTotal").textContent = planDuration() + " MIN";
      });
      duration.appendChild(input); var minLabel = document.createElement("span"); minLabel.textContent = "MIN"; duration.appendChild(minLabel);
      var del = document.createElement("button"); del.type = "button"; del.className = "plan-remove"; del.textContent = "×";
      del.setAttribute("aria-label", "Remove " + item.name);
      del.disabled = plan.length <= 1;
      del.addEventListener("click", function () { plan.splice(index, 1); write(PLAN_KEY, plan); renderPlan(); });
      row.appendChild(number); row.appendChild(name); row.appendChild(duration); row.appendChild(del); root.appendChild(row);
    });
    $("planTotal").textContent = planDuration() + " MIN";
    $("startPlanBtn").disabled = !!session;
    $("addActivityBtn").disabled = !!session || plan.length >= 12;
  }

  function renderHistory() {
    var root = $("logList"); root.innerHTML = "";
    var sorted = entries.slice().sort(function (a, b) { return (b.day + String(b.id)).localeCompare(a.day + String(a.id)); });
    $("historyCount").textContent = sorted.length + (sorted.length === 1 ? " entry" : " entries");
    if (!sorted.length) {
      root.innerHTML = '<div class="empty-history"><span>♪</span><b>Your first session starts here</b><p>Complete a guided routine or add practice time to begin your history.</p></div>';
      return;
    }
    sorted.slice(0, 30).forEach(function (entry) {
      var row = document.createElement("article"); row.className = "history-entry";
      var icon = document.createElement("div"); icon.className = "history-entry-icon"; icon.textContent = entry.kind === "guided" ? "♫" : "◷";
      var info = document.createElement("div"); info.className = "history-entry-info";
      var title = document.createElement("b"); title.textContent = entry.kind === "guided" ? "Guided practice" : entry.cat;
      var detail = document.createElement("span");
      var parts = [formatLongDate(entry.day), entry.kind === "guided" ? (entry.activities || []).join(" · ") : entry.cat];
      if (entry.note) parts.push(entry.note);
      detail.textContent = parts.filter(Boolean).join("  •  ");
      var time = document.createElement("strong"); time.textContent = entry.min + "m";
      var del = document.createElement("button"); del.type = "button"; del.className = "history-delete"; del.textContent = "×"; del.setAttribute("aria-label", "Delete practice entry");
      del.addEventListener("click", function () {
        if (!window.confirm("Delete this practice entry?")) return;
        entries = entries.filter(function (x) { return x.id !== entry.id; }); saveEntries(); renderAll();
      });
      var meta = document.createElement("div"); meta.className = "history-entry-meta"; meta.appendChild(time); meta.appendChild(del);
      info.appendChild(title); info.appendChild(detail); row.appendChild(icon); row.appendChild(info); row.appendChild(meta); root.appendChild(row);
    });
  }

  function renderAll() { renderStats(); renderHistory(); renderPlan(); }
  function saveSession() { if (session) write(SESSION_KEY, session); else remove(SESSION_KEY); }
  function currentSessionElapsed(now) {
    if (!session) return 0;
    return session.elapsedMs + (session.paused ? 0 : Math.max(0, now - session.lastStartedAt));
  }
  function currentSegmentElapsed(now) {
    if (!session) return 0;
    return session.segmentElapsedMs + (session.paused ? 0 : Math.max(0, now - session.segmentStartedAt));
  }
  function updateSessionUI() {
    if (!session) return;
    var now = Date.now(), activity = session.activities[session.index];
    if (!activity) return completeSession();
    var duration = activity.minutes * 60000;
    var segmentElapsed = currentSegmentElapsed(now);
    var remaining = Math.max(0, duration - segmentElapsed);
    $("timerTxt").textContent = formatClock(remaining);
    $("sessionActivity").textContent = activity.name;
    $("sessionHint").textContent = HINTS[activity.name] || HINTS.Other;
    $("sessionStep").textContent = (session.index + 1) + " OF " + session.activities.length;
    var completed = session.activities.slice(0, session.index).reduce(function (sum, x) { return sum + x.minutes; }, 0);
    var percent = ((completed + Math.min(activity.minutes, segmentElapsed / 60000)) / session.activities.reduce(function (sum, x) { return sum + x.minutes; }, 0)) * 100;
    $("sessionProgressBar").style.width = Math.min(100, percent) + "%";
    $("pauseSessionBtn").textContent = session.paused ? "▶ Resume" : "Ⅱ Pause";
    if (!session.paused && remaining <= 0) nextActivity();
  }
  function showActiveSession() {
    $("activeSession").hidden = !session;
    if (session) {
        updateSessionUI();
      if (!timer) timer = setInterval(updateSessionUI, 250);
    } else {
      if (timer) clearInterval(timer); timer = null;
      $("timerTxt").textContent = "05:00";
    }
    renderPlan();
  }
  function startSession() {
    if (session || !plan.length) return;
    session = {
      id: "session-" + Date.now(), activities: plan.map(function (x) { return { name: x.name, minutes: x.minutes }; }),
      index: 0, startedAt: Date.now(), lastStartedAt: Date.now(), elapsedMs: 0,
      segmentStartedAt: Date.now(), segmentElapsedMs: 0, completedFocus: [], paused: false
    };
    saveSession(); showActiveSession();
  }
  function pauseSession() {
    if (!session) return;
    if (!session.paused) {
      var now = Date.now();
      session.elapsedMs += Math.max(0, now - session.lastStartedAt);
      session.segmentElapsedMs += Math.max(0, now - session.segmentStartedAt);
      session.paused = true;
    } else {
      session.paused = false; session.lastStartedAt = Date.now(); session.segmentStartedAt = Date.now();
    }
    saveSession(); updateSessionUI();
  }
  function recordCurrentActivity() {
    if (!session) return;
    var activity = session.activities[session.index];
    if (!activity) return;
    var elapsed = currentSegmentElapsed(Date.now());
    session.completedFocus = session.completedFocus || [];
    session.completedFocus.push({ name: activity.name, ms: Math.max(0, elapsed) });
  }
  function nextActivity() {
    if (!session) return;
    recordCurrentActivity();
    session.index++;
    session.segmentElapsedMs = 0;
    session.segmentStartedAt = Date.now();
    if (session.index >= session.activities.length) { completeSession(); return; }
    saveSession(); updateSessionUI();
  }
  function completeSession() {
    if (!session) return;
    var elapsed = currentSessionElapsed(Date.now());
    var activities = session.activities.map(function (x) { return x.name; });
    var focus = session.completedFocus || [];
    var minutes = Math.max(1, Math.round(elapsed / 60000));
    entries.push({ id: session.id, day: dayKey(), min: minutes, cat: "Guided practice", note: "", activities: activities, focus: focus, kind: "guided", durationMs: elapsed });
    saveEntries(); session = null; saveSession();
    if (timer) clearInterval(timer); timer = null;
    $("activeSession").hidden = true;
    renderAll();
    window.alert("Session saved — " + minutes + " minute" + (minutes === 1 ? "" : "s") + " of practice. Great work!");
  }
  function stopAndSaveSession() {
    if (!session) return;
    if (!window.confirm("Finish this session now and save the time you've practised?")) return;
    recordCurrentActivity();
    completeSession();
  }
  function addManualEntry() {
    var minutes = safeMinutes($("addMin").value, 0, 600);
    if (!minutes) { $("addMin").focus(); return; }
    entries.push({ id: "manual-" + Date.now() + "-" + Math.random(), day: dayKey(), min: minutes,
      cat: $("catSel").value, note: $("noteInp").value.trim().slice(0, 100), kind: "manual" });
    saveEntries(); $("addMin").value = ""; $("noteInp").value = ""; renderAll();
  }

  S.initPractice = function () {
    entries = normaliseEntries(read(ENTRIES_KEY, []));
    goal = safeMinutes(read(GOAL_KEY, 20), 20, 600);
    plan = normalisePlan(read(PLAN_KEY, DEFAULT_PLAN));
    session = read(SESSION_KEY, null);
    if (session && (!Array.isArray(session.activities) || !session.activities.length || session.index >= session.activities.length)) session = null;
    if (session) {
      session.index = Math.max(0, Number(session.index) || 0);
      session.elapsedMs = Math.max(0, Number(session.elapsedMs) || 0);
      session.segmentElapsedMs = Math.max(0, Number(session.segmentElapsedMs) || 0);
      var restoredAt = Date.now();
      if (!session.paused) {
        session.elapsedMs += Math.max(0, restoredAt - (Number(session.lastStartedAt) || restoredAt));
        session.segmentElapsedMs += Math.max(0, restoredAt - (Number(session.segmentStartedAt) || restoredAt));
      }
      session.paused = true; // Resume explicitly after a reload; never silently run in the background.
      session.lastStartedAt = restoredAt; session.segmentStartedAt = restoredAt;
      session.completedFocus = Array.isArray(session.completedFocus) ? session.completedFocus : [];
      saveSession();
    }
    $("goalInput").addEventListener("change", function () {
      goal = safeMinutes($("goalInput").value, 20, 600); $("goalInput").value = goal;
      write(GOAL_KEY, goal); renderStats();
    });
    $("addActivityBtn").addEventListener("click", function () {
      if (plan.length >= 12) return;
      var name = $("newActivityType").value, minutes = safeMinutes($("newActivityMinutes").value, 5, 120);
      plan.push({ id: "custom-" + Date.now(), name: name, minutes: minutes });
      write(PLAN_KEY, plan); renderPlan();
    });
    $("resetPlanBtn").addEventListener("click", function () {
      if (!window.confirm("Reset your routine to the Strum starter plan?")) return;
      plan = DEFAULT_PLAN.map(function (x) { return Object.assign({}, x); }); write(PLAN_KEY, plan); renderPlan();
    });
    $("startPlanBtn").addEventListener("click", startSession);
    $("pauseSessionBtn").addEventListener("click", pauseSession);
    $("nextActivityBtn").addEventListener("click", nextActivity);
    $("finishSessionBtn").addEventListener("click", stopAndSaveSession);
    $("addBtn").addEventListener("click", addManualEntry);
    $("addMin").addEventListener("keydown", function (e) { if (e.key === "Enter") addManualEntry(); });
    renderAll();
    if (session) showActiveSession();
    else { $("activeSession").hidden = true; }
  };
})();
