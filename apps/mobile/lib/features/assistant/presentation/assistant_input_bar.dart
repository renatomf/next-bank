import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// "O que você precisa?": the plus with the attach menu, the field, the
/// camera and the microphone (v1.1.0 plan, task 4.10). Layout only: the
/// field takes typing, but sending, attaching, the camera and the
/// microphone say they are coming; nothing typed leaves the phone or
/// reaches a log (MOB-02).
class AssistantInputBar extends StatelessWidget {
  /// Creates the bar.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.xs),
      decoration: ShapeDecoration(
        color: colors.surface,
        shape: StadiumBorder(side: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          const _AttachMenu(),
          Expanded(
            child: TextField(
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => sayComingSoon(),
              decoration: const InputDecoration(
                hintText: 'O que você precisa?',
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
              ),
            ),
          ),
          NbIconButton(
            icon: Icons.photo_camera_outlined,
            label: 'Câmera',
            onPressed: sayComingSoon,
          ),
          NbIconButton(
            icon: Icons.mic_none,
            label: 'Microfone',
            onPressed: sayComingSoon,
          ),
        ],
      ),
    );
  }
}

/// The plus, opening Galeria, Arquivos and Buscar contato in a box like
/// the app's others, on the agent sheet's background (S21 checkpoint).
class _AttachMenu extends StatelessWidget {
  const new();

  static const List<(IconData, String)> _items = [
    (Icons.image_outlined, 'Galeria'),
    (Icons.description_outlined, 'Arquivos'),
    (Icons.person_outline, 'Buscar contato'),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return MenuAnchor(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(colors.surface),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NbRadius.boxInner),
            side: BorderSide(color: colors.border),
          ),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(vertical: NbSpace.xs),
        ),
      ),
      menuChildren: [
        for (final (icon, label) in _items)
          MenuItemButton(
            leadingIcon: Icon(icon, size: NbSize.icon, color: colors.accent),
            style: MenuItemButton.styleFrom(
              foregroundColor: colors.text,
              textStyle: NbType.bodyText,
              padding: const EdgeInsets.symmetric(horizontal: NbSpace.lg),
              minimumSize: const Size(0, NbSize.button),
            ),
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
            child: Text(label),
          ),
      ],
      builder: (context, menu, _) => NbIconButton(
        icon: Icons.add_circle_outline,
        label: 'Anexar',
        onPressed: () => menu.isOpen ? menu.close() : menu.open(),
      ),
    );
  }
}
