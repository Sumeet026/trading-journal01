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

// Helper to check if Firebase auth is active
function getUserId() {
  if (isFirebaseEnabled && auth && auth.currentUser) {
    return auth.currentUser.uid;
  }
  return null;
}

// Generate unique ID for local items
function generateId() {
  return "_" + Math.random().toString(36).substr(2, 9);
}

// --- LOCAL STORAGE HELPERS ---
function getLocal(key, defaultVal = []) {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// --- ACCOUNTS ---
export async function getAccounts() {
  const uid = getUserId();
  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "accounts"));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error("Firebase getAccounts failed, falling back to local:", e);
    }
  }
  
  // Fallback to local
  const accounts = getLocal("tj_accounts");
  if (accounts.length === 0) {
    // Seed default account
    const defaultAcc = {
      id: "default",
      name: "Default Live Account",
      type: "Forex",
      balance: 10000,
      currency: "USD",
      transactions: [{ date: new Date().toISOString().split("T")[0], type: "deposit", amount: 10000, note: "Initial balance" }],
      createdAt: new Date().toISOString()
    };
    saveLocal("tj_accounts", [defaultAcc]);
    return [defaultAcc];
  }
  return accounts;
}

export async function saveAccount(account) {
  const uid = getUserId();
  const accId = account.id || (uid ? null : "acc_" + generateId());
  
  const accountData = {
    name: account.name || "Unnamed Account",
    type: account.type || "Forex",
    balance: parseFloat(account.balance) || 0,
    currency: account.currency || "USD",
    transactions: account.transactions || [],
    createdAt: account.createdAt || new Date().toISOString()
  };

  if (uid) {
    try {
      if (accId) {
        await setDoc(doc(db, "users", uid, "accounts", accId), accountData);
        return { id: accId, ...accountData };
      } else {
        const docRef = await addDoc(collection(db, "users", uid, "accounts"), accountData);
        return { id: docRef.id, ...accountData };
      }
    } catch (e) {
      console.error("Firebase saveAccount failed, saving locally:", e);
    }
  }

  // Local Storage
  const accounts = getLocal("tj_accounts");
  const finalId = accId || "acc_" + generateId();
  const newAccount = { id: finalId, ...accountData };
  
  const index = accounts.findIndex(a => a.id === finalId);
  if (index >= 0) {
    accounts[index] = newAccount;
  } else {
    accounts.push(newAccount);
  }
  saveLocal("tj_accounts", accounts);
  return newAccount;
}

export async function deleteAccount(accountId) {
  const uid = getUserId();
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "accounts", accountId));
      
      // Also delete trades associated with this account from firestore
      const tradesRef = collection(db, "users", uid, "trades");
      const q = query(tradesRef, where("accountId", "==", accountId));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.error("Firebase deleteAccount failed:", e);
    }
  }

  // Local Storage
  let accounts = getLocal("tj_accounts");
  accounts = accounts.filter(a => a.id !== accountId);
  saveLocal("tj_accounts", accounts);

  // Delete associated trades
  let trades = getLocal("tj_trades");
  trades = trades.filter(t => t.accountId !== accountId);
  saveLocal("tj_trades", trades);
  return true;
}

// --- TRADES ---
export async function getTrades(accountId = "all") {
  const uid = getUserId();
  if (uid) {
    try {
      let q = collection(db, "users", uid, "trades");
      if (accountId !== "all") {
        q = query(q, where("accountId", "==", accountId));
      }
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date/time descending
      return list.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")) - new Date(a.date + "T" + (a.time || "00:00")));
    } catch (e) {
      console.error("Firebase getTrades failed, falling back to local:", e);
    }
  }

  // Local Storage
  let trades = getLocal("tj_trades");
  if (accountId !== "all") {
    trades = trades.filter(t => t.accountId === accountId);
  }
  return trades.sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")) - new Date(a.date + "T" + (a.time || "00:00")));
}

