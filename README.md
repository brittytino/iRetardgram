<p align="center">
  <img src="docs/app_icon.png" alt="FeurStagram Icon" width="128">
</p>

<h1 align="center">FeurStagram</h1>
<p align="center">Distraction-Free Instagram</p>

<p align="center">
  <a href="https://github.com/jean-voila/FeurStagram/releases/latest">
    <img src="https://img.shields.io/github/v/release/jean-voila/FeurStagram?style=for-the-badge&label=Download%20APK&color=10a37f" alt="Download APK">
  </a>
  <a href="https://discord.gg/Z9QvMw8s76">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join Discord">
  </a>
</p>

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=jean-voila-feurstagram&label=Views&color=gray&style=flat" alt="Views">
</p>

---


<p align="center">
  <img src="docs/screen_1.png" alt="FeurStagram screenshot 1" width="240" />
  <img src="docs/screen_2.png" alt="FeurStagram screenshot 2" width="240" />
  <img src="docs/screen_3.png" alt="FeurStagram screenshot 3" width="240" />
</p>

An open source Instagram app for Android without distractions.

I built this project for myself as an alternative to [DFInstagram](https://www.distractionfreeapps.com/) which hasn't been maintained for a long time and was difficult to update. I'm sharing it so others can do the same for themselves.

**This project is entirely free and open-source.** Feel free to fork, copy, enhance, or submit pull requests - do whatever you want with it!

## Community

Join the Discord server to get support, follow updates, and discuss development:

- https://discord.gg/Z9QvMw8s76

## Installation

You have two options:

1. **Ready-to-install APK** - Grab the latest patched APK from the [Releases](../../releases) page and install it directly
2. **DIY Patching** - Use the toolkit below to patch any Instagram version yourself

## What Gets Disabled

| Feature | Status | How |
|---------|--------|-----|
| **Feed Posts** | ❌ Blocked | Network-level blocking |
| **Explore Content** | ❌ Blocked | Network-level blocking |
| **Reels Content** | ❌ Redirected | Redirects to DMs |
| **Analytics & telemetry** | ❌ Blocked | See [Blocked network paths](#blocked-network-paths) |
| **Shopping / commerce preloads** | ❌ Blocked | See [Blocked network paths](#blocked-network-paths) |

## What Still Works

| Feature | Status |
|---------|--------|
| **Stories** | ✅ Works |
| **Direct Messages** | ✅ Works |
| **Profile** | ✅ Works |
| **Reels in DMs** | ✅ Works |
| **Search** | ✅ Works |
| **Notifications** | ✅ Works |


## Requirements

### Linux
```bash
sudo apt install apktool android-sdk-build-tools openjdk-17-jdk python3
```

### macOS
```bash
brew install apktool android-commandlinetools openjdk python3
 sdkmanager "build-tools;34.0.0"
```

## Quick Start

1. **Download an Instagram APK** from [APKMirror](https://www.apkmirror.com/apk/instagram/instagram-instagram/) (arm64-v8a recommended)

2. **Run the patcher:**
   ```bash
   ./patch.sh instagram.apk
   ```

  To also block stories:
  ```bash
  ./patch.sh --block-stories instagram.apk
  ```

3. **Install the patched APK:**
   ```bash
   adb install -r artifacts/feurstagram_patched_<instagram_apk_name>_stories_enabled.apk
   ```

4. **Cleanup build artifacts:**
   ```bash
   ./cleanup.sh
   ```

## File Structure

```
Feurstagram/
├── patch.sh                 # Main patching script
├── cleanup.sh               # Removes build artifacts
├── apply_network_patch.py   # Network hook patch logic
├── artifacts/               # Patched APK output directory
└── patches/
    ├── FeurConfig.smali     # Configuration class
    └── FeurHooks.smali      # Network blocking hooks
```

## Keystore

The patched APK needs to be signed before installation. The patcher uses a keystore file for signing.

### Generating a Keystore

Create a local keystore (do not commit it), then run `patch.sh` with env vars:

```bash
FEURSTAGRAM_KEYSTORE=./feurstagram.keystore \
FEURSTAGRAM_KEYSTORE_PASS=your_store_password \
FEURSTAGRAM_KEY_ALIAS=feurstagram \
./patch.sh instagram.apk
```

If `feurstagram.keystore` doesn't exist yet, create one:

```bash
keytool -genkey -v -keystore feurstagram.keystore -alias feurstagram \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Feurstagram, OU=Feurstagram, O=Feurstagram, L=Unknown, ST=Unknown, C=XX"
```

### Keystore Details

| Property | Value |
|----------|-------|
| Filename | `feurstagram.keystore` |
| Alias | `feurstagram` |
| Algorithm | RSA 2048-bit |
| Validity | 10,000 days |

> **Note:** If you reinstall the app, you must use the same keystore to preserve your data. Signing with a different keystore requires uninstalling the previous version first.

## Debugging

View logs to see what's being blocked:
```bash
adb logcat -s "Feurstagram:D"
```

## How It Works

### Tab Redirect
Intercepts fragment loading in the main tab host. When Instagram tries to load `fragment_clips` (Reels), it redirects to `fragment_direct_tab` (DMs).

### Network Blocking
Hooks into `TigonServiceLayer` (a named, non-obfuscated class). Before each request, `FeurHooks.throwIfBlocked()` runs on the request URI; blocked calls fail with an `IOException` so the stack unwinds cleanly (same pattern as the original feed/explore blocks).

#### Blocked network paths

| Path / pattern | Purpose |
|----------------|---------|
| `/feed/timeline/` | Home feed posts |
| `/discover/topical_explore` | Explore tab content |
| `/clips/discover` | Reels discovery feed |
| `/logging/` | Client event logging |
| `/async_ads_privacy/` | Ad-related tracking |
| `/async_critical_notices/` | Engagement nudge analytics |
| `/api/v1/media/.../seen/` (path contains `/api/v1/media/` and `/seen`) | Post “seen” tracking |
| `/api/v1/fbupload/` | Telemetry upload |
| `/api/v1/stats/` | Performance / usage stats |
| `/api/v1/commerce/`, `/api/v1/shopping/`, `/api/v1/sellable_items/` | Shopping / commerce preloads |

Matching uses `String.contains()` on the URI path. Instagram changes URL shapes over time; adjust `patches/FeurHooks.smali` if a block stops matching.

## Updating for New Instagram Versions

I'll update this project to support new Instagram versions as they are released. When a new version comes out, I'll apply the necessary patches and release an updated APK.

1. TigonServiceLayer is a named class (doesn't change).

2. Apply the same patches.


## Contributing

This is a personal project I'm sharing with the community. Contributions are welcome!

- 🍴 **Fork it** - Make your own version
- 🔧 **Pull requests** - Improvements and fixes are appreciated
- 📋 **Copy it** - Use the code however you want
- ✨ **Enhance it** - Build something even better

## License

This project is released under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
