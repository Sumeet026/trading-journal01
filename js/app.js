import {
  auth,
  isFirebaseEnabled,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "./firebase.js";

import {
  getAccounts,
  saveAccount,
  deleteAccount,
  archiveAccount,
  getTrades,
  saveTrade,
  deleteTrade,
  getNotes,
  saveNote,
  deleteNote,
  getGoals,
  saveGoal,
  deleteGoal,
  getChecklist,
  saveChecklist,
  exportData,
  importData,
  syncLocalDataToFirestore,
  getFirebaseLogs,
  clearFirebaseLogs,
  pushLocalToFirebase,
  pullFirebaseToLocal
} from "./storage.js";

import {
  renderEquityCurve,
  renderDailyPnL,
  renderWeeklyPnL,
  renderMonthlyPnL,
  renderWinLossPie,
  renderStrategyPerformance,
  renderPnLDistribution,
  renderDrawdownCurve,
  renderPortfolioAllocation,
  renderHourlyPnL,
  renderDayOfWeekPnL,
  renderPsychologyScore,
  drawMonteCarloSimulation
} from "./chart.js";

import {
  renderCalendar
} from "./calendar.js";

// --- GLOBAL APPLICATION STATE ---
let state = {
  user: null,
  isLocalMode: false,
  accounts: [],
  activeAccountId: "all",
  trades: [],      // Filtered trades for active account
  allTrades: [],   // Unfiltered trades for all accounts
  notes: [],
  goals: [],
  checklist: [],
  currentTab: "dashboardPage",
  activeTradeType: "Buy",
  dateFrom: "",
  dateTo: "",
  showArchived: false
};

// --- CURRENCY SYMBOL MAPPING ---
const currencySymbols = {
  "USD": "$",
  "EUR": "€",
  "GBP": "£",
  "INR": "₹"
};

function getCurrencySymbol(currency) {
  return currencySymbols[currency] || "$";
}

function getAccountCurrency(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  return acc ? (acc.currency || "USD") : "USD";
}

// --- DOM ELEMENTS REFERENCE ---
const els = {
  authOverlay: document.getElementById("authOverlay"),
  authForm: document.getElementById("authForm"),
  authTitle: document.getElementById("authTitle"),
  authSubtitle: document.getElementById("authSubtitle"),
  authSubmitBtn: document.getElementById("authSubmitBtn"),
  authSwitchBtn: document.getElementById("authSwitchBtn"),
  authSwitchText: document.getElementById("authSwitchText"),
  nameGroup: document.getElementById("nameGroup"),
  authName: document.getElementById("authName"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authRemember: document.getElementById("authRemember"),
  forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),
  
  emailVerifyOverlay: document.getElementById("emailVerifyOverlay"),
  verifyEmailDisplay: document.getElementById("verifyEmailDisplay"),
  resendVerifyBtn: document.getElementById("resendVerifyBtn"),
  checkVerifyBtn: document.getElementById("checkVerifyBtn"),
  logoutFromVerifyBtn: document.getElementById("logoutFromVerifyBtn"),
  verifyStatusMsg: document.getElementById("verifyStatusMsg"),
  
  appMain: document.getElementById("appMain"),
  headerTitle: document.getElementById("headerTitle"),
  globalAccountSelector: document.getElementById("globalAccountSelector"),
  headerQuickAddBtn: document.getElementById("headerQuickAddBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  avatarInitial: document.getElementById("avatarInitial"),
  profileName: document.getElementById("profileName"),
  profileEmail: document.getElementById("profileEmail"),
  
  // Dashboard elements
  statTodayPnL: document.getElementById("statTodayPnL"),
  statTodayTrend: document.getElementById("statTodayTrend"),
  statTotalPnL: document.getElementById("statTotalPnL"),
  statTotalTrend: document.getElementById("statTotalTrend"),
  statBalance: document.getElementById("statBalance"),
  statGrowthTrend: document.getElementById("statGrowthTrend"),
  statWinRate: document.getElementById("statWinRate"),
  statWinLossRatio: document.getElementById("statWinLossRatio"),
  statTotalTrades: document.getElementById("statTotalTrades"),
  statBreakEvenCount: document.getElementById("statBreakEvenCount"),
  statRiskReward: document.getElementById("statRiskReward"),
  statAvgRMultiple: document.getElementById("statAvgRMultiple"),
  statBestTrade: document.getElementById("statBestTrade"),
  statBestTradeAsset: document.getElementById("statBestTradeAsset"),
  statWorstTrade: document.getElementById("statWorstTrade"),
  statWorstTradeAsset: document.getElementById("statWorstTradeAsset"),
  
  // Added stats metrics
  statProfitFactor: document.getElementById("statProfitFactor"),
  statMaxDrawdown: document.getElementById("statMaxDrawdown"),
  statStreak: document.getElementById("statStreak"),
  statRoi: document.getElementById("statRoi"),
  
  // News Calendar and Clocks
  econCalendarList: document.getElementById("econCalendarList"),
  headerLiveTime: document.getElementById("headerLiveTime"),
  badgeSydney: document.getElementById("badgeSydney"),
  badgeTokyo: document.getElementById("badgeTokyo"),
  badgeLondon: document.getElementById("badgeLondon"),
  badgeNewYork: document.getElementById("badgeNewYork"),
  dashAiCoachMessage: document.getElementById("dashAiCoachMessage"),
  
  dashTradesTable: document.getElementById("dashTradesTable").querySelector("tbody"),
  dashHeatmap: document.getElementById("dashHeatmap"),
  dashChecklist: document.getElementById("dashChecklist"),
  dashGoals: document.getElementById("dashGoals"),
  dashViewAllTradesBtn: document.getElementById("dashViewAllTradesBtn"),
  
  // Accounts page elements
  accountsGrid: document.getElementById("accountsGrid"),
  txAccount: document.getElementById("txAccount"),
  txType: document.getElementById("txType"),
  txAmount: document.getElementById("txAmount"),
  txNote: document.getElementById("txNote"),
  transactionForm: document.getElementById("transactionForm"),
  transactionsTable: document.getElementById("transactionsTable").querySelector("tbody"),
  openAddAccountModalBtn: document.getElementById("openAddAccountModalBtn"),
  
  // Journal Entry Form elements
  tradeFormTitle: document.getElementById("tradeFormTitle"),
  tradeForm: document.getElementById("tradeForm"),
  editTradeId: document.getElementById("editTradeId"),
  tradeAccount: document.getElementById("tradeAccount"),
  tradeAsset: document.getElementById("tradeAsset"),
  tradeType: document.getElementById("tradeType"),
  typeBuy: document.getElementById("typeBuy"),
  typeSell: document.getElementById("typeSell"),
  tradeEntryPrice: document.getElementById("tradeEntryPrice"),
  tradeExitPrice: document.getElementById("tradeExitPrice"),
  tradeQuantity: document.getElementById("tradeQuantity"),
  tradeCommission: document.getElementById("tradeCommission"),
  tradeDate: document.getElementById("tradeDate"),
  tradeStrategy: document.getElementById("tradeStrategy"),
  tradeSetup: document.getElementById("tradeSetup"),
  strategyInput: document.getElementById("strategyInput"),
  setupInput: document.getElementById("setupInput"),
  addStrategyBtn: document.getElementById("addStrategyBtn"),
  addSetupBtn: document.getElementById("addSetupBtn"),
  savedStrategies: document.getElementById("savedStrategies"),
  savedSetups: document.getElementById("savedSetups"),
  tradeTimeframe: document.getElementById("tradeTimeframe"),
  tradeEmotionBefore: document.getElementById("tradeEmotionBefore"),
  tradeEmotionAfter: document.getElementById("tradeEmotionAfter"),
  tradeConfidence: document.getElementById("tradeConfidence"),
  tradeDiscipline: document.getElementById("tradeDiscipline"),
  tradeNotes: document.getElementById("tradeNotes"),
  tradeLessons: document.getElementById("tradeLessons"),
  tradeScreenshot: document.getElementById("tradeScreenshot"),
  dropZone: document.getElementById("dropZone"),
  screenshotPreviewWrapper: document.getElementById("screenshotPreviewWrapper"),
  screenshotPreview: document.getElementById("screenshotPreview"),
  removeScreenshotBtn: document.getElementById("removeScreenshotBtn"),
  saveTradeSubmitBtn: document.getElementById("saveTradeSubmitBtn"),
  resetTradeFormBtn: document.getElementById("resetTradeFormBtn"),
  entryChecklist: document.getElementById("entryChecklist"),
  
  // Position Calculator elements
  calcBalance: document.getElementById("calcBalance"),
  calcRisk: document.getElementById("calcRisk"),
  calcStopLoss: document.getElementById("calcStopLoss"),
  calcPipVal: document.getElementById("calcPipVal"),
  calcRiskAmount: document.getElementById("calcRiskAmount"),
  calcPositionSize: document.getElementById("calcPositionSize"),
  
  // Trade History elements
  filterSearch: document.getElementById("filterSearch"),
  filterAccount: document.getElementById("filterAccount"),
  filterResult: document.getElementById("filterResult"),
  filterStrategy: document.getElementById("filterStrategy"),
  filterTimeframe: document.getElementById("filterTimeframe"),
  viewModeTable: document.getElementById("viewModeTable"),
  viewModeCard: document.getElementById("viewModeCard"),
  historyTableView: document.getElementById("historyTableView"),
  historyCardView: document.getElementById("historyCardView"),
  historyTable: document.getElementById("historyTable").querySelector("tbody"),
  
  // Analytics Reports elements
  reportProfitFactor: document.getElementById("reportProfitFactor"),
  reportAvgWinLoss: document.getElementById("reportAvgWinLoss"),
  reportAvgWinLossRatio: document.getElementById("reportAvgWinLossRatio"),
  reportMaxDrawdown: document.getElementById("reportMaxDrawdown"),
  reportStreaks: document.getElementById("reportStreaks"),
  reportBestDay: document.getElementById("reportBestDay"),
  reportBestDayAmount: document.getElementById("reportBestDayAmount"),
  reportWorstDay: document.getElementById("reportWorstDay"),
  reportWorstDayAmount: document.getElementById("reportWorstDayAmount"),
  reportBestStrategy: document.getElementById("reportBestStrategy"),
  reportBestStrategyAmount: document.getElementById("reportBestStrategyAmount"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportPdfBtn: document.getElementById("exportPdfBtn"),
  
  // Notes / Daily Log elements
  noteFormTitle: document.getElementById("noteFormTitle"),
  noteForm: document.getElementById("noteForm"),
  editNoteId: document.getElementById("editNoteId"),
  noteDate: document.getElementById("noteDate"),
  noteTitle: document.getElementById("noteTitle"),
  noteCategory: document.getElementById("noteCategory"),
  noteContent: document.getElementById("noteContent"),
  noteTags: document.getElementById("noteTags"),
  clearNoteFormBtn: document.getElementById("clearNoteFormBtn"),
  searchNotes: document.getElementById("searchNotes"),
  filterNotesCategory: document.getElementById("filterNotesCategory"),
  notesTimeline: document.getElementById("notesTimeline"),
  
  // Settings page elements
  profileForm: document.getElementById("profileForm"),
  profileInputName: document.getElementById("profileInputName"),
  profileInputEmail: document.getElementById("profileInputEmail"),
  connectionModeText: document.getElementById("connectionModeText"),
  firebaseConnectionBadge: document.getElementById("firebaseConnectionBadge"),
  openAuthModalBtn: document.getElementById("openAuthModalBtn"),
  syncFirebaseBtn: document.getElementById("syncFirebaseBtn"),
  settingsExportBackupBtn: document.getElementById("settingsExportBackupBtn"),
  settingsImportBackupFile: document.getElementById("settingsImportBackupFile"),
  resetAllDataBtn: document.getElementById("resetAllDataBtn"),
  
  // Modals overlays
  accountModal: document.getElementById("accountModal"),
  accountForm: document.getElementById("accountForm"),
  editAccountId: document.getElementById("editAccountId"),
  accName: document.getElementById("accName"),
  accType: document.getElementById("accType"),
  accBalance: document.getElementById("accBalance"),
  accCurrency: document.getElementById("accCurrency"),
  
  tradeDetailsModal: document.getElementById("tradeDetailsModal"),
  detailHeaderTitle: document.getElementById("detailHeaderTitle"),
  detailResultBadge: document.getElementById("detailResultBadge"),
  detailPnl: document.getElementById("detailPnl"),
  detailRMultiple: document.getElementById("detailRMultiple"),
  detailAccount: document.getElementById("detailAccount"),
  detailDirection: document.getElementById("detailDirection"),
  detailAsset: document.getElementById("detailAsset"),
  detailQuantity: document.getElementById("detailQuantity"),
  detailEntryPrice: document.getElementById("detailEntryPrice"),
  detailExitPrice: document.getElementById("detailExitPrice"),
  detailFees: document.getElementById("detailFees"),
  detailStrategy: document.getElementById("detailStrategy"),
  detailSetup: document.getElementById("detailSetup"),
  detailTimeframe: document.getElementById("detailTimeframe"),
  detailEmotionBefore: document.getElementById("detailEmotionBefore"),
  detailEmotionAfter: document.getElementById("detailEmotionAfter"),
  detailRatings: document.getElementById("detailRatings"),
  detailNotes: document.getElementById("detailNotes"),
  detailMistakes: document.getElementById("detailMistakes"),
  detailLessons: document.getElementById("detailLessons"),
  detailScreenshotSection: document.getElementById("detailScreenshotSection"),
  detailScreenshotImg: document.getElementById("detailScreenshotImg"),
  detailEditBtn: document.getElementById("detailEditBtn"),
  detailDeleteBtn: document.getElementById("detailDeleteBtn"),
  
  calendarDayModal: document.getElementById("calendarDayModal"),
  calendarDayModalTitle: document.getElementById("calendarDayModalTitle"),
  calendarDayTable: document.getElementById("calendarDayTable").querySelector("tbody"),
  
  // AI Coach elements
  aiInsightsPanel: document.getElementById("aiInsightsPanel"),
  aiChatBox: document.getElementById("aiChatBox"),
  aiChatForm: document.getElementById("aiChatForm"),
  aiChatInput: document.getElementById("aiChatInput"),
  aiChatSendBtn: document.getElementById("aiChatSendBtn"),
  
  // Psychology Hub elements
  psyConsistency: document.getElementById("psyConsistency"),
  psyDiscipline: document.getElementById("psyDiscipline"),
  psyMistakes: document.getElementById("psyMistakes"),
  psyPeak: document.getElementById("psyPeak"),
  psyBreachCount: document.getElementById("psyBreachCount"),
  psyEmotionTable: document.getElementById("psyEmotionTable").querySelector("tbody"),
  psyBreachesLog: document.getElementById("psyBreachesLog"),
  psyLessonsList: document.getElementById("psyLessonsList"),
  
  // Floating AI Coach elements
  floatingAiPanel: document.getElementById("floatingAiPanel"),
  floatingAiInput: document.getElementById("floatingAiInput"),
  floatingAiForm: document.getElementById("floatingAiForm"),
  closeFloatingAiBtn: document.getElementById("closeFloatingAiBtn"),
  floatingTriggerBubble: document.getElementById("floatingTriggerBubble"),
  
  // Extra elements
  googleLoginBtn: document.getElementById("googleLoginBtn"),
  themeSelectorContainer: document.getElementById("themeSelectorContainer"),
  runMonteCarloBtn: document.getElementById("runMonteCarloBtn"),
  
  notificationBanner: document.getElementById("notificationBanner"),
  notificationIcon: document.getElementById("notificationIcon"),
  notificationMessage: document.getElementById("notificationMessage"),
  dataDiagnosticsPanel: document.getElementById("dataDiagnosticsPanel"),
  dateFilterFrom: document.getElementById("dateFilterFrom"),
  dateFilterTo: document.getElementById("dateFilterTo"),
  clearDateFilter: document.getElementById("clearDateFilter"),
  liveSaveIndicator: document.getElementById("liveSaveIndicator"),
  firebaseLogsPanel: document.getElementById("firebaseLogsPanel"),
  refreshFirebaseLogsBtn: document.getElementById("refreshFirebaseLogsBtn"),
  clearFirebaseLogsBtn: document.getElementById("clearFirebaseLogsBtn"),
  pushToFirebaseBtn: document.getElementById("pushToFirebaseBtn"),
  pullFromFirebaseBtn: document.getElementById("pullFromFirebaseBtn")
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupMobileSidebar();
  setupMobileFilterToggle();
  setupEventListeners();
  checkAuthSession();
  initCustomTagSystem();
});

// --- CUSTOM TAG INPUT SYSTEM (Strategy & Setup) ---
let savedStrategies = JSON.parse(localStorage.getItem("tj_saved_strategies") || "[]");
let savedSetups = JSON.parse(localStorage.getItem("tj_saved_setups") || "[]");

function initCustomTagSystem() {
  renderStrategies();
  renderSetups();

  // Add Strategy
  els.addStrategyBtn.addEventListener("click", () => {
    const val = els.strategyInput.value.trim();
    if (val && !savedStrategies.includes(val)) {
      savedStrategies.push(val);
      localStorage.setItem("tj_saved_strategies", JSON.stringify(savedStrategies));
      els.strategyInput.value = "";
      renderStrategies();
    }
  });

  els.strategyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.addStrategyBtn.click();
    }
  });

  // Add Setup
  els.addSetupBtn.addEventListener("click", () => {
    const val = els.setupInput.value.trim();
    if (val && !savedSetups.includes(val)) {
      savedSetups.push(val);
      localStorage.setItem("tj_saved_setups", JSON.stringify(savedSetups));
      els.setupInput.value = "";
      renderSetups();
    }
  });

  els.setupInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      els.addSetupBtn.click();
    }
  });
}

