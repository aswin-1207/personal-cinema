import Foundation

// MARK: - Movie Models
struct MovieBrief: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let originalTitle: String?
    let overview: String?
    let releaseDate: String?
    let posterPath: String?
    let backdropPath: String?
    let voteAverage: Double
    let genreIds: [Int]?

    enum CodingKeys: String, CodingKey {
        case id, title, overview
        case originalTitle = "original_title"
        case releaseDate = "release_date"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case genreIds = "genre_ids"
    }

    var posterURL: URL? {
        guard let path = posterPath, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(path)")
    }

    var backdropURL: URL? {
        guard let path = backdropPath, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w780\(path)")
    }

    var releaseYear: String? {
        guard let date = releaseDate, date.count >= 4 else { return nil }
        return String(date.prefix(4))
    }
}

struct Genre: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
}

struct CastMember: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let character: String?
    let profilePath: String?

    enum CodingKeys: String, CodingKey {
        case id, name, character
        case profilePath = "profile_path"
    }

    var profileURL: URL? {
        guard let path = profilePath, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w185\(path)")
    }
}

struct CrewMember: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let job: String?
    let department: String?
    let profilePath: String?

    enum CodingKeys: String, CodingKey {
        case id, name, job, department
        case profilePath = "profile_path"
    }
}

struct MovieCredits: Codable, Hashable {
    let cast: [CastMember]
    let crew: [CrewMember]

    var director: CrewMember? {
        crew.first(where: { $0.job == "Director" })
    }
}

struct MovieDetail: Codable, Identifiable {
    let id: Int
    let title: String
    let originalTitle: String?
    let overview: String?
    let releaseDate: String?
    let runtime: Int?
    let posterPath: String?
    let backdropPath: String?
    let voteAverage: Double
    let voteCount: Int?
    let genres: [Genre]
    let credits: MovieCredits?
    let status: String?
    let tagline: String?
    let budget: Int?
    let revenue: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, overview, runtime, genres, credits, status, tagline, budget, revenue
        case originalTitle = "original_title"
        case releaseDate = "release_date"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case voteCount = "vote_count"
    }

    var posterURL: URL? {
        guard let path = posterPath, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w500\(path)")
    }

    var backdropURL: URL? {
        guard let path = backdropPath, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/w1280\(path)")
    }

    var releaseYear: String? {
        guard let date = releaseDate, date.count >= 4 else { return nil }
        return String(date.prefix(4))
    }

    var formattedRuntime: String? {
        guard let mins = runtime, mins > 0 else { return nil }
        let h = mins / 60
        let m = mins % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    var brief: MovieBrief {
        MovieBrief(
            id: id,
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
}

// MARK: - User Movie
struct UserMovieBrief: Codable, Identifiable {
    let id: String
    let movieId: String?
    let status: String
    let personalRating: Double?
    let notes: String?
    let review: String?
    let isFavorite: Bool
    let rewatchCount: Int
    let addedAt: String?
    let watchedAt: String?
    let scheduledAt: String?
    let movie: MovieBrief?

    enum CodingKeys: String, CodingKey {
        case id, status, notes, review, movie
        case movieId = "movie_id"
        case personalRating = "personal_rating"
        case isFavorite = "is_favorite"
        case rewatchCount = "rewatch_count"
        case addedAt = "added_at"
        case watchedAt = "watched_at"
        case scheduledAt = "scheduled_at"
    }
}

// MARK: - Collections
struct Collection: Codable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let sortOrder: String?
    let movieIds: [Int]
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case sortOrder = "sort_order"
        case movieIds = "movie_ids"
        case createdAt = "created_at"
    }
}

// MARK: - Watch Sessions
struct WatchSession: Codable, Identifiable {
    let id: String
    let movieId: String?
    let startedAt: String
    let endedAt: String?
    let completed: Bool
    let pausedDurationSeconds: Int

    enum CodingKeys: String, CodingKey {
        case id, completed
        case movieId = "movie_id"
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case pausedDurationSeconds = "paused_duration_seconds"
    }
}

// MARK: - Reminders
struct Reminder: Codable, Identifiable {
    let id: String
    let movieId: String?
    let remindAt: String
    let preReminderMinutes: Int
    let status: String
    let notificationId: String?
    let movie: MovieBrief?

