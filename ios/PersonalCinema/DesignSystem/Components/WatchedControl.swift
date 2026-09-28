// WatchedControl.swift - Personal Cinema Core "Mark as Watched ✓" Control
import SwiftUI

enum WatchedControlStyle {
    case iconOnly       // Compact circular checkmark for movie cards & list rows
    case pill           // Pill button with "Mark as Watched ✓" text
    case prominent      // Large full-width action button for Movie Detail
}

struct WatchedControl: View {
    @Binding var isWatched: Bool
    var style: WatchedControlStyle = .iconOnly
    var onWatched: (() -> Void)? = nil
    var onUnwatched: (() -> Void)? = nil

    @State private var isAnimating = false
    @State private var scale: CGFloat = 1.0

    var body: some View {
        Button {
            toggleWatched()
        } label: {
            switch style {
            case .iconOnly:
                iconOnlyView
            case .pill:
                pillView
            case .prominent:
                prominentView
            }
        }
        .buttonStyle(.plain)
        .scaleEffect(scale)
        .accessibilityLabel(isWatched ? "Marked as Watched" : "Mark as Watched")
    }

    // MARK: - Subviews
    private var iconOnlyView: some View {
        ZStack {
            Circle()
                .fill(isWatched ? Color.cinemaGold : Color.cinemaSurface.opacity(0.85))
                .frame(width: 32, height: 32)
                .overlay(
                    Circle()
                        .strokeBorder(isWatched ? Color.cinemaGold : Color.white.opacity(0.2), lineWidth: 1)
                )
                .shadow(color: isWatched ? Color.cinemaGold.opacity(0.4) : Color.clear, radius: 8, x: 0, y: 2)

            Image(systemName: isWatched ? "checkmark" : "plus")
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(isWatched ? Color.cinemaBlack : Color.cinemaWhite)
                .rotationEffect(.degrees(isAnimating ? 360 : 0))
        }
    }

    private var pillView: some View {
        HStack(spacing: 6) {
            Image(systemName: isWatched ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(isWatched ? Color.cinemaGold : Color.cinemaSubtle)

            Text(isWatched ? "WATCHED ✓" : "MARK WATCHED")
                .font(.cinemaLabel)
                .foregroundColor(isWatched ? Color.cinemaGold : Color.cinemaWhite)
                .kerning(1.2)
        }
        .padding(.horizontal, CinemaSpacing.md)
        .padding(.vertical, CinemaSpacing.sm)
        .background(isWatched ? Color.cinemaGold.opacity(0.15) : Color.cinemaSurface)
        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.pill))
        .overlay(
            RoundedRectangle(cornerRadius: CinemaRadius.pill)
                .strokeBorder(isWatched ? Color.cinemaGold.opacity(0.6) : Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    private var prominentView: some View {
        HStack(spacing: CinemaSpacing.sm) {
            ZStack {
                Circle()
                    .fill(isWatched ? Color.cinemaGold : Color.clear)
                    .frame(width: 22, height: 22)
                    .overlay(
                        Circle()
                            .strokeBorder(isWatched ? Color.cinemaGold : Color.cinemaGold, lineWidth: 1.5)
                    )

                if isWatched {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .black))
                        .foregroundColor(.cinemaBlack)
                }
            }

            Text(isWatched ? "WATCHED ✓" : "MARK AS WATCHED")
                .font(.cinemaBodyMedium)
                .foregroundColor(isWatched ? Color.cinemaGold : Color.cinemaWhite)
                .kerning(1.5)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 50)
        .background(isWatched ? Color.cinemaGold.opacity(0.15) : Color.cinemaSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: CinemaRadius.md)
                .strokeBorder(isWatched ? Color.cinemaGold : Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    // MARK: - Action
    private func toggleWatched() {
        // Haptic feedback
        if !isWatched {
            HapticManager.shared.success()
            SoundManager.shared.play(.confirm)
        } else {
            HapticManager.shared.tap()
        }

        // Satisfying pop / bounce animation
        withAnimation(.spring(response: 0.25, dampingFraction: 0.5, blendDuration: 0)) {
            scale = 1.25
            isAnimating = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                scale = 1.0
                isWatched.toggle()
                isAnimating = false
            }

            if isWatched {
                onWatched?()
            } else {
                onUnwatched?()
            }
        }
    }
}