function renderStrategies() {
  els.savedStrategies.innerHTML = "";
  if (savedStrategies.length === 0) {
    els.savedStrategies.innerHTML = '<span class="no-tags-msg">No strategies added yet. Type and click Add.</span>';
    return;
  }
  savedStrategies.forEach(s => {
    const isActive = els.tradeStrategy.value === s ? "active" : "";
    const chip = document.createElement("span");
    chip.className = `tag-chip ${isActive}`;
    chip.innerHTML = `${s} <span class="tag-delete" data-val="${s}">&times;</span>`;
    chip.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-delete")) {
        savedStrategies = savedStrategies.filter(x => x !== e.target.dataset.val);
        localStorage.setItem("tj_saved_strategies", JSON.stringify(savedStrategies));
        renderStrategies();
      } else {
        els.tradeStrategy.value = s;
        renderStrategies();
      }
    });
    els.savedStrategies.appendChild(chip);
  });
}

function renderSetups() {
  els.savedSetups.innerHTML = "";
  if (savedSetups.length === 0) {
    els.savedSetups.innerHTML = '<span class="no-tags-msg">No setups added yet. Type and click Add.</span>';
    return;
  }
  savedSetups.forEach(s => {
    const isActive = els.tradeSetup.value === s ? "active" : "";
    const chip = document.createElement("span");
    chip.className = `tag-chip ${isActive}`;
    chip.innerHTML = `${s} <span class="tag-delete" data-val="${s}">&times;</span>`;
    chip.addEventListener("click", (e) => {
      if (e.target.classList.contains("tag-delete")) {
        savedSetups = savedSetups.filter(x => x !== e.target.dataset.val);
        localStorage.setItem("tj_saved_setups", JSON.stringify(savedSetups));
        renderSetups();
      } else {
        els.tradeSetup.value = s;
        renderSetups();
      }
    });
    els.savedSetups.appendChild(chip);
  });
}

// --- AUTHENTICATION FLOW ---
let isSignUpMode = true;

function checkAuthSession() {
  if (isFirebaseEnabled) {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        state.user = firebaseUser;
        state.isLocalMode = false;
        
        // Check if email is verified
        if (firebaseUser.emailVerified) {
          showNotification("Successfully authenticated.", "success");
          initAppUI();
        } else {
          // Email not verified - show verification screen
          showEmailVerifyScreen(firebaseUser.email);
        }
      } else {
        showAuthScreen();
      }
    });
  } else {
    // Firebase disabled - show auth screen (no local mode allowed)
    showAuthScreen();
  }
}

function showAuthScreen() {
  els.authOverlay.style.display = "flex";
  els.appMain.style.display = "none";
  els.emailVerifyOverlay.style.display = "none";
  setAuthMode(true);
}

function showEmailVerifyScreen(email) {
  els.authOverlay.style.display = "none";
  els.appMain.style.display = "none";
  els.emailVerifyOverlay.style.display = "flex";
  els.verifyEmailDisplay.textContent = email || "";
  els.verifyStatusMsg.textContent = "";
}

function setAuthMode(signUp) {
  isSignUpMode = signUp;
  if (isSignUpMode) {
    els.authTitle.innerText = "Create Account";
    els.authSubtitle.innerText = "Join thousands of professional traders tracking their growth.";
    els.nameGroup.style.display = "flex";
    els.authSubmitBtn.innerText = "Create Account";
    els.authSwitchText.innerText = "Already have an account?";
    els.authSwitchBtn.innerText = "Log In";
    els.forgotPasswordBtn.style.display = "none";
  } else {
    els.authTitle.innerText = "Welcome Back";
    els.authSubtitle.innerText = "Log in to view your journals and sync with the cloud.";
    els.nameGroup.style.display = "none";
    els.authSubmitBtn.innerText = "Log In";
    els.authSwitchText.innerText = "Don't have an account?";
    els.authSwitchBtn.innerText = "Sign Up";
    els.forgotPasswordBtn.style.display = "inline";
  }
}

// Global modal helpers
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
};

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("active");
}

// Set Trade Type toggle
window.setTradeType = function(type) {
  state.activeTradeType = type;
  els.tradeType.value = type;
  if (type === "Buy") {
    els.typeBuy.className = "toggle-btn active-buy";
    els.typeSell.className = "toggle-btn";
  } else {
    els.typeBuy.className = "toggle-btn";
    els.typeSell.className = "toggle-btn active-sell";
  }
};

// Calculate Position Size calculator
window.calculatePositionSize = function() {
  const balance = parseFloat(els.calcBalance.value) || 0;
  const riskPct = parseFloat(els.calcRisk.value) || 0;
  const stopLoss = parseFloat(els.calcStopLoss.value) || 0;
  const pipVal = parseFloat(els.calcPipVal.value) || 10;

  if (balance <= 0 || riskPct <= 0 || stopLoss <= 0) {
    showNotification("Invalid inputs in position calculator.", "warning");
    return;
  }

  const riskAmount = balance * (riskPct / 100);
  const positionSize = riskAmount / (stopLoss * pipVal);

  els.calcRiskAmount.innerText = "$" + riskAmount.toFixed(2);
  els.calcPositionSize.innerText = positionSize.toFixed(2) + " Lots/Units";
};

