/// The customer's number for a recharge, made up while recharges have no
/// backend (v1.1.0 plan, task 4.12).
const String examplePhone = '(11) 90000-0001';

/// One example recent recharge: the carrier's id and the number.
typedef ExampleRecentRecharge = ({String carrierId, String phone});

/// The recent recharges the screen shows: made-up numbers. They go away
/// when recharges come from the server (task 5).
const List<ExampleRecentRecharge> exampleRecentRecharges = [
  (carrierId: 'vivo', phone: '(11) 90000-0001'),
  (carrierId: 'tim', phone: '(11) 90000-0002'),
];
