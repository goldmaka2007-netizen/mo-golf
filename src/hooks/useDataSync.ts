import { useEffect } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store';
import { Entry, Account, TransactionRule, CustomRule, InventoryCheck } from '../types';
import { SEED_ACCOUNTS, SEED_RULES } from '../migrationData';
import { writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase';

export const useDataSync = (user: any, isAuthReady: boolean) => {
  const { 
    setEntries,
    setAccountsDb,
    setTransactionRules,
    setCustomRules,
    setInventoryChecks,
    setGoldPrice, 
    setGoldBuyPrice,
    setGoldSpread,
    setSilverPrice, 
    setSilverBuyPrice,
    setSilverSpread,
    setAccountCategories,
    setOpeningCostConfig
  } = useAppStore();

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "mohamedyasser757.my@gmail.com";
    const isAdmin = user.email?.toLowerCase() === adminEmail.toLowerCase();
    
    // --- Entries Listener ---
    const entriesQuery = isAdmin 
      ? query(collection(db, 'entries'))
      : query(collection(db, 'entries'), where('userId', '==', user.uid));

    const unsubscribeEntries = onSnapshot(entriesQuery, (snapshot) => {
      try {
        const data = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            tx: d.tx || '',
            debit: d.debit || '',
            credit: d.credit || '',
            date: d.date || '',
            cash: d.cash || '0',
            weight: d.weight || '0',
            arabicWeight: d.arabicWeight || '0',
            count: d.count || '0',
            notes: d.notes || '',
            isSettled: d.isSettled || false
          } as Entry;
        });
        
        const sortedData = data.sort((a, b) => {
          const dateA = a.date || '';
          const dateB = b.date || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return (b.seq || 0) - (a.seq || 0);
        });

        setEntries(sortedData);
      } catch (err) {
        console.error("Error processing entries snapshot:", err);
      }
    }, (error) => {
      console.warn("Entries snapshot error:", error);
    });

    // --- Accounts Listener ---
    const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      if (data.length === 0) {
        // Seed initial data if accounts are empty
        const seedInitialData = async (userId: string) => {
          try {
            const batch = writeBatch(db);
            SEED_ACCOUNTS.forEach(acc => {
              const ref = doc(collection(db, 'accounts'));
              batch.set(ref, { ...acc, userId });
            });
            SEED_RULES.forEach(rule => {
              const ref = doc(collection(db, 'transactionRules'));
              batch.set(ref, { ...rule, userId });
            });
            await batch.commit();
          } catch (err) {
            console.error("Seed error:", err);
          }
        };
        seedInitialData(user.uid);
      } else {
        setAccountsDb(data);
        
        // Auto-migrate accounts missing 'type'
        const batch = writeBatch(db);
        let count = 0;
        data.forEach(acc => {
          if (!acc.type && acc.id) {
            const seedInfo = SEED_ACCOUNTS.find(s => s.name === acc.name);
            if (seedInfo) {
              const ref = doc(db, 'accounts', acc.id);
              batch.update(ref, {
                type: seedInfo.type,
                is_inventory: seedInfo.is_inventory,
                karat: seedInfo.karat,
                metal: seedInfo.metal
              });
              count++;
            }
          }
        });
        if (count > 0) {
          batch.commit().catch(err => console.error("Migration error:", err));
        }
      }
    }, (error) => {
      console.warn("Accounts snapshot error:", error);
    });

    // --- Transaction Rules Listener ---
    const trQuery = query(collection(db, 'transactionRules'), where('userId', '==', user.uid));
    const unsubscribeTR = onSnapshot(trQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionRule));
      setTransactionRules(data);
    }, (error) => {
      console.warn("Transaction Rules snapshot error:", error);
    });

    // --- Custom Rules Listener ---
    const rulesQuery = query(collection(db, 'customRules'), where('userId', '==', user.uid));
    const unsubscribeRules = onSnapshot(rulesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomRule));
      setCustomRules(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customRules');
    });

    // --- Inventory Checks Listener ---
    const inventoryChecksQuery = isAdmin 
      ? query(collection(db, 'inventory_checks'))
      : query(collection(db, 'inventory_checks'), where('userId', '==', user.uid));

    const unsubscribeInventory = onSnapshot(inventoryChecksQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryCheck));
      const sortedData = data.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setInventoryChecks(sortedData);
    }, (error) => {
      console.warn("Inventory Checks snapshot error:", error);
    });

    // --- Settings Sync ---
    const settingsRef = doc(db, 'settings', user.uid);
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.goldPrice) setGoldPrice(data.goldPrice);
        if (data.goldBuyPrice) setGoldBuyPrice(data.goldBuyPrice);
        if (data.goldSpread) setGoldSpread(data.goldSpread);
        if (data.silverPrice) setSilverPrice(data.silverPrice);
        if (data.silverBuyPrice) setSilverBuyPrice(data.silverBuyPrice);
        if (data.silverSpread) setSilverSpread(data.silverSpread);
        if (data.accountCategories) setAccountCategories(data.accountCategories);
        setOpeningCostConfig(Array.isArray(data.openingCostConfig) ? data.openingCostConfig : []);
      } else {
        setOpeningCostConfig([]);
      }
    }, (error) => {
      console.warn("Settings snapshot error:", error);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeAccounts();
      unsubscribeTR();
      unsubscribeRules();
      unsubscribeInventory();
      unsubscribeSettings();
    };
  }, [isAuthReady, user]);
};