// --- EVENTS BINDING ---
function setupEventListeners() {
  // Auth Form toggle
  els.authSwitchBtn.addEventListener("click", () => {
    setAuthMode(!isSignUpMode);
  });

  // Auth Submit
  els.authForm.addEventListener("submit", async () => {
    const email = els.authEmail.value;
    const password = els.authPassword.value;
    const name = els.authName.value;

    try {
      if (isSignUpMode) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        // Send verification email
        await sendEmailVerification(userCred.user);
        showNotification("Account created! Verification email sent. Please check your inbox.", "success");
        // Show email verification screen
        showEmailVerifyScreen(email);
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        // Check if email is verified
        if (userCred.user.emailVerified) {
          showNotification("Logged in successfully!", "success");
          els.authOverlay.style.display = "none";
        } else {
          showNotification("Please verify your email first. Check your inbox.", "warning");
          showEmailVerifyScreen(email);
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      showNotification(error.message, "danger");
    }
  });

  // Email Verification - Resend
  els.resendVerifyBtn.addEventListener("click", async () => {
    if (state.user) {
      try {
        await sendEmailVerification(state.user);
        els.verifyStatusMsg.textContent = "Verification email sent! Check your inbox.";
        els.verifyStatusMsg.style.color = "var(--primary)";
        showNotification("Verification email resent!", "success");
      } catch (error) {
        els.verifyStatusMsg.textContent = "Failed to send. Try again later.";
        els.verifyStatusMsg.style.color = "var(--danger)";
      }
    }
  });

  // Email Verification - Check status
  els.checkVerifyBtn.addEventListener("click", async () => {
    if (state.user) {
      try {
        await state.user.reload();
        if (state.user.emailVerified) {
          showNotification("Email verified! Welcome!", "success");
          els.emailVerifyOverlay.style.display = "none";
          initAppUI();
        } else {
          els.verifyStatusMsg.textContent = "Email not verified yet. Check your inbox and click the link.";
          els.verifyStatusMsg.style.color = "var(--warning)";
          showNotification("Email not verified yet.", "warning");
        }
      } catch (error) {
        els.verifyStatusMsg.textContent = "Error checking status. Try again.";
        els.verifyStatusMsg.style.color = "var(--danger)";
      }
    }
  });

  // Email Verification - Logout
  els.logoutFromVerifyBtn.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("tj_local_mode");
    location.reload();
  });

  // Logout
  els.logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    localStorage.removeItem("tj_local_mode");
    location.reload();
  });

  // Global selector for Accounts
  els.globalAccountSelector.addEventListener("change", (e) => {
    state.activeAccountId = e.target.value;
    filterDataAndRefresh();
  });

  // Date Range Filter
  els.dateFilterFrom.addEventListener("change", (e) => {
    state.dateFrom = e.target.value;
    filterDataAndRefresh();
  });
  els.dateFilterTo.addEventListener("change", (e) => {
    state.dateTo = e.target.value;
    filterDataAndRefresh();
  });
  els.clearDateFilter.addEventListener("click", () => {
    state.dateFrom = "";
    state.dateTo = "";
    els.dateFilterFrom.value = "";
    els.dateFilterTo.value = "";
    filterDataAndRefresh();
  });

  // Open add Account Modal
  els.openAddAccountModalBtn.addEventListener("click", () => {
    els.editAccountId.value = "";
    els.accountForm.reset();
    els.accountForm.querySelector("button[type='submit']").innerText = "Create Account";
    openModal("accountModal");
  });

  // Account Form submit
  els.accountForm.addEventListener("submit", async () => {
    const accId = els.editAccountId.value || null;
    const newAcc = {
      id: accId,
      name: els.accName.value,
      type: els.accType.value,
      balance: parseFloat(els.accBalance.value),
      currency: els.accCurrency.value
    };

    const saved = await saveAccount(newAcc);
    showNotification(`Account ${accId ? 'updated' : 'created'} successfully!`, "success");
    closeModal("accountModal");
    
    // Refresh accounts data
    await loadInitialData();
  });

  // Adjust balance transaction submit
  els.transactionForm.addEventListener("submit", async () => {
    const accId = els.txAccount.value;
    const type = els.txType.value;
    const amount = parseFloat(els.txAmount.value);
    const note = els.txNote.value;

    const accountIndex = state.accounts.findIndex(a => a.id === accId);
    if (accountIndex >= 0) {
      const acc = state.accounts[accountIndex];
      if (!acc.transactions) acc.transactions = [];
      
      acc.transactions.push({
        date: new Date().toISOString().split("T")[0],
        type,
        amount,
        note
      });

      await saveAccount(acc);
      showNotification(`Posted ${type} of $${amount.toFixed(2)} successfully!`, "success");
      els.transactionForm.reset();
      await loadInitialData();
    }
  });

  // Quick Trade Button in Header
  els.headerQuickAddBtn.addEventListener("click", () => {
    resetTradeForm();
    switchTab("entryPage");
  });

  // Reset/Clear Trade Form button
  els.resetTradeFormBtn.addEventListener("click", () => {
    resetTradeForm();
  });

  // Trade Form submit
  els.tradeForm.addEventListener("submit", async () => {
    const entryPrice = parseFloat(els.tradeEntryPrice.value);
    const exitPrice = parseFloat(els.tradeExitPrice.value);
    const qty = parseFloat(els.tradeQuantity.value);
    const comm = parseFloat(els.tradeCommission.value) || 0;
    const type = els.tradeType.value;
    
    // Calculate PnL
    let pnl = 0;
    if (type === "Buy") {
      pnl = (exitPrice - entryPrice) * qty - comm;
    } else {
      pnl = (entryPrice - exitPrice) * qty - comm;
    }

    // Classify result
    let result = "Break-even";
    if (pnl > 0.05) result = "Win";
    else if (pnl < -0.05) result = "Loss";

    // Get selected mistakes
    const mistakes = [];
    document.querySelectorAll("input[name='mistakesCheck']:checked").forEach(cb => {
      mistakes.push(cb.value);
    });

    const tradeId = els.editTradeId.value || null;
    const tradeData = {
      id: tradeId,
      accountId: els.tradeAccount.value,
      asset: els.tradeAsset.value,
      type,
      entryPrice,
      exitPrice,
      quantity: qty,
      commission: comm,
      pnl,
      rMultiple: 0,
      result,
      date: els.tradeDate.value,
      strategy: els.tradeStrategy.value || "None",
      setup: els.tradeSetup.value || "None",
      timeframe: els.tradeTimeframe.value,
      emotionBefore: els.tradeEmotionBefore.value,
      emotionAfter: els.tradeEmotionAfter.value,
      confidence: parseInt(els.tradeConfidence.value),
      discipline: parseInt(els.tradeDiscipline.value),
      notes: els.tradeNotes.value,
      mistakes,
      lessons: els.tradeLessons.value,
      screenshotUrl: els.screenshotPreview.src && els.screenshotPreview.src.startsWith("data:") ? els.screenshotPreview.src : (tradeId ? state.allTrades.find(t => t.id === tradeId)?.screenshotUrl : "")
    };

    await saveTrade(tradeData);
    showNotification(`Trade ${tradeId ? 'updated' : 'logged'} successfully!`, "success");
    resetTradeForm();
    await loadInitialData();
    switchTab("historyPage");
  });

  // File Screenshot Selection click
  els.dropZone.addEventListener("click", () => {
    els.tradeScreenshot.click();
  });

  // Handle drag and drop files
  els.dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropZone.style.borderColor = "var(--primary)";
  });

  els.dropZone.addEventListener("dragleave", () => {
    els.dropZone.style.borderColor = "var(--card-border)";
  });

  els.dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropZone.style.borderColor = "var(--card-border)";
    if (e.dataTransfer.files.length) {
      handleScreenshotFile(e.dataTransfer.files[0]);
    }
  });

  els.tradeScreenshot.addEventListener("change", (e) => {
    if (e.target.files.length) {
      handleScreenshotFile(e.target.files[0]);
    }
  });

  // Remove screenshot
  els.removeScreenshotBtn.addEventListener("click", () => {
    els.screenshotPreview.src = "";
    els.screenshotPreviewWrapper.style.display = "none";
    els.dropZone.style.display = "block";
    els.tradeScreenshot.value = "";
  });

  // Search Trades / History Filters
  const triggerHistoryFilter = () => {
    renderHistoryPage();
  };
  els.filterSearch.addEventListener("input", triggerHistoryFilter);
  els.filterAccount.addEventListener("change", triggerHistoryFilter);
  els.filterResult.addEventListener("change", triggerHistoryFilter);
  els.filterStrategy.addEventListener("change", triggerHistoryFilter);
  els.filterTimeframe.addEventListener("change", triggerHistoryFilter);

  // Toggle History views
  els.viewModeTable.addEventListener("click", () => {
    els.viewModeTable.classList.add("active");
    els.viewModeCard.classList.remove("active");
    els.historyTableView.style.display = "block";
    els.historyCardView.style.display = "none";
  });

  els.viewModeCard.addEventListener("click", () => {
    els.viewModeCard.classList.add("active");
    els.viewModeTable.classList.remove("active");
    els.historyTableView.style.display = "none";
    els.historyCardView.style.display = "grid";
  });

  // Notes category filters / search notes
  const triggerNotesFilter = () => {
    renderNotesTimeline();
  };
  els.searchNotes.addEventListener("input", triggerNotesFilter);
  els.filterNotesCategory.addEventListener("change", triggerNotesFilter);

  // Daily Notes Form submit
  els.noteForm.addEventListener("submit", async () => {
    const noteId = els.editNoteId.value || null;
    const tagString = els.noteTags.value;
    const tags = tagString ? tagString.split(",").map(t => t.trim()) : [];

    const noteData = {
      id: noteId,
      date: els.noteDate.value,
      title: els.noteTitle.value,
      category: els.noteCategory.value,
      content: els.noteContent.value,
      tags
    };

    await saveNote(noteData);
    showNotification(`Journal Note ${noteId ? 'updated' : 'saved'}!`, "success");
    resetNoteForm();
    await loadInitialData();
  });

  // Clear note form
  els.clearNoteFormBtn.addEventListener("click", () => {
    resetNoteForm();
  });

  // Profile Form submit
  els.profileForm.addEventListener("submit", () => {
    const name = els.profileInputName.value;
    localStorage.setItem("tj_user_name", name);
    els.profileName.innerText = name;
    els.avatarInitial.innerText = name.charAt(0).toUpperCase();
    showNotification("Profile updated successfully (locally).", "success");
  });

  // Sync settings/Auth modal button
  if (els.openAuthModalBtn) {
    els.openAuthModalBtn.addEventListener("click", () => {
      showAuthScreen();
    });
  }

  if (els.syncFirebaseBtn) {
    els.syncFirebaseBtn.addEventListener("click", async () => {
      els.syncFirebaseBtn.disabled = true;
      els.syncFirebaseBtn.innerHTML = '<i class="fa fa-sync fa-spin"></i> Syncing...';
      
      const synced = await syncLocalDataToFirestore();
      if (synced) {
        showNotification("Data successfully synced with Firebase!", "success");
        await loadInitialData();
      } else {
        showNotification("Sync failed. Check database permissions.", "danger");
      }
      
      els.syncFirebaseBtn.disabled = false;
      els.syncFirebaseBtn.innerHTML = '<i class="fa fa-sync"></i> Sync Data Now';
    });
  }

  // Export Data Backup Settings
  els.settingsExportBackupBtn.addEventListener("click", async () => {
    const data = await exportData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `apex_trader_backup_${new Date().toISOString().split("T")[0]}.json`);
    dlAnchorElem.click();
    showNotification("Data backup file exported.", "info");
  });

  // Import Data Backup Settings
  els.settingsImportBackupFile.addEventListener("change", (e) => {
    const fileReader = new FileReader();
    fileReader.onload = async function (event) {
      try {
        const importedJson = JSON.parse(event.target.result);
        const success = await importData(importedJson);
        if (success) {
          showNotification("Data backup successfully restored!", "success");
          await loadInitialData();
        }
      } catch (err) {
        showNotification("Failed to parse JSON file.", "danger");
      }
    };
    if (e.target.files.length) {
      fileReader.readAsText(e.target.files[0]);
    }
  });

  // Reset database completely
  els.resetAllDataBtn.addEventListener("click", () => {
    if (confirm("WARNING: This will permanently delete all trades, accounts, and journal notes. Proceed?")) {
      localStorage.clear();
      showNotification("All database local caches cleared.", "warning");
      location.reload();
    }
  });

  // Export CSV
  els.exportCsvBtn.addEventListener("click", () => {
    exportTradesCsv();
  });

  // Export PDF
  els.exportPdfBtn.addEventListener("click", () => {
    showNotification("Preparing report... Opening system print dialog for PDF saving.", "info");
    window.print();
  });

  // Edit / Delete in Detail modal
  els.detailEditBtn.addEventListener("click", () => {
    const tradeId = els.detailEditBtn.getAttribute("data-id");
    closeModal("tradeDetailsModal");
    loadTradeIntoForm(tradeId);
  });

  els.detailDeleteBtn.addEventListener("click", async () => {
    const tradeId = els.detailDeleteBtn.getAttribute("data-id");
    if (confirm("Are you sure you want to delete this trade?")) {
      await deleteTrade(tradeId);
      showNotification("Trade deleted successfully.", "warning");
      closeModal("tradeDetailsModal");
      await loadInitialData();
    }
  });

  // Dashboard view all button
  els.dashViewAllTradesBtn.addEventListener("click", () => {
    switchTab("historyPage");
  });

  // Monte Carlo Re-Run button
  if (els.runMonteCarloBtn) {
    els.runMonteCarloBtn.addEventListener("click", () => {
      let startBal = 10000;
      if (state.activeAccountId !== "all") {
        const acc = state.accounts.find(a => a.id === state.activeAccountId);
        if (acc) startBal = acc.balance;
      } else {
        startBal = state.accounts.reduce((sum, a) => sum + a.balance, 0);
      }
      drawMonteCarloSimulation("chartMonteCarlo", state.trades, startBal);
      showNotification("Monte Carlo simulation re-run with fresh randomized paths.", "info");
    });
  }

  // AI Chat form submit
  if (els.aiChatForm) {
    els.aiChatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = els.aiChatInput.value.trim();
      if (!msg) return;
      handleAiChat(msg);
      els.aiChatInput.value = "";
    });
  }

  // Live clock update every second
  setInterval(updateLiveClock, 1000);
  // Session clocks update every minute
  setInterval(renderSessionClocks, 60000);

  // Floating AI trigger bubble
  if (els.floatingTriggerBubble) {
    els.floatingTriggerBubble.addEventListener("click", () => {
      switchTab("aiCoachPage");
    });
  }

  // Firebase Logs Panel
  if (els.refreshFirebaseLogsBtn) {
    els.refreshFirebaseLogsBtn.addEventListener("click", () => renderFirebaseLogs());
  }
  if (els.clearFirebaseLogsBtn) {
    els.clearFirebaseLogsBtn.addEventListener("click", () => {
      clearFirebaseLogs();
      renderFirebaseLogs();
    });
  }

  // Manual Sync Buttons
  if (els.pushToFirebaseBtn) {
    els.pushToFirebaseBtn.addEventListener("click", async () => {
      els.pushToFirebaseBtn.disabled = true;
      els.pushToFirebaseBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Pushing...';
      const result = await pushLocalToFirebase();
      if (result.ok) {
        showNotification(`Pushed ${result.count} items to Firebase successfully!`, "success");
      } else {
        showNotification(`Push completed with ${result.errors.length} errors. Check logs.`, "warning");
      }
      els.pushToFirebaseBtn.disabled = false;
      els.pushToFirebaseBtn.innerHTML = '<i class="fa fa-cloud-arrow-up"></i> Push Local → Firebase';
      renderFirebaseLogs();
    });
  }
  if (els.pullFromFirebaseBtn) {
    els.pullFromFirebaseBtn.addEventListener("click", async () => {
      els.pullFromFirebaseBtn.disabled = true;
      els.pullFromFirebaseBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Pulling...';
      const result = await pullFirebaseToLocal();
      if (result.ok) {
        showNotification(`Pulled and merged ${result.count} items from Firebase!`, "success");
        await loadInitialData();
      } else {
        showNotification(`Pull completed with ${result.errors.length} errors. Check logs.`, "warning");
      }
      els.pullFromFirebaseBtn.disabled = false;
      els.pullFromFirebaseBtn.innerHTML = '<i class="fa fa-cloud-arrow-down"></i> Pull Firebase → Local';
      renderFirebaseLogs();
    });
  }
}

// Convert uploaded screenshot to base64 URL
function handleScreenshotFile(file) {
  if (file.size > 2 * 1024 * 1024) {
    showNotification("Image exceeds 2MB limit.", "danger");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    els.screenshotPreview.src = e.target.result;
    els.screenshotPreviewWrapper.style.display = "block";
    els.dropZone.style.display = "none";
  };
  reader.readAsDataURL(file);
}

// Set up Mobile Sidebar Toggle
function setupMobileSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  if (sidebarToggle && sidebar && sidebarOverlay) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      sidebarOverlay.classList.toggle("active");
      document.body.style.overflow = sidebar.classList.contains("active") ? "hidden" : "";
    });

    sidebarOverlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      sidebarOverlay.classList.remove("active");
      document.body.style.overflow = "";
    });
  }
}

// Set up Mobile Filter Toggle
function setupMobileFilterToggle() {
  const filterToggle = document.getElementById("mobileFilterToggle");
  const filtersRow = document.querySelector(".header-filters-row");

  if (filterToggle && filtersRow) {
    filterToggle.addEventListener("click", () => {
      filtersRow.classList.toggle("active");
    });

    // Close filters when clicking outside
    document.addEventListener("click", (e) => {
      if (!filterToggle.contains(e.target) && !filtersRow.contains(e.target)) {
        filtersRow.classList.remove("active");
      }
    });
  }
}

// Set up App Tab Navigation
function setupNavigation() {
  document.querySelectorAll(".sidebar-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetPageId = item.getAttribute("data-target");
      switchTab(targetPageId);
    });
  });
}

