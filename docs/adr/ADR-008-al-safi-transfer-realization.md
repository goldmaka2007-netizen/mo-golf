# ADR-008 — Al-Safi Transfer-Hub Realization

**Status:** Active
**Date:** 2026-08-16
**Amends:** ADR-007 transfer rule for Al-Safi only

## Context

ADR-007 remains authoritative for ordinary merchant-to-merchant transfers: source Merchant WAC moves to the destination, inventory does not move, and the transfer creates no P&L. Al-Safi (`3zGclNk6qdAuNxM6y5iP`) is the application's single approved transfer hub and is not an ordinary merchant for transfer accounting.

## Decision

- Identify Al-Safi only by its stable Firestore account ID.
- Value both sides of an Al-Safi transfer from the immutable price saved on that exact transfer operation. Never use a current price or the beneficiary merchant's WAC as Al-Safi's basis.
- Release the beneficiary's old Merchant Metal carrying value and recognize the difference from the transfer invoice value as metal-specific Transfer Gain/Loss.
- Apply the same invoice value to Al-Safi. If Al-Safi crosses zero, release the closing quantity at Al-Safi's existing basis, recognize its difference from the matching invoice-price portion as Transfer Gain/Loss, and open only the excess at the invoice price.
- Exact zero leaves both signed quantity and signed carrying value at zero.
- A transfer moves no physical inventory and carries no workmanship. Transfer Gain/Loss remains separate from later physical merchant-settlement Gain/Loss.
- Gold and silver quantities, values, and result accounts remain isolated.
- If an Al-Safi transfer has no usable immutable saved price, rebuilding fails closed with an accounting diagnostic; it does not guess or use a live price.

## Presentation

Income Statement presentation uses distinct metal-specific lines:

- مكاسب فروق حوالات الذهب / خسائر فروق حوالات الذهب
- مكاسب فروق حوالات الفضة / خسائر فروق حوالات الفضة

These lines do not replace or merge with physical merchant-settlement Gain/Loss.

## Consequences

The transfer invoice value is the boundary between two possible realization stages: pre-transfer Merchant/Al-Safi carrying basis to invoice value on transfer date, then Al-Safi invoice basis to Inventory WAC only when inventory is physically delivered. This preserves the full economic difference without double counting.
