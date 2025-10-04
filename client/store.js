// Local promo cover images (stored under assets/promo)
import critterCover from './assets/promo/critter_cover.png';
import blingCover from './assets/promo/bling_cover.png';
import goblinCover from './assets/promo/goblin_cover.png';
// Grouped promo images for carousels
import blingGroup1 from './assets/promo/bling_group_1.png';
import blingGroup2 from './assets/promo/bling_group_2.png';
import blingGroup3 from './assets/promo/bling_group_3.png';
import goblinGroup1 from './assets/promo/goblin_group_1.png';
import goblinGroup2 from './assets/promo/goblin_group_2.png';
import goblinGroup3 from './assets/promo/goblin_group_3.png';
import goblinGroup4 from './assets/promo/goblin_group_4.png';
import petGroup1 from './assets/promo/pet_group_1.png';
import petGroup2 from './assets/promo/pet_group_2.png';
import petGroup3 from './assets/promo/pet_group_3.png';
import petGroup4 from './assets/promo/pet_group_4.png';
import premiumBanner from './assets/promo/premium_banner.png';
import { isAuthConfigured, getUser, ready as authReady } from './auth.js';

const DEALS = {
  premium: {
    key: 'premium',
    title: 'Premium Membership',
    desc: 'Access all bundles this month for a simple recurring fee. New drops included while active.',
    cover: premiumBanner,
    images: [petGroup1,blingGroup1,blingGroup2,critterCover,blingCover,goblinCover,premiumBanner],
    price: { dollars: 2, cents: '99', period: '/ month' },
    includes: 'This purchase grants 1 month of access to all items.'
  },
  critter: {
    key: 'critter',
    title: 'The Critter Pet Pack',
    desc: 'Adorable companions that follow your goblin around. Includes multiple species and colors.',
    cover: critterCover,
    images: [petGroup1, petGroup2, petGroup3, petGroup4],
    price: { dollars: 2, cents: '99' },
    includes: 'This purchase grants permanent access to 5 cosmetic pets.'
  },
  bling: {
    key: 'bling',
    title: 'The Big Win Bling Bundle',
    desc: 'Crowns, sparkles, and shiny bits to flex your style. Winner or not, you will look the part.',
    cover: blingCover,
    images: [blingGroup1, blingGroup2, blingGroup3],
    price: { dollars: 1, cents: '99' }
  },
  moregobs: {
    key: 'moregobs',
    title: 'More Goblins',
    desc: '4 more goblins to choose from!\n\n\nReggie: tall, more nose than brains\n\nBricky: rectangular in all the right ways\n\nSticky: little and nimble\n\nYogi: might know something.',
    cover: goblinCover,
    images: [goblinGroup1, goblinGroup2, goblinGroup3, goblinGroup4, goblinCover],
    price: { dollars: 4, cents: '99' },
    includes: 'This purchase grants permanent access to 4 additional goblin shapes.'
  }
};

function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

