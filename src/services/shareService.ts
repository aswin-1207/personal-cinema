import { MovieSharePayload, CollectionSharePayload, ShareCardStyle, ShareResult } from '../types/share';
import { Movie, UserMovie } from '../types/movie';
import { CollectionWithMovies } from '../types/collection';
import { TMDBService } from './tmdbService';

export class ShareService {
  /**
   * Build single movie share payload with user privacy choices.
   * Uses an allowlist of fields; never exposes private notes, database internals, or API keys.
   */
  static buildMovieSharePayload(
    movie: Movie,
    userData?: UserMovie,
    privacy?: { includeStatus?: boolean; includeRating?: boolean; includeReview?: boolean }
  ): MovieSharePayload {
    return {
      movieId: movie.id,
      title: movie.title,
      year: movie.releaseDate ? movie.releaseDate.substring(0, 4) : undefined,
      runtime: movie.runtime ? `${movie.runtime}m` : undefined,
      genres: (movie.genres || []).map((g) => g.name).slice(0, 3),
      posterUrl: TMDBService.getPosterUrl(movie.posterPath, 'w500'),
      backdropUrl: TMDBService.getBackdropUrl(movie.backdropPath, 'w780'),
      tmdbRating: movie.voteAverage || 0,
      status: privacy?.includeStatus && userData?.status ? userData.status : null,
      rating: privacy?.includeRating && userData?.personalRating ? userData.personalRating : null,
      review: privacy?.includeReview && userData?.review ? userData.review : null,
    };
  }

  /**
   * Build collection share payload.
   * Includes progress, completion date, and the "Final Film" memory if complete.
   */
  static buildCollectionSharePayload(colData: CollectionWithMovies): CollectionSharePayload {
    const posters = colData.movies
      .map((m) => TMDBService.getPosterUrl(m.movie.posterPath, 'w342'))
      .filter((url): url is string => !!url)
      .slice(0, 6);

    let finalMovieTitle: string | null = null;
    if (colData.collection.finalMovieId) {
      const finalItem = colData.movies.find((m) => m.movie.id === colData.collection.finalMovieId);
      finalMovieTitle = finalItem?.movie.title || null;
    }

    return {
      collectionId: colData.collection.id,
      name: colData.collection.name,
      description: colData.collection.description,
      totalMovies: colData.progress.total,
      watchedMovies: colData.progress.watched,
      completionPercent: colData.progress.percent,
      isComplete: colData.progress.isComplete,
      completedAt: colData.collection.completedAt,
      finalMovieId: colData.collection.finalMovieId,
      finalMovieTitle,
      posters,
    };
  }

