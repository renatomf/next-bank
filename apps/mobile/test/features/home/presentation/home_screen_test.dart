import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/home/presentation/pix_box/cpf_key_row.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';

import '../../../support/device_stores.dart';
import '../../../support/fake_account_repository.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_statement_repository.dart';
import '../../../support/fake_token_store.dart';
import '../../../support/pump_app.dart';

Future<void> pumpHome(
  WidgetTester tester, {
  FakeAccountRepository? account,
  FakeStatementRepository? statement,
  DateTime? now,
  VoidCallback? onPix,
  VoidCallback? onPay,
  VoidCallback? onReceive,
  VoidCallback? onStatement,
  ValueChanged<String>? onPixWithKey,
  VoidCallback? onTransfer,
  VoidCallback? onAutomatic,
  VoidCallback? onKeys,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
        accountRepositoryProvider.overrideWithValue(
          account ?? FakeAccountRepository(),
        ),
        nowProvider.overrideWithValue(() => now ?? DateTime(2026, 10, 7, 9)),
        statementRepositoryProvider.overrideWithValue(
          statement ?? FakeStatementRepository(),
        ),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: HomeScreen(
          onPix: onPix ?? () {},
          onPay: onPay ?? () {},
          onReceive: onReceive ?? () {},
          onStatement: onStatement ?? () {},
          onPixWithKey: onPixWithKey ?? (_) {},
          onTransfer: onTransfer ?? () {},
          onAutomatic: onAutomatic ?? () {},
          onKeys: onKeys ?? () {},
        ),
      ),
    ),
  );
}

