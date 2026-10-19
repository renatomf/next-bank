import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/notifications/presentation/settings/notification_settings_screen.dart';

Future<void> pumpSettings(WidgetTester tester, {VoidCallback? onBack}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: NotificationSettingsScreen(onBack: onBack ?? () {}),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openTab(WidgetTester tester, String tab) async {
  await tester.tap(find.widgetWithText(Tab, tab));
  await tester.pumpAndSettle();
}

// The notification settings, layout only (v1.1.0 plan, task 4.6).
void main() {
  for (final (tab, groups, channels) in [
    (
      'Transacionais',
      ['Pix e transferências', 'Pagamentos', 'Segurança'],
      ['Notificações no aplicativo'],
    ),
    (
      'Produtos',
      ['Novidades do next bank', 'Recarga'],
      ['Notificações no aplicativo', 'E-mail'],
    ),
    (
      'Outros',
      ['Pesquisas', 'Avisos'],
      ['Notificações no aplicativo', 'E-mail'],
    ),
  ]) {
    testWidgets('shows the $tab groups and their channels', (tester) async {
      tester.view.physicalSize = const Size(1080, 3600);
      addTearDown(tester.view.reset);
      await pumpSettings(tester);
      await openTab(tester, tab);

      for (final group in groups) {
        expect(find.text(group), findsOneWidget, reason: group);
      }
      for (final channel in channels) {
        expect(find.text(channel), findsWidgets, reason: channel);
      }
      expect(
        find.byType(Switch),
        findsNWidgets(groups.length * channels.length),
      );
    });
  }

  // Developer's call: the switches stay put and say they are coming.
  testWidgets('keeps a switch put and says it is coming', (tester) async {
    await pumpSettings(tester);
    final before = tester.widget<Switch>(find.byType(Switch).first).value;

    await tester.tap(find.byType(Switch).first);
    await tester.pumpAndSettle();

    expect(tester.widget<Switch>(find.byType(Switch).first).value, before);
    expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
  });

  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpSettings(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  for (final tab in ['Transacionais', 'Produtos', 'Outros']) {
    testWidgets('fits a small phone at 1.3x text on $tab', (tester) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpSettings(tester);
      await openTab(tester, tab);

      expect(tester.takeException(), isNull);
    });
  }
}
