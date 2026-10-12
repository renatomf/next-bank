import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/app/router.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';

import '../support/fake_security_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// Signed in, unlocked, on Security.
Future<FakeSecurityRepository> openSecurity(
  WidgetTester tester, {
  FakeSecurityRepository? security,
}) async {
  // Tall enough for the whole screen to be built at once.
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  final fake = security ?? FakeSecurityRepository();
  final container = await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    security: fake,
  );
  await unlockWithPin(tester);
  container.read(routerProvider).go(AppRoutes.security);
  await tester.pumpAndSettle();
  return fake;
}

/// A field of the design system, found by the label above it.
Finder labeled(String label) => find.descendant(
  of: find.ancestor(of: find.text(label), matching: find.byType(Column)).first,
  matching: find.byType(TextField),
);

// Screen 14 and the changes through the real router (domain-model.md 11;
// week 7 plan, D3 to D5).
void main() {
  group('the sessions', () {
    testWidgets('marks this device, without a way to end it (D3)', (
      tester,
    ) async {
      await openSecurity(tester);

      expect(find.text('Android · Este aparelho'), findsOneWidget);
      expect(find.text('iOS'), findsOneWidget);
      expect(find.text('Encerrar'), findsOneWidget);
    });

    testWidgets('ends another device after the confirmation', (tester) async {
      final security = await openSecurity(tester);
      security.sessionsAnswer = () async => [
        session('this-phone', current: true),
      ];

      await tester.tap(find.text('Encerrar'));
      await tester.pumpAndSettle();
      expect(find.text('Encerrar esta sessão?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Encerrar').last);
      await tester.pumpAndSettle();

      expect(security.revoked, ['old-tablet']);
      expect(find.text('iOS'), findsNothing);
    });

    testWidgets('ends nothing when the confirmation is cancelled', (
      tester,
    ) async {
      final security = await openSecurity(tester);

      await tester.tap(find.text('Encerrar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();

      expect(security.revoked, isEmpty);
      expect(find.text('iOS'), findsOneWidget);
    });

    testWidgets('offers a retry when the devices cannot load', (tester) async {
      var fails = true;
      final security = FakeSecurityRepository()
        ..sessionsAnswer = () async => fails
            ? throw const ApiUnreachable()
            : [session('this-phone', current: true)];
      await openSecurity(tester, security: security);
      expect(
        find.text('Não foi possível carregar os aparelhos.'),
        findsOneWidget,
      );

      fails = false;
      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(find.text('Android · Este aparelho'), findsOneWidget);
    });
  });

  group('the PIN change', () {
    Future<void> fill(WidgetTester tester, {String confirm = '1597'}) async {
      await tester.tap(find.bySemanticsLabel(RegExp('Trocar PIN')).first);
      await tester.pumpAndSettle();
      await tester.enterText(labeled('Sua senha'), 'violet staple orbit 42');
      await tester.enterText(labeled('Novo PIN'), '1597');
      await tester.enterText(labeled('Digite o novo PIN de novo'), confirm);
      await tester.tap(find.bySemanticsLabel('Trocar PIN').last);
      await tester.pumpAndSettle();
    }

    testWidgets('changes the PIN and returns to Security', (tester) async {
      final security = await openSecurity(tester);

      await fill(tester);

      expect(security.pinChanges.single.newPin, '1597');
      expect(find.text('PIN alterado.'), findsOneWidget);
      expect(find.byType(ChangePinScreen), findsNothing);
      expect(find.text('Aparelhos conectados'), findsOneWidget);
    });

    testWidgets('says when the PINs differ, and clears the fields', (
      tester,
    ) async {
      final security = await openSecurity(tester);

      await fill(tester, confirm: '1598');

      expect(security.pinChanges, isEmpty);
      expect(
        find.text('Os PINs não conferem. Digite de novo.'),
        findsOneWidget,
      );
      // MOB-02: the secrets do not stay on the screen.
      for (final field in tester.widgetList<TextField>(
        find.byType(TextField),
      )) {
        expect(field.controller?.text, isEmpty);
      }
    });

    testWidgets('shows a wrong password beside the password', (tester) async {
      final security = await openSecurity(tester);
      security.answer = () async =>
          throw const ApiRejected(ApiErrorCode.passwordIncorrect);

      await fill(tester);

      expect(find.text('Senha incorreta.'), findsOneWidget);
      expect(find.byType(ChangePinScreen), findsOneWidget);
    });
  });

  group('the password change', () {
    testWidgets('changes the password and says the others left', (
      tester,
    ) async {
      final security = await openSecurity(tester);

      await tester.tap(find.bySemanticsLabel(RegExp('Trocar senha')).first);
      await tester.pumpAndSettle();
      await tester.enterText(labeled('Senha atual'), 'violet staple orbit 42');
      await tester.enterText(labeled('Nova senha'), 'amber kettle ridge 77');
      await tester.enterText(
        labeled('Digite a nova senha de novo'),
        'amber kettle ridge 77',
      );
      await tester.tap(find.bySemanticsLabel('Trocar senha').last);
      await tester.pumpAndSettle();

      expect(
        security.passwordChanges.single.newPassword,
        'amber kettle ridge 77',
      );
      expect(
        find.text('Senha alterada. Os outros aparelhos saíram da conta.'),
        findsOneWidget,
      );
      expect(find.byType(ChangePasswordScreen), findsNothing);
    });
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone.
  testWidgets('Security fits a small phone at 1.3x text', (tester) async {
    await openSecurity(tester);
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final router = GoRouter.of(tester.element(find.byType(Scaffold).last))
      ..go(AppRoutes.changePin);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    router.go(AppRoutes.changePassword);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  // Week 8 plan, V1: a failed pull keeps the sessions and says so on top.
  testWidgets('keeps the sessions when a pull fails, saying so on top', (
    tester,
  ) async {
    final security = await openSecurity(tester);

    security.sessionsAnswer = () async => throw const ApiUnreachable();
    await tester.fling(
      find
          .descendant(
            of: find.byType(SecurityScreen),
            matching: find.byType(Scrollable),
          )
          .first,
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();

    expect(find.text('iOS'), findsOneWidget);
    expect(find.byType(ErrorState), findsNothing);
    expect(
      find.descendant(
        of: find.byType(NbToast),
        matching: find.text('Sem conexão. Tente de novo.'),
      ),
      findsOneWidget,
    );
  });
}
