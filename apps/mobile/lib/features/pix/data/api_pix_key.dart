import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// The key a Pix or a schedule is sent to, as the API takes it.
api.PixKeyRequestInput pixKeyRequestOf(PixKeyRef key) => api.PixKeyRequestInput(
  type: switch (key.type) {
    PixKeyType.cpf => api.PixKeyRequestInputTypeEnum.CPF,
    PixKeyType.email => api.PixKeyRequestInputTypeEnum.EMAIL,
    PixKeyType.phone => api.PixKeyRequestInputTypeEnum.PHONE,
    PixKeyType.random => api.PixKeyRequestInputTypeEnum.RANDOM,
  },
  value: key.value,
);
