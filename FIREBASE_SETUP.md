# Firebase Setup for Restaurant Finder and Planner

This app uses Firebase Web SDK because the Android APK is built from a Vite/React app wrapped by Capacitor.

## Products used

- Firebase Authentication: Google sign-in
- Cloud Firestore: cloud backup and restore for saved restaurants

## Required Firebase Console setup

1. Open Firebase Console.
2. Select project: `restaurant-discovery-a8e8e`.
3. Go to Authentication > Sign-in method.
4. Enable Google provider.
5. Select a public support email for the project.
6. Go to Firestore Database.
7. Create database.
8. Publish the owner-only rules below before public testing.

## Firestore rules

Use these rules before distributing the APK outside your own device:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Do not leave Firestore in test mode for public testing or Play Store distribution.

## Android Google sign-in SHA setup

Google sign-in inside the APK may fail until your Android signing certificate fingerprints are added in Firebase.

For a debug APK, generate the SHA-1/SHA-256 locally:

```bash
cd android
./gradlew signingReport
```

Copy the SHA-1 and SHA-256 for the debug/release variant into:

Firebase Console > Project settings > Your apps > Android app > SHA certificate fingerprints

For a Play Store release, also add the SHA-1/SHA-256 from your upload key or Play App Signing certificate.

## Data path

Each user is saved under:

```text
users/{firebaseUser.uid}
```

Data stored:

- savedRestaurants
- profile name/avatar
- updatedAt
- appVersion

## Notes

- Restaurant data is still cached locally for offline-first behavior.
- Firebase cloud backup starts only after Google sign-in.
- Screenshot image blobs remain local in IndexedDB. Only restaurant metadata is synced.
- Firebase config in `src/firebase.js` is public by design. Security comes from Firestore rules, not from hiding config.
