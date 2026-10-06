import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';

/// Home screen. For now it shows whether the API is reachable;
/// the balance arrives in week 4.
class HomeScreen extends ConsumerWidget {
  /// Creates the home screen with the app bar [actions] the app provides.
  const new({this.actions = const [], super.key});

  /// Buttons on the app bar, such as sign-out.
  final List<Widget> actions;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(apiStatusProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('next bank'), actions: actions),
      body: Center(
        child: switch (status) {
          AsyncData(value: ApiStatus.available) => const _StatusMessage(
            icon: Icons.check_circle_outline,
            message: 'API disponível',
          ),
          AsyncData() || AsyncError() => _StatusMessage(
            icon: Icons.cloud_off_outlined,
            message: 'API indisponível',
            onRetry: () => ref.invalidate(apiStatusProvider),
          ),
          _ => const CircularProgressIndicator(
            semanticsLabel: 'Verificando a API',
          ),
        },
      ),
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const new({required this.icon, required this.message, this.onRetry});

  final IconData icon;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48),
        const SizedBox(height: 12),
        Text(message, style: Theme.of(context).textTheme.titleMedium),
        if (onRetry case final retry?) ...[
          const SizedBox(height: 16),
          FilledButton(onPressed: retry, child: const Text('Tentar novamente')),
        ],
      ],
    );
  }
}
