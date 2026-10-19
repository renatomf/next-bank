import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/areas/presentation/area_placeholder_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';
import 'package:next_bank/features/statement/presentation/list/statement_screen.dart';
import 'package:next_bank/features/unlock/presentation/unlock_screen.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_monotonic_clock.dart';
import '../support/fake_security_repository.dart';
import '../support/fake_token_store.dart';
import '../support/fake_unlock_repository.dart';
import '../support/pump_app.dart';

final Finder bar = find.byType(NbNavBar);

Future<void> openHome(WidgetTester tester, {FakeMonotonicClock? clock}) async {
  // Tall enough for every screen to be built at once.
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(tester, store: FakeTokenStore(tokens), clock: clock);
  await unlockWithPin(tester);
}

Future<void> tapBar(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: bar, matching: find.bySemanticsLabel(label)),
  );
  await tester.pumpAndSettle();
}

/// The profile's Configurações tab, from the Home's header (v1.1.0 plan,
/// tasks 4.4 and 4.11).
Future<void> openProfileSettings(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Abrir perfil'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Configurações'));
  await tester.pumpAndSettle();
}

// The floating bar through the real router (week 7 plan, D7;
// domain-model.md 10).
void main() {
  testWidgets('each destination opens its area and is marked', (tester) async {
    await openHome(tester);
    expect(bar, findsOneWidget);

    // v1.1.0 plan, task 4.11: the three new areas, title only for now.
    for (final label in ['Cartões', 'Investimentos', 'Menu']) {
      await tapBar(tester, label);
      expect(
        find.widgetWithText(AreaPlaceholderScreen, label),
        findsOneWidget,
        reason: label,
      );
      expect(
        tester.getSemantics(
          find.descendant(of: bar, matching: find.bySemanticsLabel(label)),
        ),
        isSemantics(label: label, isSelected: true, isButton: true),
      );
    }
    await tapBar(tester, 'Início');
    expect(find.text('Digite ou cole uma chave CPF'), findsOneWidget);
  });

  // Week 8 plan, V1 and V4: docked at the bottom, the bar never covers the
  // screen; each destination shows its label.
  testWidgets('docks at the bottom, with the screens ending above it', (
    tester,
  ) async {
    await openHome(tester);

    for (final label in ['Início', 'Cartões', 'Pix', 'Investimentos', 'Menu']) {
      expect(
        find.descendant(of: bar, matching: find.text(label)),
        findsOneWidget,
        reason: label,
      );
    }
    expect(
      tester.getRect(find.byType(HomeScreen)).bottom,
      lessThanOrEqualTo(tester.getRect(bar).top),
    );
  });

  // D7: the flows open over the areas, without the bar.
  testWidgets('the Pix opens over the bar, and back returns to it', (
    tester,
  ) async {
    await openHome(tester);

    await tapBar(tester, 'Pix');
    expect(find.byType(SendPixScreen), findsOneWidget);
    expect(bar, findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(bar, findsOneWidget);
  });

  // v1.1.0 plan, task 4.11: Security left the bar; the profile reaches it.
  testWidgets('the PIN change opens from the profile, without the bar', (
    tester,
  ) async {
    await openHome(tester);
    await openProfileSettings(tester);

    await tester.tap(find.bySemanticsLabel('Trocar PIN'));
    await tester.pumpAndSettle();

    expect(find.byType(ChangePinScreen), findsOneWidget);
    expect(bar, findsNothing);
  });

  // T3-2: "Ver extrato" leads to the same destination of the bar.
  testWidgets('"Ver extrato" opens the statement destination', (tester) async {
    await openHome(tester);

    await tester.tap(find.bySemanticsLabel('Ver extrato'));
    await tester.pumpAndSettle();

    expect(find.byType(StatementScreen), findsOneWidget);
    expect(bar, findsOneWidget);
  });

  // v1.1.0 plan, task 4.1 (developer's call): the statement always has a
  // back arrow, which returns to the Home.
  testWidgets('goes back to the Home from the statement', (tester) async {
    await openHome(tester);
    await tester.tap(find.bySemanticsLabel('Ver extrato'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();

    expect(find.byType(StatementScreen), findsNothing);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('the profile shows the customer and the masked account', (
    tester,
  ) async {
    await openHome(tester);

    await tester.tap(find.bySemanticsLabel('Abrir perfil'));
    await tester.pumpAndSettle();

    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text('Conta corrente: •••• 0004'), findsOneWidget);
    await tester.tap(find.text('Configurações'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Aparelhos conectados e biometria'));
    await tester.pumpAndSettle();
    expect(find.byType(SecurityScreen), findsOneWidget);
  });

  // PIX-06: the lock still bars every area.
  testWidgets('asks for the PIN after 5 minutes away, from any area', (
    tester,
  ) async {
    final clock = FakeMonotonicClock();
    await openHome(tester, clock: clock);
    await tapBar(tester, 'Investimentos');

    [
      AppLifecycleState.inactive,
      AppLifecycleState.hidden,
      AppLifecycleState.paused,
    ].forEach(tester.binding.handleAppLifecycleStateChanged);
    clock.current += const Duration(minutes: 6);
    [
      AppLifecycleState.hidden,
      AppLifecycleState.inactive,
      AppLifecycleState.resumed,
    ].forEach(tester.binding.handleAppLifecycleStateChanged);
    await tester.pumpAndSettle();

    expect(find.byType(UnlockScreen), findsOneWidget);
    expect(bar, findsNothing);
  });

  // D5, end to end: a locked PIN offers only "Sair"; the password signs back
  // in and resets the PIN on Profile > Configurações > Trocar PIN.
  testWidgets('recovers a locked PIN with the password', (tester) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    final store = FakeTokenStore(tokens);
    final unlock = FakeUnlockRepository()
      ..answer = () async => throw const ApiRejected(ApiErrorCode.pinLocked);
    final security = FakeSecurityRepository();
    await pumpApp(
      tester,
      store: store,
      repository: FakeAuthRepository(tokens),
      unlock: unlock,
      security: security,
    );
    await unlockWithPin(tester, '7413');
    expect(find.text('PIN bloqueado por 30 minutos.'), findsOneWidget);

    await tester.tap(find.text('Entrar com outra conta'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a long passphrase');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();
    await openProfileSettings(tester);
    await tester.tap(find.bySemanticsLabel('Trocar PIN'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), 'a long passphrase');
    await tester.enterText(find.byType(TextField).at(1), '1597');
    await tester.enterText(find.byType(TextField).at(2), '1597');
    await tester.tap(find.bySemanticsLabel('Trocar PIN').last);
    await tester.pumpAndSettle();

    expect(security.pinChanges, [
      (password: 'a long passphrase', newPin: '1597'),
    ]);
    expect(find.text('PIN alterado.'), findsOneWidget);
    expect(find.byType(ProfileScreen), findsOneWidget);
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone. Found
  // "Sair da conta" running past the edge, unable to wrap.
  testWidgets('the profile and the bar fit a small phone at 1.3x text', (
    tester,
  ) async {
    await openHome(tester);
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await tester.tap(find.bySemanticsLabel('Abrir perfil'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    // v1.1.0 plan, task 4.11: the new areas fit too.
    for (final label in ['Cartões', 'Investimentos', 'Menu']) {
      await tapBar(tester, label);
      expect(tester.takeException(), isNull, reason: label);
    }
  });
}
