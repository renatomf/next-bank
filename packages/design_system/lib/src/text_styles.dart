import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The brief's text styles in the colors of a mode (v1.1.0 plan, task 4.17):
/// screens read `context.nbText.caption` instead of combining [NbType] with
/// a color. Material's role names (`titleSmall`, `labelMedium`) would hide
/// which style of the brief each one is, so they stay for Material widgets.
final class NbTextStyles extends ThemeExtension<NbTextStyles> {
  /// Creates a set of styles.
  const new({
    required this.screenTitle,
    required this.sectionTitle,
    required this.bodyText,
    required this.bodyStrong,
    required this.caption,
    required this.cardLabel,
  });

  // The styles of [colors]: muted for captions and card labels, the main
  // text color for the rest, as the screens used them.
  new _of(NbColors colors)
    : screenTitle = NbType.screenTitle.copyWith(color: colors.text),
      sectionTitle = NbType.sectionTitle.copyWith(color: colors.text),
      bodyText = NbType.bodyText.copyWith(color: colors.text),
      bodyStrong = NbType.bodyStrong.copyWith(color: colors.text),
      caption = NbType.caption.copyWith(color: colors.textMuted),
      cardLabel = NbType.cardLabel.copyWith(color: colors.textMuted);

  /// Dark mode, the app's default look.
  static final NbTextStyles dark = NbTextStyles._of(NbColors.dark);

  /// Light mode.
  static final NbTextStyles light = NbTextStyles._of(NbColors.light);

  /// Title at the top of a screen.
  final TextStyle screenTitle;

  /// Title of a section or a sheet.
  final TextStyle sectionTitle;

  /// Body text.
  final TextStyle bodyText;

  /// Emphasized body, such as a name or an amount in a list.
  final TextStyle bodyStrong;

  /// Secondary text under or beside the main one.
  final TextStyle caption;

  /// Small label on a card or a tag.
  final TextStyle cardLabel;

  @override
  NbTextStyles copyWith({
    TextStyle? screenTitle,
    TextStyle? sectionTitle,
    TextStyle? bodyText,
    TextStyle? bodyStrong,
    TextStyle? caption,
    TextStyle? cardLabel,
  }) => NbTextStyles(
    screenTitle: screenTitle ?? this.screenTitle,
    sectionTitle: sectionTitle ?? this.sectionTitle,
    bodyText: bodyText ?? this.bodyText,
    bodyStrong: bodyStrong ?? this.bodyStrong,
    caption: caption ?? this.caption,
    cardLabel: cardLabel ?? this.cardLabel,
  );

  // Like NbColors: the styles switch half way instead of blending.
  @override
  NbTextStyles lerp(NbTextStyles? other, double t) =>
      other == null || t < 0.5 ? this : other;
}

/// The text styles of the current theme.
extension NbThemeTextStyles on BuildContext {
  /// Text styles of the active mode.
  NbTextStyles get nbText => Theme.of(this).extension<NbTextStyles>()!;
}
