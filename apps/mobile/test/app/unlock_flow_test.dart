import 'package:design_system/design_system.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

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
  }) async {
    final unlock = FakeUnlockRepository();
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      unlock: unlock,
      biometrics: biometrics,
      greeting: FakeGreetingNameStore('Ana'),
    );
    return unlock;
  }

  testWidgets('greets by the first name only', (tester) async {
    await openLocked(tester);

    expect(find.text('Olá, Ana'), findsOneWidget);
    expect(find.textContaining('Souza'), findsNothing);
  });

  testWidgets('without biometrics, takes the PIN right away', (tester) async {
    final unlock = await openLocked(tester);

    await unlockWithPin(tester);

    expect(unlock.pins, ['2580']);
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  testWidgets('"Acessar conta" unlocks with the PIN biometrics release', (
    tester,
  ) async {
    final biometrics = FakeBiometricPinStore(pin: '2580');
    final unlock = await openLocked(tester, biometrics: biometrics);
    expect(find.byType(PinField), findsNothing);

    await tester.tap(find.text('Acessar conta'));
    await tester.pumpAndSettle();

    expect(biometrics.reads, 1);
    expect(unlock.pins, ['2580']);
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
      biometrics: FakeBiometricPinStore(pin: '2580')
        ..nextRead = const BiometricCancelled(),
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
