# K7 Eats Security / Ownership Notes

This project is owned by K7Artwork.AI.

Protection measures included:
- Production JavaScript minification and mangling through Vite/Terser.
- Source maps disabled in production builds.
- Console/debugger statements removed in production builds.
- Basic browser inspection shortcuts blocked in production UI.
- K7Artwork.AI branding retained inside the app.

Important:
No frontend-only app can be made impossible to copy. For stronger protection before public release:
- Keep the GitHub repository private.
- Build signed release APK/AAB only.
- Enable Android R8/ProGuard for release builds.
- Move paid/API/AI logic to a backend server.
- Do not store secrets in frontend code.
