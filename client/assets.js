import brushHandImg from './assets/brushhand.png';
import emptyHandImg from './assets/emptyhand.png';
import brushImg from './assets/brush.png';
import crownImg from './assets/crown.png';
import mannyImg from './assets/goblins/manny.png';
import stanleyImg from './assets/goblins/stanley.png';
import rickyImg from './assets/goblins/ricky.png';
import blimpImg from './assets/goblins/blimp.png';
import neuchaFont from './assets/Neucha-Regular.ttf';

class Assets {
    constructor() {
        this.assets = {
            "brush_hand": brushHandImg,
            "empty_hand": emptyHandImg,
            "brush": brushImg,
            "crown": crownImg,
            "manny": mannyImg,
            "stanley": stanleyImg,
            "ricky": rickyImg,
            "blimp": blimpImg,
        };
        this.sprites = {};
        this.font = 'assets/Neucha-Regular.ttf'; // Default font
    }

    async preloadAssets() {
        for (const key in this.assets) {
            this.sprites[key] = await loadImage(this.assets[key]);
        }
        this.font = await loadFont(this.font);
    }
}

export const assets = new Assets();