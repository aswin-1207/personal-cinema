// CalendarViewModel.swift - Personal Cinema Movie Night Scheduling & Calendar (Local-First)
import Foundation
import Observation

@Observable
final class CalendarViewModel {
    var reminders: [Reminder] = []
    var selectedDate: Date = Date()
    var watchHistory: [String: Int] = [:] // "yyyy-MM-dd" -> count
    var isLoading: Bool = false
    var showingScheduleSheet: Bool = false
    var errorMessage: String?

    var remindersForSelectedDate: [Reminder] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let selectedStr = formatter.string(from: selectedDate)
        return reminders.filter { reminder in
            guard let date = reminder.remindDate else { return false }
            return formatter.string(from: date) == selectedStr
        }
    }

    var upcomingReminders: [Reminder] {
        reminders
            .filter { $0.remindDate.map { $0 >= Date() } ?? false }
            .sorted { ($0.remindDate ?? Date()) < ($1.remindDate ?? Date()) }
    }

    @MainActor
    func load() async {
        isLoading = true
        errorMessage = nil

        reminders = DataManager.shared.getReminders()

        let calendarEntries = StatisticsService.shared.calculateWatchCalendar(months: 3)
        var dict: [String: Int] = [:]
        for entry in calendarEntries {
            dict[entry.date] = entry.count
        }
        watchHistory = dict

        isLoading = false
    }

    @MainActor
    func scheduleMovieNight(movieId: Int, movieBrief: MovieBrief, date: Date, reminderMinutes: Int) async {
        let notifId = NotificationManager.shared.scheduleMovieNight(
            movie: movieBrief, date: date, reminderMinutes: reminderMinutes
        )

        let reminder = DataManager.shared.scheduleReminder(
            movieId: movieId,
            movieBrief: movieBrief,
            remindAt: date,
            preReminderMinutes: reminderMinutes,
            notificationId: notifId
        )
        reminders.append(reminder)
        HapticManager.shared.success()
    }

    @MainActor
    func deleteReminder(id: String) async {
        if let notifId = reminders.first(where: { $0.id == id })?.notificationId {
            NotificationManager.shared.cancel(notificationID: notifId)
        }
        DataManager.shared.deleteReminder(id: id)
        reminders.removeAll { $0.id == id }
        HapticManager.shared.tap()
    }

    @MainActor
    func snoozeReminder(id: String, until: Date) async {
        guard let reminder = reminders.first(where: { $0.id == id }),
              let movie = reminder.movie else { return }
        await deleteReminder(id: id)
        await scheduleMovieNight(movieId: movie.id, movieBrief: movie, date: until, reminderMinutes: reminder.preReminderMinutes)
    }

    @MainActor
    func markWatchedFromReminder(reminder: Reminder) async {
        guard let movie = reminder.movie else { return }
        _ = DataManager.shared.markWatched(movieId: movie.id)
        await deleteReminder(id: reminder.id)
        HapticManager.shared.movieComplete()
        SoundManager.shared.play(.movieComplete)
        await load()
    }

    func watchedCount(for date: Date) -> Int {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return watchHistory[formatter.string(from: date)] ?? 0
    }

    func hasReminder(for date: Date) -> Bool {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)
        return reminders.contains { reminder in
            guard let d = reminder.remindDate else { return false }
            return formatter.string(from: d) == dateStr
        }
    }
}
