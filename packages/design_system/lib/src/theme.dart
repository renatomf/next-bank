import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Material themes built from the brief's tokens (dark is the default look).
abstract final class NbTheme {
  /// Dark theme.
  static ThemeData dark() => _build(NbColors.dark, Brightness.dark);

  /// Light theme.
  static ThemeData light() => _build(NbColors.light, Brightness.light);

  static ThemeData _build(NbColors colors, Brightness brightness) {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: NbBrand.mint,
          brightness: brightness,
        ).copyWith(
          primary: colors.primary,
          onPrimary: colors.onPrimary,
          surface: colors.surface,
          onSurface: colors.text,
          error: colors.danger,
        );
    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(NbRadius.field),
      borderSide: BorderSide(color: colors.border),
    );
    return ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: colors.background,
      fontFamily: NbType.body,
      extensions: [colors],
      // Every text style the app uses, so screens read them from the theme
      // instead of combining tokens themselves.
      textTheme: TextTheme(
        displayLarge: NbType.displayLarge.copyWith(color: colors.text),
        headlineSmall: NbType.screenTitle.copyWith(color: colors.text),
        titleMedium: NbType.sectionTitle.copyWith(color: colors.text),
        bodyMedium: NbType.bodyText.copyWith(color: colors.text),
        bodySmall: NbType.caption.copyWith(color: colors.textMuted),
        labelLarge: NbType.button,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        border: fieldBorder,
        enabledBorder: fieldBorder,
        focusedBorder: fieldBorder.copyWith(
          borderSide: BorderSide(color: colors.accent, width: 1.5),
        ),
        errorBorder: fieldBorder.copyWith(
          borderSide: BorderSide(color: colors.danger),
        ),
        hintStyle: NbType.bodyText.copyWith(color: colors.textMuted),
        errorStyle: NbType.caption.copyWith(color: colors.danger),
      ),
    );
  }
}

/// The token colors of the current theme.
extension NbThemeColors on BuildContext {
  /// Colors of the active mode.
  NbColors get nbColors => Theme.of(this).extension<NbColors>()!;
}
