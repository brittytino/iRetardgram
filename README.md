<p align="center">
  <img src="docs/app_icon.png" alt="iRetardgram Icon" width="128">
</p>

<h1 align="center">iRetardgram</h1>
<p align="center">A focused Instagram experience for Android</p>

<p align="center">
  <a href="https://github.com/brittytino/iRetardgram/releases/latest">
    <img src="https://img.shields.io/github/v/release/brittytino/iRetardgram?style=for-the-badge&label=Latest%20Release&color=10a37f" alt="Latest Release">
  </a>
  <a href="https://img.shields.io/github/downloads/brittytino/iRetardgram/total?style=for-the-badge&label=Total%20Downloads&color=0a7ea4">
    <img src="https://img.shields.io/github/downloads/brittytino/iRetardgram/total?style=for-the-badge&label=Total%20Downloads&color=0a7ea4" alt="Total Downloads">
  </a>
  <a href="https://discord.gg/Z9QvMw8s76">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join Discord">
  </a>
</p>

<p align="center">
  <a href="https://github.com/brittytino/iRetardgram/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/brittytino/iRetardgram/ci.yml?branch=main&label=CI&style=flat" alt="CI">
  </a>
  <a href="https://github.com/brittytino/iRetardgram/actions/workflows/release.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/brittytino/iRetardgram/release.yml?branch=main&label=Release&style=flat" alt="Release">
  </a>
  <a href="https://github.com/brittytino/iRetardgram/actions/workflows/pages.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/brittytino/iRetardgram/pages.yml?branch=main&label=Docs&style=flat" alt="Docs">
  </a>
</p>

<p align="center">
  <img src="https://komarev.com/ghpvc/?username=brittytino-iRetardgram&label=Views&color=gray&style=flat" alt="Views">
</p>

---

<p align="center">
  <img src="docs/preview.png" alt="iRetardgram preview" width="820">
</p>

<p align="center">
  <img src="docs/screen_1.png" alt="iRetardgram screenshot 1" width="240" />
  <img src="docs/screen_2.png" alt="iRetardgram screenshot 2" width="240" />
  <img src="docs/screen_3.png" alt="iRetardgram screenshot 3" width="240" />
</p>

iRetardgram is an open-source Android patching toolkit that removes high-distraction Instagram surfaces while preserving core communication features.

This project is actively maintained by TIno Britty J (brittytino) and builds on the original FeurStagram concept.

Credits to upstream: https://github.com/jean-voila/FeurStagram

## Why iRetardgram

- Predictable, scriptable patching workflow
- Signed release APKs published through GitHub Actions
- Automatic tag-based build and release pipeline
- Fallback APK sources when primary download fails

## Download

1. Open the latest release: https://github.com/brittytino/iRetardgram/releases/latest
2. Download one of the APK variants:
- stories enabled
- stories blocked

## What It Disables

| Feature | Status | How |
|---------|--------|-----|
| Feed Posts | Blocked | Network-level blocking |
| Explore Content | Blocked | Network-level blocking |
| Reels Content | Redirected | Redirects to DMs |
| Analytics and telemetry | Blocked | See Blocked network paths |
| Shopping and commerce preloads | Blocked | See Blocked network paths |

## What Still Works

| Feature | Status |
|---------|--------|
| Stories | Works |
| Direct Messages | Works |
| Profile | Works |
| Reels in DMs | Works |
| Search | Works |
| Notifications | Works |

## Community

Join the Discord server: https://discord.gg/Z9QvMw8s76

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

### Windows

Use WSL2 (Ubuntu recommended) and install the Linux requirements inside WSL.

## Quick Start

1. Download an Instagram APK from APKMirror (arm64-v8a recommended).

2. Run the patcher:

```bash
./patch.sh instagram.apk
```

To also block stories:

```bash
./patch.sh --block-stories instagram.apk
```

3. Install the patched APK:

```bash
adb install -r artifacts/iRetardgram_patched_<instagram_apk_name>_stories_enabled.apk
```

4. Cleanup build artifacts:

```bash
./cleanup.sh
```

## Automated Release Pipeline

The repository includes a fully automated GitHub Actions release workflow in `.github/workflows/release.yml`.

When you push a tag starting with `v` (for example `v1.0.3`), the workflow:

1. Downloads the latest Instagram APK automatically.
2. Uses fallback sources if APKMirror fails.
3. Builds two patched variants (`stories enabled` and `stories blocked`).
4. Generates SHA256 files.
5. Uploads all APK assets to the GitHub Release.

Primary source:

- `https://www.apkmirror.com/apk/instagram/instagram-instagram/`

Fallback sources:

