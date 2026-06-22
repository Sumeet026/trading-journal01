import {
  db,
  auth,
  isFirebaseEnabled,
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch
} from "./firebase.js";

// --- UTILITIES ---
function getUserId() {
  if (isFirebaseEnabled && auth && auth.currentUser) {
    return auth.currentUser.uid;
  }
  return null;
}

function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}

function getLocal(key, defaultVal = []) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch (e) {
    console.error("localStorage read error for", key, e);
    return defaultVal;
  }
}

function saveLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("localStorage write error for", key, e);
  }
}

// --- FIREBASE STATUS LOG ---
let _firebaseLogs = [];
const MAX_LOGS = 50;

function logFirebase(action, status, detail = "") {
  const entry = {
    time: new Date().toLocaleTimeString(),
    action,
    status,
    detail
  };
  _firebaseLogs.unshift(entry);
  if (_firebaseLogs.length > MAX_LOGS) _firebaseLogs.pop();
  if (status === "error") console.warn(`[FB ${action}]`, detail);
}

export function getFirebaseLogs() {
  return [..._firebaseLogs];
}

export function clearFirebaseLogs() {
  _firebaseLogs = [];
}

// --- DUAL WRITE HELPER ---
// Writes to BOTH Firebase AND localStorage so data is never lost
async function dualWrite(localKey, firebaseCollectionPath, data, docId) {
  const uid = getUserId();
  let firebaseOk = false;

  // 1. Always write to localStorage first (instant, never fails)
  const existing = getLocal(localKey);
  const localEntry = { id: docId, ...data };
  const idx = existing.findIndex(item => item.id === docId);
  if (idx >= 0) {
    existing[idx] = localEntry;
  } else {
    existing.push(localEntry);
  }
  saveLocal(localKey, existing);

  // 2. Try Firebase write
  if (uid) {
    try {
      const docRef = doc(db, ...firebaseCollectionPath, docId);
      await setDoc(docRef, data);
      firebaseOk = true;
      logFirebase(`save:${firebaseCollectionPath[firebaseCollectionPath.length - 2] || firebaseCollectionPath[firebaseCollectionPath.length - 1]}`, "ok", docId);
    } catch (e) {
      logFirebase(`save:${firebaseCollectionPath[firebaseCollectionPath.length - 2] || firebaseCollectionPath[firebaseCollectionPath.length - 1]}`, "error", e.message);
      console.error("Firebase dual-write failed, data saved locally:", e);
    }
  }

  return { id: docId, ...data, firebaseOk };
}

async function dualDelete(localKey, firebaseCollectionPath, docId) {
  const uid = getUserId();

  // 1. Always delete from localStorage
  const existing = getLocal(localKey);
  saveLocal(localKey, existing.filter(item => item.id !== docId));

  // 2. Try Firebase delete
  if (uid) {
    try {
      await deleteDoc(doc(db, ...firebaseCollectionPath, docId));
      logFirebase(`delete:${firebaseCollectionPath[firebaseCollectionPath.length - 2] || firebaseCollectionPath[firebaseCollectionPath.length - 1]}`, "ok", docId);
    } catch (e) {
      logFirebase(`delete:${firebaseCollectionPath[firebaseCollectionPath.length - 2] || firebaseCollectionPath[firebaseCollectionPath.length - 1]}`, "error", e.message);
    }
  }
  return true;
}

// Merge: read from Firebase, merge with localStorage (don't lose either)
function mergeFirebaseAndLocal(firebaseList, localList) {
  const map = new Map();
  localList.forEach(item => map.set(item.id, item));
  firebaseList.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
}