    enum CodingKeys: String, CodingKey {
        case id, status, movie
        case movieId = "movie_id"
        case remindAt = "remind_at"
        case preReminderMinutes = "pre_reminder_minutes"
        case notificationId = "notification_id"
    }

    var remindDate: Date? {
        let formatter = ISO8601DateFormatter()
        return formatter.date(from: remindAt)
    }
}

// MARK: - Import
enum ImportItemStatus: String, Codable {
    case matched
    case needsReview = "needs_review"
    case noMatch = "no_match"
}

struct ImportItem: Codable, Identifiable {
    let id: String
    let rawText: String
    var confidence: Double?
    var status: ImportItemStatus
    var matchedMovie: MovieBrief?
    var candidates: [MovieBrief]?

    enum CodingKeys: String, CodingKey {
        case id, status, candidates
        case rawText = "raw_text"
        case confidence = "confidence_score"
        case matchedMovie = "matched_movie"
    }
}

struct ImportJob: Codable, Identifiable {
    let id: String
    let status: String
    let totalItems: Int?
    let processedItems: Int?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case totalItems = "total_detected"
        case processedItems = "total_imported"
        case createdAt = "created_at"
    }
}

struct ImportJobDetail: Codable {
    let job: ImportJob
    let items: [ImportItem]
}

// MARK: - Stats
struct StatsOverview: Codable {
    let totalMovies: Int
    let watchedMovies: Int
    let totalHours: Double
    let currentStreak: Int
    let longestStreak: Int
    let averageRating: Double?
    let favoriteGenre: String?

    enum CodingKeys: String, CodingKey {
        case totalMovies = "total_movies_library"
        case watchedMovies = "total_movies_watched"
        case totalHours = "total_hours_watched"
        case currentStreak = "current_streak"
        case longestStreak = "longest_streak"
        case averageRating = "average_personal_rating"
        case favoriteGenre = "favorite_genre"
    }
}

struct GenreStat: Codable, Identifiable {
    var id: String { name }
    let name: String
    let count: Int
    let percentage: Double

    enum CodingKeys: String, CodingKey {
        case name = "genre_name"
        case count
        case percentage
    }
}

struct WatchCalendarEntry: Codable {
    let date: String
    let count: Int
}

struct Achievement: Codable, Identifiable {
    let id: String
    let name: String
    let description: String
    let icon: String
    let unlockedAt: String?
    let progress: Double?
    let target: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case icon = "icon_name"
        case progress, target
        case unlockedAt = "unlocked_at"
    }

    var isUnlocked: Bool { unlockedAt != nil }
}

struct LibraryStats: Codable {
    let total: Int
    let watched: Int
    let watchlist: Int
    let totalHours: Double
    let currentStreak: Int

    enum CodingKeys: String, CodingKey {
        case total, watched, watchlist
        case totalHours = "total_hours"
        case currentStreak = "current_streak"
    }
}

// MARK: - Pagination
struct PaginatedResponse<T: Codable>: Codable {
    let items: [T]
    let total: Int
    let page: Int
    let size: Int
    let pages: Int

    enum CodingKeys: String, CodingKey {
        case items = "results"
        case total = "total_results"
        case page
        case pages = "total_pages"
        case size
    }

    init(items: [T], total: Int, page: Int = 1, size: Int = 20, pages: Int = 1) {
        self.items = items
        self.total = total
        self.page = page
        self.size = size
        self.pages = pages
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let results = try? container.decode([T].self, forKey: .items) {
            items = results
        } else {
            let altContainer = try decoder.container(keyedBy: AltKeys.self)
            items = (try? altContainer.decode([T].self, forKey: .altItems)) ?? []
        }
        total = (try? container.decode(Int.self, forKey: .total)) ?? items.count
        page = (try? container.decode(Int.self, forKey: .page)) ?? 1
        pages = (try? container.decode(Int.self, forKey: .pages)) ?? 1
        size = (try? container.decode(Int.self, forKey: .size)) ?? items.count
    }

    private enum AltKeys: String, CodingKey {
        case altItems = "items"
    }
}

// MARK: - Generic Empty Response
struct EmptyResponse: Codable {}


