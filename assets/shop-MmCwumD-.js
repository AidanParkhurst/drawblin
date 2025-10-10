import{i as S,r as A,b as G}from"./auth-XtUnfzLK.js";/* empty css              *//* empty css             */const k=""+new URL("critter_cover-jIESIuWq.png",import.meta.url).href,v=""+new URL("bling_cover-Bhz7FgTm.png",import.meta.url).href,h=""+new URL("goblin_cover-DHu34YOv.png",import.meta.url).href,L=""+new URL("bling_group_1-B0JdDU0H.png",import.meta.url).href,C=""+new URL("bling_group_2-BaDlSZY-.png",import.meta.url).href,P=""+new URL("bling_group_3-PjQU2LtP.png",import.meta.url).href,M=""+new URL("goblin_group_1-BkSXxYOx.png",import.meta.url).href,q=""+new URL("goblin_group_2-BWeKTQ9J.png",import.meta.url).href,N=""+new URL("goblin_group_3-BGNB63Ww.png",import.meta.url).href,I=""+new URL("goblin_group_4-CX-tRSfd.png",import.meta.url).href,B=""+new URL("pet_group_1-B2pVZqaC.png",import.meta.url).href,D=""+new URL("pet_group_2-Bz2Ccs3T.png",import.meta.url).href,H=""+new URL("pet_group_3-C3TFcPPf.png",import.meta.url).href,W=""+new URL("pet_group_4-BJNh_7rh.png",import.meta.url).href,E=""+new URL("premium_banner-VSzIjUcM.png",import.meta.url).href,g={premium:{key:"premium",title:"Premium Membership",desc:`Not sure what bundle you want?


Premium members get them all!
+ 5 shiny accessories to flex your wins
+ 5 adorable animals to keep you company
+ 4 extra goblins to choose from


All for $2.99/month.
(Cancel anytime, no strings attached)`,cover:E,images:[B,L,C,k,v,h,E],price:{dollars:2,cents:"99",period:"/ month"},includes:"This purchase grants 1 month of access to all items."},critter:{key:"critter",title:"The Companion Critter Collection",desc:`You deserve an entourage.


Get 5 pets to pick from, and never draw alone again!
+ Bunny (great listener)
+ Butterfly (distractingly beautiful)
+ Croc (only bites sometimes)
+ Mole (found in the backyard)
+ Puffle (a reference from ancient times)


All for $2.99 (one time purchase)`,cover:k,images:[B,D,H,W],price:{dollars:2,cents:"99"},includes:"This purchase grants permanent access to 5 cosmetic pets."},bling:{key:"bling",title:"The Big Win Bling Bundle",desc:`Do you win often? I bet you do.


Look the part with 5 shiny new accessories!
+ The Halo (Pure in spirit and in skill)
+ Shades (Block out the haters, or the sun)
+ Chains (you'd wear two if they weren't so heavy)
+ The Stanley Cup (for the Stanley fans)
+ Champ's Belt (pound for pound, undisputed)


All for $1.99 (one time purchase)`,cover:v,images:[L,C,P],price:{dollars:1,cents:"99"},includes:"This purchase grants permanent access to 5 accessories, equippable whenever you are 1st on the leaderboard."},moregobs:{key:"moregobs",title:"More Goblins",desc:`Can you ever get enough goblins? I can't.


Expand your options, with 4 new goblins to choose from!
+ Reggie (tall, more nose than brains)
+ Bricky (rectangular in all the right ways)
+ Sticky (little and nimble)
+ Yogi (might know something).


All for $4.99 (one time purchase)`,cover:h,images:[M,q,N,I,h],price:{dollars:4,cents:"99"},includes:"This purchase grants permanent access to 4 additional goblin shapes."}};function a(n,e=document){return e.querySelector(n)}function f(n,e=document){return Array.from(e.querySelectorAll(n))}async function x(n){const e=a("#deal-modal");if(!e)return;e.style.display="block",e.setAttribute("aria-hidden","false");const u=a(".modal__title",e),r=a(".modal__desc",e),o=a(".carousel__image",e),s=a(".carousel__thumbs",e);u.textContent=n.title,r.textContent=n.desc;let l=0;function m(i){l=(i+n.images.length)%n.images.length,o.src=n.images[l],f(".carousel__thumb",e).forEach((t,c)=>{c===l?t.classList.add("carousel__thumb--active"):t.classList.remove("carousel__thumb--active")})}s.innerHTML="",n.images.forEach((i,t)=>{const c=document.createElement("button");c.className="carousel__thumb",c.type="button",c.title=`Image ${t+1}`;const p=document.createElement("img");p.alt=`Image ${t+1}`,p.src=i,p.style.maxWidth="100%",p.style.maxHeight="100%",c.appendChild(p),c.addEventListener("click",()=>m(t)),s.appendChild(c)}),m(0);const y=()=>m(l-1),_=()=>m(l+1),$=a('[data-action="prev"]',e),U=a('[data-action="next"]',e),R=f('[data-action="close"]',e);$.onclick=y,U.onclick=_,R.forEach(i=>i.onclick=b);const w=i=>{e.getAttribute("aria-hidden")!=="true"&&(i.key==="Escape"&&b(),i.key==="ArrowLeft"&&y(),i.key==="ArrowRight"&&_())};document.addEventListener("keydown",w),e._cleanup=()=>document.removeEventListener("keydown",w);const d=a(".modal__cta",e);if(d){d.innerHTML="";const i=document.createElement("div");i.className="modal__includes",i.textContent=n.includes||"This purchase grants permanent access to all items shown in this pack for your account.",d.appendChild(i);const t=document.createElement("button");let c=!1;try{S()&&(await A(),c=!!G())}catch{}c?(t.id="modal-buy",t.className="btn-buy",t.textContent="Buy!",t.onclick=()=>{t.disabled=!0,t.textContent="Purchased!",setTimeout(()=>{t.disabled=!1,t.textContent="Buy!"},1500)}):(t.id="modal-signin",t.className="btn-buy",t.textContent="Sign in before purchasing",t.onclick=()=>{const p=window.location.pathname.replace(/\/[^/]*$/,"/"),T=`${window.location.origin}${p}login`;window.location.assign(T)}),d.appendChild(t)}}function b(){const n=a("#deal-modal");if(n&&(n.style.display="none",n.setAttribute("aria-hidden","true"),typeof n._cleanup=="function")){try{n._cleanup()}catch{}n._cleanup=null}}function Y(){const n=a("#shop-grid");n&&f(".shop-card",n).forEach(e=>{const u=e.getAttribute("data-key"),r=g[u];if(r?.cover){const o=e.querySelector(".shop-card__media");if(o&&!o.querySelector("img")){o.textContent="";const s=document.createElement("img");s.src=r.cover,s.alt=r.title+" cover",o.appendChild(s),o.classList.remove("placeholder")}}if(r?.price&&!e.querySelector(".shop-card__price")){const o=document.createElement("div");o.className="shop-card__price";const s=r.price.period?`Price $${r.price.dollars}.${r.price.cents} ${r.price.period}`:`Price $${r.price.dollars}.${r.price.cents}`;o.setAttribute("aria-label",s);let l=`<span class="price-symbol">$</span><span class="price-dollars">${r.price.dollars}</span><span class="price-decimal">.</span><span class="price-cents">${r.price.cents}</span>`;r.price.period&&(l+=`<span class="price-period">${r.price.period}</span>`),o.innerHTML=l,e.appendChild(o)}e.addEventListener("click",()=>{const o=g[u];o&&x(o)}),e.addEventListener("keydown",o=>{if(o.key==="Enter"||o.key===" "){o.preventDefault();const s=g[u];s&&x(s)}})})}function j(){const n=a("#deal-modal");if(!n)return;const e=a(".modal__backdrop",n);e&&e.addEventListener("click",b)}document.addEventListener("DOMContentLoaded",()=>{Y(),j()});
