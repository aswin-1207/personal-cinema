// TMDBService.swift - Direct Native TMDB API Client
import Foundation

enum TMDBError: LocalizedError {
    case invalidURL
    case invalidResponse(Int)
    case decodingError(Error)
    case networkError(Error)
    case missingAPIKey

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid TMDB request URL."
        case .invalidResponse(let statusCode):
            return "TMDB API returned error code: \(statusCode)."
        case .decodingError(let error):
            return "Failed to parse movie data: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network connection error: \(error.localizedDescription)"
        case .missingAPIKey:
            return "TMDB API key is not configured. Please add it in Profile Settings."
        }
    }
}

// MARK: - TMDB Raw Responses
private struct TMDBPaginatedResult<T: Codable>: Codable {
    let page: Int?
    let results: [T]
    let totalPages: Int?
    let totalResults: Int?

    enum CodingKeys: String, CodingKey {
        case page, results
        case totalPages = "total_pages"
        case totalResults = "total_results"
    }
}

private struct TMDBGenreListResponse: Codable {
    let genres: [Genre]
}

@Observable
final class TMDBService {
    static let shared = TMDBService()

    private let baseURL = "https://api.themoviedb.org/3"
    private let session: URLSession

    // Cache responses in memory to support swift navigation and offline resilience
    private let cache = NSCache<NSString, AnyObject>()

    // Users can customize the API key in Settings, or use default
    var apiKey: String {
        get {
            if let customKey = UserDefaults.standard.string(forKey: "tmdb_api_key"),
               !customKey.trimmingCharacters(in: .whitespaces).isEmpty {
                return customKey
            }
            // Default public demonstration key for TMDB v3
            return "2c46288716a18fb7accc2a8069e501b0"
        }
        set {
            UserDefaults.standard.set(newValue.trimmingCharacters(in: .whitespaces), forKey: "tmdb_api_key")
        }
    }

    init(session: URLSession = .shared) {
        self.session = session
        cache.countLimit = 250
    }

    // MARK: - Core Fetch Method
    private func fetch<T: Decodable>(endpoint: String, queryItems: [URLQueryItem] = []) async throws -> T {
        guard var components = URLComponents(string: "\(baseURL)\(endpoint)") else {
            throw TMDBError.invalidURL
        }

        var items = [
            URLQueryItem(name: "api_key", value: apiKey),
            URLQueryItem(name: "language", value: "en-US")
        ]
        items.append(contentsOf: queryItems)
        components.queryItems = items

        guard let url = components.url else {
            throw TMDBError.invalidURL
        }

        let cacheKey = NSString(string: url.absoluteString)
        if let cachedData = cache.object(forKey: cacheKey) as? Data {
            if let decoded = try? JSONDecoder().decode(T.self, from: cachedData) {
                return decoded
            }
        }

        do {
            let (data, response) = try await session.data(from: url)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TMDBError.invalidResponse(0)
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                throw TMDBError.invalidResponse(httpResponse.statusCode)
            }

            let decoded = try JSONDecoder().decode(T.self, from: data)
            cache.setObject(data as AnyObject, forKey: cacheKey)
            return decoded
        } catch let error as TMDBError {
            throw error
        } catch let error as DecodingError {
            throw TMDBError.decodingError(error)
        } catch {
            throw TMDBError.networkError(error)
        }
    }

    // MARK: - Public Movie APIs

    func searchMovies(query: String, page: Int = 1) async throws -> [MovieBrief] {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return [] }

        let response: TMDBPaginatedResult<MovieBrief> = try await fetch(
            endpoint: "/search/movie",
            queryItems: [
                URLQueryItem(name: "query", value: trimmed),
                URLQueryItem(name: "page", value: String(page)),
                URLQueryItem(name: "include_adult", value: "false")
            ]
        )
        return response.results
    }

    func getTrending(timeWindow: String = "week", page: Int = 1) async throws -> [MovieBrief] {
        let response: TMDBPaginatedResult<MovieBrief> = try await fetch(
            endpoint: "/trending/movie/\(timeWindow)",
            queryItems: [URLQueryItem(name: "page", value: String(page))]
        )
        return response.results
    }

    func getPopular(page: Int = 1) async throws -> [MovieBrief] {
        let response: TMDBPaginatedResult<MovieBrief> = try await fetch(
            endpoint: "/movie/popular",
            queryItems: [URLQueryItem(name: "page", value: String(page))]
        )
        return response.results
    }

    func getDiscover(genreIds: [Int]? = nil, year: Int? = nil, sortBy: String = "popularity.desc", page: Int = 1) async throws -> [MovieBrief] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "sort_by", value: sortBy),
            URLQueryItem(name: "include_adult", value: "false"),
            URLQueryItem(name: "page", value: String(page))
        ]

        if let genreIds = genreIds, !genreIds.isEmpty {
            let idsString = genreIds.map { String($0) }.joined(separator: ",")
            queryItems.append(URLQueryItem(name: "with_genres", value: idsString))
        }

        if let year = year {
            queryItems.append(URLQueryItem(name: "primary_release_year", value: String(year)))
        }

        let response: TMDBPaginatedResult<MovieBrief> = try await fetch(
            endpoint: "/discover/movie",
            queryItems: queryItems
        )
        return response.results
    }

    func getMovieDetails(tmdbId: Int) async throws -> MovieDetail {
        let detail: MovieDetail = try await fetch(
            endpoint: "/movie/\(tmdbId)",
            queryItems: [URLQueryItem(name: "append_to_response", value: "credits")]
        )
        return detail
    }

    func getSimilar(tmdbId: Int, page: Int = 1) async throws -> [MovieBrief] {
        let response: TMDBPaginatedResult<MovieBrief> = try await fetch(
            endpoint: "/movie/\(tmdbId)/similar",
            queryItems: [URLQueryItem(name: "page", value: String(page))]
        )
        return response.results
    }

    func getRecommendations(forGenreIds genreIds: [Int]) async throws -> [MovieBrief] {
        guard !genreIds.isEmpty else {
            return try await getPopular(page: 1)
        }
        return try await getDiscover(genreIds: Array(genreIds.prefix(2)), sortBy: "vote_average.desc", page: 1)
    }

    func getGenres() async throws -> [Genre] {
        let response: TMDBGenreListResponse = try await fetch(endpoint: "/genre/movie/list")
        return response.genres
    }
}
