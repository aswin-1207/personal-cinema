// SwiftDataModels.swift - Local-First SwiftData Persistence
import Foundation
import SwiftData

@Model
final class LocalMovie {
    @Attribute(.unique) var tmdbId: Int
    var title: String
    var originalTitle: String?
    var overview: String?
    var releaseDate: String?
    var runtime: Int?
    var posterPath: String?
    var backdropPath: String?
    var voteAverage: Double
    var genresJSON: String // Encoded [Genre]
    var lastUpdated: Date

    init(
        tmdbId: Int,
        title: String,
        originalTitle: String? = nil,
        overview: String? = nil,
        releaseDate: String? = nil,
        runtime: Int? = nil,
        posterPath: String? = nil,
        backdropPath: String? = nil,
        voteAverage: Double = 0,
        genresJSON: String = "[]",
        lastUpdated: Date = Date()
    ) {
        self.tmdbId = tmdbId
        self.title = title
        self.originalTitle = originalTitle
        self.overview = overview
        self.releaseDate = releaseDate
        self.runtime = runtime
        self.posterPath = posterPath
        self.backdropPath = backdropPath
        self.voteAverage = voteAverage
        self.genresJSON = genresJSON
        self.lastUpdated = lastUpdated
    }

    var genres: [Genre] {
        get {
            guard let data = genresJSON.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([Genre].self, from: data)) ?? []
        }
        set {
            if let data = try? JSONEncoder().encode(newValue),
               let str = String(data: data, encoding: .utf8) {
                genresJSON = str
            }
        }
    }

    var brief: MovieBrief {
        MovieBrief(
            id: tmdbId,
            title: title,
            originalTitle: originalTitle,
            overview: overview,
            releaseDate: releaseDate,
            posterPath: posterPath,
            backdropPath: backdropPath,
            voteAverage: voteAverage,
            genreIds: genres.map { $0.id }
        )
    }

    convenience init(from brief: MovieBrief) {
        var genresJsonStr = "[]"
        if let genreIds = brief.genreIds {
            let mockGenres = genreIds.map { Genre(id: $0, name: "Genre \($0)") }
            if let data = try? JSONEncoder().encode(mockGenres),
               let str = String(data: data, encoding: .utf8) {
                genresJsonStr = str
            }
        }
        self.init(
            tmdbId: brief.id,
            title: brief.title,
            originalTitle: brief.originalTitle,
            overview: brief.overview,
            releaseDate: brief.releaseDate,
            runtime: nil,
            posterPath: brief.posterPath,
            backdropPath: brief.backdropPath,
            voteAverage: brief.voteAverage,
            genresJSON: genresJsonStr,
            lastUpdated: Date()
        )
    }

    convenience init(from detail: MovieDetail) {
        var genresJsonStr = "[]"
        if let data = try? JSONEncoder().encode(detail.genres),
           let str = String(data: data, encoding: .utf8) {
            genresJsonStr = str
        }
        self.init(
            tmdbId: detail.id,
            title: detail.title,
            originalTitle: detail.originalTitle,
            overview: detail.overview,
            releaseDate: detail.releaseDate,
            runtime: detail.runtime,
            posterPath: detail.posterPath,
            backdropPath: detail.backdropPath,
            voteAverage: detail.voteAverage,
            genresJSON: genresJsonStr,
            lastUpdated: Date()
        )
    }
}

@Model
final class LocalUserMovie {
    @Attribute(.unique) var id: String
    var movieId: Int
    var status: String // "watchlist", "watching", "watched", "dropped"
    var personalRating: Double?
    var notes: String?
    var review: String?
    var isFavorite: Bool
    var rewatchCount: Int
    var addedAt: Date
    var watchedAt: Date?
    var scheduledAt: Date?

