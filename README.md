<p align="center">
  <img src="docs/app_icon.png" alt="iRetardgram Icon" width="128" />
</p>

<h1 align="center">iRetardgram</h1>
<p align="center">Advanced Distraction-Free Instagram Toolkit</p>

<p align="center">
  <a href="https://github.com/brittytino/iRetardgram/releases/latest">
    <img src="https://img.shields.io/github/v/release/brittytino/iRetardgram?style=for-the-badge&label=Download%20APK&color=10a37f" alt="Download APK" />
  </a>
  <a href="https://github.com/brittytino/iRetardgram">
    <img src="https://img.shields.io/badge/GitHub-iRetardgram-181717?style=for-the-badge&logo=github" alt="GitHub Repository" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/brittytino/iRetardgram/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/brittytino/iRetardgram/ci.yml?branch=main&label=CI&style=flat" alt="CI Status" />
  </a>
  <a href="https://github.com/brittytino/iRetardgram/actions/workflows/pages.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/brittytino/iRetardgram/pages.yml?branch=main&label=Docs%20Deploy&style=flat" alt="Docs Deploy Status" />
  </a>
</p>

## About This Project

**iRetardgram is not a passive fork mirror.**

This repository is an **updated and advanced continuation** of the original concept, actively maintained by **TIno Britty J (brittytino)** at:

- https://github.com/brittytino/iRetardgram

This project builds on ideas and technical foundations from the original FeurStagram work while adding maintenance, cleanup, and long-term updates.

### Credits

Full credit and respect to the original FeurStagram creator:

- jean-voila: https://github.com/jean-voila/FeurStagram

Attribution and licensing notice: see NOTICE.md.

## What iRetardgram (Android Patcher) Does

The patcher modifies an Instagram APK to remove high-distraction surfaces while preserving core communication features.

### What Gets Disabled

- Feed posts: blocked at network layer
- Explore content: blocked at network layer
- Reels discovery: blocked/redirected
- Optional stories blocking: available with `--block-stories`

### What Still Works

- Stories (default mode)
- Direct Messages
- Profile
- Reels shared through DMs
- Search
- Notifications

## iRetard Chrome Extension (Companion)

iRetard is a strict local-only Manifest V3 Chrome extension for Instagram discipline.

### Open Source

This extension project is open source and maintained by brittytino.

### Strict Default Policy

- No user override controls in popup
- Daily Instagram budget fixed to 30 minutes
- Popup shows live countdown clock in MM:SS from 30:00
- Active Instagram sessions watched continuously with heartbeat evaluation
- Mandatory math challenge every 5 minutes of active Instagram use
- Emergency unlock flow disabled

### Network Blocking (Extension)

The extension blocks home feed timeline request patterns:

- `/feed/timeline/`
- `/feed/following/`
- `/web/feed/timeline/`
- GraphQL home-feed query URLs containing feed/timeline hints

### Tab Redirect (Extension)

- Reels tab routes redirected to Direct Messages
- Fragment requests targeting `fragment_clips` are intercepted and redirected to DMs

### Extension Load Unpacked

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the iRetard extension source folder

## Requirements (Android Patcher)

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

Use WSL2 (Ubuntu recommended) and run the Linux setup above.

## Quick Start (Android Patcher)

1. Download an Instagram APK from APKMirror (arm64-v8a recommended).
2. Run patcher:

```bash
./patch.sh instagram.apk
```

To also block stories:

```bash
./patch.sh --block-stories instagram.apk
```

3. Install patched APK:

```bash
adb install -r artifacts/iRetardgram_patched_<instagram_apk_name>_stories_enabled.apk
```

4. Cleanup:

```bash
./cleanup.sh
```

## Keystore Configuration

`patch.sh` requires signing variables:

- `IRETARDGRAM_KEYSTORE` (default: `./iRetardgram.keystore`)
- `IRETARDGRAM_KEYSTORE_PASS` (required)
- `IRETARDGRAM_KEY_ALIAS` (default: `iRetardgram`)
- `IRETARDGRAM_KEY_PASS` (default: same as keystore password)

Example:

```bash
IRETARDGRAM_KEYSTORE=./iRetardgram.keystore \
IRETARDGRAM_KEYSTORE_PASS=your_store_password \
IRETARDGRAM_KEY_ALIAS=iRetardgram \
./patch.sh instagram.apk
```

Generate keystore if needed:

```bash
keytool -genkey -v -keystore iRetardgram.keystore -alias iRetardgram \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=iRetardgram, OU=iRetardgram, O=iRetardgram, L=Unknown, ST=Unknown, C=XX"
```

## Repository Structure

```text
iRetardgram/
|- patch.sh
|- cleanup.sh
|- apply_network_patch.py
|- global_redirect.py
|- patches/
|  |- IRetardConfig.smali
|  |- IRetardHooks.smali
|- docs/
|  |- index.html
|  |- app_icon.png
```

## Contributing

Contributions are welcome. See `CONTRIBUTING.md` for workflow and standards.

## Security

If you find a security issue, follow `SECURITY.md` and avoid public disclosure until reviewed.

## Author

- TIno Britty J (brittytino)

## License

This repository currently uses GNU General Public License v3.0. See LICENSE.

Additional attribution details are documented in NOTICE.md.

