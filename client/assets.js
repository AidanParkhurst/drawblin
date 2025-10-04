// Tools
import brushImg from './assets/brush.png';
import eraserImg from './assets/eraser.png';
// Goblins
import brushHandImg from './assets/brushhand.png';
import emptyHandImg from './assets/emptyhand.png';
import mannyImg from './assets/goblins/manny.png';
import stanleyImg from './assets/goblins/stanley.png';
import rickyImg from './assets/goblins/ricky.png';
import blimpImg from './assets/goblins/blimp.png';
import hippoImg from './assets/goblins/hippo.png';
import grubbyImg from './assets/goblins/grubby.png';
import brickyImg from './assets/goblins/bricky.png';
import reggieImg from './assets/goblins/reggie.png';
import stickyImg from './assets/goblins/sticky.png';
import yogiImg from './assets/goblins/yogi.png';
// Pets
import petBunnyImg from './assets/pets/pet_bunny.png';
import petButterflyImg from './assets/pets/pet_butterfly.png';
import petCrocImg from './assets/pets/pet_croc.png';
import petMoleImg from './assets/pets/pet_mole.png';
import petPuffleImg from './assets/pets/pet_puffle.png';
import petNoneImg from './assets/pets/no.png';
// Bling
import crownImg from './assets/bling/crown.png';
import chainImg from './assets/bling/chain.png';
import haloImg from './assets/bling/halo.png';
import shadesImg from './assets/bling/shades.png';
import beltImg from './assets/bling/belt.png';
import trophyImg from './assets/bling/trophy.png';

import neuchaFont from './assets/Neucha-Regular.ttf';
// Sound effects (added sfx folder)
import popSfx from './assets/sfx/pop.mp3';
import dragSfx from './assets/sfx/drag.mp3';
import thudSfx from './assets/sfx/thud.mp3';
import tapSfx from './assets/sfx/tap.mp3';
import tapWoodSfx from './assets/sfx/tap_wood.mp3';

class Assets {
    constructor() {
        this.assets = {
            "brush_hand": brushHandImg,
            "empty_hand": emptyHandImg,
            "brush": brushImg,
            "eraser": eraserImg,
            "crown": crownImg,
            "chain": chainImg,
            "halo": haloImg,
            "shades": shadesImg,
            "belt": beltImg,
            "trophy": trophyImg,
            "manny": mannyImg,
            "stanley": stanleyImg,
            "ricky": rickyImg,
            "blimp": blimpImg,
            "hippo": hippoImg,
            "grubby": grubbyImg,
            "bricky": brickyImg,
            "reggie": reggieImg,
            "sticky": stickyImg,
            "yogi": yogiImg,
            // Pets
            "pet_bunny": petBunnyImg,
            "pet_butterfly": petButterflyImg,
            "pet_croc": petCrocImg,
            "pet_mole": petMoleImg,
            "pet_puffle": petPuffleImg,
            "no": petNoneImg,
        };
        this.sprites = {};
        this.font = neuchaFont; // Default font
        // Audio map (lazy created in preloadAssets)
    this.sfx = { pop: null, drag: null, thud: null, tap: null, tap_wood: null };
    }

    async preloadAssets() {
        for (const key in this.assets) {
            this.sprites[key] = await loadImage(this.assets[key]);
        }
        this.font = await loadFont(this.font);
        // Preload audio via HTML5 Audio (lightweight vs adding p5.sound dependency)
        try { this.sfx.pop = new Audio(popSfx); this.sfx.pop.preload = 'auto'; } catch {}
        try { this.sfx.drag = new Audio(dragSfx); this.sfx.drag.preload = 'auto'; this.sfx.drag.loop = true; this.sfx.drag.volume = 0.35; } catch {}
        try { this.sfx.thud = new Audio(thudSfx); this.sfx.thud.preload = 'auto'; } catch {}
        try { this.sfx.tap = new Audio(tapSfx); this.sfx.tap.preload = 'auto'; this.sfx.tap.volume = 0.25; } catch {}
        try { this.sfx.tap_wood = new Audio(tapWoodSfx); this.sfx.tap_wood.preload = 'auto'; this.sfx.tap_wood.volume = 0.25; } catch {}
    }
}

export const assets = new Assets();