/// A phone carrier a recharge can go to (v1.1.0 plan, task 4.12): its id,
/// its name and the initials shown in place of its logo, a third-party
/// mark.
final class Carrier {
  /// Creates the carrier.
  const new({required this.id, required this.name, required this.initials});

  /// A stable id, e.g. "vivo".
  final String id;

  /// The name customers know it by.
  final String name;

  /// Two or three letters, e.g. "VI".
  final String initials;
}

/// The phone carriers, in the order of the reference.
const List<Carrier> phoneCarriers = [
  Carrier(id: 'tim', name: 'TIM', initials: 'TIM'),
  Carrier(id: 'claro', name: 'Claro', initials: 'CL'),
  Carrier(id: 'vivo', name: 'Vivo', initials: 'VI'),
  Carrier(id: 'algar-cel', name: 'Algar Cel', initials: 'AC'),
  Carrier(id: 'algar-fixa', name: 'Algar Fixa', initials: 'AF'),
  Carrier(id: 'correios-cel', name: 'Correios Cel', initials: 'CO'),
  Carrier(id: 'sercomtel-cel', name: 'Sercomtel Cel', initials: 'SC'),
];

/// The carrier with [id], or null when there is none.
Carrier? carrierById(String id) {
  for (final carrier in phoneCarriers) {
    if (carrier.id == id) return carrier;
  }
  return null;
}

/// The recharge amounts offered, in cents: money is never a double.
const List<int> rechargeAmountsInCents = [
  2000,
  2500,
  3000,
  3500,
  4000,
  5000,
  10000,
];
