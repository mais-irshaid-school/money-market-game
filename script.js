/* سوق الأمان — لعبة تعليمية ثابتة بلا خادم */
/* بنك الأسئلة (questionBank) موجود بملف questions.js */
const QUESTIONS_PER_GAME = 10;
const MAX_ATTEMPTS = 3;
const STALLS = [
  ["🥖", "المخبز"], ["🍎", "بائع الفاكهة"], ["📚", "المكتبة"], ["👟", "محل الأحذية"], ["🧸", "محل الألعاب"],
  ["🥛", "محل الألبان"], ["✏️", "القرطاسية"], ["🧵", "محل الأقمشة"], ["🍯", "بائع العسل"], ["🌷", "محل الورد"]
];

let questions = [];
let recentlyUsed = new Set();
let current = 0;
let attemptsLeft = MAX_ATTEMPTS;
let coins = 0;
let busy = false;
let missed = [];
let muted = false;
let audioContext = null;

const $ = (id) => document.getElementById(id);
const scene = $("scene"), girl = $("girl"), stall = $("stall");
const arabicNumber = (v) => String(v).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* نسحب 10 أسئلة (نفضّل ما لم يظهر في الألعاب السابقة) ونخلط الخيارات */
function pickQuestions() {
  let fresh = questionBank.filter((q) => !recentlyUsed.has(q));
  if (fresh.length < QUESTIONS_PER_GAME) {
    recentlyUsed = new Set();
    fresh = [...questionBank];
  }
  const picked = shuffle(fresh).slice(0, QUESTIONS_PER_GAME);
  picked.forEach((q) => recentlyUsed.add(q));
  return picked.map((q) => {
    const correctText = q.options[q.correctIndex];
    const options = shuffle(q.options);
    return { text: q.text, options, correctIndex: options.indexOf(correctText) };
  });
}

function getAudio() {
  if (!audioContext) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function tone(freq, delay, duration, type = "sine") {
  if (muted) return;
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  const t = ctx.currentTime + delay;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(.0001, t);
  gain.gain.exponentialRampToValueAtTime(.16, t + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + .05);
}
const sounds = {
  start: () => [523, 659, 784].forEach((f, i) => tone(f, i * .09, .18)),
  coin: () => { tone(988, 0, .12, "square"); tone(1319, .09, .25, "square"); },
  wrong: () => { tone(220, 0, .22, "sawtooth"); tone(165, .14, .3, "sawtooth"); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * .12, .3)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * .18, .35, "triangle"))
};

function setStatus(message) { $("statusMessage").textContent = message; }

