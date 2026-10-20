/// One example Pix contact, shown while the contacts have no backend.
typedef ExampleContact = ({String name, String bank});

/// The contacts the transfer lists (v1.1.0 plan, task 4.9): made-up people
/// and banks. They go away when the contacts come from the server.
const List<ExampleContact> exampleContacts = [
  (name: 'Mariana Costa', bank: 'Banco Exemplo'),
  (name: 'Carlos Pereira', bank: 'Banco Modelo'),
  (name: 'Loja Fictícia Ltda.', bank: 'Banco Exemplo'),
  (name: 'Júlia Almeida', bank: 'Banco Modelo'),
];
