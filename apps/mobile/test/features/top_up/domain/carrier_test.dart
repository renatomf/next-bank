import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/top_up/domain/carrier.dart';

// The phone carriers a recharge can go to (v1.1.0 plan, task 4.12).
void main() {
  test('lists the carriers in order, each once', () {
    expect(phoneCarriers.map((carrier) => carrier.name), [
      'TIM',
      'Claro',
      'Vivo',
      'Algar Cel',
      'Algar Fixa',
      'Correios Cel',
      'Sercomtel Cel',
    ]);
    final ids = phoneCarriers.map((carrier) => carrier.id);
    expect(ids.toSet(), hasLength(ids.length));
  });

  // Shown in a circle in place of the carrier's logo, a third-party mark.
  test('gives each carrier initials of up to three characters', () {
    expect(
      phoneCarriers.map((carrier) => carrier.initials),
      everyElement(matches(RegExp(r'^[A-Z]{2,3}$'))),
    );
  });

  test('finds a carrier by its id', () {
    expect(carrierById('vivo')?.name, 'Vivo');
    expect(carrierById('unknown'), isNull);
  });

  // Money only in whole cents (CLAUDE.md, financial correctness).
  test('offers the recharge amounts in cents, in order', () {
    expect(rechargeAmountsInCents, [2000, 2500, 3000, 3500, 4000, 5000, 10000]);
  });
}