// Screen 6, Home (domain-model.md, section 11): skeleton, ready, hidden
// balance and error; mockups home-dark and home-light.
void main() {
  testWidgets('shows placeholders while the balance loads', (tester) async {
    final account = FakeAccountRepository();
    final gate = Completer<void>();
    account.answer = () => gate.future;
    await pumpHome(tester, account: account);
    await tester.pump();

    expect(find.bySemanticsLabel('Carregando saldo'), findsOneWidget);

    gate.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('shows the customer and the available balance', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();
    await showBalance(tester);

    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Saldo disponível · Conta •••• 0004'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  // Week 8 plan, V3 and V8: the profile icon, the first name and the logo on
  // one line; no greeting and no slogan.
  testWidgets('heads the Home with the profile icon, the name and the logo', (
    tester,
  ) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    final name = tester.getCenter(find.text('Ana'));
    final icon = tester.getCenter(find.byIcon(Icons.person_outline));
    // The balance card has its own logo; the header's comes first.
    final logo = tester.getCenter(
      find
          .descendant(
            of: find.byType(HomeScreen),
            matching: find.byType(NextLogo),
          )
          .first,
    );
    expect(icon.dx, lessThan(name.dx));
    expect(logo.dx, greaterThan(name.dx));
    expect((icon.dy - name.dy).abs(), lessThan(30));
    expect((logo.dy - name.dy).abs(), lessThan(30));
    for (final greeting in ['Bom dia,', 'Boa tarde,', 'Boa noite,']) {
      expect(find.text(greeting), findsNothing);
    }
    expect(find.byType(DisplayTitle), findsNothing);
  });

  // Week 8 plan, V6 and V7: four shortcuts; only the Pix opens a screen, the
  // others say they are coming.
  testWidgets('opens the Pix from its shortcut, with its symbol', (
    tester,
  ) async {
    var opened = 0;
    await pumpHome(tester, onPix: () => opened++);
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.widgetWithText(ActionTile, 'Área Pix'),
        matching: find.byType(PixMark),
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Área Pix'));
    await tester.pumpAndSettle();

    expect(opened, 1);
  });

  // v1.1.0 plan, task 4: "Pagar" reads a Pix QR Code.
  testWidgets('opens the QR Code reading on "Pagar"', (tester) async {
    var paid = 0;
    await pumpHome(tester, onPay: () => paid++);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Pagar'));
    await tester.pumpAndSettle();

    expect(paid, 1);
    expect(find.widgetWithText(NbToast, 'Em breve.'), findsNothing);
  });

  // S21 checkpoint: the statement opens from the balance card, and the
  // latest movements no longer repeat the link.
  testWidgets('opens the statement from the balance card', (tester) async {
    var opened = 0;
    await pumpHome(tester, onStatement: () => opened++);
    await tester.pumpAndSettle();

    await tester.tap(
      find.descendant(
        of: find.byType(BalanceCard),
        matching: find.bySemanticsLabel('Ver extrato'),
      ),
    );
    await tester.pumpAndSettle();

    expect(opened, 1);
    expect(find.widgetWithText(TextButton, 'Ver extrato'), findsNothing);
  });

  // v1.1.0 plan, task 3, at the S21 checkpoint: "Receber" beside "Pagar".
  testWidgets('opens "Receber" on its shortcut', (tester) async {
    var received = 0;
    await pumpHome(tester, onReceive: () => received++);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Receber'));
    await tester.pumpAndSettle();

    expect(received, 1);
  });

  // Developer's call at the S21 checkpoint: the shortcuts scroll sideways.
  testWidgets('lists the shortcuts sideways, in order', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    // The nearest list above the tiles; the Home's own list scrolls down.
    final list = tester.widget<ListView>(
      find
          .ancestor(
            of: find.widgetWithText(ActionTile, 'Área Pix'),
            matching: find.byType(ListView),
          )
          .first,
    );
    expect(list.scrollDirection, Axis.horizontal);
    final labels = tester
        .widgetList<ActionTile>(find.byType(ActionTile))
        .map((tile) => tile.label);
    expect(labels, ['Área Pix', 'Pagar', 'Receber', 'Transferir', 'Recarga']);
  });

  // v1.1.0 plan, task 4.2: the Pix box, in place of the latest movements.
  group('the Pix box', () {
    Finder keyField() => find.descendant(
      of: find.byType(PixBox),
      matching: find.byType(TextField),
    );

    Future<void> scrollToBox(WidgetTester tester) async {
      await tester.scrollUntilVisible(
        find.text('Minhas\nchaves'),
        200,
        scrollable: find
            .descendant(
              of: find.byType(HomeScreen),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();
    }

    testWidgets('takes the place of the latest movements', (tester) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();

      expect(find.byType(PixBox), findsOneWidget);
      expect(find.text('Últimas movimentações'), findsNothing);
    });

    testWidgets('opens the Pix with a valid CPF, in digits', (tester) async {
      final keys = <String>[];
      await pumpHome(tester, onPixWithKey: keys.add);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      await tester.enterText(keyField(), '52998224725');
      await tester.tap(find.bySemanticsLabel('Continuar com a chave'));
      await tester.pumpAndSettle();

      expect(keys, ['52998224725']);
    });

    testWidgets('opens the Pix area when the field is empty', (tester) async {
      var opened = 0;
      await pumpHome(tester, onPix: () => opened++);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      await tester.tap(find.bySemanticsLabel('Continuar com a chave'));
      await tester.pumpAndSettle();

      expect(opened, 1);
    });

    testWidgets('says an invalid CPF is invalid, going nowhere (PIX-07)', (
      tester,
    ) async {
      final keys = <String>[];
      var opened = 0;
      await pumpHome(tester, onPixWithKey: keys.add, onPix: () => opened++);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      await tester.enterText(keyField(), '12345678900');
      await tester.tap(find.bySemanticsLabel('Continuar com a chave'));
      await tester.pumpAndSettle();

      expect(find.text('CPF inválido.'), findsOneWidget);
      expect(keys, isEmpty);
      expect(opened, 0);
    });

    for (final (label, callback) in [
      ('Transferir Pix', 'transfer'),
      ('Pagar QR Code', 'pay'),
      ('Gerar QR Code', 'receive'),
      ('Pix Automático', 'automatic'),
      ('Minhas chaves', 'keys'),
    ]) {
      testWidgets('runs "$label"', (tester) async {
        final ran = <String>[];
        await pumpHome(
          tester,
          onTransfer: () => ran.add('transfer'),
          onPay: () => ran.add('pay'),
          onReceive: () => ran.add('receive'),
          onAutomatic: () => ran.add('automatic'),
          onKeys: () => ran.add('keys'),
        );
        await tester.pumpAndSettle();
        await scrollToBox(tester);

        await tester.tap(
          find.descendant(
            of: find.byType(PixBox),
            matching: find.bySemanticsLabel(label),
          ),
        );
        await tester.pumpAndSettle();

        expect(ran, [callback]);
      });
    }

    // Developer's call at the checkpoint: the CPF masked by the server on
    // the start, "Cadastrar" (no action yet) on the end.
    testWidgets('shows the masked CPF, with "Cadastrar" apart on the end', (
      tester,
    ) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      expect(find.text('***.444.777-**'), findsOneWidget);

      // On the row's two ends (developer's call): the icon on the start, the
      // "Cadastrar" text on the end, both one padding from the edge.
      final row = find.byType(CpfKeyRow);
      final icon = find.descendant(
        of: row,
        matching: find.byIcon(Icons.badge_outlined),
      );
      final register = find.text('Cadastrar');
      expect(
        tester.getTopLeft(icon).dx - tester.getTopLeft(row).dx,
        moreOrLessEquals(NbSpace.md, epsilon: 1),
      );
      expect(
        tester.getTopRight(row).dx - tester.getTopRight(register).dx,
        moreOrLessEquals(NbSpace.md, epsilon: 1),
      );
    });

    // As in the reference: the icon on the link's start edge, the text
    // centered in the room beside it.
    for (final (label, text) in [
      ('Pix Automático', 'Pix\nAutomático'),
      ('Minhas chaves', 'Minhas\nchaves'),
    ]) {
      testWidgets('puts the icon of "$label" on the start, its text centered', (
        tester,
      ) async {
        await pumpHome(tester);
        await tester.pumpAndSettle();
        await scrollToBox(tester);

        final link = find.descendant(
          of: find.byType(PixBox),
          matching: find.bySemanticsLabel(label),
        );
        final icon = find
            .descendant(
              of: link,
              matching: find.byWidgetPredicate(
                (widget) => widget is PixMark || widget is Icon,
              ),
            )
            .first;
        final words = find.descendant(of: link, matching: find.text(text));

        expect(
          tester.getTopLeft(icon).dx - tester.getTopLeft(link).dx,
          lessThanOrEqualTo(NbSpace.lg),
        );
        expect(tester.widget<Text>(words).textAlign, TextAlign.center);
        // Centered between the icon and the link's end.
        final room =
            (tester.getTopRight(icon).dx + tester.getTopRight(link).dx) / 2;
        expect(tester.getCenter(words).dx, moreOrLessEquals(room, epsilon: 8));
      });
    }

    // Developer's call: two-line labels, as in the reference.
    testWidgets('breaks the labels in two lines', (tester) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      for (final label in [
        'Transferir\nPix',
        'Pagar\nQR Code',
        'Gerar\nQR Code',
        'Pix\nAutomático',
        'Minhas\nchaves',
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
    });

    // Found at the checkpoint: on a narrow column with large text, a word
    // wider than the column broke in the middle ("Transferi/r"). The labels
    // keep their two lines, shrinking to fit instead.
    testWidgets('never breaks a word on a small phone at 1.3x text', (
      tester,
    ) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpHome(tester);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      for (final label in [
        'Transferir\nPix',
        'Pagar\nQR Code',
        'Gerar\nQR Code',
        'Pix\nAutomático',
        'Minhas\nchaves',
      ]) {
        expect(lineCount(tester, find.text(label)), 2, reason: label);
      }
    });

    testWidgets('puts the Pix symbol on "Pix Automático", split from "Minhas '
        'chaves" by a line', (tester) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();
      await scrollToBox(tester);

      final automatic = find.descendant(
        of: find.byType(PixBox),
        matching: find.bySemanticsLabel('Pix Automático'),
      );
      expect(
        find.descendant(
          of: find.byType(PixBox),
          matching: find.byType(PixMark),
        ),
        findsOneWidget,
      );
      expect(
        tester.getCenter(automatic).dy,
        moreOrLessEquals(
          tester
              .getCenter(
                find.descendant(
                  of: find.byType(PixBox),
                  matching: find.bySemanticsLabel('Minhas chaves'),
                ),
              )
              .dy,
          epsilon: 1,
        ),
      );
    });
  });

  for (final shortcut in ['Transferir', 'Recarga']) {
    testWidgets('says "$shortcut" is coming, without leaving', (tester) async {
      var opened = 0;
      await pumpHome(tester, onPix: () => opened++);
      await tester.pumpAndSettle();

      await tester.tap(find.text(shortcut));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
      expect(opened, 0);
    });
  }

  // Week 8 plan, V11: help and notifications beside the help field.
  for (final button in ['Ajuda', 'Notificações']) {
    testWidgets('says "$button" is coming', (tester) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();

      await tester.tap(find.bySemanticsLabel(button));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  // Week 8 plan, V13: the four shortcuts share one size, labels on one line.
  testWidgets('lays the shortcuts out in one size', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    final sizes = tester
        .widgetList(find.byType(ActionTile))
        .map((tile) => tester.getSize(find.byWidget(tile)))
        .toSet();
    expect(sizes, hasLength(1));
  });

  // Week 8 plan, V9: the help field is a button that says it is coming.
  testWidgets('says the assistant is coming', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Posso te ajudar?'));
    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(NbToast, 'Em breve: assistente com IA.'),
      findsOneWidget,
    );
  });

  // MOB-05, week 8 plan V14: the balance starts hidden at every opening, and
  // the eye shows it and hides it again.
  testWidgets('starts with the balance hidden, and the eye toggles it', (
    tester,
  ) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);

    await tester.tap(find.bySemanticsLabel('Mostrar saldo'));
    await tester.pump();
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Ocultar saldo'));
    await tester.pump();
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);
  });

  testWidgets('says the balance could not load and tries again', (
    tester,
  ) async {
    final account = FakeAccountRepository();
    var calls = 0;
    account.answer = () async {
      if (calls++ == 0) throw const ApiUnreachable();
    };
    await pumpHome(tester, account: account);
    await tester.pumpAndSettle();

    expect(find.text('Não foi possível carregar seu saldo.'), findsOneWidget);

    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();

    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    expect(account.fetches, 2);
  });

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpHome(tester);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}

/// How many lines the text found by [finder] was laid out in.
int lineCount(WidgetTester tester, Finder finder) {
  final paragraph = tester.renderObject<RenderParagraph>(finder);
  final text = paragraph.text.toPlainText();
  final boxes = paragraph.getBoxesForSelection(
    TextSelection(baseOffset: 0, extentOffset: text.length),
  );
  return boxes.map((box) => box.top).toSet().length;
}
