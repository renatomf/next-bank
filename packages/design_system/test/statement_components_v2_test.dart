import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(20), child: child),
  ),
);

// The redesigned statement (v1.1.0 plan, task 4.1): the balance card in the
// glass style with its actions, and the filter pills.
void main() {
  group('FilterPill', () {
    Future<void> pump(
      WidgetTester tester, {
      required bool selected,
      VoidCallback? onPressed,
    }) => tester.pumpWidget(
      host(
        Align(
          alignment: Alignment.topLeft,
          child: FilterPill(
            label: 'Entrada',
            icon: Icons.south_west,
            selected: selected,
            onPressed: onPressed ?? () {},
          ),
        ),
      ),
    );

    testWidgets('shows its icon and label while off', (tester) async {
      await pump(tester, selected: false);

      expect(find.byIcon(Icons.south_west), findsOneWidget);
      expect(find.byIcon(Icons.check), findsNothing);
      expect(
        tester.getSemantics(find.byType(FilterPill)),
        isSemantics(isSelected: false),
      );
    });

    testWidgets('takes a check and says it is selected while on', (
      tester,
    ) async {
      await pump(tester, selected: true);

      expect(find.byIcon(Icons.check), findsOneWidget);
      expect(find.byIcon(Icons.south_west), findsNothing);
      expect(
        tester.getSemantics(find.byType(FilterPill)),
        isSemantics(isSelected: true),
      );
    });

    testWidgets('turns on and off on a tap', (tester) async {
      var taps = 0;
      await pump(tester, selected: false, onPressed: () => taps++);

      await tester.tap(find.bySemanticsLabel('Entrada'));

      expect(taps, 1);
    });
  });
}
