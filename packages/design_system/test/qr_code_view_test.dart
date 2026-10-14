import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The QR Code of the Receber screen (v1.1.0 plan, task 3): the matrix comes
// from the `qr` package and is drawn here, dark on white in both themes.
const _code =
    '00020126580014br.gov.bcb.pix0136'
    '11111111-2222-4333-8444-5555555555555204000053039865802BR'
    '5910BRUNO LIMA6009SAO PAULO62070503***6304ABCD';

void main() {
  Future<void> pumpCode(WidgetTester tester, {ThemeData? theme}) =>
      tester.pumpWidget(
        MaterialApp(
          theme: theme ?? NbTheme.dark(),
          home: const Scaffold(
            body: Center(
              child: QrCodeView(
                data: _code,
                semanticLabel: 'QR Code do Pix',
                size: 240,
              ),
            ),
          ),
        ),
      );

  testWidgets('takes the size asked, as a square', (tester) async {
    await pumpCode(tester);

    expect(tester.getSize(find.byType(QrCodeView)), const Size(240, 240));
  });

  testWidgets('is read by its label, never by its content', (tester) async {
    await pumpCode(tester);

    expect(find.bySemanticsLabel('QR Code do Pix'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('br.gov.bcb.pix')), findsNothing);
  });

  testWidgets('draws in both themes', (tester) async {
    await pumpCode(tester, theme: NbTheme.light());

    expect(tester.takeException(), isNull);
  });

  test('keeps dark modules on white, whatever the theme', () {
    expect(QrCodeView.dark, const Color(0xFF000000));
    expect(QrCodeView.light, const Color(0xFFFFFFFF));
  });

  group('qrModules', () {
    test('is a square matrix of a QR Code version (17 + 4 per version)', () {
      final modules = qrModules(_code);

      expect((modules.length - 17) % 4, 0);
      expect(modules.every((row) => row.length == modules.length), isTrue);
    });

    // The three finder squares: a dark ring of 7 with a dark center of 3.
    test('has the finder squares in three corners', () {
      final modules = qrModules(_code);
      final last = modules.length - 7;

      for (final (top, left) in [(0, 0), (0, last), (last, 0)]) {
        for (var i = 0; i < 7; i++) {
          expect(modules[top][left + i], isTrue);
          expect(modules[top + 6][left + i], isTrue);
          expect(modules[top + i][left], isTrue);
          expect(modules[top + i][left + 6], isTrue);
        }
        expect(modules[top + 1][left + 1], isFalse);
        expect(modules[top + 3][left + 3], isTrue);
      }
    });

    test('is the same for the same text', () {
      expect(qrModules(_code), qrModules(_code));
    });
  });
}
