import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/profile/presentation/blank/profile_blank_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/profile/presentation/theme/theme_screen.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_theme_store.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// Signed in and unlocked, on the Profile opened from the Home's header.
Future<void> openProfile(
  WidgetTester tester, {
  FakeThemeStore? theme,
  FakeAuthRepository? repository,
}) async {
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    theme: theme,
    repository: repository,
  );
  await unlockWithPin(tester);
  await tap(tester, 'Abrir perfil');
}

Future<void> tap(WidgetTester tester, String label) async {
  await tester.tap(find.bySemanticsLabel(label).first);
  await tester.pumpAndSettle();
}

// The redesigned profile through the real router (v1.1.0 plan, task 4.4):
// every screen it opens goes back to it.
void main() {
  testWidgets('opens from the Home header and closes back to the Home', (
    tester,
  ) async {
    await openProfile(tester);
    expect(find.byType(ProfileScreen), findsOneWidget);

    await tap(tester, 'Fechar');

    expect(find.byType(HomeScreen), findsOneWidget);
  });

  for (final (tab, row, screen) in [
    ('Perfil', 'Meus dados cadastrais', ProfileBlankScreen),
    ('Perfil', 'Conta compartilhada', ProfileBlankScreen),
    ('Perfil', 'Convidar amigos', ProfileBlankScreen),
    ('Configurações', 'Gerenciar contas', ProfileBlankScreen),
    ('Configurações', 'Tema do app', ThemeScreen),
    ('Configurações', 'Trocar PIN', ChangePinScreen),
    ('Configurações', 'Trocar senha', ChangePasswordScreen),
    ('Configurações', 'Aparelhos conectados e biometria', SecurityScreen),
  ]) {
    testWidgets('opens "$row" and goes back to the profile', (tester) async {
      await openProfile(tester);
      await tester.tap(find.widgetWithText(Tab, tab));
      await tester.pumpAndSettle();

      await tap(tester, row);
      expect(find.byType(screen), findsOneWidget);

      await tap(tester, 'Voltar');
      expect(find.byType(ProfileScreen), findsOneWidget);
    });
  }

  testWidgets('changes the theme on its own screen and keeps it', (
    tester,
  ) async {
    final theme = FakeThemeStore();
    await openProfile(tester, theme: theme);
    await tester.tap(find.widgetWithText(Tab, 'Configurações'));
    await tester.pumpAndSettle();
    await tap(tester, 'Tema do app');

    await tap(tester, 'Escuro');

    expect(theme.stored, ThemeChoice.dark);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Escuro')),
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

  // AUTH-06: "Trocar conta" ends this session, as "Sair" does.
  testWidgets('switches account through the login', (tester) async {
    final repository = FakeAuthRepository(tokens);
    await openProfile(tester, repository: repository);

    await tester.tap(find.text('Trocar conta'));
    await tester.pumpAndSettle();

    expect(repository.logouts, 1);
    expect(find.widgetWithText(FilledButton, 'Entrar'), findsOneWidget);
  });
}
