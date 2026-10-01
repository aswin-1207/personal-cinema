import QRCode from 'qrcode';
import { MovieSharePayload, CollectionSharePayload } from '../types/share';
import { Movie, UserMovie } from '../types/movie';
import { CollectionWithMovies } from '../types/collection';
import { TMDBService } from './tmdbService';

export class ShareService {
  /**
   * Build single movie share payload with user privacy choices
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
      tmdbRating: movie.voteAverage,
      status: privacy?.includeStatus && userData?.status ? userData.status : null,
      rating: privacy?.includeRating && userData?.personalRating ? userData.personalRating : null,
      review: privacy?.includeReview && userData?.review ? userData.review : null,
    };
  }

  /**
   * Build collection share payload
   */
  static buildCollectionSharePayload(colData: CollectionWithMovies): CollectionSharePayload {
    const posters = colData.movies
      .map((m) => TMDBService.getPosterUrl(m.movie.posterPath, 'w342'))
      .filter((url): url is string => !!url)
      .slice(0, 6);

    return {
      collectionId: colData.collection.id,
      name: colData.collection.name,
      description: colData.collection.description,
      totalMovies: colData.progress.total,
      watchedMovies: colData.progress.watched,
      completionPercent: colData.progress.percent,
      completedAt: colData.collection.completedAt,
      posters,
    };
  }

  /**
   * Generate real QR Code data URL for any share link
   */
  static async generateQRCode(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        width: 260,
        margin: 2,
        color: {
          dark: '#E0AD52', // Cinema Gold
          light: '#09090B', // Cinema Black
        },
      });
    } catch (err) {
      console.error('Failed to generate QR Code:', err);
      return '';
    }
  }

  /**
   * Encode payload into a safe shareable URL hash
   */
  static createMovieShareUrl(payload: MovieSharePayload): string {
    const jsonStr = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(jsonStr));
    const base = window.location.origin + window.location.pathname;
    return `${base}#share-movie=${encoded}`;
  }

  static decodeMovieShareUrl(hash: string): MovieSharePayload | null {
    try {
      const match = hash.match(/#share-movie=([^&]+)/);
      if (!match) return null;
      const jsonStr = decodeURIComponent(atob(match[1]));
      return JSON.parse(jsonStr) as MovieSharePayload;
    } catch {
      return null;
    }
  }

  static createCollectionShareUrl(payload: CollectionSharePayload): string {
    const jsonStr = JSON.stringify(payload);
    const encoded = btoa(encodeURIComponent(jsonStr));
    const base = window.location.origin + window.location.pathname;
    return `${base}#share-col=${encoded}`;
  }

  static decodeCollectionShareUrl(hash: string): CollectionSharePayload | null {
    try {
      const match = hash.match(/#share-col=([^&]+)/);
      if (!match) return null;
      const jsonStr = decodeURIComponent(atob(match[1]));
      return JSON.parse(jsonStr) as CollectionSharePayload;
    } catch {
      return null;
    }
  }

  /**
   * Trigger native Web Share or fallback to clipboard
   */
  static async share(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return 'shared';
      } catch (err: any) {
        if (err.name === 'AbortError') return 'failed'; // User cancelled share dialog
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  static async shareOrCopy(url: string, title?: string, text?: string): Promise<boolean> {
    const result = await this.share({ url, title: title || 'Personal Cinema', text: text || '' });
    return result !== 'failed';
  }
}
