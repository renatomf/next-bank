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

  test('the theme exposes the token colors and the bundled fonts', () {
    final theme = NbTheme.dark();

    expect(theme.extension<NbColors>(), same(NbColors.dark));
    expect(theme.scaffoldBackgroundColor, NbColors.dark.background);
    expect(NbType.screenTitle.fontFamily, 'packages/design_system/Sora');
    expect(NbType.bodyText.fontFamily, 'packages/design_system/Manrope');
  });
}
