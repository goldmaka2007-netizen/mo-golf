import fs from 'fs';
import { RAW_DATA as raw } from './src/constants.js';

const OPENING_COSTS = {
  '18': 5000,
  '21': 6000,
  '24': 7000,
};

const karatMetrics = {
    '18': { count: 0, salesCash: 0, cogs: 0, purchW: 0, purchV: 0, salesW: 0, openingW: 0, openingCost: 0, openingValue: 0, arOpeningW: 0, arPurchW: 0, arSalesW: 0 },
    '21': { count: 0, salesCash: 0, cogs: 0, purchW: 0, purchV: 0, salesW: 0, openingW: 0, openingCost: 0, openingValue: 0, arOpeningW: 0, arPurchW: 0, arSalesW: 0 },
    '24': { count: 0, salesCash: 0, cogs: 0, purchW: 0, purchV: 0, salesW: 0, openingW: 0, openingCost: 0, openingValue: 0, arOpeningW: 0, arPurchW: 0, arSalesW: 0 },
};

const inventory = {
    '18': { weight: 0, arWeight: 0, value: 0, cost: OPENING_COSTS['18'] },
    '21': { weight: 0, arWeight: 0, value: 0, cost: OPENING_COSTS['21'] },
    '24': { weight: 0, arWeight: 0, value: 0, cost: OPENING_COSTS['24'] },
};

const applyEntryToInventory = (e, inPeriod) => {
    const qCash = parseFloat(e.cash || '0');
    const qWeight = parseFloat(e.weight || '0');
    const txText = (e.tx || '');
    const debitText = (e.debit || '');
    const creditText = (e.credit || '');
    const combinedText = (txText + ' ' + debitText + ' ' + creditText);

    let kString = e.karat ? String(e.karat) : null;
    if (!kString) {
        if (combinedText.includes('18') || combinedText.includes('افرنجي')) kString = '18';
        else if (combinedText.includes('21') || combinedText.includes('عربي')) kString = '21';
        else if (combinedText.includes('24') || combinedText.includes('سبيكة')) kString = '24';
    }

    if (!kString || !inventory[kString]) return;

    const inv = inventory[kString];
    
    // Explicit Capital (Opening) Entry detection
    const isCapital = creditText.startsWith('31') || creditText.includes('راس المال') || txText.includes('افتتاحي');
    
    // Determine direction of inventory flow
    const isInward = isCapital || txText.includes('شراء') || txText.includes('توريد') || txText.includes('اضافة') || 
                     debitText.startsWith('12') || debitText.includes('مخزون') || txText.includes('مرتجع مبيعات');
                     
    // Outward means leaving inventory
    const isOutward = txText.includes('بيع') || txText.includes('صرف') || txText.includes('مسحوبات') || 
                      creditText.startsWith('12') || creditText.includes('مخزون') || creditText.startsWith('41') || creditText.includes('مبيعات') || txText.includes('مرتجع مشتريات');

    let actualArWeight = parseFloat(e.arabicWeight || '0');
    if (actualArWeight === 0 && qWeight > 0 && !e.arabicWeight) {
      actualArWeight = qWeight * (parseInt(kString) / 21);
    }

    // Cash-Only logic
    if (txText.includes('حساب تاجر') && qWeight === 0 && qCash > 0 && (creditText.includes('الخزنة') || creditText.includes('بنك'))) {
      inv.value += qCash;
      inv.cost = inv.weight > 0 ? (inv.value / inv.weight) : inv.cost;
      if (inPeriod && !isCapital) {
        karatMetrics[kString].purchV += qCash;
      }
      return;
    }

    // 2. Gold Movement
    if (qWeight > 0) {
      if (isInward) {
        const entryVal = isCapital ? qWeight * (OPENING_COSTS[kString] || inv.cost) : (qCash > 0 ? qCash : qWeight * inv.cost);
        
        inv.weight += qWeight;
        inv.arWeight += actualArWeight;
        inv.value += entryVal;
        inv.cost = inv.weight > 0 ? (inv.value / inv.weight) : OPENING_COSTS[kString];

        if (inPeriod) {
          if (isCapital) {
            karatMetrics[kString].openingW += qWeight;
            karatMetrics[kString].arOpeningW += actualArWeight;
            karatMetrics[kString].openingValue += entryVal;
          } else {
            karatMetrics[kString].purchW += qWeight;
            karatMetrics[kString].arPurchW += actualArWeight;
            karatMetrics[kString].purchV += entryVal;
          }
        }
      } 
      else if (isOutward) {
        const cogsValue = qWeight * inv.cost;
        
        inv.weight -= qWeight;
        inv.arWeight -= actualArWeight;
        inv.value -= cogsValue;
        
        if (inPeriod) {
          karatMetrics[kString].salesW += qWeight;
          karatMetrics[kString].arSalesW += actualArWeight;
          karatMetrics[kString].salesCash += qCash;
          karatMetrics[kString].cogs += cogsValue;
        }
      }
    }
};

raw.forEach(e => applyEntryToInventory(e, true));

let tArOpen = 0, tArOpenVal = 0, tPurchV = 0, tArPurch = 0, tSalesV = 0, tArSales = 0, tCogs = 0, tGross = 0, tArEnd = 0, tArEndVal = 0;
Object.entries(karatMetrics).forEach(([k, m]) => {
const inv = inventory[k];
const arEndW = inv.arWeight;

tArOpen += m.arOpeningW;
tArOpenVal += m.openingValue;

tArPurch += m.arPurchW;
tPurchV += m.purchV;

tArSales += m.arSalesW;
tSalesV += m.salesCash;

tCogs += m.cogs;
tGross += (m.salesCash - m.cogs);

tArEnd += arEndW;
tArEndVal += inv.value;
});

console.log("tArOpen:", tArOpen.toFixed(2));
console.log("tArOpenVal:", tArOpenVal.toFixed(2));
console.log("tArPurch:", tArPurch.toFixed(2));
console.log("tPurchV:", tPurchV.toFixed(2));
console.log("tArSales:", tArSales.toFixed(2));
console.log("tSalesV:", tSalesV.toFixed(2));
console.log("tCogs:", tCogs.toFixed(2));
console.log("tGross:", tGross.toFixed(2));
console.log("tArEnd:", tArEnd.toFixed(2));
console.log("tArEndVal:", tArEndVal.toFixed(2));
