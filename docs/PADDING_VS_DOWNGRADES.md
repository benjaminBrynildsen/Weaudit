# Understanding Downgrades vs Padding

## The Three Finding Types

### 1. Non-PCI Fees
- **What**: Compliance penalty fees ($19.95-$99/month)
- **Cause**: Merchant hasn't completed PCI SAQ questionnaire
- **Detection**: Keyword matching (NON-PCI, PCI COMPLIANCE, etc.)
- **Status**: ✅ Fully implemented

### 2. Downgrades
- **What**: Transactions clearing at higher interchange tier due to missing data
- **Cause**: Missing zip code, tax amount, invoice number, delayed settlement, etc.
- **Detection**: Keyword matching against downgrade rule table
- **Status**: ✅ Almost complete

**Downgrade Rate Table Format:**
```
Name | Downgrade Rate | Description | Official Rate (Target)
V - Business T1 Product 1 | 2.65% | Missing Level II Information | 1.90%
```

- **Downgrade Rate (2.65%)**: What merchant pays when data is missing
- **Official Rate (1.90%)**: What merchant SHOULD pay if data was provided
- **Spread**: 0.75% (revenue lost due to missing data)

**Examples:**
- EIRF NON CPS = Missing zip code → 2.30% instead of 1.80%
- PRODUCT 1 = Missing Level II data → higher rate
- STANDARD = Delayed settlement → higher rate
- NON QUAL = Missing multiple fields → higher rate

### 3. Padding (Future Implementation)
- **What**: Processor inflating interchange rates to hide profit margin
- **Cause**: Resellers/ISOs adding markup on top of official interchange
- **Detection**: Compare charged rate vs official card network rate
- **Status**: ⏸️ Paused - Will implement later for reseller scenarios

**Example of Padding:**
```
Official Visa rate for qualified transaction: 1.51% + $0.10
Processor charges: 1.75% + $0.10
Padding: 0.24% (hidden markup in "interchange")
```

**Key Difference:**
- **Downgrade**: Wrong interchange tier (PRODUCT 1 instead of LEVEL 2) - merchant's fault
- **Padding**: Correct tier but inflated rate - processor's fault

---

## Current Implementation Status

### Downgrade Detection (Priority: Complete This)
- ✅ 80+ downgrade rules for Level II and Level III
- ✅ Keyword matching with processor aliases (CardConnect, Elavon, etc.)
- ✅ Revenue lost calculation (spread × volume)
- ✅ Gateway level filtering (L2 vs L3 rules)
- ⏳ **Need to verify**: All downgrade rules match CardConnect format

### Padding Detection (Priority: Later)
- ⚠️ Benchmark rates were guessed, not official
- ⚠️ Rate extraction from grid lines may be incorrect
- ⚠️ False positives detected (35% regulated debit clearly wrong)
- 🔜 **Defer until**: Downgrade detection is proven accurate
- 🔜 **Use case**: Reseller markup detection (not primary processor statements)

---

## Data Sources

### Downgrade Rates (Complete)
Source: Training data provided by user
Format: Name | Downgrade % | Description | Target %

**Level II Rules** (L2 merchants):
- EIRF, STANDARD, NON QUAL, PRODUCT 1, etc.
- ~40 rules for Visa and Mastercard

**Level III Rules** (L3 merchants):
- All L2 rules PLUS Level II/III specific downgrades
- ~40 rules for Visa and Mastercard

### Legitimate Interchange Rates (Needed for Padding)
Source: Official Visa/Mastercard interchange tables (TBD)
Categories needed:
- VI-BUSINESS CARD TR3 LEVEL 2 (qualified) = ???%
- MC-BUS LEVEL 2 DATA RATE II (qualified) = ???%
- VI-RETAIL P2 SIGN PREFERRED = ???%

**Note**: The "official rate" in downgrade tables (4th column) is what you SHOULD pay if you avoid the downgrade, but this may not be the same as the true card network interchange rate for properly qualified transactions.

---

## Next Steps

1. ✅ Complete downgrade detection
   - Verify all L2/L3 rules match CardConnect format
   - Test with PATRIOT FLOORING PDF
   - Confirm findings are accurate

2. ⏸️ Disable/comment out padding detection
   - Current benchmarks are inaccurate guesses
   - Causing false positives
   - Revisit after downgrade detection is proven

3. 🔜 Future: Implement padding detection
   - Get official Visa/MC interchange rate tables
   - Focus on reseller scenarios (not direct processor statements)
   - Implement only when we have accurate benchmark data

---

## Session Notes - 2026-02-12

**Confusion Resolved:**
- Initially thought downgrade table only had downgrade rates
- Actually: Column 4 is the "target" or "official" rate if data was correct
- Format: Name | Downgrade % | Description | Official %

**Current Focus:**
- Finish downgrade detection (almost done)
- Set aside padding detection for reseller markup scenarios later

**Padding Detection Issues Found:**
- 12 false positives detected with guessed benchmark rates
- Rate extraction from grid lines needs work (35% regulated debit clearly wrong)
- Need real card network interchange tables before implementing properly
