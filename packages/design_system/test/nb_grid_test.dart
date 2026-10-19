import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// A grid of equal columns (v1.1.0 plan, tasks 4.5, 4.12 and 4.13): the
// help's topics, the recharge amounts and the menu's cards.
void main() {
  Future<void> pumpGrid(WidgetTester tester, int count) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(
        body: SizedBox(
          width: 320,
          child: NbGrid(
            columns: 3,
            children: [
              for (var i = 0; i < count; i++)
                SizedBox(height: i == 1 ? 80 : 40, child: Text('$i')),
            ],
          ),
        ),
      ),
    ),
  );

  testWidgets('lays the children out three to a row, as wide each', (
    tester,
  ) async {
    await pumpGrid(tester, 5);

    final tops = [
      for (var i = 0; i < 5; i++) tester.getTopLeft(find.text('$i')).dy,
    ];
    expect(tops.sublist(0, 3).toSet(), hasLength(1));
    expect(tops.sublist(3).toSet(), hasLength(1));
    expect(tops[3], greaterThan(tops[0]));
    expect(
      tester.getSize(find.text('0')).width,
      tester.getSize(find.text('3')).width,
    );
  });

  // A short last row keeps the columns of the others.
  testWidgets('keeps the columns in a short last row', (tester) async {
    await pumpGrid(tester, 4);

    expect(
      tester.getTopLeft(find.text('3')).dx,
      tester.getTopLeft(find.text('0')).dx,
    );
    expect(
      tester.getSize(find.text('3')).width,
      tester.getSize(find.text('0')).width,
    );
  });

  // Cards of a row as tall as the tallest, as the menu's.
  testWidgets('makes a row as tall as its tallest child', (tester) async {
    await pumpGrid(tester, 3);

    expect(tester.getSize(find.text('0')).height, 80);
  });
}
