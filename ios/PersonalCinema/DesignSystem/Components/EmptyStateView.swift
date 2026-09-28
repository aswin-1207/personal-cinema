// EmptyStateView.swift - Personal Cinema Design System
import SwiftUI

struct EmptyStateView: View {
    let icon: String
    let title: String
    let subtitle: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    @State private var appeared = false

    var body: some View {
        VStack(spacing: CinemaSpacing.md) {
            ZStack {
                Circle()
                    .fill(Color.cinemaSurface)
                    .frame(width: 80, height: 80)
                Image(systemName: icon)
                    .font(.system(size: 34, weight: .light))
                    .foregroundColor(.cinemaGold)
            }
            .scaleEffect(appeared ? 1 : 0.8)
            .opacity(appeared ? 1 : 0)

            VStack(spacing: CinemaSpacing.xs) {
                Text(title)
                    .font(.cinemaH2)
                    .foregroundColor(.cinemaWhite)
                    .multilineTextAlignment(.center)

                Text(subtitle)
                    .font(.cinemaBody)
                    .foregroundColor(.cinemaSubtle)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, CinemaSpacing.xl)
            }
            .opacity(appeared ? 1 : 0)

            if let actionTitle = actionTitle, let action = action {
                Button(action: action) {
                    Text(actionTitle)
                        .kerning(1)
                }
                .buttonStyle(CinemaButtonStyle(variant: .primary))
                .padding(.top, CinemaSpacing.sm)
                .opacity(appeared ? 1 : 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(CinemaSpacing.xl)
        .onAppear {
            withAnimation(CinemaAnimation.normal) {
                appeared = true
            }
        }
    }
}
