import 'package:flutter/material.dart';
import 'package:next_bank/features/cards/presentation/example_cards.dart';
import 'package:next_bank/features/cards/presentation/payment_card.dart';

/// The cards side by side, swiped one at a time; the next shows cut at the
/// edge, so the row reads as something to swipe (v1.1.0 plan, task 4.14).
class CardCarousel extends StatefulWidget {
  /// Creates the carousel; [onPageChanged] gets the index of the card on.
  const new({required this.cards, required this.onPageChanged, super.key});

  /// The cards, in order.
  final List<ExampleCard> cards;

  /// Called when another card comes in.
  final ValueChanged<int> onPageChanged;

  @override
  State<CardCarousel> createState() => _CardCarouselState();
}

class _CardCarouselState extends State<CardCarousel> {
  /// Each card takes most of the width, leaving room for the next one.
  static const double _cardShare = 0.86;

  final PageController _pages = PageController(viewportFraction: _cardShare);

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // As tall as one card in its share of the width.
    return AspectRatio(
      aspectRatio: PaymentCard.aspectRatio / _cardShare,
      child: PageView.builder(
        controller: _pages,
        // The first card on the start edge, as the reference.
        padEnds: false,
        itemCount: widget.cards.length,
        onPageChanged: widget.onPageChanged,
        itemBuilder: (_, index) => Padding(
          padding: const EdgeInsets.only(right: 12),
          child: PaymentCard(card: widget.cards[index]),
        ),
      ),
    );
  }
}
