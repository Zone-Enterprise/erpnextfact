# ERPNext Desktop – Build Guide

This document explains **how to build ERPNext Desktop from source** on all supported platforms and how the build pipeline works under the hood.

---

## 1. Prerequisites & System Requirements

| Platform | Minimum OS | Essential Software | Extra Packages |
|----------|-----------|--------------------|----------------|
| Linux    | Ubuntu 20.04+, Debian 11+, Fedora 36+, Arch | • Node ≥ 18<br>• npm ≥ 9<br>• git<br>• build-essential / base-devel | • `rpm` _(only if you need the .rpm target)_ |
| Windows  | Windows 10 64-bit | • Node ≥ 18 (LTS)<br>• npm ≥ 9<br>• git<br>• Visual Studio Build Tools (C++ workload) | — |
| macOS    | macOS 11 (Big Sur)+ (Intel or Apple Silicon) | • Xcode Command Line Tools<br>• Node ≥ 18, npm ≥ 9<br>• git | — |

General:

* **Disk space**: ~5 GB free during build.
* **Memory**: ≥ 4 GB RAM recommended (Electron builds are heavy).
* **Internet**: required once to fetch dependencies and Electron builder binaries.

---

## 2. Build Process Overview

1. **Clean** `dist/` and `dist_electron/`.
2. **Frontend** – Vite compiles Vue 3 UI (`desktop/src`) into `desktop/dist`.
3. **TypeScript** – Main/worker code is transpiled (currently with `--noEmitOnError false` so type errors don’t block).
4. **Stage** – Artifacts are copied into `dist_electron/build`.
5. **Packaging** – `electron-builder` consumes `desktop/electron-builder.json` to create:
   * Unpacked directory
   * Installers: **Windows** (NSIS + Portable), **macOS** (DMG + ZIP), **Linux** (AppImage + DEB).
6. **(CI)** – `.github/workflows/desktop-release.yml` reproduces the same steps on GitHub runners and attaches installers to a tag/release.

---

## 3. Step-by-Step Build Instructions

### 3.1 Common setup

```bash
git clone https://github.com/Zone-Enterprise/erpnextfact.git
cd erpnextfact/desktop
npm install          # takes a while – pulls Electron, Better-SQLite3, etc.
```

### 3.2 Linux (AppImage & DEB)

```bash
# Build unpacked only (fast iteration)
npm run build -- --linux --dir

# Build full installers
npm run build -- --linux
# or with explicit arch:
npm run build -- --linux --x64
```

**Outputs** (in `desktop/dist_electron/bundled/`):

* `ERPNext Desktop-<ver>.AppImage`
* `erpnext-desktop_<ver>_amd64.deb`
* `linux-unpacked/` – dev convenience folder

If you also need **.rpm**, install `sudo apt-get install rpm` and add `"rpm"` back into `electron-builder.json`.

### 3.3 Windows (NSIS & Portable)

```powershell
npm run build -- --win --x64
```

Produces:

* `ERPNext Desktop Setup <ver>.exe` (interactive installer)
* `ERPNext Desktop <ver>.exe` (portable)

### 3.4 macOS (DMG & ZIP)

```bash
npm run build -- --mac --x64     # Intel
npm run build -- --mac --arm64   # Apple Silicon
```

Outputs:

* `ERPNext Desktop-<ver>.dmg`
* `ERPNext Desktop-<ver>.zip`

Codesigning & notarization are **not yet enabled** – see Known Issues.

### 3.5 Quick developer loop

```bash
# Hot-reload (frontend) + Electron auto-restart
npm run dev
```

---

## 4. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Error: Unsupported arch 1` | Yargs converts boolean `--x64` default to `1`, confusing electron-builder. | Build script patched – ensure you pulled latest `droid/erpnext-desktop-installer` branch. Alternatively pass `--x64` explicitly. |
| `Running as root without --no-sandbox is not supported` | Executable launched as root (common in containers) | Run with `--no-sandbox` or use non-root user. |
| `to build rpm, executable rpmbuild is required` | Missing `rpm` package on Debian/Ubuntu | `sudo apt install rpm` or temporarily remove the `rpm` target (already done). |
| Native module (`better-sqlite3`) fails to rebuild | Missing build toolchain | Linux: `build-essential`, Windows: Visual Studio C++ build tools, macOS: Xcode CLT. |
| TypeScript compilation stops build | Currently we tolerate type errors. When you re-enable strict compilation make sure all *.ts are fixed. |

---

## 5. Generated Artifacts

| Artifact | Platform | Purpose |
|----------|----------|---------|
| `<name>-unpacked/` | All | Non-compressed directory; good for local debugging (`./erpnext-desktop` on Linux). |
| `.AppImage` | Linux | Self-contained binary runnable on most distros. |
| `.deb` | Ubuntu/Debian | Native package (installs to `/opt/erpnext-desktop`). |
| `.rpm` | Fedora/RHEL | _Disabled by default_; requires `rpmbuild`. |
| `Setup.exe` (NSIS) | Windows | Wizard installer with desktop/start-menu shortcuts. |
| `Portable.exe` | Windows | Zip-safe single file – no installer. |
| `.dmg` | macOS | Double-click and drag-to-Applications install. |
| `.zip` | macOS | Alternative unsigned archive. |

---

## 6. Testing the Built Application

### Linux

```bash
# Unpacked (apps must not be run as root without flag)
./dist_electron/bundled/linux-unpacked/erpnext-desktop --no-sandbox
```

### Windows

Run the Portable build or install via the NSIS wizard and launch from Start Menu.

### macOS

Open the DMG, drag the `.app` into Applications, then:

```bash
open /Applications/ERPNext\ Desktop.app
```

> First launch on macOS may show “unidentified developer” gatekeeper warning until code-signing is enabled.

---

## 7. Migrating Away From Temporary TypeScript Workarounds

Current build disables “fail on type errors” to keep momentum:

1. `build/scripts/build.mjs` calls `tsc --noEmitOnError false`.
2. `desktop/tsconfig.json` has `"strict": false`.

Migration plan:

1. **Incrementally fix** type errors in `desktop/main` & `renderer`.
2. Re-enable strict mode in `tsconfig.json`.
3. Remove the `--noEmitOnError false` override and uncomment `compileTypeScript()` call in `build.mjs`.
4. Add `vue-tsc --noEmit` to CI lint step.

---

## 8. Known Issues & Future Improvements

* **Code signing** – Windows & macOS installers are unsigned; add certificates + CI secrets.
* **Auto-update server** – Configuration is present but no update feed yet.
* **Icons** – Placeholder icons located in `desktop/build/` should be replaced with official artwork.
* **RPM target** – Disabled due to missing `rpmbuild` in CI container.
* **TypeScript strict** – See section 7.
* **Unit & E2E tests** – none yet; integrate Playwright + Vitest.
* **MariaDB vs SQLite** – current offline bundle uses SQLite; investigate bundled MariaDB like Frappe Books.
* **Multi-arch binaries** – add ARM64 builds on Linux and Windows once CI runners support them.

---

_Enjoy hacking on ERPNext Desktop!_  
For questions or contributions please open an issue or PR in the `erpnextfact` repository.
