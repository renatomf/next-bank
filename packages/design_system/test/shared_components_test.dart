import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

// The pieces screens used to draw by hand (v1.1.0 plan, task 4.17): one
// place per visual decision, so a box, a circle or a switch changes once.
void main() {
  const colors = NbColors.dark;

  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(body: Center(child: child)),
    ),
  );

  BoxDecoration decorationOf(WidgetTester tester, Finder finder) =>
      tester
              .widget<Container>(
                find.descendant(of: finder, matching: find.byType(Container)),
              )
              .decoration!
          as BoxDecoration;

  group('NbSurface', () {
    testWidgets('a card: surface, border and the box radius, padded', (
      tester,
    ) async {
      await pump(tester, const NbSurface(child: Text('Conteúdo')));

      final surface = find.byType(NbSurface);
      final decoration = decorationOf(tester, surface);
      expect(decoration.color, colors.surface);
      expect(decoration.border, Border.all(color: colors.border));
      expect(decoration.borderRadius, BorderRadius.circular(NbRadius.box));
      expect(
        tester
            .widget<Container>(
              find.descendant(of: surface, matching: find.byType(Container)),
            )
            .padding,
        const EdgeInsets.all(NbSpace.lg),
      );
    });

    testWidgets('inset: the second surface without a border, tighter', (
      tester,
    ) async {
      await pump(
        tester,
        const NbSurface(tone: NbSurfaceTone.inset, child: Text('Dentro')),
      );

      final decoration = decorationOf(tester, find.byType(NbSurface));
      expect(decoration.color, colors.surface2);
      expect(decoration.border, isNull);
      expect(decoration.borderRadius, BorderRadius.circular(NbRadius.boxInner));
    });

    testWidgets('outlined: only the border, tighter', (tester) async {
      await pump(
        tester,
        const NbSurface(tone: NbSurfaceTone.outlined, child: Text('Linha')),
      );

      final decoration = decorationOf(tester, find.byType(NbSurface));
      expect(decoration.color, isNull);
      expect(decoration.border, Border.all(color: colors.border));
      expect(decoration.borderRadius, BorderRadius.circular(NbRadius.boxInner));
    });

    testWidgets('selected: the border takes the accent', (tester) async {
      await pump(
        tester,
        const NbSurface(selected: true, child: Text('Escolhido')),
      );

      expect(
        decorationOf(tester, find.byType(NbSurface)).border,
        Border.all(color: colors.accent),
      );
    });
  });

  group('NbIconCircle', () {
    testWidgets('plain: the accent icon on the second surface', (tester) async {
      await pump(tester, const NbIconCircle(icon: Icons.bolt));

      final circle = find.byType(NbIconCircle);
      final decoration = decorationOf(tester, circle);
      expect(decoration.shape, BoxShape.circle);
      expect(decoration.color, colors.surface2);
      expect(tester.getSize(circle), const Size.square(NbSize.touch));
      final icon = tester.widget<Icon>(find.byIcon(Icons.bolt));
      expect(icon.color, colors.accent);
      expect(icon.size, NbSize.icon);
    });

    testWidgets('outlined: a border around it', (tester) async {
      await pump(
        tester,
        const NbIconCircle(
          icon: Icons.person_outline,
          tone: NbIconCircleTone.outlined,
        ),
      );

      expect(
        decorationOf(tester, find.byType(NbIconCircle)).border,
        Border.all(color: colors.border),
      );
    });

    testWidgets('tinted: the color at 14% behind an icon half its size', (
      tester,
    ) async {
      await pump(
        tester,
        NbIconCircle(
          icon: Icons.check,
          size: NbSize.statusCircle,
          color: colors.accent,
          tone: NbIconCircleTone.tinted,
        ),
      );

      final circle = find.byType(NbIconCircle);
      expect(
        decorationOf(tester, circle).color,
        colors.accent.withValues(alpha: 0.14),
      );
      expect(tester.getSize(circle), const Size.square(NbSize.statusCircle));
      expect(
        tester.widget<Icon>(find.byIcon(Icons.check)).size,
        NbSize.statusCircle / 2,
      );
    });

    testWidgets('stays out of the screen reader: the text beside it speaks', (
      tester,
    ) async {
      await pump(tester, const NbIconCircle(icon: Icons.bolt));

      expect(
        find.ancestor(
          of: find.descendant(
            of: find.byType(NbIconCircle),
            matching: find.byType(Container),
          ),
          matching: find.byType(ExcludeSemantics),
        ),
        findsOneWidget,
      );
    });
  });

  group('NbTag', () {
    testWidgets('filled: the card label on the primary color', (tester) async {
      await pump(tester, const NbTag(label: 'Novo'));

      final decoration = decorationOf(tester, find.byType(NbTag));
      expect(decoration.color, colors.primary);
      expect(decoration.borderRadius, BorderRadius.circular(NbRadius.tag));
      expect(
        tester.widget<Text>(find.text('Novo')).style?.color,
        colors.onPrimary,
      );
    });

    testWidgets('outlined: the accent border and text', (tester) async {
      await pump(
        tester,
        const NbTag(label: 'Recomendada', tone: NbTagTone.outlined),
      );

      final decoration = decorationOf(tester, find.byType(NbTag));
      expect(decoration.color, isNull);
      expect(decoration.border, Border.all(color: colors.accent));
      expect(
        tester.widget<Text>(find.text('Recomendada')).style?.color,
        colors.accent,
      );
    });
  });

  group('NbSearchField', () {
    testWidgets('a pill with the magnifier first, read by its hint', (
      tester,
    ) async {
      final typed = <String>[];
      await pump(
        tester,
        NbSearchField(hint: 'Buscar banco', onChanged: typed.add),
      );

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.decoration?.hintText, 'Buscar banco');
      expect(field.textInputAction, TextInputAction.search);
      final prefix = field.decoration?.prefixIcon as Icon?;
      expect(prefix?.icon, Icons.search);
      expect(
        (field.decoration?.enabledBorder as OutlineInputBorder?)?.borderRadius,
        BorderRadius.circular(NbRadius.pill),
      );

      await tester.enterText(find.byType(TextField), 'next');
      expect(typed, ['next']);
    });

    testWidgets('cuts the query at the length given', (tester) async {
      await pump(
        tester,
        NbSearchField(hint: 'Buscar', maxLength: 3, onChanged: (_) {}),
      );

      final field = tester.widget<TextField>(find.byType(TextField));
      expect(
        field.inputFormatters
            ?.whereType<LengthLimitingTextInputFormatter>()
            .single
            .maxLength,
        3,
      );
    });
  });

  group('NbSwitch', () {
    testWidgets('three quarters of the Material switch, saying its state', (
      tester,
    ) async {
      var value = false;
      await pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => NbSwitch(
            value: value,
            onChanged: (next) => setState(() => value = next),
          ),
        ),
      );

      expect(
        tester
            .widget<Transform>(
              find
                  .descendant(
                    of: find.byType(NbSwitch),
                    matching: find.byType(Transform),
                  )
                  .first,
            )
            .transform
            .entry(0, 0),
        0.75,
      );
      await tester.tap(find.byType(Switch));
      await tester.pump();
      expect(value, isTrue);
    });

    testWidgets('keeps its own touch target unless its row takes the tap', (
      tester,
    ) async {
      await pump(tester, NbSwitch(value: true, onChanged: (_) {}));
      expect(
        tester.widget<Switch>(find.byType(Switch)).materialTapTargetSize,
        MaterialTapTargetSize.padded,
      );

      await pump(
        tester,
        NbSwitch(value: true, rowTakesTap: true, onChanged: (_) {}),
      );
      expect(
        tester.widget<Switch>(find.byType(Switch)).materialTapTargetSize,
        MaterialTapTargetSize.shrinkWrap,
      );
    });
  });

  test('sizes and radii have one name per decision', () {
    // Android's minimum touch target (accessibility_test.dart), apart from
    // the 44 of a round control.
    expect(NbSize.tapTarget, 48);
    expect(NbSize.touch, 44);
    expect(NbSize.avatar, 48);
    expect(NbSize.statusCircle, 72);
    expect(NbRadius.tag, 8);
  });
}