function switchTab(pageId) {
  state.currentTab = pageId;

  // Close mobile sidebar if open
  const sidebar = document.querySelector(".sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("active");
  if (sidebarOverlay) sidebarOverlay.classList.remove("active");
  document.body.style.overflow = "";
  
  // Hide active page
  document.querySelectorAll(".page-container").forEach(page => {
    page.classList.remove("active");
  });
  
  // Show target page
  const targetPage = document.getElementById(pageId);
  if (targetPage) targetPage.classList.add("active");

  // Update sidebar active status
  document.querySelectorAll(".sidebar-item").forEach(item => {
    if (item.getAttribute("data-target") === pageId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update Header Title
  const menuLabels = {
    dashboardPage: "Dashboard",
    accountsPage: "Accounts & Balances",
    entryPage: "Journal Trade Entry",
    historyPage: "Trade History Log",
    analyticsPage: "Advanced Analytics Hub",
    aiCoachPage: "AI Trading Coach Hub",
    psychologyPage: "Psychology & Discipline Hub",
    notesPage: "Daily Journal Notes",
    calendarPage: "Trading Calendar",
    settingsPage: "Settings & Appearance"
  };
  els.headerTitle.innerText = menuLabels[pageId] || "Trading Operating System";

  // Re-trigger page renders if necessary
  if (pageId === "dashboardPage") {
    renderDashboardCharts();
    renderDashboardWidgets();
  } else if (pageId === "analyticsPage") {
    renderAnalyticsReports();
  } else if (pageId === "aiCoachPage") {
    renderAiCoachPage();
  } else if (pageId === "psychologyPage") {
    renderPsychologyPage();
  } else if (pageId === "calendarPage") {
    const today = new Date();
    const calCurrency = state.activeAccountId !== "all" ? getAccountCurrency(state.activeAccountId) : (state.accounts[0]?.currency || "USD");
    renderCalendar("calendarContainer", today.getFullYear(), today.getMonth(), state.allTrades, openCalendarDayTrades, calCurrency);
  } else if (pageId === "settingsPage") {
    renderDataDiagnostics();
    renderFirebaseLogs();
  }
}

// --- CORE APP DATA INITIALIZER ---
async function initAppUI() {
  els.appMain.style.display = "flex";
  
  // Display Username and Connection mode details
  const localName = localStorage.getItem("tj_user_name") || "Guest Trader";
  els.profileInputName.value = localName;

  if (state.user) {
    els.profileName.innerText = state.user.displayName || state.user.email.split("@")[0];
    els.profileEmail.innerText = state.user.email;
    els.avatarInitial.innerText = (state.user.displayName || state.user.email).charAt(0).toUpperCase();
    els.profileInputEmail.value = state.user.email;
    
    if (els.connectionModeText) {
      els.connectionModeText.innerText = "Firebase Cloud Sync Mode";
      els.connectionModeText.className = "font-semibold text-success";
    }
    if (els.firebaseConnectionBadge) {
      els.firebaseConnectionBadge.className = "badge badge-win";
      els.firebaseConnectionBadge.innerText = "Firebase Connected";
    }
    if (els.openAuthModalBtn) els.openAuthModalBtn.style.display = "none";
    if (els.syncFirebaseBtn) els.syncFirebaseBtn.style.display = "inline-block";
  } else {
    els.profileName.innerText = localName;
    els.profileEmail.innerText = "Local Sandbox Mode";
    els.avatarInitial.innerText = localName.charAt(0).toUpperCase();
    els.profileInputEmail.value = "local_sandbox@offline";
    
    if (els.connectionModeText) {
      els.connectionModeText.innerText = "LocalStorage Sandbox Mode";
      els.connectionModeText.className = "font-semibold text-warning";
    }
    if (els.firebaseConnectionBadge) {
      els.firebaseConnectionBadge.className = "badge badge-loss";
      els.firebaseConnectionBadge.innerText = "Firebase Offline";
    }
    if (els.openAuthModalBtn) els.openAuthModalBtn.style.display = "inline-block";
    if (els.syncFirebaseBtn) els.syncFirebaseBtn.style.display = "none";
  }

  // Load database items
  await loadInitialData();
  switchTab("dashboardPage");
  
  // Initialize theme
  initThemes();
}

async function loadInitialData() {
  state.accounts = await getAccounts();
  state.allTrades = await getTrades("all");
  state.notes = await getNotes();
  state.goals = await getGoals();
  state.checklist = await getChecklist();

  // Populate Dropdown Selectors
  populateSelectors();
  
  // Filter by currently selected account
  filterDataAndRefresh();
}

// --- THEME MANAGEMENT ---
const THEMES = {
  navy: { label: "TradingView Navy", cssVars: {} }, // uses :root defaults
  emerald: {
    label: "Emerald Forest",
    cssVars: {
      "--primary": "#10b981", "--primary-hover": "#059669", "--primary-glow": "rgba(16,185,129,0.15)",
      "--bg-dark": "#050f0a", "--bg-card": "#0a1a12", "--bg-card-hover": "#0f2519",
      "--card-border": "rgba(16,185,129,0.08)", "--card-border-hover": "rgba(16,185,129,0.25)",
      "--success": "#34d399", "--success-bg": "rgba(52,211,153,0.08)", "--success-border": "rgba(52,211,153,0.2)",
      "--danger": "#f87171", "--danger-bg": "rgba(248,113,113,0.08)", "--danger-border": "rgba(248,113,113,0.2)",
      "--warning": "#fbbf24", "--warning-bg": "rgba(251,191,36,0.08)", "--warning-border": "rgba(251,191,36,0.2)"
    }
  },
  cyberpunk: {
    label: "Cyberpunk Neon",
    cssVars: {
      "--primary": "#f59e0b", "--primary-hover": "#d97706", "--primary-glow": "rgba(245,158,11,0.15)",
      "--bg-dark": "#0a0800", "--bg-card": "#1a1408", "--bg-card-hover": "#251e0f",
      "--card-border": "rgba(245,158,11,0.08)", "--card-border-hover": "rgba(245,158,11,0.25)",
      "--success": "#34d399", "--success-bg": "rgba(52,211,153,0.08)", "--success-border": "rgba(52,211,153,0.2)",
      "--danger": "#f87171", "--danger-bg": "rgba(248,113,113,0.08)", "--danger-border": "rgba(248,113,113,0.2)",
      "--warning": "#fbbf24", "--warning-bg": "rgba(251,191,36,0.08)", "--warning-border": "rgba(251,191,36,0.2)"
    }
  },
  amethyst: {
    label: "Amethyst Void",
    cssVars: {
      "--primary": "#a855f7", "--primary-hover": "#9333ea", "--primary-glow": "rgba(168,85,247,0.15)",
      "--bg-dark": "#0a060f", "--bg-card": "#150d1e", "--bg-card-hover": "#1e1428",
      "--card-border": "rgba(168,85,247,0.08)", "--card-border-hover": "rgba(168,85,247,0.25)",
      "--success": "#34d399", "--success-bg": "rgba(52,211,153,0.08)", "--success-border": "rgba(52,211,153,0.2)",
      "--danger": "#f87171", "--danger-bg": "rgba(248,113,113,0.08)", "--danger-border": "rgba(248,113,113,0.2)",
      "--warning": "#fbbf24", "--warning-bg": "rgba(251,191,36,0.08)", "--warning-border": "rgba(251,191,36,0.2)"
    }
  }
};

function initThemes() {
  const saved = localStorage.getItem("tj_theme") || "navy";
  applyTheme(saved);

  const btnMap = {
    navy: document.getElementById("btnThemeNavy"),
    emerald: document.getElementById("btnThemeEmerald"),
    cyberpunk: document.getElementById("btnThemeCyberpunk"),
    amethyst: document.getElementById("btnThemeAmethyst")
  };

  Object.entries(btnMap).forEach(([key, btn]) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      localStorage.setItem("tj_theme", key);
      applyTheme(key);
      // Update active button
      Object.values(btnMap).forEach(b => b && b.classList.remove("active-theme"));
      btn.classList.add("active-theme");
    });
  });

  // Mark saved theme as active
  Object.values(btnMap).forEach(b => b && b.classList.remove("active-theme"));
  if (btnMap[saved]) btnMap[saved].classList.add("active-theme");
}

function applyTheme(themeKey) {
  const root = document.documentElement;
  // Reset to defaults first
  root.removeAttribute("data-theme");
  // Remove inline CSS vars
  root.style.cssText = "";

  if (themeKey && THEMES[themeKey] && Object.keys(THEMES[themeKey].cssVars).length > 0) {
    root.setAttribute("data-theme", themeKey);
    // Apply via CSS variables for full control
    Object.entries(THEMES[themeKey].cssVars).forEach(([prop, val]) => {
      root.style.setProperty(prop, val);
    });
  }
}

function populateSelectors() {
  // Clear selectors
  els.globalAccountSelector.innerHTML = '<option value="all">Combined (All Accounts)</option>';
  els.tradeAccount.innerHTML = '';
  els.txAccount.innerHTML = '';
  els.filterAccount.innerHTML = '<option value="all">All Accounts</option>';

  const activeAccounts = state.accounts.filter(a => !a.archived);

  activeAccounts.forEach(acc => {
    const opt = `<option value="${acc.id}">${acc.name} (${acc.currency || 'USD'})</option>`;
    els.globalAccountSelector.innerHTML += opt;
    els.tradeAccount.innerHTML += opt;
    els.txAccount.innerHTML += opt;
    els.filterAccount.innerHTML += opt;
  });

  // Restore selector state
  els.globalAccountSelector.value = state.activeAccountId;
}

function filterDataAndRefresh() {
  const accId = state.activeAccountId;
  const archivedIds = new Set(state.accounts.filter(a => a.archived).map(a => a.id));
  
  if (accId === "all") {
    state.trades = state.allTrades.filter(t => !archivedIds.has(t.accountId));
  } else {
    state.trades = state.allTrades.filter(t => t.accountId === accId);
  }

  // Apply date range filter
  if (state.dateFrom) {
    state.trades = state.trades.filter(t => t.date >= state.dateFrom);
  }
  if (state.dateTo) {
    state.trades = state.trades.filter(t => t.date <= state.dateTo);
  }

  // Refresh active pages visual
  renderDashboard();
  renderAccountsPage();
  renderHistoryPage();
  renderNotesTimeline();
  renderChecklistSection();
  renderGoalsSection();
  
  if (state.currentTab === "dashboardPage") {
    renderDashboardCharts();
    renderDashboardWidgets();
  } else if (state.currentTab === "analyticsPage") {
    renderAnalyticsReports();
  } else if (state.currentTab === "calendarPage") {
    const today = new Date();
    const calCurrency = state.activeAccountId !== "all" ? getAccountCurrency(state.activeAccountId) : (state.accounts[0]?.currency || "USD");
    renderCalendar("calendarContainer", today.getFullYear(), today.getMonth(), state.allTrades, openCalendarDayTrades, calCurrency);
  }
}

// --- RENDER PAGE: DASHBOARD ---
function renderDashboard() {
  // Calculate P&L Stats
  const activeAccId = state.activeAccountId;
  let startingBalance = 0;
  let transactionBalanceAdjustments = 0;
  let displayCurrency = "USD";

  if (activeAccId === "all") {
    state.accounts.forEach(a => {
      startingBalance += a.balance;
      if (a.transactions) {
        a.transactions.forEach(t => {
          if (t.type === "deposit") transactionBalanceAdjustments += t.amount;
          else transactionBalanceAdjustments -= t.amount;
        });
      }
    });
    // Use first account's currency or default
    if (state.accounts.length > 0) {
      displayCurrency = state.accounts[0].currency || "USD";
    }
  } else {
    const activeAcc = state.accounts.find(a => a.id === activeAccId);
    if (activeAcc) {
      startingBalance = activeAcc.balance;
      displayCurrency = activeAcc.currency || "USD";
      if (activeAcc.transactions) {
        activeAcc.transactions.forEach(t => {
          if (t.type === "deposit") transactionBalanceAdjustments += t.amount;
          else transactionBalanceAdjustments -= t.amount;
        });
      }
    }
  }

  const sym = getCurrencySymbol(displayCurrency);

  // Total Trades
  const totalTradesCount = state.trades.length;
  els.statTotalTrades.innerText = totalTradesCount;

  // P&L Sums
  let netPnL = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let bestPnL = 0;
  let bestTradeAsset = "-";
  let worstPnL = 0;
  let worstTradeAsset = "-";
  let grossProfit = 0;
  let grossLoss = 0;

  // Today P&L
  let todayPnL = 0;
  const todayStr = new Date().toISOString().split("T")[0];

  let totalRMultiple = 0;
  let tradesWithRMultipleCount = 0;

  state.trades.forEach(t => {
    netPnL += t.pnl;
    if (t.pnl > 0) grossProfit += t.pnl;
    else if (t.pnl < 0) grossLoss += Math.abs(t.pnl);

    if (t.result === "Win") wins++;
    else if (t.result === "Loss") losses++;
    else breakeven++;

    // Best/Worst
    if (t.pnl > bestPnL) {
      bestPnL = t.pnl;
      bestTradeAsset = t.asset;
    }
    if (t.pnl < worstPnL) {
      worstPnL = t.pnl;
      worstTradeAsset = t.asset;
    }

    // Today's
    if (t.date === todayStr) {
      todayPnL += t.pnl;
    }

    // RMultiple sum
    if (t.rMultiple) {
      totalRMultiple += t.rMultiple;
      tradesWithRMultipleCount++;
    }
  });

  // Calculate final growth and balance values
  const currentBalance = startingBalance + transactionBalanceAdjustments + netPnL;
  const growthPercent = startingBalance ? (netPnL / startingBalance) * 100 : 0;
  const winRate = totalTradesCount ? (wins / totalTradesCount) * 100 : 0;
  const avgRMultiple = tradesWithRMultipleCount ? totalRMultiple / tradesWithRMultipleCount : 0;

  // Bind values to DOM
  // Today P&L
  els.statTodayPnL.innerText = todayPnL >= 0 ? "+" + sym + todayPnL.toFixed(2) : "-" + sym + Math.abs(todayPnL).toFixed(2);
  els.statTodayPnL.className = todayPnL >= 0 ? "stat-value text-success" : "stat-value text-danger";
  const todayGrowthPct = currentBalance ? (todayPnL / currentBalance) * 100 : 0;
  els.statTodayTrend.innerHTML = todayPnL >= 0 
    ? `<i class="fa fa-caret-up"></i> +${todayGrowthPct.toFixed(2)}%` 
    : `<i class="fa fa-caret-down"></i> -${Math.abs(todayGrowthPct).toFixed(2)}%`;
  els.statTodayTrend.className = todayPnL >= 0 ? "stat-trend text-success" : "stat-trend text-danger";

  // Total P&L
  els.statTotalPnL.innerText = netPnL >= 0 ? "+" + sym + netPnL.toFixed(2) : "-" + sym + Math.abs(netPnL).toFixed(2);
  els.statTotalPnL.className = netPnL >= 0 ? "stat-value text-success" : "stat-value text-danger";
  els.statTotalTrend.innerHTML = netPnL >= 0 
    ? `<i class="fa fa-caret-up"></i> +${growthPercent.toFixed(1)}%` 
    : `<i class="fa fa-caret-down"></i> -${Math.abs(growthPercent).toFixed(1)}%`;
  els.statTotalTrend.className = netPnL >= 0 ? "stat-trend text-success" : "stat-trend text-danger";

  // Balance
  els.statBalance.innerText = sym + currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  els.statGrowthTrend.innerHTML = `<i class="fa fa-scale-balanced"></i> ${growthPercent >= 0 ? '+' : ''}${growthPercent.toFixed(1)}% net growth`;

  // Win Rate
  els.statWinRate.innerText = winRate.toFixed(1) + "%";
  els.statWinLossRatio.innerText = `Wins: ${wins} | Losses: ${losses}`;

  // Break-even and R stats
  els.statBreakEvenCount.innerText = `${breakeven} break-evens`;
  els.statRiskReward.innerText = `Avg R: ${avgRMultiple.toFixed(2)}R`;
  els.statAvgRMultiple.innerText = `From ${tradesWithRMultipleCount} rated trades`;

  // Best/Worst
  els.statBestTrade.innerText = "+" + sym + bestPnL.toFixed(2);
  els.statBestTradeAsset.innerText = bestPnL > 0 ? bestTradeAsset : "-";
  els.statWorstTrade.innerText = worstPnL < 0 ? "-" + sym + Math.abs(worstPnL).toFixed(2) : sym + "0.00";
  els.statWorstTradeAsset.innerText = worstPnL < 0 ? worstTradeAsset : "-";

  // --- CALC PREMIUM INSTITUTIONAL METRICS ---
  // 1. Profit Factor
  const profitFactor = grossLoss ? grossProfit / grossLoss : (grossProfit ? 99.9 : 0);
  els.statProfitFactor.innerText = profitFactor.toFixed(2);
  els.statProfitFactor.className = profitFactor >= 1.5 ? "stat-value text-success" : profitFactor >= 1.0 ? "stat-value text-warning" : "stat-value text-danger";

  // 2. Max Drawdown
  let tempBal = startingBalance + transactionBalanceAdjustments;
  let peakBal = tempBal;
  let maxDrawdown = 0;
  const chronoTrades = [...state.trades].sort((a, b) => new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00")));
  
  chronoTrades.forEach(t => {
    tempBal += t.pnl;
    if (tempBal > peakBal) peakBal = tempBal;
    const dd = peakBal - tempBal;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });
  els.statMaxDrawdown.innerText = `$${maxDrawdown.toFixed(2)}`;

  // 3. Current active streak
  let activeStreakType = "Wins";
  let activeStreakVal = 0;
  if (chronoTrades.length > 0) {
    const lastTrade = chronoTrades[chronoTrades.length - 1];
    if (lastTrade.pnl > 0) {
      activeStreakType = "Wins";
      for (let idx = chronoTrades.length - 1; idx >= 0; idx--) {
        if (chronoTrades[idx].pnl > 0) activeStreakVal++;
        else if (chronoTrades[idx].pnl < 0) break;
      }
    } else if (lastTrade.pnl < 0) {
      activeStreakType = "Losses";
      for (let idx = chronoTrades.length - 1; idx >= 0; idx--) {
        if (chronoTrades[idx].pnl < 0) activeStreakVal++;
        else if (chronoTrades[idx].pnl > 0) break;
      }
    }
  }
  els.statStreak.innerText = `${activeStreakVal} ${activeStreakType}`;
  els.statStreak.className = activeStreakType === "Wins" && activeStreakVal > 0 ? "stat-value text-success" : activeStreakVal > 0 ? "stat-value text-danger" : "stat-value text-muted";

  // 4. Return on Investment ROI
  const roi = startingBalance ? (netPnL / startingBalance) * 100 : 0;
  els.statRoi.innerText = `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`;
  els.statRoi.className = roi >= 0 ? "stat-value text-success" : "stat-value text-danger";

  // Render recent trades table (limit to 5)
  els.dashTradesTable.innerHTML = "";
  const recentTrades = [...state.trades].slice(0, 5);
  if (recentTrades.length === 0) {
    els.dashTradesTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No trades logged yet.</td></tr>`;
  } else {
    recentTrades.forEach(t => {
      let badgeClass = "badge-breakeven";
      if (t.result === "Win") badgeClass = "badge-win";
      else if (t.result === "Loss") badgeClass = "badge-loss";

      els.dashTradesTable.innerHTML += `
        <tr style="cursor:pointer;" onclick="openTradeDetails('${t.id}')">
          <td>${t.date}</td>
          <td><strong class="text-accent">${t.asset}</strong></td>
          <td><span class="${t.type === 'Buy' ? 'text-success' : 'text-danger'} font-semibold">${t.type.toUpperCase()}</span></td>
          <td><span class="badge ${badgeClass}">${t.result}</span></td>
          <td class="${t.pnl >= 0 ? 'text-success' : 'text-danger'} font-semibold">
            ${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)}
          </td>
        </tr>
      `;
    });
  }

  // Draw Heatmap Grid
  renderHeatmap();
}

// Render Dashboard Charts
function renderDashboardCharts() {
  const activeAccId = state.activeAccountId;
  let startBal = 10000;
  if (activeAccId !== "all") {
    const acc = state.accounts.find(a => a.id === activeAccId);
    if (acc) startBal = acc.balance;
  } else {
    startBal = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  }

  renderEquityCurve("dashEquityChart", state.trades, startBal);
  renderWinLossPie("dashWinLossChart", state.trades);
}

// Draw Dashboard performance Heatmap (grids of colored cells)
function renderHeatmap() {
  els.dashHeatmap.innerHTML = "";
  
  // Compute daily P&Ls for the last 49 days (7 weeks)
  const dailyPnLs = {};
  state.trades.forEach(t => {
    dailyPnLs[t.date] = (dailyPnLs[t.date] || 0) + t.pnl;
  });

  const cellsCount = 49;
  const today = new Date();
  
  // Fill cells from oldest to newest (49 days ago to today)
  for (let i = cellsCount - 1; i >= 0; i--) {
    const dateObj = new Date(today);
    dateObj.setDate(today.getDate() - i);
    const dateString = dateObj.toISOString().split("T")[0];
    const dayPnl = dailyPnLs[dateString] || 0;

    let cellColor = "rgba(255,255,255,0.02)"; // No trades
    if (dayPnl > 200) cellColor = "rgba(16, 185, 129, 0.9)"; // Strong Win
    else if (dayPnl > 50) cellColor = "rgba(16, 185, 129, 0.6)"; // Medium Win
    else if (dayPnl > 0.01) cellColor = "rgba(16, 185, 129, 0.3)"; // Small Win
    else if (dayPnl < -200) cellColor = "rgba(239, 68, 68, 0.9)"; // Strong Loss
    else if (dayPnl < -50) cellColor = "rgba(239, 68, 68, 0.6)"; // Medium Loss
    else if (dayPnl < -0.01) cellColor = "rgba(239, 68, 68, 0.3)"; // Small Loss

    els.dashHeatmap.innerHTML += `
      <div class="heatmap-cell" style="background-color: ${cellColor};" onclick="switchTab('calendarPage')">
        <div class="heatmap-tooltip">
          ${dateString}: ${dayPnl >= 0 ? '+' : '-'}$${Math.abs(dayPnl).toFixed(2)}
        </div>
      </div>
    `;
  }
}

// --- RENDER PAGE: ACCOUNTS ---
function renderAccountsPage() {
  const activeAccounts = state.accounts.filter(a => !a.archived);
  const archivedAccounts = state.accounts.filter(a => a.archived);

  // Active Accounts Grid
  els.accountsGrid.innerHTML = "";
  if (activeAccounts.length === 0) {
    els.accountsGrid.innerHTML = `<div class="col-span-2 text-center text-muted p-4">No active accounts. Create one or restore from archive.</div>`;
  }

  activeAccounts.forEach(acc => {
    const accTrades = state.allTrades.filter(t => t.accountId === acc.id);
    const tradesPnl = accTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    let netTx = 0;
    if (acc.transactions) {
      acc.transactions.forEach(t => {
        if (t.type === "deposit") netTx += t.amount;
        else netTx -= t.amount;
      });
    }

    const currentBal = acc.balance + netTx + tradesPnl;
    const growth = acc.balance ? (tradesPnl / acc.balance) * 100 : 0;
    const valClass = currentBal >= 0 ? "text-success" : "text-danger";
    const sym = getCurrencySymbol(acc.currency);

    els.accountsGrid.innerHTML += `
      <div class="card-premium">
        <div class="flex justify-between align-center mb-3">
          <div>
            <h4 class="text-lg font-bold">${acc.name}</h4>
            <span class="badge ${growth >= 0 ? 'badge-win' : 'badge-loss'}">${acc.type}</span>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-sm btn-icon btn-secondary" onclick="archiveAccountTrigger('${acc.id}', true)" title="Archive Account">
              <i class="fa fa-box-archive"></i>
            </button>
            <button class="btn btn-sm btn-icon btn-secondary text-danger" onclick="deleteAccountTrigger('${acc.id}')" title="Delete Account">
              <i class="fa fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="mb-4">
          <span class="text-xs text-muted">CURRENT BALANCE</span>
          <h2 class="text-xl font-extrabold ${valClass}">${sym}${currentBal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
          <span class="text-xs text-light">${growth >= 0 ? '+' : ''}${growth.toFixed(2)}% net performance</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openBalanceAdjustment('${acc.id}', 'deposit')">
            <i class="fa fa-plus"></i> Deposit
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openBalanceAdjustment('${acc.id}', 'withdrawal')">
            <i class="fa fa-minus"></i> Withdraw
          </button>
        </div>
      </div>
    `;
  });

  // Archived Accounts Section
  const archivedSection = document.getElementById("archivedAccountsSection");
  const archivedGrid = document.getElementById("archivedAccountsGrid");
  if (archivedSection && archivedGrid) {
    if (archivedAccounts.length > 0 && state.showArchived) {
      archivedSection.style.display = "block";
      archivedGrid.innerHTML = "";
      archivedAccounts.forEach(acc => {
        archivedGrid.innerHTML += `
          <div class="card-premium" style="opacity: 0.7;">
            <div class="flex justify-between align-center mb-2">
              <div>
                <h4 class="text-sm font-bold">${acc.name}</h4>
                <span class="badge badge-breakeven text-xs">${acc.type}</span>
                <span class="badge badge-loss text-xs ml-1">Archived</span>
              </div>
              <div class="flex gap-1">
                <button class="btn btn-sm btn-icon btn-secondary" onclick="archiveAccountTrigger('${acc.id}', false)" title="Restore">
                  <i class="fa fa-rotate-left"></i>
                </button>
                <button class="btn btn-sm btn-icon btn-secondary text-danger" onclick="deleteAccountTrigger('${acc.id}')" title="Delete">
                  <i class="fa fa-trash-can"></i>
                </button>
              </div>
            </div>
            <span class="text-xs text-muted">Balance: ${getCurrencySymbol(acc.currency)}${acc.balance.toLocaleString()}</span>
          </div>
        `;
      });
    } else {
      archivedSection.style.display = archivedAccounts.length > 0 ? "block" : "none";
      if (archivedAccounts.length > 0) {
        archivedGrid.innerHTML = `<span class="text-xs text-muted">${archivedAccounts.length} archived account(s). Click "Show Archived" to view.</span>`;
      }
    }
  }

  // Render transactions table
  els.transactionsTable.innerHTML = "";
  let transFound = false;
  state.accounts.forEach(acc => {
    if (acc.transactions) {
      acc.transactions.forEach(tx => {
        transFound = true;
        els.transactionsTable.innerHTML += `
          <tr>
            <td>${tx.date}</td>
            <td><strong>${acc.name}</strong></td>
            <td><span class="badge ${tx.type === 'deposit' ? 'badge-win' : 'badge-loss'}">${tx.type.toUpperCase()}</span></td>
            <td class="${tx.type === 'deposit' ? 'text-success' : 'text-danger'} font-bold">
              ${tx.type === 'deposit' ? '+' : '-'}$${tx.amount.toFixed(2)}
            </td>
            <td>${tx.note || '-'}</td>
          </tr>
        `;
      });
    }
  });

  if (!transFound) {
    els.transactionsTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No funding adjustments logged yet.</td></tr>`;
  }
}

window.deleteAccountTrigger = async function(accountId) {
  if (state.accounts.length <= 1) {
    showNotification("You must maintain at least one trading account.", "warning");
    return;
  }
  if (confirm("WARNING: Deleting this account will permanently delete all of its associated trades and funding transactions. Proceed?")) {
    await deleteAccount(accountId);
    showNotification("Account deleted successfully.", "warning");
    await loadInitialData();
  }
};

window.archiveAccountTrigger = async function(accountId, archived) {
  await archiveAccount(accountId, archived);
  showNotification(archived ? "Account archived. It won't appear in main views." : "Account restored to active.", "success");
  await loadInitialData();
};

window.toggleArchivedView = function() {
  state.showArchived = !state.showArchived;
  const btn = document.getElementById("toggleArchivedBtn");
  if (btn) {
    btn.innerHTML = state.showArchived
      ? '<i class="fa fa-eye-slash"></i> Hide Archived'
      : '<i class="fa fa-eye"></i> Show Archived';
  }
  renderAccountsPage();
};

window.openBalanceAdjustment = function(accountId, type) {
  els.txAccount.value = accountId;
  els.txType.value = type;
  els.txAmount.value = "";
  els.txNote.value = "";
  els.txAmount.focus();
};

// --- RENDER PAGE: HISTORY ---
function renderHistoryPage() {
  const searchVal = els.filterSearch.value.toLowerCase();
  const accVal = els.filterAccount.value;
  const resVal = els.filterResult.value;
  const stratVal = els.filterStrategy.value;
  const tfVal = els.filterTimeframe.value;

  // Extract Strategy lists for filter dropdown
  const strategies = new Set();
  state.allTrades.forEach(t => {
    if (t.strategy && t.strategy !== "None") strategies.add(t.strategy);
  });
  
  // Re-fill Strategy Dropdown Filter
  const currentFilterStrat = els.filterStrategy.value;
  els.filterStrategy.innerHTML = '<option value="all">All Strategies</option>';
  strategies.forEach(s => {
    els.filterStrategy.innerHTML += `<option value="${s}">${s}</option>`;
  });
  els.filterStrategy.value = currentFilterStrat;

  // Filter local trades list
  const filtered = state.allTrades.filter(t => {
    const matchesSearch = !searchVal || 
      t.asset.toLowerCase().includes(searchVal) || 
      (t.strategy && t.strategy.toLowerCase().includes(searchVal)) || 
      (t.setup && t.setup.toLowerCase().includes(searchVal)) || 
      (t.notes && t.notes.toLowerCase().includes(searchVal));
    const matchesAccount = accVal === "all" || t.accountId === accVal;
    const matchesResult = resVal === "all" || t.result === resVal;
    const matchesStrategy = stratVal === "all" || t.strategy === stratVal;
    const matchesTimeframe = tfVal === "all" || t.timeframe === tfVal;

    return matchesSearch && matchesAccount && matchesResult && matchesStrategy && matchesTimeframe;
  });

  // 1. Render Table View
  els.historyTable.innerHTML = "";
  if (filtered.length === 0) {
    els.historyTable.innerHTML = `<tr><td colspan="11" class="text-center text-muted">No trades match the selected filters.</td></tr>`;
  } else {
    filtered.forEach(t => {
      let badgeClass = "badge-breakeven";
      if (t.result === "Win") badgeClass = "badge-win";
      else if (t.result === "Loss") badgeClass = "badge-loss";

      const accountName = state.accounts.find(a => a.id === t.accountId)?.name || "Unknown";
      const tSym = getCurrencySymbol(getAccountCurrency(t.accountId));

      els.historyTable.innerHTML += `
        <tr>
          <td>${t.date} <span class="text-xs text-muted">${t.time || ''}</span></td>
          <td><span class="text-xs text-light font-semibold">${accountName}</span></td>
          <td><strong class="text-accent">${t.asset}</strong></td>
          <td><span class="${t.type === 'Buy' ? 'text-success' : 'text-danger'} font-bold text-xs">${t.type.toUpperCase()}</span></td>
          <td>${tSym}${t.entryPrice.toFixed(5).replace(/\.?0+$/, '')}</td>
          <td>${tSym}${t.exitPrice.toFixed(5).replace(/\.?0+$/, '')}</td>
          <td>${t.quantity.toLocaleString()}</td>
          <td><span class="badge ${badgeClass}">${t.result}</span></td>
          <td class="${t.pnl >= 0 ? 'text-success' : 'text-danger'} font-bold">
            ${t.pnl >= 0 ? '+' : '-'}${tSym}${Math.abs(t.pnl).toFixed(2)}
          </td>
          <td class="font-semibold text-accent">${t.rMultiple ? t.rMultiple.toFixed(2) + 'R' : '-'}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-icon btn-secondary" onclick="openTradeDetails('${t.id}')" title="Inspect"><i class="fa fa-eye"></i></button>
              <button class="btn btn-sm btn-icon btn-secondary" onclick="duplicateTradeTrigger('${t.id}')" title="Duplicate"><i class="fa fa-copy"></i></button>
              <button class="btn btn-sm btn-icon btn-secondary" onclick="loadTradeIntoForm('${t.id}')" title="Edit"><i class="fa fa-edit"></i></button>
              <button class="btn btn-sm btn-icon btn-secondary text-danger" onclick="deleteTradeTrigger('${t.id}')" title="Delete"><i class="fa fa-trash-can"></i></button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  // 2. Render Cards View
  els.historyCardView.innerHTML = "";
  if (filtered.length === 0) {
    els.historyCardView.innerHTML = `<div class="col-span-12 text-center text-muted p-4">No trades match current filters.</div>`;
  } else {
    filtered.forEach(t => {
      let badgeClass = "badge-breakeven";
      if (t.result === "Win") badgeClass = "badge-win";
      else if (t.result === "Loss") badgeClass = "badge-loss";

      const accountName = state.accounts.find(a => a.id === t.accountId)?.name || "Unknown";

      els.historyCardView.innerHTML += `
        <div class="trade-card">
          <div class="flex justify-between align-center">
            <div>
              <strong class="text-accent text-lg">${t.asset}</strong>
              <span class="text-xs text-muted ml-2">${t.date}</span>
            </div>
            <span class="badge ${badgeClass}">${t.result}</span>
          </div>

          <div class="grid-cols-2 text-xs py-2 border-bottom border-top" style="border-top:1px solid var(--card-border); border-bottom:1px solid var(--card-border);">
            <div><span class="text-muted">Account:</span> <span class="font-bold">${accountName}</span></div>
            <div><span class="text-muted">Direction:</span> <span class="font-bold ${t.type === 'Buy' ? 'text-success' : 'text-danger'}">${t.type.toUpperCase()}</span></div>
            <div><span class="text-muted">Entry:</span> <strong>$${t.entryPrice}</strong></div>
            <div><span class="text-muted">Exit:</span> <strong>$${t.exitPrice}</strong></div>
            <div><span class="text-muted">Strategy:</span> <span class="font-bold text-accent">${t.strategy}</span></div>
            <div><span class="text-muted">R Multiple:</span> <strong class="text-light">${t.rMultiple ? t.rMultiple.toFixed(2) + 'R' : '-'}</strong></div>
          </div>

          <div class="flex justify-between align-center mt-2">
            <span class="text-lg font-bold ${t.pnl >= 0 ? 'text-success' : 'text-danger'}">
              ${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)}
            </span>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-icon btn-secondary" onclick="openTradeDetails('${t.id}')" title="Details"><i class="fa fa-eye"></i></button>
              <button class="btn btn-sm btn-icon btn-secondary" onclick="loadTradeIntoForm('${t.id}')" title="Edit"><i class="fa fa-edit"></i></button>
            </div>
          </div>
        </div>
      `;
    });
  }
}

window.deleteTradeTrigger = async function(tradeId) {
  if (confirm("Are you sure you want to delete this trade?")) {
    await deleteTrade(tradeId);
    showNotification("Trade deleted successfully.", "warning");
    await loadInitialData();
  }
};

window.duplicateTradeTrigger = function(tradeId) {
  const trade = state.allTrades.find(t => t.id === tradeId);
  if (trade) {
    resetTradeForm();
    els.tradeAccount.value = trade.accountId;
    els.tradeAsset.value = trade.asset;
    setTradeType(trade.type);
    els.tradeEntryPrice.value = trade.entryPrice;
    els.tradeExitPrice.value = trade.exitPrice;
    els.tradeQuantity.value = trade.quantity;
    els.tradeCommission.value = trade.commission || 0;
    els.tradeStrategy.value = trade.strategy || "";
    els.tradeSetup.value = trade.setup || "";
    renderStrategies();
    renderSetups();
    els.tradeTimeframe.value = trade.timeframe;
    
    showNotification("Trade properties duplicated into entry form.", "info");
    switchTab("entryPage");
  }
};

// --- RENDER PAGE: DETAILS MODAL ---
window.openTradeDetails = function(tradeId) {
  const t = state.allTrades.find(tr => tr.id === tradeId);
  if (!t) return;

  const accountName = state.accounts.find(a => a.id === t.accountId)?.name || "Unknown";

  els.detailHeaderTitle.innerText = `Trade Details: ${t.asset} ${t.type.toUpperCase()}`;
  
  let badgeClass = "badge-breakeven";
  if (t.result === "Win") badgeClass = "badge-win";
  else if (t.result === "Loss") badgeClass = "badge-loss";
  
  els.detailResultBadge.className = `badge ${badgeClass}`;
  els.detailResultBadge.innerText = t.result;

  const dSym = getCurrencySymbol(getAccountCurrency(t.accountId));
  els.detailPnl.innerText = (t.pnl >= 0 ? '+' : '-') + dSym + Math.abs(t.pnl).toFixed(2);
  els.detailPnl.className = "text-lg font-bold " + (t.pnl >= 0 ? 'text-success' : 'text-danger');
  
  els.detailRMultiple.innerText = t.rMultiple ? (t.rMultiple >= 0 ? '+' : '-') + Math.abs(t.rMultiple).toFixed(2) + "R" : "-";
  
  els.detailAccount.innerText = accountName;
  els.detailDirection.innerText = t.type.toUpperCase();
  els.detailDirection.className = "font-semibold " + (t.type === "Buy" ? "text-success" : "text-danger");
  els.detailAsset.innerText = t.asset;
  els.detailQuantity.innerText = t.quantity.toLocaleString();
  els.detailEntryPrice.innerText = dSym + t.entryPrice;
  els.detailExitPrice.innerText = dSym + t.exitPrice;
  els.detailFees.innerText = `${dSym}${t.commission || '0'}`;

  els.detailStrategy.innerText = t.strategy || "None Tagged";
  els.detailSetup.innerText = t.setup || "None Specified";
  els.detailTimeframe.innerText = t.timeframe || "1H";
  els.detailEmotionBefore.innerText = t.emotionBefore || "Calm";
  els.detailEmotionAfter.innerText = t.emotionAfter || "Calm";
  els.detailRatings.innerText = `Confidence: ${t.confidence}/5 | Discipline: ${t.discipline}/5`;

  els.detailNotes.innerText = t.notes || "No narrative logged.";
  els.detailLessons.innerText = t.lessons || "No takeaways logged.";

  // Render mistakes tags
  els.detailMistakes.innerHTML = "";
  if (t.mistakes && t.mistakes.length > 0) {
    t.mistakes.forEach(m => {
      els.detailMistakes.innerHTML += `<span class="badge badge-loss text-xs mr-1">${m}</span>`;
    });
  } else {
    els.detailMistakes.innerHTML = `<span class="text-xs text-muted">No mistakes registered. Clean execution!</span>`;
  }

  // Display screenshot if present
  if (t.screenshotUrl) {
    els.detailScreenshotSection.style.display = "flex";
    els.detailScreenshotImg.src = t.screenshotUrl;
  } else {
    els.detailScreenshotSection.style.display = "none";
  }

  els.detailEditBtn.setAttribute("data-id", t.id);
  els.detailDeleteBtn.setAttribute("data-id", t.id);

  openModal("tradeDetailsModal");
};

window.loadTradeIntoForm = function(tradeId) {
  const trade = state.allTrades.find(t => t.id === tradeId);
  if (!trade) return;

  closeModal("tradeDetailsModal");
  resetTradeForm();

  els.tradeFormTitle.innerHTML = `<i class="fa-solid fa-edit"></i> Edit Trade: ${trade.asset}`;
  els.editTradeId.value = trade.id;
  els.tradeAccount.value = trade.accountId;
  els.tradeAsset.value = trade.asset;
  setTradeType(trade.type);
  els.tradeEntryPrice.value = trade.entryPrice;
  els.tradeExitPrice.value = trade.exitPrice;
  els.tradeQuantity.value = trade.quantity;
  els.tradeCommission.value = trade.commission || 0;
  els.tradeDate.value = trade.date;
  els.tradeStrategy.value = trade.strategy || "";
  els.tradeSetup.value = trade.setup || "";
  renderStrategies();
  renderSetups();
  els.tradeTimeframe.value = trade.timeframe;
  els.tradeEmotionBefore.value = trade.emotionBefore;
  els.tradeEmotionAfter.value = trade.emotionAfter;
  els.tradeConfidence.value = trade.confidence;
  els.tradeDiscipline.value = trade.discipline;
  els.tradeNotes.value = trade.notes;
  els.tradeLessons.value = trade.lessons;

  // Set mistakes checkboxes
  if (trade.mistakes) {
    trade.mistakes.forEach(m => {
      const cb = document.querySelector(`input[name='mistakesCheck'][value='${m}']`);
      if (cb) cb.checked = true;
    });
  }

  // Set screenshot preview if present
  if (trade.screenshotUrl) {
    els.screenshotPreview.src = trade.screenshotUrl;
    els.screenshotPreviewWrapper.style.display = "block";
    els.dropZone.style.display = "none";
  }

  els.saveTradeSubmitBtn.innerHTML = '<i class="fa fa-save"></i> Update Trade Entry';
  
  switchTab("entryPage");
  showNotification("Loaded trade details into editor form.", "info");
};

function resetTradeForm() {
  els.tradeFormTitle.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Journal New Trade`;
  els.editTradeId.value = "";
  els.tradeForm.reset();
  setTradeType("Buy");
  els.tradeDate.value = new Date().toISOString().split("T")[0];
  
  // Reset strategy & setup
  els.tradeStrategy.value = "";
  els.tradeSetup.value = "";
  renderStrategies();
  renderSetups();
  
  // Reset screenshot
  els.screenshotPreview.src = "";
  els.screenshotPreviewWrapper.style.display = "none";
  els.dropZone.style.display = "block";
  els.tradeScreenshot.value = "";

  // Reset checkboxes
  document.querySelectorAll("input[name='mistakesCheck']:checked").forEach(cb => {
    cb.checked = false;
  });

  els.saveTradeSubmitBtn.innerHTML = '<i class="fa fa-save"></i> Save Trade Entry';
}

// --- RENDER PAGE: ADVANCED ANALYTICS REPORTS ---
function renderAnalyticsReports() {
  const activeAccId = state.activeAccountId;
  
  // Calculate Reports parameters
  let grossProfit = 0;
  let grossLoss = 0;
  let winsCount = 0;
  let lossesCount = 0;
  let maxDrawdown = 0;
  
  let winStreak = 0;
  let lossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  // Best/Worst Days grouping
  const dailyPnLs = {};
  
  // Sort trades chronologically to calculate equity path + streaks
  const chronoTrades = [...state.trades].sort((a, b) => new Date(a.date + "T" + (a.time || "00:00")) - new Date(b.date + "T" + (b.time || "00:00")));

  let startBal = 10000;
  if (activeAccId !== "all") {
    const acc = state.accounts.find(a => a.id === activeAccId);
    if (acc) startBal = acc.balance;
  } else {
    startBal = state.accounts.reduce((sum, a) => sum + a.balance, 0);
  }

  // Drawdown tracker variables
  let currentBalance = startBal;
  let peakBalance = startBal;

  chronoTrades.forEach(t => {
    // 1. Gross metrics
    if (t.pnl > 0) {
      grossProfit += t.pnl;
      winsCount++;
      tempWinStreak++;
      if (tempLossStreak > lossStreak) lossStreak = tempLossStreak;
      tempLossStreak = 0;
    } else if (t.pnl < 0) {
      grossLoss += Math.abs(t.pnl);
      lossesCount++;
      tempLossStreak++;
      if (tempWinStreak > winStreak) winStreak = tempWinStreak;
      tempWinStreak = 0;
    } else {
      // Break-even reset streaks
      if (tempWinStreak > winStreak) winStreak = tempWinStreak;
      if (tempLossStreak > lossStreak) lossStreak = tempLossStreak;
      tempWinStreak = 0;
      tempLossStreak = 0;
    }

    // 2. Max Drawdown
    currentBalance += t.pnl;
    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    } else {
      const dd = peakBalance - currentBalance;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // 3. Days grouping
    dailyPnLs[t.date] = (dailyPnLs[t.date] || 0) + t.pnl;
  });

  // Handle final streak wrap-up
  if (tempWinStreak > winStreak) winStreak = tempWinStreak;
  if (tempLossStreak > lossStreak) lossStreak = tempLossStreak;

  // Profit factor
  const profitFactor = grossLoss ? grossProfit / grossLoss : (grossProfit ? 99.9 : 0);
  els.reportProfitFactor.innerText = profitFactor.toFixed(2);
  
  // Avg Wins / Losses
  const avgWin = winsCount ? grossProfit / winsCount : 0;
  const avgLoss = lossesCount ? grossLoss / lossesCount : 0;
  const winLossRatio = avgLoss ? avgWin / avgLoss : 0;

  els.reportAvgWinLoss.innerText = `+$${avgWin.toFixed(2)} / -$${avgLoss.toFixed(2)}`;
  els.reportAvgWinLossRatio.innerText = `Win/Loss Ratio: ${winLossRatio.toFixed(2)}`;

  // Streaks & Drawdown
  els.reportStreaks.innerText = `Wins: ${winStreak} | Losses: ${lossStreak}`;
  els.reportMaxDrawdown.innerText = `$${maxDrawdown.toFixed(2)}`;

  // Best/Worst Day
  let bestDayKey = "-";
  let bestDayVal = 0;
  let worstDayKey = "-";
  let worstDayVal = 0;

  Object.keys(dailyPnLs).forEach(d => {
    const val = dailyPnLs[d];
    if (val > bestDayVal) {
      bestDayVal = val;
      bestDayKey = d;
    }
    if (val < worstDayVal) {
      worstDayVal = val;
      worstDayKey = d;
    }
  });

  els.reportBestDay.innerText = bestDayKey;
  els.reportBestDayAmount.innerText = `+$${bestDayVal.toFixed(2)}`;
  els.reportWorstDay.innerText = worstDayKey;
  els.reportWorstDayAmount.innerText = `-$${Math.abs(worstDayVal).toFixed(2)}`;

  // Strategy profitable breakdown
  const stratPerformance = {};
  state.trades.forEach(t => {
    const s = t.strategy || "No Strategy";
    stratPerformance[s] = (stratPerformance[s] || 0) + t.pnl;
  });

  let bestStrat = "-";
  let bestStratPnl = 0;
  Object.keys(stratPerformance).forEach(s => {
    if (stratPerformance[s] > bestStratPnl) {
      bestStratPnl = stratPerformance[s];
      bestStrat = s;
    }
  });

  els.reportBestStrategy.innerText = bestStrat;
  els.reportBestStrategyAmount.innerText = `+$${bestStratPnl.toFixed(2)} total`;

  // Draw Analytics Hub charts using correct canvas IDs from HTML
  drawMonteCarloSimulation("chartMonteCarlo", state.trades, startBal);
  renderPortfolioAllocation("chartPortfolioAllocation", state.accounts);
  renderDrawdownCurve("chartDrawdownCurve", state.trades, startBal);
  renderHourlyPnL("chartHourlyPnL", state.trades);
  renderDayOfWeekPnL("chartDayOfWeekPnL", state.trades);
}

// --- RENDER PAGE: CHECKLISTS & GOALS ---
function renderChecklistSection() {
  // Renders the checklists on Dashboard and Entry form pages
  const items = state.checklist;
  
  const drawHtml = (container) => {
    container.innerHTML = "";
    if (items.length === 0) {
      container.innerHTML = `<span class="text-xs text-muted">No checklist tasks loaded.</span>`;
      return;
    }

    items.forEach(item => {
      container.innerHTML += `
        <div class="checklist-item ${item.completed ? 'completed' : ''}">
          <input type="checkbox" class="checklist-checkbox" ${item.completed ? 'checked' : ''} onclick="toggleChecklistItem('${item.id}')">
          <span class="checklist-text" onclick="toggleChecklistItem('${item.id}')">${item.task}</span>
        </div>
      `;
    });
  };

  if (els.dashChecklist) drawHtml(els.dashChecklist);
  if (els.entryChecklist) drawHtml(els.entryChecklist);
}

window.toggleChecklistItem = async function(itemId) {
  const index = state.checklist.findIndex(i => i.id === itemId);
  if (index >= 0) {
    state.checklist[index].completed = !state.checklist[index].completed;
    await saveChecklist(state.checklist);
    renderChecklistSection();
  }
};

function renderGoalsSection() {
  els.dashGoals.innerHTML = "";
  if (state.goals.length === 0) {
    els.dashGoals.innerHTML = `<span class="text-xs text-muted">No trading goals set.</span>`;
    return;
  }

  // Calculate current parameters for dynamic tracking
  const wins = state.trades.filter(t => t.result === "Win").length;
  const losses = state.trades.filter(t => t.result === "Loss").length;
  const total = wins + losses;
  
  const winRateVal = total ? (wins / total) * 100 : 0;
  
  let grossProfit = 0;
  let grossLoss = 0;
  state.trades.forEach(t => {
    if (t.pnl > 0) grossProfit += t.pnl;
    else grossLoss += Math.abs(t.pnl);
  });
  const profitFactorVal = grossLoss ? grossProfit / grossLoss : (grossProfit ? 99.9 : 0);

  // Bind dynamic parameter values to goals list
  state.goals.forEach(async (goal) => {
    let currentVal = 0;
    
    if (goal.id === "g1") {
      currentVal = winRateVal;
      goal.current = parseFloat(winRateVal.toFixed(1));
    } else if (goal.id === "g2") {
      currentVal = profitFactorVal;
      goal.current = parseFloat(profitFactorVal.toFixed(2));
    } else if (goal.id === "g3") {
      currentVal = state.trades.filter(t => t.discipline >= 4).length;
      goal.current = currentVal;
    }

    const pct = Math.min((goal.current / goal.target) * 100, 100);
    const completed = goal.current >= goal.target;
    
    if (completed !== goal.completed) {
      goal.completed = completed;
      await saveGoal(goal);
    }

    els.dashGoals.innerHTML += `
      <div class="flex flex-col text-xs mt-1">
        <div class="flex justify-between font-semibold">
          <span>${goal.title}</span>
          <span class="${completed ? 'text-success' : 'text-accent'}">${goal.current}/${goal.target}</span>
        </div>
        <div style="background: rgba(255,255,255,0.05); height: 4px; border-radius:2px; margin-top:2px;">
          <div style="background: ${completed ? 'var(--success)' : 'var(--primary)'}; height: 100%; width: ${pct}%; border-radius:2px;"></div>
        </div>
      </div>
    `;
  });
}

// --- RENDER PAGE: DAILY NOTES & TIMELINE ---
function renderNotesTimeline() {
  const searchVal = els.searchNotes.value.toLowerCase();
  const catVal = els.filterNotesCategory.value;

  const filtered = state.notes.filter(n => {
    const matchesSearch = !searchVal || 
      n.title.toLowerCase().includes(searchVal) || 
      n.content.toLowerCase().includes(searchVal) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(searchVal)));
    const matchesCategory = catVal === "all" || n.category === catVal;

    return matchesSearch && matchesCategory;
  });

  els.notesTimeline.innerHTML = "";
  if (filtered.length === 0) {
    els.notesTimeline.innerHTML = `<span class="text-sm text-muted text-center p-4">No daily logs found. Write your first log today!</span>`;
  } else {
    filtered.forEach(note => {
      let tagsHtml = "";
      if (note.tags) {
        note.tags.forEach(t => {
          tagsHtml += `<span class="text-xs px-2 py-0.5 rounded bg-primary-glow text-accent mr-1 border border-card-border">#${t}</span>`;
        });
      }

      els.notesTimeline.innerHTML += `
        <div class="card-premium">
          <div class="flex justify-between align-center mb-2">
            <div>
              <span class="text-xs text-muted">${note.date}</span>
              <h4 class="text-base font-bold">${note.title}</h4>
              <span class="badge badge-breakeven text-xs mt-1">${note.category}</span>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-sm btn-icon btn-secondary" onclick="loadNoteIntoForm('${note.id}')" title="Edit"><i class="fa fa-pencil"></i></button>
              <button class="btn btn-sm btn-icon btn-secondary text-danger" onclick="deleteNoteTrigger('${note.id}')" title="Delete"><i class="fa fa-trash-can"></i></button>
            </div>
          </div>
          <p class="text-sm text-light mb-3" style="white-space: pre-line;">${note.content}</p>
          <div class="flex align-center flex-wrap gap-2">
            ${tagsHtml}
          </div>
        </div>
      `;
    });
  }
}

window.loadNoteIntoForm = function(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;

  els.noteFormTitle.innerHTML = `<i class="fa fa-pencil"></i> Edit Journal Note`;
  els.editNoteId.value = note.id;
  els.noteDate.value = note.date;
  els.noteTitle.value = note.title;
  els.noteCategory.value = note.category;
  els.noteContent.value = note.content;
  els.noteTags.value = note.tags ? note.tags.join(", ") : "";

  els.noteForm.querySelector("button[type='submit']").innerHTML = '<i class="fa fa-save"></i> Update Journal Note';
  showNotification("Loaded note details into editor.", "info");
};

window.deleteNoteTrigger = async function(noteId) {
  if (confirm("Are you sure you want to delete this journal note?")) {
    await deleteNote(noteId);
    showNotification("Journal note deleted.", "warning");
    await loadInitialData();
  }
};

function resetNoteForm() {
  els.noteFormTitle.innerHTML = `<i class="fa-solid fa-pen-nib"></i> Daily Journal Entry`;
  els.editNoteId.value = "";
  els.noteForm.reset();
  els.noteDate.value = new Date().toISOString().split("T")[0];
  els.noteForm.querySelector("button[type='submit']").innerHTML = '<i class="fa fa-save"></i> Save Journal Entry';
}

// --- RENDER PAGE: CALENDAR INTERACTIVE MODAL ACTIONS ---
function openCalendarDayTrades(dateStr, dayTrades) {
  els.calendarDayModalTitle.innerText = `Trades executed on: ${dateStr}`;
  
  els.calendarDayTable.innerHTML = "";
  if (dayTrades.length === 0) {
    els.calendarDayTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No trades recorded on this day.</td></tr>`;
  } else {
    dayTrades.forEach(t => {
      let badgeClass = "badge-breakeven";
      if (t.result === "Win") badgeClass = "badge-win";
      else if (t.result === "Loss") badgeClass = "badge-loss";

      els.calendarDayTable.innerHTML += `
        <tr>
          <td><strong class="text-accent">${t.asset}</strong></td>
          <td><span class="${t.type === 'Buy' ? 'text-success' : 'text-danger'} font-semibold">${t.type.toUpperCase()}</span></td>
          <td><span class="badge ${badgeClass}">${t.result}</span></td>
          <td class="${t.pnl >= 0 ? 'text-success' : 'text-danger'} font-bold">
            ${t.pnl >= 0 ? '+' : '-'}$${Math.abs(t.pnl).toFixed(2)}
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="closeModal('calendarDayModal'); openTradeDetails('${t.id}')">Inspect</button>
          </td>
        </tr>
      `;
    });
  }

  openModal("calendarDayModal");
}

// --- EXPORT TO CSV ENGINE ---
function exportTradesCsv() {
  if (state.trades.length === 0) {
    showNotification("No trades to export.", "warning");
    return;
  }

  const csvRows = [
    ["Date", "Time", "Asset", "Type", "Entry Price", "Exit Price", "Quantity", "Stop Loss", "Take Profit", "Commission", "Swap", "PnL", "R-Multiple", "Result", "Strategy", "Setup", "Market Condition", "Timeframe", "Emotion Before", "Emotion After", "Confidence", "Discipline", "Notes", "Lessons", "Mistakes"]
  ];

  state.trades.forEach(t => {
    csvRows.push([
      t.date,
      t.time || "",
      t.asset,
      t.type,
      t.entryPrice,
      t.exitPrice,
      t.quantity,
      t.stopLoss || "",
      t.takeProfit || "",
      t.commission || 0,
      t.swap || 0,
      t.pnl,
      t.rMultiple || "",
      t.result,
      t.strategy || "",
      t.setup || "",
      t.marketCondition || "",
      t.timeframe || "",
      t.emotionBefore || "",
      t.emotionAfter || "",
      t.confidence || "",
      t.discipline || "",
      `"${(t.notes || "").replace(/"/g, '""')}"`,
      `"${(t.lessons || "").replace(/"/g, '""')}"`,
      `"${(t.mistakes || []).join(',')}"`
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `trading_journal_export_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification("CSV export download started.", "success");
}

// --- RENDER DASHBOARD WIDGETS (Economic Calendar & Session Clocks) ---
function renderDashboardWidgets() {
  renderEconomicCalendar();
  renderSessionClocks();
  updateLiveClock();
}

async function renderEconomicCalendar() {
  if (!els.econCalendarList) return;
  
  // Try fetching live data from free ForexFactory mirror
  let events = [];
  try {
    const resp = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
    if (resp.ok) {
      const allEvents = await resp.json();
      // Filter only high/medium impact events from today and next 3 days
      const now = new Date();
      const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      events = allEvents
        .filter(e => {
          const d = new Date(e.date * 1000);
          return d >= now && d <= cutoff && (e.impact === "High" || e.impact === "Medium");
        })
        .slice(0, 8)
        .map(e => ({
          time: new Date(e.date * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          currency: e.currency || "USD",
          impact: e.impact.toLowerCase(),
          event: e.title
        }));
    }
  } catch (err) {
    // API failed, use fallback static data
  }

  // Fallback static data if API fails or returns empty
  if (events.length === 0) {
    events = [
      { time: "08:30", currency: "USD", impact: "high", event: "CPI (Consumer Price Index)" },
      { time: "10:00", currency: "USD", impact: "medium", event: "CB Consumer Confidence" },
      { time: "13:15", currency: "USD", impact: "high", event: "FOMC Interest Rate Decision" },
      { time: "14:30", currency: "USD", impact: "medium", event: "Unemployment Claims" },
      { time: "04:30", currency: "GBP", impact: "high", event: "GDP Quarter-over-Quarter" },
      { time: "07:45", currency: "EUR", impact: "medium", event: "ECB Press Conference" },
      { time: "19:50", currency: "JPY", impact: "medium", event: "BOJ Policy Rate" },
      { time: "21:30", currency: "AUD", impact: "low", event: "Employment Change" }
    ];
    // Mark badge as fallback
    const badge = document.getElementById("econCalendarBadge");
    if (badge) badge.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 6px; margin-right: 4px;"></i> SAMPLE DATA';
  } else {
    const badge = document.getElementById("econCalendarBadge");
    if (badge) badge.innerHTML = '<i class="fa-solid fa-circle" style="font-size: 6px; margin-right: 4px;"></i> LIVE';
  }

  els.econCalendarList.innerHTML = "";
  events.forEach(ev => {
    let impactColor = "var(--success)";
    let impactBg = "rgba(16,185,129,0.1)";
    if (ev.impact === "high") { impactColor = "var(--danger)"; impactBg = "rgba(239,68,68,0.1)"; }
    else if (ev.impact === "medium") { impactColor = "var(--warning)"; impactBg = "rgba(245,158,11,0.1)"; }

    els.econCalendarList.innerHTML += `
      <div class="flex align-center gap-3 p-3 rounded-xl" style="background: ${impactBg}; border-left: 3px solid ${impactColor}; border: 1px solid ${impactColor}22;">
        <div class="flex flex-col" style="min-width: 60px;">
          <span class="text-xs font-bold" style="color: ${impactColor};">${ev.time}</span>
          <span class="text-xs text-muted">${ev.currency}</span>
        </div>
        <div class="flex flex-col" style="flex:1;">
          <span class="text-sm font-semibold text-light">${ev.event}</span>
          <span class="text-xs text-muted">${ev.impact.charAt(0).toUpperCase() + ev.impact.slice(1)} Impact</span>
        </div>
        <span class="badge" style="background: ${impactBg}; color: ${impactColor}; border: 1px solid ${impactColor}33; font-size: 0.65rem;">${ev.impact.toUpperCase()}</span>
      </div>
    `;
  });
}

function renderSessionClocks() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcTotalMin = utcHour * 60 + utcMin;

  const sessions = [
    { id: "badgeSydney", cardId: "clockSydney", start: 22*60, end: 7*60, name: "Sydney" },
    { id: "badgeTokyo", cardId: "clockTokyo", start: 0, end: 9*60, name: "Tokyo" },
    { id: "badgeLondon", cardId: "clockLondon", start: 8*60, end: 17*60, name: "London" },
    { id: "badgeNewYork", cardId: "clockNewYork", start: 13*60, end: 22*60, name: "New York" }
  ];

  let activeSessions = 0;
  sessions.forEach(s => {
    const badge = document.getElementById(s.id);
    const card = document.getElementById(s.cardId);
    if (!badge) return;
    let isOpen = false;
    if (s.start < s.end) {
      isOpen = utcTotalMin >= s.start && utcTotalMin < s.end;
    } else {
      isOpen = utcTotalMin >= s.start || utcTotalMin < s.end;
    }
    if (isOpen) {
      activeSessions++;
      badge.innerText = "OPEN";
      badge.style.background = "rgba(16,185,129,0.15)";
      badge.style.color = "var(--success)";
      badge.style.fontWeight = "700";
      if (card) card.classList.add("session-open");
    } else {
      badge.innerText = "Closed";
      badge.style.background = "rgba(255,255,255,0.05)";
      badge.style.color = "var(--text-muted)";
      badge.style.fontWeight = "500";
      if (card) card.classList.remove("session-open");
    }
  });

  const clockStatus = document.getElementById("forexClockStatus");
  if (clockStatus) {
    clockStatus.innerText = activeSessions > 0 ? `${activeSessions} Session${activeSessions > 1 ? 's' : ''} Active` : "All Sessions Closed";
    clockStatus.className = activeSessions > 0 ? "text-xs font-semibold text-success" : "text-xs text-muted";
  }
}

function updateLiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: true });
  if (els.headerLiveTime) els.headerLiveTime.innerText = timeStr;
}

// --- DATA DIAGNOSTICS PANEL ---
function renderDataDiagnostics() {
  if (!els.dataDiagnosticsPanel) return;

  const localAccounts = JSON.parse(localStorage.getItem("tj_accounts") || "[]");
  const localTrades = JSON.parse(localStorage.getItem("tj_trades") || "[]");
  const localNotes = JSON.parse(localStorage.getItem("tj_notes") || "[]");

  const mode = state.isLocalMode ? "LocalStorage" : (state.user ? "Firebase Cloud" : "Unknown");
  const modeColor = state.isLocalMode ? "text-warning" : (state.user ? "text-success" : "text-danger");
  const userEmail = state.user ? state.user.email : "Not logged in";

  let html = `
    <div class="flex justify-between align-center p-3 rounded-xl" style="background: rgba(255,255,255,0.02); border: 1px solid var(--card-border);">
      <div class="flex flex-col">
        <span class="text-xs text-muted">Active Mode</span>
        <span class="font-bold ${modeColor}">${mode}</span>
      </div>
      <div class="flex flex-col" style="text-align: right;">
        <span class="text-xs text-muted">User</span>
        <span class="font-semibold text-light">${userEmail}</span>
      </div>
    </div>
    <div class="text-xs font-bold text-muted mt-2 mb-1">LOCAL BROWSER CACHE:</div>
    <div class="grid-cols-3 gap-2">
      <div class="p-2 rounded text-center" style="background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.1);">
        <div class="font-bold text-accent">${localTrades.length}</div>
        <div class="text-xs text-muted">Trades</div>
      </div>
      <div class="p-2 rounded text-center" style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.1);">
        <div class="font-bold text-success">${localAccounts.length}</div>
        <div class="text-xs text-muted">Accounts</div>
      </div>
      <div class="p-2 rounded text-center" style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.1);">
        <div class="font-bold text-warning">${localNotes.length}</div>
        <div class="text-xs text-muted">Notes</div>
      </div>
    </div>
    <div class="text-xs font-bold text-muted mt-3 mb-1">FIREBASE CLOUD:</div>
    <div class="grid-cols-3 gap-2">
      <div class="p-2 rounded text-center" style="background: rgba(99,102,241,0.05); border: 1px solid rgba(99,102,241,0.1);">
        <div class="font-bold text-accent">${state.allTrades.length}</div>
        <div class="text-xs text-muted">Trades</div>
      </div>
      <div class="p-2 rounded text-center" style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.1);">
        <div class="font-bold text-success">${state.accounts.length}</div>
        <div class="text-xs text-muted">Accounts</div>
      </div>
      <div class="p-2 rounded text-center" style="background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.1);">
        <div class="font-bold text-warning">${state.notes.length}</div>
        <div class="text-xs text-muted">Notes</div>
      </div>
    </div>
  `;

  // Show data status
  const localTotal = localTrades.length + localAccounts.length + localNotes.length;
  const cloudTotal = state.allTrades.length + state.accounts.length + state.notes.length;
  if (localTotal > 0 && cloudTotal === 0 && !state.isLocalMode) {
    html += `
      <div class="p-3 rounded-xl mt-3" style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);">
        <span class="font-semibold text-danger text-sm"><i class="fa fa-triangle-exclamation"></i> Data mismatch: Local has ${localTotal} items, Firebase is empty. Use "Push Local → Firebase" to sync.</span>
      </div>
    `;
  } else if (localTotal > 0 && cloudTotal > 0) {
    html += `
      <div class="p-3 rounded-xl mt-3" style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);">
        <span class="font-semibold text-success text-sm"><i class="fa fa-circle-check"></i> Data synced: ${cloudTotal} items in Firebase, ${localTotal} in local cache.</span>
      </div>
    `;
  }

  els.dataDiagnosticsPanel.innerHTML = html;
}

function renderFirebaseLogs() {
  if (!els.firebaseLogsPanel) return;
  const logs = getFirebaseLogs();
  if (logs.length === 0) {
    els.firebaseLogsPanel.innerHTML = `<div class="text-xs text-muted p-2">No Firebase operations logged yet. Data is being saved dual-write (Firebase + Local).</div>`;
    return;
  }
  els.firebaseLogsPanel.innerHTML = "";
  let hasPermissionError = false;
  logs.forEach(log => {
    const statusColor = log.status === "ok" ? "text-success" : "text-danger";
    const statusIcon = log.status === "ok" ? "fa-check-circle" : "fa-xmark-circle";
    if (log.detail && log.detail.toLowerCase().includes("permission")) {
      hasPermissionError = true;
    }
    els.firebaseLogsPanel.innerHTML += `
      <div class="flex align-center gap-2 p-1" style="border-bottom: 1px solid var(--card-border);">
        <span class="text-muted" style="min-width: 65px;">${log.time}</span>
        <i class="fa ${statusIcon} ${statusColor}" style="font-size: 10px;"></i>
        <span class="font-semibold text-light">${log.action}</span>
        <span class="text-muted text-xs" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.detail}</span>
      </div>
    `;
  });
  // Show Firestore rules fix panel if permission errors detected
  const rulesFixPanel = document.getElementById("firestoreRulesFix");
  if (rulesFixPanel) {
    rulesFixPanel.style.display = hasPermissionError ? "block" : "none";
  }
}

// --- RENDER PAGE: AI COACH HUB ---
function renderAiCoachPage() {
  if (!els.aiInsightsPanel) return;

  const trades = state.trades;
  const totalTrades = trades.length;
  let html = "";

  if (totalTrades < 3) {
    html = `<div class="text-xs text-muted py-2">Need at least 3 trades for behavioral analysis. Currently tracking ${totalTrades} trade${totalTrades !== 1 ? 's' : ''}.</div>`;
  } else {
    // Win rate analysis
    const wins = trades.filter(t => t.result === "Win").length;
    const winRate = ((wins / totalTrades) * 100).toFixed(1);
    html += `<div class="flex justify-between text-sm p-2 rounded" style="background: rgba(16,185,129,0.05);"><span class="text-muted">Win Rate</span><span class="font-bold text-success">${winRate}%</span></div>`;

    // Discipline analysis
    const avgDiscipline = trades.reduce((sum, t) => sum + (t.discipline || 3), 0) / totalTrades;
    let discLabel = avgDiscipline >= 4 ? "Excellent" : avgDiscipline >= 3 ? "Good" : avgDiscipline >= 2 ? "Needs Work" : "Critical";
    let discColor = avgDiscipline >= 4 ? "text-success" : avgDiscipline >= 3 ? "text-accent" : avgDiscipline >= 2 ? "text-warning" : "text-danger";
    html += `<div class="flex justify-between text-sm p-2 rounded" style="background: rgba(99,102,241,0.05);"><span class="text-muted">Avg Discipline</span><span class="font-bold ${discColor}">${avgDiscipline.toFixed(1)}/5 (${discLabel})</span></div>`;

    // Revenge trading detection
    let consecLosses = 0;
    let revengeTrades = 0;
    trades.forEach(t => {
      if (t.result === "Loss") {
        consecLosses++;
        if (consecLosses >= 3) revengeTrades++;
      } else {
        consecLosses = 0;
      }
    });
    if (revengeTrades > 0) {
      html += `<div class="flex justify-between text-sm p-2 rounded" style="background: rgba(239,68,68,0.05);"><span class="text-muted">Revenge Trade Signals</span><span class="font-bold text-danger">${revengeTrades} detected</span></div>`;
    }

    // Best strategy
    const stratPerf = {};
    trades.forEach(t => {
      const s = t.strategy || "None";
      if (!stratPerf[s]) stratPerf[s] = { pnl: 0, count: 0, wins: 0 };
      stratPerf[s].pnl += t.pnl;
      stratPerf[s].count++;
      if (t.result === "Win") stratPerf[s].wins++;
    });
    let bestStrat = "-", bestPnl = -Infinity;
    Object.keys(stratPerf).forEach(s => {
      if (stratPerf[s].pnl > bestPnl) { bestPnl = stratPerf[s].pnl; bestStrat = s; }
    });
    if (bestStrat !== "-") {
      const sWinRate = ((stratPerf[bestStrat].wins / stratPerf[bestStrat].count) * 100).toFixed(0);
      html += `<div class="flex justify-between text-sm p-2 rounded" style="background: rgba(245,158,11,0.05);"><span class="text-muted">Top Strategy</span><span class="font-bold text-warning">${bestStrat} (${sWinRate}% WR)</span></div>`;
    }

    // Worst emotion
    const emotionLosses = {};
    trades.filter(t => t.result === "Loss").forEach(t => {
      const e = t.emotionBefore || "Calm";
      emotionLosses[e] = (emotionLosses[e] || 0) + 1;
    });
    let worstEmotion = "-", worstCount = 0;
    Object.keys(emotionLosses).forEach(e => {
      if (emotionLosses[e] > worstCount) { worstCount = emotionLosses[e]; worstEmotion = e; }
    });
    if (worstEmotion !== "-") {
      html += `<div class="flex justify-between text-sm p-2 rounded" style="background: rgba(239,68,68,0.05);"><span class="text-muted">Riskiest Emotion</span><span class="font-bold text-danger">${worstEmotion} (${worstCount} losses)</span></div>`;
    }
  }

  els.aiInsightsPanel.innerHTML = html;
}

// Simple AI Chat responses based on trade data
function handleAiChat(userMessage) {
  if (!els.aiChatBox) return;
  const msg = userMessage.toLowerCase();
  const trades = state.trades;
  let response = "";

  if (trades.length < 3) {
    response = "I need at least 3 trades logged to provide meaningful analysis. Keep tracking your trades!";
  } else if (msg.includes("revenge") || msg.includes("losing streak")) {
    let consecLosses = 0, maxConsec = 0;
    trades.forEach(t => {
      if (t.result === "Loss") { consecLosses++; if (consecLosses > maxConsec) maxConsec = consecLosses; }
      else consecLosses = 0;
    });
    response = maxConsec >= 3
      ? `Warning: Your max consecutive loss streak is ${maxConsec}. This suggests possible revenge trading. After 2 consecutive losses, take a 15-minute break and review your plan before entering again.`
      : `Good news! Your max consecutive loss streak is only ${maxConsec}. You appear to manage losses well without revenge trading.`;
  } else if (msg.includes("best strategy") || msg.includes("strategy")) {
    const stratPerf = {};
    trades.forEach(t => {
      const s = t.strategy || "None";
      if (!stratPerf[s]) stratPerf[s] = { pnl: 0, count: 0, wins: 0 };
      stratPerf[s].pnl += t.pnl;
      stratPerf[s].count++;
      if (t.result === "Win") stratPerf[s].wins++;
    });
    let best = "-", bestPnl = -Infinity;
    Object.keys(stratPerf).forEach(s => {
      if (stratPerf[s].pnl > bestPnl) { bestPnl = stratPerf[s].pnl; best = s; }
    });
    const wr = stratPerf[best] ? ((stratPerf[best].wins / stratPerf[best].count) * 100).toFixed(0) : 0;
    response = `Your best strategy is "${best}" with a ${wr}% win rate and $${bestPnl.toFixed(2)} total PnL from ${stratPerf[best]?.count || 0} trades. Focus on this setup for consistent results.`;
  } else if (msg.includes("discipline") || msg.includes("rules")) {
    const avg = trades.reduce((s, t) => s + (t.discipline || 3), 0) / trades.length;
    const broke = trades.filter(t => t.discipline <= 2).length;
    response = avg >= 4
      ? `Excellent discipline! Your average rating is ${avg.toFixed(1)}/5. Only ${broke} trades with rule violations. Keep executing your plan consistently.`
      : `Your average discipline is ${avg.toFixed(1)}/5 with ${broke} trades where rules were broken. Focus on pre-trade checklists and pause after losses.`;
  } else if (msg.includes("emotion") || msg.includes("psychology") || msg.includes("mood")) {
    const emoMap = {};
    trades.forEach(t => {
      const e = t.emotionBefore || "Calm";
      if (!emoMap[e]) emoMap[e] = { total: 0, pnl: 0 };
      emoMap[e].total++;
      emoMap[e].pnl += t.pnl;
    });
    let best = "-", bestPnl = -Infinity;
    Object.keys(emoMap).forEach(e => {
      if (emoMap[e].pnl > bestPnl) { bestPnl = emoMap[e].pnl; best = e; }
    });
    response = `Your most profitable emotional state is "${best}" with $${bestPnl.toFixed(2)} net PnL from ${emoMap[best]?.total || 0} trades. Try to enter trades only when you feel ${best}.`;
  } else if (msg.includes("win rate") || msg.includes("winrate")) {
    const wins = trades.filter(t => t.result === "Win").length;
    const wr = ((wins / trades.length) * 100).toFixed(1);
    response = `Your current win rate is ${wr}% (${wins} wins out of ${trades.length} trades). ${wr >= 55 ? "This is above average - well done!" : wr >= 45 ? "This is in the acceptable range. Focus on risk-reward ratio." : "Consider improving your entry criteria and risk management."}`;
  } else if (msg.includes("help") || msg.includes("what can you")) {
    response = "I can analyze: revenge trading patterns, best/worst strategies, emotional correlations, discipline scores, win rate trends, and risk management. Ask me about any of these!";
  } else {
    response = `I've analyzed your ${trades.length} trades. Ask me about: "revenge trading", "best strategy", "discipline", "emotions", "win rate", or say "help" for more options.`;
  }

  // Add user message bubble
  els.aiChatBox.innerHTML += `
    <div class="ai-msg ai-msg-user flex gap-2 justify-end">
      <div class="ai-msg-bubble p-3 rounded-xl text-sm text-light border border-card-border" style="background: var(--primary-glow); max-width: 80%; text-align: right;">
        ${userMessage}
      </div>
    </div>
  `;

  // Add bot response
  els.aiChatBox.innerHTML += `
    <div class="ai-msg ai-msg-bot flex gap-2">
      <div class="ai-avatar" style="width: 32px; height: 32px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; color:white; font-size:12px; flex-shrink:0;"><i class="fa fa-robot"></i></div>
      <div class="ai-msg-bubble p-3 rounded-xl text-sm text-light border border-card-border" style="background:var(--bg-card-hover); max-width: 80%;">
        ${response}
      </div>
    </div>
  `;

  els.aiChatBox.scrollTop = els.aiChatBox.scrollHeight;
}

