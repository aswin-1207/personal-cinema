// CollectionDetailView.swift - Personal Cinema Collection View
import SwiftUI

struct CollectionDetailView: View {
    let collection: Collection
    @State private var movies: [MovieBrief] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    private let gridColumns = [
        GridItem(.flexible(), spacing: CinemaSpacing.sm),
        GridItem(.flexible(), spacing: CinemaSpacing.sm),
        GridItem(.flexible(), spacing: CinemaSpacing.sm)
    ]

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                    Text(collection.name)
                        .font(.cinemaH1)
                        .foregroundColor(.cinemaWhite)

                    if let desc = collection.description, !desc.isEmpty {
                        Text(desc)
                            .font(.cinemaBody)
                            .foregroundColor(.cinemaSubtle)
                    }

                    Text("\(collection.movieIds.count) curated films")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaGold)
                        .kerning(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(CinemaSpacing.md)

                if isLoading {
                    Spacer()
                    ProgressView().tint(.cinemaGold)
                    Spacer()
                } else if movies.isEmpty {
                    EmptyStateView(
                        icon: "film.stack",
                        title: "Collection is Empty",
                        subtitle: "Add movies to this collection from your library or movie detail view."
                    )
                } else {
                    ScrollView {
                        LazyVGrid(columns: gridColumns, spacing: CinemaSpacing.sm) {
                            ForEach(movies) { movie in
                                NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                    MovieCard(movie: movie, size: .small)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(CinemaSpacing.md)
                    }
                }
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task { await loadMovies() }
    }

    @MainActor
    private func loadMovies() async {
        isLoading = true
        var fetchedMovies: [MovieBrief] = []

        for movieId in collection.movieIds {
            if let local = DataManager.shared.getLocalMovie(tmdbId: movieId) {
                fetchedMovies.append(local.brief)
            } else if let detail = try? await TMDBService.shared.getMovieDetails(tmdbId: movieId) {
                DataManager.shared.cacheMovieDetail(detail)
                fetchedMovies.append(detail.brief)
            }
        }

        movies = fetchedMovies
        isLoading = false
    }
}