- APKPure direct endpoint
- Uptodown download endpoint

Release trigger command:

```bash
git tag v1.0.3
git push origin v1.0.3
```

## Core Structure

```text
iRetardgram/
|- patch.sh                 # Main patching script
|- cleanup.sh               # Removes build artifacts
|- apply_network_patch.py   # Network hook patch logic
|- global_redirect.py       # Global tab redirection patch
|- artifacts/               # Build outputs
|- scripts/                 # Helper automation scripts
`- patches/
   |- IRetardConfig.smali   # Configuration class
   `- IRetardHooks.smali    # Network blocking hooks
```

## Keystore

The patched APK needs to be signed before installation. The patcher uses a keystore file for signing.

### Generating a Keystore

Create a local keystore (do not commit it), then run `patch.sh` with env vars:

```bash
IRETARDGRAM_KEYSTORE=./iRetardgram.keystore \
IRETARDGRAM_KEYSTORE_PASS=your_store_password \
IRETARDGRAM_KEY_ALIAS=iRetardgram \
./patch.sh instagram.apk
```

If `iRetardgram.keystore` does not exist yet, create one:

```bash
keytool -genkey -v -keystore iRetardgram.keystore -alias iRetardgram \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=iRetardgram, OU=iRetardgram, O=iRetardgram, L=Unknown, ST=Unknown, C=XX"
```

### Keystore Details

| Property | Value |
|----------|-------|
| Filename | iRetardgram.keystore |
| Alias | iRetardgram |
| Algorithm | RSA 2048-bit |
| Validity | 10,000 days |

Note: To preserve app data across updates, always sign with the same keystore. Changing keystore requires uninstalling the previous build.

## Debugging

View logs to see what is being blocked:

```bash
adb logcat -s "iRetardgram:D"
```

## How It Works

### Tab Redirect

Intercepts fragment loading in the main tab host. When Instagram tries to load `fragment_clips` (Reels), it redirects to `fragment_direct_tab` (DMs).

### Network Blocking

Hooks into `TigonServiceLayer` (a named, non-obfuscated class). Before each request, `IRetardHooks.throwIfBlocked()` runs on the request URI. Blocked calls fail with an `IOException` so the stack unwinds cleanly.

### Blocked Network Paths

| Path or pattern | Purpose |
|-----------------|---------|
| `/feed/timeline/` | Home feed posts |
| `/discover/topical_explore` | Explore tab content |
| `/clips/discover` | Reels discovery feed |
| `/api/v1/clips/user/`, `/api/v1/clips/multi_user/` | Personalized and Blend aggregation reels feeds |
| `/api/v1/feed/reels_media/` | Reels media stream endpoint |
| `/blend`, `/blends` | Blend-based reels/feed endless scroll surfaces |
| `/api/v1/qe/sync/`, `/api/v1/launcher/sync/` | Feature-flag and launcher rollouts that can enable Blend-like behavior |
| `/api/v1/direct_v2/threads/get_by_participants/` | Blend session lookup inside DM context |
| `/api/v1/reels/liked/`, `/api/v1/discover/explore/` | Reels/explore preference and recommendation signals |
| `/logging/` | Client event logging |
| `/async_ads_privacy/` | Ad-related tracking |
| `/async_critical_notices/` | Engagement nudge analytics |
| `/api/v1/media/.../seen/` (path contains `/api/v1/media/` and `/seen`) | Post seen tracking |
| `/api/v1/fbupload/` | Telemetry upload |
| `/api/v1/stats/` | Performance and usage stats |
| `/api/v1/loom/`, `/api/v1/analytics/` | Internal tracing and analytics |
| `/api/v1/commerce/`, `/api/v1/shopping/`, `/api/v1/sellable_items/` | Shopping and commerce preloads |

Matching uses `String.contains()` on the URI path. Instagram changes URL shapes over time, so adjust `patches/IRetardHooks.smali` if a block stops matching.

## Updating for New Instagram Versions

1. `TigonServiceLayer` is a named class and typically remains stable.
2. Apply the same patch flow.
3. Push a new release tag.

## iRetard Chrome Extension

iRetard is a strict local-only Manifest V3 Chrome extension for disciplined Instagram usage.

- No popup override controls
- Daily Instagram budget fixed to 30 minutes
- Real-time countdown clock
- Mandatory periodic math challenge
- Emergency unlock disabled

## Contributing

Contributions are welcome. Please read CONTRIBUTING.md before opening pull requests.

## Security

If you find a security issue, please follow SECURITY.md and avoid public disclosure until it is reviewed.

## Author

brittytino

## License

Released under GNU General Public License v3.0. See LICENSE.

