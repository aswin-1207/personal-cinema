// CinemaTheme.swift - Personal Cinema Design System
import SwiftUI

// MARK: - Color Palette
extension Color {
    // Backgrounds - CINEMA AFTER DARK
    static let cinemaBlack = Color(red: 0.05, green: 0.05, blue: 0.07)           // #0D0D12
    static let cinemaDeepNavy = Color(red: 0.06, green: 0.07, blue: 0.12)        // #0F1220
    static let cinemaCharcoal = Color(red: 0.12, green: 0.13, blue: 0.16)        // #1E2029
    static let cinemaSurface = Color(red: 0.15, green: 0.16, blue: 0.20)         // #262833
    static let cinemaSurfaceElevated = Color(red: 0.20, green: 0.21, blue: 0.26) // #333542

    // Accents
    static let cinemaGold = Color(red: 0.93, green: 0.76, blue: 0.34)            // #EDC257 - primary accent
    static let cinemaAmber = Color(red: 0.85, green: 0.61, blue: 0.20)           // #D99C33
    static let cinemaCrimson = Color(red: 0.72, green: 0.11, blue: 0.16)         // #B81C28 - red accent
    static let cinemaCrimsonSoft = Color(red: 0.85, green: 0.25, blue: 0.30)     // #D94048

    // Typography
    static let cinemaWhite = Color(red: 0.96, green: 0.95, blue: 0.94)           // #F5F2F0
    static let cinemaSilver = Color(red: 0.72, green: 0.71, blue: 0.70)          // #B7B5B3
    static let cinemaSubtle = Color(red: 0.45, green: 0.44, blue: 0.46)          // #737177

    // Stars
    static let cinemaStar = Color(red: 0.93, green: 0.76, blue: 0.34)
    static let cinemaStarEmpty = Color(red: 0.30, green: 0.30, blue: 0.35)
}

// MARK: - Typography
extension Font {
    // Display - Hero titles
    static let cinemaDisplay = Font.custom("Georgia", size: 32).weight(.bold)
    static let cinemaDisplayLarge = Font.custom("Georgia", size: 42).weight(.bold)

    // Headlines
    static let cinemaH1 = Font.system(size: 28, weight: .bold, design: .default)
    static let cinemaH2 = Font.system(size: 22, weight: .semibold, design: .default)
    static let cinemaH3 = Font.system(size: 18, weight: .semibold, design: .default)

    // Body
    static let cinemaBody = Font.system(size: 16, weight: .regular, design: .default)
    static let cinemaBodyMedium = Font.system(size: 16, weight: .medium, design: .default)
    static let cinemaCaption = Font.system(size: 13, weight: .regular, design: .default)
    static let cinemaCaptionMedium = Font.system(size: 13, weight: .medium, design: .default)
    static let cinemaLabel = Font.system(size: 11, weight: .semibold, design: .default)

    // Monospace for timer
    static let cinemaTimer = Font.system(size: 48, weight: .thin, design: .monospaced)
    static let cinemaTimerSmall = Font.system(size: 28, weight: .light, design: .monospaced)
}

// MARK: - Spacing
struct CinemaSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    static let xxxl: CGFloat = 64
}

// MARK: - Corner Radius
struct CinemaRadius {
    static let sm: CGFloat = 6
    static let md: CGFloat = 12
    static let lg: CGFloat = 18
    static let xl: CGFloat = 24
    static let pill: CGFloat = 999
}

// MARK: - Animation
struct CinemaAnimation {
    static let fast = Animation.easeInOut(duration: 0.2)
    static let normal = Animation.easeInOut(duration: 0.35)
    static let slow = Animation.easeInOut(duration: 0.6)
    static let spring = Animation.spring(response: 0.4, dampingFraction: 0.75)
    static let springBouncy = Animation.spring(response: 0.5, dampingFraction: 0.65)
    static let cinematic = Animation.easeInOut(duration: 0.8)
}

// MARK: - View Modifiers
struct CinemaCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Color.cinemaSurface)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: CinemaRadius.md)
                    .strokeBorder(Color.white.opacity(0.06), lineWidth: 0.5)
            )
    }
}

struct CinemaButtonStyle: ButtonStyle {
    let variant: CinemaButtonVariant

    enum CinemaButtonVariant {
        case primary    // Gold fill
        case secondary  // Gold outline
        case ghost      // Subtle transparent
        case danger     // Crimson red
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.cinemaBodyMedium)
            .foregroundColor(foregroundColor)
            .padding(.horizontal, CinemaSpacing.lg)
            .padding(.vertical, CinemaSpacing.md)
            .background(backgroundColor(isPressed: configuration.isPressed))
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
            .overlay(
                Group {
                    if variant == .secondary {
                        RoundedRectangle(cornerRadius: CinemaRadius.md)
                            .strokeBorder(Color.cinemaGold.opacity(0.8), lineWidth: 1)
                    }
                }
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(CinemaAnimation.fast, value: configuration.isPressed)
    }

    private var foregroundColor: Color {
        switch variant {
        case .primary: return .cinemaBlack
        case .secondary: return .cinemaGold
        case .ghost: return .cinemaWhite
        case .danger: return .cinemaWhite
        }
    }

    private func backgroundColor(isPressed: Bool) -> Color {
        let opacity = isPressed ? 0.85 : 1.0
        switch variant {
        case .primary: return .cinemaGold.opacity(opacity)
        case .secondary: return .cinemaGold.opacity(0.08 * opacity)
        case .ghost: return .white.opacity(0.06 * opacity)
        case .danger: return .cinemaCrimson.opacity(opacity)
        }
    }
}

extension View {
    func cinemaCard() -> some View {
        modifier(CinemaCardStyle())
    }

    func cinemaSectionHeader(_ title: String) -> some View {
        VStack(alignment: .leading, spacing: CinemaSpacing.xs) {
            self
            Text(title)
                .font(.cinemaLabel)
                .foregroundColor(.cinemaSubtle)
                .kerning(1.5)
                .textCase(.uppercase)
        }
    }
}
