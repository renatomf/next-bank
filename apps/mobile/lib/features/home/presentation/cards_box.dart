import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/cards/example_cards.dart';

/// "Meus cartões" on the Home (v1.1.0 plan, task 4.15): the cards' carousel,
/// as on the cards screen, with a lock and "Detalhes" under each card. The
/// lock switches on the screen only; Detalhes opens that card.
class CardsBox extends StatelessWidget {
  /// Creates the box; [onDetails] gets the index of the card tapped.
  const new({required this.onDetails, super.key});

  /// Opens a card on the cards screen.
  final ValueChanged<int> onDetails;

  /// The row under each card: the lock and Detalhes.
  static const double _footerHeight = NbSpace.sm + kMinInteractiveDimension;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      padding: const EdgeInsets.all(NbSpace.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.box),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              'Meus cartões',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const SizedBox(height: NbSpace.lg),
          PeekCarousel(
            itemAspectRatio: PaymentCard.aspectRatio,
            footerHeight: _footerHeight,
            onPageChanged: (_) {},
            children: [
              for (final (index, card) in exampleCards.indexed)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // The row takes what it needs; the card fits the rest,
                    // so larger text never runs past the page.
                    Expanded(
                      child: Align(
                        alignment: Alignment.topLeft,
                        child: PaymentCard(
                          label: card.label,
                          lastFour: card.lastFour,
                          artArea: card.artArea,
                        ),
                      ),
                    ),
                    const SizedBox(height: NbSpace.sm),
                    Row(
                      children: [
                        // Both shrink rather than wrap on a small phone with
                        // large text.
                        const Expanded(
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: CardLockToggle(),
                            ),
                          ),
                        ),
                        // On the end edge, apart from the lock.
                        Flexible(
                          child: Align(
                            alignment: Alignment.centerRight,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: TextButton(
                                onPressed: () => onDetails(index),
                                child: const Text('Detalhes'),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
