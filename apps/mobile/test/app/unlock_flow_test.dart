import 'package:design_system/design_system.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import '../support/fake_biometric_check.dart';
import '../support/fake_biometric_pin_store.dart';
import '../support/fake_greeting_name_store.dart';
import '../support/fake_token_store.dart';
import '../support/fake_unlock_repository.dart';
import '../support/pump_app.dart';

// v1.1.0 plan, task 2: the Unlock screen greets by the first name and offers
// biometrics when enabled (MOB-11, MOB-12).
void main() {
  Future<FakeUnlockRepository> openLocked(
    WidgetTester tester, {
    FakeBiometricPinStore? biometrics,
    FakeBiometricCheck? check,
  }) async {
    final unlock = FakeUnlockRepository();
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      unlock: unlock,
      biometrics: biometrics,
      check: check,
      greeting: FakeGreetingNameStore('Ana'),
    );
    return unlock;
  }

  testWidgets('greets by the first name only', (tester) async {
    await openLocked(tester);

    expect(find.text('Olá, Ana'), findsOneWidget);
    expect(find.textContaining('Souza'), findsNothing);
  });

  testWidgets('lays the mint glass art behind the greeting', (tester) async {
    await openLocked(tester);

    expect(find.byType(GlassArt), findsOneWidget);
  });

  testWidgets('without biometrics, takes the PIN right away', (tester) async {
    final unlock = await openLocked(tester);

    await unlockWithPin(tester);

    expect(unlock.pins, ['2580']);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  // Task 2.1 (ADR 0013, MOB-13): face or fingerprint opens the app on the
  // phone, without the server and without releasing the kept PIN.
  testWidgets('"Acessar conta" unlocks with the face or a fingerprint', (
    tester,
  ) async {
    final biometrics = FakeBiometricPinStore(pin: '2580');
    final check = FakeBiometricCheck();
    final unlock = await openLocked(
      tester,
      biometrics: biometrics,
      check: check,
    );
    expect(find.byType(PinField), findsNothing);

    await tester.tap(find.text('Acessar conta'));
    await tester.pumpAndSettle();

    expect(check.checks, 1);
    expect(biometrics.reads, 0);
    expect(unlock.pins, isEmpty);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('"Usar PIN" shows the PIN field instead', (tester) async {
    final unlock = await openLocked(
      tester,
      biometrics: FakeBiometricPinStore(pin: '2580'),
    );

    await tester.tap(find.text('Usar PIN'));
    await tester.pumpAndSettle();
    await unlockWithPin(tester);

    expect(unlock.pins, ['2580']);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('a cancelled prompt leaves the PIN field to type', (
    tester,
  ) async {
    await openLocked(
      tester,
      biometrics: FakeBiometricPinStore(pin: '2580'),
      check: FakeBiometricCheck(passes: false),
    );

    await tester.tap(find.text('Acessar conta'));
    await tester.pumpAndSettle();

    expect(find.byType(PinField), findsOneWidget);
  });

  testWidgets('"Entrar com outra conta" signs out', (tester) async {
    await openLocked(tester);

    await tester.ensureVisible(find.text('Entrar com outra conta'));
    await tester.tap(find.text('Entrar com outra conta'));
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
