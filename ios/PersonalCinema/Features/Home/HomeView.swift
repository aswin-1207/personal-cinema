// HomeView.swift - Personal Cinema Home Screen
import SwiftUI

struct HomeView: View {
    @State private var viewModel = HomeViewModel()
    @State private var showingRandomMovie = false
    @State private var randomMovieTarget: MovieBrief?
    @State private var scrollOffset: CGFloat = 0

    var body: some View {
        ZStack(alignment: .top) {
            Color.cinemaBlack.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 0) {
                    // HERO SECTION
                    if let hero = viewModel.heroMovie {
                        HeroMovieView(movie: hero, scrollOffset: scrollOffset)
                            .frame(height: UIScreen.main.bounds.height * 0.62)
                    } else if viewModel.isLoading {
                        ShimmerBox(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height * 0.62)
                    }

                    VStack(spacing: CinemaSpacing.xl) {
                        // Continue Watching Section
                        if !viewModel.continueWatching.isEmpty {
                            sectionHeader("Continue Watching")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: CinemaSpacing.md) {
                                    ForEach(viewModel.continueWatching) { item in
                                        if let movie = item.movie {
                                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                                MovieCard(movie: movie, size: .medium)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                                .padding(.horizontal, CinemaSpacing.md)
                            }
                        }

                        // Your Next Movie Feature Card
                        if let next = viewModel.nextMovie, let movie = next.movie {
                            sectionHeader("Your Next Movie")
                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                nextMovieCard(movie: movie)
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, CinemaSpacing.md)
                        }

                        // Recently Added
                        if !viewModel.recentlyAdded.isEmpty {
                            sectionHeader("Recently Added to Watchlist")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: CinemaSpacing.md) {
                                    ForEach(viewModel.recentlyAdded) { item in
                                        if let movie = item.movie {
                                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                                MovieCard(movie: movie, size: .medium)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                                .padding(.horizontal, CinemaSpacing.md)
                            }
                        }

                        // Personalized Recommendations
                        if !viewModel.recommendations.isEmpty {
                            sectionHeader("Recommended for You")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: CinemaSpacing.md) {
                                    ForEach(viewModel.recommendations) { movie in
                                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                            MovieCard(movie: movie, size: .medium)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, CinemaSpacing.md)
                            }
                        }

                        // Trending Movies
                        if !viewModel.trending.isEmpty {
                            sectionHeader("Trending in Cinema")
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: CinemaSpacing.md) {
                                    ForEach(viewModel.trending) { movie in
                                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                            MovieCard(movie: movie, size: .medium)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, CinemaSpacing.md)
                            }
                        }

                        // Watch Streak Badge
                        if viewModel.streak > 0 {
                            streakBadge(streak: viewModel.streak)
                                .padding(.horizontal, CinemaSpacing.md)
                        }

                        // Surprise Me Generator
                        Button {
                            if let movie = viewModel.surpriseMe() {
                                randomMovieTarget = movie
                                showingRandomMovie = true
                                HapticManager.shared.randomReveal()
                            }
                        } label: {
                            HStack(spacing: CinemaSpacing.sm) {
                                Image(systemName: "shuffle")
                                Text("SURPRISE ME TONIGHT")
                                    .kerning(1.5)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                        }
                        .buttonStyle(CinemaButtonStyle(variant: .secondary))
                        .padding(.horizontal, CinemaSpacing.md)

                        Spacer(minLength: CinemaSpacing.xxl)
                    }
                    .padding(.top, CinemaSpacing.xl)
                    .background(Color.cinemaBlack)
                }
            }
            .refreshable {
                await viewModel.load()
            }
            .coordinateSpace(name: "scroll")
            .ignoresSafeArea(edges: .top)
        }
        .navigationBarHidden(true)
        .task { await viewModel.load() }
        .fullScreenCover(isPresented: $showingRandomMovie) {
            if let movie = randomMovieTarget {
                RandomMovieView(pool: viewModel.trending, selectedMovie: movie)
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title.uppercased())
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(1.5)
            Spacer()
        }
        .padding(.horizontal, CinemaSpacing.md)
    }

    @ViewBuilder
    private func nextMovieCard(movie: MovieBrief) -> some View {
        HStack(spacing: CinemaSpacing.md) {
            AsyncImage(url: movie.posterURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.cinemaCharcoal
            }
            .frame(width: 80, height: 120)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))

            VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
                Text("UP NEXT")
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaGold)
                    .kerning(1.5)

                Text(movie.title)
                    .font(.cinemaH3)
                    .foregroundColor(.cinemaWhite)
                    .lineLimit(2)

                if let year = movie.releaseYear {
                    Text(year)
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                }

                Spacer()

                HStack(spacing: 4) {
                    Text("START WATCHING")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaGold)
                        .kerning(1)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.cinemaGold)
                }
            }
            Spacer()

            WatchedControl(
                isWatched: .constant(false),
                style: .pill,
                onWatched: {
                    Task {
                        _ = DataManager.shared.markWatched(movieId: movie.id)
                        await viewModel.load()
                    }
                }
            )
        }
        .padding(CinemaSpacing.md)
        .cinemaCard()
    }

    @ViewBuilder
    private func streakBadge(streak: Int) -> some View {
        HStack(spacing: CinemaSpacing.md) {
            Image(systemName: "flame.fill")
                .font(.system(size: 28))
                .foregroundColor(.cinemaGold)

            VStack(alignment: .leading, spacing: 2) {
                Text("\(streak) Day Cinema Streak")
                    .font(.cinemaH3)
                    .foregroundColor(.cinemaWhite)
                Text("Movie watching is becoming your daily ritual.")
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaSubtle)
            }

            Spacer()

            Text("🏆")
                .font(.system(size: 28))
        }
        .padding(CinemaSpacing.md)
        .cinemaCard()
    }
}
