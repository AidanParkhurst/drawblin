import{i as $,r as G,b as T}from"./auth-DsPYn-kI.js";/* empty css              *//* empty css             */const k=""+new URL("critter_cover-jIESIuWq.png",import.meta.url).href,v=""+new URL("bling_cover-Bhz7FgTm.png",import.meta.url).href,h=""+new URL("goblin_cover-DHu34YOv.png",import.meta.url).href,C=""+new URL("bling_group_1-B0JdDU0H.png",import.meta.url).href,L=""+new URL("bling_group_2-BaDlSZY-.png",import.meta.url).href,A=""+new URL("bling_group_3-PjQU2LtP.png",import.meta.url).href,M=""+new URL("goblin_group_1-BkSXxYOx.png",import.meta.url).href,N=""+new URL("goblin_group_2-BWeKTQ9J.png",import.meta.url).href,P=""+new URL("goblin_group_3-BGNB63Ww.png",import.meta.url).href,q=""+new URL("goblin_group_4-CX-tRSfd.png",import.meta.url).href,B=""+new URL("pet_group_1-B2pVZqaC.png",import.meta.url).href,I=""+new URL("pet_group_2-Bz2Ccs3T.png",import.meta.url).href,W=""+new URL("pet_group_3-C3TFcPPf.png",import.meta.url).href,D=""+new URL("pet_group_4-BJNh_7rh.png",import.meta.url).href,E=""+new URL("premium_banner-VSzIjUcM.png",import.meta.url).href,g={premium:{key:"premium",title:"Premium Membership",desc:`Not sure what bundle you want?


Premium members get them all!
+ 5 shiny accessories to flex your wins
+ 5 adorable animals to keep you company
+ 4 extra goblins to choose from


All for $2.99/month.
(Cancel anytime, no strings attached)`,cover:E,images:[B,C,L,k,v,h,E],price:{dollars:2,cents:"99",period:"/ month"},href:"https://buy.stripe.com/9B64gB3zeczga730au4wM00",includes:"This purchase grants 1 month of access to all items."},critter:{key:"critter",title:"The Companion Critter Collection",desc:`You deserve an entourage.


Get 5 pets to pick from, and never draw alone again!
+ Bunny (great listener)
+ Butterfly (distractingly beautiful)
+ Croc (only bites sometimes)
+ Mole (found in the backyard)
+ Puffle (a reference from ancient times)


All for $2.99 (one time purchase)`,cover:k,images:[B,I,W,D],price:{dollars:2,cents:"99"},href:"https://buy.stripe.com/7sY5kFfhWgPwenj6yS4wM03",includes:"This purchase grants permanent access to 5 cosmetic pets."},bling:{key:"bling",title:"The Big Win Bling Bundle",desc:`Do you win often? I bet you do.


Look the part with 5 shiny new accessories!
+ The Halo (Pure in spirit and in skill)
+ Shades (Block out the haters, or the sun)
+ Chains (you'd wear two if they weren't so heavy)
+ The Stanley Cup (for the Stanley fans)
+ Champ's Belt (pound for pound, undisputed)


All for $1.99 (one time purchase)`,cover:v,images:[C,L,A],price:{dollars:1,cents:"99"},href:"https://buy.stripe.com/8x23cx9XCczgdjfg9s4wM01",includes:"This purchase grants permanent access to 5 accessories, equippable whenever you are 1st on the leaderboard."},moregobs:{key:"moregobs",title:"More Goblins",desc:`Can you ever get enough goblins? I can't.


Expand your options, with 4 new goblins to choose from!
+ Reggie (tall, more nose than brains)
+ Bricky (rectangular in all the right ways)
+ Sticky (little and nimble)
+ Yogi (might know something).


All for $4.99 (one time purchase)`,cover:h,images:[M,N,P,q,h],price:{dollars:4,cents:"99"},href:"https://buy.stripe.com/00w7sNfhW2YG5QN7CW4wM02",includes:"This purchase grants permanent access to 4 additional goblin shapes."}};function s(e,t=document){return t.querySelector(e)}function f(e,t=document){return Array.from(t.querySelectorAll(e))}async function x(e){const t=s("#deal-modal");if(!t)return;t.style.display="block",t.setAttribute("aria-hidden","false");const u=s(".modal__title",t),r=s(".modal__desc",t),o=s(".carousel__image",t),a=s(".carousel__thumbs",t);u.textContent=e.title,r.textContent=e.desc;let l=0;function d(i){l=(i+e.images.length)%e.images.length,o.src=e.images[l],f(".carousel__thumb",t).forEach((c,n)=>{n===l?c.classList.add("carousel__thumb--active"):c.classList.remove("carousel__thumb--active")})}a.innerHTML="",e.images.forEach((i,c)=>{const n=document.createElement("button");n.className="carousel__thumb",n.type="button",n.title=`Image ${c+1}`;const m=document.createElement("img");m.alt=`Image ${c+1}`,m.src=i,m.style.maxWidth="100%",m.style.maxHeight="100%",n.appendChild(m),n.addEventListener("click",()=>d(c)),a.appendChild(n)}),d(0);const y=()=>d(l-1),_=()=>d(l+1),U=s('[data-action="prev"]',t),R=s('[data-action="next"]',t),S=f('[data-action="close"]',t);U.onclick=y,R.onclick=_,S.forEach(i=>i.onclick=b);const w=i=>{t.getAttribute("aria-hidden")!=="true"&&(i.key==="Escape"&&b(),i.key==="ArrowLeft"&&y(),i.key==="ArrowRight"&&_())};document.addEventListener("keydown",w),t._cleanup=()=>document.removeEventListener("keydown",w);const p=s(".modal__cta",t);if(p){p.innerHTML="";const i=document.createElement("div");i.className="modal__includes",i.textContent=e.includes||"This purchase grants permanent access to all items shown in this pack for your account.",p.appendChild(i);let c=!1;try{$()&&(await G(),c=!!T())}catch{}if(c)if(e&&typeof e.href=="string"&&e.href.trim().length>0){const n=document.createElement("a");n.id="modal-buy",n.className="btn-buy",n.textContent="Buy!",n.href=e.href,p.appendChild(n)}else{const n=document.createElement("button");n.id="modal-buy",n.className="btn-buy",n.textContent="Buy!",n.disabled=!0,n.title="Checkout link not configured yet",p.appendChild(n)}else{const n=document.createElement("a");n.id="modal-signin",n.className="btn-buy",n.textContent="Sign in or Create account",n.href="/login",p.appendChild(n)}}}function b(){const e=s("#deal-modal");if(e&&(e.style.display="none",e.setAttribute("aria-hidden","true"),typeof e._cleanup=="function")){try{e._cleanup()}catch{}e._cleanup=null}}function H(){const e=s("#shop-grid");e&&f(".shop-card",e).forEach(t=>{const u=t.getAttribute("data-key"),r=g[u];if(r?.cover){const o=t.querySelector(".shop-card__media");if(o&&!o.querySelector("img")){o.textContent="";const a=document.createElement("img");a.src=r.cover,a.alt=r.title+" cover",o.appendChild(a),o.classList.remove("placeholder")}}if(r?.price&&!t.querySelector(".shop-card__price")){const o=document.createElement("div");o.className="shop-card__price";const a=r.price.period?`Price $${r.price.dollars}.${r.price.cents} ${r.price.period}`:`Price $${r.price.dollars}.${r.price.cents}`;o.setAttribute("aria-label",a);let l=`<span class="price-symbol">$</span><span class="price-dollars">${r.price.dollars}</span><span class="price-decimal">.</span><span class="price-cents">${r.price.cents}</span>`;r.price.period&&(l+=`<span class="price-period">${r.price.period}</span>`),o.innerHTML=l,t.appendChild(o)}t.addEventListener("click",()=>{const o=g[u];o&&x(o)}),t.addEventListener("keydown",o=>{if(o.key==="Enter"||o.key===" "){o.preventDefault();const a=g[u];a&&x(a)}})})}function Y(){const e=s("#deal-modal");if(!e)return;const t=s(".modal__backdrop",e);t&&t.addEventListener("click",b)}document.addEventListener("DOMContentLoaded",()=>{H(),Y()});
