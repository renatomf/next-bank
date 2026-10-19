import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notification_tile.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notifications_screen.dart';

Future<void> pumpNotifications(
  WidgetTester tester, {
  VoidCallback? onBack,
  VoidCallback? onSettings,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [nowProvider.overrideWithValue(() => DateTime(2026, 10, 19))],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: NotificationsScreen(
          onBack: onBack ?? () {},
          onSettings: onSettings ?? () {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

// The notifications, layout only (v1.1.0 plan, task 4.6): example rows
// that scroll without end.
void main() {
  testWidgets('shows a row with its category, preview, date and unread', (
    tester,
  ) async {
    await pumpNotifications(tester);

    final first = find.byType(NotificationTile).first;
    expect(
      find.descendant(of: first, matching: find.text('Pix e transferências')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: first, matching: find.text('19 out')),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel(RegExp('3 não lidas')), findsWidgets);
  });

  testWidgets('scrolls past the examples without end, a day back every two', (
    tester,
  ) async {
    await pumpNotifications(tester);

    // Row 28 and on: well past the six examples.
    await tester.scrollUntilVisible(find.text('5 out'), 500);

    expect(find.text('5 out'), findsWidgets);
  });

  testWidgets('says a row is coming', (tester) async {
    await pumpNotifications(tester);

    await tester.tap(find.byType(NotificationTile).first);
    await tester.pumpAndSettle();

    expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
  });

  testWidgets('goes back and to the settings where the app says', (
    tester,
  ) async {
    final went = <String>[];
    await pumpNotifications(
      tester,
      onBack: () => went.add('back'),
      onSettings: () => went.add('settings'),
    );

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.tap(find.bySemanticsLabel('Configurar notificações'));

    expect(went, ['back', 'settings']);
  });

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpNotifications(tester);

    expect(tester.takeException(), isNull);
  });
}
