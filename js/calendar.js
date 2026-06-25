// Trading Calendar rendering engine

const currencySymbols = {
  "USD": "$",
  "EUR": "€",
  "GBP": "£",
  "INR": "₹"
};

export function groupByDate(trades) {
  const map = {};
  trades.forEach(t => {
    if (!t.date) return;
    if (!map[t.date]) {
      map[t.date] = {
        pnl: 0,
        trades: []
      };
    }
    map[t.date].pnl += t.pnl;
    map[t.date].trades.push(t);
  });
  return map;
}

export function renderCalendar(containerId, year, month, trades, onDayClick, currency = "USD") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sym = currencySymbols[currency] || "$";

  // Group trades by date
  const groupedData = groupByDate(trades);

  // Month details
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // Date calculations
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Create UI
  let html = `
    <div class="calendar-header">
      <button class="btn btn-sm btn-icon" id="prevMonthBtn"><i class="fa fa-chevron-left"></i></button>
      <h3 class="calendar-title">${monthNames[month]} ${year}</h3>
      <button class="btn btn-sm btn-icon" id="nextMonthBtn"><i class="fa fa-chevron-right"></i></button>
    </div>
    
    <div class="calendar-grid">
      <div class="calendar-day-header">Sun</div>
      <div class="calendar-day-header">Mon</div>
      <div class="calendar-day-header">Tue</div>
      <div class="calendar-day-header">Wed</div>
      <div class="calendar-day-header">Thu</div>
      <div class="calendar-day-header">Fri</div>
      <div class="calendar-day-header">Sat</div>
  `;

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDay = prevMonthTotalDays - i;
    html += `<div class="calendar-cell calendar-cell-empty">${prevDay}</div>`;
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = groupedData[dateString];
    
    let cellClass = "calendar-cell calendar-cell-active";
    let pnlHtml = "";
    let tradeCountHtml = "";

    if (dayData) {
      const netPnl = dayData.pnl;
      const count = dayData.trades.length;
      
      tradeCountHtml = `<span class="calendar-trade-count">${count} ${count === 1 ? 'trade' : 'trades'}</span>`;
      
      if (netPnl > 0.01) {
        cellClass += " calendar-profit";
        pnlHtml = `<div class="calendar-pnl font-semibold">+${sym}${netPnl.toFixed(2)}</div>`;
      } else if (netPnl < -0.01) {
        cellClass += " calendar-loss";
        pnlHtml = `<div class="calendar-pnl font-semibold">-${sym}${Math.abs(netPnl).toFixed(2)}</div>`;
      } else {
        cellClass += " calendar-neutral";
        pnlHtml = `<div class="calendar-pnl font-semibold">${sym}0.00</div>`;
      }
    }

    html += `
      <div class="${cellClass}" data-date="${dateString}">
        <span class="calendar-day-num">${day}</span>
        ${pnlHtml}
        ${tradeCountHtml}
      </div>
    `;
  }

  // Next month padding days to fill 6 rows (42 cells total)
  const totalCellsWritten = firstDayIndex + totalDays;
  const remainingCells = 42 - totalCellsWritten;
  for (let day = 1; day <= remainingCells; day++) {
    html += `<div class="calendar-cell calendar-cell-empty">${day}</div>`;
  }

  html += `</div>`; // Close grid

  // Month Statistics Summary Footer
  const monthStartStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;
  const monthTrades = trades.filter(t => t.date >= monthStartStr && t.date <= monthEndStr);
  
  let monthPnl = 0;
  let monthWins = 0;
  let monthLosses = 0;
  monthTrades.forEach(t => {
    monthPnl += t.pnl;
    if (t.result === "Win") monthWins++;
    else if (t.result === "Loss") monthLosses++;
  });
  const monthTotal = monthTrades.length;
  const monthWinRate = monthTotal ? ((monthWins / monthTotal) * 100).toFixed(1) : "0.0";
  const pnlClass = monthPnl >= 0 ? "text-success" : "text-danger";

  html += `
    <div class="calendar-summary-footer mt-4 p-3 bg-card-dark rounded-xl border border-card-border flex justify-between align-center">
      <div class="flex flex-col">
        <span class="text-xs text-muted">MONTHLY NET P&L</span>
        <span class="text-lg font-bold ${pnlClass}">${monthPnl >= 0 ? '+' : '-'}${sym}${Math.abs(monthPnl).toFixed(2)}</span>
      </div>
      <div class="flex flex-col text-center">
        <span class="text-xs text-muted">TRADES</span>
        <span class="text-lg font-bold text-light">${monthTotal}</span>
      </div>
      <div class="flex flex-col text-right">
        <span class="text-xs text-muted">WIN RATE</span>
        <span class="text-lg font-bold text-accent">${monthWinRate}%</span>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Add click events to active calendar cells
  container.querySelectorAll('.calendar-cell-active').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.getAttribute('data-date');
      const dayTrades = groupedData[dateStr] ? groupedData[dateStr].trades : [];
      if (onDayClick) {
        onDayClick(dateStr, dayTrades);
      }
    });
  });

  // Navigation handlers
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear = year - 1;
    }
    renderCalendar(containerId, prevYear, prevMonth, trades, onDayClick);
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear = year + 1;
    }
    renderCalendar(containerId, nextYear, nextMonth, trades, onDayClick);
  });
}