// Push all localStorage data to Firebase (one-time bulk sync)
export async function pushLocalToFirebase() {
  const uid = getUserId();
  if (!uid) return { ok: false, reason: "No Firebase user" };

  let count = 0;
  const errors = [];

  const collections = [
    { local: "tj_accounts", fb: ["users", uid, "accounts"] },
    { local: "tj_trades", fb: ["users", uid, "trades"] },
    { local: "tj_notes", fb: ["users", uid, "notes"] },
    { local: "tj_goals", fb: ["users", uid, "goals"] }
  ];

  for (const col of collections) {
    const items = getLocal(col.local);
    for (const item of items) {
      try {
        const itemId = item.id;
        const clean = { ...item };
        delete clean.id;
        await setDoc(doc(db, ...col.fb, itemId), clean);
        count++;
      } catch (e) {
        errors.push(`${col.local}:${item.id} - ${e.message}`);
      }
    }
  }

  // Checklist (special format)
  const checklist = getLocal("tj_checklist");
  if (checklist.length > 0) {
    try {
      await setDoc(doc(db, "users", uid, "checklist", "data"), { items: checklist });
      count++;
    } catch (e) {
      errors.push(`checklist - ${e.message}`);
    }
  }

  if (errors.length > 0) {
    logFirebase("bulkPush", "error", errors.join("; "));
  } else {
    logFirebase("bulkPush", "ok", `${count} items pushed`);
  }

  return { ok: errors.length === 0, count, errors };
}

// Pull all Firebase data and merge with localStorage
export async function pullFirebaseToLocal() {
  const uid = getUserId();
  if (!uid) return { ok: false, reason: "No Firebase user" };

  let count = 0;
  const errors = [];

  const collections = [
    { local: "tj_accounts", fb: ["users", uid, "accounts"] },
    { local: "tj_trades", fb: ["users", uid, "trades"] },
    { local: "tj_notes", fb: ["users", uid, "notes"] },
    { local: "tj_goals", fb: ["users", uid, "goals"] }
  ];

  for (const col of collections) {
    try {
      const q = query(collection(db, ...col.fb));
      const snap = await getDocs(q);
      const fbItems = [];
      snap.forEach(d => fbItems.push({ id: d.id, ...d.data() }));

      const localItems = getLocal(col.local);
      const merged = mergeFirebaseAndLocal(fbItems, localItems);
      saveLocal(col.local, merged);
      count += merged.length;
    } catch (e) {
      const isPermission = e.message && e.message.includes("permission");
      if (isPermission) {
        logFirebase("pull:" + col.local, "error", "Firestore rules blocking access. Update rules in Firebase Console → Firestore → Rules.");
      } else {
        logFirebase("pull:" + col.local, "error", e.message);
      }
      errors.push(`${col.local} - ${e.message}`);
    }
  }

  // Checklist
  try {
    const checkSnap = await getDoc(doc(db, "users", uid, "checklist", "data"));
    if (checkSnap.exists()) {
      const fbCheck = checkSnap.data().items || [];
      const localCheck = getLocal("tj_checklist");
      const mergedCheck = mergeFirebaseAndLocal(fbCheck, localCheck);
      saveLocal("tj_checklist", mergedCheck);
      count++;
    }
  } catch (e) {
    const isPermission = e.message && e.message.includes("permission");
    if (isPermission) {
      logFirebase("pull:checklist", "error", "Firestore rules blocking. Update rules in Firebase Console.");
    } else {
      logFirebase("pull:checklist", "error", e.message);
    }
    errors.push(`checklist - ${e.message}`);
  }

  // If all errors are permission errors, give clear message
  const allPermission = errors.length > 0 && errors.every(e => e.includes("permission"));
  if (allPermission) {
    logFirebase("pull:info", "error", "FIX: Go to Firebase Console → Firestore Database → Rules → Set read/write to 'true' for testing, then deploy proper rules.");
  }

  if (errors.length > 0) {
    logFirebase("bulkPull", "error", `${errors.length} errors. Local data is safe.`);
  } else {
    logFirebase("bulkPull", "ok", `${count} items pulled and merged`);
  }

  return { ok: errors.length === 0, count, errors, allPermission };
}

