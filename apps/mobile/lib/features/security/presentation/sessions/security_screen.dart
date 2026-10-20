import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/refresh_failure.dart';
import 'package:next_bank/core/statement/statement_texts.dart';
import 'package:next_bank/features/security/domain/active_session.dart';
import 'package:next_bank/features/security/presentation/biometrics/biometrics_tile.dart';
import 'package:next_bank/features/security/presentation/sessions/sessions_controller.dart';

/// Security (screen 14): the devices signed in, ending another one after a
/// confirmation, and the PIN and password changes.
class SecurityScreen extends ConsumerWidget {
  /// Creates the screen; the router says where each action goes. Without
  /// [onBack], the screen has no back arrow (a destination of the bar).
  const new({
    required this.onChangePin,
    required this.onChangePassword,
    this.onBack,
    super.key,
  });

  /// Leaves the screen, when it was opened over another one.
  final VoidCallback? onBack;

  /// Opens the PIN change.
  final VoidCallback onChangePin;

  /// Opens the password change.
  final VoidCallback onChangePassword;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final back = onBack;
    toastFailedRefresh(context, ref, sessionsControllerProvider);
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: () async {
              try {
                ref.invalidate(sessionsControllerProvider);
                await ref.read(sessionsControllerProvider.future);
              } on ApiFailure {
                // Told by the toast; the sessions stay.
              }
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(NbSpace.screen),
              children: [
                if (back != null)
                  ScreenHeader(
                    title: 'Segurança',
                    icon: Icons.arrow_back,
                    iconLabel: 'Voltar',
                    onPressed: back,
                  )
                else
                  Semantics(
                    header: true,
                    child: Text('Segurança', style: text.headlineSmall),
                  ),
                const SizedBox(height: NbSpace.xl),
                Text('Acesso', style: text.titleMedium),
                const SizedBox(height: NbSpace.md),
                _Action(
                  icon: Icons.pin_outlined,
                  title: 'Trocar PIN',
                  caption: 'Também desbloqueia um PIN bloqueado',
                  onTap: onChangePin,
                ),
                const SizedBox(height: NbSpace.sm),
                _Action(
                  icon: Icons.lock_reset,
                  title: 'Trocar senha',
                  caption: 'Desconecta os outros aparelhos',
                  onTap: onChangePassword,
                ),
                const BiometricsTile(),
                const SizedBox(height: NbSpace.xl),
                Text('Aparelhos conectados', style: text.titleMedium),
                const SizedBox(height: NbSpace.md),
                const _Sessions(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Sessions extends ConsumerWidget {
  const new();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (ref.watch(sessionsControllerProvider)) {
      AsyncValue(:final value?) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (value.error case final error?) ...[
            InfoNotice(message: error),
            const SizedBox(height: NbSpace.md),
          ],
          for (final session in value.sessions)
            _SessionTile(session: session, revoking: value.revoking),
        ],
      ),
      AsyncError() => ErrorState(
        message: 'Não foi possível carregar os aparelhos.',
        onRetry: () => ref.invalidate(sessionsControllerProvider),
      ),
      _ => Semantics(
        label: 'Carregando os aparelhos',
        container: true,
        child: const Column(
          children: [
            Skeleton(width: double.infinity, height: 64),
            SizedBox(height: NbSpace.md),
            Skeleton(width: double.infinity, height: 64),
          ],
        ),
      ),
    };
  }
}

class _SessionTile extends ConsumerWidget {
  const new({required this.session, required this.revoking});

  final ActiveSession session;
  final String? revoking;

  Future<void> _confirmAndRevoke(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Encerrar esta sessão?',
      message:
          'O aparelho sai da sua conta e precisa entrar de novo com a senha.',
      confirmLabel: 'Encerrar',
    );
    if (!confirmed) return;
    unawaited(ref.read(sessionsControllerProvider.notifier).revoke(session.id));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final now = ref.watch(nowProvider)();
    final name = session.deviceLabel ?? 'Aparelho';
    return Container(
      margin: const EdgeInsets.only(bottom: NbSpace.sm),
      padding: const EdgeInsets.all(NbSpace.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.box),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Icon(Icons.smartphone, color: colors.textMuted),
          ),
          const SizedBox(width: NbSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.current ? '$name · Este aparelho' : name,
                  style: context.nbText.bodyText,
                ),
                const SizedBox(height: 2),
                Text(
                  'Último uso: ${movementTime(session.lastUsedAt, now)}',
                  style: context.nbText.caption,
                ),
              ],
            ),
          ),
          // D3: this device ends by signing out, on the Profile.
          if (!session.current && revoking == session.id)
            const SizedBox.square(
              dimension: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                semanticsLabel: 'Encerrando a sessão',
              ),
            )
          else if (!session.current)
            TextButton(
              onPressed: revoking == null
                  ? () => _confirmAndRevoke(context, ref)
                  : null,
              child: const Text('Encerrar'),
            ),
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.caption,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String caption;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      button: true,
      label: '$title, $caption',
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Row(
              children: [
                Icon(icon, color: colors.accent),
                const SizedBox(width: NbSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: context.nbText.bodyText),
                      const SizedBox(height: 2),
                      Text(caption, style: context.nbText.caption),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
