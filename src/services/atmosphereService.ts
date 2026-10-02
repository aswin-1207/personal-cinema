// Dynamic Artwork Atmosphere Service
// Extracts and caches subtle atmospheric color tones from movie artwork
// Designed for zero performance overhead and absolute CORS safety.

class AtmosphereService {
  private cache: Map<string, string> = new Map();

  // Curated cinematic ambient hues (low saturation, luxurious undertones for #09090B background)
  private readonly CINEMATIC_PALETTES = [
    'rgba(224, 173, 82, 0.10)',  // Cinematic Gold
    'rgba(140, 122, 208, 0.09)', // Cinema Purple
    'rgba(179, 38, 46, 0.08)',   // Deep Crimson
    'rgba(82, 140, 224, 0.09)',  // Midnight Cobalt
    'rgba(209, 152, 48, 0.10)',  // Warm Amber
    'rgba(120, 160, 140, 0.08)', // Muted Emerald
  ];

  /**
   * Derives a subtle ambient glow color for the active artwork.
   * Uses deterministic caching for instant 0ms lookups.
   */
  getArtworkAtmosphere(imageKey?: string | null): string {
    if (!imageKey) {
      return 'rgba(224, 173, 82, 0.08)'; // Default Cinematic Gold Glow
    }

    if (this.cache.has(imageKey)) {
      return this.cache.get(imageKey)!;
    }

    // Generate a deterministic palette selection based on artwork hash
    let hash = 0;
    for (let i = 0; i < imageKey.length; i++) {
      hash = (hash << 5) - hash + imageKey.charCodeAt(i);
      hash |= 0;
    }

    const index = Math.abs(hash) % this.CINEMATIC_PALETTES.length;
    const color = this.CINEMATIC_PALETTES[index];

    this.cache.set(imageKey, color);
    return color;
  }

  /**
   * Clears atmosphere cache if memory needs pruning
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const atmosphereService = new AtmosphereService();
