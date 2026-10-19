import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// An action chip with the look of the statement's filters (v1.1.0 plan,
// task 4.10): the assistant's agents, suggestions and "Escolher agente".
void main() {
  Future<void> pumpChip(WidgetTester tester, Widget chip) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(body: Center(child: chip)),
    ),
  );

  testWidgets('is read as a button by its label, without a selected state', (
    tester,
  ) async {
    var taps = 0;
    await pumpChip(
      tester,
      NbChip(
        label: 'Pedir ajuda',
        icon: Icons.help_outline,
        onPressed: () => taps++,
      ),
    );

    await tester.tap(find.bySemanticsLabel('Pedir ajuda'));

    expect(taps, 1);
    expect(
      tester.getSemantics(find.byType(NbChip)),
      isSemantics(label: 'Pedir ajuda', isButton: true, hasTapAction: true),
    );
    expect(find.byIcon(Icons.help_outline), findsOneWidget);
  });

  // "Escolher agente": a dropdown's arrow after the label.
  testWidgets('shows a trailing icon after the label', (tester) async {
    await pumpChip(
      tester,
      NbChip(
        label: 'Escolher agente',
        trailingIcon: Icons.expand_more,
        onPressed: () {},
      ),
    );

    final label = tester.getCenter(find.text('Escolher agente'));
    final arrow = tester.getCenter(find.byIcon(Icons.expand_more));
    expect(arrow.dx, greaterThan(label.dx));
  });

  testWidgets('looks like the filter pill: same height and border', (
    tester,
  ) async {
    await pumpChip(
      tester,
      Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          NbChip(label: 'Ação', onPressed: () {}),
          FilterPill(label: 'Filtro', selected: false, onPressed: () {}),
        ],
      ),
    );

    expect(
      // The pill holds a chip too: the first is the action chip alone.
      tester.getSize(find.byType(NbChip).first).height,
      tester.getSize(find.byType(FilterPill)).height,
    );
  });

  // Brief, section 8: a touch target of at least 48 (the accessibility test
  // caught the assistant's and the transfer's chips at 37).
  testWidgets('meets the touch target size', (tester) async {
    final handle = tester.ensureSemantics();
    await pumpChip(tester, NbChip(label: 'Pedir ajuda', onPressed: () {}));

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    handle.dispose();
  });
}
