(() => {
  const DURATION_MS = 25 * 60 * 1000;
  const RADIUS = 96;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const timerEl = document.querySelector(".timer");
  const progressEl = document.getElementById("progress");
  const timeEl = document.getElementById("time");
  const statusEl = document.getElementById("status");
  const toggleBtn = document.getElementById("toggle");
  const toggleIcon = document.getElementById("toggleIcon");
  const toggleLabel = document.getElementById("toggleLabel");
  const resetBtn = document.getElementById("reset");
  const sessionsEl = document.getElementById("sessions");

  // state: "idle" | "running" | "paused" | "done"
  let state = "idle";
  let remainingMs = DURATION_MS;
  let endAt = 0; // timestamp when the running timer reaches zero
  let rafId = null;
  let sessions = loadSessions();

  progressEl.style.strokeDasharray = String(CIRCUMFERENCE);

  function loadSessions() {
    try {
      const today = new Date().toDateString();
      const saved = JSON.parse(localStorage.getItem("focus-sessions") || "{}");
      return saved.date === today ? saved.count : 0;
    } catch {
      return 0;
    }
  }

  function saveSessions() {
    try {
      localStorage.setItem(
        "focus-sessions",
        JSON.stringify({ date: new Date().toDateString(), count: sessions })
      );
    } catch {
      /* storage unavailable — keep in memory only */
    }
  }

  function format(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function render() {
    const elapsedRatio = 1 - remainingMs / DURATION_MS;
    progressEl.style.strokeDashoffset = String(CIRCUMFERENCE * elapsedRatio);

    const text = format(remainingMs);
    if (timeEl.textContent !== text) {
      timeEl.textContent = text;
      document.title = state === "idle" ? "Focus Timer" : `${text} · Focus`;
    }

    const labels = {
      idle: ["▶", "시작", "준비"],
      running: ["❚❚", "일시정지", "집중 중"],
      paused: ["▶", "계속", "일시정지"],
      done: ["▶", "다시 시작", "완료!"],
    };
    const [icon, label, status] = labels[state];
    toggleIcon.textContent = icon;
    toggleLabel.textContent = label;
    statusEl.textContent = status;

    timerEl.classList.toggle("is-running", state === "running");
    timerEl.classList.toggle("is-done", state === "done");
    sessionsEl.textContent = String(sessions);
  }

  function tick() {
    cancelAnimationFrame(rafId);
    remainingMs = Math.max(0, endAt - Date.now());
    if (remainingMs === 0) {
      finish();
      return;
    }
    render();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (state === "done") remainingMs = DURATION_MS;
    state = "running";
    endAt = Date.now() + remainingMs;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
    render();
  }

  function pause() {
    remainingMs = Math.max(0, endAt - Date.now());
    state = "paused";
    cancelAnimationFrame(rafId);
    render();
  }

  function reset() {
    cancelAnimationFrame(rafId);
    state = "idle";
    remainingMs = DURATION_MS;
    render();
  }

  function finish() {
    cancelAnimationFrame(rafId);
    state = "done";
    remainingMs = 0;
    sessions += 1;
    saveSessions();
    render();
    chime();
    notify();
  }

  function chime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.18;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.85);
      });
    } catch {
      /* audio not available */
    }
  }

  function notify() {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("집중 시간 완료!", { body: "잠시 휴식을 취하세요 ☕" });
    }
  }

  function toggle() {
    if (state === "running") {
      pause();
    } else {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
      start();
    }
  }

  toggleBtn.addEventListener("click", toggle);
  resetBtn.addEventListener("click", reset);

  document.addEventListener("keydown", (e) => {
    if (e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (e.code === "Space") {
      e.preventDefault();
      toggle();
    } else if (e.key === "r" || e.key === "R") {
      reset();
    }
  });

  // rAF is throttled in background tabs; catch up when the tab becomes visible.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state === "running") tick();
  });
  // Keep checking in the background so the chime fires on time.
  setInterval(() => {
    if (state === "running" && Date.now() >= endAt) finish();
  }, 1000);

  render();
})();
