import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The filter pill (v1.1.0 plan, task 4.1). In the transfer's card (task
// 4.9), "Agência e conta" ran past a small phone's width at 1.3x text: on
// a narrow room the pill shrinks to fit, whole.
void main() {
  testWidgets('shrinks to fit a narrow room at 1.3x text', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 150,
              child: Align(
                alignment: Alignment.centerLeft,
                child: FilterPill(
                  label: 'Agência e conta',
                  icon: Icons.account_balance_outlined,
                  selected: false,
                  onPressed: () {},
                ),
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(FilterPill)).width, lessThan(151));
  });

  testWidgets('keeps its natural size in a list that scrolls sideways', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                FilterPill(label: 'Entrada', selected: true, onPressed: () {}),
              ],
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Entrada'), findsOneWidget);
  });
}
