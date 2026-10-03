import { UserMovieRepository } from '../db/repositories/userMovieRepository';
import { CollectionRepository } from '../db/repositories/collectionRepository';

export class ExportService {
  /**
   * Export all saved titles to CSV or JSON
   */
  static async exportLibrary(format: 'csv' | 'json'): Promise<void> {
    const all = await UserMovieRepository.getAllWithMovies();
    const rows = all.map((item) => ({
      'Movie ID': item.movie.id,
      'Title': item.movie.title,
      'Type': item.movie.mediaType === 'tv' ? 'Series' : 'Movie',
      'Release Year': item.movie.releaseDate ? item.movie.releaseDate.substring(0, 4) : '',
      'Status': item.userData?.status || 'want_to_watch',
      'Personal Rating': item.userData?.personalRating ?? '',
      'Favorite': item.userData?.isFavorite ? 'Yes' : 'No',
      'Runtime (min)': item.movie.runtime ?? '',
      'Genres': (item.movie.genres || []).map((g) => g.name).join(', '),
      'Added At': item.userData?.addedAt || '',
      'Watched At': item.userData?.watchedAt || '',
    }));

    await this.downloadFormattedData(rows, `MyCinema_Titles`, format);
  }

  /**
   * Export Watched history to CSV or JSON
   */
  static async exportWatchHistory(format: 'csv' | 'json'): Promise<void> {
    const all = await UserMovieRepository.getAllWithMovies();
    const watched = all.filter((item) => item.userData?.status === 'watched');

    const rows = watched.map((item) => ({
      'Movie ID': item.movie.id,
      'Title': item.movie.title,
      'Type': item.movie.mediaType === 'tv' ? 'Series' : 'Movie',
      'Release Year': item.movie.releaseDate ? item.movie.releaseDate.substring(0, 4) : '',
      'Watched Date': item.userData?.watchedAt || '',
      'Personal Rating': item.userData?.personalRating ?? '',
      'Notes': item.userData?.notes || '',
      'Review': item.userData?.review || '',
    }));

    await this.downloadFormattedData(rows, `MyCinema_Watched`, format);
  }

  /**
   * Export all Reviews and Notes to CSV or JSON
   */
  static async exportReviews(format: 'csv' | 'json'): Promise<void> {
    const all = await UserMovieRepository.getAllWithMovies();
    const reviewed = all.filter((item) => item.userData?.review || item.userData?.notes);

    const rows = reviewed.map((item) => ({
      'Movie ID': item.movie.id,
      'Title': item.movie.title,
      'Personal Rating': item.userData?.personalRating ?? '',
      'Review Title': item.userData?.reviewTitle || '',
      'Review': item.userData?.review || '',
      'Notes': item.userData?.notes || '',
      'Reviewed At': item.userData?.reviewedAt || '',
      'Watched At': item.userData?.watchedAt || '',
      'Contains Spoilers': item.userData?.hasSpoilers ? 'Yes' : 'No',
    }));

    await this.downloadFormattedData(rows, `MyCinema_Reviews`, format);
  }

  /**
   * Export a single collection to CSV or JSON
   */
  static async exportCollection(collectionId: string, format: 'csv' | 'json'): Promise<void> {
    const data = await CollectionRepository.getWithMovies(collectionId);
    if (!data) return;

    const rows = data.movies.map((item, idx) => ({
      'Order': idx + 1,
      'Movie ID': item.movie.id,
      'Title': item.movie.title,
      'Type': item.movie.mediaType === 'tv' ? 'Series' : 'Movie',
      'Release Year': item.movie.releaseDate ? item.movie.releaseDate.substring(0, 4) : '',
      'Status': item.userData?.status || 'want_to_watch',
      'Personal Rating': item.userData?.personalRating ?? '',
    }));

    const cleanName = data.collection.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    await this.downloadFormattedData(rows, `Collection_${cleanName}`, format);
  }

  private static async downloadFormattedData(rows: any[], baseFilename: string, format: 'csv' | 'json') {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${baseFilename}_${dateStr}.${format}`;

    if (format === 'json') {
      const jsonStr = JSON.stringify(rows, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      this.triggerDownload(blob, filename);
    } else {
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      this.triggerDownload(blob, filename);
    }
  }

  private static triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
