# Play Store Release Checklist

## Current version

- App version: `1.0.0`
- Android `versionCode`: `1`
- Android `versionName`: `1.0`

## Build outputs

The GitHub workflow builds:

- Debug APK: for internal device testing only
- Release AAB: for Play Store preparation

The release AAB may still require proper app signing configuration depending on how your Android project is generated and signed.

## Before Play Store upload

1. Commit the `android/` folder for stable versioning and signing.
2. Remove `android/` from `.gitignore` once the Android folder is committed.
3. Configure release signing using a secure upload key.
4. Add SHA-1 and SHA-256 fingerprints in Firebase for Google sign-in.
5. Publish Firestore owner-only security rules.
6. Confirm privacy policy mentions optional Firebase cloud backup after Google sign-in.
7. Test Google login, save, restore, delete, share, and Discovery on a physical Android device.

## Firestore rules required

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
