import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/home/presentation/pix_box/cpf_key_row.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_actions.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_key_field.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_links.dart';

/// The Home's Pix box (v1.1.0 plan, task 4.2), from top to bottom: a CPF key
/// field, the three main Pix actions, the customer's CPF key, and the links
/// to Pix Automático and Minhas chaves.
class PixBox extends StatelessWidget {
  /// Creates the box; the Home says where each action goes.
  const new({
    required this.cpfMasked,
    required this.onPix,
    required this.onPixWithKey,
    required this.onTransfer,
    required this.onPay,
    required this.onReceive,
    required this.onAutomatic,
    required this.onKeys,
    super.key,
  });

  /// The customer's CPF as the server masks it; null while it loads.
  final String? cpfMasked;

  /// Opens the Pix area, when no key was typed.
  final VoidCallback onPix;

  /// Opens the Pix with a valid CPF key, in digits.
  final ValueChanged<String> onPixWithKey;

  /// Opens "Transferir Pix".
  final VoidCallback onTransfer;

  /// Opens the reading of a Pix QR Code.
  final VoidCallback onPay;

  /// Opens "Receber", with the customer's QR Code.
  final VoidCallback onReceive;

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  @override
  Widget build(BuildContext context) {
    return NbSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text('Pix', style: Theme.of(context).textTheme.titleMedium),
          ),
          const SizedBox(height: NbSpace.lg),
          PixKeyField(onPix: onPix, onPixWithKey: onPixWithKey),
          const SizedBox(height: NbSpace.lg),
          PixActions(
            onTransfer: onTransfer,
            onPay: onPay,
            onReceive: onReceive,
          ),
          const SizedBox(height: NbSpace.md),
          CpfKeyRow(cpfMasked: cpfMasked),
          const SizedBox(height: NbSpace.sm),
          PixLinks(onAutomatic: onAutomatic, onKeys: onKeys),
        ],
      ),
    );
  }
}