    init(
        id: String = UUID().uuidString,
        movieId: Int,
        status: String = "watchlist",
        personalRating: Double? = nil,
        notes: String? = nil,
        review: String? = nil,
        isFavorite: Bool = false,
        rewatchCount: Int = 0,
        addedAt: Date = Date(),
        watchedAt: Date? = nil,
        scheduledAt: Date? = nil
    ) {
        self.id = id
        self.movieId = movieId
        self.status = status
        self.personalRating = personalRating
        self.notes = notes
        self.review = review
        self.isFavorite = isFavorite
        self.rewatchCount = rewatchCount
        self.addedAt = addedAt
        self.watchedAt = watchedAt
        self.scheduledAt = scheduledAt
    }

    func toUserMovieBrief(movie: MovieBrief? = nil) -> UserMovieBrief {
        let formatter = ISO8601DateFormatter()
        return UserMovieBrief(
            id: id,
            movieId: String(movieId),
            status: status,
            personalRating: personalRating,
            notes: notes,
            review: review,
            isFavorite: isFavorite,
            rewatchCount: rewatchCount,
            addedAt: formatter.string(from: addedAt),
            watchedAt: watchedAt.map { formatter.string(from: $0) },
            scheduledAt: scheduledAt.map { formatter.string(from: $0) },
            movie: movie
        )
    }
}

@Model
final class LocalWatchSession {
    @Attribute(.unique) var id: String
    var movieId: Int
    var startedAt: Date
    var endedAt: Date?
    var completed: Bool
    var pausedDurationSeconds: Int

    init(
        id: String = UUID().uuidString,
        movieId: Int,
        startedAt: Date = Date(),
        endedAt: Date? = nil,
        completed: Bool = false,
        pausedDurationSeconds: Int = 0
    ) {
        self.id = id
        self.movieId = movieId
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.completed = completed
        self.pausedDurationSeconds = pausedDurationSeconds
    }

    func toWatchSession() -> WatchSession {
        let formatter = ISO8601DateFormatter()
        return WatchSession(
            id: id,
            movieId: String(movieId),
            startedAt: formatter.string(from: startedAt),
            endedAt: endedAt.map { formatter.string(from: $0) },
            completed: completed,
            pausedDurationSeconds: pausedDurationSeconds
        )
    }
}

@Model
final class LocalCollection {
    @Attribute(.unique) var id: String
    var name: String
    var collectionDescription: String?
    var sortOrder: Int
    var movieIdsJSON: String
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        name: String,
        collectionDescription: String? = nil,
        sortOrder: Int = 0,
        movieIdsJSON: String = "[]",
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.collectionDescription = collectionDescription
        self.sortOrder = sortOrder
        self.movieIdsJSON = movieIdsJSON
        self.createdAt = createdAt
    }

    var movieIds: [Int] {
        get {
            guard let data = movieIdsJSON.data(using: .utf8) else { return [] }
            return (try? JSONDecoder().decode([Int].self, from: data)) ?? []
        }
        set {
            if let data = try? JSONEncoder().encode(newValue),
               let str = String(data: data, encoding: .utf8) {
                movieIdsJSON = str
            }
        }
    }

    func toCollection() -> Collection {
        let formatter = ISO8601DateFormatter()
        return Collection(
            id: id,
            name: name,
            description: collectionDescription,
            sortOrder: String(sortOrder),
            movieIds: movieIds,
            createdAt: formatter.string(from: createdAt)
        )
    }
}

@Model
final class LocalReminder {
    @Attribute(.unique) var id: String
    var movieId: Int
    var remindAt: Date
    var preReminderMinutes: Int
    var status: String // "pending", "sent", "cancelled"
    var notificationId: String?

    init(
        id: String = UUID().uuidString,
        movieId: Int,
        remindAt: Date,
        preReminderMinutes: Int = 30,
        status: String = "pending",
        notificationId: String? = nil
    ) {
        self.id = id
        self.movieId = movieId
        self.remindAt = remindAt
        self.preReminderMinutes = preReminderMinutes
        self.status = status
        self.notificationId = notificationId
    }

    func toReminder(movie: MovieBrief? = nil) -> Reminder {
        let formatter = ISO8601DateFormatter()
        return Reminder(
            id: id,
            movieId: String(movieId),
            remindAt: formatter.string(from: remindAt),
            preReminderMinutes: preReminderMinutes,
            status: status,
            notificationId: notificationId,
            movie: movie
        )
    }
}
