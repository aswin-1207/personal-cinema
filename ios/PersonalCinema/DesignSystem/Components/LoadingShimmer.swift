// LoadingShimmer.swift - Personal Cinema Design System
import SwiftUI

struct ShimmerModifier: ViewModifier {
    let isLoading: Bool
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        if isLoading {
            content
                .overlay(
                    GeometryReader { geo in
                        LinearGradient(
                            stops: [
                                .init(color: .clear, location: 0),
                                .init(color: Color.white.opacity(0.08), location: 0.5),
                                .init(color: .clear, location: 1)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .rotationEffect(.degrees(30))
                        .offset(x: -geo.size.width + (geo.size.width * 2 * phase))
                    }
                )
                .clipped()
                .onAppear {
                    withAnimation(Animation.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                        phase = 1.0
                    }
                }
        } else {
            content
        }
    }
}

struct ShimmerBox: View {
    let width: CGFloat?
    let height: CGFloat

    init(width: CGFloat? = nil, height: CGFloat) {
        self.width = width
        self.height = height
    }

    var body: some View {
        RoundedRectangle(cornerRadius: CinemaRadius.sm)
            .fill(Color.cinemaSurface)
            .frame(height: height)
            .frame(maxWidth: width ?? .infinity)
            .shimmer(isLoading: true)
    }
}

extension View {
    func shimmer(isLoading: Bool = true) -> some View {
        modifier(ShimmerModifier(isLoading: isLoading))
    }
}
