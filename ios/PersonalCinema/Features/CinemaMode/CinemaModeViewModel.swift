// CinemaModeViewModel.swift - Personal Cinema Active Watching Session (Local-First)
import Foundation
import Observation
import SwiftUI

enum TimerState: Equatable {
    case idle
    case running
    case paused
    case completed
}

@Observable
final class CinemaModeViewModel {
    let movie: MovieBrief
    var scheduledDate: Date?
    var sessionId: String?
    var timerState: TimerState = .idle
    var startTime: Date?
    var pausedAt: Date?
    var totalPausedSeconds: Int = 0
    var isCompleted: Bool = false
    var errorMessage: String?

    private var timerTask: Task<Void, Never>?
    private var _elapsedSeconds: Int = 0

    var elapsedSeconds: Int {
        guard let start = startTime, timerState == .running else { return _elapsedSeconds }
        return Int(Date().timeIntervalSince(start)) - totalPausedSeconds
    }

    var remainingSeconds: Int {
        // Standard runtime fallback 2h (7200s) if not specified
        let runtimeSeconds = 7200
        return max(0, runtimeSeconds - elapsedSeconds)
    }

    var formattedRemaining: String {
        formatTime(remainingSeconds)
    }

    var formattedElapsed: String {
        formatTime(elapsedSeconds)
    }

    init(movie: MovieBrief, scheduledDate: Date? = nil) {
        self.movie = movie
        self.scheduledDate = scheduledDate
        restoreSession()
    }

    @MainActor
    func startSession() async {
        let session = DataManager.shared.startWatchSession(movieId: movie.id)
        sessionId = session.id
        startTime = Date()
        totalPausedSeconds = 0
        timerState = .running
        persistSession()
        startTick()
        HapticManager.shared.cinemaStart()
        SoundManager.shared.play(.cinemaStart)
    }

    func pauseSession() {
        guard timerState == .running else { return }
        pausedAt = Date()
        timerState = .paused
        timerTask?.cancel()
        timerTask = nil
        _elapsedSeconds = elapsedSeconds
        persistSession()
        HapticManager.shared.tap()
    }

    func resumeSession() {
        guard timerState == .paused, let pausedTime = pausedAt else { return }
        totalPausedSeconds += Int(Date().timeIntervalSince(pausedTime))
        pausedAt = nil
        timerState = .running
        persistSession()
        startTick()
        HapticManager.shared.confirm()
    }

    @MainActor
    func completeSession(rating: Double? = nil, notes: String? = nil) async {
        timerTask?.cancel()
        timerTask = nil

        if let id = sessionId {
            _ = DataManager.shared.completeWatchSession(sessionId: id, rating: rating, notes: notes)
        } else {
            _ = DataManager.shared.markWatched(movieId: movie.id, rating: rating, notes: notes)
        }

        timerState = .completed
        isCompleted = true
        clearPersistedSession()
        HapticManager.shared.movieComplete()
        SoundManager.shared.play(.movieComplete)
    }

    func stopSession() {
        timerTask?.cancel()
        timerTask = nil
        timerState = .idle
        clearPersistedSession()
    }

    private func startTick() {
        timerTask?.cancel()
        timerTask = Task {
            while !Task.isCancelled && timerState == .running {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if !Task.isCancelled {
                    _elapsedSeconds = elapsedSeconds
                    if remainingSeconds == 0 {
                        await completeSession()
                    }
                }
            }
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        let s = seconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    // MARK: - Persistence across app restarts
    private func persistSession() {
        UserDefaults.standard.set(sessionId, forKey: "cinema_session_id")
        UserDefaults.standard.set(movie.id, forKey: "cinema_movie_id")
        UserDefaults.standard.set(startTime?.timeIntervalSince1970, forKey: "cinema_start_time")
        UserDefaults.standard.set(totalPausedSeconds, forKey: "cinema_paused_seconds")
        UserDefaults.standard.set(pausedAt?.timeIntervalSince1970, forKey: "cinema_paused_at")
        UserDefaults.standard.set(timerState == .paused ? "paused" : "running", forKey: "cinema_timer_state")
    }

    private func restoreSession() {
        guard let storedSessionId = UserDefaults.standard.string(forKey: "cinema_session_id"),
              UserDefaults.standard.integer(forKey: "cinema_movie_id") == movie.id,
              let startTimestamp = UserDefaults.standard.object(forKey: "cinema_start_time") as? TimeInterval else {
            return
        }
        sessionId = storedSessionId
        startTime = Date(timeIntervalSince1970: startTimestamp)
        totalPausedSeconds = UserDefaults.standard.integer(forKey: "cinema_paused_seconds")

        let stateStr = UserDefaults.standard.string(forKey: "cinema_timer_state")
        if stateStr == "paused", let pausedTimestamp = UserDefaults.standard.object(forKey: "cinema_paused_at") as? TimeInterval {
            pausedAt = Date(timeIntervalSince1970: pausedTimestamp)
            timerState = .paused
            _elapsedSeconds = max(0, Int(pausedAt!.timeIntervalSince(startTime!)) - totalPausedSeconds)
        } else {
            timerState = .running
            startTick()
        }
    }

    private func clearPersistedSession() {
        UserDefaults.standard.removeObject(forKey: "cinema_session_id")
        UserDefaults.standard.removeObject(forKey: "cinema_movie_id")
        UserDefaults.standard.removeObject(forKey: "cinema_start_time")
        UserDefaults.standard.removeObject(forKey: "cinema_paused_seconds")
        UserDefaults.standard.removeObject(forKey: "cinema_paused_at")
        UserDefaults.standard.removeObject(forKey: "cinema_timer_state")
    }
}
