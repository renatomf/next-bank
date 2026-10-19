import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';

import '../../../support/device_stores.dart';
import '../../../support/fake_account_repository.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_token_store.dart';

/// The Profile alone, every way out recorded in [opened] by its name.
Future<void> pumpProfile(WidgetTester tester, List<String> opened) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
        accountRepositoryProvider.overrideWithValue(FakeAccountRepository()),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: ProfileScreen(
          onClose: () => opened.add('close'),
          onPersonalData: () => opened.add('personal data'),
          onSharedAccount: () => opened.add('shared account'),
          onInviteFriends: () => opened.add('invite friends'),
          onTheme: () => opened.add('theme'),
          onChangePin: () => opened.add('change PIN'),
          onChangePassword: () => opened.add('change password'),
          onSecurity: () => opened.add('security'),
          onManageAccounts: () => opened.add('manage accounts'),
          signOut: const Text('sign-out button'),
          switchAccount: const Text('switch-account button'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openTab(WidgetTester tester, String tab) async {
  await tester.tap(find.text(tab));
  await tester.pumpAndSettle();
}

// Screen 13, redesigned (v1.1.0 plan, task 4.4): the customer, the account
// box and the two tabs.
void main() {
  // READ-02: only the CPF the server masks and the account's last four.
  testWidgets('shows the customer with the documents masked', (tester) async {
    await pumpProfile(tester, []);

    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text('CPF: ***.444.777-**'), findsOneWidget);
    expect(find.text('Conta corrente: •••• 0004'), findsOneWidget);
    expect(find.text('Banco: next bank'), findsOneWidget);
    expect(find.text('Agência: 0001'), findsOneWidget);
    expect(find.text('Chave: aleatória'), findsOneWidget);
    expect(find.textContaining('100000'), findsNothing);
    expect(find.text('switch-account button'), findsOneWidget);
  });

  testWidgets('says sharing the account is coming', (tester) async {
    await pumpProfile(tester, []);

    await tester.tap(find.bySemanticsLabel('Compartilhar dados da conta'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
  });

  testWidgets('closes to where the app says', (tester) async {
    final opened = <String>[];
    await pumpProfile(tester, opened);

    await tester.tap(find.bySemanticsLabel('Fechar'));

    expect(opened, ['close']);
  });

  testWidgets('opens on the Perfil tab, without the other bank products', (
    tester,
  ) async {
    await pumpProfile(tester, []);

    expect(find.text('Meus dados cadastrais'), findsOneWidget);
    expect(find.text('Tema do app'), findsNothing);
    for (final gone in ['Empresas', 'Yellow', 'Ícone do app', 'Documentos']) {
      expect(find.textContaining(gone), findsNothing, reason: gone);
    }
  });

  for (final (tab, row, destination) in [
    ('Perfil', 'Meus dados cadastrais', 'personal data'),
    ('Perfil', 'Conta compartilhada', 'shared account'),
    ('Perfil', 'Convidar amigos', 'invite friends'),
    ('Configurações', 'Tema do app', 'theme'),
    ('Configurações', 'Trocar PIN', 'change PIN'),
    ('Configurações', 'Trocar senha', 'change password'),
    ('Configurações', 'Aparelhos conectados e biometria', 'security'),
    ('Configurações', 'Gerenciar contas', 'manage accounts'),
  ]) {
    testWidgets('opens "$row" from the $tab tab', (tester) async {
      final opened = <String>[];
      await pumpProfile(tester, opened);
      await openTab(tester, tab);

      await tester.scrollUntilVisible(find.text(row), 200);
      await tester.tap(find.bySemanticsLabel(row));

      expect(opened, [destination]);
    });
  }

  testWidgets('ends the Configurações tab with the way out', (tester) async {
    await pumpProfile(tester, []);
    await openTab(tester, 'Configurações');

    await tester.scrollUntilVisible(find.text('sign-out button'), 200);
    expect(find.text('Sair da conta'), findsOneWidget);
    expect(find.text('Meus dados cadastrais'), findsNothing);
  });

  for (final tab in ['Perfil', 'Configurações']) {
    testWidgets('fits a small phone at 1.3x text on the $tab tab', (
      tester,
    ) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpProfile(tester, []);
      await openTab(tester, tab);

      expect(tester.takeException(), isNull);
    });
  }
}
