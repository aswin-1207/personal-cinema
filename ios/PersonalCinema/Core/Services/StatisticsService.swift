// StatisticsService.swift - Local Cinema Analytics & Achievements Engine
import Foundation
import SwiftData

@MainActor
final class StatisticsService {
    static let shared = StatisticsService()

    private var dataManager: DataManager { DataManager.shared }

    func calculateOverview() -> StatsOverview {
        let allUserMovies = dataManager.getAllUserMovies(status: nil)
        let watchedMovies = allUserMovies.filter { $0.status == "watched" }

        let totalMovies = allUserMovies.count
        let watchedCount = watchedMovies.count

        // Calculate hours watched
        var totalMinutes = 0
        for item in watchedMovies {
            if let movieIdInt = Int(item.movieId ?? ""),
               let localMovie = dataManager.getLocalMovie(tmdbId: movieIdInt),
               let runtime = localMovie.runtime, runtime > 0 {
                totalMinutes += runtime
            } else {
                totalMinutes += 110 // Average feature film duration fallback
            }
        }
        let totalHours = Double(totalMinutes) / 60.0

        // Calculate ratings average
        let ratings = watchedMovies.compactMap { $0.personalRating }
        let averageRating = ratings.isEmpty ? nil : (ratings.reduce(0, +) / Double(ratings.count))

        // Calculate streaks
        let (currentStreak, longestStreak) = calculateStreaks(from: watchedMovies)

        // Calculate favorite genre
        let favoriteGenre = calculateTopGenre(from: watchedMovies)

        return StatsOverview(
            totalMovies: totalMovies,
            watchedMovies: watchedCount,
            totalHours: totalHours,
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            averageRating: averageRating,
            favoriteGenre: favoriteGenre
        )
    }

    func calculateLibraryStats() -> LibraryStats {
        let allUserMovies = dataManager.getAllUserMovies(status: nil)
        let watched = allUserMovies.filter { $0.status == "watched" }
        let watchlist = allUserMovies.filter { $0.status == "watchlist" }

        var totalMinutes = 0
        for item in watched {
            if let movieIdInt = Int(item.movieId ?? ""),
               let localMovie = dataManager.getLocalMovie(tmdbId: movieIdInt),
               let runtime = localMovie.runtime, runtime > 0 {
                totalMinutes += runtime
            } else {
                totalMinutes += 110
            }
        }
        let (currentStreak, _) = calculateStreaks(from: watched)

        return LibraryStats(
            total: allUserMovies.count,
            watched: watched.count,
            watchlist: watchlist.count,
            totalHours: Double(totalMinutes) / 60.0,
            currentStreak: currentStreak
        )
    }

    func calculateGenreStats() -> [GenreStat] {
        let watchedMovies = dataManager.getAllUserMovies(status: "watched")
        guard !watchedMovies.isEmpty else { return [] }

        var genreCounts: [String: Int] = [:]
        for item in watchedMovies {
            guard let movieIdInt = Int(item.movieId ?? ""),
                  let localMovie = dataManager.getLocalMovie(tmdbId: movieIdInt) else { continue }
            for genre in localMovie.genres {
                genreCounts[genre.name, default: 0] += 1
            }
        }

        let totalGenreHits = genreCounts.values.reduce(0, +)
        guard totalGenreHits > 0 else { return [] }

        return genreCounts.map { (name, count) in
            let percentage = (Double(count) / Double(totalGenreHits)) * 100.0
            return GenreStat(name: name, count: count, percentage: percentage)
        }.sorted { $0.count > $1.count }
    }

    func calculateWatchCalendar(months: Int = 3) -> [WatchCalendarEntry] {
        let watchedMovies = dataManager.getAllUserMovies(status: "watched")
        let formatter = ISO8601DateFormatter()
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "yyyy-MM-dd"

        var dateCounts: [String: Int] = [:]
        for item in watchedMovies {
            guard let watchedAtStr = item.watchedAt,
                  let date = formatter.date(from: watchedAtStr) else { continue }
            let dayStr = dayFormatter.string(from: date)
            dateCounts[dayStr, default: 0] += 1
        }

        return dateCounts.map { WatchCalendarEntry(date: $0.key, count: $0.value) }
    }

