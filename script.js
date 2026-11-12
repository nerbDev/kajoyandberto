(function(){
  const S = window.STORY, $ = s => document.querySelector(s);
  const audio = $('#audio'), lyricEl = $('#lyric'), grid = $('#grid'), collage = $('#collage'), hearts = $('#hearts');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IDLE_MS = 2500;   // auto-scroll resumes this long after you stop scrolling
  let lineIdx = -2, playing = false, audioOK = true, fallbackT = 0, last = 0,
      heartTimer = null, lyricToken = 0, finished = false, pos = 0, lastTouch = -1e9;

  $('#title').textContent = S.title; $('#names').textContent = S.names;
  $('#since').textContent = S.since; $('#closing').textContent = S.closing;
  $('#endNames').textContent = S.names; $('#introTitle').textContent = S.title;
  $('#introNames').textContent = S.names; document.title = S.title;
  audio.src = S.audio;

  // Build the collage from the photos list in config.js
  const heights = [1.25, 0.8, 1, 1.4, 0.9, 1.15];
  S.photos.forEach((src, i) => {
    const fig = document.createElement('figure'); fig.className = 'pic';
    const img = new Image(); img.alt = ''; img.decoding = 'async'; img.src = src;
    img.onerror = () => {
      const p = document.createElement('div'); p.className = 'ph';
      p.style.aspectRatio = '1 / ' + heights[i % heights.length]; img.replaceWith(p);
    };
    fig.appendChild(img); grid.appendChild(fig);
  });

  const now = () => audioOK ? audio.currentTime : fallbackT;
  const total = () => audioOK && isFinite(audio.duration) && audio.duration > 0 ? audio.duration : S.fallbackSeconds;

  function setLyric(i){
    if (i === lineIdx) return;
    lineIdx = i; const token = ++lyricToken;
    lyricEl.classList.remove('on');
    if (i < 0) return;
    setTimeout(() => { if (token === lyricToken){ lyricEl.textContent = S.lyrics[i].text; lyricEl.classList.add('on'); } }, 500);
  }

  function activeLine(t){
    const L = S.lyrics;
    for (let i = L.length - 1; i >= 0; i--){
      if (t >= L[i].t){
        const next = L[i + 1] ? L[i + 1].t : Infinity;
        const end = L[i].d ? L[i].t + L[i].d : Math.min(next, L[i].t + 8);
        return t < end - 0.3 ? i : -1;
      }
    }
    return -1;
  }

  // Any manual scrolling pauses the auto-scroll for a moment.
  ['wheel','touchstart','touchmove','touchend','pointerdown','keydown'].forEach(ev =>
    addEventListener(ev, () => { lastTouch = performance.now(); }, { passive: true }));

  function loop(ts){
    const dt = Math.min((ts - last) / 1000, .1); last = ts;
    const auto = playing && !reduce && ts - lastTouch > IDLE_MS;
    if (!auto) pos = collage.scrollTop;
    if (playing){
      if (!audioOK) fallbackT += dt;
      const t = now();
      if (auto){
        // Pace the scroll so the bottom is reached when the song ends.
        const max = collage.scrollHeight - collage.clientHeight;
        const speed = Math.max(0, max - pos) / Math.max(total() - t, 1);
        pos = Math.min(max, pos + speed * dt);
        collage.scrollTop = pos;
      }
      setLyric(activeLine(t));
      $('#bar i').style.width = Math.min(100, t / total() * 100) + '%';
      if (!audioOK && t >= S.fallbackSeconds) finish();
      const c = $('#clock'); if (c) c.textContent = 'time ' + t.toFixed(1) + 's';
    }
    requestAnimationFrame(loop);
  }

  function spawnHeart(){
    if (reduce || document.hidden) return;
    const h = document.createElement('span'); h.className = 'heart'; h.textContent = '\u2665';
    const size = 10 + Math.random() * 22;
    h.style.cssText = `left:${Math.random()*100}%;font-size:${size}px;--dur:${9+Math.random()*8}s;` +
      `--dx:${(Math.random()-.5)*120}px;--rot:${(Math.random()-.5)*60}deg;--op:${.25+Math.random()*.5}`;
    if (Math.random() < .3) h.style.color = 'var(--pearl)';
    h.addEventListener('animationend', () => h.remove()); hearts.appendChild(h);
  }


  // ---- Flowers: bloom on "begin", and a garden at the ending ----
  const bloomEl = $('#bloom');
  const palettes = [
    ['#f4b6c8','#ffe3ea','#ffe08a'], ['#ffd6c4','#fff4ec','#f4a6c0'],
    ['#c9a7ff','#e9dcff','#ffe08a'], ['#e58fb0','#f9cfe0','#fff4ec'],
    ['#fff4ec','#f4b6c8','#ffd98a']
  ];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const groups = { idle: [], burst: [], ending: [] };
  let burstTimer = null, fallTimer = null;
  const base = () => Math.min(innerWidth, innerHeight);

  function flowerSVG(){
    const n = 6 + (Math.random() * 3 | 0), [a, b, c] = pick(palettes);
    let s = '<svg viewBox="-50 -50 100 100">';
    for (let k = 0; k < n; k++)
      s += `<g transform="rotate(${k * 360 / n})"><g class="pet" style="--i:${k}"><ellipse cy="-24" rx="11" ry="24" fill="${a}" fill-opacity=".92" stroke="${b}" stroke-width="1"/></g></g>`;
    for (let k = 0; k < n; k++)
      s += `<g transform="rotate(${k * 360 / n + 180 / n})"><g class="pet in" style="--i:${k}"><ellipse cy="-15" rx="8" ry="15" fill="${b}" fill-opacity=".9"/></g></g>`;
    return s + `<circle class="core" r="6.5" fill="${c}"/></svg>`;
  }

  function makeFlower(group, x, y, size, delay){
    const f = document.createElement('div'); f.className = 'flower';
    f.style.cssText = `left:${x}%;top:${y}%;width:${size}px;--d:${delay}s;--rot:${rnd(-25,25)}deg;--sw:${rnd(4,9)}deg;--sd:${rnd(5,8)}s`;
    f.innerHTML = '<div class="sway">' + flowerSVG() + '</div>';
    bloomEl.appendChild(f); groups[group].push(f);
  }

  function clearGroup(g){
    groups[g].forEach(f => { f.classList.add('out'); setTimeout(() => f.remove(), 2600); });
    groups[g] = [];
  }

  function cornerFlowers(group, scale, delay){
    const b = base();
    [[4,6],[96,8],[3,94],[97,92]].forEach(([x, y], i) =>
      makeFlower(group, x, y, clamp(b * scale * rnd(.8, 1.2), 90, 300), delay + i * .25));
    [[15,3],[85,2],[14,97],[87,98]].forEach(([x, y], i) =>
      makeFlower(group, x, y, clamp(b * scale * .5 * rnd(.8, 1.2), 50, 150), delay + .6 + i * .25));
  }

  function idleBloom(){ cornerFlowers('idle', .3, .2); }

  function bloomBurst(){
    clearGroup('ending'); clearGroup('idle'); clearInterval(fallTimer);
    const n = innerWidth < 600 ? 12 : 20, b = base();
    for (let i = 0; i < n; i++){
      const x = rnd(4, 96), y = rnd(6, 94), dist = Math.hypot(x - 50, y - 50) / 70;
      makeFlower('burst', x, y, clamp(b * rnd(.1, .24), 46, 170), dist * 1.8 + rnd(0, .3));
    }
    clearTimeout(burstTimer); burstTimer = setTimeout(() => clearGroup('burst'), 7500);
  }

  function spawnPetal(){
    if (document.hidden || reduce) return;
    const p = document.createElement('span'), s = rnd(9, 18); p.className = 'fpetal';
    p.style.cssText = `left:${rnd(0,100)}%;width:${s}px;height:${s*1.3}px;background:${pick(palettes)[0]};` +
      `--dx:${rnd(-120,120)}px;--rot:${rnd(180,540)}deg;--fd:${rnd(7,12)}s`;
    p.addEventListener('animationend', () => p.remove()); bloomEl.appendChild(p);
  }

  function bloomEnding(){
    clearTimeout(burstTimer); clearGroup('burst');
    const narrow = innerWidth < 600, n = narrow ? 14 : 26, b = base();
    const box = narrow ? [0, 100, 26, 74] : [24, 76, 26, 74];   // keep the closing text clear
    cornerFlowers('ending', .34, 0);
    for (let i = 0; i < n; i++){
      let x, y;
      do { x = rnd(3, 97); y = rnd(5, 95); } while (x > box[0] && x < box[1] && y > box[2] && y < box[3]);
      makeFlower('ending', x, y, clamp(b * rnd(.09, .2), 42, 150), (1 - y / 100) * 2.4 + rnd(0, .5));
    }
    clearInterval(fallTimer); fallTimer = setInterval(spawnPetal, 450);
  }

  function begin(){
    finished = false; playing = true; document.body.classList.remove('paused');
    collage.scrollTop = 0; pos = 0; lastTouch = -1e9;
    $('#start').classList.add('hidden'); $('#end').classList.add('hidden');
    $('#toggle').classList.remove('hidden'); $('#toggle').textContent = 'Pause';
    bloomBurst();
    for (let i = 0; i < 6; i++) setTimeout(spawnHeart, i * 250);
    clearInterval(heartTimer); heartTimer = setInterval(spawnHeart, 650);
    lineIdx = -2; last = performance.now();
  }

  function start(){ audio.play().then(begin).catch(() => { audioOK = false; begin(); }); }

  function finish(){
    if (finished) return; finished = true; playing = false; clearInterval(heartTimer);
    setLyric(-1); $('#toggle').classList.add('hidden'); $('#end').classList.remove('hidden');
    bloomEnding();
  }

  audio.addEventListener('ended', finish);
  audio.addEventListener('error', () => { audioOK = false; });

  $('#begin').onclick = start;
  $('#replay').onclick = () => { fallbackT = 0; audio.currentTime = 0; audioOK = !audio.error; start(); };
  $('#toggle').onclick = () => {
    playing = !playing; document.body.classList.toggle('paused', !playing);
    $('#toggle').textContent = playing ? 'Pause' : 'Play';
    if (audioOK) playing ? audio.play() : audio.pause();
  };

  // Tune mode: add ?tune to the link, press T at each lyric to log its timestamp.
  if (location.search.includes('tune')){
    const t = $('#tune'); t.classList.remove('hidden');
    t.innerHTML = '<div id="clock">time 0.0s</div><div>Press T when a lyric should appear</div><div id="log"></div>';
    addEventListener('keydown', e => {
      if (e.key.toLowerCase() === 't') $('#log').insertAdjacentHTML('beforeend', `<div>{ t: ${now().toFixed(1)}, text: "" },</div>`);
    });
  }
  setTimeout(idleBloom, 300);
  requestAnimationFrame(loop);
})();
