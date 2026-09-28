// DataManager.swift - Centralized SwiftData Local Library Manager
import Foundation
import SwiftData

@MainActor
final class DataManager {
    static let shared = DataManager()

    let container: ModelContainer
    var context: ModelContext { container.mainContext }

    init() {
        let schema = Schema([
            LocalMovie.self,
            LocalUserMovie.self,
            LocalWatchSession.self,
            LocalCollection.self,
            LocalReminder.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            container = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Failed to initialize SwiftData ModelContainer: \(error)")
        }
    }

    // MARK: - Movie Metadata Cache

    func cacheMovie(_ brief: MovieBrief) {
        let tmdbId = brief.id
        let descriptor = FetchDescriptor<LocalMovie>(predicate: #Predicate { $0.tmdbId == tmdbId })
        if let existing = try? context.fetch(descriptor).first {
            existing.title = brief.title
            existing.originalTitle = brief.originalTitle
            existing.overview = brief.overview
            existing.posterPath = brief.posterPath
            existing.backdropPath = brief.backdropPath
            existing.voteAverage = brief.voteAverage
            existing.lastUpdated = Date()
        } else {
            let movie = LocalMovie(from: brief)
            context.insert(movie)
        }
        try? context.save()
    }

    func cacheMovieDetail(_ detail: MovieDetail) {
        let tmdbId = detail.id
        let descriptor = FetchDescriptor<LocalMovie>(predicate: #Predicate { $0.tmdbId == tmdbId })
        if let existing = try? context.fetch(descriptor).first {
            existing.title = detail.title
            existing.originalTitle = detail.originalTitle
            existing.overview = detail.overview
            existing.runtime = detail.runtime
            existing.posterPath = detail.posterPath
            existing.backdropPath = detail.backdropPath
            existing.voteAverage = detail.voteAverage
            existing.genres = detail.genres
            existing.lastUpdated = Date()
        } else {
            let movie = LocalMovie(from: detail)
            context.insert(movie)
        }
        try? context.save()
    }

    func getLocalMovie(tmdbId: Int) -> LocalMovie? {
        let descriptor = FetchDescriptor<LocalMovie>(predicate: #Predicate { $0.tmdbId == tmdbId })
        return try? context.fetch(descriptor).first
    }

    // MARK: - User Movie Library CRUD

    func getUserMovie(movieId: Int) -> UserMovieBrief? {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        guard let userMovie = try? context.fetch(descriptor).first else { return nil }
        let movieBrief = getLocalMovie(tmdbId: movieId)?.brief
        return userMovie.toUserMovieBrief(movie: movieBrief)
    }

    func addToWatchlist(movie: MovieBrief) -> UserMovieBrief {
        cacheMovie(movie)
        let movieId = movie.id
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        if let existing = try? context.fetch(descriptor).first {
            existing.status = "watchlist"
            try? context.save()
            return existing.toUserMovieBrief(movie: movie)
        } else {
            let userMovie = LocalUserMovie(movieId: movieId, status: "watchlist")
            context.insert(userMovie)
            try? context.save()
            return userMovie.toUserMovieBrief(movie: movie)
        }
    }

    func markWatched(
        movieId: Int,
        rating: Double? = nil,
        notes: String? = nil,
        review: String? = nil,
        isFavorite: Bool? = nil,
        watchedAt: Date = Date()
    ) -> UserMovieBrief {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        let movieBrief = getLocalMovie(tmdbId: movieId)?.brief

        if let existing = try? context.fetch(descriptor).first {
            existing.status = "watched"
            existing.watchedAt = watchedAt
            if let rating = rating { existing.personalRating = rating }
            if let notes = notes { existing.notes = notes }
            if let review = review { existing.review = review }
            if let isFavorite = isFavorite { existing.isFavorite = isFavorite }
            existing.rewatchCount += 1
            try? context.save()
            return existing.toUserMovieBrief(movie: movieBrief)
        } else {
            let userMovie = LocalUserMovie(
                movieId: movieId,
                status: "watched",
                personalRating: rating,
                notes: notes,
                review: review,
                isFavorite: isFavorite ?? false,
                rewatchCount: 1,
                watchedAt: watchedAt
            )
            context.insert(userMovie)
            try? context.save()
            return userMovie.toUserMovieBrief(movie: movieBrief)
        }
    }

    func unmarkWatched(movieId: Int) -> UserMovieBrief? {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        guard let existing = try? context.fetch(descriptor).first else { return nil }
        existing.status = "watchlist"
        existing.watchedAt = nil
        existing.personalRating = nil
        try? context.save()
        let movieBrief = getLocalMovie(tmdbId: movieId)?.brief
        return existing.toUserMovieBrief(movie: movieBrief)
    }

    func updateUserMovie(
        movieId: Int,
        status: String? = nil,
        personalRating: Double? = nil,
        notes: String? = nil,
        review: String? = nil,
        isFavorite: Bool? = nil,
        scheduledAt: Date? = nil
    ) -> UserMovieBrief? {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        guard let existing = try? context.fetch(descriptor).first else { return nil }
        if let s = status { existing.status = s }
        if let r = personalRating { existing.personalRating = r }
        if let n = notes { existing.notes = n }
        if let rev = review { existing.review = rev }
        if let fav = isFavorite { existing.isFavorite = fav }
        if let sch = scheduledAt { existing.scheduledAt = sch }
        try? context.save()
        let movieBrief = getLocalMovie(tmdbId: movieId)?.brief
        return existing.toUserMovieBrief(movie: movieBrief)
    }

    func removeMovie(movieId: Int) {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        if let existing = try? context.fetch(descriptor).first {
            context.delete(existing)
            try? context.save()
        }
    }

    func removeMovieById(id: String) {
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.id == id })
        if let existing = try? context.fetch(descriptor).first {
            context.delete(existing)
            try? context.save()
        }
    }

    func getAllUserMovies(status: String? = nil, sortBy: String = "added_at") -> [UserMovieBrief] {
        var descriptor = FetchDescriptor<LocalUserMovie>()
        if let status = status, status != "all" {
            descriptor.predicate = #Predicate { $0.status == status }
        }
        guard let list = try? context.fetch(descriptor) else { return [] }

        var results: [UserMovieBrief] = list.map { item in
            let movieBrief = getLocalMovie(tmdbId: item.movieId)?.brief
            return item.toUserMovieBrief(movie: movieBrief)
        }

        // Apply sorting
        switch sortBy {
        case "title":
            results.sort { ($0.movie?.title ?? "") < ($1.movie?.title ?? "") }
        case "personal_rating":
            results.sort { ($0.personalRating ?? 0) > ($1.personalRating ?? 0) }
        case "watched_at":
            results.sort { ($0.watchedAt ?? "") > ($1.watchedAt ?? "") }
        case "release_date":
            results.sort { ($0.movie?.releaseDate ?? "") > ($1.movie?.releaseDate ?? "") }
        default: // added_at
            results.sort { ($0.addedAt ?? "") > ($1.addedAt ?? "") }
        }

        return results
    }

    // MARK: - Reminders & Movie Night

    func scheduleReminder(movieId: Int, movieBrief: MovieBrief?, remindAt: Date, preReminderMinutes: Int, notificationId: String?) -> Reminder {
        if let brief = movieBrief {
            cacheMovie(brief)
        }
        let reminder = LocalReminder(
            movieId: movieId,
            remindAt: remindAt,
            preReminderMinutes: preReminderMinutes,
            status: "pending",
            notificationId: notificationId
        )
        context.insert(reminder)

        // Also update scheduledAt on userMovie
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        if let userMovie = try? context.fetch(descriptor).first {
            userMovie.scheduledAt = remindAt
        }

        try? context.save()
        let brief = movieBrief ?? getLocalMovie(tmdbId: movieId)?.brief
        return reminder.toReminder(movie: brief)
    }

    func getReminders() -> [Reminder] {
        let descriptor = FetchDescriptor<LocalReminder>(sortBy: [SortDescriptor(\.remindAt)])
        guard let list = try? context.fetch(descriptor) else { return [] }
        return list.map { reminder in
            let brief = getLocalMovie(tmdbId: reminder.movieId)?.brief
            return reminder.toReminder(movie: brief)
        }
    }

    func deleteReminder(id: String) {
        let descriptor = FetchDescriptor<LocalReminder>(predicate: #Predicate { $0.id == id })
        if let item = try? context.fetch(descriptor).first {
            context.delete(item)
            try? context.save()
        }
    }

    // MARK: - Watch Sessions

    func startWatchSession(movieId: Int) -> WatchSession {
        let session = LocalWatchSession(movieId: movieId, startedAt: Date())
        context.insert(session)

        // Update movie status to 'watching' if not already watched
        let descriptor = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
        if let userMovie = try? context.fetch(descriptor).first {
            if userMovie.status != "watched" {
                userMovie.status = "watching"
            }
        } else {
            let userMovie = LocalUserMovie(movieId: movieId, status: "watching")
            context.insert(userMovie)
        }

        try? context.save()
        return session.toWatchSession()
    }

    func completeWatchSession(sessionId: String, rating: Double? = nil, notes: String? = nil) -> WatchSession? {
        let descriptor = FetchDescriptor<LocalWatchSession>(predicate: #Predicate { $0.id == sessionId })
        guard let session = try? context.fetch(descriptor).first else { return nil }

        session.endedAt = Date()
        session.completed = true

        _ = markWatched(movieId: session.movieId, rating: rating, notes: notes)
        try? context.save()
        return session.toWatchSession()
    }

    // MARK: - Collections

    func getCollections() -> [Collection] {
        let descriptor = FetchDescriptor<LocalCollection>(sortBy: [SortDescriptor(\.sortOrder)])
        guard let list = try? context.fetch(descriptor) else { return [] }
        return list.map { $0.toCollection() }
    }

    func createCollection(name: String, description: String? = nil) -> Collection {
        let count = (try? context.fetchCount(FetchDescriptor<LocalCollection>())) ?? 0
        let item = LocalCollection(name: name, collectionDescription: description, sortOrder: count)
        context.insert(item)
        try? context.save()
        return item.toCollection()
    }

    func addMovieToCollection(collectionId: String, movieId: Int) {
        let descriptor = FetchDescriptor<LocalCollection>(predicate: #Predicate { $0.id == collectionId })
        if let coll = try? context.fetch(descriptor).first {
            var ids = coll.movieIds
            if !ids.contains(movieId) {
                ids.append(movieId)
                coll.movieIds = ids
                try? context.save()
            }
        }
    }

    func removeMovieFromCollection(collectionId: String, movieId: Int) {
        let descriptor = FetchDescriptor<LocalCollection>(predicate: #Predicate { $0.id == collectionId })
        if let coll = try? context.fetch(descriptor).first {
            var ids = coll.movieIds
            ids.removeAll { $0 == movieId }
            coll.movieIds = ids
            try? context.save()
        }
    }

    func deleteCollection(collectionId: String) {
        let descriptor = FetchDescriptor<LocalCollection>(predicate: #Predicate { $0.id == collectionId })
        if let coll = try? context.fetch(descriptor).first {
            context.delete(coll)
            try? context.save()
        }
    }

    // MARK: - Full Library Backup & Restore Engine

    func exportFullBackupJSON() -> String {
        let movieDesc = FetchDescriptor<LocalMovie>()
        let allMovies = (try? context.fetch(movieDesc)) ?? []
        let movieDTOs = allMovies.map {
            MovieBackupDTO(
                tmdbId: $0.tmdbId,
                title: $0.title,
                originalTitle: $0.originalTitle,
                overview: $0.overview,
                releaseDate: $0.releaseDate,
                runtime: $0.runtime,
                posterPath: $0.posterPath,
                backdropPath: $0.backdropPath,
                voteAverage: $0.voteAverage,
                genresJSON: $0.genresJSON
            )
        }

        let userMovieDesc = FetchDescriptor<LocalUserMovie>()
        let allUserMovies = (try? context.fetch(userMovieDesc)) ?? []
        let userMovieDTOs = allUserMovies.map {
            UserMovieBackupDTO(
                id: $0.id,
                movieId: $0.movieId,
                status: $0.status,
                personalRating: $0.personalRating,
                notes: $0.notes,
                review: $0.review,
                isFavorite: $0.isFavorite,
                rewatchCount: $0.rewatchCount,
                addedAt: $0.addedAt,
                watchedAt: $0.watchedAt,
                scheduledAt: $0.scheduledAt
            )
        }

        let sessionDesc = FetchDescriptor<LocalWatchSession>()
        let allSessions = (try? context.fetch(sessionDesc)) ?? []
        let sessionDTOs = allSessions.map {
            SessionBackupDTO(
                id: $0.id,
                movieId: $0.movieId,
                startedAt: $0.startedAt,
                endedAt: $0.endedAt,
                completed: $0.completed,
                pausedDurationSeconds: $0.pausedDurationSeconds
            )
        }

        let collDesc = FetchDescriptor<LocalCollection>()
        let allColls = (try? context.fetch(collDesc)) ?? []
        let collDTOs = allColls.map {
            CollectionBackupDTO(
                id: $0.id,
                name: $0.name,
                description: $0.collectionDescription,
                sortOrder: $0.sortOrder,
                movieIdsJSON: $0.movieIdsJSON,
                createdAt: $0.createdAt
            )
        }

        let remDesc = FetchDescriptor<LocalReminder>()
        let allReminders = (try? context.fetch(remDesc)) ?? []
        let reminderDTOs = allReminders.map {
            ReminderBackupDTO(
                id: $0.id,
                movieId: $0.movieId,
                remindAt: $0.remindAt,
                preReminderMinutes: $0.preReminderMinutes,
                status: $0.status,
                notificationId: $0.notificationId
            )
        }

        let backup = PersonalCinemaBackup(
            version: 1,
            exportedAt: Date(),
            movies: movieDTOs,
            userMovies: userMovieDTOs,
            sessions: sessionDTOs,
            collections: collDTOs,
            reminders: reminderDTOs
        )

        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(backup), let json = String(data: data, encoding: .utf8) {
            return json
        }
        return "{}"
    }

    func restoreFromBackupJSON(_ jsonString: String) -> (success: Bool, importedCount: Int, message: String) {
        guard let data = jsonString.data(using: .utf8) else {
            return (false, 0, "Invalid JSON data.")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let backup = try? decoder.decode(PersonalCinemaBackup.self, from: data) else {
            return (false, 0, "Failed to decode backup archive. File might be corrupted.")
        }

        var importedCount = 0

        // 1. Restore Movie Cache
        for m in backup.movies {
            let tmdbId = m.tmdbId
            let desc = FetchDescriptor<LocalMovie>(predicate: #Predicate { $0.tmdbId == tmdbId })
            if (try? context.fetch(desc).first) == nil {
                let movie = LocalMovie(
                    tmdbId: m.tmdbId,
                    title: m.title,
                    originalTitle: m.originalTitle,
                    overview: m.overview,
                    releaseDate: m.releaseDate,
                    runtime: m.runtime,
                    posterPath: m.posterPath,
                    backdropPath: m.backdropPath,
                    voteAverage: m.voteAverage,
                    genresJSON: m.genresJSON,
                    lastUpdated: Date()
                )
                context.insert(movie)
            }
        }

        // 2. Restore User Movies (Avoid duplicate records)
        for um in backup.userMovies {
            let movieId = um.movieId
            let desc = FetchDescriptor<LocalUserMovie>(predicate: #Predicate { $0.movieId == movieId })
            if let existing = try? context.fetch(desc).first {
                // Update with backup if existing has no rating or notes
                if existing.personalRating == nil, let r = um.personalRating { existing.personalRating = r }
                if existing.notes == nil, let n = um.notes { existing.notes = n }
                if existing.review == nil, let rev = um.review { existing.review = rev }
                if um.isFavorite { existing.isFavorite = true }
                if existing.status == "watchlist" && um.status == "watched" {
                    existing.status = "watched"
                    existing.watchedAt = um.watchedAt
                }
            } else {
                let item = LocalUserMovie(
                    id: um.id,
                    movieId: um.movieId,
                    status: um.status,
                    personalRating: um.personalRating,
                    notes: um.notes,
                    review: um.review,
                    isFavorite: um.isFavorite,
                    rewatchCount: um.rewatchCount,
                    addedAt: um.addedAt,
                    watchedAt: um.watchedAt,
                    scheduledAt: um.scheduledAt
                )
                context.insert(item)
                importedCount += 1
            }
        }

        // 3. Restore Collections
        for c in backup.collections {
            let name = c.name
            let desc = FetchDescriptor<LocalCollection>(predicate: #Predicate { $0.name == name })
            if (try? context.fetch(desc).first) == nil {
                let coll = LocalCollection(
                    id: c.id,
                    name: c.name,
                    collectionDescription: c.description,
                    sortOrder: c.sortOrder,
                    movieIdsJSON: c.movieIdsJSON,
                    createdAt: c.createdAt
                )
                context.insert(coll)
            }
        }

        // 4. Restore Reminders
        for r in backup.reminders {
            let id = r.id
            let desc = FetchDescriptor<LocalReminder>(predicate: #Predicate { $0.id == id })
            if (try? context.fetch(desc).first) == nil {
                let rem = LocalReminder(
                    id: r.id,
                    movieId: r.movieId,
                    remindAt: r.remindAt,
                    preReminderMinutes: r.preReminderMinutes,
                    status: r.status,
                    notificationId: r.notificationId
                )
                context.insert(rem)
            }
        }

        try? context.save()
        return (true, importedCount, "Successfully restored library with \(importedCount) items.")
    }

    func clearAllData() {
        try? context.delete(model: LocalUserMovie.self)
        try? context.delete(model: LocalWatchSession.self)
        try? context.delete(model: LocalCollection.self)
        try? context.delete(model: LocalReminder.self)
        try? context.delete(model: LocalMovie.self)
        try? context.save()
    }
}

// MARK: - Backup DTOs
struct PersonalCinemaBackup: Codable {
    let version: Int
    let exportedAt: Date
    let movies: [MovieBackupDTO]
    let userMovies: [UserMovieBackupDTO]
    let sessions: [SessionBackupDTO]
    let collections: [CollectionBackupDTO]
    let reminders: [ReminderBackupDTO]
}

struct MovieBackupDTO: Codable {
    let tmdbId: Int
    let title: String
    let originalTitle: String?
    let overview: String?
    let releaseDate: String?
    let runtime: Int?
    let posterPath: String?
    let backdropPath: String?
    let voteAverage: Double
    let genresJSON: String
}

struct UserMovieBackupDTO: Codable {
    let id: String
    let movieId: Int
    let status: String
    let personalRating: Double?
    let notes: String?
    let review: String?
    let isFavorite: Bool
    let rewatchCount: Int
    let addedAt: Date
    let watchedAt: Date?
    let scheduledAt: Date?
}

struct SessionBackupDTO: Codable {
    let id: String
    let movieId: Int
    let startedAt: Date
    let endedAt: Date?
    let completed: Bool
    let pausedDurationSeconds: Int
}

struct CollectionBackupDTO: Codable {
    let id: String
    let name: String
    let description: String?
    let sortOrder: Int
    let movieIdsJSON: String
    let createdAt: Date
}

struct ReminderBackupDTO: Codable {
    let id: String
    let movieId: Int
    let remindAt: Date
    let preReminderMinutes: Int
    let status: String
    let notificationId: String?
}

