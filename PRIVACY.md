# Privacy Policy

**Restaurant Finder and Planner** is an offline-first restaurant planning app with optional Firebase cloud backup after Google sign-in.

## Data stored by the app
The app may store restaurant-related information that you add or scan, including restaurant names, locations/areas, ratings, notes, images, favourite status, visit dates/times, and visit status.

## Local storage
By default, saved restaurant data is stored locally on your device using browser/device storage such as localStorage and IndexedDB.

If you are not signed in, your saved restaurant list stays on your device only.

## Optional Firebase cloud backup
If you sign in with Google, the app backs up saved restaurant metadata to Firebase Firestore so your data can be restored after changing phones, reinstalling the app, or using another device.

Synced metadata can include restaurant name, area/location, rating, status, favourite flag, notes, source, search URL, and visit plan details. Screenshot image blobs remain stored locally on your device unless a future version explicitly adds cloud image backup.

Your cloud data is stored under your authenticated Firebase user ID and must be protected by Firestore rules that only allow the signed-in owner to read or write their own document.

## OCR and images
When you choose an image or screenshot for OCR scanning, the app uses it to detect restaurant information such as name, location, and rating. OCR processing is intended to run in the app. Screenshot image blobs are kept locally unless you choose to share them or a future version adds explicit cloud image backup.

## Third-party services
The app may open external services such as Google Maps or your device share sheet when you choose those actions. If you sign in, Firebase Authentication and Firebase Firestore are used for login and cloud backup. These third-party services are governed by their own privacy policies.

## Data deletion
You can remove app data by deleting saved restaurants inside the app where available, clearing app/browser storage, uninstalling the app, or deleting your Firebase user document from Firestore.

## Contact
Developer: K7Artwork.AI  
Email: k7artwork@gmail.com

## Effective date
2026-05-04
