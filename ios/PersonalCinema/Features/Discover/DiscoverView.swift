// DiscoverView.swift - Personal Cinema Discover Experience
import SwiftUI

struct DiscoverView: View {
    @State private var viewModel = DiscoverViewModel()
    @FocusState private var searchFocused: Bool

    private let gridColumns = [
        GridItem(.flexible(), spacing: CinemaSpacing.sm),
        GridItem(.flexible(), spacing: CinemaSpacing.sm),
        GridItem(.flexible(), spacing: CinemaSpacing.sm)
    ]

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Search bar
                searchBar
                    .padding(.horizontal, CinemaSpacing.md)
                    .padding(.top, CinemaSpacing.sm)
                    .padding(.bottom, CinemaSpacing.md)

                if viewModel.isSearching {
                    searchResultsView
                } else {
                    browseView
                }
            }
        }
        .navigationBarHidden(true)
        .task { await viewModel.loadTrendingAndGenres() }
        .onChange(of: viewModel.searchQuery) { _, _ in
            viewModel.onSearchQueryChanged()
        }
    }

    private var searchBar: some View {
        HStack(spacing: CinemaSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(searchFocused ? .cinemaGold : .cinemaSubtle)

            TextField("Search movies by title, director...", text: $viewModel.searchQuery)
                .foregroundColor(.cinemaWhite)
                .tint(.cinemaGold)
                .focused($searchFocused)
                .autocorrectionDisabled()

            if !viewModel.searchQuery.isEmpty {
                Button {
                    viewModel.clearSearch()
                    searchFocused = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.cinemaSubtle)
                }
            }
        }
        .padding(CinemaSpacing.md)
        .background(Color.cinemaSurface)
        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: CinemaRadius.md)
                .strokeBorder(searchFocused ? Color.cinemaGold.opacity(0.5) : Color.white.opacity(0.06), lineWidth: 0.8)
        )
        .animation(CinemaAnimation.fast, value: searchFocused)
    }

    private var browseView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CinemaSpacing.xl) {
                // Mood Cards Grid
                VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                    sectionHeader("In The Mood For...")
                    LazyVGrid(
                        columns: [GridItem(.flexible(), spacing: CinemaSpacing.sm), GridItem(.flexible(), spacing: CinemaSpacing.sm)],
                        spacing: CinemaSpacing.sm
                    ) {
                        ForEach(viewModel.moods) { mood in
                            moodCard(mood)
                        }
                    }
                    .padding(.horizontal, CinemaSpacing.md)
                }

                // Genre Chips
                if !viewModel.genres.isEmpty {
                    VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                        sectionHeader("Browse by Genre")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: CinemaSpacing.sm) {
                                ForEach(viewModel.genres) { genre in
                                    genreChip(genre)
                                }
                            }
                            .padding(.horizontal, CinemaSpacing.md)
                        }
                    }
                }

                // Trending Now
                if !viewModel.trending.isEmpty {
                    VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                        sectionHeader("Trending This Week")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: CinemaSpacing.md) {
                                ForEach(viewModel.trending) { movie in
                                    NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                        MovieCard(movie: movie, size: .large)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, CinemaSpacing.md)
                        }
                    }
                }

                // Popular Films
                if !viewModel.popular.isEmpty {
                    VStack(alignment: .leading, spacing: CinemaSpacing.md) {
                        sectionHeader("Critically Acclaimed & Popular")
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: CinemaSpacing.md) {
                                ForEach(viewModel.popular) { movie in
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

                Spacer(minLength: CinemaSpacing.xxl)
            }
            .padding(.top, CinemaSpacing.sm)
        }
    }

    private var searchResultsView: some View {
        Group {
            if viewModel.isLoading && viewModel.searchResults.isEmpty {
                VStack {
                    Spacer()
                    ProgressView().tint(.cinemaGold)
                    Spacer()
                }
            } else if viewModel.searchResults.isEmpty {
                EmptyStateView(
                    icon: "magnifyingglass",
                    title: "No Movies Found",
                    subtitle: "Try another search term or browse our curated mood selections."
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: gridColumns, spacing: CinemaSpacing.sm) {
                        ForEach(viewModel.searchResults) { movie in
                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                MovieCard(movie: movie, size: .small)
                            }
                            .buttonStyle(.plain)
                            .onAppear {
                                if movie.id == viewModel.searchResults.last?.id {
                                    Task { await viewModel.loadMore() }
                                }
                            }
                        }
                    }
                    .padding(CinemaSpacing.md)

                    if viewModel.isLoading {
                        ProgressView().tint(.cinemaGold).padding()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.cinemaLabel)
            .foregroundColor(.cinemaSubtle)
            .kerning(1.5)
            .padding(.horizontal, CinemaSpacing.md)
    }

    @ViewBuilder
    private func moodCard(_ mood: MoodOption) -> some View {
        Button {
            Task { await viewModel.selectMood(mood) }
            HapticManager.shared.tap()
        } label: {
            VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                Text(mood.title)
                    .font(.cinemaBodyMedium)
                    .foregroundColor(.cinemaWhite)
                    .multilineTextAlignment(.leading)
                Text(mood.subtitle)
                    .font(.cinemaCaption)
                    .foregroundColor(.cinemaSubtle)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(CinemaSpacing.md)
            .background(
                LinearGradient(
                    colors: [Color.cinemaSurface, Color.cinemaCharcoal],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: CinemaRadius.md)
                    .strokeBorder(Color.white.opacity(0.06), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func genreChip(_ genre: Genre) -> some View {
        let isSelected = viewModel.selectedGenre?.id == genre.id
        Button {
            Task { await viewModel.selectGenre(genre) }
            HapticManager.shared.tap()
        } label: {
            Text(genre.name)
                .font(.cinemaCaptionMedium)
                .foregroundColor(isSelected ? .cinemaBlack : .cinemaWhite)
                .padding(.horizontal, CinemaSpacing.md)
                .padding(.vertical, CinemaSpacing.sm)
                .background(isSelected ? Color.cinemaGold : Color.cinemaSurface)
                .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.pill))
                .overlay(
                    RoundedRectangle(cornerRadius: CinemaRadius.pill)
                        .strokeBorder(isSelected ? Color.cinemaGold : Color.white.opacity(0.1), lineWidth: 0.5)
                )
                .animation(CinemaAnimation.fast, value: isSelected)
        }
        .buttonStyle(.plain)
    }
}
