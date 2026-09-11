# OmniHub v2.7.8 — Priority sale allocations

Tithe is 10% of sale revenue (priority 1). Product/service cost is priority 2. The positive remaining balance is allocated to rent and utility bills 20%, growth 10%, repairs 10%, savings 20%, Day to Day 20%, and emergency 20%.

Cost of sale % is editable per product or service in the catalogue. Blank retains recorded purchase/component cost; 0 explicitly means zero cost. Rates are percentages of actual selling prices, including custom/trade prices. The backend captures the rate and exact line cost when the sale is first ingested, including offline sales when they sync. Subsequent catalogue changes do not rewrite captured costs. Existing sales retain their stored costs.

Allocations in the selected report period use this policy; they are planning reserves, not money transfers or extra recorded expenses. Period totals sum rounded sale allocations. Largest-remainder cent distribution ensures full reconciliation. Negative balances generate a shortfall and zero discretionary funds.

The portal, Android POS/Management shared UI and Windows P/L summary consume the same server-calculated figures. CSV reports include every fund. Owner-only finance access and manager/administrator catalogue editing are preserved.

Validation: database regression covers cent rounding, zero/negative remainders, access controls, aggregate reconciliation, cost snapshots, explicit zero and fallback costs. Browser tests cover actual report rendering, CSV mappings and product-specific editing. Native build status must be checked in GitHub Actions before treating a new installer/APK as released.
