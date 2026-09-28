// MovieCard.swift - Personal Cinema Design System
import SwiftUI

enum MovieCardSize {
    case small   // Grid 3-col: ~105 x 155
    case medium  // Horizontal scroll: ~130 x 195
    case large   // Featured: ~160 x 240

    var width: CGFloat {
        switch self {
        case .small: return 105
        case .medium: return 130
        case .large: return 160
        }
    }

    var height: CGFloat {
        width * 1.5 // 2:3 standard poster ratio
    }
}

struct MovieCard: View {
    let movie: MovieBrief
    var size: MovieCardSize = .medium
    var isWatched: Bool = false
    var onToggleWatched: (() -> Void)? = nil
    var action: (() -> Void)? = nil

    @State private var watchedState: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
            // Poster
            ZStack(alignment: .topTrailing) {
                AsyncImage(url: movie.posterURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    case .failure:
                        posterFallback
                    case .empty:
                        posterFallback.shimmer(isLoading: true)
                    @unknown default:
                        posterFallback
                    }
                }
                .frame(width: size.width, height: size.height)
                .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: CinemaRadius.md)
                        .strokeBorder(Color.white.opacity(0.08), lineWidth: 0.5)
                )

                // Rating overlay badge
                if movie.voteAverage > 0 && onToggleWatched == nil {
                    HStack(spacing: 2) {
                        Image(systemName: "star.fill")
                            .font(.system(size: 8))
                            .foregroundColor(.cinemaGold)
                        Text(String(format: "%.1f", movie.voteAverage))
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaWhite)
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.cinemaBlack.opacity(0.85))
                    .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
                    .padding(6)
                }

                // Quick Watched ✓ Tick Overlay (if interactive)
                if let onToggle = onToggleWatched {
                    WatchedControl(
                        isWatched: $watchedState,
                        style: .iconOnly,
                        onWatched: { onToggle() },
                        onUnwatched: { onToggle() }
                    )
                    .padding(6)
                }
            }
            .frame(width: size.width, height: size.height)

            // Title
            Text(movie.title)
                .font(.cinemaCaptionMedium)
                .foregroundColor(.cinemaWhite)
                .lineLimit(1)
                .frame(width: size.width, alignment: .leading)

            // Year
            if let year = movie.releaseYear {
                Text(year)
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaSubtle)
            }
        }
        .frame(width: size.width)
        .onAppear {
            watchedState = isWatched
        }
        .onChange(of: isWatched) { _, newVal in
            watchedState = newVal
        }
    }

    private var posterFallback: some View {
        ZStack {
            Color.cinemaSurface
            VStack(spacing: 6) {
                Image(systemName: "film")
                    .font(.system(size: size == .small ? 20 : 28))
                    .foregroundColor(.cinemaGold.opacity(0.4))
                Text(movie.title)
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaSubtle)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .padding(.horizontal, 4)
            }
        }
        .frame(width: size.width, height: size.height)
    }
}
