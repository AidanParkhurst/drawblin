// Color utility functions for contrast checking and color manipulation

// Primary goblin color palette (exported)
// Source: provided hex colors; converted to [r,g,b] arrays
export const paletteHex = [
    "#f74533",
    "#f37d28",
    "#f9ad72",
    "#fdd053",
    "#fa878e",
    "#ce5a96",
    "#ab79d8",
    "#d59df5",
    "#f5c6e9",
    "#b16b5e",
    "#bcab2a",
    "#9ab951",
    "#649d47",
    "#339a79",
    "#3f54bb",
    "#529be2",
    "#8ad5fa",
    "#b8cedf",
    "#86a0c0",
    "#2C1C44",
];

export function hexToRgb(hex) {
    const h = hex.replace('#','');
    const bigint = parseInt(h, 16);
    if (h.length === 6) {
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return [r, g, b];
    }
    // Fallback for 3-digit hex
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
}

export const palette = paletteHex.map(hexToRgb);
export const randomPaletteColor = () => palette[Math.floor(Math.random() * palette.length)];

// Calculate relative luminance for contrast checking
export function getLuminance(color) {
    // Normalize RGB values to 0-1 range
    const [r, g, b] = color.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    // Calculate luminance using the standard formula
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Calculate contrast ratio between two colors
export function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
}

// Darken a color by a given factor (0-1, where 0 = black, 1 = original)
export function darkenColor(color, factor = 0.6) {
    return color.map(c => Math.floor(c * factor));
}

// Calculate appropriate UI color based on contrast
export function calculateUIColor(color, backgroundColor) {
    const contrastRatio = getContrastRatio(color, backgroundColor);
    
    // WCAG AA standard recommends 4.5:1 for normal text
    // We'll use 3:1 as our threshold for UI elements
    if (contrastRatio < 3) {
        // Color doesn't have enough contrast, darken it
        let darkenedColor = darkenColor(color, 0.6);
        
        // Keep darkening until we get good contrast or hit a minimum
        let attempts = 0;
        while (getContrastRatio(darkenedColor, backgroundColor) < 3 && attempts < 5) {
            darkenedColor = darkenColor(darkenedColor, 0.8);
            attempts++;
        }
        
        return darkenedColor;
    }
    
    // Color has good contrast, use original
    return [...color]; // Return a copy to avoid reference issues
}
