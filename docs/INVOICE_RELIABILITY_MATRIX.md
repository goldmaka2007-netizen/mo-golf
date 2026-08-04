# Invoice Reliability Matrix

Date: 2026-08-04

| Supported scenario tested | Expected and observed dimensions | Result |
|---|---|---|
| Gold cash purchase | EGP + Gold; no Quantity/Silver | Pass |
| Gold credit purchase | EGP + Gold; no Quantity/Silver | Pass |
| Silver cash purchase | EGP + Silver; no Quantity/Gold | Pass |
| Silver credit purchase | EGP + Silver; no Quantity/Gold | Pass |
| Accessories cash purchase | EGP + Quantity; no Gold/Silver | Pass |
| Gold cash sale | EGP + Gold; generic piece count not projected | Pass |
| Gold credit sale | EGP + Gold; generic piece count not projected | Pass |
| Silver sale | EGP + Silver; generic piece count not projected | Pass |
| Accessories sale | EGP + Quantity; synced legacy weight not projected as Gold | Pass |
| Customer receipt | EGP only | Pass |
| Merchant payment | EGP only | Pass |
| Forbidden settlement quantity | Validation rejects posting | Pass |

Central pipeline fixtures additionally verified balanced financial projection, Treasury isolation, single revenue/COGS generation, inventory Book Value relief at WAC, merchant cash settlement without WAC movement, and a balanced Statement of Financial Position.

Returns and mixed-category invoices were not tested because this delivery did not establish them as supported UI operations.
