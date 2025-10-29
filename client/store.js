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
    desc: 'Not sure what bundle you want?\n\n\nPremium members get them all!\n+ 5 shiny accessories to flex your wins\n+ 5 adorable animals to keep you company\n+ 4 extra goblins to choose from\n\n\nAll for $2.99/month.\n(Cancel anytime, no strings attached)',
    cover: premiumBanner,
    images: [petGroup1,blingGroup1,blingGroup2,critterCover,blingCover,goblinCover,premiumBanner],
    price: { dollars: 2, cents: '99', period: '/ month' },
    // Set this to your live checkout link
    href: 'https://buy.stripe.com/9B64gB3zeczga730au4wM00',
    includes: 'This purchase grants 1 month of access to all items.'
  },
  critter: {
    key: 'critter',
    title: 'The Companion Critter Collection',
    desc: 'You deserve an entourage.\n\n\nGet 5 pets to pick from, and never draw alone again!\n+ Bunny (great listener)\n+ Butterfly (distractingly beautiful)\n+ Croc (only bites sometimes)\n+ Mole (found in the backyard)\n+ Puffle (a reference from ancient times)\n\n\nAll for $2.99 (one time purchase)',
    cover: critterCover,
    images: [petGroup1, petGroup2, petGroup3, petGroup4],
    price: { dollars: 2, cents: '99' },
    // Set this to your live checkout link
    href: 'https://buy.stripe.com/7sY5kFfhWgPwenj6yS4wM03',
    includes: 'This purchase grants permanent access to 5 cosmetic pets.'
  },
  bling: {
    key: 'bling',
    title: 'The Big Win Bling Bundle',
    desc: 'Do you win often? I bet you do.\n\n\nLook the part with 5 shiny new accessories!\n+ The Halo (Pure in spirit and in skill)\n+ Shades (Block out the haters, or the sun)\n+ Chains (you\'d wear two if they weren\'t so heavy)\n+ The Stanley Cup (for the Stanley fans)\n+ Champ\'s Belt (pound for pound, undisputed)\n\n\nAll for $1.99 (one time purchase)',
    cover: blingCover,
    images: [blingGroup1, blingGroup2, blingGroup3],
    price: { dollars: 1, cents: '99' },
    // Set this to your live checkout link
    href: 'https://buy.stripe.com/8x23cx9XCczgdjfg9s4wM01',
    includes: 'This purchase grants permanent access to 5 accessories, equippable whenever you are 1st on the leaderboard.'
  },
  moregobs: {
    key: 'moregobs',
    title: 'More Goblins',
    desc: 'Can you ever get enough goblins? I can\'t.\n\n\nExpand your options, with 4 new goblins to choose from!\n+ Reggie (tall, more nose than brains)\n+ Bricky (rectangular in all the right ways)\n+ Sticky (little and nimble)\n+ Yogi (might know something).\n\n\nAll for $4.99 (one time purchase)',
    cover: goblinCover,
    images: [goblinGroup1, goblinGroup2, goblinGroup3, goblinGroup4, goblinCover],
    price: { dollars: 4, cents: '99' },
    // Set this to your live checkout link
    href: 'https://buy.stripe.com/00w7sNfhW2YG5QN7CW4wM02',
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

      // If not signed in, prompt sign in instead of buy
      let authed = false;
      try { if (isAuthConfigured()) { await authReady(); authed = !!getUser(); } } catch {}
      if (!authed) {
        // Render a link styled like the buy button that navigates to /login
        const link = document.createElement('a');
        link.id = 'modal-signin';
        link.className = 'btn-buy';
        link.textContent = 'Sign in or Create account';
        // Direct to absolute /login path so authors can use it from any page
        link.href = '/login';
        cta.appendChild(link);
      } else {
      // If a checkout link is provided, render an anchor as the buy button
      if (deal && typeof deal.href === 'string' && deal.href.trim().length > 0) {
        const link = document.createElement('a');
        link.id = 'modal-buy';
        link.className = 'btn-buy';
        link.textContent = 'Buy!';
        link.href = deal.href;
        // Keep default navigation in same tab; authors can change target if desired
        // link.target = '_blank'; link.rel = 'noopener noreferrer';
        cta.appendChild(link);
      } else {
        // Fallback: keep disabled placeholder button if href not yet provided
        const btn = document.createElement('button');
        btn.id = 'modal-buy';
        btn.className = 'btn-buy';
        btn.textContent = 'Buy!';
        btn.disabled = true;
        btn.title = 'Checkout link not configured yet';
        cta.appendChild(btn);
      }
    }
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
