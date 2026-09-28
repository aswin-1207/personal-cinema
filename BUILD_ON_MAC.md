# Personal Cinema — macOS/Xcode Physical iPhone Build & Archive Guide 📲

This guide provides the exact, foolproof procedure to build, run on a physical iPhone, and export an installable `.ipa` from `PersonalCinema.xcodeproj` on macOS.

---

## 🛠 Prerequisites

* **Mac** running macOS Sonoma 14.0+ (or Ventura 13.5+)
* **Xcode 15.0+** (includes iOS 17.0+ SDK and Swift 5.9 compiler)
* **Physical iPhone** running iOS 17.0+ (or iOS Simulator)
* **Apple ID** (Free Personal Team or Paid Apple Developer Program)
* Lightning or USB-C cable (for initial physical iPhone connection)

---

## 📋 Step-by-Step Instructions

### Step 1: Transfer Workspace to Mac
Transfer the entire `movie tracker` folder onto your Mac (via AirDrop, USB, Git, or ZIP).
Make sure the folder contains:
* `PersonalCinema.xcodeproj/`
* `ios/PersonalCinema/` (source files, assets, and configurations)

```bash
# Verify structure in Terminal
cd "movie tracker"
ls -la PersonalCinema.xcodeproj
```

---

### Step 2: Open Project in Xcode
Double-click `PersonalCinema.xcodeproj` in Finder, or run:
```bash
open PersonalCinema.xcodeproj
```

---

### Step 3: Configure Code Signing
1. In Xcode's left sidebar (Project Navigator), click on the top-level **PersonalCinema** blue project icon.
2. Under **TARGETS**, select **PersonalCinema**.
3. Select the **Signing & Capabilities** tab.
4. Check **"Automatically manage signing"**.
5. In the **Team** dropdown, select your name/team:
   * **Free Apple ID**: Select `Your Name (Personal Team)`.
   * **Paid Account**: Select your Developer Program Team.
6. **Bundle Identifier**:
   * Default: `com.personalcinema.app`
   * If Xcode shows *"Failed to register bundle identifier"*, simply change it to a unique suffix (e.g., `com.yourname.personalcinema`).

> [!NOTE]
> All push notification (`aps-environment`) entitlements and legacy background modes have already been sanitized. Free personal Apple ID accounts will sign and build without errors.

---

### Step 4: Enable Developer Mode on iPhone (iOS 17+)
If running on a physical iPhone for the first time:
1. Connect your iPhone to your Mac via cable.
2. Tap **"Trust This Computer"** on the iPhone and enter your passcode.
3. On the iPhone, go to **Settings ➔ Privacy & Security ➔ Developer Mode**.
4. Toggle **Developer Mode ON** and tap **Restart**.
5. After reboot, unlock your iPhone and tap **Turn On** to confirm.

---

### Step 5: Run on Physical Device
1. In the top toolbar of Xcode, click the destination selector next to `PersonalCinema`.
2. Select your connected **iPhone** from the device list.
3. Click the **Run** button (or press `Cmd + R`).
4. Xcode compiles the Swift source files, builds the Mach-O binary, signs the application bundle, and installs it onto your device.
5. If an "Untrusted Developer" prompt appears when launching the app:
   * On iPhone: Go to **Settings ➔ General ➔ VPN & Device Management**.
   * Under **Developer App**, tap your Apple ID and tap **Trust**.
   * Re-open Personal Cinema from your home screen.

---

### Step 6: Create Xcode Archive & Export Signed `.ipa`

To produce a standalone, installable `.ipa` package for Ad Hoc distribution or archiving:

#### Via Xcode GUI:
1. In the destination dropdown, select **Any iOS Device (arm64)**.
2. In the top menu bar, select **Product ➔ Archive**.
3. Xcode builds and packages the application. When complete, the **Organizer** window opens.
4. Select the new archive and click **Distribute App** (blue button on right).
5. Choose your distribution path:
   * **App Store Connect / TestFlight** (Paid Developer Account)
   * **Development / Ad Hoc** (for registered test devices)
6. Complete the prompt, click **Export**, and select a destination folder.
7. Your signed `.ipa` file will be generated in that folder.

#### Via Terminal (`xcodebuild` CLI):
```bash
# 1. Clean build
xcodebuild clean -project PersonalCinema.xcodeproj -scheme PersonalCinema

# 2. Build Archive
xcodebuild archive \
  -project PersonalCinema.xcodeproj \
  -scheme PersonalCinema \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath ./build/PersonalCinema.xcarchive

# 3. Export IPA (using exportOptions.plist)
xcodebuild -exportArchive \
  -archivePath ./build/PersonalCinema.xcarchive \
  -exportPath ./build/ipa \
  -exportOptionsPlist ./exportOptions.plist
```

---

## 🔍 Troubleshooting Guide

| Issue | Cause | Fix |
|---|---|---|
| `Failed to register bundle identifier` | Bundle ID already claimed globally in Apple's registry. | Change Bundle Identifier in **Signing & Capabilities** (e.g. `com.yourhandle.personalcinema`). |
| `Developer Mode disabled` | iOS 17 security feature prevents running sideloaded apps. | Enable in iPhone: **Settings ➔ Privacy & Security ➔ Developer Mode** and reboot. |
| `Untrusted Developer` | Free Apple ID certificates are not trusted by default. | Go to **Settings ➔ General ➔ VPN & Device Management** on iPhone and tap **Trust**. |
| `No such module 'SwiftData'` | Xcode version < 15.0 or deployment target < 17.0. | Ensure Xcode is version 15.0+ and deployment target is set to iOS 17.0+. |
| `Provisioning profile doesn't include entitlement` | Push notification entitlement on free account. | Entitlements dictionary is already cleaned; verify `PersonalCinema.entitlements` contains `<dict/>`. |
