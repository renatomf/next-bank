import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/idempotency_key.dart';

final _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  test('is a lowercase UUID version 4', () {
    for (var i = 0; i < 200; i++) {
      expect(newIdempotencyKey(), matches(_uuidV4));
    }
  });

  test('never repeats', () {
    final keys = {for (var i = 0; i < 10000; i++) newIdempotencyKey()};

    expect(keys, hasLength(10000));
  });

  test('takes every random bit from the generator it is given', () {
    // All bits set except the version and variant ones.
    final key = newIdempotencyKey(_AllOnes());

    expect(key, 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
}

class _AllOnes implements Random {
  @override
  int nextInt(int max) => max - 1;

  @override
  bool nextBool() => true;

  @override
  double nextDouble() => 1;
}