// ==============================
// --- ACCOUNTS ---
// ==============================
export async function getAccounts() {
  const uid = getUserId();
  const localAccounts = getLocal("tj_accounts");

  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "accounts"));
      const snap = await getDocs(q);
      const fbList = [];
      snap.forEach(d => fbList.push({ id: d.id, ...d.data() }));

      const merged = mergeFirebaseAndLocal(fbList, localAccounts);
      saveLocal("tj_accounts", merged);
      return merged;
    } catch (e) {
      logFirebase("getAccounts", "error", e.message);
    }
  }

  if (localAccounts.length === 0) {
    const defaultAcc = {
      id: "default",
      name: "Default Live Account",
      type: "Forex",
      balance: 10000,
      currency: "USD",
      archived: false,
      transactions: [{ date: new Date().toISOString().split("T")[0], type: "deposit", amount: 10000, note: "Initial balance" }],
      createdAt: new Date().toISOString()
    };
    saveLocal("tj_accounts", [defaultAcc]);
    return [defaultAcc];
  }
  return localAccounts;
}

export async function saveAccount(account) {
  const uid = getUserId();
  const accId = account.id || "acc_" + generateId();

  const accountData = {
    name: account.name || "Unnamed Account",
    type: account.type || "Forex",
    balance: parseFloat(account.balance) || 0,
    currency: account.currency || "USD",
    archived: account.archived || false,
    transactions: account.transactions || [],
    createdAt: account.createdAt || new Date().toISOString()
  };

  return await dualWrite("tj_accounts", ["users", uid || "_local", "accounts"], accountData, accId);
}

export async function archiveAccount(accountId, archived) {
  const accounts = getLocal("tj_accounts");
  const idx = accounts.findIndex(a => a.id === accountId);
  if (idx >= 0) {
    accounts[idx].archived = archived;
    saveLocal("tj_accounts", accounts);
  }

  const uid = getUserId();
  if (uid) {
    try {
      await updateDoc(doc(db, "users", uid, "accounts", accountId), { archived });
    } catch (e) {
      logFirebase("archiveAccount", "error", e.message);
    }
  }
  return true;
}

export async function deleteAccount(accountId) {
  const uid = getUserId();
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "accounts", accountId));
      const tradesRef = collection(db, "users", uid, "trades");
      const q = query(tradesRef, where("accountId", "==", accountId));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      logFirebase("deleteAccount", "error", e.message);
    }
  }

  let accounts = getLocal("tj_accounts");
  accounts = accounts.filter(a => a.id !== accountId);
  saveLocal("tj_accounts", accounts);

  let trades = getLocal("tj_trades");
  trades = trades.filter(t => t.accountId !== accountId);
  saveLocal("tj_trades", trades);
  return true;
}

// ==============================
// --- TRADES ---
// ==============================
export async function getTrades(accountId = "all") {
  const uid = getUserId();
  const localTrades = getLocal("tj_trades");

  if (uid) {
    try {
      let q = collection(db, "users", uid, "trades");
      if (accountId !== "all") {
        q = query(q, where("accountId", "==", accountId));
      }
      const snap = await getDocs(q);
      const fbList = [];
      snap.forEach(d => fbList.push({ id: d.id, ...d.data() }));

      // Merge with local (never lose data)
      const merged = mergeFirebaseAndLocal(fbList, localTrades);
      saveLocal("tj_trades", merged);

      let result = merged;
      if (accountId !== "all") {
        result = merged.filter(t => t.accountId === accountId);
      }
      return result.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")) - new Date(a.date + "T" + (a.time || "00:00")));
    } catch (e) {
      logFirebase("getTrades", "error", e.message);
    }
  }

  let result = localTrades;
  if (accountId !== "all") {
    result = localTrades.filter(t => t.accountId === accountId);
  }
  return result.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")) - new Date(a.date + "T" + (a.time || "00:00")));
}

