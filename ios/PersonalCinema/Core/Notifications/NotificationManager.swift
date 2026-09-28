// NotificationManager.swift - Personal Cinema Movie Night Scheduling & Reminders
import UserNotifications
import Foundation

final class NotificationManager {
    static let shared = NotificationManager()

    private init() {}

    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound, .badge])
            return granted
        } catch {
            return false
        }
    }

    func scheduleMovieNight(movie: MovieBrief, date: Date, reminderMinutes: Int) -> String {
        let id = UUID().uuidString
        let content = UNMutableNotificationContent()
        content.title = "🎬 Movie Night Tonight!"
        content.body = "Time to get cozy. You're watching \(movie.title)."
        content.sound = .default
        content.userInfo = [
            "movie_id": movie.id,
            "notification_type": "movie_night"
        ]

        let triggerDate = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerDate, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("NotificationManager: Scheduling error: \(error)")
            }
        }

        // Schedule pre-reminder (e.g. 30 minutes before)
        if reminderMinutes > 0 {
            let preDate = date.addingTimeInterval(-Double(reminderMinutes * 60))
            if preDate > Date() {
                _ = schedulePreReminder(movie: movie, date: preDate, minutesBefore: reminderMinutes)
            }
        }

        return id
    }

    func schedulePreReminder(movie: MovieBrief, date: Date, minutesBefore: Int) -> String {
        let id = UUID().uuidString
        let content = UNMutableNotificationContent()
        content.title = "⏰ Screening in \(minutesBefore) minutes"
        content.body = "\(movie.title) begins soon. Prepare your popcorn!"
        content.sound = .default
        content.userInfo = [
            "movie_id": movie.id,
            "notification_type": "pre_reminder"
        ]

        let triggerDate = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: date
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: triggerDate, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("NotificationManager: Pre-reminder error: \(error)")
            }
        }

        return id
    }

    func cancel(notificationID: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationID])
    }

    func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }

    func checkPendingNotifications() async -> [UNNotificationRequest] {
        await UNUserNotificationCenter.current().pendingNotificationRequests()
    }
}
