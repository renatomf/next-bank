import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Screens read text styles from the theme under the brief's names (v1.1.0
// plan, task 4.17). Each one must be exactly the token style with the color
// the screens used to add by hand, so moving to the theme changes no pixel.
void main() {
  for (final (mode, theme, colors, styles) in [
    ('dark', NbTheme.dark(), NbColors.dark, NbTextStyles.dark),
    ('light', NbTheme.light(), NbColors.light, NbTextStyles.light),
  ]) {
    group('$mode theme', () {
      test('carries the text styles of its mode', () {
        expect(theme.extension<NbTextStyles>(), same(styles));
      });

      test('text styles are the token styles in the mode colors', () {
        final text = styles;

        for (final (role, actual, expected) in [
          (
            'screen title',
            text.screenTitle,
            NbType.screenTitle.copyWith(color: colors.text),
          ),
          (
            'section title',
            text.sectionTitle,
            NbType.sectionTitle.copyWith(color: colors.text),
          ),
          ('body', text.bodyText, NbType.bodyText.copyWith(color: colors.text)),
          (
            'strong body',
            text.bodyStrong,
            NbType.bodyStrong.copyWith(color: colors.text),
          ),
          (
            'caption',
            text.caption,
            NbType.caption.copyWith(color: colors.textMuted),
          ),
          (
            'card label',
            text.cardLabel,
            NbType.cardLabel.copyWith(color: colors.textMuted),
          ),
        ]) {
          expect(actual, expected, reason: role);
        }
      });

      test('bottom sheets sit on the surface with rounded top corners', () {
        final sheet = theme.bottomSheetTheme;

        expect(sheet.backgroundColor, colors.surface);
        expect(
          sheet.shape,
          const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(NbRadius.box),
            ),
          ),
        );
      });

      // No thickness: Flutter's default draws one physical pixel, the line
      // the screens have today; 1 dp would be three pixels on the S21.
      test('dividers take the border color and one point of room', () {
        final divider = theme.dividerTheme;

        expect(divider.color, colors.border);
        expect(divider.space, 1);
        expect(divider.thickness, isNull);
      });
    });
  }

  testWidgets('context.nbText reads the styles of the active theme', (
    tester,
  ) async {
    late NbTextStyles read;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.light(),
        home: Builder(
          builder: (context) {
            read = context.nbText;
            return const SizedBox();
          },
        ),
      ),
    );

    expect(read, same(NbTextStyles.light));
  });

  // The styles do not animate between modes, like NbColors: half way the
  // theme switches to the other set.
  test('a theme change switches the styles half way', () {
    final dark = NbTextStyles.dark;
    final light = NbTextStyles.light;

    expect(dark.lerp(light, 0.4), same(dark));
    expect(dark.lerp(light, 0.6), same(light));
  });
}
