// PersonalCinemaApp.swift - Main Application Entry Point (100% Local-First)
import SwiftUI
import SwiftData
import UserNotifications

@main
struct PersonalCinemaApp: App {
    private let modelContainer: ModelContainer

    init() {
        let schema = Schema([
            LocalMovie.self,
            LocalUserMovie.self,
            LocalWatchSession.self,
            LocalCollection.self,
            LocalReminder.self
        ])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            modelContainer = try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("PersonalCinema: Failed to create ModelContainer: \(error)")
        }

        // Configure 50MB RAM / 200MB Disk persistent image cache for TMDB artwork
        let cache = URLCache(memoryCapacity: 50 * 1024 * 1024, diskCapacity: 200 * 1024 * 1024, diskPath: "tmdb_artwork_cache")
        URLCache.shared = cache

        configureAppearance()
        HapticManager.shared.prepare()

        Task {
            _ = await NotificationManager.shared.requestPermission()
        }
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(modelContainer)
    }

    private func configureAppearance() {
        // Navigation Bar styling
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(Color.cinemaBlack)
        navAppearance.titleTextAttributes = [
            .foregroundColor: UIColor(Color.cinemaWhite),
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold)
        ]
        navAppearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(Color.cinemaWhite),
            .font: UIFont.systemFont(ofSize: 34, weight: .bold)
        ]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().tintColor = UIColor(Color.cinemaGold)

        // Tab Bar styling
        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Color.cinemaBlack)
        tabAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.cinemaSubtle)
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor(Color.cinemaSubtle)]
        tabAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.cinemaGold)
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(Color.cinemaGold)]
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }
}