async function openModal(deal) {
  const modal = qs('#deal-modal');
  if (!modal) return;

  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');

  const title = qs('.modal__title', modal);
  const desc = qs('.modal__desc', modal);
  const img = qs('.carousel__image', modal);
  const thumbs = qs('.carousel__thumbs', modal);
  title.textContent = deal.title;
  // Allow multi-line descriptions via \n
  desc.textContent = deal.desc;

  let idx = 0;
  function setIndex(i) {
    idx = (i + deal.images.length) % deal.images.length;
    img.src = deal.images[idx];
    // thumbs active state
    qsa('.carousel__thumb', modal).forEach((t, k) => {
      if (k === idx) t.classList.add('carousel__thumb--active');
      else t.classList.remove('carousel__thumb--active');
    });
  }

  // Build thumbnails
  thumbs.innerHTML = '';
  deal.images.forEach((src, i) => {
    const t = document.createElement('button');
    t.className = 'carousel__thumb';
    t.type = 'button';
    t.title = `Image ${i+1}`;
    const inner = document.createElement('img');
    inner.alt = `Image ${i+1}`;
    inner.src = src;
    inner.style.maxWidth = '100%';
    inner.style.maxHeight = '100%';
    t.appendChild(inner);
    t.addEventListener('click', () => setIndex(i));
    thumbs.appendChild(t);
  });

  setIndex(0);

  const onPrev = () => setIndex(idx - 1);
  const onNext = () => setIndex(idx + 1);

  const prevBtn = qs('[data-action="prev"]', modal);
  const nextBtn = qs('[data-action="next"]', modal);
  const closeEls = qsa('[data-action="close"]', modal);

  prevBtn.onclick = onPrev;
  nextBtn.onclick = onNext;
  closeEls.forEach(el => el.onclick = closeModal);

  // Keyboard support
  const onKey = (e) => {
    if (modal.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  };
  document.addEventListener('keydown', onKey);
  modal._cleanup = () => document.removeEventListener('keydown', onKey);

  // Build includes/fine print area and buy/sign-in button
  const cta = qs('.modal__cta', modal);
  if (cta) {
    cta.innerHTML = '';
    const includes = document.createElement('div');
    includes.className = 'modal__includes';
    // Simple default copy; can be customized per deal with deal.includes
    includes.textContent = deal.includes || 'This purchase grants permanent access to all items shown in this pack for your account.';
    cta.appendChild(includes);

    const btn = document.createElement('button');
    // If not signed in, prompt sign in instead of buy
    let authed = false;
    try { if (isAuthConfigured()) { await authReady(); authed = !!getUser(); } } catch {}
    if (!authed) {
      btn.id = 'modal-signin';
      btn.className = 'btn-buy';
      btn.textContent = 'Sign in before purchasing';
      btn.onclick = () => {
        // navigate to login preserving base path
        const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
        const url = `${window.location.origin}${basePath}login`;
        window.location.assign(url);
      };
    } else {
      btn.id = 'modal-buy';
      btn.className = 'btn-buy';
      btn.textContent = 'Buy!';
      btn.onclick = () => {
        btn.disabled = true;
        btn.textContent = 'Purchased!';
        setTimeout(() => { btn.disabled = false; btn.textContent = 'Buy!'; }, 1500);
      };
    }
    cta.appendChild(btn);
  }
}

function closeModal() {
  const modal = qs('#deal-modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  if (typeof modal._cleanup === 'function') { try { modal._cleanup(); } catch {} modal._cleanup = null; }
}

function hookGrid() {
  const grid = qs('#shop-grid');
  if (!grid) return;
  qsa('.shop-card', grid).forEach(card => {
    const key = card.getAttribute('data-key');
    // Inject front cover image if available and media container present
    const deal = DEALS[key];
    if (deal?.cover) {
      const media = card.querySelector('.shop-card__media');
      if (media && !media.querySelector('img')) {
        media.textContent = '';
        const img = document.createElement('img');
        img.src = deal.cover;
        img.alt = deal.title + ' cover';
        media.appendChild(img);
        media.classList.remove('placeholder');
      }
    }
    // Inject price (bottom-right) if present
    if (deal?.price && !card.querySelector('.shop-card__price')) {
      const p = document.createElement('div');
      p.className = 'shop-card__price';
      const aria = deal.price.period ? `Price $${deal.price.dollars}.${deal.price.cents} ${deal.price.period}` : `Price $${deal.price.dollars}.${deal.price.cents}`;
      p.setAttribute('aria-label', aria);
      let html = `<span class="price-symbol">$</span><span class="price-dollars">${deal.price.dollars}</span><span class="price-decimal">.</span><span class="price-cents">${deal.price.cents}</span>`;
      if (deal.price.period) {
        html += `<span class="price-period">${deal.price.period}</span>`;
      }
      p.innerHTML = html;
      card.appendChild(p);
    }
    card.addEventListener('click', () => {
      const deal = DEALS[key];
      if (deal) openModal(deal);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const deal = DEALS[key]; if (deal) openModal(deal); }
    });
  });
}

function hookModalBackdrop() {
  const modal = qs('#deal-modal');
  if (!modal) return;
  const backdrop = qs('.modal__backdrop', modal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
}

document.addEventListener('DOMContentLoaded', () => {
  hookGrid();
  hookModalBackdrop();
});
