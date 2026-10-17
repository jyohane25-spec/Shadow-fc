# SHADOW FC — Android 3D football prototype

An original, lightweight 3D football browser game designed for Android landscape mode. It includes an offline match against simple AI, touch joystick/buttons, keyboard controls, and browser Gamepad API support.

## What is included now

- 3D pitch, goals, players, ball, scoreboard, and timer.
- Offline match with simple opponent AI.
- Touch joystick plus sprint, tackle, switch player, through pass, pass, and shoot.
- Keyboard controls for testing on a computer.
- Bluetooth/USB gamepads when the browser exposes the controller through the Gamepad API.
- Online room connection scaffold using Firebase Authentication and Realtime Database.

## Important status note

This is a playable **prototype**, not a finished FC Mobile-scale game. Offline play is the first complete playable mode. The online scaffold currently connects players to a room and synchronizes player positions, but ball physics, score authority, matchmaking, anti-cheat, reconnects, and production security still need development before public competitive matches. Do not advertise it as fully synchronized online multiplayer yet.

## Publish it on GitHub Pages

1. Sign in to GitHub.
2. Click **+** → **New repository**.
3. Repository name: `shadow-fc`.
4. Choose **Public** (needed for the simplest free GitHub Pages setup).
5. Select **Add a README file** if desired, then create the repository.
6. In the repository, click **Add file** → **Upload files**.
7. Upload these files from this folder: `index.html`, `styles.css`, `game.js`, `firebase-config.js`, `manifest.webmanifest`, `README.md`.
8. Click **Commit changes**.
9. Open **Settings** → **Pages**.
10. Under Build and deployment, choose **Deploy from a branch**; branch `main`, folder `/ (root)`, then Save.
11. Wait for the Pages URL to appear. Open it in Chrome on your Android phone.
12. Turn the phone sideways. For an app-like shortcut in Chrome, open the menu and tap **Add to Home screen** if offered.

Three.js is loaded from a CDN, so the game needs an internet connection to load its 3D engine. Offline match logic runs in the browser after the page and engine load, but this version is not a fully offline-installable PWA.

## Android gamepad support

1. Pair a Bluetooth controller in Android Settings → Bluetooth, or connect a USB controller with a compatible OTG adapter.
2. Open SHADOW FC in a recent Chrome-based browser.
3. Start a match, then press a controller button to wake the controller.
4. Default mapping in this prototype:
   - Left stick: move.
   - A / Cross (button 0): shoot.
   - B / Circle (button 1): pass.
   - X / Square (button 2): through pass.
   - Y / Triangle (button 3): switch player.
   - LB / button 4: tackle.
   - LT or RT: sprint.
5. Controller mappings vary by device. Some browsers expose gamepads only after a user gesture; Bluetooth/USB connection does not guarantee every controller is supported.

## Enable online rooms with Firebase

Use a **new Firebase project for SHADOW FC**, separate from SHADOWLANDS.

1. Open Firebase Console and create a project named `shadow-fc`.
2. Add a Web app in Project settings and copy its config.
3. In **Authentication** → **Sign-in method**, enable **Anonymous**.
4. In **Realtime Database**, create a database and copy its database URL.
5. In GitHub, open `firebase-config.js` and click Edit.
6. Replace each `PASTE_..._HERE` value with the matching Firebase Web app config value. Keep the quotes and commas.
7. Commit the change.
8. In Realtime Database → Rules, use the temporary development rules below only for initial testing.
9. Test with two devices or two browser sessions and enter the same room code.

### Temporary testing rules only — not for public release

These rules require a signed-in user, but they do **not** implement robust room authorization or anti-cheat. Use only while testing and replace with stricter rules before public release.

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

Because any authenticated user can write room data with these temporary rules, do not use them for a public competitive game. Production rules should validate each player's own record, limit fields and value ranges, and make match/score updates server-authoritative.

## Troubleshooting

- **Blank screen:** open the GitHub Pages URL in current Chrome, check your connection, and make sure all files are at the repository root.
- **Online config error:** verify every placeholder in `firebase-config.js` was replaced with the correct Firebase Web app config values.
- **Permission denied:** enable Anonymous Authentication and check the Realtime Database rules.
- **Gamepad does nothing:** connect it before or after opening the page, press a controller button, and try Chrome. Mapping differs between controllers.
- **Phone feels slow:** close other apps, use a recent browser, and keep the device cool. The prototype uses simple low-detail models.
- **Rotate prompt:** turn the phone to landscape for the intended control layout.

## Planned next upgrades

1. More realistic ball/player physics and player animations.
2. Better AI, goalkeeper saves, throw-ins, corners, fouls, and match rules.
3. Proper two-player online authority, synchronized ball and score, reconnection, and room lifecycle.
4. Team selection, formations, kit customization, and audio.
5. Android app packaging and performance testing.
