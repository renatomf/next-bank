import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notification_tile.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notifications_screen.dart';

import '../../../support/example_tag.dart';

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

  // S21 checkpoint: twelve rows, then "Carregar mais" brings twelve more,
  // past the six examples, a day back every two rows.
  testWidgets('loads twelve more rows on Carregar mais', (tester) async {
    await pumpNotifications(tester);
    final more = find.widgetWithText(TextButton, 'Carregar mais');

    await tester.scrollUntilVisible(more, 300);
    expect(find.text('14 out'), findsWidgets); // rows 10 and 11
    expect(find.text('13 out'), findsNothing);

    await tester.tap(more);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(more, 300);

    expect(find.text('8 out'), findsWidgets); // rows 22 and 23
    expect(find.text('7 out'), findsNothing);
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

  // D7, revised (v1.1.0 plan, task 6): a notification that cites a made-up
  // amount says it is an example; the others need no tag.
  testWidgets('marks only the notifications with an amount as examples', (
    tester,
  ) async {
    await pumpNotifications(tester);

    final tiles = find.byType(NotificationTile);
    var withAmount = 0;
    for (var i = 0; i < tiles.evaluate().length; i++) {
      final tile = tiles.at(i);
      final citesAmount = find
          .descendant(of: tile, matching: find.textContaining(r'R$'))
          .evaluate()
          .isNotEmpty;
      if (citesAmount) withAmount++;
      expect(
        exampleTagIn(tile),
        citesAmount ? findsOneWidget : findsNothing,
        reason: 'notification $i',
      );
    }
    expect(withAmount, greaterThan(0));
  });
}
