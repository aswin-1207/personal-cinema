// RandomMovieView.swift - Personal Cinema "Surprise Me" Roulette
import SwiftUI

struct RandomMovieView: View {
    let pool: [MovieBrief]
    let selectedMovie: MovieBrief

    @State private var currentMovie: MovieBrief?
    @State private var isRevealed = false
    @State private var cycleCount = 0
    @State private var appeared = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: CinemaSpacing.xl) {
                Spacer()

                // Movie Poster Display
                ZStack {
                    if let movie = currentMovie {
                        AsyncImage(url: movie.posterURL) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                            default:
                                ZStack {
                                    Color.cinemaCharcoal
                                    Image(systemName: "film")
                                        .font(.system(size: 60))
                                        .foregroundColor(.cinemaGold.opacity(0.3))
                                }
                            }
                        }
                        .frame(width: 210, height: 315)
                        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.lg))
                        .shadow(
                            color: isRevealed ? Color.cinemaGold.opacity(0.35) : Color.clear,
                            radius: 40,
                            x: 0,
                            y: 0
                        )
                        .scaleEffect(isRevealed ? 1.05 : 1.0)
                        .animation(CinemaAnimation.springBouncy, value: isRevealed)
                        .id(movie.id)
                    }
                }
                .frame(width: 210, height: 315)

                // Title Reveal
                if isRevealed, let movie = currentMovie {
                    VStack(spacing: CinemaSpacing.sm) {
                        Text("TONIGHT'S SCREENING")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaGold)
                            .kerning(3)
                            .opacity(appeared ? 1 : 0)

                        Text(movie.title)
                            .font(.cinemaDisplay)
                            .foregroundColor(.cinemaWhite)
                            .multilineTextAlignment(.center)
                            .opacity(appeared ? 1 : 0)
                            .animation(CinemaAnimation.slow.delay(0.1), value: appeared)

                        if let year = movie.releaseYear {
                            Text(year)
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaSubtle)
                                .opacity(appeared ? 1 : 0)
                                .animation(CinemaAnimation.slow.delay(0.2), value: appeared)
                        }
                    }
                    .padding(.horizontal, CinemaSpacing.xl)
                } else {
                    Text("Selecting your cinematic adventure...")
                        .font(.cinemaBody)
                        .foregroundColor(.cinemaSubtle)
                }

                Spacer()

                // Buttons (revealed at end)
                if isRevealed {
                    VStack(spacing: CinemaSpacing.md) {
                        if let movie = currentMovie {
                            NavigationLink(destination: MovieDetailView(tmdbId: movie.id)) {
                                HStack(spacing: 8) {
                                    Image(systemName: "play.fill")
                                    Text("WATCH NOW")
                                        .kerning(1.5)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 52)
                            }
                            .buttonStyle(CinemaButtonStyle(variant: .primary))
                            .simultaneousGesture(TapGesture().onEnded { dismiss() })
                        }

                        Button {
                            withAnimation(CinemaAnimation.fast) {
                                isRevealed = false
                                appeared = false
                            }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                startCycling()
                            }
                        } label: {
                            Text("TRY ANOTHER PICK")
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                        }
                        .buttonStyle(CinemaButtonStyle(variant: .ghost))

                        Button { dismiss() } label: {
                            Text("Dismiss")
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaSubtle)
                        }
                    }
                    .padding(.horizontal, CinemaSpacing.xl)
                    .padding(.bottom, CinemaSpacing.xxxl)
                } else {
                    Spacer().frame(height: 140 + CinemaSpacing.xxxl)
                }
            }
        }
        .onAppear {
            currentMovie = pool.randomElement() ?? selectedMovie
            startCycling()
        }
    }

    private func startCycling() {
        cycleCount = 0
        let totalCycles = 18
        let baseInterval: Double = 0.06

        func cycle() {
            guard cycleCount < totalCycles else {
                withAnimation(CinemaAnimation.slow) {
                    currentMovie = selectedMovie
                    isRevealed = true
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    withAnimation(CinemaAnimation.slow) { appeared = true }
                }
                HapticManager.shared.randomReveal()
                SoundManager.shared.play(.randomReveal)
                return
            }

            let progress = Double(cycleCount) / Double(totalCycles)
            let interval = baseInterval + (progress * progress * 0.4)

            withAnimation(CinemaAnimation.fast) {
                currentMovie = pool.randomElement() ?? selectedMovie
            }
            cycleCount += 1

            DispatchQueue.main.asyncAfter(deadline: .now() + interval) {
                cycle()
            }
        }

        cycle()
    }
}
