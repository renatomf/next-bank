import 'package:flutter/material.dart';

/// Brand colors (docs/design/brief.md, section 2.1).
abstract final class NbBrand {
  /// Mint: buttons in dark mode, central action, glow, logo.
  static const Color mint = Color(0xFF00FFC8);

  /// Mint for text, links and icons in light mode (5.3:1 on white).
  static const Color mintDeep = Color(0xFF007A6A);

  /// Halo around the main action, in both modes: mint at 35%, the same
  /// glow as the balance card's shadow (brief, section 2.3).
  static const Color actionGlow = Color(0x5900FFC8);
}

/// Theme colors for one mode (brief, section 2.2), read with
/// `Theme.of(context).extension<NbColors>()`.
@immutable
final class NbColors extends ThemeExtension<NbColors> {
  /// Creates a color set.
  const new({
    required this.background,
    required this.surface,
    required this.surface2,
    required this.border,
    required this.text,
    required this.textMuted,
    required this.accent,
    required this.primary,
    required this.onPrimary,
    required this.success,
    required this.danger,
  });

  /// Dark mode, the app's default look.
  static const NbColors dark = NbColors(
    background: Color(0xFF0A0F14),
    surface: Color(0xFF121A21),
    surface2: Color(0xFF1A242D),
    border: Color(0x14FFFFFF),
    text: Color(0xFFF2F6F8),
    textMuted: Color(0xFF8A97A3),
    accent: NbBrand.mint,
    primary: NbBrand.mint,
    onPrimary: Color(0xFF0A0F14),
    success: Color(0xFFC4F27A),
    danger: Color(0xFFFF6B6B),
  );

  /// Light mode.
  static const NbColors light = NbColors(
    background: Color(0xFFF2F6F6),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFE6EEEE),
    border: Color(0x140A0F14),
    text: Color(0xFF0A0F14),
    textMuted: Color(0xFF4A5560),
    accent: NbBrand.mintDeep,
    primary: Color(0xFF0A0F14),
    onPrimary: NbBrand.mint,
    success: Color(0xFF3B6E0E),
    danger: Color(0xFFC62828),
  );

  /// Screen background.
  final Color background;

  /// Cards, blocks and fields.
  final Color surface;

  /// Avatars, active items, selected segments.
  final Color surface2;

  /// Default 1 px border.
  final Color border;

  /// Main text.
  final Color text;

  /// Secondary text (at least 5.8:1 in both modes).
  final Color textMuted;

  /// Links, icons and highlighted text.
  final Color accent;

  /// Primary button background.
  final Color primary;

  /// Text and icons on [primary].
  final Color onPrimary;

  /// Completed status.
  final Color success;

  /// Errors and failures.
  final Color danger;

  @override
  NbColors copyWith({
    Color? background,
    Color? surface,
    Color? surface2,
    Color? border,
    Color? text,
    Color? textMuted,
    Color? accent,
    Color? primary,
    Color? onPrimary,
    Color? success,
    Color? danger,
  }) => NbColors(
    background: background ?? this.background,
    surface: surface ?? this.surface,
    surface2: surface2 ?? this.surface2,
    border: border ?? this.border,
    text: text ?? this.text,
    textMuted: textMuted ?? this.textMuted,
    accent: accent ?? this.accent,
    primary: primary ?? this.primary,
    onPrimary: onPrimary ?? this.onPrimary,
    success: success ?? this.success,
    danger: danger ?? this.danger,
  );

  @override
  NbColors lerp(NbColors? other, double t) =>
      other == null || t < 0.5 ? this : other;
}

/// Spacing scale on a 4 px base (brief, section 4).
abstract final class NbSpace {
  /// 4 px.
  static const double xs = 4;

  /// 8 px.
  static const double sm = 8;

  /// 12 px.
  static const double md = 12;

  /// 16 px.
  static const double lg = 16;

  /// 20 px: screen side margin and gap between sections.
  static const double screen = 20;

  /// 24 px.
  static const double xl = 24;

  /// 28 px.
  static const double xxl = 28;
}

/// Corner radii (brief, section 4).
abstract final class NbRadius {
  /// Buttons, pills and navigation.
  static const double pill = 999;

  /// Balance card and large cards.
  static const double card = 28;

  /// Blocks, lists and contacts.
  static const double block = 20;

  /// Text fields.
  static const double field = 16;
}

/// Sizes (brief, sections 4 and 8).
abstract final class NbSize {
  /// Primary button height.
  static const double button = 56;

  /// Minimum touch target.
  static const double touch = 44;
}

/// Type families and styles (brief, section 3). The fonts are variable, so
/// each style sets the weight axis as well as the weight.
abstract final class NbType {
  /// Display and titles.
  static const String display = 'Sora';

  /// Body text and captions.
  static const String body = 'Manrope';

  static TextStyle _style(
    String family,
    double size,
    int weight, {
    double? height,
    double letterSpacing = 0,
  }) => TextStyle(
    fontFamily: family,
    package: 'design_system',
    fontSize: size,
    fontWeight: FontWeight.values[weight ~/ 100 - 1],
    fontVariations: [FontVariation.weight(weight.toDouble())],
    height: height,
    letterSpacing: letterSpacing,
  );

  /// Screen title: Sora 600, 22.
  static final TextStyle screenTitle = _style(display, 22, 600);

  /// Display: Sora 600, 30 / 1.15, tracking -3%.
  static final TextStyle displayLarge = _style(
    display,
    30,
    600,
    height: 1.15,
    letterSpacing: -0.9,
  );

  /// Body: Manrope 600, 15.
  static final TextStyle bodyText = _style(body, 15, 600);

  /// Caption: Manrope 500, 13.
  static final TextStyle caption = _style(body, 13, 500);

  /// Button label: Manrope 700, 16.
  static final TextStyle button = _style(body, 16, 700);
}
