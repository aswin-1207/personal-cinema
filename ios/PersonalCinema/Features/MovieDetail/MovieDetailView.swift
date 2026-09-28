// MovieDetailView.swift - Personal Cinema Premium Detail Experience
import SwiftUI

struct MovieDetailView: View {
    let tmdbId: Int
    @State private var viewModel: MovieDetailViewModel
    @State private var overviewExpanded = false
    @State private var showingScheduleSheet = false
    @State private var showingCinemaMode = false
    @State private var showingCompletionSheet = false
    @State private var scheduledDate = Date().addingTimeInterval(3600)
    @Environment(\.dismiss) private var dismiss

    init(tmdbId: Int) {
        self.tmdbId = tmdbId
        _viewModel = State(initialValue: MovieDetailViewModel(tmdbId: tmdbId))
    }

    private let backdropHeight: CGFloat = 280

    var body: some View {
        ZStack(alignment: .top) {
            Color.cinemaBlack.ignoresSafeArea()

            if viewModel.isLoading && viewModel.movie == nil {
                loadingView
            } else if let movie = viewModel.movie {
                ScrollView {
                    VStack(spacing: 0) {
                        // Backdrop Header
                        backdropSection(movie: movie)

                        // Main Content
                        VStack(spacing: CinemaSpacing.lg) {
                            // Poster + Metadata Row
                            posterInfoRow(movie: movie)

                            // Action Buttons
                            actionButtons(movie: movie)

                            Divider()
                                .background(Color.white.opacity(0.08))
                                .padding(.horizontal, CinemaSpacing.md)

                            // Overview Section
                            overviewSection(movie: movie)

                            // Cast & Crew
                            if let credits = movie.credits {
                                creditsSection(credits: credits)
                            }

                            // Personal Rating (if in library and watched)
                            if let userMovie = viewModel.userMovie, userMovie.status == "watched" {
                                personalRatingSection(userMovie: userMovie)
                            }

                            // Similar Movies
                            if !viewModel.similar.isEmpty {
                                similarMoviesSection
                            }

                            Spacer(minLength: CinemaSpacing.xxl)
                        }
                        .background(Color.cinemaBlack)
                    }
                }
                .ignoresSafeArea(edges: .top)

                // Top Floating Navigation Bar
                floatingNavBar
            } else if let error = viewModel.errorMessage {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Could Not Load Movie",
                    subtitle: error,
                    actionTitle: "Retry",
                    action: { Task { await viewModel.load() } }
                )
            }
        }
        .navigationBarHidden(true)
        .task { await viewModel.load() }
        .sheet(isPresented: $showingScheduleSheet) {
            scheduleSheet
        }
        .sheet(isPresented: $showingCompletionSheet) {
            if let movie = viewModel.movie {
                WatchCompletionView(
                    movie: movie.brief,
                    duration: movie.runtime ?? 120,
                    onComplete: { rating, notes in
                        Task { await viewModel.markWatched(rating: rating, notes: notes) }
                    }
                )
            }
        }
        .fullScreenCover(isPresented: $showingCinemaMode) {
            if let movie = viewModel.movie {
                CinemaModeView(movie: movie.brief)
            }
        }
    }

    @ViewBuilder
    private func backdropSection(movie: MovieDetail) -> some View {
        ZStack(alignment: .bottom) {
            AsyncImage(url: movie.backdropURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                default:
                    LinearGradient(
                        colors: [Color.cinemaCharcoal, Color.cinemaDeepNavy],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                }
            }
            .frame(height: backdropHeight)
            .clipped()

            // Bottom Gradient Fade
            LinearGradient(
                colors: [Color.cinemaBlack, Color.cinemaBlack.opacity(0.7), Color.clear],
                startPoint: .bottom,
                endPoint: .top
            )
            .frame(height: 130)
        }
        .frame(height: backdropHeight)
    }

    @ViewBuilder
    private func posterInfoRow(movie: MovieDetail) -> some View {
        HStack(alignment: .top, spacing: CinemaSpacing.md) {
            // Floating Poster
            AsyncImage(url: movie.posterURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    ZStack {
                        Color.cinemaCharcoal
                        Image(systemName: "film").foregroundColor(.cinemaGold.opacity(0.4))
                    }
                }
            }
            .frame(width: 110, height: 165)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
            .shadow(color: .black.opacity(0.6), radius: 14, x: 0, y: 8)
            .offset(y: -50)
            .padding(.leading, CinemaSpacing.md)

            // Info Column
            VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
                Text(movie.title)
                    .font(.cinemaH2)
                    .foregroundColor(.cinemaWhite)
                    .lineLimit(3)

                // Year · Runtime · Rating
                HStack(spacing: CinemaSpacing.xs) {
                    if let year = movie.releaseYear {
                        Text(year).font(.cinemaCaption).foregroundColor(.cinemaSubtle)
                        Text("•").foregroundColor(.cinemaSubtle)
                    }
                    if let runtime = movie.formattedRuntime {
                        Text(runtime).font(.cinemaCaption).foregroundColor(.cinemaSubtle)
                        Text("•").foregroundColor(.cinemaSubtle)
                    }
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").font(.system(size: 10)).foregroundColor(.cinemaGold)
                        Text(String(format: "%.1f", movie.voteAverage)).font(.cinemaCaption).foregroundColor(.cinemaSubtle)
                    }
                }

                // Genre Chips
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: CinemaSpacing.xs) {
                        ForEach(movie.genres.prefix(3)) { genre in
                            Text(genre.name)
                                .font(.cinemaLabel)
                                .foregroundColor(.cinemaGold)
                                .padding(.horizontal, CinemaSpacing.sm)
                                .padding(.vertical, 4)
                                .background(Color.cinemaGold.opacity(0.12))
                                .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
                        }
                    }
                }

                if let tagline = movie.tagline, !tagline.isEmpty {
                    Text("\"\(tagline)\"")
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                        .italic()
                        .lineLimit(2)
                }
            }
            .padding(.top, CinemaSpacing.xs)
            .padding(.trailing, CinemaSpacing.md)
        }
    }

    @ViewBuilder
    private func actionButtons(movie: MovieDetail) -> some View {
        VStack(spacing: CinemaSpacing.sm) {
            // Core MARK AS WATCHED ✓ Tick Control
            WatchedControl(
                isWatched: Binding(
                    get: { viewModel.userMovie?.status == "watched" },
                    set: { _ in }
                ),
                style: .prominent,
                onWatched: {
                    showingCompletionSheet = true
                },
                onUnwatched: {
                    Task { await viewModel.unmarkWatched() }
                }
            )
            .padding(.horizontal, CinemaSpacing.md)

            // Primary Watch Now Button (Cinema Mode)
            Button {
                showingCinemaMode = true
                HapticManager.shared.cinemaStart()
                SoundManager.shared.play(.cinemaStart)
            } label: {
                HStack(spacing: CinemaSpacing.sm) {
                    Image(systemName: "play.fill")
                    Text("START WATCH SESSION")
                        .kerning(1.5)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
            }
            .buttonStyle(CinemaButtonStyle(variant: .primary))
            .padding(.horizontal, CinemaSpacing.md)

            // Secondary Buttons
            HStack(spacing: CinemaSpacing.sm) {
                // Add to Watchlist / In Library Toggle
                Button {
                    Task { await viewModel.addToWatchlist() }
                } label: {
                    HStack(spacing: CinemaSpacing.xs) {
                        Image(systemName: viewModel.userMovie != nil ? "bookmark.fill" : "bookmark")
                        Text(viewModel.userMovie != nil ? "In Library" : "Add to Watchlist")
                            .font(.cinemaCaption)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                }
                .buttonStyle(CinemaButtonStyle(variant: .secondary))
                .disabled(viewModel.userMovie != nil)

                // Schedule Movie Night
                Button {
                    showingScheduleSheet = true
                } label: {
                    HStack(spacing: CinemaSpacing.xs) {
                        Image(systemName: "calendar.badge.clock")
                        Text("Schedule")
                            .font(.cinemaCaption)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                }
                .buttonStyle(CinemaButtonStyle(variant: .ghost))
            }
            .padding(.horizontal, CinemaSpacing.md)
        }
    }

    @ViewBuilder
    private func overviewSection(movie: MovieDetail) -> some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
            Text("Synopsis")
                .font(.cinemaH3)
                .foregroundColor(.cinemaWhite)

            if let overview = movie.overview, !overview.isEmpty {
                Text(overview)
                    .font(.cinemaBody)
                    .foregroundColor(.cinemaSilver)
                    .lineLimit(overviewExpanded ? nil : 4)

                if overview.count > 180 {
                    Button {
                        withAnimation(CinemaAnimation.normal) { overviewExpanded.toggle() }
                    } label: {
                        Text(overviewExpanded ? "Show Less" : "Read More")
                            .font(.cinemaCaptionMedium)
                            .foregroundColor(.cinemaGold)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, CinemaSpacing.md)
    }

    @ViewBuilder
    private func creditsSection(credits: MovieCredits) -> some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            if let director = credits.director {
                HStack(spacing: 6) {
                    Text("Directed by")
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                    Text(director.name)
                        .font(.cinemaCaptionMedium)
                        .foregroundColor(.cinemaWhite)
                }
                .padding(.horizontal, CinemaSpacing.md)
            }

            if !credits.cast.isEmpty {
                VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
                    Text("Starring")
                        .font(.cinemaH3)
                        .foregroundColor(.cinemaWhite)
                        .padding(.horizontal, CinemaSpacing.md)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: CinemaSpacing.md) {
                            ForEach(credits.cast.prefix(10)) { member in
                                castMemberView(member: member)
                            }
                        }
                        .padding(.horizontal, CinemaSpacing.md)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func castMemberView(member: CastMember) -> some View {
        VStack(spacing: CinemaSpacing.xs) {
            AsyncImage(url: member.profileURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fill)
                default:
                    ZStack {
                        Color.cinemaCharcoal
                        Image(systemName: "person.fill").foregroundColor(.cinemaSubtle)
                    }
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(Circle())

            Text(member.name)
                .font(.cinemaLabel)
                .foregroundColor(.cinemaWhite)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(width: 70)

            if let character = member.character {
                Text(character)
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaSubtle)
                    .lineLimit(1)
                    .frame(width: 70)
            }
        }
    }

    @ViewBuilder
    private func personalRatingSection(userMovie: UserMovieBrief) -> some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            Text("Your Personal Rating")
                .font(.cinemaH3)
                .foregroundColor(.cinemaWhite)

            RatingControl(
                rating: Binding(
                    get: { userMovie.personalRating },
                    set: { newVal in
                        if let r = newVal {
                            Task { await viewModel.updateRating(rating: r) }
                        }
                    }
                )
            )

            if let notes = userMovie.notes, !notes.isEmpty {
                Text("“\(notes)”")
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaSilver)
                    .italic()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, CinemaSpacing.md)
    }

    private var similarMoviesSection: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            Text("Similar Films You Might Enjoy")
                .font(.cinemaH3)
                .foregroundColor(.cinemaWhite)
                .padding(.horizontal, CinemaSpacing.md)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: CinemaSpacing.md) {
                    ForEach(viewModel.similar) { movie in
                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                            MovieCard(movie: movie, size: .medium)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, CinemaSpacing.md)
            }
        }
    }

    private var floatingNavBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.cinemaWhite)
                    .padding(10)
                    .background(Color.cinemaBlack.opacity(0.65))
                    .clipShape(Circle())
            }

            Spacer()

            Button {
                Task { await viewModel.toggleFavorite() }
            } label: {
                Image(systemName: viewModel.userMovie?.isFavorite == true ? "heart.fill" : "heart")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(viewModel.userMovie?.isFavorite == true ? .cinemaCrimsonSoft : .cinemaWhite)
                    .padding(10)
                    .background(Color.cinemaBlack.opacity(0.65))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, CinemaSpacing.md)
        .padding(.top, 52)
    }

    private var scheduleSheet: some View {
        NavigationStack {
            ZStack {
                Color.cinemaBlack.ignoresSafeArea()
                VStack(spacing: CinemaSpacing.lg) {
                    Text("Schedule Movie Night")
                        .font(.cinemaH2)
                        .foregroundColor(.cinemaWhite)

                    DatePicker("Date & Time", selection: $scheduledDate, in: Date()...)
                        .datePickerStyle(.graphical)
                        .tint(.cinemaGold)
                        .colorScheme(.dark)

                    Button {
                        Task { await viewModel.scheduleMovieNight(date: scheduledDate) }
                        showingScheduleSheet = false
                    } label: {
                        Text("CONFIRM MOVIE NIGHT")
                            .kerning(1.5)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                    }
                    .buttonStyle(CinemaButtonStyle(variant: .primary))
                }
                .padding(CinemaSpacing.lg)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingScheduleSheet = false }.foregroundColor(.cinemaGold)
                }
            }
        }
    }

    private var loadingView: some View {
        VStack(spacing: CinemaSpacing.lg) {
            ShimmerBox(width: UIScreen.main.bounds.width, height: backdropHeight)
            HStack(spacing: CinemaSpacing.md) {
                ShimmerBox(width: 110, height: 165)
                VStack(spacing: CinemaSpacing.sm) {
                    ShimmerBox(width: 200, height: 24)
                    ShimmerBox(width: 150, height: 16)
                }
                Spacer()
            }
            .padding(.horizontal, CinemaSpacing.md)
            Spacer()
        }
        .ignoresSafeArea(edges: .top)
    }
}
