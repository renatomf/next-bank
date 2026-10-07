import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(body: Center(child: child)),
);

// Small components the Home brings (brief, section 7; domain-model.md,
// section 11: skeleton and error states).
void main() {
  group('IconCircleButton', () {
    testWidgets('is a 44 circle that names its action to screen readers', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          IconCircleButton(
            icon: Icons.logout,
            label: 'Sair',
            onPressed: () => taps++,
          ),
        ),
      );

      await tester.tap(find.bySemanticsLabel('Sair'));

      expect(taps, 1);
      expect(
        tester.getSize(find.byType(IconCircleButton)),
        const Size.square(NbSize.touch),
      );
    });

    testWidgets('ignores taps when disabled', (tester) async {
      await tester.pumpWidget(
        host(
          const IconCircleButton(
            icon: Icons.logout,
            label: 'Sair',
            onPressed: null,
          ),
        ),
      );

      expect(
        tester.getSemantics(find.bySemanticsLabel('Sair')),
        isSemantics(isButton: true, isEnabled: false, hasEnabledState: true),
      );
    });
  });

  group('Skeleton', () {
    testWidgets('is a block of the given size, silent to screen readers', (
      tester,
    ) async {
      await tester.pumpWidget(host(const Skeleton(width: 120, height: 16)));

      expect(tester.getSize(find.byType(Skeleton)), const Size(120, 16));
      expect(
        find.descendant(
          of: find.byType(Skeleton),
          matching: find.byType(ExcludeSemantics),
        ),
        findsOneWidget,
      );
    });
  });

  group('ErrorState', () {
    testWidgets('says what failed and retries on tap', (tester) async {
      var retries = 0;
      await tester.pumpWidget(
        host(
          ErrorState(
            message: 'Não foi possível carregar seu saldo.',
            onRetry: () => retries++,
          ),
        ),
      );

      expect(find.text('Não foi possível carregar seu saldo.'), findsOneWidget);
      await tester.tap(find.text('Tentar de novo'));

      expect(retries, 1);
    });
  });
}