export async function saveTrade(trade) {
  const uid = getUserId();
  const tradeId = trade.id || "trade_" + generateId();

  const tradeData = {
    accountId: trade.accountId || "default",
    asset: trade.asset ? trade.asset.toUpperCase() : "EURUSD",
    type: trade.type || "Buy",
    entryPrice: parseFloat(trade.entryPrice) || 0,
    exitPrice: parseFloat(trade.exitPrice) || 0,
    stopLoss: parseFloat(trade.stopLoss) || 0,
    takeProfit: parseFloat(trade.takeProfit) || 0,
    quantity: parseFloat(trade.quantity) || 0,
    date: trade.date || new Date().toISOString().split("T")[0],
    time: trade.time || new Date().toTimeString().split(" ")[0].substring(0, 5),
    pnl: parseFloat(trade.pnl) || 0,
    rMultiple: parseFloat(trade.rMultiple) || 0,
    commission: parseFloat(trade.commission) || 0,
    swap: parseFloat(trade.swap) || 0,
    result: trade.result || "Break-even",
    strategy: trade.strategy || "None",
    setup: trade.setup || "None",
    marketCondition: trade.marketCondition || "Trending",
    timeframe: trade.timeframe || "1H",
    emotionBefore: trade.emotionBefore || "Neutral",
    emotionAfter: trade.emotionAfter || "Neutral",
    confidence: parseInt(trade.confidence) || 3,
    discipline: parseInt(trade.discipline) || 3,
    notes: trade.notes || "",
    mistakes: trade.mistakes || [],
    lessons: trade.lessons || "",
    screenshotUrl: trade.screenshotUrl || "",
    updatedAt: new Date().toISOString()
  };

  return await dualWrite("tj_trades", ["users", uid || "_local", "trades"], tradeData, tradeId);
}

export async function deleteTrade(tradeId) {
  return await dualDelete("tj_trades", ["users", getUserId() || "_local", "trades"], tradeId);
}

// ==============================
// --- NOTES ---
// ==============================
export async function getNotes() {
  const uid = getUserId();
  const localNotes = getLocal("tj_notes");

  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "notes"));
      const snap = await getDocs(q);
      const fbList = [];
      snap.forEach(d => fbList.push({ id: d.id, ...d.data() }));

      const merged = mergeFirebaseAndLocal(fbList, localNotes);
      saveLocal("tj_notes", merged);
      return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      logFirebase("getNotes", "error", e.message);
    }
  }

  return localNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function saveNote(note) {
  const uid = getUserId();
  const noteId = note.id || "note_" + generateId();

  const noteData = {
    date: note.date || new Date().toISOString().split("T")[0],
    title: note.title || "Daily Review",
    content: note.content || "",
    category: note.category || "Daily Review",
    tags: note.tags || [],
    emotion: note.emotion || "Neutral",
    mistakes: note.mistakes || [],
    lessons: note.lessons || "",
    updatedAt: new Date().toISOString()
  };

  return await dualWrite("tj_notes", ["users", uid || "_local", "notes"], noteData, noteId);
}

export async function deleteNote(noteId) {
  return await dualDelete("tj_notes", ["users", getUserId() || "_local", "notes"], noteId);
}

// ==============================
// --- GOALS ---
// ==============================
export async function getGoals() {
  const uid = getUserId();
  const localGoals = getLocal("tj_goals");

  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "goals"));
      const snap = await getDocs(q);
      const fbList = [];
      snap.forEach(d => fbList.push({ id: d.id, ...d.data() }));

      const merged = mergeFirebaseAndLocal(fbList, localGoals);
      saveLocal("tj_goals", merged);
      return merged;
    } catch (e) {
      logFirebase("getGoals", "error", e.message);
    }
  }

  if (localGoals.length === 0) {
    const defaultGoals = [
      { id: "g1", title: "Maintain Win Rate > 55%", target: 55, current: 0, deadline: "", completed: false },
      { id: "g2", title: "Keep Profit Factor > 1.5", target: 1.5, current: 0, deadline: "", completed: false },
      { id: "g3", title: "Complete 20 Disciplined Trades", target: 20, current: 0, deadline: "", completed: false }
    ];
    saveLocal("tj_goals", defaultGoals);
    return defaultGoals;
  }
  return localGoals;
}

