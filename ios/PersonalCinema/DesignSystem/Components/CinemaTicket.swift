// CinemaTicket.swift - Personal Cinema Design System
import SwiftUI

struct CinemaTicket: View {
    let movie: MovieBrief
    let watchedAt: Date
    let rating: Double?
    let duration: Int // minutes

    private var formattedDuration: String {
        let h = duration / 60
        let m = duration % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Main Ticket Body
            HStack(spacing: CinemaSpacing.md) {
                // Movie Poster Thumbnail
                AsyncImage(url: movie.posterURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        Color.cinemaCharcoal
                    }
                }
                .frame(width: 70, height: 105)
                .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.sm))

                VStack(alignment: .leading, spacing: 4) {
                    Text("PERSONAL CINEMA ARCHIVE")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaGold)
                        .kerning(1.5)

                    Text(movie.title)
                        .font(.cinemaH3)
                        .foregroundColor(.cinemaWhite)
                        .lineLimit(2)

                    HStack(spacing: CinemaSpacing.sm) {
                        Text(watchedAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.cinemaCaption)
                            .foregroundColor(.cinemaSubtle)

                        if duration > 0 {
                            Text("•")
                                .foregroundColor(.cinemaSubtle)
                            Text(formattedDuration)
                                .font(.cinemaCaption)
                                .foregroundColor(.cinemaSubtle)
                        }
                    }

                    if let r = rating {
                        HStack(spacing: 3) {
                            ForEach(1...5, id: \.self) { i in
                                Image(systemName: Double(i) <= r ? "star.fill" : (Double(i) - 0.5 <= r ? "star.leadinghalf.filled" : "star"))
                                    .font(.system(size: 10))
                                    .foregroundColor(.cinemaStar)
                            }
                            Text(String(format: "%.1f", r))
                                .font(.cinemaLabel)
                                .foregroundColor(.cinemaWhite)
                                .padding(.leading, 4)
                        }
                        .padding(.top, 2)
                    }
                }

                Spacer()
            }
            .padding(CinemaSpacing.md)

            // Perforated Divider
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.cinemaBlack)
                    .frame(width: 16, height: 16)
                    .offset(x: -8)

                Line()
                    .stroke(style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .foregroundColor(Color.white.opacity(0.15))
                    .frame(height: 1)

                Circle()
                    .fill(Color.cinemaBlack)
                    .frame(width: 16, height: 16)
                    .offset(x: 8)
            }
            .frame(height: 16)

            // Ticket Stub / Footer
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "film")
                        .font(.system(size: 10))
                    Text("VERIFIED SCREENING")
                        .font(.cinemaLabel)
                        .kerning(1.5)
                }
                .foregroundColor(.cinemaSubtle)

                Spacer()

                Text("SEAT 01 • SCREEN A")
                    .font(.cinemaLabel)
                    .foregroundColor(.cinemaGold.opacity(0.7))
                    .kerning(1)
            }
            .padding(.horizontal, CinemaSpacing.md)
            .padding(.vertical, CinemaSpacing.sm)
        }
        .background(Color.cinemaSurface)
        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: CinemaRadius.md)
                .strokeBorder(Color.cinemaGold.opacity(0.3), lineWidth: 0.8)
        )
    }
}

// Helper dashed line shape
struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.width, y: rect.midY))
        return path
    }
}
