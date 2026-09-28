// HeroMovieView.swift - Personal Cinema Design System
import SwiftUI

struct HeroMovieView: View {
    let movie: MovieBrief
    let scrollOffset: CGFloat
    var onWatchNow: (() -> Void)? = nil
    var onAddToWatchlist: (() -> Void)? = nil

    @State private var appeared = false

    private var parallaxOffset: CGFloat {
        scrollOffset * 0.4
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                // Backdrop with parallax
                AsyncImage(url: movie.backdropURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .offset(y: parallaxOffset)
                    case .failure:
                        backdropFallback
                    case .empty:
                        backdropFallback.shimmer(isLoading: true)
                    @unknown default:
                        backdropFallback
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height + max(0, parallaxOffset))
                .clipped()

                // Gradient overlay (bottom fade)
                LinearGradient(
                    stops: [
                        .init(color: Color.cinemaBlack, location: 0),
                        .init(color: Color.cinemaBlack.opacity(0.85), location: 0.25),
                        .init(color: Color.cinemaBlack.opacity(0.4), location: 0.6),
                        .init(color: Color.clear, location: 1)
                    ],
                    startPoint: .bottom,
                    endPoint: .top
                )

                // Left edge gradient for text legibility
                HStack {
                    LinearGradient(
                        colors: [Color.cinemaBlack.opacity(0.8), Color.clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 0.5)
                    Spacer()
                }

                // Content overlay
                VStack(alignment: .leading, spacing: CinemaSpacing.sm) {
                    // Feature tag
                    Text("FEATURED TONIGHT")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaGold)
                        .kerning(2)
                        .opacity(appeared ? 1 : 0)
                        .animation(CinemaAnimation.slow, value: appeared)

                    // Title
                    Text(movie.title)
                        .font(.cinemaDisplayLarge)
                        .foregroundColor(.cinemaWhite)
                        .lineLimit(2)
                        .shadow(color: .black.opacity(0.6), radius: 6, x: 0, y: 3)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared ? 0 : 20)
                        .animation(CinemaAnimation.slow.delay(0.1), value: appeared)

                    // Metadata row
                    HStack(spacing: CinemaSpacing.xs) {
                        if let year = movie.releaseYear {
                            Text(year)
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaWhite.opacity(0.8))
                        }

                        if movie.voteAverage > 0 {
                            Text("•").foregroundColor(.cinemaWhite.opacity(0.4))
                            HStack(spacing: 3) {
                                Image(systemName: "star.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.cinemaGold)
                                Text(String(format: "%.1f", movie.voteAverage))
                                    .font(.cinemaCaption)
                                    .foregroundColor(.cinemaWhite.opacity(0.8))
                            }
                        }
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 15)
                    .animation(CinemaAnimation.slow.delay(0.2), value: appeared)

                    // Action buttons
                    HStack(spacing: CinemaSpacing.sm) {
                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                            HStack(spacing: CinemaSpacing.xs) {
                                Image(systemName: "play.fill")
                                    .font(.system(size: 12))
                                Text("WATCH NOW")
                                    .font(.cinemaLabel)
                                    .kerning(1.5)
                            }
                            .foregroundColor(.cinemaBlack)
                            .padding(.horizontal, CinemaSpacing.md)
                            .padding(.vertical, CinemaSpacing.sm)
                            .background(Color.cinemaGold)
                            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                        }
                        .buttonStyle(.plain)

                        NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                            HStack(spacing: CinemaSpacing.xs) {
                                Image(systemName: "info.circle")
                                    .font(.system(size: 12))
                                Text("Details")
                                    .font(.cinemaLabel)
                            }
                            .foregroundColor(.cinemaWhite)
                            .padding(.horizontal, CinemaSpacing.md)
                            .padding(.vertical, CinemaSpacing.sm)
                            .background(Color.white.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                        }
                        .buttonStyle(.plain)
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 10)
                    .animation(CinemaAnimation.slow.delay(0.3), value: appeared)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, CinemaSpacing.md)
                .padding(.bottom, CinemaSpacing.xl)
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .clipped()
        }
        .onAppear {
            withAnimation { appeared = true }
        }
    }

    private var backdropFallback: some View {
        LinearGradient(
            colors: [Color.cinemaDeepNavy, Color.cinemaCharcoal, Color.cinemaBlack],
            startPoint: .topTrailing,
            endPoint: .bottomLeading
        )
        .overlay(
            Image(systemName: "film.fill")
                .font(.system(size: 80, weight: .thin))
                .foregroundColor(.cinemaGold.opacity(0.1))
        )
    }
}
