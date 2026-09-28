// CalendarView.swift - Personal Cinema Calendar & Movie Nights
import SwiftUI

struct CalendarView: View {
    @State private var viewModel = CalendarViewModel()
    @State private var showingScheduleSheet = false
    @State private var scheduleDate = Date().addingTimeInterval(3600)
    @State private var scheduleReminderMinutes = 30

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            ScrollView {
                VStack(spacing: CinemaSpacing.lg) {
                    // Header
                    HStack {
                        Text("CINEMA CALENDAR")
                            .font(.cinemaH2)
                            .foregroundColor(.cinemaWhite)
                        Spacer()
                    }
                    .padding(.horizontal, CinemaSpacing.md)
                    .padding(.top, CinemaSpacing.md)

                    // Month Calendar Grid Card
                    calendarGrid
                        .padding(.horizontal, CinemaSpacing.md)
                        .cinemaCard()
                        .padding(.horizontal, CinemaSpacing.md)

                    // Selected Date Reminders / Events
                    if !viewModel.remindersForSelectedDate.isEmpty {
                        VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
                            Text(viewModel.selectedDate.formatted(date: .complete, time: .omitted).uppercased())
                                .font(.cinemaLabel)
                                .foregroundColor(.cinemaSubtle)
                                .kerning(1.5)
                                .padding(.horizontal, CinemaSpacing.md)

                            ForEach(viewModel.remindersForSelectedDate) { reminder in
                                reminderCard(reminder: reminder)
                            }
                        }
                    }

                    // Upcoming Screenings Section
                    if !viewModel.upcomingReminders.isEmpty {
                        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                            Text("UPCOMING MOVIE NIGHTS")
                                .font(.cinemaLabel)
                                .foregroundColor(.cinemaSubtle)
                                .kerning(1.5)
                                .padding(.horizontal, CinemaSpacing.md)

                            ForEach(viewModel.upcomingReminders) { reminder in
                                reminderCard(reminder: reminder)
                            }
                        }
                    } else if !viewModel.isLoading {
                        EmptyStateView(
                            icon: "calendar.badge.clock",
                            title: "No Movie Nights Scheduled",
                            subtitle: "Pick any film from your library or discover page to plan your next movie night."
                        )
                        .frame(height: 240)
                    }

                    Spacer(minLength: CinemaSpacing.xxl)
                }
            }
        }
        .navigationBarHidden(true)
        .task { await viewModel.load() }
    }

    // MARK: - Calendar Grid
    private var calendarGrid: some View {
        VStack(spacing: CinemaSpacing.sm) {
            // Month Switcher Header
            HStack {
                Button {
                    viewModel.selectedDate = Calendar.current.date(byAdding: .month, value: -1, to: viewModel.selectedDate) ?? viewModel.selectedDate
                    HapticManager.shared.tap()
                } label: {
                    Image(systemName: "chevron.left").foregroundColor(.cinemaGold)
                }

                Spacer()

                Text(viewModel.selectedDate.formatted(.dateTime.month(.wide).year()))
                    .font(.cinemaH3)
                    .foregroundColor(.cinemaWhite)

                Spacer()

                Button {
                    viewModel.selectedDate = Calendar.current.date(byAdding: .month, value: 1, to: viewModel.selectedDate) ?? viewModel.selectedDate
                    HapticManager.shared.tap()
                } label: {
                    Image(systemName: "chevron.right").foregroundColor(.cinemaGold)
                }
            }
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.top, CinemaSpacing.md)

            // Day of Week Headers
            HStack {
                ForEach(["S","M","T","W","T","F","S"], id: \.self) { day in
                    Text(day)
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, CinemaSpacing.sm)

            // Days Grid
            let days = calendarDays(for: viewModel.selectedDate)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: CinemaSpacing.sm) {
                ForEach(days.indices, id: \.self) { idx in
                    let day = days[idx]
                    if let date = day {
                        dayCell(date: date)
                    } else {
                        Color.clear.frame(height: 38)
                    }
                }
            }
            .padding(.horizontal, CinemaSpacing.sm)
            .padding(.bottom, CinemaSpacing.md)
        }
    }

    @ViewBuilder
    private func dayCell(date: Date) -> some View {
        let isToday = Calendar.current.isDateInToday(date)
        let isSelected = Calendar.current.isDate(date, inSameDayAs: viewModel.selectedDate)
        let watchedCount = viewModel.watchedCount(for: date)
        let hasReminder = viewModel.hasReminder(for: date)

        Button {
            viewModel.selectedDate = date
            HapticManager.shared.selection()
        } label: {
            VStack(spacing: 2) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.cinemaCaption)
                    .foregroundColor(isSelected ? .cinemaBlack : (isToday ? .cinemaGold : .cinemaWhite))
                    .frame(width: 30, height: 30)
                    .background(
                        Group {
                            if isSelected {
                                Color.cinemaGold
                            } else if isToday {
                                Color.cinemaGold.opacity(0.18)
                            } else {
                                Color.clear
                            }
                        }
                    )
                    .clipShape(Circle())

                // Indicator Dots: Gold = watched, Crimson = scheduled
                HStack(spacing: 2) {
                    if watchedCount > 0 {
                        Circle().fill(Color.cinemaGold).frame(width: 4, height: 4)
                    }
                    if hasReminder {
                        Circle().fill(Color.cinemaCrimsonSoft).frame(width: 4, height: 4)
                    }
                }
                .frame(height: 4)
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func reminderCard(reminder: Reminder) -> some View {
        HStack(spacing: CinemaSpacing.md) {
            if let movie = reminder.movie {
                AsyncImage(url: movie.posterURL) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    Color.cinemaCharcoal
                }
                .frame(width: 45, height: 68)
                .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
            }

            VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                Text(reminder.movie?.title ?? "Movie Screening")
                    .font(.cinemaBodyMedium)
                    .foregroundColor(.cinemaWhite)
                    .lineLimit(1)

                if let date = reminder.remindDate {
                    Text(date.formatted(date: .abbreviated, time: .shortened))
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaGold)
                }

                Text("Alert \(reminder.preReminderMinutes)m before screening")
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaSubtle)
            }

            Spacer()

            WatchedControl(
                isWatched: .constant(false),
                style: .iconOnly,
                onWatched: {
                    Task { await viewModel.markWatchedFromReminder(reminder: reminder) }
                }
            )

            VStack(spacing: CinemaSpacing.md) {
                Button {
                    Task { await viewModel.deleteReminder(id: reminder.id) }
                } label: {
                    Image(systemName: "xmark.circle")
                        .foregroundColor(.cinemaSubtle)
                }

                Button {
                    let snoozeDate = Date().addingTimeInterval(3600)
                    Task { await viewModel.snoozeReminder(id: reminder.id, until: snoozeDate) }
                } label: {
                    Image(systemName: "clock.arrow.circlepath")
                        .foregroundColor(.cinemaGold)
                }
            }
        }
        .padding(CinemaSpacing.md)
        .cinemaCard()
        .padding(.horizontal, CinemaSpacing.md)
    }

    private func calendarDays(for date: Date) -> [Date?] {
        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: calendar.dateComponents([.year, .month], from: date)),
              let range = calendar.range(of: .day, in: .month, for: monthStart) else { return [] }

        let firstWeekday = calendar.component(.weekday, from: monthStart) - 1
        var days: [Date?] = Array(repeating: nil, count: firstWeekday)

        for day in range {
            if let dayDate = calendar.date(byAdding: .day, value: day - 1, to: monthStart) {
                days.append(dayDate)
            }
        }

        while days.count % 7 != 0 { days.append(nil) }
        return days
    }
}
