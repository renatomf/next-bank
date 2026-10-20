import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/cards/example_cards.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/cards/presentation/credit_card_panel.dart';
import 'package:next_bank/features/cards/presentation/debit_card_panel.dart';

/// Cartões (v1.1.0 plan, task 4.14), a destination of the bar, layout only
/// for now: the carousel of the debit and the credit card, and below it
/// the content of the card on, as a tab.
class CardsScreen extends ConsumerStatefulWidget {
  /// Creates the screen on the card at [initialIndex].
  const new({required this.onBack, this.initialIndex = 0, super.key});

  /// Leaves the area, to the Home.
  final VoidCallback onBack;

  /// The card on at first, such as the one the Home's Detalhes opened.
  final int initialIndex;

  @override
  ConsumerState<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends ConsumerState<CardsScreen> {
  late int _index = widget.initialIndex;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final card = exampleCards[_index];
    final name = ref.watch(profileProvider).value?.name ?? '';

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              // As the Pix screen: back, the title centered, an action.
              ScreenHeader(
                title: 'Cartões',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
                action: NbIconButton(
                  icon: Icons.more_vert,
                  label: 'Mais opções do cartão',
                  onPressed: () => showNbToast(
                    context,
                    'Em breve.',
                    icon: Icons.info_outline,
                  ),
                ),
              ),
              const SizedBox(height: NbSpace.lg),
              PeekCarousel(
                itemAspectRatio: PaymentCard.aspectRatio,
                initialPage: widget.initialIndex,
                onPageChanged: (index) => setState(() => _index = index),
                children: [
                  for (final card in exampleCards)
                    PaymentCard(
                      label: card.label,
                      lastFour: card.lastFour,
                      artArea: card.artArea,
                    ),
                ],
              ),
              const SizedBox(height: NbSpace.md),
              Text(
                '$name · •••• ${card.lastFour} · ${card.label}',
                textAlign: TextAlign.center,
                style: NbType.bodyText.copyWith(color: colors.text),
              ),
              const SizedBox(height: NbSpace.sm),
              _PageDots(count: exampleCards.length, current: _index),
              const SizedBox(height: NbSpace.xl),
              switch (card.kind) {
                CardKind.debit => const DebitCardPanel(),
                CardKind.credit => const CreditCardPanel(),
              },
            ],
          ),
        ),
      ),
    );
  }
}

/// Which card is on, as a short bar among dots.
class _PageDots extends StatelessWidget {
  const new({required this.count, required this.current});

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: NbSpace.xs,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: i == current ? 16 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: i == current ? colors.accent : colors.border,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
        ],
      ),
    );
  }
}
