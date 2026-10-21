import 'package:flutter/material.dart';

/// One example notification, shown while the notifications have no backend.
typedef ExampleNotification = ({
  IconData icon,
  String category,
  String preview,
  int unread,

  // Whether the preview cites a made-up figure, shown with the "Exemplo"
  // tag (D7, revised in the v1.1.0 plan, task 6).
  bool madeUpFigure,
});

/// The examples the list repeats (v1.1.0 plan, task 4.6): fictitious,
/// generic, about what the app has. They go away when the notifications
/// come from the server.
const List<ExampleNotification> exampleNotifications = [
  (
    icon: Icons.swap_horiz,
    category: 'Pix e transferências',
    preview:
        r'Pix recebido no valor de R$ 50,00. Toque para ver o '
        'comprovante.',
    unread: 3,
    madeUpFigure: true,
  ),
  (
    icon: Icons.qr_code_scanner,
    category: 'Pagamentos',
    preview: r'Seu pagamento de R$ 120,00 por QR Code foi concluído.',
    unread: 2,
    madeUpFigure: true,
  ),
  (
    icon: Icons.shield_outlined,
    category: 'Segurança',
    preview:
        'Um novo aparelho acessou a sua conta. Se não foi você, encerre a '
        'sessão em Segurança.',
    unread: 1,
    madeUpFigure: false,
  ),
  (
    icon: Icons.auto_awesome,
    category: 'Novidades',
    preview: 'Agora você paga com QR Code direto da Home.',
    unread: 2,
    madeUpFigure: false,
  ),
  (
    icon: Icons.phone_android,
    category: 'Recarga',
    preview: 'A recarga de celular chega em breve ao next bank.',
    unread: 1,
    madeUpFigure: false,
  ),
  (
    icon: Icons.warning_amber_outlined,
    category: 'Avisos',
    preview: 'Confira os horários de atendimento nos feriados.',
    unread: 1,
    madeUpFigure: false,
  ),
];
