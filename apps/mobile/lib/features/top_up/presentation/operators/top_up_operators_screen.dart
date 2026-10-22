import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/top_up_providers.dart';

/// Recargas (v1.1.0 plan, task 5b): the operators as the server lists them
/// (D6), each with its initials in place of a logo. No recent top-ups yet
/// (R3).
class TopUpOperatorsScreen extends ConsumerWidget {
  /// Creates the screen; the router says where back and an operator go.
  const new({required this.onBack, required this.onOperator, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Opens the number and the amount for an operator.
  final ValueChanged<TopUpOperator> onOperator;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final operators = ref.watch(topUpOperatorsProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Recargas',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              Semantics(
                header: true,
                child: Text(
                  'Escolha a operadora',
                  style: context.nbText.sectionTitle,
                ),
              ),
              const SizedBox(height: NbSpace.sm),
              ...switch (operators) {
                AsyncData(:final value) => [
                  for (final operator in value)
                    _OperatorRow(
                      operator: operator,
                      onTap: () => onOperator(operator),
                    ),
                ],
                AsyncError() => [
                  ErrorState(
                    retryLabel: CommonCopy.retry,
                    message: 'Não foi possível carregar as operadoras.',
                    onRetry: () => ref.invalidate(topUpOperatorsProvider),
                  ),
                ],
                _ => const [
                  Center(
                    child: CircularProgressIndicator(
                      semanticsLabel: 'Carregando as operadoras',
                    ),
                  ),
                ],
              },
            ],
          ),
        ),
      ),
    );
  }
}

class _OperatorRow extends StatelessWidget {
  const new({required this.operator, required this.onTap});

  final TopUpOperator operator;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: operator.name,
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.md),
          child: Row(
            spacing: NbSpace.lg,
            children: [
              InitialsAvatar(initials: operator.initials),
              Expanded(
                child: Text(operator.name, style: context.nbText.bodyText),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
