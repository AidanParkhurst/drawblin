// Items, Tools
import brushImg from './assets/brush.png';
import eraserImg from './assets/eraser.png';
import crownImg from './assets/crown.png';
// Goblins
import brushHandImg from './assets/brushhand.png';
import emptyHandImg from './assets/emptyhand.png';
import mannyImg from './assets/goblins/manny.png';
import stanleyImg from './assets/goblins/stanley.png';
import rickyImg from './assets/goblins/ricky.png';
import blimpImg from './assets/goblins/blimp.png';
import hippoImg from './assets/goblins/hippo.png';
import grubbyImg from './assets/goblins/grubby.png';
// Pets
import petBunnyImg from './assets/pets/pet_bunny.png';
import petButterflyImg from './assets/pets/pet_butterfly.png';
import petCrocImg from './assets/pets/pet_croc.png';
import petMoleImg from './assets/pets/pet_mole.png';
import petPuffleImg from './assets/pets/pet_puffle.png';

import neuchaFont from './assets/Neucha-Regular.ttf';

class Assets {
    constructor() {
        this.assets = {
            "brush_hand": brushHandImg,
            "empty_hand": emptyHandImg,
            "brush": brushImg,
            "eraser": eraserImg,
            "crown": crownImg,
            "manny": mannyImg,
            "stanley": stanleyImg,
            "ricky": rickyImg,
            "blimp": blimpImg,
            "hippo": hippoImg,
            "grubby": grubbyImg,
            // Pets
            "pet_bunny": petBunnyImg,
            "pet_butterfly": petButterflyImg,
            "pet_croc": petCrocImg,
            "pet_mole": petMoleImg,
            "pet_puffle": petPuffleImg,
        };
        this.sprites = {};
        this.font = neuchaFont; // Default font
    }

    async preloadAssets() {
        for (const key in this.assets) {
            this.sprites[key] = await loadImage(this.assets[key]);
        }
        this.font = await loadFont(this.font);
    }
}

export const assets = new Assets();