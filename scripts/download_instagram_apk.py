#!/usr/bin/env python3
"""Download the latest Instagram APK with source fallbacks.

Priority:
1) APKMirror listing -> release page -> variant page -> direct download link
2) APKPure direct endpoint
3) Uptodown download endpoint
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)

APK_MIRROR_LISTING = "https://www.apkmirror.com/apk/instagram/instagram-instagram/"
APK_PURE_DIRECT = "https://d.apkpure.com/b/APK/com.instagram.android?version=latest"
UPTODOWN_DIRECT = "https://instagram.en.uptodown.com/android/download"


def fetch_text(url: str, referer: str | None = None) -> str:
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    return data.decode("utf-8", errors="ignore")


def download_file(url: str, destination: Path, referer: str | None = None) -> str:
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=120) as response:
        final_url = response.geturl()
        with destination.open("wb") as file_handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                file_handle.write(chunk)
    return final_url


def is_valid_apk(apk_path: Path) -> bool:
    if not apk_path.exists() or apk_path.stat().st_size < 5 * 1024 * 1024:
        return False

    try:
        with zipfile.ZipFile(apk_path) as archive:
            names = set(archive.namelist())
    except zipfile.BadZipFile:
        return False

    if "AndroidManifest.xml" not in names:
        return False

    has_dex = any(name.startswith("classes") and name.endswith(".dex") for name in names)
    if not has_dex:
        return False

    if "manifest.json" in names and any(name.endswith(".apk") for name in names):
        return False

    return True


def parse_links(page_url: str, content: str) -> list[str]:
    links: list[str] = []
    for href in re.findall(r'href=["\']([^"\']+)["\']', content, flags=re.IGNORECASE):
        href = html.unescape(href)
        links.append(urllib.parse.urljoin(page_url, href))
    return links


def resolve_apkmirror_url() -> tuple[str | None, str | None]:
    try:
        listing = fetch_text(APK_MIRROR_LISTING)
    except Exception as error:  # pragma: no cover
        return None, f"APKMirror listing fetch failed: {error}"

    listing_links = parse_links(APK_MIRROR_LISTING, listing)
    release_links = [
        link
        for link in listing_links
        if "/apk/instagram/instagram-instagram/instagram-" in link and link.endswith("-release/")
    ]
    if not release_links:
        return None, "APKMirror release page not found"

    release_url = release_links[0]

    try:
        release_page = fetch_text(release_url, referer=APK_MIRROR_LISTING)
    except Exception as error:  # pragma: no cover
        return None, f"APKMirror release fetch failed: {error}"

    release_page_links = parse_links(release_url, release_page)
    variant_links = [
        link
        for link in release_page_links
        if "/apk/instagram/instagram-instagram/instagram-" in link and "-android-apk-download/" in link
    ]
    if not variant_links:
        return None, "APKMirror variant page not found"

    preferred = [link for link in variant_links if "arm64" in link.lower()]
    variant_url = preferred[0] if preferred else variant_links[0]

    try:
        variant_page = fetch_text(variant_url, referer=release_url)
    except Exception as error:  # pragma: no cover
        return None, f"APKMirror variant fetch failed: {error}"

    variant_page_links = parse_links(variant_url, variant_page)
    direct_links = [link for link in variant_page_links if "download.php" in link or link.endswith(".apk")]
    if not direct_links:
        return None, "APKMirror direct download link not found"

    return direct_links[0], None


def candidate_sources() -> list[tuple[str, str, str | None]]:
    candidates: list[tuple[str, str, str | None]] = []

    apkmirror_url, apkmirror_error = resolve_apkmirror_url()
    if apkmirror_url:
        candidates.append(("APKMirror", apkmirror_url, APK_MIRROR_LISTING))
    else:
        print(f"[warn] {apkmirror_error}", file=sys.stderr)

    candidates.append(("APKPure", APK_PURE_DIRECT, None))
    candidates.append(("Uptodown", UPTODOWN_DIRECT, None))
    return candidates


def download_latest_instagram(output_path: Path) -> tuple[str, str]:
    attempts: list[str] = []

    for source_name, url, referer in candidate_sources():
        try:
            if output_path.exists():
                output_path.unlink()

            print(f"[info] Trying source: {source_name} -> {url}")
            final_url = download_file(url, output_path, referer=referer)

            if not is_valid_apk(output_path):
                attempts.append(f"{source_name}: downloaded file is not a valid APK")
                continue

            return source_name, final_url
        except Exception as error:  # pragma: no cover
            attempts.append(f"{source_name}: {error}")

    details = "\n".join(f"- {line}" for line in attempts)
    raise RuntimeError(f"Unable to download a valid Instagram APK. Attempts:\n{details}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download latest Instagram APK with fallbacks")
    parser.add_argument("--output", required=True, help="Path to output APK file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    source_name, final_url = download_latest_instagram(output_path)
    print(f"[ok] Downloaded APK from {source_name}")
    print(f"[ok] Final URL: {final_url}")
    print(f"[ok] Saved to: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