export async function saveTrade(trade) {
  const uid = getUserId();
  const tradeId = trade.id || null;
  
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

  if (uid) {
    try {
      if (tradeId) {
        await setDoc(doc(db, "users", uid, "trades", tradeId), tradeData);
        return { id: tradeId, ...tradeData };
      } else {
        const docRef = await addDoc(collection(db, "users", uid, "trades"), tradeData);
        return { id: docRef.id, ...tradeData };
      }
    } catch (e) {
      console.error("Firebase saveTrade failed:", e);
    }
  }

  // Local Storage
  const trades = getLocal("tj_trades");
  const finalId = tradeId || "trade_" + generateId();
  const newTrade = { id: finalId, ...tradeData };
  
  const index = trades.findIndex(t => t.id === finalId);
  if (index >= 0) {
    trades[index] = newTrade;
  } else {
    trades.push(newTrade);
  }
  saveLocal("tj_trades", trades);
  return newTrade;
}

export async function deleteTrade(tradeId) {
  const uid = getUserId();
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "trades", tradeId));
      return true;
    } catch (e) {
      console.error("Firebase deleteTrade failed:", e);
    }
  }

  // Local Storage
  let trades = getLocal("tj_trades");
  trades = trades.filter(t => t.id !== tradeId);
  saveLocal("tj_trades", trades);
  return true;
}

// --- DAILY JOURNAL NOTES ---
export async function getNotes() {
  const uid = getUserId();
  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "notes"));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error("Firebase getNotes failed:", e);
    }
  }

  // Local Storage
  const notes = getLocal("tj_notes");
  return notes.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function saveNote(note) {
  const uid = getUserId();
  const noteId = note.id || null;

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

  if (uid) {
    try {
      if (noteId) {
        await setDoc(doc(db, "users", uid, "notes", noteId), noteData);
        return { id: noteId, ...noteData };
      } else {
        const docRef = await addDoc(collection(db, "users", uid, "notes"), noteData);
        return { id: docRef.id, ...noteData };
      }
    } catch (e) {
      console.error("Firebase saveNote failed:", e);
    }
  }

  // Local Storage
  const notes = getLocal("tj_notes");
  const finalId = noteId || "note_" + generateId();
  const newNote = { id: finalId, ...noteData };

  const index = notes.findIndex(n => n.id === finalId);
  if (index >= 0) {
    notes[index] = newNote;
  } else {
    notes.push(newNote);
  }
  saveLocal("tj_notes", notes);
  return newNote;
}

export async function deleteNote(noteId) {
  const uid = getUserId();
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "notes", noteId));
      return true;
    } catch (e) {
      console.error("Firebase deleteNote failed:", e);
    }
  }

  // Local Storage
  let notes = getLocal("tj_notes");
  notes = notes.filter(n => n.id !== noteId);
  saveLocal("tj_notes", notes);
  return true;
}

// --- GOALS TRACKING ---
export async function getGoals() {
  const uid = getUserId();
  if (uid) {
    try {
      const q = query(collection(db, "users", uid, "goals"));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.error("Firebase getGoals failed:", e);
    }
  }

  // Local Storage
  const goals = getLocal("tj_goals");
  if (goals.length === 0) {
    // Seed standard goals
    const defaultGoals = [
      { id: "g1", title: "Maintain Win Rate > 55%", target: 55, current: 0, deadline: "", completed: false },
      { id: "g2", title: "Keep Profit Factor > 1.5", target: 1.5, current: 0, deadline: "", completed: false },
      { id: "g3", title: "Complete 20 Disciplined Trades", target: 20, current: 0, deadline: "", completed: false }
    ];
    saveLocal("tj_goals", defaultGoals);
    return defaultGoals;
  }
  return goals;
}

export async function saveGoal(goal) {
  const uid = getUserId();
  const goalId = goal.id || null;

  const goalData = {
    title: goal.title || "",
    target: parseFloat(goal.target) || 0,
    current: parseFloat(goal.current) || 0,
    deadline: goal.deadline || "",
    completed: !!goal.completed,
    updatedAt: new Date().toISOString()
  };

  if (uid) {
    try {
      if (goalId) {
        await setDoc(doc(db, "users", uid, "goals", goalId), goalData);
        return { id: goalId, ...goalData };
      } else {
        const docRef = await addDoc(collection(db, "users", uid, "goals"), goalData);
        return { id: docRef.id, ...goalData };
      }
    } catch (e) {
      console.error("Firebase saveGoal failed:", e);
    }
  }

  // Local Storage
  const goals = getLocal("tj_goals");
  const finalId = goalId || "goal_" + generateId();
  const newGoal = { id: finalId, ...goalData };

  const index = goals.findIndex(g => g.id === finalId);
  if (index >= 0) {
    goals[index] = newGoal;
  } else {
    goals.push(newGoal);
  }
  saveLocal("tj_goals", goals);
  return newGoal;
}

