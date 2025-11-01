# WhatDocSays

WhatDocSays is an Expo (SDK 54) React Native app that scans prescriptions on-device, parses common medication directives (English + Russian), and builds a personal intake schedule with local reminders.

## Features
- Capture a prescription via VisionCamera or import an existing image/PDF (PDF currently prompts to convert to image; on-device OCR uses ML Kit).
- Deterministic parser extracts medication name, strength, dose, frequency (QD/BID/TID/QID/QHS/QAM/QPM/QOD/PRN), duration, and timing hints.
- Review UI with inline edits, validation, and a sample dataset for quick testing.
- Automatic schedule expansion for the next 7–14 days with sensible defaults and PRN handling.
- Local notification scheduling (Expo Notifications) with snooze/taken/skip quick actions on the Today tab.
- State stored with Zustand + MMKV for fast, offline persistence.

## Getting Started
1. Install dependencies (choose one package manager):
   - `pnpm install`
   - `yarn install`
   - `npm install`
2. Prebuild the native projects: `npx expo prebuild`
3. Run a platform build:
   - iOS (Simulator): `npx expo run:ios`
   - Android (Emulator): launch the emulator, then `npx expo run:android`
4. The first launch will prompt for camera and notification permissions. Capture or import a prescription, review the parsed result, expand the schedule, and schedule reminders.

## Development Scripts
- `npm run start` – start the Expo dev server (clears cache).
- `npm run prebuild` – generate native projects with the configured plugins.
- `npm run ios` / `npm run android` – compile and run on the respective simulator/emulator.
- `npm run lint` – run ESLint using `eslint-config-expo`.

**Note:** The project uses `pnpm` as the package manager (evidenced by `pnpm-lock.yaml`), but npm scripts work with any package manager.

## Notes & Roadmap
- VisionCamera + ML Kit work fully on-device; no network calls are required.
- PRN medications are captured but skipped from auto-scheduled notifications (they remain visible in the Today view).
- Future enhancements: PDF rasterisation pipeline, richer medication metadata (route detection, interactions), sharing/export options, and dosage tapering workflows.

## Sample Data
On the Review screen tap **“Insert sample”** to load:
```
Amoxicillin 500 mg
1 tab 3 times a day 7 days after meals
At night: Melatonin 3 mg — 1 tab
```
The parser will produce two medications:
- Amoxicillin 500 mg · TID · 7 days · AFTER_MEAL
- Melatonin 3 mg · QHS
