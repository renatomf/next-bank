/// One made-up recommended offer: its rate, its kind and its name.
typedef RecommendedOffer = ({String rate, String kind, String name});

/// The recommended offers while investments have no backend (v1.1.0 plan,
/// task 4.16): made-up rates, generic names.
const List<RecommendedOffer> exampleOffers = [
  (rate: '102% do CDI', kind: 'Renda Fixa', name: 'CDB Pós-fixado 3 meses'),
  (rate: '103% do CDI', kind: 'Renda Fixa', name: 'CDB Pós-fixado 6 meses'),
  (rate: '101,5% do CDI', kind: 'Renda Fixa', name: 'CDB Liquidez diária'),
  (rate: '101,5% do CDI', kind: 'Renda Fixa', name: 'CDB Limite Garantido'),
];

/// One kind of product: its name and what it holds.
typedef InvestmentProduct = ({String title, String description});

/// The full shelf of products.
const List<InvestmentProduct> investmentProducts = [
  (title: 'Renda Fixa', description: 'CDBs prefixados, pós-fixados e IPCA+'),
  (title: 'Tesouro Direto', description: 'Títulos públicos nacionais'),
  (title: 'Fundos', description: 'Fundos de renda fixa, ações e mais'),
  (title: 'Bolsa de Valores', description: 'Ações, fundos imobiliários e BDRs'),
  (title: 'Previdência', description: 'Planos VGBL, PGBL e portabilidade'),
  (title: 'Carteira Recomendada', description: 'Carteiras de fundos e ações'),
];
