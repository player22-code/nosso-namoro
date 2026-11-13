/* The existing account/theme controls remain the sole source of truth. */
(() => {
  'use strict';
  function init() {
    const hero = document.querySelector('header.nh-hero-referencia');
    if (!hero || hero.querySelector('.nh-bedroom')) return;
    const art = document.createElement('div');
    art.className = 'nh-bedroom';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = `<div class="nh-bedroom__day"></div><div class="nh-bedroom__night"></div>
      <video class="nh-bedroom__video" data-direction="night" muted playsinline preload="auto" disablepictureinpicture src="diapranoite.mp4"></video>
      <video class="nh-bedroom__video" data-direction="day" muted playsinline preload="auto" disablepictureinpicture src="noitapradia.mp4"></video>
      <div class="nh-bedroom__soft"></div>`;
    hero.prepend(art);
    const videos = [...art.querySelectorAll('video')];
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const isNight = () => document.body.classList.contains('tema-escuro');
    let target = isNight(), settled = Number(target), active = null, revision = 0;
    art.dataset.state = target ? 'night' : 'day';
    const ready = new Map(videos.map(video => {
      video.muted = true;
      video.defaultMuted = true;
      return [video, new Promise(resolve => {
        if (video.readyState >= 2) return resolve(true);
        video.addEventListener('loadeddata', () => resolve(true), {once: true});
        video.addEventListener('error', () => resolve(false), {once: true});
      })];
    }));
    function stop() {
      videos.forEach(v => { v.pause(); v.classList.remove('is-playing'); });
      active = null;
    }
    function finish() {
      revision++;
      stop();
      settled = Number(target);
      art.dataset.state = target ? 'night' : 'day';
    }
    function progress() {
      if (!active || !Number.isFinite(active.duration) || !active.duration) return settled;
      const fraction = Math.max(0, Math.min(1, active.currentTime / active.duration));
      return active.dataset.direction === 'night' ? fraction : 1 - fraction;
    }
    async function change() {
      const next = isNight();
      if (next === target) return; // Unrelated body class changes must not restart playback.
      const position = progress();
      target = next;
      const token = ++revision;
      stop();
      settled = position;
      art.dataset.state = target ? 'night' : 'day';
      if (motion.matches || document.hidden) return finish();
      const video = videos.find(v => v.dataset.direction === (next ? 'night' : 'day'));
      const usable = await ready.get(video);
      if (token !== revision) return;
      if (!usable || !Number.isFinite(video.duration) || video.error) return finish();
      const fraction = next ? position : 1 - position;
      if (fraction >= .999) return finish();
      const show = async () => {
        if (token !== revision) return;
        active = video;
        video.classList.add('is-playing');
        try { await video.play(); } catch { if (token === revision) finish(); }
      };
      const time = fraction * video.duration;
      if (Math.abs(video.currentTime - time) > .015) {
        video.addEventListener('seeked', show, {once: true});
        video.currentTime = time;
      } else show();
    }
    videos.forEach(v => {
      v.addEventListener('ended', () => { if (active === v) finish(); });
      v.addEventListener('error', () => { if (active === v) finish(); });
    });
    new MutationObserver(change).observe(document.body, {attributes: true, attributeFilter: ['class']});
    motion.addEventListener('change', () => { if (motion.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
    window.addEventListener('pagehide', finish);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
