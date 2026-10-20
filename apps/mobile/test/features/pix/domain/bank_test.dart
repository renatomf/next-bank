import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/bank.dart';

// The main banks and the search of the transfer by agency and account
// (v1.1.0 plan, task 4.9).
void main() {
  test('lists each bank once, with a three-digit code', () {
    final codes = mainBanks.map((bank) => bank.code).toList();

    expect(codes.toSet(), hasLength(codes.length));
    expect(codes, everyElement(matches(RegExp(r'^\d{3}$'))));
  });

  // Shown in a circle in place of the bank's logo, a third-party mark.
  test('gives each bank initials of up to three characters', () {
    expect(
      mainBanks.map((bank) => bank.initials),
      everyElement(matches(RegExp(r'^[A-Z0-9]{2,3}$'))),
    );
    expect(mainBanks.singleWhere((bank) => bank.code == '001').initials, 'BB');
  });

  test('keeps the public codes of the best-known banks', () {
    String codeOf(String name) =>
        mainBanks.singleWhere((bank) => bank.name == name).code;

    expect(codeOf('Banco do Brasil'), '001');
    expect(codeOf('Caixa Econômica Federal'), '104');
    expect(codeOf('Nubank'), '260');
  });

  test('finds banks by part of the name, whatever the case or accents', () {
    final found = searchBanks(mainBanks, 'itau');

    expect(found.map((bank) => bank.name), ['Itaú Unibanco']);
  });

  test('finds a bank by its code', () {
    final found = searchBanks(mainBanks, '260');

    expect(found.map((bank) => bank.name), ['Nubank']);
  });

  test('keeps every bank, in order, for a blank search', () {
    expect(searchBanks(mainBanks, '  '), mainBanks);
  });

  test('finds nothing for a name no bank has', () {
    expect(searchBanks(mainBanks, 'banco inexistente'), isEmpty);
  });
}
