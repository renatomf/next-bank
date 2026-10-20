import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The password field's eye (week 8 plan, V2): the customer may look at what
// they typed; the field starts hidden and never suggests or corrects it.
void main() {
  Future<void> pumpField(WidgetTester tester, {bool obscureText = true}) =>
      tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(
            body: NbTextField(
              label: 'Senha',
              obscureText: obscureText,
              revealLabels: (show: 'Mostrar senha', hide: 'Ocultar senha'),
            ),
          ),
        ),
      );

  TextField field(WidgetTester tester) =>
      tester.widget<TextField>(find.byType(TextField));

  testWidgets('starts hidden, with a way to show it', (tester) async {
    await pumpField(tester);

    expect(field(tester).obscureText, isTrue);
    expect(find.bySemanticsLabel('Mostrar senha'), findsOneWidget);
  });

  testWidgets('shows and hides what was typed', (tester) async {
    await pumpField(tester);

    await tester.tap(find.bySemanticsLabel('Mostrar senha'));
    await tester.pump();
    expect(field(tester).obscureText, isFalse);
    expect(find.bySemanticsLabel('Ocultar senha'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Ocultar senha'));
    await tester.pump();
    expect(field(tester).obscureText, isTrue);
  });

  testWidgets('never suggests or corrects a shown password', (tester) async {
    await pumpField(tester);

    await tester.tap(find.bySemanticsLabel('Mostrar senha'));
    await tester.pump();

    expect(field(tester).enableSuggestions, isFalse);
    expect(field(tester).autocorrect, isFalse);
  });

  testWidgets('the eye is a 48 dp touch target', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpField(tester);

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    semantics.dispose();
  });

  testWidgets('a plain field has no eye', (tester) async {
    await pumpField(tester, obscureText: false);

    expect(find.bySemanticsLabel('Mostrar senha'), findsNothing);
  });
}
