// DiscoverViewModel.swift - Personal Cinema Movie Discovery (Direct TMDB)
import Foundation
import Observation

struct MoodOption: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let genreIds: [Int]
}

@Observable
final class DiscoverViewModel {
    var searchQuery: String = ""
    var searchResults: [MovieBrief] = []
    var trending: [MovieBrief] = []
    var popular: [MovieBrief] = []
    var genres: [Genre] = []
    var selectedGenre: Genre?
    var isSearching: Bool = false
    var isLoading: Bool = false
    var page: Int = 1
    var hasMore: Bool = true
    var errorMessage: String?

    private var searchTask: Task<Void, Never>?

    let moods: [MoodOption] = [
        MoodOption(title: "Something Intense", subtitle: "High-stakes, pulse-pounding", genreIds: [28, 53]),
        MoodOption(title: "Mind-Bending", subtitle: "Challenging reality & psyche", genreIds: [878, 9648]),
        MoodOption(title: "Something Emotional", subtitle: "Cathartic or deeply moving", genreIds: [18, 10749]),
        MoodOption(title: "Dark & Gritty", subtitle: "Crime, noir, and shadows", genreIds: [80, 9648]),
        MoodOption(title: "Pure Escapism", subtitle: "Fantasy, epic journeys", genreIds: [12, 14]),
        MoodOption(title: "Witty & Light", subtitle: "Smart comedies & laugh-out-loud", genreIds: [35]),
        MoodOption(title: "True Events", subtitle: "Gripping real-world stories", genreIds: [36, 99]),
        MoodOption(title: "Heart-Racing Horror", subtitle: "Atmospheric dread & thrills", genreIds: [27, 53])
    ]

    func onSearchQueryChanged() {
        searchTask?.cancel()
        let trimmed = searchQuery.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else {
            searchResults = []
            isSearching = false
            return
        }

        isSearching = true
        searchTask = Task {
            try? await Task.sleep(nanoseconds: 400_000_000) // 400ms debounce
            guard !Task.isCancelled else { return }
            await search()
        }
    }

    func search() async {
        guard !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isLoading = true
        page = 1

        do {
            let results = try await TMDBService.shared.searchMovies(query: searchQuery, page: 1)
            searchResults = results
            hasMore = results.count >= 20
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func loadTrendingAndGenres() async {
        isLoading = true
        errorMessage = nil
        do {
            async let trendingResult = TMDBService.shared.getTrending(timeWindow: "week", page: 1)
            async let popularResult = TMDBService.shared.getPopular(page: 1)
            async let genreResult = TMDBService.shared.getGenres()

            let (t, p, g) = try await (trendingResult, popularResult, genreResult)
            trending = t
            popular = p
            genres = g
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectMood(_ mood: MoodOption) async {
        selectedGenre = nil
        isLoading = true
        page = 1
        isSearching = true

        do {
            let results = try await TMDBService.shared.getDiscover(genreIds: mood.genreIds, page: 1)
            searchResults = results
            hasMore = results.count >= 20
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func selectGenre(_ genre: Genre) async {
        selectedGenre = genre
        isLoading = true
        page = 1
        isSearching = true

        do {
            let results = try await TMDBService.shared.getDiscover(genreIds: [genre.id], page: 1)
            searchResults = results
            hasMore = results.count >= 20
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard hasMore, !isLoading else { return }
        page += 1
        isLoading = true

        do {
            let query = searchQuery.trimmingCharacters(in: .whitespaces)
            let newItems: [MovieBrief]
            if !query.isEmpty {
                newItems = try await TMDBService.shared.searchMovies(query: query, page: page)
            } else if let genre = selectedGenre {
                newItems = try await TMDBService.shared.getDiscover(genreIds: [genre.id], page: page)
            } else {
                newItems = try await TMDBService.shared.getTrending(page: page)
            }

            searchResults.append(contentsOf: newItems)
            hasMore = newItems.count >= 20
        } catch {
            page -= 1
        }
        isLoading = false
    }

    func clearSearch() {
        searchQuery = ""
        searchResults = []
        isSearching = false
        selectedGenre = nil
    }
}
