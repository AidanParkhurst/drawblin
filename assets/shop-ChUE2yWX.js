import{i as G,r as T,b as A}from"./auth-XtUnfzLK.js";/* empty css              *//* empty css             */const k=""+new URL("critter_cover-jIESIuWq.png",import.meta.url).href,v=""+new URL("bling_cover-Bhz7FgTm.png",import.meta.url).href,h=""+new URL("goblin_cover-DHu34YOv.png",import.meta.url).href,C=""+new URL("bling_group_1-B0JdDU0H.png",import.meta.url).href,L=""+new URL("bling_group_2-BaDlSZY-.png",import.meta.url).href,M=""+new URL("bling_group_3-PjQU2LtP.png",import.meta.url).href,P=""+new URL("goblin_group_1-BkSXxYOx.png",import.meta.url).href,N=""+new URL("goblin_group_2-BWeKTQ9J.png",import.meta.url).href,q=""+new URL("goblin_group_3-BGNB63Ww.png",import.meta.url).href,I=""+new URL("goblin_group_4-CX-tRSfd.png",import.meta.url).href,B=""+new URL("pet_group_1-B2pVZqaC.png",import.meta.url).href,W=""+new URL("pet_group_2-Bz2Ccs3T.png",import.meta.url).href,D=""+new URL("pet_group_3-C3TFcPPf.png",import.meta.url).href,H=""+new URL("pet_group_4-BJNh_7rh.png",import.meta.url).href,E=""+new URL("premium_banner-VSzIjUcM.png",import.meta.url).href,g={premium:{key:"premium",title:"Premium Membership",desc:`Not sure what bundle you want?


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


All for $2.99 (one time purchase)`,cover:k,images:[B,W,D,H],price:{dollars:2,cents:"99"},href:"https://buy.stripe.com/7sY5kFfhWgPwenj6yS4wM03",includes:"This purchase grants permanent access to 5 cosmetic pets."},bling:{key:"bling",title:"The Big Win Bling Bundle",desc:`Do you win often? I bet you do.


Look the part with 5 shiny new accessories!
+ The Halo (Pure in spirit and in skill)
+ Shades (Block out the haters, or the sun)
+ Chains (you'd wear two if they weren't so heavy)
+ The Stanley Cup (for the Stanley fans)
+ Champ's Belt (pound for pound, undisputed)


All for $1.99 (one time purchase)`,cover:v,images:[C,L,M],price:{dollars:1,cents:"99"},href:"https://buy.stripe.com/8x23cx9XCczgdjfg9s4wM01",includes:"This purchase grants permanent access to 5 accessories, equippable whenever you are 1st on the leaderboard."},moregobs:{key:"moregobs",title:"More Goblins",desc:`Can you ever get enough goblins? I can't.


Expand your options, with 4 new goblins to choose from!
+ Reggie (tall, more nose than brains)
+ Bricky (rectangular in all the right ways)
+ Sticky (little and nimble)
+ Yogi (might know something).


All for $4.99 (one time purchase)`,cover:h,images:[P,N,q,I,h],price:{dollars:4,cents:"99"},href:"https://buy.stripe.com/00w7sNfhW2YG5QN7CW4wM02",includes:"This purchase grants permanent access to 4 additional goblin shapes."}};function a(e,t=document){return t.querySelector(e)}function f(e,t=document){return Array.from(t.querySelectorAll(e))}async function x(e){const t=a("#deal-modal");if(!t)return;t.style.display="block",t.setAttribute("aria-hidden","false");const u=a(".modal__title",t),r=a(".modal__desc",t),n=a(".carousel__image",t),c=a(".carousel__thumbs",t);u.textContent=e.title,r.textContent=e.desc;let p=0;function d(i){p=(i+e.images.length)%e.images.length,n.src=e.images[p],f(".carousel__thumb",t).forEach((o,l)=>{l===p?o.classList.add("carousel__thumb--active"):o.classList.remove("carousel__thumb--active")})}c.innerHTML="",e.images.forEach((i,o)=>{const l=document.createElement("button");l.className="carousel__thumb",l.type="button",l.title=`Image ${o+1}`;const s=document.createElement("img");s.alt=`Image ${o+1}`,s.src=i,s.style.maxWidth="100%",s.style.maxHeight="100%",l.appendChild(s),l.addEventListener("click",()=>d(o)),c.appendChild(l)}),d(0);const y=()=>d(p-1),_=()=>d(p+1),$=a('[data-action="prev"]',t),U=a('[data-action="next"]',t),R=f('[data-action="close"]',t);$.onclick=y,U.onclick=_,R.forEach(i=>i.onclick=b);const w=i=>{t.getAttribute("aria-hidden")!=="true"&&(i.key==="Escape"&&b(),i.key==="ArrowLeft"&&y(),i.key==="ArrowRight"&&_())};document.addEventListener("keydown",w),t._cleanup=()=>document.removeEventListener("keydown",w);const m=a(".modal__cta",t);if(m){m.innerHTML="";const i=document.createElement("div");i.className="modal__includes",i.textContent=e.includes||"This purchase grants permanent access to all items shown in this pack for your account.",m.appendChild(i);const o=document.createElement("button");let l=!1;try{G()&&(await T(),l=!!A())}catch{}if(!l)o.id="modal-signin",o.className="btn-buy",o.textContent="Sign in before purchasing",o.onclick=()=>{const s=window.location.pathname.replace(/\/[^/]*$/,"/"),S=`${window.location.origin}${s}login`;window.location.assign(S)};else if(e&&typeof e.href=="string"&&e.href.trim().length>0){const s=document.createElement("a");s.id="modal-buy",s.className="btn-buy",s.textContent="Buy!",s.href=e.href,m.appendChild(s)}else o.id="modal-buy",o.className="btn-buy",o.textContent="Buy!",o.disabled=!0,o.title="Checkout link not configured yet",m.appendChild(o)}}function b(){const e=a("#deal-modal");if(e&&(e.style.display="none",e.setAttribute("aria-hidden","true"),typeof e._cleanup=="function")){try{e._cleanup()}catch{}e._cleanup=null}}function Y(){const e=a("#shop-grid");e&&f(".shop-card",e).forEach(t=>{const u=t.getAttribute("data-key"),r=g[u];if(r?.cover){const n=t.querySelector(".shop-card__media");if(n&&!n.querySelector("img")){n.textContent="";const c=document.createElement("img");c.src=r.cover,c.alt=r.title+" cover",n.appendChild(c),n.classList.remove("placeholder")}}if(r?.price&&!t.querySelector(".shop-card__price")){const n=document.createElement("div");n.className="shop-card__price";const c=r.price.period?`Price $${r.price.dollars}.${r.price.cents} ${r.price.period}`:`Price $${r.price.dollars}.${r.price.cents}`;n.setAttribute("aria-label",c);let p=`<span class="price-symbol">$</span><span class="price-dollars">${r.price.dollars}</span><span class="price-decimal">.</span><span class="price-cents">${r.price.cents}</span>`;r.price.period&&(p+=`<span class="price-period">${r.price.period}</span>`),n.innerHTML=p,t.appendChild(n)}t.addEventListener("click",()=>{const n=g[u];n&&x(n)}),t.addEventListener("keydown",n=>{if(n.key==="Enter"||n.key===" "){n.preventDefault();const c=g[u];c&&x(c)}})})}function z(){const e=a("#deal-modal");if(!e)return;const t=a(".modal__backdrop",e);t&&t.addEventListener("click",b)}document.addEventListener("DOMContentLoaded",()=>{Y(),z()});
