import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The app's tabs (v1.1.0 plan, tasks 4.4 and 4.6): the labels, the accent
// line under the one that is on.
void main() {
  testWidgets('shows the labels and switches the controller', (tester) async {
    final controller = TabController(length: 2, vsync: const TestVSync());
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: NbTabBar(controller: controller, labels: const ['Um', 'Dois']),
        ),
      ),
    );

    await tester.tap(find.text('Dois'));
    await tester.pumpAndSettle();

    expect(controller.index, 1);
    final bar = tester.widget<TabBar>(find.byType(TabBar));
    expect(bar.indicatorColor, NbColors.dark.accent);
  });
}