export async function saveGoal(goal) {
  const uid = getUserId();
  const goalId = goal.id || "goal_" + generateId();

  const goalData = {
    title: goal.title || "",
    target: parseFloat(goal.target) || 0,
    current: parseFloat(goal.current) || 0,
    deadline: goal.deadline || "",
    completed: !!goal.completed,
    updatedAt: new Date().toISOString()
  };

  return await dualWrite("tj_goals", ["users", uid || "_local", "goals"], goalData, goalId);
}

export async function deleteGoal(goalId) {
  return await dualDelete("tj_goals", ["users", getUserId() || "_local", "goals"], goalId);
}

// ==============================
// --- CHECKLIST ---
// ==============================
export async function getChecklist() {
  const uid = getUserId();
  const localChecklist = getLocal("tj_checklist");

  if (uid) {
    try {
      const docSnap = await getDoc(doc(db, "users", uid, "checklist", "data"));
      if (docSnap.exists()) {
        const fbCheck = docSnap.data().items || [];
        const merged = mergeFirebaseAndLocal(fbCheck, localChecklist);
        saveLocal("tj_checklist", merged);
        return merged;
      }
    } catch (e) {
      logFirebase("getChecklist", "error", e.message);
    }
  }

  if (localChecklist.length === 0) {
    const defaultChecklist = [
      { id: "c1", task: "Check economic calendar for high-impact news", completed: false },
      { id: "c2", task: "Define support, resistance, and key levels", completed: false },
      { id: "c3", task: "Verify trend direction on higher timeframe", completed: false },
      { id: "c4", task: "Calculate position size based on max 1% risk", completed: false },
      { id: "c5", task: "Confirm entry setup matches strategy rules", completed: false },
      { id: "c6", task: "Set Stop Loss and Take Profit orders in platform", completed: false },
      { id: "c7", task: "Accept the risk before pulling the trigger", completed: false }
    ];
    saveLocal("tj_checklist", defaultChecklist);
    return defaultChecklist;
  }
  return localChecklist;
}

export async function saveChecklist(items) {
  const uid = getUserId();
  saveLocal("tj_checklist", items);

  if (uid) {
    try {
      await setDoc(doc(db, "users", uid, "checklist", "data"), { items });
      logFirebase("saveChecklist", "ok");
    } catch (e) {
      logFirebase("saveChecklist", "error", e.message);
    }
  }
  return items;
}

// ==============================
// --- BULK IMPORT / EXPORT ---
// ==============================
export async function exportData() {
  return {
    accounts: getLocal("tj_accounts"),
    trades: getLocal("tj_trades"),
    notes: getLocal("tj_notes"),
    goals: getLocal("tj_goals"),
    checklist: getLocal("tj_checklist"),
    exportedAt: new Date().toISOString(),
    version: "2.0"
  };
}

export async function importData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid import data format.");
  }

  if (Array.isArray(data.accounts)) saveLocal("tj_accounts", data.accounts);
  if (Array.isArray(data.trades)) saveLocal("tj_trades", data.trades);
  if (Array.isArray(data.notes)) saveLocal("tj_notes", data.notes);
  if (Array.isArray(data.goals)) saveLocal("tj_goals", data.goals);
  if (Array.isArray(data.checklist)) saveLocal("tj_checklist", data.checklist);

  // Also push to Firebase if logged in
  const uid = getUserId();
  if (uid) {
    const result = await pushLocalToFirebase();
    return result.ok;
  }
  return true;
}

export async function syncLocalDataToFirestore() {
  return await pushLocalToFirebase();
}
