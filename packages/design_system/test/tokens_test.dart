import 'dart:math';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// WCAG 2.1 contrast ratio between two opaque colors.
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (max(la, lb) + 0.05) / (min(la, lb) + 0.05);
}

// Accessibility (brief, section 8): every text meets AA (4.5:1) in both modes.
void main() {
  for (final (mode, colors) in [
    ('dark', NbColors.dark),
    ('light', NbColors.light),
  ]) {
    group('$mode mode contrast (AA)', () {
      for (final (name, foreground) in [
        ('text', colors.text),
        ('muted text', colors.textMuted),
        ('accent', colors.accent),
        ('danger', colors.danger),
      ]) {
        for (final (ground, background) in [
          ('background', colors.background),
          ('surface', colors.surface),
          ('surface2', colors.surface2),
          // Where the ambient glow is strongest, at the top of the screen.
          ('the glow', Color.alphaBlend(colors.glow, colors.background)),
        ]) {
          test('$name on $ground', () {
            expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
          });
        }
      }

      test('label on the primary button', () {
        expect(
          contrast(colors.onPrimary, colors.primary),
          greaterThanOrEqualTo(4.5),
        );
      });
    });
  }

  for (final (mode, theme, colors) in [
    ('dark', NbTheme.dark(), NbColors.dark),
    ('light', NbTheme.light(), NbColors.light),
  ]) {
    test('the $mode theme defines every text style screens use', () {
      final text = theme.textTheme;
      for (final (role, style, family, color) in [
        ('display', text.displayLarge, 'Sora', colors.text),
        ('screen title', text.headlineSmall, 'Sora', colors.text),
        ('section title', text.titleMedium, 'Sora', colors.text),
        ('body', text.bodyMedium, 'Manrope', colors.text),
        ('caption', text.bodySmall, 'Manrope', colors.textMuted),
      ]) {
        expect(
          style?.fontFamily,
          'packages/design_system/$family',
          reason: role,
        );
        expect(style?.color, color, reason: role);
      }
    });
  }

  test('text buttons use the accent of each mode, at touch size', () {
    for (final (theme, colors) in [
      (NbTheme.dark(), NbColors.dark),
      (NbTheme.light(), NbColors.light),
    ]) {
      final style = theme.textButtonTheme.style!;
      expect(style.foregroundColor?.resolve({}), colors.accent);
      expect(
        style.minimumSize?.resolve({}),
        const Size(NbSize.touch, NbSize.touch),
      );
    }
  });

  test('the theme exposes the token colors and the bundled fonts', () {
    final theme = NbTheme.dark();

    expect(theme.extension<NbColors>(), same(NbColors.dark));
    expect(theme.scaffoldBackgroundColor, NbColors.dark.background);
    expect(NbType.screenTitle.fontFamily, 'packages/design_system/Sora');
    expect(NbType.bodyText.fontFamily, 'packages/design_system/Manrope');
  });
}
