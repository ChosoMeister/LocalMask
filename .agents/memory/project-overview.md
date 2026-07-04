---
type: project
created: 2026-07-04
updated: 2026-07-04
---

# Project Overview

- **Name**: LocalMask (formerly GeoTime Spoofer)
- **Tech Stack**: React, Vite, Tailwind CSS v4, Lucide-react. UI follows the "Vibrant Glassmorphism" style.
- **Core Mechanism**: Uses Chrome DevTools Protocol (CDP) via `chrome.debugger` to natively spoof Timezone, Geolocation, Locale, and Language.
- **Features**: 
  - **Auto-IP Sync**: Automatically detects VPN IP via `ipwho.is` and applies exact timezone/coordinates.
  - **WebRTC Leak Protection**: Disables non-proxied UDP via `chrome.privacy` API when active to prevent real IP leaks.
  - **Domain Blacklist**: Ignores specific domains (e.g. `meet.google.com`) allowing them to bypass CDP spoofing.
  - **Global Shortcuts**: Supports `Alt+Shift+X` (or Mac equivalent) to toggle spoofing state instantly.
- **Advantage**: Bypasses advanced fingerprinting by avoiding easily detectable JavaScript overrides (zero JS footprint).
- **Key Files**: 
  - `public/background.js`: Core CDP logic, dynamic profiles, WebRTC control.
  - `src/popup/App.jsx`: React-based UI, IP fetching logic, and glassmorphism styling.
