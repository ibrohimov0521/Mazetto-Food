# MAZETTO FOOD Roadmap

This roadmap defines the approximate implementation order for MAZETTO FOOD. Large stages will later be split into very small Codex tasks.

1. Foundation — completed
2. Specification freeze — current
3. Git/GitHub baseline
4. Production/Dokploy deployment foundation
5. Design System
6. Database domain architecture
7. Branches / employees / roles
8. Menu management
9. POS order foundation
10. POS cart/order editing
11. Payments
12. Customer Web
13. Telegram authentication
14. Checkout/delivery/pickup
15. Central Order Engine
16. Realtime orders
17. Telegram ordering/admin notifications
18. Print Agent
19. Printer reliability
20. Shifts
21. Business Day closing
22. Admin dashboard
23. Reporting
24. Finance
25. Kitchen Display
26. Audit system
27. Advanced integrations
28. Production hardening

## Roadmap Rules

Each stage should preserve the central architecture:

- one backend
- one database
- shared domain rules
- no duplicate order engines
- auditable financial history
- multi-branch readiness
- responsive interfaces

No large stage should be implemented as one oversized task. Each major item must be broken into focused, reviewable steps before code is written.
