# Personal Cinema 🎬

> **"Turn movie watching into an immersive cinema experience."**
> A 100% local-first, native iOS cinema movie tracking and movie-night application built with SwiftUI, SwiftData, and the TMDB API.

---

## 🌟 100% Local-First Architecture

```
Native SwiftUI iOS App ──▶ TMDB API (Catalog & Search metadata)
         │
         ▼
SwiftData Local Database (Single Source of Truth)
├── Movies Cache (LocalMovie)
├── User Library (LocalUserMovie: Watchlist, Watching, Watched)
├── Watch Sessions (LocalWatchSession: Screen timers)
├── Movie Collections (LocalCollection: Curated archives)
└── Reminders (LocalReminder: Movie night notifications)
```

### Key Highlights
* **Zero Backend, Zero Accounts:** No server, no database hosting, no user logins. The app launches immediately into your personal cinema.
* **Persistent SwiftData Core:** All user data (watchlist, watched status, ratings, reviews, watch timers, custom collections, and scheduled movie nights) persists permanently on device using Apple's modern SwiftData framework.
* **Direct TMDB Gateway:** Built-in native `TMDBService` queries The Movie Database directly over HTTPS with in-memory caching and offline fallback.
* **"Mark as Watched ✓" Core Control:** The tactile `WatchedControl` provides instant feedback across all views (icon-only, pill, and prominent styles) with custom bouncy animations, haptics, and cinema sound effects.
* **Offline Resilience:** Your watchlist, watched history, ratings, collections, movie night reminders, and watch timer function completely without internet connection.
* **Cinema Mode:** OLED true-black full-screen watch mode with an active countdown timer, ambient glowing poster, and auto-dimming controls.
* **Movie Night Scheduling:** Integrates with Apple `UserNotifications` for pre-screening alerts (e.g., 30 minutes before showtime).
* **Universal Importer:** On-device text and CSV parser matching titles directly against TMDB with confidence scoring and batch addition to your watchlist or watched archive.
* **Local Cinema Analytics:** Real-time on-device calculations for total screen time, watch streaks, favorite genres, and cinema milestone achievements.

---

## 📱 iOS Application (SwiftUI + SwiftData)

The native iOS client is located in `ios/PersonalCinema/`.

### Requirements
* macOS with Xcode 15.0+
* iOS 17.0+ deployment target
* Swift 5.9+

### Project Structure
```
ios/PersonalCinema/
├── App/
│   ├── PersonalCinemaApp.swift      # Main @main entry point & SwiftData container
│   ├── MainTabView.swift            # 5-tab cinema navigation bar
│   ├── Info.plist                   # iOS permissions & background modes
│   ├── PersonalCinema.entitlements  # Push notification entitlements
│   └── Assets.xcassets              # App icon & accent colors
├── Core/
│   ├── Network/
│   │   ├── TMDBService.swift        # Direct URLSession TMDB v3 API client & cache
│   │   └── Models.swift             # Codable movie & library models
│   ├── Storage/
│   │   ├── SwiftDataModels.swift    # @Model persistence classes (LocalMovie, LocalUserMovie...)
│   │   └── DataManager.swift        # Centralized SwiftData CRUD operations
│   ├── Services/
│   │   └── StatisticsService.swift  # On-device watch time, streaks, and achievements engine
│   ├── Haptics/
│   │   └── HapticManager.swift      # CoreHaptics & UIKit feedback curves
│   ├── Sound/
│   │   └── SoundManager.swift       # AVFoundation sound effects & cinema ambience
│   └── Notifications/
│       └── NotificationManager.swift# UserNotifications movie night scheduler
├── DesignSystem/
│   ├── CinemaTheme.swift            # Dark theme palette, typography, button styles
│   └── Components/
│       ├── WatchedControl.swift     # Core "Mark as Watched ✓" interactive control
│       ├── HeroMovieView.swift      # Parallax featured movie header
│       ├── MovieCard.swift          # 2:3 aspect poster cards with WatchedControl
│       ├── RatingControl.swift      # Half-star interactive rating widget
│       ├── EmptyStateView.swift     # Atmospheric cinema empty states
│       ├── LoadingShimmer.swift     # Shimmer skeleton loading effect
│       └── CinemaTicket.swift       # Perforated physical ticket archive receipt
└── Features/
    ├── Home/                        # Hero section, continue watching, streak badge
    ├── Discover/                    # Mood categories, genre filters, TMDB search & surprise me
    ├── Library/                     # Watchlist/Watched, grid/list, collections
    ├── MovieDetail/                 # Full credits, synopsis, watchlist & rate actions
    ├── CinemaMode/                  # OLED true-black active watch timer
    ├── WatchTimer/                  # Screening completion & ticket receipt
    ├── Calendar/                    # Month view with gold screening dots & scheduled movie nights
    ├── Profile/                     # 2x2 stats grid, genre chart, achievements, data export/settings
    └── Import/                      # Universal on-device CSV/text movie list importer
```

---

## 🛠️ Opening and Running the Project

1. Open `ios/PersonalCinema/PersonalCinema.xcodeproj` in **Xcode 15.0+** on macOS.
2. Select an iOS 17.0+ Simulator or physical iPhone as the build destination.
3. Press **Cmd + R** to run.
4. The application launches immediately into your personal cinema sanctuary.

---

## 🔑 TMDB Configuration

* A demonstration key is bundled for immediate out-of-the-box exploration.
* You can configure your personal TMDB API v3 key at any time by navigating to **Profile ➔ TMDB API Key Settings**.
