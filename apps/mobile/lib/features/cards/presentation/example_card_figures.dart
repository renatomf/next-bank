/// The made-up figures of the cards screen (v1.1.0 plan, task 4.14): the
/// pre-approved credit, the invoice, the limit and the latest purchases, in
/// cents. They go away when the cards come from the server.
library;

/// The made-up pre-approved credit limit, in cents.
const int examplePreApprovedCents = 500000;

/// The made-up current invoice, in cents.
const int exampleInvoiceCents = 125040;

/// The made-up credit limit, in cents.
const int exampleCreditLimitCents = 500000;

/// The made-up invoice's due day.
const String exampleInvoiceDue = '10 nov';

/// One made-up purchase on the credit card.
typedef ExamplePurchase = ({String name, String date, int cents});

/// The made-up latest purchases.
const List<ExamplePurchase> examplePurchases = [
  (name: 'Streaming Exemplo', date: 'Hoje', cents: 3990),
  (name: 'Mercado Modelo', date: 'Ontem', cents: 15230),
  (name: 'Café Fictício', date: '17 out', cents: 1250),
];
