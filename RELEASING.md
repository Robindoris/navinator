# Releasing Navinator

Everything below runs in GitHub Actions. You tag, push, and the workflow does the rest.

```bash
git tag v0.1.0
git push origin v0.1.0
```

That triggers [`.github/workflows/release.yml`](.github/workflows/release.yml), which typechecks, builds macOS / Windows / Linux, and publishes a GitHub release. A manual run with **publish: off** builds and verifies without touching a release.

## What gets built

| Platform | Artifacts | Update feed |
|---|---|---|
| macOS | `.dmg` + `.zip`, Intel and Apple Silicon | `latest-mac.yml` |
| Windows | `.exe` (NSIS) + `.zip`, Intel and ARM64 | `latest.yml` |
| Linux | `.AppImage` + `.deb`, x86-64 and ARM64 | `latest-linux.yml` |

The `.yml` files and `.blockmap` deltas are uploaded alongside the installers — the in-app updater needs them and silently does nothing without them. Every release also gets a `SHA256SUMS.txt`.

The macOS `.zip` is not redundant with the `.dmg`: people download the dmg, but Squirrel.Mac applies updates *from the zip*. Removing it breaks auto-update on macOS only.

## One job per platform, not per architecture

This looks inefficient and is not. `latest-mac.yml` and `latest.yml` list every architecture for their platform, and each is written by whichever build finished. Building Intel and ARM in separate jobs produces two manifests that each list one architecture — and whichever lands last silently deletes the other from the update feed. Each platform therefore gets exactly one `electron-builder` invocation covering both architectures.

## Before the first release: `appId`

`appId` is `app.robindoris.navinator`. It is baked into the macOS bundle identifier and the Windows registry, and it is what the OS keychain keys your saved server passwords to.

**It cannot be changed after anyone installs a build.** If you want a different identifier, change it now, before the first public tag. If you change it later, existing users get a second, unrelated install with no servers and no settings.

## Signing and notarisation

The workflow works with no secrets at all — it produces unsigned installers. What you lose depends on the platform:

| | Unsigned | Signed |
|---|---|---|
| macOS | Right-click → Open on first launch. Gatekeeper warning forever after. | Normal double-click install. |
| macOS **auto-update** | **Broken.** Squirrel.Mac refuses to apply an update that is not signed with the same identity. | Works. |
| Windows | SmartScreen "unknown publisher" warning. | Warning goes away after reputation accrues. |
| Windows **auto-update** | Works, but every update re-triggers the SmartScreen prompt. | Works, silently. |
| Linux | No difference. | No difference. |

**Read that first row again: macOS auto-update cannot work until you have a Developer ID.** Signing costs $99/year for the Apple Developer Program, and the certificate has to be issued to the real organisation behind `Robindoris`. Linux auto-update works today, unsigned.

### Repository secrets

Add these under **Settings → Secrets and variables → Actions**. Leave any of them empty and the corresponding step is skipped.

| Secret | Required for | Notes |
|---|---|---|
| `MAC_CSC_LINK` | macOS signing | Base64 of the `.p12`: `base64 -i "Developer ID Application: X.p12" -o mac-csc.txt` |
| `MAC_CSC_KEY_PASSWORD` | macOS signing | Password for that `.p12` |
| `APPLE_ID` | macOS notarisation | Your Apple account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS notarisation | From appleid.apple.com → Sign-In and Security → App-specific passwords |
| `APPLE_TEAM_ID` | macOS notarisation | 10-character team id |
| `WIN_CSC_LINK` | Windows signing | Base64 of the `.pfx` |
| `WIN_CSC_KEY_PASSWORD` | Windows signing | Password for that `.pfx` |

Without `APPLE_*`, macOS builds are signed but **not notarised**. That is the worst of both worlds: Gatekeeper quarantines the dmg and the user has to right-click → Open, and `spctl` still rejects it. If you have a signing certificate, add the notarisation secrets at the same time.

## What the workflow does

1. **`prepare`** — reads the version from the tag and marks pre-releases (`v0.1.0-beta.1`, or the manual toggle).
2. **`verify`** — `npm run typecheck`, once, before spending three runners.
3. **`build`** — one job per platform, each writing the tag's version into `package.json`, regenerating icons, and running `electron-builder --x64 --arm64 --publish never`. Each job asserts its update manifest was generated; a missing `latest-mac.yml` fails the build rather than shipping a release that cannot update.
4. **`release`** — downloads all three artifacts, generates checksums, and creates the GitHub release. One job publishes, so two runners can never race to create the same release.

Publishing is skipped entirely on a manual run unless you tick `publish`.

## Verifying a release

```bash
gh release view v0.1.0                       # assets present?
gh release download v0.1.0 -D /tmp/nav       # then run the installer
shasum -a 256 -c /tmp/nav/SHA256SUMS.txt     # checksums match
```

For auto-update, the check that matters is that the feed files were uploaded and the version in them matches the tag. If the tag was `v0.1.0` and `latest-mac.yml` says `0.0.9`, the update path is broken and the running app will never see the new build.

## Local builds

```bash
npm run dist                    # full installers for the current platform
npm run package                 # unpacked, in release/
npx electron-builder --linux    # a platform you are not on
```

`--publish never` is the default locally only because `GH_TOKEN` is usually absent; nothing is ever published from a laptop by accident unless you pass `--publish always`.

## Troubleshooting

**`latest-mac.yml was not generated`** — the build step failed before writing it, usually a signing problem. Check the build log for the certificate error; on a machine with expired identities in the keychain, set `CSC_IDENTITY_AUTO_DISCOVERY=false` (the workflow already does).

**A release exists but assets are missing** — the `release` job failed after the builds succeeded. Re-run it; the workflow deletes and recreates the release for that tag.

**macOS updates download and then do nothing** — the expected failure for an unsigned build. Sign and notarise, then publish a new version.
