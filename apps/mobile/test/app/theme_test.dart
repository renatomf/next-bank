import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/features/profile/presentation/theme/theme_screen.dart';

import '../support/fake_theme_store.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// The brightness the app shows right now.
Brightness shown(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(Scaffold).last)).brightness;

/// Signed in, unlocked, on the Profile.
Future<void> openProfile(WidgetTester tester, FakeThemeStore theme) async {
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(tester, store: FakeTokenStore(tokens), theme: theme);
  await unlockWithPin(tester);
  await tester.tap(find.bySemanticsLabel('Perfil'));
  await tester.pumpAndSettle();
}

// The theme picker through the real app (week 7 plan, D9).
void main() {
  testWidgets('follows the phone by default', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

    await openProfile(tester, FakeThemeStore());

    expect(shown(tester), Brightness.dark);
  });

  testWidgets('opens with the theme kept on the device', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

    await openProfile(tester, FakeThemeStore(ThemeChoice.light));

    expect(shown(tester), Brightness.light);
  });

  testWidgets('changes the theme from the Profile and keeps it', (
    tester,
  ) async {
    final theme = FakeThemeStore();
    await openProfile(tester, theme);
    expect(shown(tester), Brightness.light);

    await tester.tap(find.text('Configurações'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tema do app'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Escuro'));
    await tester.pumpAndSettle();

    expect(find.byType(ThemeScreen), findsOneWidget);
    expect(shown(tester), Brightness.dark);
    expect(theme.stored, ThemeChoice.dark);
    expect(
      tester.getSemantics(find.text('Escuro')),
      isSemantics(
        label: 'Escuro',
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
      ),
    );
  });

  // Week 8 plan, V10: the phone's own buttons sit over the app's bar, as in
  // the reference, with icons that read on each theme.
  for (final (brightness, icons) in [
    (Brightness.dark, Brightness.light),
    (Brightness.light, Brightness.dark),
  ]) {
    testWidgets('draws under the system buttons in ${brightness.name} mode', (
      tester,
    ) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);

      await openProfile(tester, FakeThemeStore());

      final style = SystemChrome.latestStyle;
      expect(style?.systemNavigationBarColor, Colors.transparent);
      expect(style?.systemNavigationBarContrastEnforced, isFalse);
      expect(style?.systemNavigationBarIconBrightness, icons);
    });
  }
}