// --- RENDER PAGE: PSYCHOLOGY HUB ---
function renderPsychologyPage() {
  const trades = state.trades;
  if (trades.length === 0) return;

  // 1. Emotional Consistency - % of wins where emotion was "Calm"
  const calmWins = trades.filter(t => t.result === "Win" && t.emotionBefore === "Calm").length;
  const totalWins = trades.filter(t => t.result === "Win").length;
  const consistency = totalWins ? ((calmWins / totalWins) * 100).toFixed(1) : 0;
  if (els.psyConsistency) els.psyConsistency.innerText = consistency + "%";

  // 2. Discipline Score
  const avgDiscipline = trades.reduce((s, t) => s + (t.discipline || 3), 0) / trades.length;
  if (els.psyDiscipline) els.psyDiscipline.innerText = avgDiscipline.toFixed(1) + "/5";

  // 3. Mistake Prevalence
  const tradesWithMistakes = trades.filter(t => t.mistakes && t.mistakes.length > 0).length;
  const mistakePct = ((tradesWithMistakes / trades.length) * 100).toFixed(0);
  if (els.psyMistakes) els.psyMistakes.innerText = mistakePct + "%";

  // 4. Emotional Peak - most frequent entry emotion
  const emotionCounts = {};
  trades.forEach(t => {
    const e = t.emotionBefore || "Calm";
    emotionCounts[e] = (emotionCounts[e] || 0) + 1;
  });
  let peakEmotion = "Calm", peakCount = 0;
  Object.keys(emotionCounts).forEach(e => {
    if (emotionCounts[e] > peakCount) { peakCount = emotionCounts[e]; peakEmotion = e; }
  });
  if (els.psyPeak) els.psyPeak.innerText = peakEmotion;

  // 5. Emotion Correlator Table
  if (els.psyEmotionTable) {
    const emotionData = {};
    trades.forEach(t => {
      const e = t.emotionBefore || "Calm";
      if (!emotionData[e]) emotionData[e] = { total: 0, wins: 0, pnl: 0 };
      emotionData[e].total++;
      if (t.result === "Win") emotionData[e].wins++;
      emotionData[e].pnl += t.pnl;
    });

    els.psyEmotionTable.innerHTML = "";
    Object.keys(emotionData).sort((a, b) => emotionData[b].total - emotionData[a].total).forEach(e => {
      const d = emotionData[e];
      const wr = ((d.wins / d.total) * 100).toFixed(0);
      els.psyEmotionTable.innerHTML += `
        <tr>
          <td class="font-semibold">${e}</td>
          <td>${d.total}</td>
          <td class="${parseInt(wr) >= 50 ? 'text-success' : 'text-danger'} font-bold">${wr}%</td>
          <td class="${d.pnl >= 0 ? 'text-success' : 'text-danger'} font-bold">${d.pnl >= 0 ? '+' : '-'}$${Math.abs(d.pnl).toFixed(2)}</td>
        </tr>
      `;
    });
  }

  // 6. Discipline Breach Log
  if (els.psyBreachesLog && els.psyBreachCount) {
    const breaches = [];
    trades.forEach(t => {
      if (t.mistakes && t.mistakes.length > 0) {
        t.mistakes.forEach(m => {
          breaches.push({ date: t.date, asset: t.asset, mistake: m, pnl: t.pnl });
        });
      }
    });
    els.psyBreachCount.innerText = breaches.length + " Breach" + (breaches.length !== 1 ? "es" : "");

    if (breaches.length === 0) {
      els.psyBreachesLog.innerHTML = `<div class="text-xs text-muted">No rules violations registered. Clean record!</div>`;
    } else {
      els.psyBreachesLog.innerHTML = "";
      breaches.slice(-15).reverse().forEach(b => {
        els.psyBreachesLog.innerHTML += `
          <div class="flex justify-between align-center text-sm p-2 rounded" style="background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.1);">
            <div class="flex flex-col">
              <span class="font-semibold text-danger">${b.mistake}</span>
              <span class="text-xs text-muted">${b.asset} - ${b.date}</span>
            </div>
            <span class="font-bold ${b.pnl >= 0 ? 'text-success' : 'text-danger'} text-xs">${b.pnl >= 0 ? '+' : '-'}$${Math.abs(b.pnl).toFixed(2)}</span>
          </div>
        `;
      });
    }
  }

  // 7. Key Journal Takeaways
  if (els.psyLessonsList) {
    const lessons = trades.filter(t => t.lessons && t.lessons.trim().length > 0);
    if (lessons.length === 0) {
      els.psyLessonsList.innerHTML = `<div class="text-xs text-muted">Write detailed lessons learned inside trade forms to view highlights.</div>`;
    } else {
      els.psyLessonsList.innerHTML = "";
      lessons.slice(-10).reverse().forEach(t => {
        els.psyLessonsList.innerHTML += `
          <div class="p-2 rounded text-sm" style="background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.1);">
            <span class="text-xs text-success font-bold">${t.asset} - ${t.date}</span>
            <p class="text-light mt-1" style="font-size:0.8rem;">${t.lessons}</p>
          </div>
        `;
      });
    }
  }

  // Render Psychology Score chart
  renderPsychologyScore("chartPsychologyScore", trades);
}

