// LibraryView.swift - Personal Cinema Library Screen
import SwiftUI

struct LibraryView: View {
    @State private var viewModel = LibraryViewModel()
    @State private var showingFilters = false
    @State private var showingNewCollection = false
    @State private var newCollectionName = ""
    @State private var movieToDelete: UserMovieBrief?
    @State private var showDeleteConfirm = false

    private let gridColumns = [
        GridItem(.flexible(), spacing: CinemaSpacing.sm),
        GridItem(.flexible(), spacing: CinemaSpacing.sm)
    ]

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header & Segmented Switcher
                libraryHeader

                // Stats Bar (visible when looking at Watched)
                if viewModel.filterStatus == "watched", let stats = viewModel.stats {
                    statsBar(stats: stats)
                }

                // Search
                if !viewModel.filteredMovies.isEmpty || !viewModel.searchQuery.isEmpty {
                    searchField
                        .padding(.horizontal, CinemaSpacing.md)
                        .padding(.bottom, CinemaSpacing.sm)
                }

                // Content Area
                if viewModel.isLoading && viewModel.movies.isEmpty {
                    loadingGrid
                } else if viewModel.filteredMovies.isEmpty {
                    emptyState
                } else if viewModel.displayMode == .grid {
                    gridView
                } else {
                    listView
                }
            }
        }
        .navigationBarHidden(true)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
        .sheet(isPresented: $showingFilters) {
            filterSheet
        }
        .alert("Remove Movie", isPresented: $showDeleteConfirm, presenting: movieToDelete) { movie in
            Button("Remove", role: .destructive) {
                Task { await viewModel.removeMovie(id: movie.id) }
            }
            Button("Cancel", role: .cancel) {}
        } message: { movie in
            Text("Remove \"\(movie.movie?.title ?? "this movie")\" from your library?")
        }
        .alert("New Collection", isPresented: $showingNewCollection) {
            TextField("Collection name (e.g. 70s Sci-Fi)", text: $newCollectionName)
            Button("Create") {
                let name = newCollectionName
                newCollectionName = ""
                Task { await viewModel.createCollection(name: name) }
            }
            Button("Cancel", role: .cancel) { newCollectionName = "" }
        }
    }

    private var libraryHeader: some View {
        VStack(spacing: 0) {
            HStack {
                Text("LIBRARY")
                    .font(.cinemaH2)
                    .foregroundColor(.cinemaWhite)
                Spacer()
                HStack(spacing: CinemaSpacing.md) {
                    Button {
                        withAnimation(CinemaAnimation.fast) {
                            viewModel.displayMode = viewModel.displayMode == .grid ? .list : .grid
                        }
                        HapticManager.shared.tap()
                    } label: {
                        Image(systemName: viewModel.displayMode == .grid ? "list.bullet" : "square.grid.2x2")
                            .foregroundColor(.cinemaGold)
                    }
                    Button { showingFilters = true } label: {
                        Image(systemName: "slider.horizontal.3")
                            .foregroundColor(.cinemaGold)
                    }
                }
            }
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.vertical, CinemaSpacing.md)

            // Segmented Control: All / Watchlist / Watched
            HStack(spacing: 0) {
                ForEach([("All", "all"), ("Watchlist", "watchlist"), ("Watched", "watched")], id: \.1) { label, value in
                    Button {
                        viewModel.filterStatus = value
                        Task { await viewModel.applyFilters() }
                        HapticManager.shared.selection()
                    } label: {
                        Text(label)
                            .font(.cinemaCaptionMedium)
                            .foregroundColor(viewModel.filterStatus == value ? .cinemaBlack : .cinemaSubtle)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, CinemaSpacing.sm)
                            .background(viewModel.filterStatus == value ? Color.cinemaGold : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
                            .animation(CinemaAnimation.fast, value: viewModel.filterStatus)
                    }
                }
            }
            .padding(4)
            .background(Color.cinemaSurface)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.bottom, CinemaSpacing.md)
        }
    }

    private var searchField: some View {
        HStack {
            Image(systemName: "magnifyingglass").foregroundColor(.cinemaSubtle)
            TextField("Filter by title...", text: $viewModel.searchQuery)
                .foregroundColor(.cinemaWhite).tint(.cinemaGold)
        }
        .padding(CinemaSpacing.sm)
        .background(Color.cinemaSurface)
        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
    }

    private var gridView: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: CinemaSpacing.md) {
                ForEach(viewModel.filteredMovies) { item in
                    if let movie = item.movie {
                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                            libraryGridItem(item: item, movie: movie)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            movieContextMenu(item: item)
                        }
                        .onAppear {
                            if item.id == viewModel.filteredMovies.last?.id {
                                Task { await viewModel.loadMore() }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.bottom, CinemaSpacing.xxl)

            if !viewModel.collections.isEmpty {
                collectionsSection
            }
        }
    }

    private var listView: some View {
        List {
            ForEach(viewModel.filteredMovies) { item in
                if let movie = item.movie {
                    NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                        libraryListItem(item: item, movie: movie)
                    }
                    .listRowBackground(Color.cinemaSurface)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            movieToDelete = item
                            showDeleteConfirm = true
                        } label: {
                            Label("Remove", systemImage: "trash")
                        }
                        if item.status != "watched" {
                            Button {
                                Task { await viewModel.markWatched(id: item.id) }
                            } label: {
                                Label("Watched", systemImage: "checkmark.circle")
                            }
                            .tint(.cinemaGold)
                        }
                    }
                    .contextMenu { movieContextMenu(item: item) }
                }
            }
        }
        .listStyle(.plain)
        .background(Color.cinemaBlack)
        .scrollContentBackground(.hidden)
    }

    @ViewBuilder
    private func libraryGridItem(item: UserMovieBrief, movie: MovieBrief) -> some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
            AsyncImage(url: movie.posterURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                ZStack {
                    Color.cinemaCharcoal
                    Image(systemName: "film").foregroundColor(.cinemaGold.opacity(0.4))
                }
            }
            .aspectRatio(2/3, contentMode: .fill)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
            .overlay(
                WatchedControl(
                    isWatched: Binding(
                        get: { item.status == "watched" },
                        set: { _ in }
                    ),
                    style: .iconOnly,
                    onWatched: {
                        Task { await viewModel.markWatched(id: item.id) }
                    },
                    onUnwatched: {
                        Task { await viewModel.unmarkWatched(id: item.id) }
                    }
                )
                .padding(6),
                alignment: .topTrailing
            )

            Text(movie.title)
                .font(.cinemaCaption)
                .foregroundColor(.cinemaWhite)
                .lineLimit(1)

            if let rating = item.personalRating, rating > 0 {
                HStack(spacing: 2) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.cinemaGold)
                    Text(String(format: "%.1f", rating))
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle)
                }
            }
        }
    }

    @ViewBuilder
    private func libraryListItem(item: UserMovieBrief, movie: MovieBrief) -> some View {
        HStack(spacing: CinemaSpacing.md) {
            AsyncImage(url: movie.posterURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Color.cinemaCharcoal
            }
            .frame(width: 50, height: 75)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))

            VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                Text(movie.title)
                    .font(.cinemaBodyMedium)
                    .foregroundColor(.cinemaWhite)
                    .lineLimit(2)
                if let year = movie.releaseYear {
                    Text(year).font(.cinemaCaption).foregroundColor(.cinemaSubtle)
                }
                if let rating = item.personalRating, rating > 0 {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill").font(.system(size: 10)).foregroundColor(.cinemaGold)
                        Text(String(format: "%.1f", rating)).font(.cinemaCaption).foregroundColor(.cinemaSubtle)
                    }
                }
            }

            Spacer()
            WatchedControl(
                isWatched: Binding(
                    get: { item.status == "watched" },
                    set: { _ in }
                ),
                style: .pill,
                onWatched: {
                    Task { await viewModel.markWatched(id: item.id) }
                },
                onUnwatched: {
                    Task { await viewModel.unmarkWatched(id: item.id) }
                }
            )
        }
        .padding(.vertical, CinemaSpacing.xs)
    }

    @ViewBuilder
    private func statusBadge(status: String) -> some View {
        let (text, color) = statusInfo(status)
        Text(text)
            .font(.cinemaLabel)
            .foregroundColor(color)
            .padding(.horizontal, CinemaSpacing.xs)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
    }

    private func statusInfo(_ status: String) -> (String, Color) {
        switch status {
        case "watched": return ("✓ Watched", .cinemaGold)
        case "watching": return ("▶ Watching", Color.green)
        default: return ("○ Watchlist", .cinemaSubtle)
        }
    }

    @ViewBuilder
    private func movieContextMenu(item: UserMovieBrief) -> some View {
        if item.status != "watched" {
            Button { Task { await viewModel.markWatched(id: item.id) } } label: {
                Label("Mark as Watched", systemImage: "checkmark.circle")
            }
        }
        Button(role: .destructive) {
            movieToDelete = item
            showDeleteConfirm = true
        } label: {
            Label("Remove from Library", systemImage: "trash")
        }
    }

    private var loadingGrid: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: CinemaSpacing.md) {
                ForEach(0..<6, id: \.self) { _ in
                    ShimmerBox(height: 230)
                }
            }
            .padding(CinemaSpacing.md)
        }
    }

    private var emptyState: some View {
        EmptyStateView(
            icon: "books.vertical",
            title: viewModel.filterStatus == "watchlist" ? "Watchlist Empty" : "No Movies Found",
            subtitle: viewModel.filterStatus == "watchlist"
                ? "Discover exciting films and add them to your watchlist to start your cinema journey."
                : "Your watched movies and ratings will be cataloged here.",
            actionTitle: "Browse Discover",
            action: nil
        )
    }

    private var collectionsSection: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.md) {
            HStack {
                Text("YOUR COLLECTIONS")
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaSubtle)
                    .kerning(1.5)
                Spacer()
                Button { showingNewCollection = true } label: {
                    Image(systemName: "plus")
                        .foregroundColor(.cinemaGold)
                }
            }
            .padding(.horizontal, CinemaSpacing.md)

            ForEach(viewModel.collections) { collection in
                NavigationLink(destination: CollectionDetailView(collection: collection)) {
                    HStack {
                        VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                            Text(collection.name)
                                .font(.cinemaBodyMedium)
                                .foregroundColor(.cinemaWhite)
                            Text("\(collection.movieIds.count) films")
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaSubtle)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundColor(.cinemaSubtle)
                    }
                    .padding(CinemaSpacing.md)
                    .cinemaCard()
                    .padding(.horizontal, CinemaSpacing.md)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.bottom, CinemaSpacing.xxl)
    }

    private var filterSheet: some View {
        NavigationStack {
            ZStack {
                Color.cinemaBlack.ignoresSafeArea()

                List {
                    Section("Sort By") {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Button {
                                viewModel.sortBy = option
                                Task { await viewModel.applyFilters() }
                            } label: {
                                HStack {
                                    Text(option.rawValue).foregroundColor(.cinemaWhite)
                                    Spacer()
                                    if viewModel.sortBy == option {
                                        Image(systemName: "checkmark").foregroundColor(.cinemaGold)
                                    }
                                }
                            }
                            .listRowBackground(Color.cinemaSurface)
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Sort & Filter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showingFilters = false }.foregroundColor(.cinemaGold)
                }
            }
        }
    }

    @ViewBuilder
    private func statsBar(stats: LibraryStats) -> some View {
        HStack {
            statItem(value: "\(stats.watched)", label: "Films Watched")
            Divider().background(Color.white.opacity(0.1)).frame(height: 24)
            statItem(value: String(format: "%.0fh", stats.totalHours), label: "Screen Time")
            Divider().background(Color.white.opacity(0.1)).frame(height: 24)
            statItem(value: "\(stats.currentStreak)d", label: "Watch Streak")
        }
        .padding(.vertical, CinemaSpacing.sm)
        .padding(.horizontal, CinemaSpacing.md)
        .background(Color.cinemaSurface)
    }

    @ViewBuilder
    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.cinemaH3).foregroundColor(.cinemaGold)
            Text(label).font(.cinemaLabel).foregroundColor(.cinemaSubtle)
        }
        .frame(maxWidth: .infinity)
    }
}
