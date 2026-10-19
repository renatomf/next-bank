import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The cards' shared pieces (v1.1.0 plan, tasks 4.14 and 4.15), used by the
// Home and the cards screen.
void main() {
  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(
        body: Padding(padding: const EdgeInsets.all(20), child: child),
      ),
    ),
  );

  group('PaymentCard', () {
    testWidgets('reads as its kind and last digits, with a generic brand', (
      tester,
    ) async {
      await pump(
        tester,
        const PaymentCard(
          label: 'Débito',
          lastFour: '0001',
          artArea: Alignment.topRight,
        ),
      );

      expect(
        find.bySemanticsLabel('Cartão Débito, final 0001'),
        findsOneWidget,
      );
      expect(find.byType(CardBrandMark), findsOneWidget);
      final size = tester.getSize(find.byType(PaymentCard));
      expect(
        size.width / size.height,
        moreOrLessEquals(PaymentCard.aspectRatio, epsilon: 0.01),
      );
    });
  });

  group('PeekCarousel', () {
    Widget carousel({int initialPage = 0, ValueChanged<int>? onPageChanged}) =>
        PeekCarousel(
          itemAspectRatio: 2,
          initialPage: initialPage,
          onPageChanged: onPageChanged ?? (_) {},
          children: const [Text('primeiro'), Text('segundo')],
        );

    testWidgets('shows a piece of the next item at the edge', (tester) async {
      await pump(tester, carousel());

      final width = tester.getSize(find.byType(PeekCarousel)).width;
      final next = tester.getTopLeft(find.text('segundo')).dx - 20;
      expect(next, lessThan(width));
      expect(next, greaterThan(width / 2));
    });

    testWidgets('tells the page swiped to', (tester) async {
      final pages = <int>[];
      await pump(tester, carousel(onPageChanged: pages.add));

      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await tester.pumpAndSettle();

      expect(pages, [1]);
    });

    testWidgets('opens on the page asked for', (tester) async {
      await pump(tester, carousel(initialPage: 1));

      expect(tester.getTopLeft(find.text('segundo')).dx, 20);
    });
  });

  // The Home's cards box: a row of lock and details under each card.
  testWidgets('makes room for a footer under each item', (tester) async {
    Future<double> heightWith(double footer) async {
      await pump(
        tester,
        PeekCarousel(
          itemAspectRatio: 2,
          footerHeight: footer,
          onPageChanged: (_) {},
          children: const [Text('primeiro')],
        ),
      );
      return tester.getSize(find.byType(PeekCarousel)).height;
    }

    final plain = await heightWith(0);
    expect(await heightWith(56), plain + 56);
  });

  group('CardLockToggle', () {
    testWidgets('switches between unlocked and locked, on the screen', (
      tester,
    ) async {
      await pump(tester, const CardLockToggle());
      expect(find.text('Desbloqueado'), findsOneWidget);
      expect(find.byIcon(Icons.lock_open), findsOneWidget);

      await tester.tap(find.byType(CardLockToggle));
      await tester.pump();
      expect(find.text('Bloqueado'), findsOneWidget);
      expect(find.byIcon(Icons.lock), findsOneWidget);
      expect(
        tester.getSemantics(find.byType(CardLockToggle)),
        isSemantics(
          label: 'Bloqueado',
          isButton: true,
          isToggled: true,
          hasToggledState: true,
          hasTapAction: true,
        ),
      );
    });
  });
}
