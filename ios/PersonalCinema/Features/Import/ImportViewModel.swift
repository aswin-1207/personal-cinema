// ImportViewModel.swift - Personal Cinema Universal Movie Importer (Local Device Processing)
import Foundation
import Observation

enum ImportStep {
    case idle
    case processing
    case review
    case committing
    case done
}

@Observable
final class ImportViewModel {
    var items: [ImportItem] = []
    var isLoading: Bool = false
    var errorMessage: String?
    var step: ImportStep = .idle
    var committedCount: Int = 0

    // MARK: - Import Text / Clipboard
    func processText(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        step = .processing
        isLoading = true
        errorMessage = nil

        let lines = trimmed.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        await matchLines(lines)
    }

    // MARK: - Import File (CSV, TXT)
    func processFile(url: URL) async {
        step = .processing
        isLoading = true
        errorMessage = nil

        do {
            let shouldStopAccessing = url.startAccessingSecurityScopedResource()
            defer { if shouldStopAccessing { url.stopAccessingSecurityScopedResource() } }

            let content = try String(contentsOf: url, encoding: .utf8)
            let lines = content.components(separatedBy: .newlines)
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }

            // If CSV with headers, skip first line if it contains common headers
            var candidateLines = lines
            if let first = candidateLines.first?.lowercased(),
               first.contains("title") || first.contains("name") {
                candidateLines.removeFirst()
            }

            await matchLines(candidateLines)
        } catch {
            errorMessage = "Failed to read file: \(error.localizedDescription)"
            step = .idle
            isLoading = false
        }
    }

    // MARK: - TMDB Matching Logic
    private func matchLines(_ lines: [String]) async {
        var parsedItems: [ImportItem] = []

        for rawLine in lines {
            let cleanQuery = sanitizeMovieTitle(rawLine)
            guard !cleanQuery.isEmpty else { continue }

            do {
                let candidates = try await TMDBService.shared.searchMovies(query: cleanQuery, page: 1)
                if let bestMatch = candidates.first {
                    parsedItems.append(ImportItem(
                        id: UUID().uuidString,
                        rawText: rawLine,
                        confidence: 0.95,
                        status: .matched,
                        matchedMovie: bestMatch,
                        candidates: candidates
                    ))
                } else {
                    parsedItems.append(ImportItem(
                        id: UUID().uuidString,
                        rawText: rawLine,
                        confidence: 0.0,
                        status: .noMatch,
                        matchedMovie: nil,
                        candidates: []
                    ))
                }
            } catch {
                parsedItems.append(ImportItem(
                    id: UUID().uuidString,
                    rawText: rawLine,
                    confidence: 0.0,
                    status: .noMatch,
                    matchedMovie: nil,
                    candidates: []
                ))
            }
        }

        items = parsedItems
        step = .review
        isLoading = false
    }

    func updateMatchedMovie(itemId: String, movie: MovieBrief) {
        if let idx = items.firstIndex(where: { $0.id == itemId }) {
            items[idx].matchedMovie = movie
            items[idx].status = .matched
            items[idx].confidence = 1.0
        }
    }

    @MainActor
    func commitImport(asWatched: Bool = false) async {
        step = .committing
        isLoading = true

        var count = 0
        for item in items {
            guard let movie = item.matchedMovie else { continue }
            if asWatched {
                _ = DataManager.shared.markWatched(movieId: movie.id)
            } else {
                _ = DataManager.shared.addToWatchlist(movie: movie)
            }
            count += 1
        }

        committedCount = count
        step = .done
        isLoading = false
        HapticManager.shared.success()
        SoundManager.shared.play(.confirm)
    }

    func reset() {
        step = .idle
        items = []
        errorMessage = nil
        committedCount = 0
    }

    private func sanitizeMovieTitle(_ raw: String) -> String {
        var clean = raw
        // Strip leading numbering like "1. ", "12) "
        if let regex = try? NSRegularExpression(pattern: "^[0-9]+[\\.\\)\\-\\s]+") {
            let range = NSRange(location: 0, length: clean.utf16.count)
            clean = regex.stringByReplacingMatches(in: clean, options: [], range: range, withTemplate: "")
        }
        // Strip trailing years in parenthesis like "(2014)"
        if let yearRegex = try? NSRegularExpression(pattern: "\\s*\\([0-9]{4}\\)") {
            let range = NSRange(location: 0, length: clean.utf16.count)
            clean = yearRegex.stringByReplacingMatches(in: clean, options: [], range: range, withTemplate: "")
        }
        return clean.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
