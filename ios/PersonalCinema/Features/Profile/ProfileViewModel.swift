// ProfileViewModel.swift - Personal Cinema Stats & Local Settings (SwiftData)
import Foundation
import Observation

@Observable
final class ProfileViewModel {
    var stats: StatsOverview?
    var genreStats: [GenreStat] = []
    var achievements: [Achievement] = []
    var recentWatches: [UserMovieBrief] = []
    var isLoading: Bool = false
    var tmdbApiKey: String = TMDBService.shared.apiKey
    var errorMessage: String?

    @MainActor
    func load() async {
        isLoading = true
        errorMessage = nil

        stats = StatisticsService.shared.calculateOverview()
        genreStats = StatisticsService.shared.calculateGenreStats()
        achievements = StatisticsService.shared.calculateAchievements()
        recentWatches = Array(DataManager.shared.getAllUserMovies(status: "watched", sortBy: "watched_at").prefix(10))

        isLoading = false
    }

    func saveTMDBKey(_ key: String) {
        TMDBService.shared.apiKey = key
        tmdbApiKey = TMDBService.shared.apiKey
    }

    @MainActor
    func clearAllData() {
        DataManager.shared.clearAllData()
        stats = StatisticsService.shared.calculateOverview()
        genreStats = []
        achievements = StatisticsService.shared.calculateAchievements()
        recentWatches = []
        HapticManager.shared.tap()
    }

    @MainActor
    func exportLibraryJSON() -> String {
        let all = DataManager.shared.getAllUserMovies(status: nil)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        if let data = try? encoder.encode(all), let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "[]"
    }

    @MainActor
    func exportFullBackupJSON() -> String {
        return DataManager.shared.exportFullBackupJSON()
    }

    @MainActor
    func restoreBackup(jsonString: String) -> (success: Bool, message: String) {
        let result = DataManager.shared.restoreFromBackupJSON(jsonString)
        if result.success {
            stats = StatisticsService.shared.calculateOverview()
            genreStats = StatisticsService.shared.calculateGenreStats()
            achievements = StatisticsService.shared.calculateAchievements()
            recentWatches = Array(DataManager.shared.getAllUserMovies(status: "watched", sortBy: "watched_at").prefix(10))
            HapticManager.shared.success()
        }
        return (result.success, result.message)
    }
}
