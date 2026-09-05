| Modul | Method | Path | Permission | Roles |
| --- | --- | --- | --- | --- |
| auth | POST | `/auth/login` | `PUBLIC` |  |
| auth | POST | `/auth/logout` | `PUBLIC` |  |
| auth | GET | `/auth/me` | `AUTH_ONLY` |  |
| auth | POST | `/auth/refresh` | `PUBLIC` |  |
| branches | GET | `/branches` | `BRANCH_VIEW` |  |
| branches | POST | `/branches` | `BRANCH_CREATE` |  |
| branches | GET | `/branches/:id` | `BRANCH_VIEW` |  |
| branches | PATCH | `/branches/:id` | `BRANCH_EDIT` |  |
| branches | PATCH | `/branches/:id/product-availability` | `BRANCH_EDIT` |  |
| branches | PATCH | `/branches/:id/working-hours` | `BRANCH_EDIT` |  |
| cash-register | GET | `/cash-register/shift` | `SHIFT_VIEW_OWN` |  |
| cash-register | POST | `/cash-register/shift/:id/close` | `SHIFT_CLOSE` |  |
| cash-register | GET | `/cash-register/shift/:id/transactions` | `SHIFT_VIEW_OWN` |  |
| cash-register | POST | `/cash-register/shift/:id/transactions` | `CASH_TRANSACTION_CREATE` |  |
| cash-register | POST | `/cash-register/shift/open` | `SHIFT_OPEN` |  |
| core | GET | `/health` | `AUTH_ONLY` |  |
| customers | POST | `/customer/auth/logout` | `PUBLIC` |  |
| customers | GET | `/customer/auth/me` | `CUSTOMER_AUTH` |  |
| customers | POST | `/customer/auth/refresh` | `PUBLIC` |  |
| customers | POST | `/customer/auth/request-code` | `PUBLIC` |  |
| customers | POST | `/customer/auth/verify-code` | `PUBLIC` |  |
| customers | GET | `/customer/branches` | `PUBLIC` |  |
| customers | POST | `/customer/checkout/quote` | `CUSTOMER_AUTH` |  |
| customers | GET | `/customer/me/dashboard` | `CUSTOMER_AUTH` |  |
| customers | GET | `/customer/me/orders` | `CUSTOMER_AUTH` |  |
| customers | GET | `/customer/me/orders/:id` | `CUSTOMER_AUTH` |  |
| customers | GET | `/customer/menu/categories` | `PUBLIC` |  |
| customers | GET | `/customer/menu/products` | `PUBLIC` |  |
| customers | GET | `/customer/menu/products/:id` | `PUBLIC` |  |
| customers | POST | `/customer/orders` | `CUSTOMER_AUTH` |  |
| customers | GET | `/customers` | `CUSTOMER_VIEW` |  |
| customers | GET | `/customers/statistics` | `CUSTOMER_VIEW` |  |
| customers | GET | `/online-orders` | `ONLINE_ORDER_VIEW` |  |
| dashboard | GET | `/dashboard/summary` | `DASHBOARD_VIEW` |  |
| homepage | GET | `/customer/home` | `PUBLIC` |  |
| homepage | GET | `/homepage/hero-slides` | `HOMEPAGE_MANAGE` |  |
| homepage | POST | `/homepage/hero-slides` | `HOMEPAGE_MANAGE` |  |
| homepage | DELETE | `/homepage/hero-slides/:id` | `HOMEPAGE_MANAGE` |  |
| homepage | PATCH | `/homepage/hero-slides/:id` | `HOMEPAGE_MANAGE` |  |
| homepage | GET | `/homepage/promotions` | `HOMEPAGE_MANAGE` |  |
| homepage | POST | `/homepage/promotions` | `HOMEPAGE_MANAGE` |  |
| homepage | DELETE | `/homepage/promotions/:id` | `HOMEPAGE_MANAGE` |  |
| homepage | PATCH | `/homepage/promotions/:id` | `HOMEPAGE_MANAGE` |  |
| inventory | GET | `/inventory/cost` | `INVENTORY_VIEW` |  |
| inventory | POST | `/inventory/ingredients` | `INVENTORY_CREATE` |  |
| inventory | GET | `/inventory/movements` | `INVENTORY_VIEW` |  |
| inventory | POST | `/inventory/movements` | `INVENTORY_EDIT` |  |
| inventory | GET | `/inventory/stock` | `INVENTORY_VIEW` |  |
| inventory | POST | `/inventory/warehouses` | `INVENTORY_CREATE` |  |
| kitchen | GET | `/kitchen/orders` | `KITCHEN_VIEW` |  |
| kitchen | PATCH | `/kitchen/orders/:id/accept` | `KITCHEN_ACCEPT` |  |
| kitchen | PATCH | `/kitchen/orders/:id/cancel` | `KITCHEN_STATUS_UPDATE` |  |
| kitchen | PATCH | `/kitchen/orders/:id/complete` | `KITCHEN_STATUS_UPDATE` |  |
| kitchen | PATCH | `/kitchen/orders/:id/ready` | `KITCHEN_STATUS_UPDATE` |  |
| kitchen | PATCH | `/kitchen/orders/:id/start` | `KITCHEN_STATUS_UPDATE` |  |
| menu | GET | `/menu/categories` | `MENU_VIEW` |  |
| menu | POST | `/menu/categories` | `MENU_CREATE` |  |
| menu | DELETE | `/menu/categories/:id` | `MENU_DELETE` |  |
| menu | PATCH | `/menu/categories/:id` | `MENU_EDIT` |  |
| menu | POST | `/menu/modifiers` | `MENU_CREATE` |  |
| menu | GET | `/menu/products` | `MENU_VIEW` |  |
| menu | POST | `/menu/products` | `MENU_CREATE` |  |
| menu | DELETE | `/menu/products/:id` | `MENU_DELETE` |  |
| menu | GET | `/menu/products/:id` | `MENU_VIEW` |  |
| menu | PATCH | `/menu/products/:id` | `MENU_EDIT` |  |
| orders | GET | `/orders` | `ORDER_VIEW` |  |
| orders | POST | `/orders` | `ORDER_CREATE` |  |
| orders | GET | `/orders/:id` | `ORDER_VIEW` |  |
| orders | POST | `/orders/:id/items` | `ORDER_UPDATE` |  |
| orders | PATCH | `/orders/:id/items/:itemId` | `ORDER_UPDATE` |  |
| orders | PATCH | `/orders/:id/status` | `ORDER_SEND_KITCHEN` |  |
| orders | GET | `/pos/catalog` | `POS_USE` |  |
| orders | POST | `/pos/orders` | `POS_USE` |  |
| payments | POST | `/payments` | `PAYMENT_CREATE` |  |
| payments | POST | `/payments/process` | `PAYMENT_CREATE` |  |
| printers | GET | `/printers` | `RECEIPT_PRINT` |  |
| printers | POST | `/printers` | `RECEIPT_PRINT` |  |
| printers | PATCH | `/printers/:id` | `RECEIPT_PRINT` |  |
| receipts | GET | `/receipts/:id` | `RECEIPT_VIEW` |  |
| receipts | PATCH | `/receipts/:id/print` | `RECEIPT_PRINT` |  |
| receipts | GET | `/receipts/order/:orderId` | `RECEIPT_VIEW` |  |
| recipes | GET | `/recipes` | `INVENTORY_VIEW` |  |
| recipes | PUT | `/recipes` | `RECIPE_MANAGE` |  |
| recipes | GET | `/recipes/variants/:variantId` | `INVENTORY_VIEW` |  |
| reports | GET | `/reports/employees` | `REPORT_EMPLOYEES_VIEW` |  |
| reports | GET | `/reports/expenses` | `REPORT_EXPENSES_VIEW` |  |
| reports | GET | `/reports/products` | `REPORT_PRODUCTS_VIEW` |  |
| reports | GET | `/reports/sales` | `REPORT_SALES_VIEW` |  |
| reports | GET | `/reports/z` | `REPORT_SALES_VIEW` |  |
| roles | GET | `/permissions` | `PERMISSION_VIEW` |  |
| roles | GET | `/roles` | `ROLE_VIEW` |  |
| shifts | POST | `/shifts/:id/cash-transactions` | `CASH_TRANSACTION_CREATE` |  |
| shifts | POST | `/shifts/:id/close` | `SHIFT_CLOSE` |  |
| shifts | POST | `/shifts/open` | `SHIFT_OPEN` |  |
| staff | GET | `/staff` | `STAFF_VIEW` |  |
| staff | POST | `/staff` | `STAFF_CREATE` |  |
| staff | GET | `/staff/:id` | `STAFF_VIEW` |  |
| staff | PATCH | `/staff/:id` | `STAFF_UPDATE` |  |
| staff | POST | `/staff/:id/password-reset` | `STAFF_PASSWORD_RESET` |  |
| staff | PATCH | `/staff/:id/role` | `STAFF_ROLE_ASSIGN` |  |
| staff | PATCH | `/staff/:id/status` | `STAFF_STATUS_CHANGE` |  |
| staff | POST | `/staff/me/password` | `AUTH_ONLY` |  |
| suppliers | GET | `/suppliers` | `INVENTORY_VIEW` |  |
| suppliers | POST | `/suppliers` | `INVENTORY_CREATE` |  |
| suppliers | DELETE | `/suppliers/:id` | `INVENTORY_EDIT` |  |
| suppliers | PATCH | `/suppliers/:id` | `INVENTORY_EDIT` |  |
| tables | POST | `/halls` | `TABLE_CREATE` |  |
| tables | GET | `/tables` | `TABLE_VIEW` |  |
| tables | POST | `/tables` | `TABLE_CREATE` |  |
| tables | GET | `/tables/:id` | `TABLE_VIEW` |  |
| tables | POST | `/tables/:id/orders` | `ORDER_CREATE` |  |
| tables | PATCH | `/tables/:id/status` | `TABLE_EDIT` |  |
| tables | GET | `/waiter/orders` | `ORDER_VIEW` |  |
| telegram | POST | `/telegram/webhook/:secret` | `PUBLIC` |  |
| users | GET | `/users` | `USER_VIEW` |  |

