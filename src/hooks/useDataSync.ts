import { useEffect } from 'react';
import { collection, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAppStore } from '../store';
import type { Account, CanonicalAccountDefinition, CustomRule, Entry, InventoryCheck, TransactionRule } from '../types';
import { SEED_ACCOUNTS, SEED_RULES } from '../migrationData';
import { isAdminEmail } from '../lib/adminAccess';
import type { HistoricalCostReviewOverlay } from '../lib/historicalCostReview';
import { generateId } from '../utils/generateId';

type AppView = ReturnType<typeof useAppStore.getState>['view'];

const normalizeEntries = (snapshot: any): Entry[] => snapshot.docs
  .map((item: any) => {
    const data = item.data();
    return {
      id: item.id,
      ...data,
      tx: data.tx || '',
      debit: data.debit || '',
      credit: data.credit || '',
      date: data.date || '',
      cash: data.cash || '0',
      weight: data.weight || '0',
      arabicWeight: data.arabicWeight || '0',
      count: data.count || '0',
      notes: data.notes || '',
      isSettled: data.isSettled || false,
    } as Entry;
  })
  .sort((left: Entry, right: Entry) => {
    if (left.date !== right.date) return (right.date || '').localeCompare(left.date || '');
    return (right.seq || 0) - (left.seq || 0);
  });

export const useDataSync = (user: any, isAuthReady: boolean, view: AppView) => {
  const store = useAppStore.getState();
  const reportsTab = useAppStore(state => state.reportsTab);
  const ready = isAuthReady && !!user;

  useEffect(() => {
    if (!ready) return;
    const isAdmin = isAdminEmail(user.email);
    const entriesQuery = isAdmin
      ? query(collection(db, 'entries'))
      : query(collection(db, 'entries'), where('userId', '==', user.uid));

    const unsubscribeEntries = onSnapshot(entriesQuery, snapshot => {
      try {
        store.setEntries(normalizeEntries(snapshot));
      } catch (error) {
        console.error('Error processing entries snapshot:', error);
      }
    }, error => console.warn('Entries snapshot error:', error));

    const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeAccounts = onSnapshot(accountsQuery, snapshot => {
      const accounts = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as Account));
      if (accounts.length === 0) {
        const batch = writeBatch(db);
        SEED_ACCOUNTS.forEach(account => batch.set(doc(db, 'accounts', generateId()), { ...account, userId: user.uid }));
        SEED_RULES.forEach(rule => batch.set(doc(db, 'transactionRules', generateId()), { ...rule, userId: user.uid }));
        batch.commit().catch(error => console.error('Seed error:', error));
        return;
      }

      store.setAccountsDb(accounts);
      const batch = writeBatch(db);
      let updateCount = 0;
      accounts.forEach(account => {
        if (!account.id) return;
        const seedInfo = SEED_ACCOUNTS.find(seed => seed.name === account.name);
        const updates: Record<string, unknown> = {};
        if (!account.type && seedInfo) {
          updates.type = seedInfo.type;
          updates.is_inventory = seedInfo.is_inventory;
          updates.karat = seedInfo.karat;
          updates.metal = seedInfo.metal;
        }
        if ((account.type === 'accessory' || seedInfo?.type === 'accessory') && account.quantityStep === undefined) {
          updates.quantityStep = 1;
        }
        if (Object.keys(updates).length > 0) {
          batch.update(doc(db, 'accounts', account.id), updates);
          updateCount += 1;
        }
      });
      if (updateCount > 0) batch.commit().catch(error => console.error('Migration error:', error));
    }, error => console.warn('Accounts snapshot error:', error));

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', user.uid), snapshot => {
      if (!snapshot.exists()) {
        store.setOpeningCostConfig([]);
        return;
      }
      const data = snapshot.data();
      if (data.goldPrice) store.setGoldPrice(data.goldPrice);
      if (data.goldBuyPrice) store.setGoldBuyPrice(data.goldBuyPrice);
      if (data.goldSpread) store.setGoldSpread(data.goldSpread);
      if (data.silverPrice) store.setSilverPrice(data.silverPrice);
      if (data.silverBuyPrice) store.setSilverBuyPrice(data.silverBuyPrice);
      if (data.silverSpread) store.setSilverSpread(data.silverSpread);
      if (data.accountCategories) store.setAccountCategories(data.accountCategories);
      store.setOpeningCostConfig(Array.isArray(data.openingCostConfig) ? data.openingCostConfig : []);
    }, error => console.warn('Settings snapshot error:', error));

    // Firestore rules isolate historical cost decisions by exact owner.
    // Even admins must use an owner-scoped query because rules are not filters.
    const overlaysQuery = query(
      collection(db, 'historicalCostReviewOverlays'),
      where('userId', '==', user.uid),
      where('ownerId', '==', user.uid),
      where('createdBy', '==', user.uid),
    );
    const unsubscribeHistoricalCostOverlays = onSnapshot(overlaysQuery, snapshot => {
      store.setHistoricalCostReviewOverlays(snapshot.docs
        .map(item => item.data() as HistoricalCostReviewOverlay)
        .sort((left, right) => left.targetOperationId.localeCompare(right.targetOperationId)
          || left.overlayVersion - right.overlayVersion));
    }, error => console.warn('Historical cost overlays snapshot error:', error));

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
      unsubscribeSettings();
      unsubscribeHistoricalCostOverlays();
    };
  }, [ready, user?.uid, user?.email]);

  useEffect(() => {
    if (!ready || !['entry', 'journal', 'reports', 'inventory', 'profit-analysis', 'advanced-analytics', 'settings', 'chart-of-accounts'].includes(view)) return;
    const canonicalQuery = query(collection(db, 'canonicalAccounts'), where('userId', '==', user.uid));
    return onSnapshot(canonicalQuery, snapshot => {
      store.setCanonicalAccounts(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as CanonicalAccountDefinition)));
    }, error => console.warn('Canonical accounts snapshot error:', error));
  }, [ready, user?.uid, view]);

  useEffect(() => {
    if (!ready || !['entry', 'guide', 'settings'].includes(view)) return;
    const transactionRulesQuery = query(collection(db, 'transactionRules'), where('userId', '==', user.uid));
    const customRulesQuery = query(collection(db, 'customRules'), where('userId', '==', user.uid));
    const unsubscribeTransactionRules = onSnapshot(transactionRulesQuery, snapshot => {
      store.setTransactionRules(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as TransactionRule)));
    }, error => console.warn('Transaction Rules snapshot error:', error));
    const unsubscribeCustomRules = onSnapshot(customRulesQuery, snapshot => {
      store.setCustomRules(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as CustomRule)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'customRules'));
    return () => {
      unsubscribeTransactionRules();
      unsubscribeCustomRules();
    };
  }, [ready, user?.uid, view]);

  useEffect(() => {
    const needsInventoryChecks = view === 'database'
      || view === 'inventory'
      || (view === 'reports' && reportsTab === 'inventory');
    if (!ready || !needsInventoryChecks) return;
    const inventoryQuery = isAdminEmail(user.email)
      ? query(collection(db, 'inventory_checks'))
      : query(collection(db, 'inventory_checks'), where('userId', '==', user.uid));
    return onSnapshot(inventoryQuery, snapshot => {
      const checks = snapshot.docs
        .map(item => ({ id: item.id, ...item.data() } as InventoryCheck))
        .sort((left, right) => (right.date || '').localeCompare(left.date || ''));
      store.setInventoryChecks(checks);
    }, error => console.warn('Inventory Checks snapshot error:', error));
  }, [ready, user?.uid, user?.email, view, reportsTab]);
};