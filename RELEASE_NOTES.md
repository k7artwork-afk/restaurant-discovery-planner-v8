# Restaurant Finder and Planner v1.0.0 - Secure Firebase Build

## Included fixes

- Firebase Google login added in Profile.
- Optional Firebase Firestore cloud backup for saved restaurant metadata.
- Privacy policy updated to accurately describe local storage and optional cloud sync.
- Firestore security rules documented.
- SHA-1/SHA-256 Android Google sign-in setup documented.
- Share fallback popup removed; fallback is silent.
- Deprecated `document.execCommand("copy")` fallback removed.
- Discovery search checks restaurant name, cuisine, menu, tags, and location.
- Discovery save defaults to an unsaved icon and only shows saved state after user saves.
- Saved tab search works inside All, Planned, Pending, Visited, and Favorites.
- New installs start with an empty saved list.
- Duplicate restaurant saves are blocked.
- Saved data parsing is guarded against invalid localStorage data.
- External Google Maps opens are restricted to safe Google Maps URLs.
- Embedded-map code is intentionally kept for future map/list toggle use.
- Dependencies are pinned and app version is set to 1.0.0.

## Build note

For GitHub Actions, upload the extracted project files so `package.json` is at the repository root.

The workflow creates a debug APK for testing and a release AAB artifact for Play Store preparation. Configure release signing before public Play Store upload.
