// HomeViewModel.swift - Personal Cinema Home Experience (Local-First)
import Foundation
import Observation
import SwiftUI

@Observable
final class HomeViewModel {
    var heroMovie: MovieBrief?
    var continueWatching: [UserMovieBrief] = []
    var nextMovie: UserMovieBrief?
    var recentlyAdded: [UserMovieBrief] = []
    var recommendations: [MovieBrief] = []
    var trending: [MovieBrief] = []
    var streak: Int = 0
    var isLoading: Bool = false
    var errorMessage: String?

    private var watchlistMovies: [UserMovieBrief] = []

    @MainActor
    func load() async {
        isLoading = true
        errorMessage = nil

        // 1. Load local SwiftData state immediately
        watchlistMovies = DataManager.shared.getAllUserMovies(status: "watchlist")
        continueWatching = DataManager.shared.getAllUserMovies(status: "watching")
        recentlyAdded = Array(DataManager.shared.getAllUserMovies(sortBy: "added_at").prefix(10))

        let stats = StatisticsService.shared.calculateLibraryStats()
        streak = stats.currentStreak
        nextMovie = watchlistMovies.first

        // 2. Fetch TMDB trending and recommendations with graceful offline fallback
        do {
            async let trendingFetch = TMDBService.shared.getTrending(timeWindow: "week")
            let trendingList = try await trendingFetch
            trending = trendingList

            // Pick hero movie
            if watchlistMovies.count >= 3 {
                heroMovie = watchlistMovies.randomElement()?.movie ?? trendingList.first
            } else {
                heroMovie = watchlistMovies.first?.movie ?? trendingList.first
            }

            // Recommendations based on user's top genres, or fallback to popular
            let genreStats = StatisticsService.shared.calculateGenreStats()
            if let topGenre = genreStats.first {
                let allGenres = try? await TMDBService.shared.getGenres()
                let genreId = allGenres?.first(where: { $0.name.lowercased() == topGenre.name.lowercased() })?.id
                if let genreId = genreId {
                    recommendations = try await TMDBService.shared.getDiscover(genreIds: [genreId], sortBy: "vote_average.desc")
                } else {
                    recommendations = try await TMDBService.shared.getPopular(page: 1)
                }
            } else {
                recommendations = try await TMDBService.shared.getPopular(page: 1)
            }
        } catch {
            // If offline, use local items for hero and suppress network failure crash
            if heroMovie == nil {
                heroMovie = watchlistMovies.first?.movie
            }
            if trending.isEmpty {
                trending = watchlistMovies.compactMap { $0.movie }
            }
            if recommendations.isEmpty {
                recommendations = recentlyAdded.compactMap { $0.movie }
            }
        }

        isLoading = false
    }

    func surpriseMe() -> MovieBrief? {
        let pool = watchlistMovies.compactMap { $0.movie }
        if !pool.isEmpty {
            return pool.randomElement()
        }
        return trending.randomElement()
    }

    func refreshHero() {
        guard watchlistMovies.count >= 2 else { return }
        let newHero = watchlistMovies.filter { $0.movie?.id != heroMovie?.id }.randomElement()?.movie
        withAnimation(CinemaAnimation.cinematic) {
            heroMovie = newHero
        }
    }
}
