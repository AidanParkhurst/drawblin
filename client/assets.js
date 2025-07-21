class Assets {
    constructor() {
        this.assets = {
            "brush_hand": "assets/brushhand.png",
            "empty_hand": "assets/emptyhand.png",
            "brush": "assets/brush.png",
            "crown": "assets/crown.png",
            "manny": "assets/goblins/manny.png",
            "stanley": "assets/goblins/stanley.png",
            "ricky": "assets/goblins/ricky.png",
            "blimp": "assets/goblins/blimp.png",
        };
        this.sprites = {};
    }

    async preloadAssets() {
        for (const key in this.assets) {
            this.sprites[key] = await loadImage(this.assets[key]);
        }
    }
}

export const assets = new Assets();