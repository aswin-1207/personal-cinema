// ProfileView.swift - Personal Cinema Profile & Settings (Local-First)
import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()
    @State private var showingAPIKeySheet = false
    @State private var showingClearConfirmation = false
    @State private var showingExportSheet = false
    @State private var exportedData = ""
    @State private var tempAPIKey = ""

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            ScrollView {
                VStack(spacing: CinemaSpacing.xl) {
                    // Header Wordmark & Avatar
                    profileHeader

                    // 2x2 Stats Grid
                    if let stats = viewModel.stats {
                        statsGrid(stats: stats)
                    }

                    // Genre Breakdown Chart
                    if !viewModel.genreStats.isEmpty {
                        genreBreakdown
                    }

                    // Achievements Shelf
                    if !viewModel.achievements.isEmpty {
                        achievementsSection
                    }

                    // Recently Watched Carousel
                    if !viewModel.recentWatches.isEmpty {
                        recentWatchesSection
                    }

                    // Action & Setting Buttons
                    actionButtons

                    Spacer(minLength: CinemaSpacing.xxl)
                }
                .padding(.top, CinemaSpacing.md)
            }
        }
        .navigationBarHidden(true)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .sheet(isPresented: $showingAPIKeySheet) {
            apiKeySheet
        }
        .sheet(isPresented: $showingExportSheet) {
            exportSheet
        }
        .confirmationDialog(
            "Clear Entire Library?",
            isPresented: $showingClearConfirmation,
            titleVisibility: .visible
        ) {
            Button("Erase All Movies & History", role: .destructive) {
                viewModel.clearAllData()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This will permanently remove all your watchlist items, watched logs, ratings, and custom collections stored on this device.")
        }
    }

    private var profileHeader: some View {
        VStack(spacing: CinemaSpacing.sm) {
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.cinemaGold.opacity(0.3), Color.cinemaAmber.opacity(0.15)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)

                Image(systemName: "film.stack.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.cinemaGold)
            }

            Text("PERSONAL CINEMA ARCHIVE")
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(3)

            Text("Your Private Film Sanctuary")
                .font(.cinemaH3)
                .foregroundColor(.cinemaWhite)
        }
        .padding(.horizontal, CinemaSpacing.md)
    }

    @ViewBuilder
    private func statsGrid(stats: StatsOverview) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: CinemaSpacing.sm) {
            statCard(value: "\(stats.watchedMovies)", label: "Films Watched", icon: "film")
            statCard(value: String(format: "%.0f", stats.totalHours), label: "Hours Watched", icon: "clock")
            statCard(value: "\(stats.currentStreak)d", label: "Current Streak", icon: "flame.fill")
            statCard(value: stats.averageRating.map { String(format: "%.1f", $0) } ?? "—", label: "Average Rating", icon: "star.fill")
        }
        .padding(.horizontal, CinemaSpacing.md)
    }

    @ViewBuilder
    private func statCard(value: String, label: String, icon: String) -> some View {
        VStack(spacing: CinemaSpacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.cinemaGold)
            Text(value)
                .font(.cinemaH2)
                .foregroundColor(.cinemaWhite)
            Text(label)
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(CinemaSpacing.lg)
        .cinemaCard()
    }

    private var genreBreakdown: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            Text("GENRE BREAKDOWN")
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(1.5)
                .padding(.horizontal, CinemaSpacing.md)

            VStack(spacing: CinemaSpacing.sm) {
                ForEach(viewModel.genreStats.prefix(6)) { genre in
                    genreBar(genre: genre)
                }
            }
            .padding(.horizontal, CinemaSpacing.md)
        }
    }

    @ViewBuilder
    private func genreBar(genre: GenreStat) -> some View {
        VStack(spacing: CinemaSpacing.xs) {
            HStack {
                Text(genre.name)
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaWhite)
                Spacer()
                Text("\(genre.count) films (\(Int(genre.percentage))%)")
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaSubtle)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: CinemaRadius.pill)
                        .fill(Color.cinemaSurface)
                        .frame(height: 6)

                    RoundedRectangle(cornerRadius: CinemaRadius.pill)
                        .fill(
                            LinearGradient(
                                colors: [Color.cinemaGold, Color.cinemaAmber],
                                startPoint: .leading, endPoint: .trailing
                            )
                        )
                        .frame(width: geo.size.width * CGFloat(genre.percentage / 100), height: 6)
                }
            }
            .frame(height: 6)
        }
    }

    private var achievementsSection: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            Text("CINEMA ACHIEVEMENTS")
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(1.5)
                .padding(.horizontal, CinemaSpacing.md)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: CinemaSpacing.md) {
                    ForEach(viewModel.achievements) { achievement in
                        achievementBadge(achievement: achievement)
                    }
                }
                .padding(.horizontal, CinemaSpacing.md)
            }
        }
    }

    @ViewBuilder
    private func achievementBadge(achievement: Achievement) -> some View {
        VStack(spacing: CinemaSpacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: CinemaRadius.md)
                    .fill(achievement.isUnlocked ? Color.cinemaGold.opacity(0.18) : Color.cinemaSurface)
                    .frame(width: 72, height: 72)
                    .overlay(
                        RoundedRectangle(cornerRadius: CinemaRadius.md)
                            .strokeBorder(
                                achievement.isUnlocked ? Color.cinemaGold.opacity(0.5) : Color.white.opacity(0.06),
                                lineWidth: 0.8
                            )
                    )

                Image(systemName: achievement.icon)
                    .font(.system(size: 28))
                    .foregroundColor(achievement.isUnlocked ? .cinemaGold : .cinemaSubtle)

                if !achievement.isUnlocked {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.cinemaSubtle)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(6)
                }
            }

            Text(achievement.name)
                .font(.cinemaLabel)
                .foregroundColor(achievement.isUnlocked ? .cinemaWhite : .cinemaSubtle)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(width: 72)
        }
    }

    private var recentWatchesSection: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            Text("RECENT SCREENINGS")
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(1.5)
                .padding(.horizontal, CinemaSpacing.md)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: CinemaSpacing.md) {
                    ForEach(viewModel.recentWatches) { item in
                        if let movie = item.movie {
                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                MovieCard(movie: movie, size: .small)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, CinemaSpacing.md)
            }
        }
    }

    private var actionButtons: some View {
        VStack(spacing: CinemaSpacing.sm) {
            // Import Movie List
            NavigationLink(destination: ImportView()) {
                HStack {
                    Image(systemName: "square.and.arrow.down")
                        .foregroundColor(.cinemaGold)
                    Text("Import Movie List (CSV, Notes, Text)")
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.cinemaSubtle)
                }
                .padding(CinemaSpacing.md)
                .cinemaCard()
            }
            .buttonStyle(.plain)
            .foregroundColor(.cinemaWhite)
            .padding(.horizontal, CinemaSpacing.md)

            // Export CSV
            Button {
                exportedData = viewModel.exportFullBackupJSON()
                showingExportSheet = true
            } label: {
                HStack {
                    Image(systemName: "arrow.down.doc.fill")
                        .foregroundColor(.cinemaGold)
                    Text("Backup Library Archive (JSON)")
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.cinemaSubtle)
                }
                .padding(CinemaSpacing.md)
                .cinemaCard()
            }
            .buttonStyle(.plain)
            .foregroundColor(.cinemaWhite)
            .padding(.horizontal, CinemaSpacing.md)

            // TMDB API Key Setting
            Button {
                tempAPIKey = viewModel.tmdbApiKey
                showingAPIKeySheet = true
            } label: {
                HStack {
                    Image(systemName: "key.fill")
                        .foregroundColor(.cinemaGold)
                    Text("TMDB API Key Settings")
                    Spacer()
                    Image(systemName: "chevron.right").foregroundColor(.cinemaSubtle)
                }
                .padding(CinemaSpacing.md)
                .cinemaCard()
            }
            .buttonStyle(.plain)
            .foregroundColor(.cinemaWhite)
            .padding(.horizontal, CinemaSpacing.md)

            // Clear All Data
            Button {
                showingClearConfirmation = true
            } label: {
                Text("Erase Local Archive")
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
            }
            .buttonStyle(CinemaButtonStyle(variant: .ghost))
            .foregroundColor(.cinemaCrimsonSoft)
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.top, CinemaSpacing.sm)
        }
    }

    private var apiKeySheet: some View {
        NavigationStack {
            ZStack {
                Color.cinemaBlack.ignoresSafeArea()

                VStack(alignment: .leading, spacing: CinemaSpacing.lg) {
                    Text("TMDB API Configuration")
                        .font(.cinemaH2)
                        .foregroundColor(.cinemaWhite)

                    Text("Personal Cinema connects directly to The Movie Database (TMDB) from your device. A demo key is already active, but you can enter your personal TMDB API v3 key here.")
                        .font(.cinemaBody)
                        .foregroundColor(.cinemaSilver)

                    VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                        Text("API KEY (v3)")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaSubtle)

                        TextField("Enter TMDB API Key", text: $tempAPIKey)
                            .textFieldStyle(.plain)
                            .padding(CinemaSpacing.md)
                            .background(Color.cinemaSurface)
                            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                            .foregroundColor(.cinemaWhite)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }

                    Button {
                        viewModel.saveTMDBKey(tempAPIKey)
                        showingAPIKeySheet = false
                        HapticManager.shared.confirm()
                    } label: {
                        Text("Save Key")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(CinemaButtonStyle(variant: .primary))

                    Spacer()
                }
                .padding(CinemaSpacing.lg)
            }
            .navigationTitle("TMDB Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { showingAPIKeySheet = false }
                        .foregroundColor(.cinemaGold)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private var exportSheet: some View {
        NavigationStack {
            ZStack {
                Color.cinemaBlack.ignoresSafeArea()

                VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                    Text("Exported CSV Data")
                        .font(.cinemaH3)
                        .foregroundColor(.cinemaWhite)

                    TextEditor(text: .constant(exportedData))
                        .scrollContentBackground(.hidden)
                        .padding(CinemaSpacing.sm)
                        .background(Color.cinemaSurface)
                        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                        .foregroundColor(.cinemaSilver)
                        .font(.system(size: 13, design: .monospaced))

                    Button {
                        UIPasteboard.general.string = exportedData
                        HapticManager.shared.success()
                        showingExportSheet = false
                    } label: {
                        Text("Copy to Clipboard")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(CinemaButtonStyle(variant: .primary))
                }
                .padding(CinemaSpacing.lg)
            }
            .navigationTitle("Export Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { showingExportSheet = false }
                        .foregroundColor(.cinemaGold)
                }
            }
        }
    }
}
