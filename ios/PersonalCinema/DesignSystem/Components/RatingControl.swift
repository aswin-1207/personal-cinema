// RatingControl.swift - Personal Cinema Design System
import SwiftUI

struct RatingControl: View {
    @Binding var rating: Double?
    var maxRating: Int = 5
    var starSize: CGFloat = 28
    var allowHalf: Bool = true
    var interactive: Bool = true

    var body: some View {
        HStack(spacing: 8) {
            ForEach(1...maxRating, id: \.self) { index in
                starView(for: index)
                    .onTapGesture { location in
                        if interactive {
                            let value = Double(index)
                            if allowHalf && location.x < (starSize / 2) {
                                rating = value - 0.5
                            } else {
                                rating = value
                            }
                            HapticManager.shared.ratingSelect()
                        }
                    }
            }

            if let r = rating {
                Text(String(format: "%.1f", r))
                    .font(.cinemaH3)
                    .foregroundColor(.cinemaGold)
                    .padding(.leading, 8)
            }
        }
    }

    @ViewBuilder
    private func starView(for index: Int) -> some View {
        let current = rating ?? 0.0
        let fillType: StarFillType = {
            if current >= Double(index) {
                return .full
            } else if current >= Double(index) - 0.5 {
                return .half
            } else {
                return .empty
            }
        }()

        ZStack {
            switch fillType {
            case .full:
                Image(systemName: "star.fill")
                    .foregroundColor(.cinemaStar)
            case .half:
                Image(systemName: "star.leadinghalf.filled")
                    .foregroundColor(.cinemaStar)
            case .empty:
                Image(systemName: "star")
                    .foregroundColor(.cinemaStarEmpty)
            }
        }
        .font(.system(size: starSize))
    }

    private enum StarFillType {
        case full, half, empty
    }
}
