// MainTabView.swift - Personal Cinema Navigation
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("Home", systemImage: selectedTab == 0 ? "house.fill" : "house")
            }
            .tag(0)

            NavigationStack {
                DiscoverView()
            }
            .tabItem {
                Label("Discover", systemImage: selectedTab == 1 ? "safari.fill" : "safari")
            }
            .tag(1)

            NavigationStack {
                LibraryView()
            }
            .tabItem {
                Label("Library", systemImage: "books.vertical.fill")
            }
            .tag(2)

            NavigationStack {
                CalendarView()
            }
            .tabItem {
                Label("Calendar", systemImage: selectedTab == 3 ? "calendar" : "calendar")
            }
            .tag(3)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("Profile", systemImage: selectedTab == 4 ? "person.circle.fill" : "person.circle")
            }
            .tag(4)
        }
        .tint(Color.cinemaGold)
        .background(Color.cinemaBlack)
        .onChange(of: selectedTab) { _, _ in
            HapticManager.shared.selection()
        }
    }
}
