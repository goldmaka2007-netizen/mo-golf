/* This file is deterministic and generated from the approved Phase 2.1
 * canonical_operation_mapping_matrix.csv, with historical dimension applicability
 * checked against legacy_ledger_projection_trace.csv to prevent cross-metal duplication.
 * Regenerate with: npx tsx scripts/generate-phase4-resolver-catalog.ts
 */
import type { CanonicalResolverDefinition } from './canonicalResolverCatalog';

export const CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS = [
  {
    "resolverId": "phase21-v1-001",
    "approvedVariantId": "personal_drawings:personal_drawings:المسحوبات->الخزنه",
    "sourceVariantId": "personal_drawings:المسحوبات->الخزنه",
    "name": "مسحوبات — personal_drawings:المسحوبات->الخزنه",
    "operationType": "personal_drawings",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "مسحوبات",
      "debit": "المسحوبات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 92,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-cbb3feca38a9c9b79877 | المسحوبات; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "+Personal Drawings (contra-equity)"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash",
    "triggerConditions": "tx == \"مسحوبات\" AND debit == \"المسحوبات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-02",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-002",
    "approvedVariantId": "customer_gold_purchase:customer_gold_purchase:كسر عربي->الخزنه",
    "sourceVariantId": "customer_gold_purchase:كسر عربي->الخزنه",
    "name": "شراء ذهب — customer_gold_purchase:كسر عربي->الخزنه",
    "operationType": "customer_gold_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء ذهب",
      "debit": "كسر عربي",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 97,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "canonical:metal-flow:gold:acquired | Gold Weight Acquired",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr canonical:metal-flow:gold:acquired | Gold Weight Acquired; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Gold Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId",
    "triggerConditions": "tx == \"شراء ذهب\" AND debit == \"كسر عربي\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-003",
    "approvedVariantId": "customer_gold_purchase:customer_gold_purchase:كسر افرنجي->الخزنه",
    "sourceVariantId": "customer_gold_purchase:كسر افرنجي->الخزنه",
    "name": "شراء ذهب — customer_gold_purchase:كسر افرنجي->الخزنه",
    "operationType": "customer_gold_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء ذهب",
      "debit": "كسر افرنجي",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 441,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "canonical:metal-flow:gold:acquired | Gold Weight Acquired",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr canonical:metal-flow:gold:acquired | Gold Weight Acquired; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Gold Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId",
    "triggerConditions": "tx == \"شراء ذهب\" AND debit == \"كسر افرنجي\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-004",
    "approvedVariantId": "operating_expense:operating_expense:الذكاه->الخزنه",
    "sourceVariantId": "operating_expense:الذكاه->الخزنه",
    "name": "م ا ع — operating_expense:الذكاه->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "الذكاة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 47,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-47417761c0b6e0be1c7a | الذكاة",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-47417761c0b6e0be1c7a | الذكاة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-47417761c0b6e0be1c7a | الذكاة",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-47417761c0b6e0be1c7a | الذكاة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"الذكاة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-005",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->حلق مكرونه",
    "sourceVariantId": "customer_gold_sale:الخزنه->حلق مكرونه",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->حلق مكرونه",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "حلق مكرونة"
    },
    "historicalDocumentCount": 57,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"حلق مكرونة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-006",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->سبيكه",
    "sourceVariantId": "customer_gold_sale:الخزنه->سبيكه",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->سبيكه",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "سبيكة"
    },
    "historicalDocumentCount": 106,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-8bc82f32572189c8e128 | سبيكة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-8bc82f32572189c8e128 | سبيكة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"سبيكة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-007",
    "approvedVariantId": "customer_gold_purchase:customer_gold_purchase:سبيكه->الخزنه",
    "sourceVariantId": "customer_gold_purchase:سبيكه->الخزنه",
    "name": "شراء ذهب — customer_gold_purchase:سبيكه->الخزنه",
    "operationType": "customer_gold_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء ذهب",
      "debit": "سبيكة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 60,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "goldCredit": "canonical:metal-flow:gold:acquired | Gold Weight Acquired",
      "silverDebit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-8bc82f32572189c8e128 | سبيكة; Cr canonical:metal-flow:gold:acquired | Gold Weight Acquired; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Gold Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId",
    "triggerConditions": "tx == \"شراء ذهب\" AND debit == \"سبيكة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-008",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->حلق اطفال",
    "sourceVariantId": "customer_gold_sale:الخزنه->حلق اطفال",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->حلق اطفال",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "حلق اطفال"
    },
    "historicalDocumentCount": 77,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-6b34c4189c5376f463c7 | حلق اطفال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"حلق اطفال\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-009",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->اسوره و انسيال",
    "sourceVariantId": "customer_gold_sale:الخزنه->اسوره و انسيال",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->اسوره و انسيال",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "اسورة و انسيال"
    },
    "historicalDocumentCount": 12,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"اسورة و انسيال\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-010",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->جنيه",
    "sourceVariantId": "customer_gold_sale:الخزنه->جنيه",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->جنيه",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "جنية"
    },
    "historicalDocumentCount": 16,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-87c0acf366b1f0c35e60 | جنية",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-87c0acf366b1f0c35e60 | جنية"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-87c0acf366b1f0c35e60 | جنية; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"جنية\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-011",
    "approvedVariantId": "other_income:other_income:الخزنه->تصليح",
    "sourceVariantId": "other_income:الخزنه->تصليح",
    "name": "ايرادات اخري — other_income:الخزنه->تصليح",
    "operationType": "other_income",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "ايرادات اخري",
      "debit": "الخزنة",
      "credit": "تصليح"
    },
    "historicalDocumentCount": 56,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-81c2c34fe2abb26e234a | تصليح",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-81c2c34fe2abb26e234a | تصليح",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-81c2c34fe2abb26e234a | تصليح"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-81c2c34fe2abb26e234a | تصليح; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"ايرادات اخري\" AND debit == \"الخزنة\" AND credit == \"تصليح\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-012",
    "approvedVariantId": "accessory_sale:accessory_sale:الخزنه->حلق طبي",
    "sourceVariantId": "accessory_sale:الخزنه->حلق طبي",
    "name": "بيع ملحقات — accessory_sale:الخزنه->حلق طبي",
    "operationType": "accessory_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ملحقات",
      "debit": "الخزنة",
      "credit": "حلق طبي"
    },
    "historicalDocumentCount": 36,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:accessories | Accessories Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-8d4a16e5eb12e1278df0 | حلق طبي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-8d4a16e5eb12e1278df0 | حلق طبي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:accessories | Accessories Sales Revenue; Dr canonical:expense:cogs:accessories | Accessories COGS; Cr canonical:asset:inventory-carrying-cost:accessories | Accessories Inventory Carrying Cost",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "accessory quantity decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Accessories COGS / Cr Accessories Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,quantity,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ملحقات\" AND debit == \"الخزنة\" AND credit == \"حلق طبي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-013",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->بريمه",
    "sourceVariantId": "customer_gold_sale:الخزنه->بريمه",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->بريمه",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "بريمة"
    },
    "historicalDocumentCount": 28,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-d6d361a10f6d7735f5a2 | بريمة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-d6d361a10f6d7735f5a2 | بريمة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"بريمة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-014",
    "approvedVariantId": "operating_expense:operating_expense:الصدقات->الخزنه",
    "sourceVariantId": "operating_expense:الصدقات->الخزنه",
    "name": "م ا ع — operating_expense:الصدقات->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "الصدقات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 30,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ff975a202468031f058c | الصدقات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-ff975a202468031f058c | الصدقات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-ff975a202468031f058c | الصدقات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-ff975a202468031f058c | الصدقات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"الصدقات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-015",
    "approvedVariantId": "inventory_transformation:inventory_transformation:حلق حريمي->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:حلق حريمي->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:حلق حريمي->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "حلق حريمي",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 20,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"حلق حريمي\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-016",
    "approvedVariantId": "inventory_transformation:inventory_transformation:حلق اطفال->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:حلق اطفال->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:حلق اطفال->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "حلق اطفال",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 26,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-6b34c4189c5376f463c7 | حلق اطفال; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"حلق اطفال\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-017",
    "approvedVariantId": "inventory_transformation:inventory_transformation:سلسله و تعليق->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:سلسله و تعليق->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:سلسله و تعليق->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "سلسلة و تعليق",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 24,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"سلسلة و تعليق\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-018",
    "approvedVariantId": "inventory_transformation:inventory_transformation:دبله->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:دبله->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:دبله->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "دبلة",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 20,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-abefcfd780de9b384dc5 | دبلة; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"دبلة\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-019",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->سلسله و تعليق",
    "sourceVariantId": "customer_gold_sale:الخزنه->سلسله و تعليق",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->سلسله و تعليق",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "سلسلة و تعليق"
    },
    "historicalDocumentCount": 75,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"سلسلة و تعليق\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-020",
    "approvedVariantId": "merchant_to_merchant_transfer:merchant_to_merchant_transfer:محمد ياسر->الخزنه",
    "sourceVariantId": "merchant_to_merchant_transfer:محمد ياسر->الخزنه",
    "name": "م ت — merchant_to_merchant_transfer:محمد ياسر->الخزنه",
    "operationType": "merchant_to_merchant_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ت",
      "debit": "محمد ياسر",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 30,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-eb8bd3a98d130dab24fa | محمد ياسر",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-eb8bd3a98d130dab24fa | محمد ياسر",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-eb8bd3a98d130dab24fa | محمد ياسر",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-eb8bd3a98d130dab24fa | محمد ياسر; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "no physical shop inventory movement",
      "merchantLiability": "decrease source merchant and increase destination merchant once",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ت\" AND debit == \"محمد ياسر\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-021",
    "approvedVariantId": "customer_gold_purchase:customer_gold_purchase:جنيه->الخزنه",
    "sourceVariantId": "customer_gold_purchase:جنيه->الخزنه",
    "name": "شراء ذهب — customer_gold_purchase:جنيه->الخزنه",
    "operationType": "customer_gold_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء ذهب",
      "debit": "جنية",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 12,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-87c0acf366b1f0c35e60 | جنية",
      "goldCredit": "canonical:metal-flow:gold:acquired | Gold Weight Acquired",
      "silverDebit": "seed-account-87c0acf366b1f0c35e60 | جنية",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-87c0acf366b1f0c35e60 | جنية; Cr canonical:metal-flow:gold:acquired | Gold Weight Acquired; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Gold Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId",
    "triggerConditions": "tx == \"شراء ذهب\" AND debit == \"جنية\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-022",
    "approvedVariantId": "customer_silver_purchase:customer_silver_purchase:كسر فضه->الخزنه",
    "sourceVariantId": "customer_silver_purchase:كسر فضه->الخزنه",
    "name": "شراء فضة — customer_silver_purchase:كسر فضه->الخزنه",
    "operationType": "customer_silver_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء فضة",
      "debit": "كسر فضة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 34,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "silverCredit": "canonical:metal-flow:silver:acquired | Silver Weight Acquired"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-2da1e46de570300127c6 | كسر فضة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=Equivalent-21",
      "silver": "Dr seed-account-2da1e46de570300127c6 | كسر فضة; Cr canonical:metal-flow:silver:acquired | Silver Weight Acquired; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Silver Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId",
    "triggerConditions": "tx == \"شراء فضة\" AND debit == \"كسر فضة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-023",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->خاتم حريمي",
    "sourceVariantId": "customer_gold_sale:الخزنه->خاتم حريمي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->خاتم حريمي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "خاتم حريمي"
    },
    "historicalDocumentCount": 86,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"خاتم حريمي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-024",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->كسر افرنجي",
    "sourceVariantId": "customer_gold_sale:الخزنه->كسر افرنجي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->كسر افرنجي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 17,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-025",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->دبله",
    "sourceVariantId": "customer_gold_sale:الخزنه->دبله",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->دبله",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "دبلة"
    },
    "historicalDocumentCount": 66,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-abefcfd780de9b384dc5 | دبلة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-abefcfd780de9b384dc5 | دبلة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"دبلة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-026",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->خاتم اطفال",
    "sourceVariantId": "customer_gold_sale:الخزنه->خاتم اطفال",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->خاتم اطفال",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "خاتم اطفال"
    },
    "historicalDocumentCount": 32,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-960d86a1b65899e364b7 | خاتم اطفال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"خاتم اطفال\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-027",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->خاتم فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->خاتم فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->خاتم فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "خاتم فضة"
    },
    "historicalDocumentCount": 7,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-feed1210d025ed84e443 | خاتم فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-feed1210d025ed84e443 | خاتم فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-feed1210d025ed84e443 | خاتم فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"خاتم فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-028",
    "approvedVariantId": "inventory_transformation:inventory_transformation:خاتم عربي->كسر عربي",
    "sourceVariantId": "inventory_transformation:خاتم عربي->كسر عربي",
    "name": "تيفيت — inventory_transformation:خاتم عربي->كسر عربي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "خاتم عربي",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 27,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ea099bf0071894125ad3 | خاتم عربي; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"خاتم عربي\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-029",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->سلسله رجالي فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->سلسله رجالي فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->سلسله رجالي فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "سلسلة رجالي فضة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"سلسلة رجالي فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-030",
    "approvedVariantId": "inventory_transformation:inventory_transformation:اسوره و انسيال->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:اسوره و انسيال->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:اسوره و انسيال->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "اسورة و انسيال",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"اسورة و انسيال\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-031",
    "approvedVariantId": "inventory_transformation:inventory_transformation:حلق مكرونه->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:حلق مكرونه->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:حلق مكرونه->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "حلق مكرونة",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 20,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"حلق مكرونة\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-032",
    "approvedVariantId": "inventory_transformation:inventory_transformation:حلق عربي->كسر عربي",
    "sourceVariantId": "inventory_transformation:حلق عربي->كسر عربي",
    "name": "تيفيت — inventory_transformation:حلق عربي->كسر عربي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "حلق عربي",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 12,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ff66eba547be9e799aba | حلق عربي; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"حلق عربي\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-033",
    "approvedVariantId": "inventory_transformation:inventory_transformation:خاتم حريمي->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:خاتم حريمي->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:خاتم حريمي->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "خاتم حريمي",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 31,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"خاتم حريمي\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-034",
    "approvedVariantId": "merchant_to_merchant_transfer:merchant_to_merchant_transfer:نقل و توصيل->الخزنه",
    "sourceVariantId": "merchant_to_merchant_transfer:نقل و توصيل->الخزنه",
    "name": "م ت — merchant_to_merchant_transfer:نقل و توصيل->الخزنه",
    "operationType": "merchant_to_merchant_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ت",
      "debit": "نقل و توصيل",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-4924377114f863e3c6e8 | نقل و توصيل",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-4924377114f863e3c6e8 | نقل و توصيل",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-4924377114f863e3c6e8 | نقل و توصيل",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-4924377114f863e3c6e8 | نقل و توصيل; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "no physical shop inventory movement",
      "merchantLiability": "decrease source merchant and increase destination merchant once",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ت\" AND debit == \"نقل و توصيل\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-035",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->دبله فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->دبله فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->دبله فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "دبلة فضة"
    },
    "historicalDocumentCount": 12,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-585a165916de021adb5a | دبلة فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-585a165916de021adb5a | دبلة فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-585a165916de021adb5a | دبلة فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"دبلة فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-036",
    "approvedVariantId": "accessory_sale:accessory_sale:الخزنه->دبله تنجستين",
    "sourceVariantId": "accessory_sale:الخزنه->دبله تنجستين",
    "name": "بيع ملحقات — accessory_sale:الخزنه->دبله تنجستين",
    "operationType": "accessory_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ملحقات",
      "debit": "الخزنة",
      "credit": "دبلة تنجستين"
    },
    "historicalDocumentCount": 10,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:accessories | Accessories Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:accessories | Accessories Sales Revenue; Dr canonical:expense:cogs:accessories | Accessories COGS; Cr canonical:asset:inventory-carrying-cost:accessories | Accessories Inventory Carrying Cost",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "accessory quantity decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Accessories COGS / Cr Accessories Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,quantity,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ملحقات\" AND debit == \"الخزنة\" AND credit == \"دبلة تنجستين\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-037",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->خاتم عربي",
    "sourceVariantId": "customer_gold_sale:الخزنه->خاتم عربي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->خاتم عربي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "خاتم عربي"
    },
    "historicalDocumentCount": 55,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-ea099bf0071894125ad3 | خاتم عربي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-ea099bf0071894125ad3 | خاتم عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"خاتم عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-038",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->حلق حريمي",
    "sourceVariantId": "customer_gold_sale:الخزنه->حلق حريمي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->حلق حريمي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "حلق حريمي"
    },
    "historicalDocumentCount": 54,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"حلق حريمي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-039",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->كسر عربي",
    "sourceVariantId": "customer_gold_sale:الخزنه->كسر عربي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->كسر عربي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 18,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-040",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->سلسله حريمي فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->سلسله حريمي فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->سلسله حريمي فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "سلسلة حريمي فضة"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"سلسلة حريمي فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-041",
    "approvedVariantId": "operating_expense:operating_expense:انترنت و ارضي->الخزنه",
    "sourceVariantId": "operating_expense:انترنت و ارضي->الخزنه",
    "name": "م ا ع — operating_expense:انترنت و ارضي->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "انترنت و ارضي",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 8,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3945533b3c98b200f6f7 | انترنت و ارضي",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-3945533b3c98b200f6f7 | انترنت و ارضي",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-3945533b3c98b200f6f7 | انترنت و ارضي",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-3945533b3c98b200f6f7 | انترنت و ارضي; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"انترنت و ارضي\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-042",
    "approvedVariantId": "merchant_workmanship_paid:merchant_settlement:خالد حميدو->الخزنه",
    "sourceVariantId": "merchant_settlement:خالد حميدو->الخزنه",
    "name": "حساب تاجر ذهب — merchant_settlement:خالد حميدو->الخزنه",
    "operationType": "merchant_workmanship_paid",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "خالد حميدو",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-f62320fb87b0c4a4568e | خالد حميدو; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "cash-balance workmanship liability/receivable decreases with cash paid",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"خالد حميدو\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-043",
    "approvedVariantId": "merchant_weight_delivered:merchant_settlement:خالد حميدو->كسر افرنجي",
    "sourceVariantId": "merchant_settlement:خالد حميدو->كسر افرنجي",
    "name": "حساب تاجر ذهب — merchant_settlement:خالد حميدو->كسر افرنجي",
    "operationType": "merchant_weight_delivered",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "خالد حميدو",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-f62320fb87b0c4a4568e | خالد حميدو; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical custody decreases; ownership unchanged",
      "merchantLiability": "merchant metal liability decreases",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"خالد حميدو\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-044",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:سلسله و تعليق->خالد حميدو",
    "sourceVariantId": "merchant_weight_received:سلسله و تعليق->خالد حميدو",
    "name": "تاجر ذهب — merchant_weight_received:سلسله و تعليق->خالد حميدو",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "سلسلة و تعليق",
      "credit": "خالد حميدو"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "cashCredit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "goldDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldCredit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو",
      "silverDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverCredit": "seed-account-f62320fb87b0c4a4568e | خالد حميدو"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-f62320fb87b0c4a4568e | خالد حميدو; amount=cash",
      "gold": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-f62320fb87b0c4a4568e | خالد حميدو; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"سلسلة و تعليق\" AND credit == \"خالد حميدو\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-045",
    "approvedVariantId": "operating_expense:operating_expense:كافيتريا->الخزنه",
    "sourceVariantId": "operating_expense:كافيتريا->الخزنه",
    "name": "م ا ع — operating_expense:كافيتريا->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "كافيتريا",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 10,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-4e98357185c658f73f46 | كافيتريا",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-4e98357185c658f73f46 | كافيتريا",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-4e98357185c658f73f46 | كافيتريا",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-4e98357185c658f73f46 | كافيتريا; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"كافيتريا\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-046",
    "approvedVariantId": "operating_expense:operating_expense:مياه->الخزنه",
    "sourceVariantId": "operating_expense:مياه->الخزنه",
    "name": "م ا ع — operating_expense:مياه->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "مياة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-098f255afe12c0bdc3ca | مياة",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-098f255afe12c0bdc3ca | مياة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-098f255afe12c0bdc3ca | مياة",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-098f255afe12c0bdc3ca | مياة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"مياة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-047",
    "approvedVariantId": "merchant_weight_delivered:merchant_settlement:الصافي->كسر افرنجي",
    "sourceVariantId": "merchant_settlement:الصافي->كسر افرنجي",
    "name": "حساب تاجر ذهب — merchant_settlement:الصافي->كسر افرنجي",
    "operationType": "merchant_weight_delivered",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "الصافي",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 7,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-2d42d6ff2dd929055241 | الصافي; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical custody decreases; ownership unchanged",
      "merchantLiability": "merchant metal liability decreases",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"الصافي\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-048",
    "approvedVariantId": "merchant_to_merchant_transfer:merchant_to_merchant_transfer:تيفيت الكسر->الخزنه",
    "sourceVariantId": "merchant_to_merchant_transfer:تيفيت الكسر->الخزنه",
    "name": "م ت — merchant_to_merchant_transfer:تيفيت الكسر->الخزنه",
    "operationType": "merchant_to_merchant_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ت",
      "debit": "تيفيت الكسر",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 6,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-9796b98432c101b1f3b9 | تيفيت الكسر",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-9796b98432c101b1f3b9 | تيفيت الكسر",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-9796b98432c101b1f3b9 | تيفيت الكسر",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-9796b98432c101b1f3b9 | تيفيت الكسر; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "no physical shop inventory movement",
      "merchantLiability": "decrease source merchant and increase destination merchant once",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ت\" AND debit == \"تيفيت الكسر\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-049",
    "approvedVariantId": "inventory_transformation:inventory_transformation:خاتم اطفال->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:خاتم اطفال->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:خاتم اطفال->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "خاتم اطفال",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 16,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-960d86a1b65899e364b7 | خاتم اطفال; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"خاتم اطفال\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-050",
    "approvedVariantId": "inventory_transformation:inventory_transformation:بريمه->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:بريمه->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:بريمه->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "بريمة",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 18,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d6d361a10f6d7735f5a2 | بريمة; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"بريمة\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-051",
    "approvedVariantId": "cash_transfer:cash_transfer:محمد السيد->الصافي",
    "sourceVariantId": "cash_transfer:محمد السيد->الصافي",
    "name": "حوالة — cash_transfer:محمد السيد->الصافي",
    "operationType": "cash_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حوالة",
      "debit": "محمد السيد",
      "credit": "الصافي"
    },
    "historicalDocumentCount": 6,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "cashCredit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "goldDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldCredit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "silverDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverCredit": "seed-account-2d42d6ff2dd929055241 | الصافي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-489f53a48f5f6fbf1207 | محمد السيد; Cr seed-account-2d42d6ff2dd929055241 | الصافي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حوالة\" AND debit == \"محمد السيد\" AND credit == \"الصافي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-052",
    "approvedVariantId": "merchant_workmanship_paid:merchant_settlement:محمد السيد->الخزنه",
    "sourceVariantId": "merchant_settlement:محمد السيد->الخزنه",
    "name": "حساب تاجر ذهب — merchant_settlement:محمد السيد->الخزنه",
    "operationType": "merchant_workmanship_paid",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "محمد السيد",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-489f53a48f5f6fbf1207 | محمد السيد; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "cash-balance workmanship liability/receivable decreases with cash paid",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"محمد السيد\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-053",
    "approvedVariantId": "customer_silver_purchase:customer_silver_purchase:سبيكه فضه->الخزنه",
    "sourceVariantId": "customer_silver_purchase:سبيكه فضه->الخزنه",
    "name": "شراء فضة — customer_silver_purchase:سبيكه فضه->الخزنه",
    "operationType": "customer_silver_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء فضة",
      "debit": "سبيكة فضة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-c870314995b4c233c0d7 | سبيكة فضة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-c870314995b4c233c0d7 | سبيكة فضة",
      "silverCredit": "canonical:metal-flow:silver:acquired | Silver Weight Acquired"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "Dr seed-account-c870314995b4c233c0d7 | سبيكة فضة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=Equivalent-21",
      "silver": "Dr seed-account-c870314995b4c233c0d7 | سبيكة فضة; Cr canonical:metal-flow:silver:acquired | Silver Weight Acquired; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cash cost to Silver Inventory Carrying Cost and WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId",
    "triggerConditions": "tx == \"شراء فضة\" AND debit == \"سبيكة فضة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-054",
    "approvedVariantId": "merchant_weight_delivered:merchant_settlement:سمير ناشد->كسر فضه",
    "sourceVariantId": "merchant_settlement:سمير ناشد->كسر فضه",
    "name": "حساب تاجر فضة — merchant_settlement:سمير ناشد->كسر فضه",
    "operationType": "merchant_weight_delivered",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر فضة",
      "debit": "سمير ناشد",
      "credit": "كسر فضة"
    },
    "historicalDocumentCount": 7,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "cashCredit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "goldDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldCredit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "silverDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverCredit": "seed-account-2da1e46de570300127c6 | كسر فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; Cr seed-account-2da1e46de570300127c6 | كسر فضة; amount=Equivalent-21",
      "silver": "Dr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; Cr seed-account-2da1e46de570300127c6 | كسر فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical custody decreases; ownership unchanged",
      "merchantLiability": "merchant metal liability decreases",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر فضة\" AND debit == \"سمير ناشد\" AND credit == \"كسر فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-055",
    "approvedVariantId": "operating_expense:operating_expense:كهرباء->الخزنه",
    "sourceVariantId": "operating_expense:كهرباء->الخزنه",
    "name": "م ا ع — operating_expense:كهرباء->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "كهرباء",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ddb2356201e5fb52fd03 | كهرباء",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-ddb2356201e5fb52fd03 | كهرباء",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-ddb2356201e5fb52fd03 | كهرباء",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-ddb2356201e5fb52fd03 | كهرباء; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"كهرباء\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-056",
    "approvedVariantId": "merchant_to_merchant_transfer:merchant_to_merchant_transfer:مكافئات->الخزنه",
    "sourceVariantId": "merchant_to_merchant_transfer:مكافئات->الخزنه",
    "name": "م ت — merchant_to_merchant_transfer:مكافئات->الخزنه",
    "operationType": "merchant_to_merchant_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ت",
      "debit": "مكافئات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "historical-name:مكافئات | مكافئات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "historical-name:مكافئات | مكافئات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "historical-name:مكافئات | مكافئات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr historical-name:مكافئات | مكافئات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "no physical shop inventory movement",
      "merchantLiability": "decrease source merchant and increase destination merchant once",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ت\" AND debit == \"مكافئات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-057",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->حلق عربي",
    "sourceVariantId": "customer_gold_sale:الخزنه->حلق عربي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->حلق عربي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "حلق عربي"
    },
    "historicalDocumentCount": 25,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-ff66eba547be9e799aba | حلق عربي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-ff66eba547be9e799aba | حلق عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"حلق عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-058",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:حلق عربي->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:حلق عربي->زياده الذهب",
    "name": "تسوية — inventory_adjustment:حلق عربي->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "حلق عربي",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ff66eba547be9e799aba | حلق عربي; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"حلق عربي\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-059",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->قفل فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->قفل فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->قفل فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "قفل فضة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-e27e33314fe25b6b461c | قفل فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-e27e33314fe25b6b461c | قفل فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-e27e33314fe25b6b461c | قفل فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-e27e33314fe25b6b461c | قفل فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"قفل فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-060",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->تونز",
    "sourceVariantId": "customer_gold_sale:الخزنه->تونز",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->تونز",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "تونز"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-60ed1f8a1341a1ab20be | تونز"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-60ed1f8a1341a1ab20be | تونز; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"تونز\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-061",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->غويش كيمك",
    "sourceVariantId": "customer_gold_sale:الخزنه->غويش كيمك",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->غويش كيمك",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "غويش كيمك"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-888be625b60c2a8405b9 | غويش كيمك"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-888be625b60c2a8405b9 | غويش كيمك; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"غويش كيمك\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-062",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الخزنه->الخزنه",
    "sourceVariantId": "inventory_adjustment:عجز الخزنه->الخزنه",
    "name": "تسوية — inventory_adjustment:عجز الخزنه->الخزنه",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الخزنة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 10,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f5ed138e3894dbfd5173 | عجز-الخزنة",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-f5ed138e3894dbfd5173 | عجز-الخزنة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-f5ed138e3894dbfd5173 | عجز-الخزنة",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-f5ed138e3894dbfd5173 | عجز-الخزنة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الخزنة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-063",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->غويش عربي",
    "sourceVariantId": "customer_gold_sale:الخزنه->غويش عربي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->غويش عربي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "غويش عربي"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-391695330f1733e03bb0 | غويش عربي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-391695330f1733e03bb0 | غويش عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"غويش عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-064",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->محبس",
    "sourceVariantId": "customer_gold_sale:الخزنه->محبس",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->محبس",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "محبس"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-dd24b4d1f062d92a3e80 | محبس"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-dd24b4d1f062d92a3e80 | محبس; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"محبس\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-065",
    "approvedVariantId": "operating_expense:operating_expense:تامينات->الخزنه",
    "sourceVariantId": "operating_expense:تامينات->الخزنه",
    "name": "م ا ع — operating_expense:تامينات->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "تامينات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-16491de2617a543e72ec | تامينات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-16491de2617a543e72ec | تامينات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-16491de2617a543e72ec | تامينات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-16491de2617a543e72ec | تامينات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"تامينات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-066",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->كسر افرنجي",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->كسر افرنجي",
    "name": "تسوية — inventory_adjustment:عجز الذهب->كسر افرنجي",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-067",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:دبله->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:دبله->زياده الذهب",
    "name": "تسوية — inventory_adjustment:دبله->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "دبلة",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-abefcfd780de9b384dc5 | دبلة; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"دبلة\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-068",
    "approvedVariantId": "operating_expense:operating_expense:منظفات->الخزنه",
    "sourceVariantId": "operating_expense:منظفات->الخزنه",
    "name": "م ا ع — operating_expense:منظفات->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "منظفات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d8c16ac6ed94d3d9169b | منظفات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-d8c16ac6ed94d3d9169b | منظفات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-d8c16ac6ed94d3d9169b | منظفات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-d8c16ac6ed94d3d9169b | منظفات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"منظفات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-069",
    "approvedVariantId": "merchant_weight_delivered:merchant_settlement:الصافي->كسر عربي",
    "sourceVariantId": "merchant_settlement:الصافي->كسر عربي",
    "name": "حساب تاجر ذهب — merchant_settlement:الصافي->كسر عربي",
    "operationType": "merchant_weight_delivered",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "الصافي",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 6,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-2d42d6ff2dd929055241 | الصافي; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical custody decreases; ownership unchanged",
      "merchantLiability": "merchant metal liability decreases",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"الصافي\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-070",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:خاتم عربي->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:خاتم عربي->زياده الذهب",
    "name": "تسوية — inventory_adjustment:خاتم عربي->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "خاتم عربي",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ea099bf0071894125ad3 | خاتم عربي; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"خاتم عربي\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-071",
    "approvedVariantId": "merchant_workmanship_paid:merchant_settlement:سمير ناشد->الخزنه",
    "sourceVariantId": "merchant_settlement:سمير ناشد->الخزنه",
    "name": "حساب تاجر فضة — merchant_settlement:سمير ناشد->الخزنه",
    "operationType": "merchant_workmanship_paid",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر فضة",
      "debit": "سمير ناشد",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "cash-balance workmanship liability/receivable decreases with cash paid",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر فضة\" AND debit == \"سمير ناشد\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-072",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:خاتم فضه->سمير ناشد",
    "sourceVariantId": "merchant_weight_received:خاتم فضه->سمير ناشد",
    "name": "تاجر فضة — merchant_weight_received:خاتم فضه->سمير ناشد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر فضة",
      "debit": "خاتم فضة",
      "credit": "سمير ناشد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "cashCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "goldCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "silverCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-feed1210d025ed84e443 | خاتم فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=cash",
      "gold": "Dr seed-account-feed1210d025ed84e443 | خاتم فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=Equivalent-21",
      "silver": "Dr seed-account-feed1210d025ed84e443 | خاتم فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver custody increases; ownership unchanged",
      "merchantLiability": "merchant silver physical g liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر فضة\" AND debit == \"خاتم فضة\" AND credit == \"سمير ناشد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-073",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:خاتم حريمي فضه->سمير ناشد",
    "sourceVariantId": "merchant_weight_received:خاتم حريمي فضه->سمير ناشد",
    "name": "تاجر فضة — merchant_weight_received:خاتم حريمي فضه->سمير ناشد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر فضة",
      "debit": "خاتم حريمي فضة",
      "credit": "سمير ناشد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "cashCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "goldCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "silverCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=cash",
      "gold": "Dr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=Equivalent-21",
      "silver": "Dr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver custody increases; ownership unchanged",
      "merchantLiability": "merchant silver physical g liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر فضة\" AND debit == \"خاتم حريمي فضة\" AND credit == \"سمير ناشد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-074",
    "approvedVariantId": "accessory_purchase:accessory_purchase:دبله تنجستين->الخزنه",
    "sourceVariantId": "accessory_purchase:دبله تنجستين->الخزنه",
    "name": "شراء ملحقات — accessory_purchase:دبله تنجستين->الخزنه",
    "operationType": "accessory_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء ملحقات",
      "debit": "دبلة تنجستين",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "canonical:asset:inventory-carrying-cost:accessories | Accessories Inventory Carrying Cost",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:asset:inventory-carrying-cost:accessories | Accessories Inventory Carrying Cost; Cr seed-account-43aee8a824522365db1a | الخزنة",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "accessory quantity increases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "add acquisition cost to Accessories WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,quantity,productId",
    "triggerConditions": "tx == \"شراء ملحقات\" AND debit == \"دبلة تنجستين\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-075",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:كسر عربي->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:كسر عربي->زياده الذهب",
    "name": "تسوية — inventory_adjustment:كسر عربي->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "كسر عربي",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"كسر عربي\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-076",
    "approvedVariantId": "operating_expense:operating_expense:تصليحات->الخزنه",
    "sourceVariantId": "operating_expense:تصليحات->الخزنه",
    "name": "م ا ع — operating_expense:تصليحات->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "تصليحات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cb807b0539abc1f4bda4 | تصليحات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-cb807b0539abc1f4bda4 | تصليحات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-cb807b0539abc1f4bda4 | تصليحات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-cb807b0539abc1f4bda4 | تصليحات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"تصليحات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-077",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->سبيكه فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->سبيكه فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->سبيكه فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "سبيكة فضة"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-c870314995b4c233c0d7 | سبيكة فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-c870314995b4c233c0d7 | سبيكة فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-c870314995b4c233c0d7 | سبيكة فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-c870314995b4c233c0d7 | سبيكة فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"سبيكة فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-078",
    "approvedVariantId": "inventory_transformation:inventory_transformation:تونز->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:تونز->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:تونز->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "تونز",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-60ed1f8a1341a1ab20be | تونز; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"تونز\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-079",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:كسر افرنجي->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:كسر افرنجي->زياده الذهب",
    "name": "تسوية — inventory_adjustment:كسر افرنجي->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "كسر افرنجي",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 5,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"كسر افرنجي\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-080",
    "approvedVariantId": "inventory_transformation:inventory_transformation:غويش عربي->كسر عربي",
    "sourceVariantId": "inventory_transformation:غويش عربي->كسر عربي",
    "name": "تيفيت — inventory_transformation:غويش عربي->كسر عربي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "غويش عربي",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-391695330f1733e03bb0 | غويش عربي; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"غويش عربي\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-081",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر افرنجي->خاتم حريمي",
    "sourceVariantId": "inventory_transfer:كسر افرنجي->خاتم حريمي",
    "name": "تحويل — inventory_transfer:كسر افرنجي->خاتم حريمي",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر افرنجي",
      "credit": "خاتم حريمي"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر افرنجي\" AND credit == \"خاتم حريمي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-082",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر عربي->حلق عربي",
    "sourceVariantId": "inventory_transfer:كسر عربي->حلق عربي",
    "name": "تحويل — inventory_transfer:كسر عربي->حلق عربي",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر عربي",
      "credit": "حلق عربي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "cashCredit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-ff66eba547be9e799aba | حلق عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr seed-account-ff66eba547be9e799aba | حلق عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر عربي\" AND credit == \"حلق عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-083",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر عربي->خاتم عربي",
    "sourceVariantId": "inventory_transfer:كسر عربي->خاتم عربي",
    "name": "تحويل — inventory_transfer:كسر عربي->خاتم عربي",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر عربي",
      "credit": "خاتم عربي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "cashCredit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-ea099bf0071894125ad3 | خاتم عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr seed-account-ea099bf0071894125ad3 | خاتم عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر عربي\" AND credit == \"خاتم عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-084",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:غويش عربي->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:غويش عربي->زياده الذهب",
    "name": "تسوية — inventory_adjustment:غويش عربي->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "غويش عربي",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-391695330f1733e03bb0 | غويش عربي; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"غويش عربي\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-085",
    "approvedVariantId": "merchant_to_merchant_transfer:merchant_to_merchant_transfer:انبوبه->الخزنه",
    "sourceVariantId": "merchant_to_merchant_transfer:انبوبه->الخزنه",
    "name": "م ت — merchant_to_merchant_transfer:انبوبه->الخزنه",
    "operationType": "merchant_to_merchant_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ت",
      "debit": "انبوبة",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-85a3cc904acd0392108c | انبوبة",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-85a3cc904acd0392108c | انبوبة",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-85a3cc904acd0392108c | انبوبة",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-85a3cc904acd0392108c | انبوبة; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "no physical shop inventory movement",
      "merchantLiability": "decrease source merchant and increase destination merchant once",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ت\" AND debit == \"انبوبة\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-086",
    "approvedVariantId": "customer_silver_sale:customer_silver_sale:الخزنه->خاتم حريمي فضه",
    "sourceVariantId": "customer_silver_sale:الخزنه->خاتم حريمي فضه",
    "name": "بيع فضة — customer_silver_sale:الخزنه->خاتم حريمي فضه",
    "operationType": "customer_silver_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع فضة",
      "debit": "الخزنة",
      "credit": "خاتم حريمي فضة"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:silver | Silver Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "silverDebit": "canonical:metal-flow:silver:sold | Silver Weight Sold",
      "silverCredit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:silver | Silver Sales Revenue; Dr canonical:expense:cogs:silver | Silver COGS; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; amount=Equivalent-21",
      "silver": "Dr canonical:metal-flow:silver:sold | Silver Weight Sold; Cr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Silver COGS / Cr Silver Inventory Carrying Cost at original pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "+Silver Sales Revenue",
      "expense": "+Silver COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalSilverWeight,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع فضة\" AND debit == \"الخزنة\" AND credit == \"خاتم حريمي فضة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-087",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:سلسله و تعليق->زياده الذهب",
    "sourceVariantId": "inventory_adjustment:سلسله و تعليق->زياده الذهب",
    "name": "تسوية — inventory_adjustment:سلسله و تعليق->زياده الذهب",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "سلسلة و تعليق",
      "credit": "زيادة-الذهب"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "cashCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "goldDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب",
      "silverDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverCredit": "seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-5e9ebb3b9ecd3b19ef2e | زيادة-الذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"سلسلة و تعليق\" AND credit == \"زيادة-الذهب\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-088",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->كسر عربي",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->كسر عربي",
    "name": "تسوية — inventory_adjustment:عجز الذهب->كسر عربي",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-089",
    "approvedVariantId": "customer_receipt:customer_receipt:الخزنه->دينا",
    "sourceVariantId": "customer_receipt:الخزنه->دينا",
    "name": "قبض من عميل — customer_receipt:الخزنه->دينا",
    "operationType": "customer_receipt",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "قبض من عميل",
      "debit": "الخزنة",
      "credit": "دينا"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-270cf265e18502736753 | دينا",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-270cf265e18502736753 | دينا",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-270cf265e18502736753 | دينا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-270cf265e18502736753 | دينا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"قبض من عميل\" AND debit == \"الخزنة\" AND credit == \"دينا\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-090",
    "approvedVariantId": "accessory_sale:accessory_sale:الخزنه->سيليكون",
    "sourceVariantId": "accessory_sale:الخزنه->سيليكون",
    "name": "بيع ملحقات — accessory_sale:الخزنه->سيليكون",
    "operationType": "accessory_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ملحقات",
      "debit": "الخزنة",
      "credit": "سيليكون"
    },
    "historicalDocumentCount": 8,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:accessories | Accessories Sales Revenue",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-34b151012e0aaea0e188 | سيليكون",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-34b151012e0aaea0e188 | سيليكون"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:accessories | Accessories Sales Revenue; Dr canonical:expense:cogs:accessories | Accessories COGS; Cr canonical:asset:inventory-carrying-cost:accessories | Accessories Inventory Carrying Cost",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "accessory quantity decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Accessories COGS / Cr Accessories Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus carrying cost",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,quantity,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ملحقات\" AND debit == \"الخزنة\" AND credit == \"سيليكون\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-091",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->خاتم اطفال",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->خاتم اطفال",
    "name": "تسوية — inventory_adjustment:عجز الذهب->خاتم اطفال",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "خاتم اطفال"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-960d86a1b65899e364b7 | خاتم اطفال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"خاتم اطفال\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-092",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر افرنجي->حلق اطفال",
    "sourceVariantId": "inventory_transfer:كسر افرنجي->حلق اطفال",
    "name": "تحويل — inventory_transfer:كسر افرنجي->حلق اطفال",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر افرنجي",
      "credit": "حلق اطفال"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-6b34c4189c5376f463c7 | حلق اطفال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر افرنجي\" AND credit == \"حلق اطفال\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-093",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:حلق حريمي->حلق اطفال",
    "sourceVariantId": "inventory_adjustment:حلق حريمي->حلق اطفال",
    "name": "تسوية — inventory_adjustment:حلق حريمي->حلق اطفال",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "حلق حريمي",
      "credit": "حلق اطفال"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "cashCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "goldDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "goldCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "silverDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "silverCredit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; Cr seed-account-6b34c4189c5376f463c7 | حلق اطفال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"حلق حريمي\" AND credit == \"حلق اطفال\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-094",
    "approvedVariantId": "inventory_transformation:inventory_transformation:غويش كيمك->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:غويش كيمك->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:غويش كيمك->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "غويش كيمك",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-888be625b60c2a8405b9 | غويش كيمك; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"غويش كيمك\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-095",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->بريمه",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->بريمه",
    "name": "تسوية — inventory_adjustment:عجز الذهب->بريمه",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "بريمة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-d6d361a10f6d7735f5a2 | بريمة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-d6d361a10f6d7735f5a2 | بريمة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"بريمة\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-096",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->اسوره و انسيال",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->اسوره و انسيال",
    "name": "تسوية — inventory_adjustment:عجز الذهب->اسوره و انسيال",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "اسورة و انسيال"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"اسورة و انسيال\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-097",
    "approvedVariantId": "customer_payment:customer_payment:شروق حبشي->الخزنه",
    "sourceVariantId": "customer_payment:شروق حبشي->الخزنه",
    "name": "دفع لعميل — customer_payment:شروق حبشي->الخزنه",
    "operationType": "customer_payment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "دفع لعميل",
      "debit": "شروق حبشي",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 4,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-61f9720fc889ad792d81 | شروق حبشي; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"دفع لعميل\" AND debit == \"شروق حبشي\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-098",
    "approvedVariantId": "fixed_asset_purchase:fixed_asset_purchase:مكنه عد نقديه->الخزنه",
    "sourceVariantId": "fixed_asset_purchase:مكنه عد نقديه->الخزنه",
    "name": "شراء اصل — fixed_asset_purchase:مكنه عد نقديه->الخزنه",
    "operationType": "fixed_asset_purchase",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "شراء اصل",
      "debit": "مكنة عد نقدية",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-8795e1c060b447797754 | مكنة عد نقدية",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-8795e1c060b447797754 | مكنة عد نقدية",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-8795e1c060b447797754 | مكنة عد نقدية",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-8795e1c060b447797754 | مكنة عد نقدية; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"شراء اصل\" AND debit == \"مكنة عد نقدية\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-099",
    "approvedVariantId": "merchant_weight_delivered:merchant_settlement:محمد السيد->كسر افرنجي",
    "sourceVariantId": "merchant_settlement:محمد السيد->كسر افرنجي",
    "name": "حساب تاجر ذهب — merchant_settlement:محمد السيد->كسر افرنجي",
    "operationType": "merchant_weight_delivered",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "محمد السيد",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-489f53a48f5f6fbf1207 | محمد السيد; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical custody decreases; ownership unchanged",
      "merchantLiability": "merchant metal liability decreases",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"محمد السيد\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-100",
    "approvedVariantId": "inventory_transfer:inventory_transfer:خاتم حريمي->تونز",
    "sourceVariantId": "inventory_transfer:خاتم حريمي->تونز",
    "name": "تحويل — inventory_transfer:خاتم حريمي->تونز",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "خاتم حريمي",
      "credit": "تونز"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "cashCredit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "goldDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "goldCredit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "silverDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverCredit": "seed-account-60ed1f8a1341a1ab20be | تونز"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; Cr seed-account-60ed1f8a1341a1ab20be | تونز; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"خاتم حريمي\" AND credit == \"تونز\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-101",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:الخزنه->زياده الخزنه",
    "sourceVariantId": "inventory_adjustment:الخزنه->زياده الخزنه",
    "name": "تسوية — inventory_adjustment:الخزنه->زياده الخزنه",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "الخزنة",
      "credit": "زيادة-الخزنة"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-fdc19fe855525ea8404f | زيادة-الخزنة",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-fdc19fe855525ea8404f | زيادة-الخزنة",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-fdc19fe855525ea8404f | زيادة-الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-fdc19fe855525ea8404f | زيادة-الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "costStatus=unresolved; excluded from confirmed-cost available WAC until audited Manual Cost Assignment",
      "profit": "none until cost assignment treatment is posted",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"الخزنة\" AND credit == \"زيادة-الخزنة\"",
    "fallbackPolicy": "require audited Manual Cost Assignment; reject zero cost and market price",
    "costStatus": "unresolved",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-102",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->محبس",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->محبس",
    "name": "تسوية — inventory_adjustment:عجز الذهب->محبس",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "محبس"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-dd24b4d1f062d92a3e80 | محبس"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-dd24b4d1f062d92a3e80 | محبس; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"محبس\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-103",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->دبله",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->دبله",
    "name": "تسوية — inventory_adjustment:عجز الذهب->دبله",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "دبلة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-abefcfd780de9b384dc5 | دبلة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-abefcfd780de9b384dc5 | دبلة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"دبلة\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-104",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر عربي->غويش عربي",
    "sourceVariantId": "inventory_transfer:كسر عربي->غويش عربي",
    "name": "تحويل — inventory_transfer:كسر عربي->غويش عربي",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر عربي",
      "credit": "غويش عربي"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "cashCredit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-391695330f1733e03bb0 | غويش عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr seed-account-391695330f1733e03bb0 | غويش عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر عربي\" AND credit == \"غويش عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-105",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر افرنجي->دبله",
    "sourceVariantId": "inventory_transfer:كسر افرنجي->دبله",
    "name": "تحويل — inventory_transfer:كسر افرنجي->دبله",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر افرنجي",
      "credit": "دبلة"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-abefcfd780de9b384dc5 | دبلة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-abefcfd780de9b384dc5 | دبلة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر افرنجي\" AND credit == \"دبلة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-106",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر افرنجي->اسوره و انسيال",
    "sourceVariantId": "inventory_transfer:كسر افرنجي->اسوره و انسيال",
    "name": "تحويل — inventory_transfer:كسر افرنجي->اسوره و انسيال",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر افرنجي",
      "credit": "اسورة و انسيال"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر افرنجي\" AND credit == \"اسورة و انسيال\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-107",
    "approvedVariantId": "personal_drawings:personal_drawings:legacy_direction_exception",
    "sourceVariantId": "personal_drawings:legacy_direction_exception",
    "name": "مسحوبات — personal_drawings:legacy_direction_exception",
    "operationType": "personal_drawings",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-81dfb31da7851f610d67225ba19157a8"
      ]
    },
    "historicalDocumentCount": 1,
    "status": "legacy_only",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-cbb3feca38a9c9b79877 | المسحوبات"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-cbb3feca38a9c9b79877 | المسحوبات; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash",
    "triggerConditions": "tx == \"مسحوبات\" AND debit == \"الخزنة\" AND credit == \"المسحوبات\" AND sourceOperationId IN (\"csvref-entry-81dfb31da7851f610d67225ba19157a8\")",
    "fallbackPolicy": "preserve historical row unchanged; never promote to production rule",
    "costStatus": "not_applicable",
    "decisionReference": "P21-02",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "legacy_direction_exception"
  },
  {
    "resolverId": "phase21-v1-108",
    "approvedVariantId": "inventory_transfer:inventory_transfer:كسر افرنجي->سلسله و تعليق",
    "sourceVariantId": "inventory_transfer:كسر افرنجي->سلسله و تعليق",
    "name": "تحويل — inventory_transfer:كسر افرنجي->سلسله و تعليق",
    "operationType": "inventory_transfer",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تحويل",
      "debit": "كسر افرنجي",
      "credit": "سلسلة و تعليق"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تحويل\" AND debit == \"كسر افرنجي\" AND credit == \"سلسلة و تعليق\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-109",
    "approvedVariantId": "inventory_transformation:inventory_transformation:محبس->كسر افرنجي",
    "sourceVariantId": "inventory_transformation:محبس->كسر افرنجي",
    "name": "تيفيت — inventory_transformation:محبس->كسر افرنجي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "محبس",
      "credit": "كسر افرنجي"
    },
    "historicalDocumentCount": 2,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "cashCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "goldCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "silverCredit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-dd24b4d1f062d92a3e80 | محبس; Cr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"محبس\" AND credit == \"كسر افرنجي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-110",
    "approvedVariantId": "customer_gold_sale:customer_gold_sale:الخزنه->سلسله عربي",
    "sourceVariantId": "customer_gold_sale:الخزنه->سلسله عربي",
    "name": "بيع ذهب — customer_gold_sale:الخزنه->سلسله عربي",
    "operationType": "customer_gold_sale",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "بيع ذهب",
      "debit": "الخزنة",
      "credit": "سلسلة عربي"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "canonical:revenue:sales:gold | Gold Sales Revenue",
      "goldDebit": "canonical:metal-flow:gold:sold | Gold Weight Sold",
      "goldCredit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr canonical:revenue:sales:gold | Gold Sales Revenue; Dr canonical:expense:cogs:gold | Gold COGS; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:sold | Gold Weight Sold; Cr seed-account-0979d99c4bdc04a58242 | سلسلة عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold decreases exactly once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "Dr Gold COGS / Cr Gold Inventory Carrying Cost at pre-sale WAC",
      "profit": "revenue minus original carrying cost; no duplicate inventory effect",
      "revenue": "+Gold Sales Revenue",
      "expense": "+Gold COGS",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension; cash,physicalWeight,goldEquivalent21Snapshot,productId; confirmedPreSaleWac",
    "triggerConditions": "tx == \"بيع ذهب\" AND debit == \"الخزنة\" AND credit == \"سلسلة عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-01,P21-07",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-111",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->سلسله عربي",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->سلسله عربي",
    "name": "تسوية — inventory_adjustment:عجز الذهب->سلسله عربي",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "سلسلة عربي"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-0979d99c4bdc04a58242 | سلسلة عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"سلسلة عربي\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-112",
    "approvedVariantId": "inventory_adjustment:inventory_adjustment:عجز الذهب->حلق مكرونه",
    "sourceVariantId": "inventory_adjustment:عجز الذهب->حلق مكرونه",
    "name": "تسوية — inventory_adjustment:عجز الذهب->حلق مكرونه",
    "operationType": "inventory_adjustment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تسوية",
      "debit": "عجز-الذهب",
      "credit": "حلق مكرونة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "cashCredit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "goldDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "goldCredit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "silverDebit": "seed-account-d118dcb73c852def05ff | عجز-الذهب",
      "silverCredit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d118dcb73c852def05ff | عجز-الذهب; Cr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "post measured weight/quantity difference once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "shortage removes inventory at current confirmed WAC and creates operating loss",
      "profit": "operating loss",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تسوية\" AND debit == \"عجز-الذهب\" AND credit == \"حلق مكرونة\"",
    "fallbackPolicy": "reject missing current WAC; no market price",
    "costStatus": "confirmed",
    "decisionReference": "P21-03",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-113",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:دبله فضه->سمير ناشد",
    "sourceVariantId": "merchant_weight_received:دبله فضه->سمير ناشد",
    "name": "تاجر فضة — merchant_weight_received:دبله فضه->سمير ناشد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر فضة",
      "debit": "دبلة فضة",
      "credit": "سمير ناشد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "cashCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "goldCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "silverCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-585a165916de021adb5a | دبلة فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=cash",
      "gold": "Dr seed-account-585a165916de021adb5a | دبلة فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=Equivalent-21",
      "silver": "Dr seed-account-585a165916de021adb5a | دبلة فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver custody increases; ownership unchanged",
      "merchantLiability": "merchant silver physical g liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر فضة\" AND debit == \"دبلة فضة\" AND credit == \"سمير ناشد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-114",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:سلسله و تعليق->محمد السيد",
    "sourceVariantId": "merchant_weight_received:سلسله و تعليق->محمد السيد",
    "name": "تاجر ذهب — merchant_weight_received:سلسله و تعليق->محمد السيد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "سلسلة و تعليق",
      "credit": "محمد السيد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"سلسلة و تعليق\" AND credit == \"محمد السيد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-115",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:دبله->محمد السيد",
    "sourceVariantId": "merchant_weight_received:دبله->محمد السيد",
    "name": "تاجر ذهب — merchant_weight_received:دبله->محمد السيد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "دبلة",
      "credit": "محمد السيد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-abefcfd780de9b384dc5 | دبلة; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "Dr seed-account-abefcfd780de9b384dc5 | دبلة; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"دبلة\" AND credit == \"محمد السيد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-116",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:حلق مكرونه->محمد السيد",
    "sourceVariantId": "merchant_weight_received:حلق مكرونه->محمد السيد",
    "name": "تاجر ذهب — merchant_weight_received:حلق مكرونه->محمد السيد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "حلق مكرونة",
      "credit": "محمد السيد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "Dr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"حلق مكرونة\" AND credit == \"محمد السيد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-117",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:خاتم حريمي->محمد السيد",
    "sourceVariantId": "merchant_weight_received:خاتم حريمي->محمد السيد",
    "name": "تاجر ذهب — merchant_weight_received:خاتم حريمي->محمد السيد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "خاتم حريمي",
      "credit": "محمد السيد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "Dr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"خاتم حريمي\" AND credit == \"محمد السيد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-118",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:حلق حريمي->محمد السيد",
    "sourceVariantId": "merchant_weight_received:حلق حريمي->محمد السيد",
    "name": "تاجر ذهب — merchant_weight_received:حلق حريمي->محمد السيد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر ذهب",
      "debit": "حلق حريمي",
      "credit": "محمد السيد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "Dr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "physical gold custody increases; ownership unchanged",
      "merchantLiability": "merchant gold E21 liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر ذهب\" AND debit == \"حلق حريمي\" AND credit == \"محمد السيد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-119",
    "approvedVariantId": "operating_expense:operating_expense:فرشه سلك->الخزنه",
    "sourceVariantId": "operating_expense:فرشه سلك->الخزنه",
    "name": "م ا ع — operating_expense:فرشه سلك->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "فرشة سلك",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-8ef1b51c2667532d1bb1 | فرشة سلك",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-8ef1b51c2667532d1bb1 | فرشة سلك",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-8ef1b51c2667532d1bb1 | فرشة سلك",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-8ef1b51c2667532d1bb1 | فرشة سلك; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"فرشة سلك\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-120",
    "approvedVariantId": "customer_payment:customer_payment:علا حسن->الخزنه",
    "sourceVariantId": "customer_payment:علا حسن->الخزنه",
    "name": "دفع لعميل — customer_payment:علا حسن->الخزنه",
    "operationType": "customer_payment",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "دفع لعميل",
      "debit": "علا حسن",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-98ece11ebca1119c54c0 | علا حسن",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-98ece11ebca1119c54c0 | علا حسن",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-98ece11ebca1119c54c0 | علا حسن",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-98ece11ebca1119c54c0 | علا حسن; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"دفع لعميل\" AND debit == \"علا حسن\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-121",
    "approvedVariantId": "operating_expense:operating_expense:نثريات->الخزنه",
    "sourceVariantId": "operating_expense:نثريات->الخزنه",
    "name": "م ا ع — operating_expense:نثريات->الخزنه",
    "operationType": "operating_expense",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "م ا ع",
      "debit": "نثريات",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-aa0d0320b43242eb34df | نثريات",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-aa0d0320b43242eb34df | نثريات",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-aa0d0320b43242eb34df | نثريات",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-aa0d0320b43242eb34df | نثريات; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"م ا ع\" AND debit == \"نثريات\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-122",
    "approvedVariantId": "merchant_weight_received:merchant_weight_received:سلسله حريمي فضه->سمير ناشد",
    "sourceVariantId": "merchant_weight_received:سلسله حريمي فضه->سمير ناشد",
    "name": "تاجر فضة — merchant_weight_received:سلسله حريمي فضه->سمير ناشد",
    "operationType": "merchant_weight_received",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تاجر فضة",
      "debit": "سلسلة حريمي فضة",
      "credit": "سمير ناشد"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "cashCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "goldCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "silverCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=cash",
      "gold": "Dr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=Equivalent-21",
      "silver": "Dr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "physical silver custody increases; ownership unchanged",
      "merchantLiability": "merchant silver physical g liability increases",
      "workmanship": "none",
      "cost": "none unless a separate ownership-changing event exists",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تاجر فضة\" AND debit == \"سلسلة حريمي فضة\" AND credit == \"سمير ناشد\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-123",
    "approvedVariantId": "inventory_transformation:inventory_transformation:سلسله عربي->كسر عربي",
    "sourceVariantId": "inventory_transformation:سلسله عربي->كسر عربي",
    "name": "تيفيت — inventory_transformation:سلسله عربي->كسر عربي",
    "operationType": "inventory_transformation",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "تيفيت",
      "debit": "سلسلة عربي",
      "credit": "كسر عربي"
    },
    "historicalDocumentCount": 3,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "cashCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldDebit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "goldCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverDebit": "seed-account-0979d99c4bdc04a58242 | سلسلة عربي",
      "silverCredit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-0979d99c4bdc04a58242 | سلسلة عربي; Cr seed-account-d1216eb4076ccdf40e20 | كسر عربي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "source decreases and destination increases by equal approved metal representation; total physical ownership unchanged",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "transfer exact source carrying cost; preserve total cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"تيفيت\" AND debit == \"سلسلة عربي\" AND credit == \"كسر عربي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "confirmed",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-124",
    "approvedVariantId": "customer_receipt:customer_receipt:الخزنه->شروق حبشي",
    "sourceVariantId": "customer_receipt:الخزنه->شروق حبشي",
    "name": "قبض من عميل — customer_receipt:الخزنه->شروق حبشي",
    "operationType": "customer_receipt",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "قبض من عميل",
      "debit": "الخزنة",
      "credit": "شروق حبشي"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-61f9720fc889ad792d81 | شروق حبشي"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-61f9720fc889ad792d81 | شروق حبشي; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"قبض من عميل\" AND debit == \"الخزنة\" AND credit == \"شروق حبشي\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-APPROVED",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-125",
    "approvedVariantId": "merchant_workmanship_paid:merchant_settlement:علاء صالح->الخزنه",
    "sourceVariantId": "merchant_settlement:علاء صالح->الخزنه",
    "name": "حساب تاجر ذهب — merchant_settlement:علاء صالح->الخزنه",
    "operationType": "merchant_workmanship_paid",
    "sourceClassification": "historical",
    "match": {
      "kind": "legacy_fields",
      "tx": "حساب تاجر ذهب",
      "debit": "علاء صالح",
      "credit": "الخزنة"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7571d7e7bb221110b615 | علاء صالح",
      "cashCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldDebit": "seed-account-7571d7e7bb221110b615 | علاء صالح",
      "goldCredit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverDebit": "seed-account-7571d7e7bb221110b615 | علاء صالح",
      "silverCredit": "seed-account-43aee8a824522365db1a | الخزنة"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-7571d7e7bb221110b615 | علاء صالح; Cr seed-account-43aee8a824522365db1a | الخزنة; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "cash-balance workmanship liability/receivable decreases with cash paid",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,date,debit,credit; positive amount for each used dimension",
    "triggerConditions": "tx == \"حساب تاجر ذهب\" AND debit == \"علاء صالح\" AND credit == \"الخزنة\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-126",
    "approvedVariantId": "opening_balance:opening:TX1561:csvref-entry-47c62a91de0419bc786b614892ee067f",
    "sourceVariantId": "opening:TX1561:csvref-entry-47c62a91de0419bc786b614892ee067f",
    "name": "قيد افتتاحي — opening:TX1561:csvref-entry-47c62a91de0419bc786b614892ee067f",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-47c62a91de0419bc786b614892ee067f"
      ],
      "legacyOperationNo": "TX1561"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-47c62a91de0419bc786b614892ee067f\" AND legacyOperationNo == \"TX1561\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-127",
    "approvedVariantId": "opening_balance:opening:TX20:csvref-entry-f80b1ad4b06ae6c01e83eace91525429",
    "sourceVariantId": "opening:TX20:csvref-entry-f80b1ad4b06ae6c01e83eace91525429",
    "name": "قيد افتتاحي — opening:TX20:csvref-entry-f80b1ad4b06ae6c01e83eace91525429",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-f80b1ad4b06ae6c01e83eace91525429"
      ],
      "legacyOperationNo": "TX20"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-e27e33314fe25b6b461c | قفل فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-e27e33314fe25b6b461c | قفل فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-e27e33314fe25b6b461c | قفل فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-e27e33314fe25b6b461c | قفل فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-f80b1ad4b06ae6c01e83eace91525429\" AND legacyOperationNo == \"TX20\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-128",
    "approvedVariantId": "opening_balance:opening:TX21:csvref-entry-33594b43f2603cff9e7d60828345d713",
    "sourceVariantId": "opening:TX21:csvref-entry-33594b43f2603cff9e7d60828345d713",
    "name": "قيد افتتاحي — opening:TX21:csvref-entry-33594b43f2603cff9e7d60828345d713",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-33594b43f2603cff9e7d60828345d713"
      ],
      "legacyOperationNo": "TX21"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-585a165916de021adb5a | دبلة فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-585a165916de021adb5a | دبلة فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-33594b43f2603cff9e7d60828345d713\" AND legacyOperationNo == \"TX21\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-129",
    "approvedVariantId": "opening_balance:opening:TX11:csvref-entry-6a7d0cee7c8fb070ad93a2cbbd4440d4",
    "sourceVariantId": "opening:TX11:csvref-entry-6a7d0cee7c8fb070ad93a2cbbd4440d4",
    "name": "قيد افتتاحي — opening:TX11:csvref-entry-6a7d0cee7c8fb070ad93a2cbbd4440d4",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-6a7d0cee7c8fb070ad93a2cbbd4440d4"
      ],
      "legacyOperationNo": "TX11"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-888be625b60c2a8405b9 | غويش كيمك",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-888be625b60c2a8405b9 | غويش كيمك; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-6a7d0cee7c8fb070ad93a2cbbd4440d4\" AND legacyOperationNo == \"TX11\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-130",
    "approvedVariantId": "opening_balance:opening:TX37:csvref-entry-9661be14b5c7148e5f1aa75eba0b3c49",
    "sourceVariantId": "opening:TX37:csvref-entry-9661be14b5c7148e5f1aa75eba0b3c49",
    "name": "قيد افتتاحي — opening:TX37:csvref-entry-9661be14b5c7148e5f1aa75eba0b3c49",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-9661be14b5c7148e5f1aa75eba0b3c49"
      ],
      "legacyOperationNo": "TX37"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-61d1858d6fa11a1b5e79 | الارباح و الخساير 2024 فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-61d1858d6fa11a1b5e79 | الارباح و الخساير 2024 فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-61d1858d6fa11a1b5e79 | الارباح و الخساير 2024 فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-61d1858d6fa11a1b5e79 | الارباح و الخساير 2024 فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-9661be14b5c7148e5f1aa75eba0b3c49\" AND legacyOperationNo == \"TX37\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-131",
    "approvedVariantId": "opening_balance:opening:TX1:csvref-entry-7496cb491f5653ca979a56898300bf8c",
    "sourceVariantId": "opening:TX1:csvref-entry-7496cb491f5653ca979a56898300bf8c",
    "name": "قيد افتتاحي — opening:TX1:csvref-entry-7496cb491f5653ca979a56898300bf8c",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-7496cb491f5653ca979a56898300bf8c"
      ],
      "legacyOperationNo": "TX1"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "cashCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "goldCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverDebit": "seed-account-43aee8a824522365db1a | الخزنة",
      "silverCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-43aee8a824522365db1a | الخزنة; Cr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-7496cb491f5653ca979a56898300bf8c\" AND legacyOperationNo == \"TX1\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-132",
    "approvedVariantId": "opening_balance:opening:TX38:csvref-entry-98ea93acdda5cb3a2ac17180bb5660c1",
    "sourceVariantId": "opening:TX38:csvref-entry-98ea93acdda5cb3a2ac17180bb5660c1",
    "name": "قيد افتتاحي — opening:TX38:csvref-entry-98ea93acdda5cb3a2ac17180bb5660c1",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-98ea93acdda5cb3a2ac17180bb5660c1"
      ],
      "legacyOperationNo": "TX38"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "cashCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "goldDebit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد",
      "silverDebit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverCredit": "seed-account-3d8e77044fc7a4db69fc | سمير ناشد"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-c06a92e1c390177ea90d | راس المال فضة; Cr seed-account-3d8e77044fc7a4db69fc | سمير ناشد; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-98ea93acdda5cb3a2ac17180bb5660c1\" AND legacyOperationNo == \"TX38\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-133",
    "approvedVariantId": "opening_balance:opening:TX12:csvref-entry-eafd19e0d96ff78debbd1382f2d520f1",
    "sourceVariantId": "opening:TX12:csvref-entry-eafd19e0d96ff78debbd1382f2d520f1",
    "name": "قيد افتتاحي — opening:TX12:csvref-entry-eafd19e0d96ff78debbd1382f2d520f1",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-eafd19e0d96ff78debbd1382f2d520f1"
      ],
      "legacyOperationNo": "TX12"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-d1216eb4076ccdf40e20 | كسر عربي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d1216eb4076ccdf40e20 | كسر عربي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-eafd19e0d96ff78debbd1382f2d520f1\" AND legacyOperationNo == \"TX12\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-134",
    "approvedVariantId": "opening_balance:opening:TX28:csvref-entry-b933ee71879ad729575ccded9ef256e3",
    "sourceVariantId": "opening:TX28:csvref-entry-b933ee71879ad729575ccded9ef256e3",
    "name": "قيد افتتاحي — opening:TX28:csvref-entry-b933ee71879ad729575ccded9ef256e3",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-b933ee71879ad729575ccded9ef256e3"
      ],
      "legacyOperationNo": "TX28"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-34b151012e0aaea0e188 | سيليكون",
      "cashCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "goldDebit": "seed-account-34b151012e0aaea0e188 | سيليكون",
      "goldCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "silverDebit": "seed-account-34b151012e0aaea0e188 | سيليكون",
      "silverCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-34b151012e0aaea0e188 | سيليكون; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=cash",
      "gold": "Dr seed-account-34b151012e0aaea0e188 | سيليكون; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-b933ee71879ad729575ccded9ef256e3\" AND legacyOperationNo == \"TX28\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-135",
    "approvedVariantId": "opening_balance:opening:TX4:csvref-entry-093987a0dd88e40d50621328d97ce85f",
    "sourceVariantId": "opening:TX4:csvref-entry-093987a0dd88e40d50621328d97ce85f",
    "name": "قيد افتتاحي — opening:TX4:csvref-entry-093987a0dd88e40d50621328d97ce85f",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-093987a0dd88e40d50621328d97ce85f"
      ],
      "legacyOperationNo": "TX4"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d37d8b76e6ed91e88626 | اسورة و انسيال; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-093987a0dd88e40d50621328d97ce85f\" AND legacyOperationNo == \"TX4\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-136",
    "approvedVariantId": "opening_balance:opening:TX29:csvref-entry-1f691e5cebb1a28084ae90328ed41586",
    "sourceVariantId": "opening:TX29:csvref-entry-1f691e5cebb1a28084ae90328ed41586",
    "name": "قيد افتتاحي — opening:TX29:csvref-entry-1f691e5cebb1a28084ae90328ed41586",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-1f691e5cebb1a28084ae90328ed41586"
      ],
      "legacyOperationNo": "TX29"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "cashCredit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "goldDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldCredit": "seed-account-2d42d6ff2dd929055241 | الصافي",
      "silverDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverCredit": "seed-account-2d42d6ff2dd929055241 | الصافي"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-35d2d47536f02061f01a | راس المال ذهب; Cr seed-account-2d42d6ff2dd929055241 | الصافي; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-1f691e5cebb1a28084ae90328ed41586\" AND legacyOperationNo == \"TX29\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-137",
    "approvedVariantId": "opening_balance:opening:TX39:csvref-entry-b15482d62746242f03b9e452414bf042",
    "sourceVariantId": "opening:TX39:csvref-entry-b15482d62746242f03b9e452414bf042",
    "name": "قيد افتتاحي — opening:TX39:csvref-entry-b15482d62746242f03b9e452414bf042",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-b15482d62746242f03b9e452414bf042"
      ],
      "legacyOperationNo": "TX39"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "cashCredit": "seed-account-07827f4cad300acf707b | الاء ياسر",
      "goldDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldCredit": "seed-account-07827f4cad300acf707b | الاء ياسر",
      "silverDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverCredit": "seed-account-07827f4cad300acf707b | الاء ياسر"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-35d2d47536f02061f01a | راس المال ذهب; Cr seed-account-07827f4cad300acf707b | الاء ياسر; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-b15482d62746242f03b9e452414bf042\" AND legacyOperationNo == \"TX39\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-138",
    "approvedVariantId": "opening_balance:opening:TX5:csvref-entry-bfae0ecd2737cb7bbf06c61dbb4be0d4",
    "sourceVariantId": "opening:TX5:csvref-entry-bfae0ecd2737cb7bbf06c61dbb4be0d4",
    "name": "قيد افتتاحي — opening:TX5:csvref-entry-bfae0ecd2737cb7bbf06c61dbb4be0d4",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-bfae0ecd2737cb7bbf06c61dbb4be0d4"
      ],
      "legacyOperationNo": "TX5"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-cb5d499baa26a3db6f1c | حلق حريمي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-cb5d499baa26a3db6f1c | حلق حريمي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-bfae0ecd2737cb7bbf06c61dbb4be0d4\" AND legacyOperationNo == \"TX5\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-139",
    "approvedVariantId": "opening_balance:opening:TX13:csvref-entry-14152ecfea586fb05b181f88ea22e789",
    "sourceVariantId": "opening:TX13:csvref-entry-14152ecfea586fb05b181f88ea22e789",
    "name": "قيد افتتاحي — opening:TX13:csvref-entry-14152ecfea586fb05b181f88ea22e789",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-14152ecfea586fb05b181f88ea22e789"
      ],
      "legacyOperationNo": "TX13"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-391695330f1733e03bb0 | غويش عربي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-391695330f1733e03bb0 | غويش عربي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-14152ecfea586fb05b181f88ea22e789\" AND legacyOperationNo == \"TX13\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-140",
    "approvedVariantId": "opening_balance:opening:TX30:csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc",
    "sourceVariantId": "opening:TX30:csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc",
    "name": "قيد افتتاحي — opening:TX30:csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc"
      ],
      "legacyOperationNo": "TX30"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "cashCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "goldDebit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "goldCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "silverDebit": "seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين",
      "silverCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=cash",
      "gold": "Dr seed-account-93c8c8cf9d87c00e1e88 | دبلة تنجستين; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-28cb29a01785ba9a31e6db2dbf79e8fc\" AND legacyOperationNo == \"TX30\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-141",
    "approvedVariantId": "opening_balance:opening:TX31:csvref-entry-369084c2cfc8efd74e8d03455e4f68bc",
    "sourceVariantId": "opening:TX31:csvref-entry-369084c2cfc8efd74e8d03455e4f68bc",
    "name": "قيد افتتاحي — opening:TX31:csvref-entry-369084c2cfc8efd74e8d03455e4f68bc",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-369084c2cfc8efd74e8d03455e4f68bc"
      ],
      "legacyOperationNo": "TX31"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-8d4a16e5eb12e1278df0 | حلق طبي",
      "cashCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "goldDebit": "seed-account-8d4a16e5eb12e1278df0 | حلق طبي",
      "goldCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات",
      "silverDebit": "seed-account-8d4a16e5eb12e1278df0 | حلق طبي",
      "silverCredit": "seed-account-e72dd9b338010096085c | راس المال ملحقات"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-8d4a16e5eb12e1278df0 | حلق طبي; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=cash",
      "gold": "Dr seed-account-8d4a16e5eb12e1278df0 | حلق طبي; Cr seed-account-e72dd9b338010096085c | راس المال ملحقات; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-369084c2cfc8efd74e8d03455e4f68bc\" AND legacyOperationNo == \"TX31\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-142",
    "approvedVariantId": "opening_balance:opening:TX6:csvref-entry-4025b0279bdddc10e2468c1e728eaa0e",
    "sourceVariantId": "opening:TX6:csvref-entry-4025b0279bdddc10e2468c1e728eaa0e",
    "name": "قيد افتتاحي — opening:TX6:csvref-entry-4025b0279bdddc10e2468c1e728eaa0e",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-4025b0279bdddc10e2468c1e728eaa0e"
      ],
      "legacyOperationNo": "TX6"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-60ed1f8a1341a1ab20be | تونز",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-60ed1f8a1341a1ab20be | تونز; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-4025b0279bdddc10e2468c1e728eaa0e\" AND legacyOperationNo == \"TX6\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-143",
    "approvedVariantId": "opening_balance:opening:TX32:csvref-entry-1e6df2f6329ed65ee36b5d20c9db1ca2",
    "sourceVariantId": "opening:TX32:csvref-entry-1e6df2f6329ed65ee36b5d20c9db1ca2",
    "name": "قيد افتتاحي — opening:TX32:csvref-entry-1e6df2f6329ed65ee36b5d20c9db1ca2",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-1e6df2f6329ed65ee36b5d20c9db1ca2"
      ],
      "legacyOperationNo": "TX32"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "cashCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "goldDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد",
      "silverDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverCredit": "seed-account-489f53a48f5f6fbf1207 | محمد السيد"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-35d2d47536f02061f01a | راس المال ذهب; Cr seed-account-489f53a48f5f6fbf1207 | محمد السيد; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-1e6df2f6329ed65ee36b5d20c9db1ca2\" AND legacyOperationNo == \"TX32\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-144",
    "approvedVariantId": "opening_balance:opening:TX14:csvref-entry-93b4b3b0b2fc77868ce6004874ab997b",
    "sourceVariantId": "opening:TX14:csvref-entry-93b4b3b0b2fc77868ce6004874ab997b",
    "name": "قيد افتتاحي — opening:TX14:csvref-entry-93b4b3b0b2fc77868ce6004874ab997b",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-93b4b3b0b2fc77868ce6004874ab997b"
      ],
      "legacyOperationNo": "TX14"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-d6d361a10f6d7735f5a2 | بريمة",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-d6d361a10f6d7735f5a2 | بريمة; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-93b4b3b0b2fc77868ce6004874ab997b\" AND legacyOperationNo == \"TX14\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-145",
    "approvedVariantId": "opening_balance:opening:TX15:csvref-entry-c29964c51a937f621bfdf7fef60149c0",
    "sourceVariantId": "opening:TX15:csvref-entry-c29964c51a937f621bfdf7fef60149c0",
    "name": "قيد افتتاحي — opening:TX15:csvref-entry-c29964c51a937f621bfdf7fef60149c0",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-c29964c51a937f621bfdf7fef60149c0"
      ],
      "legacyOperationNo": "TX15"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-ea099bf0071894125ad3 | خاتم عربي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ea099bf0071894125ad3 | خاتم عربي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-c29964c51a937f621bfdf7fef60149c0\" AND legacyOperationNo == \"TX15\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-146",
    "approvedVariantId": "opening_balance:opening:TX33:csvref-entry-cf2e53109ed958f4aed4c75db00dde86",
    "sourceVariantId": "opening:TX33:csvref-entry-cf2e53109ed958f4aed4c75db00dde86",
    "name": "قيد افتتاحي — opening:TX33:csvref-entry-cf2e53109ed958f4aed4c75db00dde86",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-cf2e53109ed958f4aed4c75db00dde86"
      ],
      "legacyOperationNo": "TX33"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "cashCredit": "seed-account-7571d7e7bb221110b615 | علاء صالح",
      "goldDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldCredit": "seed-account-7571d7e7bb221110b615 | علاء صالح",
      "silverDebit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverCredit": "seed-account-7571d7e7bb221110b615 | علاء صالح"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; Cr seed-account-7571d7e7bb221110b615 | علاء صالح; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-cf2e53109ed958f4aed4c75db00dde86\" AND legacyOperationNo == \"TX33\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-147",
    "approvedVariantId": "opening_balance:opening:TX2:csvref-entry-30b8602c9289c6aa322eaec9db1fb86a",
    "sourceVariantId": "opening:TX2:csvref-entry-30b8602c9289c6aa322eaec9db1fb86a",
    "name": "قيد افتتاحي — opening:TX2:csvref-entry-30b8602c9289c6aa322eaec9db1fb86a",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-30b8602c9289c6aa322eaec9db1fb86a"
      ],
      "legacyOperationNo": "TX2"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-960d86a1b65899e364b7 | خاتم اطفال",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-960d86a1b65899e364b7 | خاتم اطفال; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-30b8602c9289c6aa322eaec9db1fb86a\" AND legacyOperationNo == \"TX2\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-148",
    "approvedVariantId": "opening_balance:opening:TX7:csvref-entry-d0fe289402fc32937d6bc6302c361b09",
    "sourceVariantId": "opening:TX7:csvref-entry-d0fe289402fc32937d6bc6302c361b09",
    "name": "قيد افتتاحي — opening:TX7:csvref-entry-d0fe289402fc32937d6bc6302c361b09",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-d0fe289402fc32937d6bc6302c361b09"
      ],
      "legacyOperationNo": "TX7"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-6b34c4189c5376f463c7 | حلق اطفال",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-6b34c4189c5376f463c7 | حلق اطفال; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-d0fe289402fc32937d6bc6302c361b09\" AND legacyOperationNo == \"TX7\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-149",
    "approvedVariantId": "opening_balance:opening:TX16:csvref-entry-982b0a6bc0c05398f65d2570544c436b",
    "sourceVariantId": "opening:TX16:csvref-entry-982b0a6bc0c05398f65d2570544c436b",
    "name": "قيد افتتاحي — opening:TX16:csvref-entry-982b0a6bc0c05398f65d2570544c436b",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-982b0a6bc0c05398f65d2570544c436b"
      ],
      "legacyOperationNo": "TX16"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-8bc82f32572189c8e128 | سبيكة",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-8bc82f32572189c8e128 | سبيكة; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-982b0a6bc0c05398f65d2570544c436b\" AND legacyOperationNo == \"TX16\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-150",
    "approvedVariantId": "opening_balance:opening:TX8:csvref-entry-0dea861923f9e4a26369b33ab3dfaaff",
    "sourceVariantId": "opening:TX8:csvref-entry-0dea861923f9e4a26369b33ab3dfaaff",
    "name": "قيد افتتاحي — opening:TX8:csvref-entry-0dea861923f9e4a26369b33ab3dfaaff",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-0dea861923f9e4a26369b33ab3dfaaff"
      ],
      "legacyOperationNo": "TX8"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-dd24b4d1f062d92a3e80 | محبس",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-dd24b4d1f062d92a3e80 | محبس; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-0dea861923f9e4a26369b33ab3dfaaff\" AND legacyOperationNo == \"TX8\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-151",
    "approvedVariantId": "opening_balance:opening:TX9:csvref-entry-7a32c7e521a4c45d9ecdb64794c2e788",
    "sourceVariantId": "opening:TX9:csvref-entry-7a32c7e521a4c45d9ecdb64794c2e788",
    "name": "قيد افتتاحي — opening:TX9:csvref-entry-7a32c7e521a4c45d9ecdb64794c2e788",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-7a32c7e521a4c45d9ecdb64794c2e788"
      ],
      "legacyOperationNo": "TX9"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-7a7da1fd500bce293e8b | حلق مكرونة",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7a7da1fd500bce293e8b | حلق مكرونة; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-7a32c7e521a4c45d9ecdb64794c2e788\" AND legacyOperationNo == \"TX9\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-152",
    "approvedVariantId": "opening_balance:opening:TX22:csvref-entry-39887cceba2a8f8812a5a76833309ec0",
    "sourceVariantId": "opening:TX22:csvref-entry-39887cceba2a8f8812a5a76833309ec0",
    "name": "قيد افتتاحي — opening:TX22:csvref-entry-39887cceba2a8f8812a5a76833309ec0",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-39887cceba2a8f8812a5a76833309ec0"
      ],
      "legacyOperationNo": "TX22"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-feed1210d025ed84e443 | خاتم فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-feed1210d025ed84e443 | خاتم فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-39887cceba2a8f8812a5a76833309ec0\" AND legacyOperationNo == \"TX22\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-153",
    "approvedVariantId": "opening_balance:opening:TX17:csvref-entry-a2b4792111b9b4ce436a37f80767d8ab",
    "sourceVariantId": "opening:TX17:csvref-entry-a2b4792111b9b4ce436a37f80767d8ab",
    "name": "قيد افتتاحي — opening:TX17:csvref-entry-a2b4792111b9b4ce436a37f80767d8ab",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-a2b4792111b9b4ce436a37f80767d8ab"
      ],
      "legacyOperationNo": "TX17"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-3d2cf6d12174291e9009 | سلسلة و تعليق; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-a2b4792111b9b4ce436a37f80767d8ab\" AND legacyOperationNo == \"TX17\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-154",
    "approvedVariantId": "opening_balance:opening:TX34:csvref-entry-b9fe384dde373fe934295717e6909f94",
    "sourceVariantId": "opening:TX34:csvref-entry-b9fe384dde373fe934295717e6909f94",
    "name": "قيد افتتاحي — opening:TX34:csvref-entry-b9fe384dde373fe934295717e6909f94",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-b9fe384dde373fe934295717e6909f94"
      ],
      "legacyOperationNo": "TX34"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-259dbcb2148877affebd | تليفون ارضي",
      "cashCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldDebit": "seed-account-259dbcb2148877affebd | تليفون ارضي",
      "goldCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverDebit": "seed-account-259dbcb2148877affebd | تليفون ارضي",
      "silverCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-259dbcb2148877affebd | تليفون ارضي; Cr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-b9fe384dde373fe934295717e6909f94\" AND legacyOperationNo == \"TX34\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-155",
    "approvedVariantId": "opening_balance:opening:TX35:csvref-entry-42db28a2e75066a8fd24b92198efc484",
    "sourceVariantId": "opening:TX35:csvref-entry-42db28a2e75066a8fd24b92198efc484",
    "name": "قيد افتتاحي — opening:TX35:csvref-entry-42db28a2e75066a8fd24b92198efc484",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-42db28a2e75066a8fd24b92198efc484"
      ],
      "legacyOperationNo": "TX35"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-a36fb20e4aa7fa76198d | لابتوب",
      "cashCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldDebit": "seed-account-a36fb20e4aa7fa76198d | لابتوب",
      "goldCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverDebit": "seed-account-a36fb20e4aa7fa76198d | لابتوب",
      "silverCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-a36fb20e4aa7fa76198d | لابتوب; Cr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-42db28a2e75066a8fd24b92198efc484\" AND legacyOperationNo == \"TX35\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-156",
    "approvedVariantId": "opening_balance:opening:TX23:csvref-entry-6c1a23194bbb82b6ea74e84d2b5957b4",
    "sourceVariantId": "opening:TX23:csvref-entry-6c1a23194bbb82b6ea74e84d2b5957b4",
    "name": "قيد افتتاحي — opening:TX23:csvref-entry-6c1a23194bbb82b6ea74e84d2b5957b4",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-6c1a23194bbb82b6ea74e84d2b5957b4"
      ],
      "legacyOperationNo": "TX23"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-277ad17fa191c3353d9c | سلسلة رجالي فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-6c1a23194bbb82b6ea74e84d2b5957b4\" AND legacyOperationNo == \"TX23\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-157",
    "approvedVariantId": "opening_balance:opening:TX3:csvref-entry-b8324f23d7d3c5bd7592962f7654dc3c",
    "sourceVariantId": "opening:TX3:csvref-entry-b8324f23d7d3c5bd7592962f7654dc3c",
    "name": "قيد افتتاحي — opening:TX3:csvref-entry-b8324f23d7d3c5bd7592962f7654dc3c",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-b8324f23d7d3c5bd7592962f7654dc3c"
      ],
      "legacyOperationNo": "TX3"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-f7259c51816b3eca60b0 | خاتم حريمي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-f7259c51816b3eca60b0 | خاتم حريمي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-b8324f23d7d3c5bd7592962f7654dc3c\" AND legacyOperationNo == \"TX3\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-158",
    "approvedVariantId": "retained_gold_results_opening:tx42_retained_2025_gold",
    "sourceVariantId": "tx42_retained_2025_gold",
    "name": "قيد افتتاحي — tx42_retained_2025_gold",
    "operationType": "retained_gold_results_opening",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-3e1f9b1fe78247341d78529914239bba"
      ],
      "legacyOperationNo": "TX42"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "cashCredit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024",
      "goldDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldCredit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024",
      "silverDebit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverCredit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-35d2d47536f02061f01a | راس المال ذهب; Cr seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024; amount=16.20 g E21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-3e1f9b1fe78247341d78529914239bba\" AND legacyOperationNo == \"TX42\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "TX42-OWNER-2026-07-24",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "Historical stored name unchanged; semantic meaning: retained loss from 2025 transferred into 2026 opening."
  },
  {
    "resolverId": "phase21-v1-159",
    "approvedVariantId": "opening_balance:opening:TX24:csvref-entry-fc842cdc319ab883a07cae82b5b3fb37",
    "sourceVariantId": "opening:TX24:csvref-entry-fc842cdc319ab883a07cae82b5b3fb37",
    "name": "قيد افتتاحي — opening:TX24:csvref-entry-fc842cdc319ab883a07cae82b5b3fb37",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-fc842cdc319ab883a07cae82b5b3fb37"
      ],
      "legacyOperationNo": "TX24"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-5cce856398210bd05927 | خاتم حريمي فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-5cce856398210bd05927 | خاتم حريمي فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-fc842cdc319ab883a07cae82b5b3fb37\" AND legacyOperationNo == \"TX24\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-160",
    "approvedVariantId": "opening_balance:opening:TX36:csvref-entry-df313a7f8331c03288886daf2bfa23e0",
    "sourceVariantId": "opening:TX36:csvref-entry-df313a7f8331c03288886daf2bfa23e0",
    "name": "قيد افتتاحي — opening:TX36:csvref-entry-df313a7f8331c03288886daf2bfa23e0",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-df313a7f8331c03288886daf2bfa23e0"
      ],
      "legacyOperationNo": "TX36"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "cashCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "goldCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverDebit": "seed-account-61f9720fc889ad792d81 | شروق حبشي",
      "silverCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-61f9720fc889ad792d81 | شروق حبشي; Cr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-df313a7f8331c03288886daf2bfa23e0\" AND legacyOperationNo == \"TX36\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-161",
    "approvedVariantId": "opening_balance:opening:TX18:csvref-entry-b409864f20924429758c24fe9afb620d",
    "sourceVariantId": "opening:TX18:csvref-entry-b409864f20924429758c24fe9afb620d",
    "name": "قيد افتتاحي — opening:TX18:csvref-entry-b409864f20924429758c24fe9afb620d",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-b409864f20924429758c24fe9afb620d"
      ],
      "legacyOperationNo": "TX18"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-ff66eba547be9e799aba | حلق عربي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-ff66eba547be9e799aba | حلق عربي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-b409864f20924429758c24fe9afb620d\" AND legacyOperationNo == \"TX18\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-162",
    "approvedVariantId": "opening_balance:opening:TX10:csvref-entry-1b03499eb75f028991e8e3839433142a",
    "sourceVariantId": "opening:TX10:csvref-entry-1b03499eb75f028991e8e3839433142a",
    "name": "قيد افتتاحي — opening:TX10:csvref-entry-1b03499eb75f028991e8e3839433142a",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-1b03499eb75f028991e8e3839433142a"
      ],
      "legacyOperationNo": "TX10"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-abefcfd780de9b384dc5 | دبلة",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-abefcfd780de9b384dc5 | دبلة; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-1b03499eb75f028991e8e3839433142a\" AND legacyOperationNo == \"TX10\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-163",
    "approvedVariantId": "opening_balance:opening:TX19:csvref-entry-fcdb3b3251b4f26a1e329bfc6937517c",
    "sourceVariantId": "opening:TX19:csvref-entry-fcdb3b3251b4f26a1e329bfc6937517c",
    "name": "قيد افتتاحي — opening:TX19:csvref-entry-fcdb3b3251b4f26a1e329bfc6937517c",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-fcdb3b3251b4f26a1e329bfc6937517c"
      ],
      "legacyOperationNo": "TX19"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "cashCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "goldDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "goldCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب",
      "silverDebit": "seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي",
      "silverCredit": "seed-account-35d2d47536f02061f01a | راس المال ذهب"
    },
    "amountSources": {
      "cash": "none",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "Dr seed-account-7ac32db4e3484ce2dc22 | كسر افرنجي; Cr seed-account-35d2d47536f02061f01a | راس المال ذهب; amount=Equivalent-21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-fcdb3b3251b4f26a1e329bfc6937517c\" AND legacyOperationNo == \"TX19\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-164",
    "approvedVariantId": "opening_balance:opening:TX25:csvref-entry-1a9cade1308c36f5c382520b6ade558f",
    "sourceVariantId": "opening:TX25:csvref-entry-1a9cade1308c36f5c382520b6ade558f",
    "name": "قيد افتتاحي — opening:TX25:csvref-entry-1a9cade1308c36f5c382520b6ade558f",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-1a9cade1308c36f5c382520b6ade558f"
      ],
      "legacyOperationNo": "TX25"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-2da1e46de570300127c6 | كسر فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-2da1e46de570300127c6 | كسر فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-1a9cade1308c36f5c382520b6ade558f\" AND legacyOperationNo == \"TX25\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-165",
    "approvedVariantId": "opening_balance:opening:TX45:csvref-entry-95e0c76df90e5debe37d0ab174aa7f24",
    "sourceVariantId": "opening:TX45:csvref-entry-95e0c76df90e5debe37d0ab174aa7f24",
    "name": "قيد افتتاحي — opening:TX45:csvref-entry-95e0c76df90e5debe37d0ab174aa7f24",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-95e0c76df90e5debe37d0ab174aa7f24"
      ],
      "legacyOperationNo": "TX45"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024",
      "cashCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "goldDebit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024",
      "goldCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا",
      "silverDebit": "seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024",
      "silverCredit": "seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr seed-account-b99a05ac4c9416a5c6f6 | الارباح و الخساير 2024; Cr seed-account-5486ef1caa6f20ddfa37 | راس المال نقدا; amount=cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-95e0c76df90e5debe37d0ab174aa7f24\" AND legacyOperationNo == \"TX45\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-166",
    "approvedVariantId": "opening_balance:opening:TX26:csvref-entry-269dacd8d441b409ee8dd8a2494ed2eb",
    "sourceVariantId": "opening:TX26:csvref-entry-269dacd8d441b409ee8dd8a2494ed2eb",
    "name": "قيد افتتاحي — opening:TX26:csvref-entry-269dacd8d441b409ee8dd8a2494ed2eb",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-269dacd8d441b409ee8dd8a2494ed2eb"
      ],
      "legacyOperationNo": "TX26"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-733d11dcb5429d9b6bd3 | سلسلة حريمي فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-269dacd8d441b409ee8dd8a2494ed2eb\" AND legacyOperationNo == \"TX26\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-167",
    "approvedVariantId": "opening_balance:opening:TX27:csvref-entry-f06ddbc01f8524a5ba4c15f2323d793b",
    "sourceVariantId": "opening:TX27:csvref-entry-f06ddbc01f8524a5ba4c15f2323d793b",
    "name": "قيد افتتاحي — opening:TX27:csvref-entry-f06ddbc01f8524a5ba4c15f2323d793b",
    "operationType": "opening_balance",
    "sourceClassification": "historical",
    "match": {
      "kind": "source_operation",
      "sourceOperationIds": [
        "csvref-entry-f06ddbc01f8524a5ba4c15f2323d793b"
      ],
      "legacyOperationNo": "TX27"
    },
    "historicalDocumentCount": 1,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": false,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "seed-account-2a2cf06601c9f559a0df | ميدالية فضة",
      "cashCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "goldDebit": "seed-account-2a2cf06601c9f559a0df | ميدالية فضة",
      "goldCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة",
      "silverDebit": "seed-account-2a2cf06601c9f559a0df | ميدالية فضة",
      "silverCredit": "seed-account-c06a92e1c390177ea90d | راس المال فضة"
    },
    "amountSources": {
      "cash": "none",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "none",
      "gold": "none",
      "silver": "Dr seed-account-2a2cf06601c9f559a0df | ميدالية فضة; Cr seed-account-c06a92e1c390177ea90d | راس المال فضة; amount=physical silver g"
    },
    "approvedEffects": {
      "inventory": "opening physical inventory/quantity according to named product account; posted once",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "requires documented approved beginning-of-year carrying cost; never market price fallback",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "opening equity/retained result per exact historical account pair"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "sourceOperationId,legacyOperationNo,date,debit,credit and original dimension amount",
    "triggerConditions": "sourceOperationId == \"csvref-entry-f06ddbc01f8524a5ba4c15f2323d793b\" AND legacyOperationNo == \"TX27\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "unresolved",
    "decisionReference": "P21-06",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": ""
  },
  {
    "resolverId": "phase21-v1-168",
    "approvedVariantId": "sale_return:gold",
    "sourceVariantId": "gold",
    "name": "sale_return — gold",
    "operationType": "sale_return",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "sale_return",
      "variant": "gold"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "runtime-required:sale_return:gold:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:sale_return:gold:cash:credit | Approved runtime account resolution required",
      "goldDebit": "runtime-required:sale_return:gold:gold:debit | Approved runtime account resolution required",
      "goldCredit": "runtime-required:sale_return:gold:gold:credit | Approved runtime account resolution required",
      "silverDebit": "",
      "silverCredit": ""
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr canonical:revenue:sales:gold | Gold Sales Revenue; Cr cash/receivable; Dr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost; Cr canonical:expense:cogs:gold | Gold COGS",
      "gold": "Dr original product inventory; Cr canonical:metal-flow:gold:sold | Gold Weight Sold; original E21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "restore original cost, never current WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "originalOperationId,original revenue,original COGS,original physical weight,original E21",
    "triggerConditions": "operationType == \"sale_return\" AND variant == \"gold\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-04",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-169",
    "approvedVariantId": "sale_return:silver",
    "sourceVariantId": "silver",
    "name": "sale_return — silver",
    "operationType": "sale_return",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "sale_return",
      "variant": "silver"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "runtime-required:sale_return:silver:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:sale_return:silver:cash:credit | Approved runtime account resolution required",
      "goldDebit": "",
      "goldCredit": "",
      "silverDebit": "runtime-required:sale_return:silver:silver:debit | Approved runtime account resolution required",
      "silverCredit": "runtime-required:sale_return:silver:silver:credit | Approved runtime account resolution required"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr canonical:revenue:sales:silver | Silver Sales Revenue; Cr cash/receivable; Dr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost; Cr canonical:expense:cogs:silver | Silver COGS",
      "gold": "none",
      "silver": "Dr original product inventory; Cr canonical:metal-flow:silver:sold | Silver Weight Sold; original physical g"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "restore original cost, never current WAC",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "originalOperationId,original revenue,original COGS,original physical silver weight",
    "triggerConditions": "operationType == \"sale_return\" AND variant == \"silver\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-04",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-170",
    "approvedVariantId": "purchase_return:gold",
    "sourceVariantId": "gold",
    "name": "purchase_return — gold",
    "operationType": "purchase_return",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "purchase_return",
      "variant": "gold"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": true,
      "silver": false
    },
    "accounts": {
      "cashDebit": "runtime-required:purchase_return:gold:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:purchase_return:gold:cash:credit | Approved runtime account resolution required",
      "goldDebit": "runtime-required:purchase_return:gold:gold:debit | Approved runtime account resolution required",
      "goldCredit": "runtime-required:purchase_return:gold:gold:credit | Approved runtime account resolution required",
      "silverDebit": "",
      "silverCredit": ""
    },
    "amountSources": {
      "cash": "cash",
      "gold": "arabicWeight",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "Dr cash/payable; Cr canonical:asset:inventory-carrying-cost:gold | Gold Inventory Carrying Cost",
      "gold": "Dr canonical:metal-flow:gold:acquired | Gold Weight Acquired; Cr original product inventory; original E21",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "remove original linked purchase carrying cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "gold_e21",
    "karatHandling": "approved_e21_snapshot",
    "requiredFields": "originalOperationId,original acquisition cost,original physical weight,original E21",
    "triggerConditions": "operationType == \"purchase_return\" AND variant == \"gold\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-04",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-171",
    "approvedVariantId": "purchase_return:silver",
    "sourceVariantId": "silver",
    "name": "purchase_return — silver",
    "operationType": "purchase_return",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "purchase_return",
      "variant": "silver"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": true
    },
    "accounts": {
      "cashDebit": "runtime-required:purchase_return:silver:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:purchase_return:silver:cash:credit | Approved runtime account resolution required",
      "goldDebit": "",
      "goldCredit": "",
      "silverDebit": "runtime-required:purchase_return:silver:silver:debit | Approved runtime account resolution required",
      "silverCredit": "runtime-required:purchase_return:silver:silver:credit | Approved runtime account resolution required"
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "weight"
    },
    "approvedPostings": {
      "cash": "Dr cash/payable; Cr canonical:asset:inventory-carrying-cost:silver | Silver Inventory Carrying Cost",
      "gold": "none",
      "silver": "Dr canonical:metal-flow:silver:acquired | Silver Weight Acquired; Cr original product inventory; original physical g"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "remove original linked purchase carrying cost",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "silver_grams",
    "karatHandling": "not_applicable",
    "requiredFields": "originalOperationId,original acquisition cost,original physical silver weight",
    "triggerConditions": "operationType == \"purchase_return\" AND variant == \"silver\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-04",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-172",
    "approvedVariantId": "merchant_workmanship_received:explicit_business_account",
    "sourceVariantId": "explicit_business_account",
    "name": "merchant_workmanship_received — explicit_business_account",
    "operationType": "merchant_workmanship_received",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "merchant_workmanship_received",
      "variant": "explicit_business_account"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "runtime-required:merchant_workmanship_received:explicit_business_account:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:merchant_workmanship_received:explicit_business_account:cash:credit | Approved runtime account resolution required",
      "goldDebit": "",
      "goldCredit": "",
      "silverDebit": "",
      "silverCredit": ""
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "balanced cash posting against explicit merchant/business account",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "merchantId,cash,businessAccountId",
    "triggerConditions": "operationType == \"merchant_workmanship_received\" AND variant == \"explicit_business_account\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-173",
    "approvedVariantId": "merchant_cash_paid:explicit_business_account",
    "sourceVariantId": "explicit_business_account",
    "name": "merchant_cash_paid — explicit_business_account",
    "operationType": "merchant_cash_paid",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "merchant_cash_paid",
      "variant": "explicit_business_account"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "runtime-required:merchant_cash_paid:explicit_business_account:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:merchant_cash_paid:explicit_business_account:cash:credit | Approved runtime account resolution required",
      "goldDebit": "",
      "goldCredit": "",
      "silverDebit": "",
      "silverCredit": ""
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "balanced cash posting against explicit merchant/business account",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "merchantId,cash,businessAccountId",
    "triggerConditions": "operationType == \"merchant_cash_paid\" AND variant == \"explicit_business_account\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  },
  {
    "resolverId": "phase21-v1-174",
    "approvedVariantId": "merchant_cash_received:explicit_business_account",
    "sourceVariantId": "explicit_business_account",
    "name": "merchant_cash_received — explicit_business_account",
    "operationType": "merchant_cash_received",
    "sourceClassification": "design_only",
    "match": {
      "kind": "design_variant",
      "operationType": "merchant_cash_received",
      "variant": "explicit_business_account"
    },
    "historicalDocumentCount": 0,
    "status": "canonical_balanced",
    "dimensions": {
      "cash": true,
      "gold": false,
      "silver": false
    },
    "accounts": {
      "cashDebit": "runtime-required:merchant_cash_received:explicit_business_account:cash:debit | Approved runtime account resolution required",
      "cashCredit": "runtime-required:merchant_cash_received:explicit_business_account:cash:credit | Approved runtime account resolution required",
      "goldDebit": "",
      "goldCredit": "",
      "silverDebit": "",
      "silverCredit": ""
    },
    "amountSources": {
      "cash": "cash",
      "gold": "none",
      "silver": "none"
    },
    "approvedPostings": {
      "cash": "balanced cash posting against explicit merchant/business account",
      "gold": "none",
      "silver": "none"
    },
    "approvedEffects": {
      "inventory": "none",
      "merchantLiability": "none",
      "workmanship": "none",
      "cost": "none",
      "profit": "none",
      "revenue": "none",
      "expense": "none",
      "equity": "none"
    },
    "signHandling": "absolute_source_amount",
    "metalHandling": "none",
    "karatHandling": "not_applicable",
    "requiredFields": "merchantId,cash,businessAccountId",
    "triggerConditions": "operationType == \"merchant_cash_received\" AND variant == \"explicit_business_account\"",
    "fallbackPolicy": "reject; no balancing plug; no market-price cost fallback",
    "costStatus": "not_applicable",
    "decisionReference": "P21-05",
    "ruleSource": "Owner-approved Phase 2.1 decisions + Phase 2 source inventory",
    "notes": "design-only variant; historical document count = 0"
  }
] as const satisfies readonly CanonicalResolverDefinition[];
