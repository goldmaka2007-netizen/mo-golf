# Canonical Accounts Required — Phase 2.1

Design identifiers only. No account was created in Firestore and no Production Engine binding exists.

| Canonical ID | Purpose | Closing / settlement |
|---|---|---|
| `canonical:equity:retained-results:cash` | Retained Cash Results | Retained result by independent ledger dimension. |
| `canonical:equity:retained-results:gold` | Retained Gold Results | Retained result by independent ledger dimension. |
| `canonical:equity:retained-results:silver` | Retained Silver Results | Retained result by independent ledger dimension. |
| `canonical:asset:inventory-carrying-cost:gold` | Gold Inventory Carrying Cost | Inventory asset; relieved only to matching COGS or original-linked return. |
| `canonical:asset:inventory-carrying-cost:silver` | Silver Inventory Carrying Cost | Inventory asset; relieved only to matching COGS or original-linked return. |
| `canonical:asset:inventory-carrying-cost:accessories` | Accessories Inventory Carrying Cost | Inventory asset; relieved only to matching COGS or original-linked return. |
| `canonical:expense:cogs:gold` | Gold COGS | Closed through period profit/loss. |
| `canonical:expense:cogs:silver` | Silver COGS | Closed through period profit/loss. |
| `canonical:expense:cogs:accessories` | Accessories COGS | Closed through period profit/loss. |
| `canonical:revenue:sales:gold` | Gold Sales Revenue | Closed through period profit/loss. |
| `canonical:revenue:sales:silver` | Silver Sales Revenue | Closed through period profit/loss. |
| `canonical:revenue:sales:accessories` | Accessories Sales Revenue | Closed through period profit/loss. |
| `canonical:metal-flow:gold:acquired` | Gold Weight Acquired | Real commercial metal-flow counterpart; close annually to the matching Retained Gold/Silver Results account. |
| `canonical:metal-flow:gold:sold` | Gold Weight Sold | Real commercial metal-flow counterpart; close annually to the matching Retained Gold/Silver Results account. |
| `canonical:metal-flow:silver:acquired` | Silver Weight Acquired | Real commercial metal-flow counterpart; close annually to the matching Retained Gold/Silver Results account. |
| `canonical:metal-flow:silver:sold` | Silver Weight Sold | Real commercial metal-flow counterpart; close annually to the matching Retained Gold/Silver Results account. |

No Generic Clearing Account or Balancing Plug is proposed. Historical stored account names remain unchanged; semantic aliases are report metadata only.