function renderHearts() { $("hearts").textContent = "❤️".repeat(attemptsLeft) + "🤍".repeat(MAX_ATTEMPTS - attemptsLeft); }
function renderProgress() {
  $("progressText").textContent = `${arabicNumber(Math.min(current + 1, QUESTIONS_PER_GAME))} من ${arabicNumber(QUESTIONS_PER_GAME)}`;
  $("progressFill").style.width = `${(current / QUESTIONS_PER_GAME) * 100}%`;
}
function renderCoins(dropped = false) {
  $("coinCount").textContent = arabicNumber(coins);
  const pile = $("jarCoins");
  pile.innerHTML = "";
  for (let i = 0; i < coins; i++) {
    const coin = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    coin.setAttribute("cx", 40 + ((i % 3) - 1) * 15);
    coin.setAttribute("cy", 86 - Math.floor(i / 3) * 7);
    coin.setAttribute("rx", 12);
    coin.setAttribute("ry", 5);
    coin.setAttribute("fill", "url(#gold)");
    coin.setAttribute("stroke", "#b97d0b");
    coin.setAttribute("stroke-width", "1.2");
    if (dropped && i === coins - 1) coin.classList.add("coin-in");
    pile.appendChild(coin);
  }
}
/* قطعة ذهبية تطير من الدكان إلى الحصّالة */
function flyCoin() {
  const from = stall.getBoundingClientRect();
  const to = $("piggy").getBoundingClientRect();
  const coin = document.createElement("span");
  coin.className = "coin-fly";
  coin.textContent = "د";
  coin.style.left = `${from.left + from.width / 2}px`;
  coin.style.top = `${from.top + 20}px`;
  document.body.appendChild(coin);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + 20);
  const anim = coin.animate(
    [{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${dx / 2}px, ${dy - 60}px) scale(1.4)` }, { transform: `translate(${dx}px, ${dy}px) scale(.7)` }],
    { duration: 800, easing: "ease-in-out" }
  );
  return anim.finished.catch(() => {}).then(() => {
    coin.remove();
    const piggy = $("piggy");
    piggy.classList.remove("bump");
    void piggy.offsetWidth;
    piggy.classList.add("bump");
  });
}

async function showStall(index) {
  const [icon, name] = STALLS[index];
  $("questionBubble").hidden = true;
  stall.classList.add("in-start");
  $("stallIcon").textContent = icon;
  $("stallName").textContent = name;
  void stall.offsetWidth;
  stall.classList.remove("in-start", "out");
  girl.classList.add("walking");
  await wait(700);
  girl.classList.remove("walking");
  renderQuestion(index);
}

function renderQuestion(index) {
  const q = questions[index];
  $("questionNumber").textContent = `السؤال ${arabicNumber(index + 1)} من ${arabicNumber(QUESTIONS_PER_GAME)}`;
  $("questionText").textContent = q.text;
  const letters = ["أ", "ب", "ج"];
  const box = $("answers");
  box.innerHTML = "";
  q.options.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer";
    btn.innerHTML = `<span class="letter">${letters[i]}</span><span></span>`;
    btn.lastChild.textContent = text;
    btn.addEventListener("click", () => handleAnswer(i, btn));
    box.appendChild(btn);
  });
  $("questionBubble").hidden = false;
  busy = false;
  setStatus(`${q.text}`);
}

async function handleAnswer(i, btn) {
  if (busy) return;
  const q = questions[current];
  if (i === q.correctIndex) {
    busy = true;
    btn.classList.add("correct");
    document.querySelectorAll(".answer").forEach((b) => (b.disabled = true));
    sounds.coin();
    await flyCoin();
    coins++;
    renderCoins(true);
    setStatus("إجابة صحيحة! كسبتِ قطعة ذهبية.");
    await wait(450);
    current++;
    if (current >= QUESTIONS_PER_GAME) return win();
    renderProgress();
    $("questionBubble").hidden = true;
    stall.classList.add("out");
    await wait(650);
    showStall(current);
  } else {
    btn.classList.add("wrong");
    btn.disabled = true;
    sounds.wrong();
    attemptsLeft--;
    if (!missed.includes(q)) missed.push(q);
    renderHearts();
    setStatus("إجابة غير صحيحة، حاولي مرة أخرى.");
    if (attemptsLeft <= 0) {
      busy = true;
      await wait(700);
      lose();
    }
  }
}

function win() {
  $("progressFill").style.width = "100%";
  sounds.win();
  $("winOverlay").hidden = false;
  setStatus("تهانينا! لقد فزتِ!");
}
function lose() {
  sounds.lose();
  $("loseSummary").textContent = coins > 0
    ? `جمعتِ ${arabicNumber(coins)} من ${arabicNumber(QUESTIONS_PER_GAME)} قطع ذهبية. المحاولة جزء من التعلّم، جرّبي مرة ثانية!`
    : "لم تفتح الحصّالة بعد، لكن المحاولة جزء من التعلّم. جرّبي مرة ثانية!";
  const list = $("loseReviewList");
  list.innerHTML = "";
  missed.forEach((q) => {
    const item = document.createElement("li");
    const question = document.createElement("span");
    question.className = "review-q";
    question.textContent = q.text;
    const answer = document.createElement("span");
    answer.className = "review-a";
    answer.textContent = `الإجابة الصحيحة: ${q.options[q.correctIndex]}`;
    item.append(question, answer);
    list.appendChild(item);
  });
  $("loseReview").hidden = missed.length === 0;
  $("loseOverlay").hidden = false;
  setStatus("استنفدتِ المحاولات الثلاث.");
}

function startGame() {
  getAudio();
  questions = pickQuestions();
  current = 0;
  coins = 0;
  attemptsLeft = MAX_ATTEMPTS;
  missed = [];
  busy = true;
  $("winOverlay").hidden = true;
  $("loseOverlay").hidden = true;
  $("startCard").hidden = true;
  renderHearts();
  renderProgress();
  renderCoins();
  sounds.start();
  showStall(0);
}

$("startButton").addEventListener("click", startGame);
$("playAgainButton").addEventListener("click", startGame);
$("restartButton").addEventListener("click", startGame);
$("soundToggle").addEventListener("click", () => {
  muted = !muted;
  $("soundToggle").setAttribute("aria-pressed", String(muted));
  $("soundToggle").querySelector(".sound-icon").textContent = muted ? "🔇" : "🔊";
});

renderHearts();
renderCoins();
