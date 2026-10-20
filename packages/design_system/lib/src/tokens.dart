import 'package:flutter/material.dart';

/// Brand colors (docs/design/brief.md, section 2.1).
abstract final class NbBrand {
  /// Mint: buttons in dark mode, central action, glow, logo.
  static const Color mint = Color(0xFF00FFC8);

  /// Mint for text, links and icons in light mode: at least AA on every
  /// light background, including surface2 and the glow.
  static const Color mintInk = Color(0xFF006B5D);

  /// Halo around the main action, in both modes: mint at 35%, the same
  /// glow as the balance card's shadow (brief, section 2.3).
  static const Color actionGlow = Color(0x5900FFC8);
}

/// The palette of dark glass over the art (brief, section 2.3), exactly as
/// in the mockup's CSS: glass is always dark, in both modes, so its colors do
/// not come from the theme. The balance card and the Pix amount card use it.
abstract final class NbGlassColors {
  /// Card border: mint at 22%.
  static const Color border = Color(0x3800FFC8);

  /// Card glow underneath: mint at 25%, softened from the mockup's 35% at
  /// the v1.1.0 checkpoint (developer's request).
  static const Color shadow = Color(0x4000FFC8);

  /// Glass panel under the balance: it keeps the text readable over the
  /// lights.
  static const Color glass = Color(0x9E060C0E);

  /// Glass panel border: white at 10%.
  static const Color glassBorder = Color(0x1AFFFFFF);

  /// Balance and logo.
  static const Color text = Color(0xFFF2F6F8);

  /// Labels, "R$" and cents.
  static const Color textMuted = Color(0xFFA9B6BF);

  /// Eye button: rgba(10, 15, 20, 0.45).
  static const Color button = Color(0x730A0F14);

  /// Eye button border: white at 14%.
  static const Color buttonBorder = Color(0x24FFFFFF);

  /// Loading placeholders on the glass.
  static const Color placeholder = Color(0x29FFFFFF);

  /// Deep tint over the glass art, where text sits right on it (the balance
  /// card's title, the whole Pix amount card): #06110F at 78%.
  static const Color tintDeep = Color(0xC706110F);

  /// Light tint over the glass art, where text sits on glass: #06110F at
  /// 35%, enough for AA on the glass even over the art's brightest pixel.
  static const Color tintLight = Color(0x5906110F);
}

/// Bundled art (v1.1.0 checkpoint, 2026-10-14), made by the developer.
abstract final class NbArt {
  /// Green glass waves, shown through `GlassArt`.
  static const AssetImage glass = AssetImage(
    'assets/images/bg_splash.jpg',
    package: 'design_system',
  );
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
    required this.glow,
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
    glow: Color(0x1A00FFC8),
  );

  /// Light mode.
  static const NbColors light = NbColors(
    background: Color(0xFFF2F6F6),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFE6EEEE),
    border: Color(0x140A0F14),
    text: Color(0xFF0A0F14),
    textMuted: Color(0xFF4A5560),
    accent: NbBrand.mintInk,
    primary: Color(0xFF0A0F14),
    onPrimary: NbBrand.mint,
    success: Color(0xFF3B6E0E),
    danger: Color(0xFFC62828),
    glow: Color(0x3800FFC8),
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

  /// Ambient mint light at the top of the screen: 10% in dark mode, 22% in
  /// light mode (brief, section 2.2).
  final Color glow;

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
    Color? glow,
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
    glow: glow ?? this.glow,
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

  /// Text fields.
  static const double field = 16;

  /// Boxes, blocks, lists and sheets: a little tighter than [card] (v1.1.0
  /// checkpoint, 2026-10-16).
  static const double box = 20;

  /// What sits inside a box, and shortcut tiles.
  static const double boxInner = 14;

  /// Small tags such as "Novo".
  static const double tag = 8;
}

/// Sizes (brief, sections 4 and 8).
abstract final class NbSize {
  /// Primary button height.
  static const double button = 56;

  /// Round controls and icon circles: 44, the iOS minimum.
  static const double touch = 44;

  /// Android's minimum touch target, which the accessibility test checks.
  static const double tapTarget = 48;

  /// Icon circles at the start of a list row.
  static const double avatar = 48;

  /// The circle that tells how an operation ended.
  static const double statusCircle = 72;

  /// One size for the icons of tiles, actions and links (S21 checkpoint of
  /// v1.1.0).
  static const double icon = 22;
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

  /// Second line of a display title: Sora 400, same size, shown muted.
  static final TextStyle displaySoft = _style(
    display,
    30,
    400,
    height: 1.15,
    letterSpacing: -0.9,
  );

  /// Section title: Sora 600, 17.
  static final TextStyle sectionTitle = _style(display, 17, 600);

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

  /// Large amount, the integer part: Sora 600, 34, tracking -3% (mockup).
  static final TextStyle moneyLarge = _style(
    display,
    34,
    600,
    letterSpacing: -1.02,
  );

  /// "R$" beside a large amount: Sora 500, 18 (brief, section 3; mockup).
  static final TextStyle moneyLargeCurrency = _style(display, 18, 500);

  /// Cents beside a large amount: Sora 500, 20 (mockup).
  static final TextStyle moneyLargeCents = _style(display, 20, 500);

  /// Small label on a card: Manrope 400, 12 (mockup).
  static final TextStyle cardLabel = _style(body, 12, 400);

  /// Emphasized body, such as the customer's name: Manrope 700, 15 (mockup).
  static final TextStyle bodyStrong = _style(body, 15, 700);

  /// Plain caption, such as the greeting: Manrope 400, 13 (mockup).
  static final TextStyle captionPlain = _style(body, 13, 400);

  /// Initial in an avatar: Sora 600, 16 (mockup).
  static final TextStyle avatar = _style(display, 16, 600);

  /// Body: Manrope 600, 15.
  static final TextStyle bodyText = _style(body, 15, 600);

  /// Caption: Manrope 500, 13.
  static final TextStyle caption = _style(body, 13, 500);

  /// Button label: Manrope 700, 16.
  static final TextStyle button = _style(body, 16, 700);
}
