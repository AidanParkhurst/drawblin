// Color utility functions for contrast checking and color manipulation

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
