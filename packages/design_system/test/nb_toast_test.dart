import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// A short notice over the screen, on top and in the app's colors (week 8
// plan, V1): never hidden behind the navigation bar.
void main() {
  Future<BuildContext> pumpHost(WidgetTester tester) async {
    late BuildContext context;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Builder(
          builder: (inner) {
            context = inner;
            return const Scaffold(body: SizedBox.expand());
          },
        ),
      ),
    );
    return context;
  }

  testWidgets('shows the message on top and is announced', (tester) async {
    final context = await pumpHost(tester);

    showNbToast(context, 'Sem conexão. Tente de novo.');
    await tester.pumpAndSettle();

    expect(find.text('Sem conexão. Tente de novo.'), findsOneWidget);
    expect(tester.getRect(find.byType(NbToast)).top, lessThan(100));
    final node = tester.getSemantics(find.byType(NbToast));
    expect(node.flagsCollection.isLiveRegion, isTrue);
  });

  testWidgets('goes away by itself after 4 seconds', (tester) async {
    final context = await pumpHost(tester);

    showNbToast(context, 'Sem conexão. Tente de novo.');
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();

    expect(find.byType(NbToast), findsNothing);
  });

  testWidgets('goes away when tapped', (tester) async {
    final context = await pumpHost(tester);

    showNbToast(context, 'Sem conexão. Tente de novo.');
    await tester.pumpAndSettle();
    await tester.tap(find.byType(NbToast));
    await tester.pumpAndSettle();

    expect(find.byType(NbToast), findsNothing);
  });

  testWidgets('shows one notice at a time, the newest', (tester) async {
    final context = await pumpHost(tester);

    showNbToast(context, 'Primeiro aviso.');
    await tester.pumpAndSettle();
    showNbToast(context, 'Segundo aviso.');
    await tester.pumpAndSettle();

    expect(find.byType(NbToast), findsOneWidget);
    expect(find.text('Segundo aviso.'), findsOneWidget);
  });
}
