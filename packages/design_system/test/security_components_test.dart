import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The confirmation before ending a session (domain-model.md 11, screen 14).
void main() {
  Future<bool?> openDialog(WidgetTester tester) async {
    bool? answer;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                answer = await showConfirmDialog(
                  context,
                  title: 'Encerrar sessão?',
                  message: 'O aparelho sai da sua conta.',
                  confirmLabel: 'Encerrar',
                  cancelLabel: 'Cancelar',
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return answer;
  }

  testWidgets('says what is about to happen', (tester) async {
    await openDialog(tester);

    expect(find.text('Encerrar sessão?'), findsOneWidget);
    expect(find.text('O aparelho sai da sua conta.'), findsOneWidget);
    expect(find.text('Cancelar'), findsOneWidget);
  });

  testWidgets('is yes only when the action is chosen', (tester) async {
    bool? answer;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                answer = await showConfirmDialog(
                  context,
                  title: 'Encerrar sessão?',
                  message: 'O aparelho sai da sua conta.',
                  confirmLabel: 'Encerrar',
                  cancelLabel: 'Cancelar',
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Encerrar'));
    await tester.pumpAndSettle();
    expect(answer, isTrue);

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(answer, isFalse);
  });

  testWidgets('dismissing it is a no', (tester) async {
    bool? answer;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                answer = await showConfirmDialog(
                  context,
                  title: 'Encerrar sessão?',
                  message: 'O aparelho sai da sua conta.',
                  confirmLabel: 'Encerrar',
                  cancelLabel: 'Cancelar',
                );
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();

    expect(answer, isFalse);
  });
}