  /**
   * Safe base64url encoding for cross-device URL snapshot
   */
  private static encodePayload(payload: any): string {
    const jsonStr = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonStr));
  }

  private static decodePayload<T>(encoded: string): T | null {
    try {
      const jsonStr = decodeURIComponent(atob(encoded));
      return JSON.parse(jsonStr) as T;
    } catch {
      return null;
    }
  }

  /**
   * Encode movie payload into shareable URL
   * Supports both clean hash deep link and dedicated path
   */
  static createMovieShareUrl(payload: MovieSharePayload): string {
    const encoded = this.encodePayload(payload);
    const origin = window.location.origin;
    return `${origin}/#share-movie=${encoded}`;
  }

  static decodeMovieShareUrl(urlOrHash: string): MovieSharePayload | null {
    try {
      // Check query param data first
      if (urlOrHash.includes('data=')) {
        const match = urlOrHash.match(/data=([^&]+)/);
        if (match) return this.decodePayload<MovieSharePayload>(match[1]);
      }
      // Check hash
      const hashMatch = urlOrHash.match(/#share-movie=([^&]+)/);
      if (hashMatch) {
        return this.decodePayload<MovieSharePayload>(hashMatch[1]);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Encode collection payload into shareable URL
   */
  static createCollectionShareUrl(payload: CollectionSharePayload): string {
    const encoded = this.encodePayload(payload);
    const origin = window.location.origin;
    return `${origin}/#share-col=${encoded}`;
  }

  static decodeCollectionShareUrl(urlOrHash: string): CollectionSharePayload | null {
    try {
      if (urlOrHash.includes('data=')) {
        const match = urlOrHash.match(/data=([^&]+)/);
        if (match) return this.decodePayload<CollectionSharePayload>(match[1]);
      }
      const hashMatch = urlOrHash.match(/#share-col=([^&]+)/);
      if (hashMatch) {
        return this.decodePayload<CollectionSharePayload>(hashMatch[1]);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if native Web Share is supported
   */
  static canNativeShare(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  /**
   * Check if file sharing is supported by navigator.canShare
   */
  static canShareFiles(files?: File[]): boolean {
    if (!this.canNativeShare() || typeof navigator.canShare !== 'function') {
      return false;
    }
    try {
      const testFiles = files && files.length > 0 ? files : [new File([''], 'test.png', { type: 'image/png' })];
      return navigator.canShare({ files: testFiles });
    } catch {
      return false;
    }
  }

  /**
   * Trigger native Web Share with graceful cancellation and automatic fallback
   */
  static async share(data: {
    title: string;
    text: string;
    url: string;
    files?: File[];
  }): Promise<ShareResult> {
    // 1. Attempt Native Web Share
    if (this.canNativeShare()) {
      try {
        // If files are provided and supported, share files
        if (data.files && data.files.length > 0 && this.canShareFiles(data.files)) {
          await navigator.share({
            title: data.title,
            text: data.text,
            url: data.url,
            files: data.files,
          });
          return { outcome: 'shared', method: 'file' };
        }

        // Standard link/text share
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
        return { outcome: 'shared', method: 'native' };
      } catch (err: any) {
        // User explicitly cancelled the share sheet: DO NOT treat as error
        if (err.name === 'AbortError') {
          return { outcome: 'cancelled' };
        }
        // If file sharing failed, attempt fallback share with URL only
        if (data.files && data.files.length > 0) {
          try {
            await navigator.share({
              title: data.title,
              text: data.text,
              url: data.url,
            });
            return { outcome: 'shared', method: 'native' };
          } catch (retryErr: any) {
            if (retryErr.name === 'AbortError') return { outcome: 'cancelled' };
          }
        }
      }
    }

    // 2. Fallback: Copy link to clipboard
    try {
      const copied = await this.copyLink(data.url);
      if (copied) {
        return { outcome: 'copied', method: 'clipboard' };
      }
    } catch {
      // Continue to failed
    }

    return { outcome: 'failed', error: 'Unable to share or copy link' };
  }

  /**
   * Copy link to clipboard
   */
  static async copyLink(url: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
      // Fallback textarea execCommand for legacy webviews
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Copy formatted text to clipboard
   */
  static async copyText(text: string): Promise<boolean> {
    return this.copyLink(text);
  }

  /**
   * Generate downloadable / shareable PNG image blob of a movie card
   */
  static async generateMovieCardBlob(
    payload: MovieSharePayload,
    style: ShareCardStyle
  ): Promise<Blob | null> {
    try {
      const canvas = document.createElement('canvas');
      const width = style === 'cinema' ? 1200 : 800;
      const height = style === 'cinema' ? 675 : 1200;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Dark cinematic canvas background
      ctx.fillStyle = '#09090B';
      ctx.fillRect(0, 0, width, height);

      // Subtle radial glow
      const radial = ctx.createRadialGradient(width / 2, height / 3, 50, width / 2, height / 2, width);
      radial.addColorStop(0, 'rgba(224, 173, 82, 0.12)'); // Cinema Gold
      radial.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, height);

      // Card border
      ctx.strokeStyle = 'rgba(224, 173, 82, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      // Header Brand
      ctx.fillStyle = '#E0AD52';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MYCINEMA', width / 2, 80);

      // Title
      ctx.fillStyle = '#F5F3EB';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText(payload.title, width / 2, height - 200);

      // Subtitle (Year, Runtime, Genres)
      const subParts = [payload.year, payload.runtime, payload.genres.join(', ')].filter(Boolean);
      ctx.fillStyle = '#9E9DA5';
      ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(subParts.join(' • '), width / 2, height - 155);

      // Personal details if provided
      if (payload.rating) {
        ctx.fillStyle = '#E0AD52';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`★ ${payload.rating.toFixed(1)} / 5`, width / 2, height - 110);
      } else if (payload.status) {
        ctx.fillStyle = '#E0AD52';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(payload.status.replace('_', ' ').toUpperCase(), width / 2, height - 110);
      }

      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    } catch (err) {
      console.warn('Canvas share card generation failed:', err);
      return null;
    }
  }

  /**
   * Direct app fallback URLs (standardized URI protocols without claiming app installation)
   */
  static getWhatsAppUrl(text: string, url: string): string {
    const full = encodeURIComponent(`${text} ${url}`.trim());
    return `https://wa.me/?text=${full}`;
  }

  static getTelegramUrl(text: string, url: string): string {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(text);
    return `https://t.me/share/url?url=${u}&text=${t}`;
  }

  static getEmailUrl(subject: string, body: string, url: string): string {
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(`${body}\n\n${url}`.trim());
    return `mailto:?subject=${s}&body=${b}`;
  }
}
