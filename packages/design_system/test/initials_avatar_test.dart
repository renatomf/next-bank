import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Initials in a circle, in place of a third party's logo (v1.1.0 plan,
// tasks 4.9 and 4.12): banks and phone carriers.
void main() {
  Future<void> pumpAvatar(WidgetTester tester, String initials) =>
      tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(
            body: Center(child: InitialsAvatar(initials: initials)),
          ),
        ),
      );

  testWidgets('shows the initials in a circle, out of screen readers', (
    tester,
  ) async {
    await pumpAvatar(tester, 'BB');

    expect(find.text('BB'), findsOneWidget);
    expect(tester.getSize(find.byType(InitialsAvatar)), const Size(40, 40));
    expect(find.bySemanticsLabel('BB'), findsNothing);
  });

  testWidgets('fits three characters in the circle', (tester) async {
    await pumpAvatar(tester, 'BTG');

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.text('BTG')).width, lessThanOrEqualTo(40));
  });
}
