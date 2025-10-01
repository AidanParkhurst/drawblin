// Local promo cover images (stored under assets/promo)
import critterCover from './assets/promo/critter_cover.png';
import blingCover from './assets/promo/bling_cover.png';
import goblinCover from './assets/promo/goblin_cover.png';

const DEALS = {
  premium: {
    key: 'premium',
    title: 'Premium Membership',
    desc: 'Access all bundles this month for a simple recurring fee. New drops included while active.',
    images: [
      'https://placehold.co/800x600/FFF/444?text=Premium+Overview',
      'https://placehold.co/800x600/FFF/777?text=Included+Bundles',
      'https://placehold.co/800x600/FFF/999?text=Future+Drops'
    ]
  },
  critter: {
    key: 'critter',
    title: 'The Critter Pet Pack',
    desc: 'Adorable companions that follow your goblin around. Includes multiple species and colors.',
    cover: critterCover,
    images: [critterCover],
    price: { dollars: 2, cents: '99' }
  },
  bling: {
    key: 'bling',
    title: 'The Winner Bling Bundle',
    desc: 'Crowns, sparkles, and shiny bits to flex your style. Winner or not, you will look the part.',
    cover: blingCover,
    images: [blingCover],
    price: { dollars: 1, cents: '99' }
  },
  poppin: {
    key: 'poppin',
    title: 'The Poppin Goblin Pack',
    desc: 'Extra animations and pops for your goblin. Bring the party wherever you go.',
    cover: goblinCover,
    images: [goblinCover],
    price: { dollars: 4, cents: '99' }
  }
};

function qs(sel, root=document) { return root.querySelector(sel); }
function qsa(sel, root=document) { return Array.from(root.querySelectorAll(sel)); }

function openModal(deal) {
  const modal = qs('#deal-modal');
  if (!modal) return;

  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');

  const title = qs('.modal__title', modal);
  const desc = qs('.modal__desc', modal);
  const img = qs('.carousel__image', modal);
  const thumbs = qs('.carousel__thumbs', modal);
  title.textContent = deal.title;
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

  const buyBtn = qs('#modal-buy', modal);
  if (buyBtn) {
    buyBtn.onclick = () => {
      // Placeholder buy action
      buyBtn.disabled = true;
      buyBtn.textContent = 'Purchased!';
      setTimeout(() => { buyBtn.disabled = false; buyBtn.textContent = 'Buy!'; }, 1500);
    };
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
      p.setAttribute('aria-label', `Price $${deal.price.dollars}.${deal.price.cents}`);
      p.innerHTML = `<span class="price-symbol">$</span><span class="price-dollars">${deal.price.dollars}</span><span class="price-decimal">.</span><span class="price-cents">${deal.price.cents}</span>`;
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
