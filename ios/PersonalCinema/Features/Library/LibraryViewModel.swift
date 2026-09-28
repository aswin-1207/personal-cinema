// LibraryViewModel.swift - Personal Cinema Library & Watchlist Management (SwiftData)
import Foundation
import Observation

enum DisplayMode: String, CaseIterable {
    case grid = "Grid"
    case list = "List"
}

enum SortOption: String, CaseIterable {
    case addedAt = "Date Added"
    case title = "Title"
    case rating = "Rating"
    case watchedAt = "Date Watched"
    case releaseDate = "Release Year"
}

@Observable
final class LibraryViewModel {
    var movies: [UserMovieBrief] = []
    var displayMode: DisplayMode = .grid
    var sortBy: SortOption = .addedAt
    var filterStatus: String = "all"  // watchlist / watched / all
    var selectedGenre: String?
    var searchQuery: String = ""
    var isLoading: Bool = false
    var collections: [Collection] = []
    var stats: LibraryStats?
    var errorMessage: String?

    var filteredMovies: [UserMovieBrief] {
        var result = movies
        if !searchQuery.isEmpty {
            result = result.filter {
                $0.movie?.title.localizedCaseInsensitiveContains(searchQuery) == true
            }
        }
        return result
    }

    @MainActor
    func load() async {
        isLoading = true
        errorMessage = nil

        movies = DataManager.shared.getAllUserMovies(status: filterStatus, sortBy: sortKey)
        collections = DataManager.shared.getCollections()
        stats = StatisticsService.shared.calculateLibraryStats()

        isLoading = false
    }

    @MainActor
    func applyFilters() async {
        isLoading = true
        movies = DataManager.shared.getAllUserMovies(status: filterStatus, sortBy: sortKey)
        isLoading = false
    }

    private var sortKey: String {
        switch sortBy {
        case .addedAt: return "added_at"
        case .title: return "title"
        case .rating: return "personal_rating"
        case .watchedAt: return "watched_at"
        case .releaseDate: return "release_date"
        }
    }

    @MainActor
    func removeMovie(id: String) async {
        DataManager.shared.removeMovieById(id: id)
        movies.removeAll { $0.id == id }
        stats = StatisticsService.shared.calculateLibraryStats()
        HapticManager.shared.tap()
    }

    @MainActor
    func markWatched(id: String, rating: Double? = nil, notes: String? = nil) async {
        guard let item = movies.first(where: { $0.id == id }),
              let movieIdStr = item.movieId,
              let movieId = Int(movieIdStr) else { return }

        let updated = DataManager.shared.markWatched(movieId: movieId, rating: rating, notes: notes)
        if let idx = movies.firstIndex(where: { $0.id == id }) {
            movies[idx] = updated
        }
        HapticManager.shared.movieComplete()
        SoundManager.shared.play(.movieComplete)
        stats = StatisticsService.shared.calculateLibraryStats()
    }

    @MainActor
    func unmarkWatched(id: String) async {
        guard let item = movies.first(where: { $0.id == id }),
              let movieIdStr = item.movieId,
              let movieId = Int(movieIdStr) else { return }

        if let updated = DataManager.shared.unmarkWatched(movieId: movieId) {
            if let idx = movies.firstIndex(where: { $0.id == id }) {
                movies[idx] = updated
            }
        }
        HapticManager.shared.tap()
        stats = StatisticsService.shared.calculateLibraryStats()
    }

    @MainActor
    func createCollection(name: String) async {
        let coll = DataManager.shared.createCollection(name: name)
        collections.append(coll)
        HapticManager.shared.confirm()
    }
}
