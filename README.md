# Restaurant Discovery Planner

## Repository structure

This repository is now root-based. The app entry files are at the repository root:

- `package.json`
- `src/`
- `public/`
- `vite.config.js`
- `capacitor.config.json`
- `.github/workflows/main.yml`

GitHub Actions can now run `npm ci` and `npm run build` directly from the root. User saved data and settings remain in the browser/device storage and are not overwritten by app updates.

This package fixes the main stability and build issues:

- GitHub Actions APK workflow uses Node 22 and Java 21.
- Frontend has Vite config and Capacitor config.
- Capacitor Android project is generated automatically in GitHub Actions.
- OCR image selection now resizes/compresses images before processing.
- Restaurant screenshot thumbnails are stored in IndexedDB instead of localStorage base64.
- Saved restaurant thumbnails are loaded from IndexedDB.
- Deleting/clearing restaurants also cleans image storage.
- Smart sharing uses Capacitor Share where available, with web fallback.
- About section links to K7ARTWORK.AI website.

## Correct GitHub structure

Upload the contents of this ZIP so your repo root looks like:

```text
.github/workflows/main.yml
backend/
frontend/
README.md
```

Then run:

Actions > Build Android APK > Run workflow

Download artifact:

k7-eats-apk


## V3 Tab Navigation Upgrade

Added:
- True tab-based navigation instead of one long scrolling page
- Removed Google Backup UI
- Dashboard cards now filter saved restaurants
- Added Visited restaurant status and tab
- Added Favorites toggle and Favorites filter
- Added Nearby Restaurants tab using Google Maps
- Added restaurant-planner style logo


## V4 Address / Location Fix

Improved OCR location extraction:
- Detects address-style lines such as Mall, Road, Street, Tower, Shop, Near, Opposite, Dubai, Sharjah, etc.
- Uses clean fallback: Location not detected
- Removes confusing technical/coded-looking fallback messages
- Renames Area field to Location / Address


## V5 Codebase Optimization

Cleaned:
- Removed unused backend from APK package.
- Removed Firebase dependency and firebase.js because Google Backup UI was removed.
- Removed unused OCR text state and old base64 helper references.
- Removed unused sync/back-up CSS.
- Kept required modules: OCR, IndexedDB image storage, native sharing, tab navigation, nearby search.


## V6 Discover Navigation

Added:
- Discover tab placed in the middle of bottom navigation.
- Discovery categories: near me, cafes, family, fine dining, Indian, vegetarian, biryani, desserts.
- Suggested plans section.
- Sorting in Saved tab.
- Version shown in Profile.
- Delete confirmation.
- Thumbnail error fallback.


## V7 Code Protection Measures

Added:
- Vite/Terser production minification and mangling.
- Source maps disabled.
- Console/debugger removal in production builds.
- Basic right-click/dev shortcut blocking in production UI.
- Protected K7Artwork build marker in Profile.
- SECURITY.md and LICENSE_NOTICE.txt.
- Navigation order: Home / Add / Discover / Saved / Profile.

Note: No frontend APK can be made impossible to reverse engineer. For strongest protection, keep the repo private and build signed release APK/AAB with Android R8/ProGuard.


## V8 Avatar + Personalized Greeting

Added:
- First-start onboarding asks for name.
- User chooses avatar: Male / Female / Other.
- Home greeting shows personalized name and avatar.
- Profile includes Change Greeting section.
- Removed unused three-dot menu from the Home header.


## V1 Clean Optimization Pass

Cleaned before first release:
- Version set back to 1.0.0.
- Removed unused Firebase dependency and firebase.js.
- Removed unused backend folder from APK package.
- Removed unused OCR text/base64 helper leftovers.
- Removed old Google Backup / sync CSS leftovers.
- Kept Discover, Avatar Greeting, OCR, IndexedDB thumbnails, Favorites, Visited, Native Share, and protected production build.


## V9 Clean UI / Naming Pass

Changed:
- Removed Profile Features section.
- Removed Change Greeting card; greeting setup is now first-start only.
- Changed visible app name from K7 Eats to Restaurant Planner.
- Smart Share now shares APK/release download link text.
- Tightened typography and spacing.
- Kept K7Artwork.AI branding in About.


## V10 Branding Update

Updated:
- App renamed to Restaurant Finder & Planner.
- Capacitor app name changed to Restaurant Finder.
- Package name changed to restaurant-finder-planner.
- New restaurant-pin orange logo added.
- PWA/Android icon assets generated.
- UI color palette changed to match the orange/red logo.
- Version remains 1.0.0.


## V11 Home Reorder

Changed:
- Removed search box from Home screen.
- Moved Discover section above Dashboard.
- Home order is now: Greeting, Discover, Dashboard, Recently Added.


## V12 Restaurant Share Promotion

Updated restaurant sharing:
- Shares restaurant name, location, status, visit plan, and search link first.
- Then promotes Restaurant Finder & Planner APK with download link.


## V13 UI Polish

Improved:
- Continue button styling and animation.
- Restaurant card labels: Mark Visited / Plan Visit.
- Restaurant card typography and action hierarchy.
- Card entrance animations and press feedback.
- Bottom navigation entrance animation.
- Floating add button subtle pulse.
- Reduced-motion accessibility support.
- Remaining visible naming inconsistencies cleaned.


## V14 Final Optimization Pass

Cleaned:
- Removed unused greeting helper.
- Removed old feature/profile-change UI leftovers.
- Removed stale Firebase/backend leftovers.
- Removed stale CSS selectors for unused sections.
- Kept required functionality: OCR, local image storage, native share, Discover, Saved filters, Favorites, Visited, profile onboarding, protected build.
- Version remains 1.0.0.


# 1-Click APK Builder

This package already includes the GitHub Actions APK builder.

## How to build APK

1. Create a GitHub repository.
2. Upload the full contents of this ZIP to the repository.
3. Open the **Actions** tab.
4. Click **Build Android APK**.
5. Click **Run workflow**.
6. Wait for the green success mark.
7. Open the workflow run.
8. Download artifact: **restaurant-finder-apk**.
9. Extract it and install `app-debug.apk` on Android.

No code editing required.


## Final Safety Check

This package includes:
- Cleaned App.jsx
- Removed unused Firebase/backend leftovers
- Removed old OCR/base64 leftovers
- Stable Vite config
- Stable Capacitor config
- GitHub Actions APK builder with Node 22 and upload-artifact v4

Build:
Actions > Build Android APK > Run workflow


## V17 Clean Optimization Pass

Cleaned and optimized:
- Removed stale helper and dead UI leftovers.
- Removed Firebase/backend leftovers.
- Normalized package dependencies to only required runtime/build packages.
- Kept OCR add restaurant, scanning animation, native sharing, custom discovery, search query, theme toggle, favorites, visited/unvisited toggle.
- Rewrote stable Vite, Capacitor, and GitHub Actions configs.
- Version remains 1.0.0.