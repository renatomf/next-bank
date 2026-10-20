import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notifications_screen.dart';
import 'package:next_bank/features/notifications/presentation/settings/notification_settings_screen.dart';

import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

Future<void> tap(WidgetTester tester, String label) async {
  await tester.tap(find.bySemanticsLabel(label).first);
  await tester.pumpAndSettle();
}

// The notifications through the real router (v1.1.0 plan, task 4.6): each
// screen goes back to the one below it.
void main() {
  testWidgets('opens from the bell, then its settings, and back each step', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpApp(tester, store: FakeTokenStore(tokens));
    await unlockWithPin(tester);

    await tap(tester, 'Notificações');
    expect(find.byType(NotificationsScreen), findsOneWidget);

    await tap(tester, 'Configurar notificações');
    expect(find.byType(NotificationSettingsScreen), findsOneWidget);

    await tap(tester, 'Voltar');
    expect(find.byType(NotificationsScreen), findsOneWidget);

    await tap(tester, 'Voltar');
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
