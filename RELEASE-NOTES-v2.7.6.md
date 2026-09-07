# OmniHub v2.7.6 — optional customer names

- An optional customer name can be entered during a sale without creating a customer account.
- Blank names remain valid. Entered names are trimmed and saved as sale snapshots, including offline queues and synchronization.
- Custom and backdated sale forms accept the same optional name.
- Named sales show the name in transaction history and on thermal, A4 and A5 receipts.
- A successful sale clears the name for the next customer. Failed local saves retain the entry.
- Regression tests cover blank and named sales, storage, sync payloads, receipt escaping, field reset, and printer failure.

Install the platform-specific v2.7.6 update. Existing unnamed sales remain unchanged.

