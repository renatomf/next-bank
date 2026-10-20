import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/transfer/example_contacts.dart';

/// The Chave Pix tab, inside the transfer's card: the key field with the
/// camera, which opens the QR Code reading, and "Agenda do celular", which
/// says it is coming.
class PixKeyEntry extends StatelessWidget {
  /// Creates the entry.
  const new({required this.onScan, super.key});

  /// Opens the QR Code reading.
  final VoidCallback onScan;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: TextField(
                decoration: InputDecoration(
                  hintText:
                      'Insira uma chave Pix, um contato da sua lista ou leia '
                      'um QR Code',
                  hintMaxLines: 3,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  filled: false,
                ),
              ),
            ),
            NbIconButton(
              icon: Icons.photo_camera_outlined,
              label: 'Ler QR Code',
              color: colors.accent,
              onPressed: onScan,
            ),
          ],
        ),
        TextButton(
          onPressed: () => _sayComingSoon(context),
          child: const Text('Agenda do celular'),
        ),
      ],
    );
  }
}

/// The Chave Pix tab, below the transfer's card: "Faça vários Pix de uma
/// vez" and the Pix contacts, filtered by name as the customer types.
class PixContacts extends StatefulWidget {
  /// Creates the contacts.
  const new({super.key});

  @override
  State<PixContacts> createState() => _PixContactsState();
}

class _PixContactsState extends State<PixContacts> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final wanted = _query.trim().toLowerCase();
    final contacts = [
      for (final contact in exampleContacts)
        if (contact.name.toLowerCase().contains(wanted)) contact,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _MultiplePixCard(),
        const SizedBox(height: NbSpace.xl),
        Semantics(
          header: true,
          child: Text('Contatos Pix', style: context.nbText.sectionTitle),
        ),
        const SizedBox(height: NbSpace.md),
        TextField(
          onChanged: (query) => setState(() => _query = query),
          decoration: const InputDecoration(
            hintText: 'Buscar contato',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: NbSpace.sm),
        for (final contact in contacts) _ContactRow(contact: contact),
      ],
    );
  }
}

class _MultiplePixCard extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: 'Faça vários Pix de uma vez',
      onTap: () => _sayComingSoon(context),
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => _sayComingSoon(context),
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Row(
              children: [
                Icon(Icons.paid_outlined, color: colors.accent),
                const SizedBox(width: NbSpace.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: NbSpace.xs,
                    children: [
                      Text(
                        'Faça vários Pix de uma vez',
                        style: context.nbText.bodyStrong,
                      ),
                      Text(
                        'Mais praticidade e rapidez nas suas transferências.',
                        style: context.nbText.caption,
                      ),
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

class _ContactRow extends StatelessWidget {
  const new({required this.contact});

  final ExampleContact contact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NbSpace.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(contact.name, style: context.nbText.bodyText),
                Text(contact.bank, style: context.nbText.caption),
              ],
            ),
          ),
          NbIconButton(
            icon: Icons.star_border,
            label: 'Favoritar ${contact.name}',
            onPressed: () => _sayComingSoon(context),
          ),
          NbIconButton(
            icon: Icons.more_vert,
            label: 'Mais opções de ${contact.name}',
            onPressed: () => _sayComingSoon(context),
          ),
        ],
      ),
    );
  }
}

void _sayComingSoon(BuildContext context) =>
    showNbToast(context, 'Em breve.', icon: Icons.info_outline);
