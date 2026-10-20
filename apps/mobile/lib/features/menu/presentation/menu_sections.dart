import 'package:flutter/material.dart';

/// One card of the menu: its icon, its name and whether it is new.
typedef MenuItem = ({IconData icon, String label, bool isNew});

/// One section of the menu: its title and its cards.
typedef MenuSection = ({String title, List<MenuItem> items});

MenuItem _item(IconData icon, String label, {bool isNew = false}) =>
    (icon: icon, label: label, isNew: isNew);

/// The menu's sections, in the reference's order (v1.1.0 plan, task 4.13).
/// Names are generic: no third party's mark or another bank's product
/// (repository rules). None opens anything yet.
final List<MenuSection> menuSections = [
  (
    title: 'Para você',
    items: [
      _item(Icons.tune, 'Limites de crédito'),
      _item(Icons.show_chart, 'CDB Limite Garantido'),
      _item(Icons.account_balance_wallet_outlined, 'Carteira digital'),
      _item(Icons.toll_outlined, 'Tag de pedágio'),
      _item(Icons.share_location_outlined, 'Locais seguros'),
      _item(Icons.work_outline, 'Trazer salário'),
    ],
  ),
  (
    title: 'Acessos rápidos',
    items: [
      _item(Icons.credit_card, 'Cartão virtual'),
      _item(Icons.swap_horiz, 'Transferir'),
      _item(Icons.key_outlined, 'Minhas chaves'),
      _item(Icons.qr_code_scanner, 'Pagar'),
      _item(Icons.event_repeat, 'Débito automático'),
      _item(Icons.forum_outlined, 'Ajuda (Chat)'),
    ],
  ),
  (
    title: 'Cartões',
    items: [
      _item(Icons.tune, 'Limites de crédito'),
      _item(Icons.request_quote_outlined, 'Minha fatura'),
      _item(Icons.upgrade, 'Upgrade de cartão'),
      _item(Icons.stars_outlined, 'Pontos e cashback'),
      _item(Icons.account_balance_wallet_outlined, 'Carteira digital'),
      _item(Icons.file_download_outlined, 'Baixar fatura'),
      _item(Icons.pie_chart_outline, 'Parcelar fatura'),
      _item(Icons.calculate_outlined, 'Parcelar compra'),
      _item(Icons.more_horiz, 'Mais opções'),
    ],
  ),
  (
    title: 'Linhas de crédito',
    items: [
      _item(Icons.tune, 'Limites de crédito'),
      _item(
        Icons.business_center_outlined,
        'Consignado do Trabalhador',
        isNew: true,
      ),
      _item(Icons.volunteer_activism_outlined, 'Empréstimos'),
      _item(Icons.money_outlined, 'Cheque especial'),
      _item(Icons.handshake_outlined, 'Negociar dívidas'),
      _item(Icons.groups_outlined, 'Consórcio'),
    ],
  ),
  (
    title: 'Pix e Transferências',
    items: [
      _item(Icons.key_outlined, 'Minhas chaves'),
      _item(Icons.send_outlined, 'Fazer Pix'),
      _item(Icons.receipt_outlined, 'Pix Cobrança'),
      _item(Icons.qr_code_2, 'Receber via QR Code'),
      _item(Icons.tune, 'Limites de Pix'),
      _item(Icons.paid_outlined, 'Pagar vários Pix'),
      _item(Icons.account_balance_outlined, 'Agência e conta'),
      _item(Icons.local_atm_outlined, 'Pix Saque e Pix Troco'),
      _item(Icons.autorenew, 'Pagar via Pix Automático'),
    ],
  ),
  (
    title: 'Pagamentos',
    items: [
      _item(Icons.receipt_long_outlined, 'Extrato'),
      _item(Icons.description_outlined, 'Central de Boletos (DDA)'),
      _item(Icons.qr_code_scanner, 'Pagar contas'),
      _item(Icons.event_repeat, 'Débito automático'),
      _item(Icons.local_atm_outlined, 'Sacar dinheiro'),
      _item(Icons.tune, 'Limites para transações'),
      _item(Icons.paid_outlined, 'Pagar vários boletos'),
    ],
  ),
  (
    title: 'Investimentos',
    items: [
      _item(Icons.bar_chart, 'Renda fixa'),
      _item(Icons.show_chart, 'CDB Limite Garantido'),
      _item(Icons.account_balance_outlined, 'Fundos'),
      _item(Icons.candlestick_chart_outlined, 'Renda variável'),
      _item(Icons.public, 'Investimento global'),
      _item(Icons.savings_outlined, 'Tesouro Direto'),
      _item(Icons.move_down, 'Trazer investimentos'),
      _item(Icons.more_horiz, 'Mais opções'),
    ],
  ),
  (
    title: 'Seguros',
    items: [
      _item(Icons.favorite_border, 'Seguro de vida'),
      _item(Icons.shield_outlined, 'Seguro da conta'),
      _item(Icons.more_horiz, 'Mais opções'),
    ],
  ),
  (
    title: 'Veículos',
    items: [
      _item(Icons.directions_car_outlined, 'IPVA e multas'),
      _item(Icons.toll_outlined, 'Tag de pedágio'),
      _item(Icons.local_gas_station_outlined, 'Pagar combustível'),
    ],
  ),
  (
    title: 'Recargas e Gift Card',
    items: [
      _item(Icons.phone_android, 'Recarga de celular'),
      _item(Icons.tv_outlined, 'Recarga de TV pré-paga'),
      _item(Icons.directions_bus_outlined, 'Bilhete de transporte'),
      _item(Icons.card_giftcard, 'Gift Card'),
    ],
  ),
  (
    title: 'Viagens',
    items: [
      _item(Icons.public, 'Conta global'),
      _item(Icons.luggage_outlined, 'Seguro viagem'),
      _item(Icons.flight_outlined, 'Comparar passagens'),
    ],
  ),
];
