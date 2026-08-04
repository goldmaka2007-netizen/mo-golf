# Accounting Report Formatting Specification

Date: 2026-08-04

- EGP and Book Value: thousands separators, zero decimal digits; formatting never changes stored or aggregated precision.
- Gold and silver: exactly two decimal places in accounting tables and mobile Trial Balance cards.
- Accessories quantity: integers display without redundant decimals; accounts using a fractional quantityStep preserve up to three decimal places.
- Invalid numeric values: centralized formatters display a safe zero, never NaN or Infinity.
- Legitimate zero: displayed numerically in dimension-specific formatting instead of being confused with missing data.
- RTL/mobile: Trial Balance retains separate mobile cards, desktop horizontal scrolling, tabular numbers, and bottom safe-area spacing.

## Trial Balance gram price
The Arabic column `??? ??????` appears only for gold/silver inventory rows. It is derived from the same central projected Book Value and weight used by WAC reporting. Zero/invalid weight returns not-applicable; Treasury, customers, merchants, revenue, expenses, equity, and accessories receive no gram price. It is supporting information and never enters debit, credit, balance, or totals.
