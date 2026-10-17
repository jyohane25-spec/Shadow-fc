/*
  SHADOW FC online setup:
  1. Create a NEW Firebase project for SHADOW FC (keep it separate from SHADOWLANDS).
  2. Enable Authentication > Sign-in method > Anonymous.
  3. Create Realtime Database.
  4. Paste the web app config values below.
  5. Set the Realtime Database rules shown in README.md.
  Do not paste a service-account/private server key here.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase, ref, set, onValue, onDisconnect, serverTimestamp, update
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "PASTE_PROJECT_ID_HERE.firebaseapp.com",
  databaseURL: "PASTE_DATABASE_URL_HERE",
  projectId: "PASTE_PROJECT_ID_HERE",
  storageBucket: "PASTE_PROJECT_ID_HERE.appspot.com",
  messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_APP_ID_HERE"
};

function isConfigured() {
  return firebaseConfig.apiKey !== "PASTE_API_KEY_HERE" &&
    firebaseConfig.databaseURL !== "PASTE_DATABASE_URL_HERE" &&
    firebaseConfig.projectId !== "PASTE_PROJECT_ID_HERE";
}

export async function connectRoom(roomCode, onRoomState, onStatus) {
  if (!isConfigured()) {
    throw new Error("Online mode is not configured yet. Add your NEW SHADOW FC Firebase settings in firebase-config.js.");
  }
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  const db = getDatabase(app);
  const roomRef = ref(db, `rooms/${roomCode}`);
  const playersRef = ref(db, `rooms/${roomCode}/players`);
  const myPlayerRef = ref(db, `rooms/${roomCode}/players/${auth.currentUser.uid}`);
  const initialPlayer = {
    x: -4, z: 0, rot: 0, team: "home",
    name: "Player", joinedAt: Date.now(), online: true
  };
  await set(myPlayerRef, initialPlayer);
  await onDisconnect(myPlayerRef).remove();
  onValue(playersRef, snapshot => {
    const raw = snapshot.val() || {};
    const players = Object.entries(raw).map(([id, p]) => ({ id, ...p }));
    onRoomState({ players, myId: auth.currentUser.uid });
    if (players.length > 1) onStatus("Connected to room " + roomCode + " — " + players.length + " player(s)");
    else onStatus("Room " + roomCode + " created. Waiting for a friend to join…");
  });
  const matchRef = ref(db, `rooms/${roomCode}/match`);
  onValue(matchRef, snapshot => {
    const match = snapshot.val();
    if (match) onRoomState({ match });
  });
  return {
    id: auth.currentUser.uid,
    updatePlayer: (data) => update(myPlayerRef, { ...data, updatedAt: serverTimestamp(), online: true }),
    setMatch: (data) => set(matchRef, data),
    cleanup: async () => { try { await set(myPlayerRef, null); } catch (_) {} }
  };
}