// --- APP NOTIFICATIONS HELPER ---
let notificationTimeout;
function showNotification(message, type = "info") {
  const banner = els.notificationBanner;
  const icon = els.notificationIcon;
  const msg = els.notificationMessage;

  msg.innerText = message;
  
  // Set class based on type
  banner.className = `notification-banner active ${type}`;
  
  // Set icon based on type
  if (type === "success") {
    icon.className = "fa-solid fa-circle-check text-success";
    flashSaveIndicator();
  } else if (type === "danger") {
    icon.className = "fa-solid fa-circle-xmark text-danger";
  } else if (type === "warning") {
    icon.className = "fa-solid fa-triangle-exclamation text-warning";
  } else {
    icon.className = "fa-solid fa-circle-info text-accent";
  }

  clearTimeout(notificationTimeout);
  notificationTimeout = setTimeout(() => {
    banner.classList.remove("active");
  }, 4000);
}

function flashSaveIndicator() {
  if (!els.liveSaveIndicator) return;
  els.liveSaveIndicator.style.background = "rgba(16,185,129,0.3)";
  els.liveSaveIndicator.style.boxShadow = "0 0 12px rgba(16,185,129,0.4)";
  setTimeout(() => {
    els.liveSaveIndicator.style.background = "rgba(16,185,129,0.1)";
    els.liveSaveIndicator.style.boxShadow = "none";
  }, 800);
}