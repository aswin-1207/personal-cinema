# Personal Cinema — macOS & Xcode Build Guide 🎬

This guide explains how to take the Personal Cinema iOS project from this repository, open it in Xcode on a Mac, build it, run it on a simulator or physical iPhone, and export a signed `.ipa` package for installation.

---

## ⚠️ Important Note Regarding the Windows Environment

The project source code, SwiftData models, TMDB networking client, design system, and Xcode project bundles (`PersonalCinema.xcodeproj`) were authored and structured in a Windows development environment.

**Apple's proprietary compilation toolchain (`xcodebuild`, `clang`, `swiftc` targeting Darwin/iOS, `codesign`, and the iOS SDK) is only available on macOS.** 

Therefore, creating the compiled binary (`.app`), Xcode Archive (`.xcarchive`), and signed installable package (`.ipa`) must be performed on a Mac running **Xcode 15.0+** with **iOS 17.0+ SDK**.

---

## 📦 Understanding iOS Build Artifacts

| Artifact | What It Is | Purpose | Can Windows Create It? |
|---|---|---|:---:|
| **`.xcodeproj`** | Directory package containing `project.pbxproj`, schemes, and workspace configuration. | Tells Xcode how to organize, link, compile, and configure source files and resources. | **YES** (Created and verified) |
| **`.app`** | Compiled, uncompressed Mach-O binary bundle for iOS/ARM64. | The executable output run on the simulator or physical device during development. | **NO** (Requires macOS Xcode Clang/Swiftc) |
| **`.xcarchive`** | Comprehensive archive directory containing the compiled `.app`, dSYM debugging symbols, and compilation metadata. | The source artifact created by `Product > Archive` before app distribution. | **NO** (Requires macOS `xcodebuild archive`) |
| **`.ipa`** | Compressed (ZIP format) package containing `Payload/PersonalCinema.app`, embedded mobileprovision, and cryptographic signature (`_CodeSignature`). | The installable package distributed to physical iPhones via TestFlight, App Store, or Ad Hoc deployment. | **NO** (Requires Apple codesigning on macOS) |

---

## 🚀 Step-by-Step macOS Build & Installation Process

### 1. Transfer Project to Mac
Copy or clone the entire repository directory (`movie tracker`) onto your Mac.
Ensure the directory structure is preserved:
```
movie tracker/
├── PersonalCinema.xcodeproj/
├── ios/
│   └── PersonalCinema/
│       ├── App/
│       ├── Core/
│       ├── DesignSystem/
│       └── Features/
├── README.md
└── BUILD_IOS.md
```

### 2. Open in Xcode 15+
Double-click `PersonalCinema.xcodeproj` or open via Terminal:
```bash
cd "movie tracker"
open PersonalCinema.xcodeproj
```

### 3. Select Target & Destination
* In the Xcode toolbar at the top, verify the target is set to **PersonalCinema**.
* Select your run destination:
  * **iPhone 15 / 16 Simulator** (for immediate testing without an Apple Developer account).
  * Or your **Physical iPhone** (connected via USB or Wi-Fi).

### 4. Configure Apple Signing (For Physical Device)
If building for a physical iPhone:
1. In the Project Navigator (left sidebar), click the top-level **PersonalCinema** blue project icon.
2. Select the **PersonalCinema** target.
3. Click the **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. Select your **Team** (Personal Team or Apple Developer Team).
6. If the Bundle Identifier `com.personalcinema.app` is already claimed on Apple's developer portal, change it to your own unique ID (e.g., `com.yourname.personalcinema`).

### 5. Build & Run (Simulator or Device)
* Press **Cmd + R** or click the **Play** button in the Xcode toolbar.
* Xcode compiles the Swift 5.9 source files, links SwiftData and system frameworks, and launches Personal Cinema directly onto the target device or simulator.

---

## 📲 Generating and Exporting a Signed `.ipa` (Distribution / Ad Hoc)

To produce an installable `.ipa` for physical iPhones:

### 1. Create Xcode Archive
* In the destination dropdown, select **Any iOS Device (arm64)**.
* In the menu bar, select **Product ➔ Archive**.
* Wait for the build and compilation to finish.

### 2. Export via Xcode Organizer
1. Once archiving finishes, the **Xcode Organizer** window opens automatically (or open it via **Window ➔ Organizer**).
2. Select the latest build under **Archives**.
3. Click the blue **Distribute App** button on the right.
4. Select your distribution method:
   * **App Store Connect** (for TestFlight or App Store release).
   * **Development** or **Ad Hoc** (for direct device installation with registered UDIDs).
5. Follow the prompts to allow Xcode to sign the build with your certificate and provisioning profile.
6. Click **Export** and choose a folder.
7. Inside the exported folder, you will find `PersonalCinema.ipa`.

### 3. Install the `.ipa` onto an iPhone
You can install the exported `.ipa` using any of the following standard methods:
* **Apple Configurator** (macOS): Drag and drop the `.ipa` onto the connected iPhone.
* **Xcode Devices & Simulators** (`Window ➔ Devices and Simulators`): Select your iPhone, and drag the `.ipa` into the **Installed Apps** section.
* **AirDrop / Sideloading**: Use your preferred deployment tool (e.g. TestFlight, AltStore, Sideloadly).

---

## 🛠️ Offline Verification & Configuration

* **TMDB API Key:** A pre-configured demo key is included so the app discovers movies immediately upon launch. To use your personal TMDB API v3 key, navigate to **Profile ➔ TMDB API Key Settings** inside the app.
* **SwiftData:** All user ratings, watchlist items, watched records, screening sessions, and collections are saved to local persistent storage on the device with zero server dependency.
* **Backup/Restore:** In **Profile**, you can export a full JSON backup of your entire library or restore it safely onto any device.
