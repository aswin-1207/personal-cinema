// SoundManager.swift - Personal Cinema Audio Experience
import AVFoundation
import Foundation
import SwiftUI

enum Sound: String, CaseIterable {
    case tap = "tap"
    case confirm = "confirm"
    case error = "error"
    case cinemaStart = "cinema_start"
    case ticketPrint = "ticket_print"
    case movieComplete = "movie_complete"
    case randomReveal = "random_reveal"

    var filename: String { rawValue }
    var fileExtension: String { "mp3" }
}

final class SoundManager: ObservableObject {
    static let shared = SoundManager()

    @AppStorage("soundEnabled") var isEnabled: Bool = true
    @AppStorage("cinemaAmbienceEnabled") var ambienceEnabled: Bool = false
    @AppStorage("soundVolume") var volume: Double = 0.8

    private var players: [Sound: AVAudioPlayer] = [:]
    private var ambiencePlayer: AVAudioPlayer?

    private init() {
        configureAudioSession()
        preloadSounds()
    }

    private func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: .mixWithOthers)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("SoundManager: Audio session configuration warning: \(error)")
        }
    }

    private func preloadSounds() {
        for sound in Sound.allCases {
            guard let url = Bundle.main.url(forResource: sound.filename, withExtension: sound.fileExtension) else {
                continue // Safe fallback when resource files are not bundled yet
            }
            do {
                let player = try AVAudioPlayer(contentsOf: url)
                player.prepareToPlay()
                players[sound] = player
            } catch {
                print("SoundManager: Could not preload \(sound.filename): \(error)")
            }
        }
    }

    func play(_ sound: Sound) {
        guard isEnabled else { return }
        guard let player = players[sound] else { return }
        player.volume = Float(volume)
        if player.isPlaying {
            player.stop()
            player.currentTime = 0
        }
        player.play()
    }

    func startAmbience() {
        guard ambienceEnabled && isEnabled else { return }
        guard let url = Bundle.main.url(forResource: "cinema_ambience", withExtension: "mp3") else { return }
        do {
            ambiencePlayer = try AVAudioPlayer(contentsOf: url)
            ambiencePlayer?.numberOfLoops = -1
            ambiencePlayer?.volume = Float(volume * 0.25)
            ambiencePlayer?.play()
        } catch {
            print("SoundManager: Ambience player error: \(error)")
        }
    }

    func stopAmbience() {
        ambiencePlayer?.stop()
        ambiencePlayer = nil
    }

    func setVolume(_ newVolume: Double) {
        volume = newVolume
        players.values.forEach { $0.volume = Float(newVolume) }
        ambiencePlayer?.volume = Float(newVolume * 0.25)
    }
}
