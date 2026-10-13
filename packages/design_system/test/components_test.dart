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

    // Found while building the Home: in a list, the button merged with the
    // text beside it and was announced as "Bem-vindo, Entrar".
    testWidgets('stays its own button next to other text in a list', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(
            body: ListView(
              children: [
                Column(
                  children: [
                    const Text('Bem-vindo'),
                    PrimaryButton(label: 'Entrar', onPressed: () {}),
                  ],
                ),
              ],
            ),
          ),
        ),
      );

      expect(
        tester.getSemantics(find.byType(PrimaryButton)),
        isSemantics(label: 'Entrar', isButton: true),
      );
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

    testWidgets("submits with the keyboard's action key", (tester) async {
      final submitted = <String>[];
      await tester.pumpWidget(
        host(NbTextField(label: 'Senha', onSubmitted: submitted.add)),
      );

      await tester.enterText(find.byType(TextField), 'a long passphrase');
      await tester.testTextInput.receiveAction(TextInputAction.done);

      expect(submitted, ['a long passphrase']);
    });

    testWidgets('read-only shows its value but takes no typing', (
      tester,
    ) async {
      final controller = TextEditingController(text: '123.456.789-09');
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        host(NbTextField(label: 'CPF', controller: controller, readOnly: true)),
      );

      await tester.enterText(find.byType(TextField), '000');

      expect(tester.widget<TextField>(find.byType(TextField)).readOnly, isTrue);
      expect(find.text('123.456.789-09'), findsOneWidget);
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

  for (final (mode, theme, colors) in [
    ('dark', NbTheme.dark(), NbColors.dark),
    ('light', NbTheme.light(), NbColors.light),
  ]) {
    testWidgets('GlowBackground lights the top in $mode mode', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: theme,
          home: const GlowBackground(child: Text('Conteúdo')),
        ),
      );

      final ground = tester.widget<ColoredBox>(
        find
            .descendant(
              of: find.byType(GlowBackground),
              matching: find.byType(ColoredBox),
            )
            .first,
      );
      final glow = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(GlowBackground),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      final gradient = (glow.decoration as BoxDecoration).gradient!;
      expect(ground.color, colors.background);
      expect(gradient.colors.first, colors.glow);
      expect(
        find.descendant(
          of: find.byType(GlowBackground),
          matching: find.byType(Dither),
        ),
        findsOneWidget,
      );
      expect(find.text('Conteúdo'), findsOneWidget);
    });
  }

  testWidgets('DisplayTitle reads as one heading with a muted second line', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const DisplayTitle(lead: 'Seu dinheiro,', trail: 'um passo à frente.'),
      ),
    );

    final semantics = tester.getSemantics(find.byType(DisplayTitle));
    expect(semantics.label, 'Seu dinheiro,\num passo à frente.');
    expect(semantics.flagsCollection.isHeader, isTrue);
    final rich = tester.widget<Text>(find.byType(Text)).textSpan! as TextSpan;
    final trail = rich.children!.single as TextSpan;
    expect(trail.style?.color, NbColors.dark.textMuted);
    expect(trail.style?.fontWeight, FontWeight.w400);
  });

  testWidgets('FormErrorText is announced and shown in the danger color', (
    tester,
  ) async {
    await tester.pumpWidget(host(const FormErrorText('Sem conexão.')));

    final semantics = tester.getSemantics(find.byType(FormErrorText));
    expect(semantics.flagsCollection.isLiveRegion, isTrue);
    final text = tester.widget<Text>(find.text('Sem conexão.'));
    expect(text.style?.color, NbColors.dark.danger);
  });

  testWidgets('NextLogo reads as "next bank"', (tester) async {
    await tester.pumpWidget(host(const NextLogo()));

    expect(find.bySemanticsLabel('next bank'), findsOneWidget);
  });

  // Week 8 plan, task 4: the app icon is the "n." of the logo.
  testWidgets('NextLogo draws another word, still read as "next bank"', (
    tester,
  ) async {
    await tester.pumpWidget(host(const NextLogo(word: 'n')));

    expect(
      find.byWidgetPredicate(
        (widget) => widget is Text && widget.textSpan?.toPlainText() == 'n￼',
      ),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('next bank'), findsOneWidget);
  });

  testWidgets('InfoNotice shows its message with an icon', (tester) async {
    await tester.pumpWidget(
      host(const InfoNotice(message: 'Demonstração: não use dados reais.')),
    );

    expect(find.text('Demonstração: não use dados reais.'), findsOneWidget);
    expect(find.byIcon(Icons.info_outline), findsOneWidget);
  });
}
