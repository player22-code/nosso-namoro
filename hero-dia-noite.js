/* Decorative layers only: the site's existing theme, account and buttons remain authoritative. */
(() => {
  'use strict';
  function init() {
    const hero = document.querySelector('header.nh-hero-referencia');
    if (!hero || hero.querySelector('.nh-bedroom')) return;
    const art = document.createElement('div');
    art.className = 'nh-bedroom';
    art.setAttribute('aria-hidden', 'true');
    art.innerHTML = `<div class="nh-bedroom__day"></div><div class="nh-bedroom__night"></div>
      <svg class="nh-bedroom__sky" viewBox="0 0 1728 910" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs><clipPath id="nh-window-pane"><path d="M483 215H686V408H483Z"/></clipPath></defs>
        <g clip-path="url(#nh-window-pane)">
          <g class="nh-bedroom__sun"><circle cx="566" cy="294" r="27" fill="#ffe6a1"/><circle cx="566" cy="294" r="35" fill="#ffe6a1" opacity=".16"/></g>
          <g class="nh-bedroom__moon"><path d="M580 267a28 28 0 1 0 10 47 25 25 0 0 1-10-47Z" fill="#fff3d3"/></g>
        </g>
      </svg><div class="nh-bedroom__soft"></div>`;
    hero.prepend(art);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
