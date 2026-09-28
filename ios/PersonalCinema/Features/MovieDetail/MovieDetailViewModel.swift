// MovieDetailViewModel.swift - Personal Cinema Movie Detail (TMDB + SwiftData)
import Foundation
import Observation

@Observable
final class MovieDetailViewModel {
    var movie: MovieDetail?
    var userMovie: UserMovieBrief?
    var similar: [MovieBrief] = []
    var isLoading: Bool = false
    var isSaving: Bool = false
    var errorMessage: String?

    let tmdbId: Int

    init(tmdbId: Int) {
        self.tmdbId = tmdbId
    }

    @MainActor
    func load() async {
        isLoading = true
        errorMessage = nil

        // Check local SwiftData state first for immediate UI display
        userMovie = DataManager.shared.getUserMovie(movieId: tmdbId)

        do {
            async let movieDetailFetch = TMDBService.shared.getMovieDetails(tmdbId: tmdbId)
            async let similarFetch = TMDBService.shared.getSimilar(tmdbId: tmdbId)

            let (detail, similarMovies) = try await (movieDetailFetch, similarFetch)
            movie = detail
            similar = similarMovies

            // Cache movie detail in local SwiftData
            DataManager.shared.cacheMovieDetail(detail)

            // Re-fetch userMovie so it includes the fresh movie brief
            userMovie = DataManager.shared.getUserMovie(movieId: tmdbId)
        } catch {
            // Offline fallback: check if we have cached movie in SwiftData
            if let cached = DataManager.shared.getLocalMovie(tmdbId: tmdbId) {
                movie = MovieDetail(
                    id: cached.tmdbId,
                    title: cached.title,
                    originalTitle: cached.originalTitle,
                    overview: cached.overview,
                    releaseDate: cached.releaseDate,
                    runtime: cached.runtime,
                    posterPath: cached.posterPath,
                    backdropPath: cached.backdropPath,
                    voteAverage: cached.voteAverage,
                    voteCount: nil,
                    genres: cached.genres,
                    credits: nil,
                    status: "Cached",
                    tagline: nil,
                    budget: nil,
                    revenue: nil
                )
            } else {
                errorMessage = error.localizedDescription
            }
        }
        isLoading = false
    }

    @MainActor
    func addToWatchlist() async {
        guard let movie = movie else { return }
        isSaving = true
        userMovie = DataManager.shared.addToWatchlist(movie: movie.brief)
        HapticManager.shared.success()
        SoundManager.shared.play(.confirm)
        isSaving = false
    }

    @MainActor
    func markWatched(rating: Double?, notes: String?) async {
        isSaving = true
        if let movie = movie {
            DataManager.shared.cacheMovieDetail(movie)
        }
        userMovie = DataManager.shared.markWatched(movieId: tmdbId, rating: rating, notes: notes)
        HapticManager.shared.movieComplete()
        SoundManager.shared.play(.movieComplete)
        isSaving = false
    }

    @MainActor
    func unmarkWatched() async {
        isSaving = true
        userMovie = DataManager.shared.unmarkWatched(movieId: tmdbId)
        HapticManager.shared.tap()
        isSaving = false
    }

    @MainActor
    func scheduleMovieNight(date: Date, reminderMinutes: Int = 30) async {
        isSaving = true
        let notificationId = NotificationManager.shared.scheduleMovieNight(
            movie: movie?.brief ?? MovieBrief(id: tmdbId, title: "Movie Night", originalTitle: nil, overview: nil, releaseDate: nil, posterPath: nil, backdropPath: nil, voteAverage: 0, genreIds: nil),
            date: date,
            reminderMinutes: reminderMinutes
        )

        _ = DataManager.shared.scheduleReminder(
            movieId: tmdbId,
            movieBrief: movie?.brief,
            remindAt: date,
            preReminderMinutes: reminderMinutes,
            notificationId: notificationId
        )
        userMovie = DataManager.shared.getUserMovie(movieId: tmdbId)
        HapticManager.shared.confirm()
        isSaving = false
    }

    @MainActor
    func updateRating(rating: Double) async {
        isSaving = true
        userMovie = DataManager.shared.updateUserMovie(movieId: tmdbId, personalRating: rating)
        HapticManager.shared.ratingSelect()
        isSaving = false
    }

    @MainActor
    func toggleFavorite() async {
        guard let current = userMovie?.isFavorite else { return }
        isSaving = true
        userMovie = DataManager.shared.updateUserMovie(movieId: tmdbId, isFavorite: !current)
        HapticManager.shared.tap()
        isSaving = false
    }
}