JAMI ENDPOINT: 115

Permission bo'yicha: {
  "PUBLIC": 13,
  "AUTH_ONLY": 3,
  "BRANCH_VIEW": 2,
  "BRANCH_CREATE": 1,
  "BRANCH_EDIT": 3,
  "SHIFT_VIEW_OWN": 2,
  "SHIFT_CLOSE": 2,
  "CASH_TRANSACTION_CREATE": 2,
  "SHIFT_OPEN": 2,
  "CUSTOMER_AUTH": 6,
  "CUSTOMER_VIEW": 2,
  "ONLINE_ORDER_VIEW": 1,
  "DASHBOARD_VIEW": 1,
  "HOMEPAGE_MANAGE": 8,
  "INVENTORY_VIEW": 6,
  "INVENTORY_CREATE": 3,
  "INVENTORY_EDIT": 3,
  "KITCHEN_VIEW": 1,
  "KITCHEN_ACCEPT": 1,
  "KITCHEN_STATUS_UPDATE": 4,
  "MENU_VIEW": 3,
  "MENU_CREATE": 3,
  "MENU_DELETE": 2,
  "MENU_EDIT": 2,
  "ORDER_VIEW": 3,
  "ORDER_CREATE": 2,
  "ORDER_UPDATE": 2,
  "ORDER_SEND_KITCHEN": 1,
  "POS_USE": 2,
  "PAYMENT_CREATE": 2,
  "RECEIPT_PRINT": 4,
  "RECEIPT_VIEW": 2,
  "RECIPE_MANAGE": 1,
  "REPORT_EMPLOYEES_VIEW": 1,
  "REPORT_EXPENSES_VIEW": 1,
  "REPORT_PRODUCTS_VIEW": 1,
  "REPORT_SALES_VIEW": 2,
  "PERMISSION_VIEW": 1,
  "ROLE_VIEW": 1,
  "STAFF_VIEW": 2,
  "STAFF_CREATE": 1,
  "STAFF_UPDATE": 1,
  "STAFF_PASSWORD_RESET": 1,
  "STAFF_ROLE_ASSIGN": 1,
  "STAFF_STATUS_CHANGE": 1,
  "TABLE_CREATE": 2,
  "TABLE_VIEW": 2,
  "TABLE_EDIT": 1,
  "USER_VIEW": 1
}
