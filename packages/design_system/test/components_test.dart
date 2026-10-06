import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(20), child: child),
  ),
);

void main() {
  group('PrimaryButton', () {
    testWidgets('runs the action on tap', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(PrimaryButton(label: 'Entrar', onPressed: () => taps++)),
      );

      await tester.tap(find.byType(PrimaryButton));

      expect(taps, 1);
    });

    testWidgets('ignores taps while loading: no double submit', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          PrimaryButton(
            label: 'Entrar',
            onPressed: () => taps++,
            loading: true,
          ),
        ),
      );

      await tester.tap(find.byType(PrimaryButton));
      await tester.tap(find.byType(PrimaryButton));

      expect(taps, 0);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('is 56 high and reads its label to screen readers', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(PrimaryButton(label: 'Entrar', onPressed: () {})),
      );

      expect(tester.getSize(find.byType(PrimaryButton)).height, NbSize.button);
      expect(find.bySemanticsLabel('Entrar'), findsOneWidget);
    });

    List<BoxShadow>? glowOf(WidgetTester tester) {
      final box = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(PrimaryButton),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      return (box.decoration as ShapeDecoration).shadows;
    }

    testWidgets('glows in mint while it can be pressed (mockups)', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(PrimaryButton(label: 'Entrar', onPressed: () {})),
      );

      expect(glowOf(tester)?.single.color, NbBrand.actionGlow);
    });

    testWidgets('does not glow when disabled', (tester) async {
      await tester.pumpWidget(
        host(const PrimaryButton(label: 'Entrar', onPressed: null)),
      );

      expect(glowOf(tester), isNull);
    });
  });

  group('NbTextField', () {
    testWidgets('shows its label and the error as text', (tester) async {
      await tester.pumpWidget(
        host(const NbTextField(label: 'E-mail', errorText: 'E-mail inválido.')),
      );

      expect(find.text('E-mail'), findsOneWidget);
      expect(find.text('E-mail inválido.'), findsOneWidget);
    });

    testWidgets('labels the field in the muted body style (mockups)', (
      tester,
    ) async {
      await tester.pumpWidget(host(const NbTextField(label: 'E-mail')));

      final style = tester.widget<Text>(find.text('E-mail')).style!;
      expect(style.fontSize, NbType.bodyText.fontSize);
      expect(style.color, NbColors.dark.textMuted);
    });

    testWidgets('never suggests or corrects hidden text', (tester) async {
      await tester.pumpWidget(
        host(const NbTextField(label: 'Senha', obscureText: true)),
      );

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.obscureText, isTrue);
      expect(field.enableSuggestions, isFalse);
      expect(field.autocorrect, isFalse);
    });
  });

  group('PinField', () {
    testWidgets('accepts only 4 digits and reports them once complete', (
      tester,
    ) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      final completed = <String>[];
      await tester.pumpWidget(
        host(
          PinField(
            label: 'PIN',
            controller: controller,
            onCompleted: completed.add,
          ),
        ),
      );

      await tester.enterText(find.byType(TextField), '2a5b80123');

      expect(controller.text, '2580');
      expect(completed, ['2580']);
      expect(
        tester.widget<TextField>(find.byType(TextField)).obscureText,
        isTrue,
      );
    });
  });

  testWidgets('NextLogo reads as "next bank"', (tester) async {
    await tester.pumpWidget(host(const NextLogo()));

    expect(find.bySemanticsLabel('next bank'), findsOneWidget);
  });

  testWidgets('DemoNotice shows its message with an icon', (tester) async {
    await tester.pumpWidget(
      host(const DemoNotice(message: 'Demonstração: não use dados reais.')),
    );

    expect(find.text('Demonstração: não use dados reais.'), findsOneWidget);
    expect(find.byIcon(Icons.info_outline), findsOneWidget);
  });
}
