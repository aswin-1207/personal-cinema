// WatchCompletionView.swift - Personal Cinema Movie Completion & Ticket
import SwiftUI

struct WatchCompletionView: View {
    let movie: MovieBrief
    let duration: Int // minutes
    let onComplete: (Double?, String?) -> Void

    @State private var rating: Double? = nil
    @State private var reviewText: String = ""
    @State private var isFavorite: Bool = false
    @State private var appeared = false
    @Environment(\.dismiss) private var dismiss

    private var formattedDuration: String {
        let h = duration / 60
        let m = duration % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    var body: some View {
        ZStack {
            Color.cinemaBlack.ignoresSafeArea()

            ScrollView {
                VStack(spacing: CinemaSpacing.xl) {
                    // Header Celebration
                    VStack(spacing: CinemaSpacing.sm) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 56, weight: .thin))
                            .foregroundColor(.cinemaGold)
                            .scaleEffect(appeared ? 1 : 0.5)
                            .animation(CinemaAnimation.springBouncy.delay(0.1), value: appeared)

                        Text("SCREENING FINISHED")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaGold)
                            .kerning(3)

                        Text(movie.title)
                            .font(.cinemaH1)
                            .foregroundColor(.cinemaWhite)
                            .multilineTextAlignment(.center)

                        HStack(spacing: CinemaSpacing.md) {
                            Label(Date().formatted(date: .abbreviated, time: .omitted), systemImage: "calendar")
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaSubtle)

                            if duration > 0 {
                                Label(formattedDuration, systemImage: "clock")
                                    .font(.cinemaCaption)
                                    .foregroundColor(.cinemaSubtle)
                            }
                        }
                    }
                    .padding(.top, CinemaSpacing.xl)

                    // Cinema Ticket Receipt Card
                    CinemaTicket(
                        movie: movie,
                        watchedAt: Date(),
                        rating: rating,
                        duration: duration
                    )
                    .padding(.horizontal, CinemaSpacing.md)
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.2), value: appeared)

                    // Half-Star Rating Control
                    VStack(spacing: CinemaSpacing.sm) {
                        Text("YOUR RATING")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaSubtle)
                            .kerning(2)

                        RatingControl(rating: $rating, starSize: 32)
                    }
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.3), value: appeared)

                    // Notes / Mini Review Editor
                    VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
                        Text("PERSONAL THOUGHTS & NOTES")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaSubtle)
                            .kerning(1.5)

                        TextEditor(text: $reviewText)
                            .foregroundColor(.cinemaWhite)
                            .tint(.cinemaGold)
                            .frame(minHeight: 80)
                            .padding(CinemaSpacing.sm)
                            .background(Color.cinemaSurface)
                            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))
                            .colorScheme(.dark)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, CinemaSpacing.md)
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.4), value: appeared)

                    // Favorite Toggle
                    Button {
                        isFavorite.toggle()
                        HapticManager.shared.tap()
                    } label: {
                        HStack {
                            Image(systemName: isFavorite ? "heart.fill" : "heart")
                                .foregroundColor(isFavorite ? .cinemaCrimsonSoft : .cinemaSubtle)
                            Text(isFavorite ? "Saved to Favorites" : "Add to Favorites")
                                .foregroundColor(isFavorite ? .cinemaWhite : .cinemaSubtle)
                                .font(.cinemaBodyMedium)
                            Spacer()
                        }
                        .padding(CinemaSpacing.md)
                        .cinemaCard()
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, CinemaSpacing.md)
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.5), value: appeared)

                    // Save & Finish
                    Button {
                        onComplete(rating, reviewText.isEmpty ? nil : reviewText)
                        HapticManager.shared.success()
                        SoundManager.shared.play(.ticketPrint)
                        dismiss()
                    } label: {
                        Text("SAVE TO CINEMA ARCHIVE")
                            .kerning(1.5)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                    }
                    .buttonStyle(CinemaButtonStyle(variant: .primary))
                    .padding(.horizontal, CinemaSpacing.md)
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.6), value: appeared)

                    Spacer(minLength: CinemaSpacing.xxl)
                }
            }
        }
        .onAppear {
            withAnimation { appeared = true }
        }
    }
}