export async function deleteGoal(goalId) {
  const uid = getUserId();
  if (uid) {
    try {
      await deleteDoc(doc(db, "users", uid, "goals", goalId));
      return true;
    } catch (e) {
      console.error("Firebase deleteGoal failed:", e);
    }
  }

  // Local Storage
  let goals = getLocal("tj_goals");
  goals = goals.filter(g => g.id !== goalId);
  saveLocal("tj_goals", goals);
  return true;
}

// --- TRADING CHECKLIST ---
export async function getChecklist() {
  const uid = getUserId();
  if (uid) {
    try {
      const docSnap = await getDoc(doc(db, "users", uid, "checklist", "data"));
      if (docSnap.exists()) {
        return docSnap.data().items || [];
      }
    } catch (e) {
      console.error("Firebase getChecklist failed:", e);
    }
  }

  // Local Storage
  const items = getLocal("tj_checklist");
  if (items.length === 0) {
    // Seed default checklist
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
  return items;
}

export async function saveChecklist(items) {
  const uid = getUserId();
  if (uid) {
    try {
      await setDoc(doc(db, "users", uid, "checklist", "data"), { items });
      return items;
    } catch (e) {
      console.error("Firebase saveChecklist failed:", e);
    }
  }

  // Local Storage
  saveLocal("tj_checklist", items);
  return items;
}

// --- BULK DATA IMPORT / EXPORT / SYNC ---
export async function exportData() {
  const accounts = await getAccounts();
  const trades = await getTrades();
  const notes = await getNotes();
  const goals = await getGoals();
  const checklist = await getChecklist();

  return {
    accounts,
    trades,
    notes,
    goals,
    checklist,
    exportedAt: new Date().toISOString(),
    version: "1.0"
  };
}

export async function importData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid import data format.");
  }

  const uid = getUserId();

  if (uid) {
    try {
      // Import accounts to Firestore
      if (Array.isArray(data.accounts)) {
        for (const account of data.accounts) {
          const accId = account.id;
          const cleanAcc = { ...account };
          delete cleanAcc.id;
          await setDoc(doc(db, "users", uid, "accounts", accId), cleanAcc);
        }
      }
      
      // Import trades to Firestore
      if (Array.isArray(data.trades)) {
        for (const trade of data.trades) {
          const tId = trade.id;
          const cleanTrade = { ...trade };
          delete cleanTrade.id;
          await setDoc(doc(db, "users", uid, "trades", tId), cleanTrade);
        }
      }

      // Import notes to Firestore
      if (Array.isArray(data.notes)) {
        for (const note of data.notes) {
          const nId = note.id;
          const cleanNote = { ...note };
          delete cleanNote.id;
          await setDoc(doc(db, "users", uid, "notes", nId), cleanNote);
        }
      }

      // Import goals to Firestore
      if (Array.isArray(data.goals)) {
        for (const goal of data.goals) {
          const gId = goal.id;
          const cleanGoal = { ...goal };
          delete cleanGoal.id;
          await setDoc(doc(db, "users", uid, "goals", gId), cleanGoal);
        }
      }

      // Import checklist to Firestore
      if (Array.isArray(data.checklist)) {
        await setDoc(doc(db, "users", uid, "checklist", "data"), { items: data.checklist });
      }

      return true;
    } catch (e) {
      console.error("Firebase importData failed, continuing to save locally:", e);
    }
  }

  // Local Storage overwrite
  if (Array.isArray(data.accounts)) saveLocal("tj_accounts", data.accounts);
  if (Array.isArray(data.trades)) saveLocal("tj_trades", data.trades);
  if (Array.isArray(data.notes)) saveLocal("tj_notes", data.notes);
  if (Array.isArray(data.goals)) saveLocal("tj_goals", data.goals);
  if (Array.isArray(data.checklist)) saveLocal("tj_checklist", data.checklist);

  return true;
}

// Sync LocalStorage data to Firestore on successful login
export async function syncLocalDataToFirestore() {
  const uid = getUserId();
  if (!uid) return false;

  try {
    const localData = await exportData();
    await importData(localData);
    console.log("LocalStorage data successfully synced to Firestore.");
    // Clear local storage or leave as secondary cache
    return true;
  } catch (e) {
    console.error("Syncing local data to Firestore failed:", e);
    return false;
  }
}
