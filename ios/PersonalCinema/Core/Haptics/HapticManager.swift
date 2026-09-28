// HapticManager.swift - Personal Cinema Haptic Engine
import UIKit
import CoreHaptics
import SwiftUI

final class HapticManager {
    static let shared = HapticManager()

    @AppStorage("hapticsEnabled") var isEnabled: Bool = true

    private var engine: CHHapticEngine?

    private init() {}

    func prepare() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            engine = try CHHapticEngine()
            engine?.resetHandler = { [weak self] in
                try? self?.engine?.start()
            }
            engine?.stoppedHandler = { _ in }
            try engine?.start()
        } catch {
            print("HapticManager: Failed to start CoreHaptics engine: \(error)")
        }
    }

    // MARK: - Standard UI Feedback
    func tap() {
        guard isEnabled else { return }
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.prepare()
        generator.impactOccurred()
    }

    func selection() {
        guard isEnabled else { return }
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    func confirm() {
        guard isEnabled else { return }
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    func success() {
        guard isEnabled else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.success)
    }

    func error() {
        guard isEnabled else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(.error)
    }

    // MARK: - Cinematic CoreHaptics Patterns
    func cinemaStart() {
        guard isEnabled else { return }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
              let engine = engine else {
            confirm()
            return
        }

        var events: [CHHapticEvent] = []
        for i in 0..<5 {
            let time = TimeInterval(i) * 0.12
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: Float(0.3 + Double(i) * 0.14))
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.5)
            let event = CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: time)
            events.append(event)
        }

        do {
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            confirm()
        }
    }

    func movieComplete() {
        guard isEnabled else { return }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
              let engine = engine else {
            success()
            return
        }

        var events: [CHHapticEvent] = []
        let times: [TimeInterval] = [0, 0.15, 0.35]
        let intensities: [Float] = [0.5, 0.6, 1.0]
        let sharpnesses: [Float] = [0.4, 0.5, 0.9]

        for i in 0..<3 {
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: intensities[i])
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpnesses[i])
            let event = CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: times[i])
            events.append(event)
        }

        do {
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            success()
        }
    }

    func randomReveal() {
        guard isEnabled else { return }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
              let engine = engine else {
            selection()
            return
        }

        var events: [CHHapticEvent] = []
        var currentTime: TimeInterval = 0

        // Rapid ticks that slow down to a final hit
        let intervals: [TimeInterval] = [0.05, 0.07, 0.09, 0.12, 0.16, 0.22, 0.30, 0.40]
        for interval in intervals {
            let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.6)
            let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.8)
            let event = CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: currentTime)
            events.append(event)
            currentTime += interval
        }

        let finalIntensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 1.0)
        let finalSharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 1.0)
        let finalEvent = CHHapticEvent(eventType: .hapticTransient, parameters: [finalIntensity, finalSharpness], relativeTime: currentTime + 0.1)
        events.append(finalEvent)

        do {
            let pattern = try CHHapticPattern(events: events, parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            confirm()
        }
    }

    func ratingSelect() {
        guard isEnabled else { return }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics,
              let engine = engine else {
            tap()
            return
        }

        let intensity = CHHapticEventParameter(parameterID: .hapticIntensity, value: 0.7)
        let sharpness = CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.9)
        let event = CHHapticEvent(eventType: .hapticTransient, parameters: [intensity, sharpness], relativeTime: 0)

        do {
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine.makePlayer(with: pattern)
            try player.start(atTime: CHHapticTimeImmediate)
        } catch {
            tap()
        }
    }
}