    func calculateAchievements() -> [Achievement] {
        let watchedMovies = dataManager.getAllUserMovies(status: "watched")
        let watchedCount = watchedMovies.count
        let (currentStreak, longestStreak) = calculateStreaks(from: watchedMovies)
        let fiveStarCount = watchedMovies.filter { ($0.personalRating ?? 0) >= 4.9 }.count

        var achievements: [Achievement] = []

        // 1. First Ticket
        achievements.append(Achievement(
            id: "first_ticket",
            name: "First Ticket",
            description: "Watch and mark your first film",
            icon: "ticket.fill",
            unlockedAt: watchedCount >= 1 ? "unlocked" : nil,
            progress: min(1.0, Double(watchedCount) / 1.0),
            target: 1
        ))

        // 2. Film Buff
        achievements.append(Achievement(
            id: "film_buff",
            name: "Film Buff",
            description: "Experience 5 cinematic masterpieces",
            icon: "film.stack",
            unlockedAt: watchedCount >= 5 ? "unlocked" : nil,
            progress: min(1.0, Double(watchedCount) / 5.0),
            target: 5
        ))

        // 3. Cinephile
        achievements.append(Achievement(
            id: "cinephile",
            name: "Cinephile",
            description: "Log 15 curated screenings",
            icon: "sparkles.tv",
            unlockedAt: watchedCount >= 15 ? "unlocked" : nil,
            progress: min(1.0, Double(watchedCount) / 15.0),
            target: 15
        ))

        // 4. Director's Cut
        achievements.append(Achievement(
            id: "directors_cut",
            name: "Director's Cut",
            description: "Build an epic library of 50 watched films",
            icon: "crown.fill",
            unlockedAt: watchedCount >= 50 ? "unlocked" : nil,
            progress: min(1.0, Double(watchedCount) / 50.0),
            target: 50
        ))

        // 5. Streak Master
        let maxStreak = max(currentStreak, longestStreak)
        achievements.append(Achievement(
            id: "streak_master",
            name: "Cinema Streak",
            description: "Watch films 3 days in a row",
            icon: "flame.fill",
            unlockedAt: maxStreak >= 3 ? "unlocked" : nil,
            progress: min(1.0, Double(maxStreak) / 3.0),
            target: 3
        ))

        // 6. Critic's Choice
        achievements.append(Achievement(
            id: "critics_choice",
            name: "Critic's Choice",
            description: "Award 5 stars to 3 exceptional films",
            icon: "star.fill",
            unlockedAt: fiveStarCount >= 3 ? "unlocked" : nil,
            progress: min(1.0, Double(fiveStarCount) / 3.0),
            target: 3
        ))

        return achievements
    }

    // MARK: - Private Helpers

    private func calculateStreaks(from watchedMovies: [UserMovieBrief]) -> (current: Int, longest: Int) {
        let formatter = ISO8601DateFormatter()
        let calendar = Calendar.current

        let dates: [Date] = watchedMovies.compactMap { item in
            guard let watchedAt = item.watchedAt else { return nil }
            return formatter.date(from: watchedAt)
        }

        guard !dates.isEmpty else { return (0, 0) }

        let dayDates = Set(dates.map { calendar.startOfDay(for: $0) }).sorted(by: >)
        guard let mostRecent = dayDates.first else { return (0, 0) }

        let today = calendar.startOfDay(for: Date())
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!

        var currentStreak = 0
        if mostRecent == today || mostRecent == yesterday {
            var checkDate = mostRecent
            for day in dayDates {
                if day == checkDate {
                    currentStreak += 1
                    checkDate = calendar.date(byAdding: .day, value: -1, to: checkDate)!
                } else if day < checkDate {
                    break
                }
            }
        }

        // Longest streak
        var longestStreak = 0
        var tempStreak = 0
        var prevDate: Date? = nil

        let ascendingDates = dayDates.sorted()
        for day in ascendingDates {
            if let prev = prevDate {
                let diff = calendar.dateComponents([.day], from: prev, to: day).day ?? 0
                if diff == 1 {
                    tempStreak += 1
                } else {
                    tempStreak = 1
                }
            } else {
                tempStreak = 1
            }
            prevDate = day
            longestStreak = max(longestStreak, tempStreak)
        }

        return (currentStreak, longestStreak)
    }

    private func calculateTopGenre(from watchedMovies: [UserMovieBrief]) -> String? {
        var counts: [String: Int] = [:]
        for item in watchedMovies {
            guard let movieIdInt = Int(item.movieId ?? ""),
                  let localMovie = dataManager.getLocalMovie(tmdbId: movieIdInt) else { continue }
            for genre in localMovie.genres {
                counts[genre.name, default: 0] += 1
            }
        }
        return counts.max(by: { $0.value < $1.value })?.key
    }
}
